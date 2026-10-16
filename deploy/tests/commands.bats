#!/usr/bin/env bats

setup() {
  export REPOSITORY_ROOT="${BATS_TEST_DIRNAME}/../.."
  export TEST_TEMP="$(mktemp -d "${BATS_TEST_TMPDIR}/bagredex-commands.XXXXXX")"
  export MOCK_BIN="${TEST_TEMP}/bin"
  export COMMAND_LOG="${TEST_TEMP}/commands.log"
  mkdir -p "${MOCK_BIN}"
}

teardown() {
  rm -rf -- "${TEST_TEMP}"
}

setup_review_mocks() {
  printf '%s\n' '#!/usr/bin/env bash' \
    'printf "npm %s\\n" "$*" >>"${COMMAND_LOG}"' >"${MOCK_BIN}/npm"
  printf '%s\n' '#!/usr/bin/env bash' 'exit 0' >"${MOCK_BIN}/node"
  printf '%s\n' '#!/usr/bin/env bash' \
    'printf "curl %s\\n" "$*" >>"${COMMAND_LOG}"' \
    '[[ "${MOCK_CURL_READY:-true}" == true ]]' >"${MOCK_BIN}/curl"
  printf '%s\n' '#!/usr/bin/env bash' 'exit 0' >"${MOCK_BIN}/sleep"
  printf '%s\n' '#!/usr/bin/env bash' \
    'printf "podman %s\\n" "$*" >>"${COMMAND_LOG}"' \
    'if [[ -n "${MOCK_PODMAN_FAIL_MATCH:-}" && "$*" == *"${MOCK_PODMAN_FAIL_MATCH}"* ]]; then exit 9; fi' \
    'if [[ "$*" == *" up server"* ]]; then' \
    '  case "${MOCK_FOREGROUND:-normal}" in' \
    '    block) trap "exit 130" INT; while :; do /usr/bin/sleep 1; done ;;' \
    '    fail) exit 7 ;;' \
    '  esac' \
    'fi' \
    'exit 0' >"${MOCK_BIN}/podman"
  chmod +x "${MOCK_BIN}/curl" "${MOCK_BIN}/node" "${MOCK_BIN}/npm" \
    "${MOCK_BIN}/podman" "${MOCK_BIN}/sleep"
}

@test "help documents primary commands" {
  run "${REPOSITORY_ROOT}/bagredex.sh" help
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"run"* ]]
  [[ "${output}" == *"review"* ]]
  [[ "${output}" == *"migrate"* ]]
  [[ "${output}" == *"build-web"* ]]
  [[ "${output}" == *"watch-web"* ]]
  [[ "${output}" == *"publish VERSION"* ]]
  [[ "${output}" == *"deploy VERSION"* ]]
}

@test "review rejects arguments and invalid configuration before mutation" {
  run "${REPOSITORY_ROOT}/bagredex.sh" review unexpected
  [ "${status}" -eq 2 ]

  run env BAGREDEX_PORT=0 "${REPOSITORY_ROOT}/bagredex.sh" review
  [ "${status}" -eq 2 ]
  [[ "${output}" == *"BAGREDEX_PORT"* ]]

  run env BAGREDEX_REVIEW_USERNAME= "${REPOSITORY_ROOT}/bagredex.sh" review
  [ "${status}" -eq 2 ]
  [[ "${output}" == *"BAGREDEX_REVIEW_USERNAME"* ]]

  run env BAGREDEX_REVIEW_PASSWORD= "${REPOSITORY_ROOT}/bagredex.sh" review
  [ "${status}" -eq 2 ]
  [[ "${output}" == *"BAGREDEX_REVIEW_PASSWORD"* ]]

  run env BAGREDEX_REVIEW_USERNAME=$'unsafe\nname' \
    "${REPOSITORY_ROOT}/bagredex.sh" review
  [ "${status}" -eq 2 ]
  [[ "${output}" == *"control characters"* ]]
}

@test "review rejects a missing or malformed repository data pin" {
  local checkout="${TEST_TEMP}/checkout"
  mkdir -p "${checkout}/deploy"
  cp "${REPOSITORY_ROOT}/bagredex.sh" "${checkout}/bagredex.sh"

  run "${checkout}/bagredex.sh" review
  [ "${status}" -eq 2 ]
  [[ "${output}" == *"pin is unavailable"* ]]

  printf '%s\n' 'BAGREDEX_POKEMON_DATA_VERSION=unsafe/value' \
    >"${checkout}/deploy/pokemon-data.env"
  run "${checkout}/bagredex.sh" review
  [ "${status}" -eq 2 ]
  [[ "${output}" == *"one valid"* ]]
}

@test "review initializes pinned data and account before foreground server" {
  setup_review_mocks

  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" BAGREDEX_PORT=8080 \
    MOCK_FOREGROUND=fail \
    BAGREDEX_REVIEW_USERNAME='reviewer;still-data' \
    BAGREDEX_REVIEW_PASSWORD='password;still-data' \
    "${REPOSITORY_ROOT}/bagredex.sh" review
  [ "${status}" -eq 7 ]
  [[ "${output}" == *"http://127.0.0.1:8080/"* ]]
  [[ "${output}" == *"reviewer;still-data"* ]]
  [[ "${output}" == *"password;still-data"* ]]
  ! grep -Fq 'reviewer;still-data' "${COMMAND_LOG}"
  ! grep -Fq 'password;still-data' "${COMMAND_LOG}"
  [ "$(grep -n '^npm .* ci ' "${COMMAND_LOG}" | head -1 | cut -d: -f1)" -lt \
    "$(grep -n '^npm .* run build$' "${COMMAND_LOG}" | head -1 | cut -d: -f1)" ]
  [ "$(grep -n '^npm .* run build$' "${COMMAND_LOG}" | head -1 | cut -d: -f1)" -lt \
    "$(grep -n 'compose .* build server' "${COMMAND_LOG}" | head -1 | cut -d: -f1)" ]
  grep -Fq 'load_pokemon_data /app/src/data/releases/showdown-3a766f2c-s1-i2-4bedbf1eb44d' \
    "${COMMAND_LOG}"
  grep -Fq 'activate_pokemon_data showdown-3a766f2c-s1-i2-4bedbf1eb44d' "${COMMAND_LOG}"
  ! grep -Fq 'activate_pokemon_data showdown-3a766f2c-s1-i2-4bedbf1eb44d --if-none' \
    "${COMMAND_LOG}"
  grep -Fq 'run --rm -T server python manage.py shell -c' "${COMMAND_LOG}"
  [ "$(grep -n ' up -d database' "${COMMAND_LOG}" | head -1 | cut -d: -f1)" -lt \
    "$(grep -n 'exec -T database .*pg_isready' "${COMMAND_LOG}" | head -1 | cut -d: -f1)" ]
  [ "$(grep -n 'exec -T database .*pg_isready' "${COMMAND_LOG}" | head -1 | cut -d: -f1)" -lt \
    "$(grep -n 'migrate --noinput' "${COMMAND_LOG}" | head -1 | cut -d: -f1)" ]
  [ "$(grep -n 'migrate --noinput' "${COMMAND_LOG}" | head -1 | cut -d: -f1)" -lt \
    "$(grep -n 'load_pokemon_data' "${COMMAND_LOG}" | head -1 | cut -d: -f1)" ]
  [ "$(grep -n 'load_pokemon_data' "${COMMAND_LOG}" | head -1 | cut -d: -f1)" -lt \
    "$(grep -n 'activate_pokemon_data' "${COMMAND_LOG}" | head -1 | cut -d: -f1)" ]
  grep -Fq ' up server' "${COMMAND_LOG}"
  grep -Fq ' down' "${COMMAND_LOG}"
  ! grep -Eq 'down .*--volumes|down .*-v|volume (rm|prune)' "${COMMAND_LOG}"
  grep -Fq 'objects.update_or_create(' "${REPOSITORY_ROOT}/bagredex.sh"
  grep -Fq 'defaults={"is_active": True, "is_staff": True, "is_superuser": True}' \
    "${REPOSITORY_ROOT}/bagredex.sh"
  grep -Fq 'user.set_password(password.decode())' "${REPOSITORY_ROOT}/bagredex.sh"
}

@test "review cleans up when database or initialization fails" {
  setup_review_mocks
  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" \
    MOCK_PODMAN_FAIL_MATCH='exec -T database' "${REPOSITORY_ROOT}/bagredex.sh" review
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"database did not become ready"* ]]
  [[ "${output}" != *"review is ready"* ]]
  grep -Fq ' down' "${COMMAND_LOG}"

  : >"${COMMAND_LOG}"
  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" \
    MOCK_PODMAN_FAIL_MATCH=load_pokemon_data "${REPOSITORY_ROOT}/bagredex.sh" review
  [ "${status}" -eq 9 ]
  [[ "${output}" != *"review is ready"* ]]
  grep -Fq ' down' "${COMMAND_LOG}"
  ! grep -Fq ' up -d server' "${COMMAND_LOG}"
}

@test "review withholds credentials when server readiness fails" {
  setup_review_mocks
  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" \
    MOCK_CURL_READY=false "${REPOSITORY_ROOT}/bagredex.sh" review
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"server did not become ready"* ]]
  [[ "${output}" != *"Bagredex review is ready"* ]]
  [[ "${output}" != *"Password:"* ]]
  [ "$(grep -c '^curl ' "${COMMAND_LOG}")" -eq 30 ]
  grep -Fq ' up -d server' "${COMMAND_LOG}"
  grep -Fq ' down' "${COMMAND_LOG}"
}

@test "review normal and repeated runs clean up without deleting persistence" {
  setup_review_mocks
  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" \
    "${REPOSITORY_ROOT}/bagredex.sh" review
  [ "${status}" -eq 0 ]
  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" \
    "${REPOSITORY_ROOT}/bagredex.sh" review
  [ "${status}" -eq 0 ]
  [ "$(grep -c 'load_pokemon_data /app/src/data/releases/' "${COMMAND_LOG}")" -eq 2 ]
  [ "$(grep -c 'activate_pokemon_data showdown-' "${COMMAND_LOG}")" -eq 2 ]
  [ "$(grep -c 'run --rm -T server python manage.py shell -c' "${COMMAND_LOG}")" -eq 2 ]
  [ "$(grep -c ' down' "${COMMAND_LOG}")" -eq 2 ]
  ! grep -Eq 'down .*--volumes|down .*-v|volume (rm|prune)' "${COMMAND_LOG}"
}

@test "review SIGINT cleanup preserves the database volume" {
  setup_review_mocks
  run timeout --preserve-status --signal=INT --kill-after=2 1 \
    env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" MOCK_FOREGROUND=block \
    "${REPOSITORY_ROOT}/bagredex.sh" review
  [ "${status}" -eq 130 ]
  grep -Fq ' up server' "${COMMAND_LOG}"
  grep -Fq ' down' "${COMMAND_LOG}"
  ! grep -Eq 'down .*--volumes|down .*-v|volume (rm|prune)' "${COMMAND_LOG}"
}

@test "local review documentation covers overrides persistence and Incus access" {
  local readme="${REPOSITORY_ROOT}/deploy/README.md"

  grep -Fq './bagredex.sh review' "${readme}"
  grep -Fq 'BAGREDEX_PORT=8080' "${readme}"
  grep -Fq 'BAGREDEX_REVIEW_USERNAME=reviewer' "${readme}"
  grep -Fq "BAGREDEX_REVIEW_PASSWORD='choose-a-local-password'" "${readme}"
  grep -Fq 'bagredex-local-database' "${readme}"
  grep -Fq 'incus config device add bagredex-dev bagredex-review proxy' "${readme}"
  grep -Fq 'listen=tcp:127.0.0.1:8080 connect=tcp:127.0.0.1:8000' "${readme}"
  grep -Fq 'incus config device remove bagredex-dev bagredex-review' "${readme}"
}

@test "Web GUI build uses the exact lockfile and excludes generated build inputs" {
  grep -Fq 'npm ci --ignore-scripts --no-audit --no-fund' \
    "${REPOSITORY_ROOT}/deploy/Containerfile"
  grep -Fq 'COPY --from=frontend-build /app/src/web/static/web/dist/' \
    "${REPOSITORY_ROOT}/deploy/Containerfile"
  grep -Fq 'verify-vite-assets.mjs static/web/dist/.vite/manifest.json static/web/dist' \
    "${REPOSITORY_ROOT}/deploy/Containerfile"
  grep -Fxq 'src/web/node_modules' "${REPOSITORY_ROOT}/.containerignore"
  grep -Fxq 'src/web/static/web/dist' "${REPOSITORY_ROOT}/.containerignore"
}

@test "local run installs and builds frontend assets before compose startup" {
  printf '%s\n' '#!/usr/bin/env bash' \
    'printf "npm %s\\n" "$*" >>"${COMMAND_LOG}"' >"${MOCK_BIN}/npm"
  printf '%s\n' '#!/usr/bin/env bash' 'exit 0' >"${MOCK_BIN}/node"
  printf '%s\n' '#!/usr/bin/env bash' \
    'printf "podman %s\\n" "$*" >>"${COMMAND_LOG}"' \
    '[[ "$*" == *" up --build"* ]] && exit 7' \
    'exit 0' >"${MOCK_BIN}/podman"
  chmod +x "${MOCK_BIN}/node" "${MOCK_BIN}/npm" "${MOCK_BIN}/podman"
  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" \
    "${REPOSITORY_ROOT}/bagredex.sh" run
  [ "${status}" -eq 7 ]
  [ "$(grep -n '^npm .* ci ' "${COMMAND_LOG}" | cut -d: -f1)" -lt \
    "$(grep -n '^npm .* run build$' "${COMMAND_LOG}" | cut -d: -f1)" ]
  [ "$(grep -n '^npm .* run build$' "${COMMAND_LOG}" | cut -d: -f1)" -lt \
    "$(grep -n '^podman .* up --build$' "${COMMAND_LOG}" | cut -d: -f1)" ]
}

@test "unknown command is rejected" {
  run "${REPOSITORY_ROOT}/bagredex.sh" unknown
  [ "${status}" -eq 2 ]
  [[ "${output}" == *"Unknown command"* ]]
}

@test "run tears down local compose when startup fails" {
  printf '%s\n' '#!/usr/bin/env bash' 'exit 0' >"${MOCK_BIN}/npm"
  printf '%s\n' '#!/usr/bin/env bash' 'exit 0' >"${MOCK_BIN}/node"
  printf '%s\n' '#!/usr/bin/env bash' \
    'printf "%s\\n" "$*" >>"${COMMAND_LOG}"' \
    '[[ "$*" == *" up --build"* ]] && exit 7' \
    'exit 0' >"${MOCK_BIN}/podman"
  chmod +x "${MOCK_BIN}/node" "${MOCK_BIN}/npm" "${MOCK_BIN}/podman"
  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" \
    "${REPOSITORY_ROOT}/bagredex.sh" run
  [ "${status}" -eq 7 ]
  grep -Fq 'up --build' "${COMMAND_LOG}"
  grep -Fq 'down' "${COMMAND_LOG}"
}

@test "publish rejects a non-stable version before external commands" {
  run "${REPOSITORY_ROOT}/bagredex.sh" publish 1.0.0-rc.1
  [ "${status}" -eq 2 ]
  [[ "${output}" == *"stable MAJOR.MINOR.PATCH"* ]]
}

@test "deploy rejects a non-stable version before external commands" {
  run "${REPOSITORY_ROOT}/bagredex.sh" deploy latest
  [ "${status}" -eq 2 ]
  [[ "${output}" == *"stable MAJOR.MINOR.PATCH"* ]]
}

@test "local compose pins the health-check domain to localhost" {
  run awk '
    /environment:/ { in_environment = 1; next }
    in_environment && /BAGREDEX_DOMAIN:/ { print; found = 1; exit }
    END { if (!found) exit 1 }
  ' "${REPOSITORY_ROOT}/deploy/compose.local.yaml"
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"BAGREDEX_DOMAIN: localhost"* ]]
}

@test "PostgreSQL is private healthy and stored in an explicitly named volume" {
  grep -Fq 'image: docker.io/library/postgres:17.6-alpine' \
    "${REPOSITORY_ROOT}/deploy/compose.yaml"
  grep -Fq 'pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB' \
    "${REPOSITORY_ROOT}/deploy/compose.yaml"
  grep -Fq 'name: bagredex-database' "${REPOSITORY_ROOT}/deploy/compose.yaml"
  grep -Fq 'internal: true' "${REPOSITORY_ROOT}/deploy/compose.yaml"
  ! grep -Eq '^[[:space:]]+ports:' "${REPOSITORY_ROOT}/deploy/compose.yaml"
}

@test "local server uses development dependencies and migrates before serving" {
  grep -Fq 'target: development' "${REPOSITORY_ROOT}/deploy/compose.local.yaml"
  grep -Fq \
    'python manage.py migrate --noinput && exec python manage.py runserver 0.0.0.0:8000' \
    "${REPOSITORY_ROOT}/deploy/compose.local.yaml"
}

@test "development image exposes virtual environment commands on PATH" {
  run awk '
    /^FROM python-dependencies AS development$/ { in_development = 1; next }
    /^FROM / && in_development { exit }
    in_development && /PATH=\/app\/\.venv\/bin:\$\{PATH\}/ { found = 1 }
    END { if (!found) exit 1 }
  ' "${REPOSITORY_ROOT}/deploy/Containerfile"
  [ "${status}" -eq 0 ]
}

@test "application images package committed Pokemon bundles without source snapshots" {
  local containerfile="${REPOSITORY_ROOT}/deploy/Containerfile"
  grep -Fq 'COPY src/data/releases/ /app/src/data/releases/' "${containerfile}"
  grep -Fq 'COPY src/data/importer/ /app/src/data/importer/' "${containerfile}"
  grep -Fxq 'references' "${REPOSITORY_ROOT}/.containerignore"
  ! grep -Fq 'COPY references' "${containerfile}"
  [ "$(find "${REPOSITORY_ROOT}/src/data/releases/showdown-3a766f2c-s1-i1-923ba416555c/sprites" -type f -name '*.webp' | wc -l)" -eq 706 ]
}

@test "application data is normalized read-only and verified as the runtime user" {
  local containerfile="${REPOSITORY_ROOT}/deploy/Containerfile"

  [ "$(grep -Fc 'RUN chmod -R a=rX,u+w /app/src/data' "${containerfile}")" -eq 2 ]
  grep -Fq 'USER 10001:10001' "${containerfile}"
  grep -Fq 'for manifest in /app/src/data/releases/*/manifest.json' "${containerfile}"
  grep -Fq 'test -r "${manifest}"' "${containerfile}"
  grep -Fq 'test -r "${release_dir}/sprites/normal/abomasnow.webp"' "${containerfile}"
}

@test "deployment pins one approved Pokemon data bundle" {
  grep -Fxq \
    'BAGREDEX_POKEMON_DATA_VERSION=showdown-3a766f2c-s1-i2-4bedbf1eb44d' \
    "${REPOSITORY_ROOT}/deploy/pokemon-data.env"
  ! grep -Eq 'find .*src/data/releases|ls .*src/data/releases' \
    "${REPOSITORY_ROOT}/deploy/scripts/remote-release-worker.sh"
}

@test "Nginx limits POST authentication attempts by direct client IP" {
  grep -Fq 'POST $binary_remote_addr;' "${REPOSITORY_ROOT}/deploy/nginx/nginx.conf"
  grep -Fq 'limit_req_zone $authentication_limit_key zone=authentication:10m rate=10r/m;' \
    "${REPOSITORY_ROOT}/deploy/nginx/nginx.conf"
  [ "$(grep -Fc 'limit_req zone=authentication burst=5 nodelay;' \
    "${REPOSITORY_ROOT}/deploy/nginx/templates/default.conf.template")" -eq 2 ]
  [ "$(grep -Fc 'limit_req_status 429;' \
    "${REPOSITORY_ROOT}/deploy/nginx/templates/default.conf.template")" -eq 2 ]
  grep -Fq 'location = /login/' \
    "${REPOSITORY_ROOT}/deploy/nginx/templates/default.conf.template"
  grep -Fq 'location = /admin/login/' \
    "${REPOSITORY_ROOT}/deploy/nginx/templates/default.conf.template"
}

@test "normal lifecycle commands never request volume deletion" {
  run grep -R -E 'down[[:space:]]+(-v|--volumes)|volume[[:space:]]+(rm|prune)' \
    "${REPOSITORY_ROOT}/bagredex.sh" "${REPOSITORY_ROOT}/deploy/scripts"
  [ "${status}" -eq 1 ]
}

@test "local migration command starts the database before running migrations" {
  printf '%s\n' '#!/usr/bin/env bash' \
    'printf "%s\n" "$*" >>"${COMMAND_LOG}"' >"${MOCK_BIN}/podman"
  chmod +x "${MOCK_BIN}/podman"
  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" \
    "${REPOSITORY_ROOT}/bagredex.sh" migrate
  [ "${status}" -eq 0 ]
  [ "$(grep -n 'build server' "${COMMAND_LOG}" | cut -d: -f1)" -eq 1 ]
  [ "$(grep -n 'up -d database' "${COMMAND_LOG}" | cut -d: -f1)" -eq 2 ]
  grep -Fq 'run --rm server python manage.py migrate --noinput' "${COMMAND_LOG}"
}

@test "production example and preflight require the complete database contract" {
  local variable
  for variable in BAGREDEX_DATABASE_NAME BAGREDEX_DATABASE_USER BAGREDEX_DATABASE_PASSWORD \
    BAGREDEX_DATABASE_HOST BAGREDEX_DATABASE_PORT; do
    grep -Fq "${variable}=" "${REPOSITORY_ROOT}/deploy/env/production.env.example"
    grep -Fq "${variable}" "${REPOSITORY_ROOT}/deploy/scripts/preflight.sh"
  done
}

@test "host uv commands resolve project-relative cache from the backend directory" {
  grep -Fq 'uv --directory "${script_dir}/src/backend" run' "${REPOSITORY_ROOT}/bagredex.sh"
  ! grep -Fq 'uv run --project' "${REPOSITORY_ROOT}/bagredex.sh"
  ! grep -Fq 'UV_CACHE_DIR' "${REPOSITORY_ROOT}/bagredex.sh"
}

@test "development image resolves the uv cache inside the application workspace" {
  grep -Fq 'WORKDIR /app/src/backend' "${REPOSITORY_ROOT}/deploy/Containerfile"
  grep -Fq 'cache-dir = "../../.cache/uv"' \
    "${REPOSITORY_ROOT}/src/backend/pyproject.toml"
  ! grep -R -Fq 'UV_CACHE_DIR' "${REPOSITORY_ROOT}/deploy/Containerfile" \
    "${REPOSITORY_ROOT}/deploy/compose.yaml" "${REPOSITORY_ROOT}/deploy/compose.local.yaml" \
    "${REPOSITORY_ROOT}/deploy/compose.production.yaml" \
    "${REPOSITORY_ROOT}/deploy/scripts" "${REPOSITORY_ROOT}/bagredex.sh"
}

@test "Nginx redirects to the configured domain rather than the request host" {
  run grep -F 'return 301 https://${BAGREDEX_DOMAIN}$request_uri;' \
    "${REPOSITORY_ROOT}/deploy/nginx/templates/default.conf.template"
  [ "${status}" -eq 0 ]
  run grep -F 'https://$host' "${REPOSITORY_ROOT}/deploy/nginx/templates/default.conf.template"
  [ "${status}" -eq 1 ]
}

@test "Nginx entrypoint rejects every noncanonical domain before rendering" {
  local domain
  for domain in Example.com localhost example.123 example.com. .example.com example..com \
    -example.com example-.com 'example.com:443' 'https://example.com' '*.example.com' \
    $'example.com\nmalicious.invalid'; do
    run env BAGREDEX_DOMAIN="${domain}" \
      "${REPOSITORY_ROOT}/deploy/nginx/entrypoint.sh" true
    [ "${status}" -eq 2 ]
    [[ "${output}" == *"lowercase ASCII FQDN"* ]]
  done
}

@test "preflight and Nginx use the same canonical domain expression" {
  local expression="^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$"
  run grep -F "${expression}" "${REPOSITORY_ROOT}/deploy/nginx/entrypoint.sh"
  [ "${status}" -eq 0 ]
  run grep -F "${expression}" "${REPOSITORY_ROOT}/deploy/scripts/preflight.sh"
  [ "${status}" -eq 0 ]
}
