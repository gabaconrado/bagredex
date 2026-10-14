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

@test "help documents primary commands" {
  run "${REPOSITORY_ROOT}/bagredex.sh" help
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"run"* ]]
  [[ "${output}" == *"migrate"* ]]
  [[ "${output}" == *"publish VERSION"* ]]
  [[ "${output}" == *"deploy VERSION"* ]]
}

@test "unknown command is rejected" {
  run "${REPOSITORY_ROOT}/bagredex.sh" unknown
  [ "${status}" -eq 2 ]
  [[ "${output}" == *"Unknown command"* ]]
}

@test "run tears down local compose when startup fails" {
  printf '%s\n' '#!/usr/bin/env bash' \
    'printf "%s\\n" "$*" >>"${COMMAND_LOG}"' \
    '[[ "$*" == *" up --build"* ]] && exit 7' \
    'exit 0' >"${MOCK_BIN}/podman"
  chmod +x "${MOCK_BIN}/podman"
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
