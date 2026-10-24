#!/usr/bin/env bats

setup() {
  REPOSITORY_ROOT="$(cd "${BATS_TEST_DIRNAME}/../.." && pwd)"
  TEST_TEMP="$(mktemp -d)"
  MOCK_BIN="${TEST_TEMP}/bin"
  COMMAND_LOG="${TEST_TEMP}/commands.log"
  SESSION_CACHE="${TEST_TEMP}/session-cache"
  MOCK_STATE="${TEST_TEMP}/podman-state"
  mkdir -p "${MOCK_BIN}" "${MOCK_STATE}"
  : >"${COMMAND_LOG}"
  export REPOSITORY_ROOT TEST_TEMP MOCK_BIN COMMAND_LOG SESSION_CACHE MOCK_STATE
  create_human_review_mocks
}

teardown() {
  rm -rf -- "${TEST_TEMP}"
}

create_human_review_mocks() {
  printf '%s\n' '#!/usr/bin/env bash' \
    'printf "npm %s\\n" "$*" >>"${COMMAND_LOG}"' >"${MOCK_BIN}/npm"
  printf '%s\n' '#!/usr/bin/env bash' 'exit 0' >"${MOCK_BIN}/node"
  printf '%s\n' '#!/usr/bin/env bash' 'exit 0' >"${MOCK_BIN}/sleep"
  printf '%s\n' '#!/usr/bin/env bash' \
    '[[ "${MOCK_PORT_OCCUPIED:-false}" == true ]] && printf "%s\\n" LISTEN' \
    'exit 0' >"${MOCK_BIN}/ss"
  printf '%s\n' '#!/usr/bin/env bash' \
    'printf "curl %s\\n" "$*" >>"${COMMAND_LOG}"' \
    '[[ "${MOCK_CURL_READY:-true}" == true ]]' >"${MOCK_BIN}/curl"
  printf '%s\n' '#!/usr/bin/env bash' \
    'printf "podman %s\\n" "$*" >>"${COMMAND_LOG}"' \
    'if [[ -n "${MOCK_PODMAN_FAIL_MATCH:-}" && "$*" == *"${MOCK_PODMAN_FAIL_MATCH}"* ]]; then exit 9; fi' \
    'if [[ "$1" == ps ]]; then' \
    '  if [[ "$*" == *"com.docker.compose.service=server"* ]]; then' \
    '    [[ -f "${MOCK_STATE}/server" ]] && printf "%s\\n" bagredex-human-review_server_1' \
    '  else' \
    '    [[ -f "${MOCK_STATE}/database" ]] && printf "%s\\n" bagredex-human-review_database_1' \
    '    [[ -f "${MOCK_STATE}/server" ]] && printf "%s\\n" bagredex-human-review_server_1' \
    '    [[ -f "${MOCK_STATE}/unexpected-container" ]] && printf "%s\\n" bagredex-human-review_intruder_1' \
    '  fi' \
    'elif [[ "$1 $2" == "volume exists" ]]; then' \
    '  [[ -f "${MOCK_STATE}/volume" ]]; exit $?' \
    'elif [[ "$1 $2" == "network exists" ]]; then' \
    '  [[ -f "${MOCK_STATE}/network" ]]; exit $?' \
    'elif [[ "$1 $2" == "network inspect" ]]; then' \
    '  printf "%s\\n" "${MOCK_NETWORK_LABEL:-bagredex-human-review}"' \
    'elif [[ "$1 $2" == "network rm" ]]; then' \
    '  rm -f "${MOCK_STATE}/network"' \
    'elif [[ "$1 $2" == "container exists" ]]; then' \
    '  if [[ "${*: -1}" == *_database_1 ]]; then' \
    '    [[ -f "${MOCK_STATE}/database" ]]; exit $?' \
    '  fi' \
    '  [[ -f "${MOCK_STATE}/server" ]]; exit $?' \
    'elif [[ "$1 $2" == "rm -f" ]]; then' \
    '  rm -f "${MOCK_STATE}/server"' \
    'elif [[ "$1" == start && "${*: -1}" == *_database_1 ]]; then' \
    '  touch "${MOCK_STATE}/database"' \
    'elif [[ "$1 $2" == "volume inspect" ]]; then' \
    '  printf "%s\\n" "${MOCK_VOLUME_LABEL:-true}"' \
    'elif [[ "$1" == inspect ]]; then' \
    '  if [[ "${*: -1}" == *_database_1 ]]; then' \
    '    printf "%s\\n" "${MOCK_DATABASE_HEALTH:-running|healthy}"' \
    '  else' \
    '    printf "%s\\n" "${MOCK_SERVER_HEALTH:-running|healthy}"' \
    '  fi' \
    'elif [[ "$1" == compose ]]; then' \
    '  if [[ "$*" == *" up -d database"* ]]; then touch "${MOCK_STATE}/volume" "${MOCK_STATE}/network" "${MOCK_STATE}/database"; fi' \
    '  if [[ "$*" == *" up -d server"* || "$*" == *" run --no-deps -d --name bagredex-human-review_server_1 --service-ports server"* ]]; then touch "${MOCK_STATE}/server"; fi' \
    '  if [[ "$*" == *" ps --status running --services"* ]]; then' \
    '    [[ -f "${MOCK_STATE}/database" ]] && printf "%s\\n" database' \
    '    [[ -f "${MOCK_STATE}/server" ]] && printf "%s\\n" server' \
    '  fi' \
    '  if [[ "$*" == *" down --volumes --remove-orphans"* ]]; then rm -f "${MOCK_STATE}/database" "${MOCK_STATE}/server" "${MOCK_STATE}/volume"; fi' \
    'fi' \
    'exit 0' >"${MOCK_BIN}/podman"
  chmod +x "${MOCK_BIN}/curl" "${MOCK_BIN}/node" "${MOCK_BIN}/npm" \
    "${MOCK_BIN}/podman" "${MOCK_BIN}/sleep" "${MOCK_BIN}/ss"
}

human_review() {
  env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" MOCK_STATE="${MOCK_STATE}" \
    BAGREDEX_HUMAN_REVIEW_CACHE="${SESSION_CACHE}" "$@"
}

@test "human-review help and target validation reject before Podman mutation" {
  run "${REPOSITORY_ROOT}/bagredex.sh" human-review
  [ "${status}" -eq 2 ]
  [[ "${output}" == *"human-review start TARGET"* ]]

  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review start '../unsafe'
  [ "${status}" -eq 2 ]
  [[ "${output}" == *"must match"* ]]
  [ ! -s "${COMMAND_LOG}" ]
  [ ! -e "${SESSION_CACHE}/session" ]
}

@test "human-review start writes a private marker and reports stable fields without logging credentials" {
  run human_review env BAGREDEX_HUMAN_REVIEW_PORT=38117 \
    BAGREDEX_REVIEW_USERNAME='reviewer;safe' \
    BAGREDEX_REVIEW_PASSWORD='password;not-a-command' \
    "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"TARGET: basic-team-builder"* ]]
  [[ "${output}" == *"STATE: ready"* ]]
  [[ "${output}" == *"URL: http://127.0.0.1:8000/"* ]]
  [[ "${output}" == *"PROJECT: bagredex-human-review"* ]]
  [[ "${output}" == *"VOLUME: bagredex-human-review-database"* ]]
  [ "$(stat -c '%a' "${SESSION_CACHE}/session")" = 600 ]
  grep -Fxq 'STATE=ready' "${SESSION_CACHE}/session"
  ! grep -Fq 'reviewer;safe' "${COMMAND_LOG}"
  ! grep -Fq 'password;not-a-command' "${COMMAND_LOG}"
  grep -Fq 'load_pokemon_data /app/src/data/releases/showdown-multi-s5-i6-38ee90625b30' \
    "${COMMAND_LOG}"
  ! grep -Eq 'down .*--volumes|volume (rm|prune)' "${COMMAND_LOG}"
}

@test "human-review defaults to fixed port 8000 and admin credentials" {
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"URL: http://127.0.0.1:8000/"* ]]
  [[ "${output}" == *"USERNAME: admin"* ]]
  [[ "${output}" == *"PASSWORD: admin"* ]]
  grep -Fxq 'PORT=8000' "${SESSION_CACHE}/session"
  grep -Fxq 'PASSWORD=admin' "${SESSION_CACHE}/session"
}

@test "human-review status is read-only and reload preserves the fixed volume" {
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 0 ]
  : >"${COMMAND_LOG}"

  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review status
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"STATE: ready"* ]]
  ! grep -Eq ' build | up | down |volume rm|volume prune' "${COMMAND_LOG}"

  : >"${COMMAND_LOG}"
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review reload
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"STATE: ready"* ]]
  grep -Fq 'build server' "${COMMAND_LOG}"
  grep -Fq 'migrate --noinput' "${COMMAND_LOG}"
  grep -Fq 'container exists bagredex-human-review_server_1' "${COMMAND_LOG}"
  grep -Fq 'rm -f bagredex-human-review_server_1' "${COMMAND_LOG}"
  grep -Fq 'start bagredex-human-review_database_1' "${COMMAND_LOG}"
  grep -Fq 'run --no-deps --rm server python manage.py migrate --noinput' "${COMMAND_LOG}"
  grep -Fq 'run --no-deps -d --name bagredex-human-review_server_1 --service-ports server' \
    "${COMMAND_LOG}"
  ! grep -Fq ' up -d database' "${COMMAND_LOG}"
  ! grep -Eq 'down .*--volumes|volume (rm|prune)' "${COMMAND_LOG}"
  [ -f "${MOCK_STATE}/volume" ]
}

@test "interrupted start remains resumable and finish deletes only exact scoped resources" {
  run human_review env MOCK_PODMAN_FAIL_MATCH=load_pokemon_data \
    "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 9 ]
  grep -Fxq 'STATE=starting' "${SESSION_CACHE}/session"
  [ -f "${MOCK_STATE}/volume" ]

  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review reload
  [ "${status}" -eq 0 ]
  grep -Fxq 'STATE=ready' "${SESSION_CACHE}/session"

  : >"${COMMAND_LOG}"
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review finish
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"STATE: absent"* ]]
  [ ! -e "${SESSION_CACHE}/session" ]
  [ ! -e "${MOCK_STATE}/volume" ]
  [ "$(grep -Fc -- '-p bagredex-human-review' "${COMMAND_LOG}")" -eq 1 ]
  grep -Fq 'down --volumes --remove-orphans' "${COMMAND_LOG}"
  ! grep -Fq 'bagredex-local' "${COMMAND_LOG}"
}

@test "failed finish preserves its finishing marker and supports exact retry" {
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 0 ]

  run human_review env MOCK_PODMAN_FAIL_MATCH='down --volumes' \
    "${REPOSITORY_ROOT}/bagredex.sh" human-review finish
  [ "${status}" -eq 7 ]
  grep -Fxq 'STATE=finishing' "${SESSION_CACHE}/session"
  [ -f "${MOCK_STATE}/volume" ]

  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review finish
  [ "${status}" -eq 0 ]
  [ ! -e "${SESSION_CACHE}/session" ]
}

@test "human-review rejects active sessions orphaned resources and invalid markers" {
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 0 ]

  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 3 ]
  [[ "${output}" == *"already active"* ]]

  rm -f -- "${SESSION_CACHE}/session"
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 6 ]
  [[ "${output}" == *"without a valid session marker"* ]]

  rm -f -- "${MOCK_STATE}"/*
  mkdir -p "${SESSION_CACHE}"
  printf '%s\n' 'FORMAT_VERSION=1' 'TARGET=../../unsafe' >"${SESSION_CACHE}/session"
  chmod 600 "${SESSION_CACHE}/session"
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review status
  [ "${status}" -eq 5 ]
  [[ "${output}" == *"marker is invalid"* ]]
}

@test "human-review lock rejects a concurrent lifecycle command" {
  mkdir -p "${SESSION_CACHE}"
  (
    exec 8>"${SESSION_CACHE}/lock"
    flock 8
    printf '%s\n' locked >"${TEST_TEMP}/lock-ready"
    sleep 10
  ) &
  local holder=$!
  while [[ ! -f "${TEST_TEMP}/lock-ready" ]]; do sleep 0.01; done

  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review status
  kill "${holder}"
  wait "${holder}" || true
  [ "${status}" -eq 3 ]
  [[ "${output}" == *"session is busy"* ]]
  [ ! -s "${COMMAND_LOG}" ]
}

@test "human-review pins the reported older feature commit and activated bundle" {
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 0 ]

  local reported head marker_base
  reported="$(grep -Eo '[0-9a-f]{40,64}' \
    "${REPOSITORY_ROOT}/docs/reports/2026-10-17-basic-team-builder.md" | tail -n 1)"
  head="$(git -C "${REPOSITORY_ROOT}" rev-parse HEAD)"
  marker_base="$(sed -n 's/^BASE_COMMIT=//p' "${SESSION_CACHE}/session")"
  [ "${marker_base}" = "${reported}" ]
  [ "${marker_base}" != "${head}" ]
  grep -Fxq 'ACTIVE_BUNDLE=showdown-multi-s5-i6-38ee90625b30' \
    "${SESSION_CACHE}/session"
}

@test "human-review ignores commit-like hashes outside the report Commits section" {
  local report="${TEST_TEMP}/report.md"
  local intended='6c572bcadbb78c920fea404353b1a1f5fbfc91ef'
  local unrelated='a02979a5402aa5557846963860c0f034462ec4bb'
  printf '%s\n' '# Report' "Unrelated reachable hash: ${unrelated}" \
    '## Commits' >"${report}"
  printf '`%s`\n' "${intended}" >>"${report}"
  printf '%s\n' '## Notes' "Later unrelated reachable hash: ${unrelated}" >>"${report}"

  run /bin/bash -c \
    'source "$1"; human_review_reported_commits "$2"' \
    bash "${REPOSITORY_ROOT}/deploy/scripts/human-review.sh" "${report}"
  [ "${status}" -eq 0 ]
  [ "${output}" = "${intended}" ]
}

@test "human-review rejects fixed occupied port missing pin and missing host tool before mutation" {
  run human_review env MOCK_PORT_OCCUPIED=true BAGREDEX_HUMAN_REVIEW_PORT=38117 \
    "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"port is already occupied"* ]]
  [[ "${output}" == *"8000"* ]]
  [ ! -e "${SESSION_CACHE}/session" ]

  run human_review env BAGREDEX_HUMAN_REVIEW_DATA_ENV="${TEST_TEMP}/missing-pin" \
    "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 2 ]
  [[ "${output}" == *"data pin is unavailable"* ]]
  [ ! -e "${SESSION_CACHE}/session" ]

  local minimal_bin="${TEST_TEMP}/minimal-bin"
  mkdir "${minimal_bin}"
  local tool
  for tool in bash dirname flock mkdir chmod; do
    ln -s "$(command -v "${tool}")" "${minimal_bin}/${tool}"
  done
  run env PATH="${minimal_bin}" BAGREDEX_HUMAN_REVIEW_CACHE="${SESSION_CACHE}" \
    /bin/bash "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 2 ]
  [[ "${output}" == *"Required host tool is unavailable: podman"* ]]
}

@test "legacy session status is read-only and reload migrates old defaults" {
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 0 ]
  sed -i 's/^PORT=8000$/PORT=8001/; s/^PASSWORD=admin$/PASSWORD=bagredex-local/' \
    "${SESSION_CACHE}/session"
  : >"${COMMAND_LOG}"

  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review status
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"STATE: partial-ready"* ]]
  [[ "${output}" == *"URL: http://127.0.0.1:8001/"* ]]
  grep -Fxq 'PORT=8001' "${SESSION_CACHE}/session"
  grep -Fxq 'PASSWORD=bagredex-local' "${SESSION_CACHE}/session"
  ! grep -Eq ' build | up | down |rm -f|volume rm|volume prune' "${COMMAND_LOG}"

  : >"${COMMAND_LOG}"
  run human_review env MOCK_PORT_OCCUPIED=true \
    "${REPOSITORY_ROOT}/bagredex.sh" human-review reload
  [ "${status}" -eq 1 ]
  grep -Fxq 'STATE=ready' "${SESSION_CACHE}/session"
  grep -Fxq 'PORT=8001' "${SESSION_CACHE}/session"
  grep -Fxq 'PASSWORD=bagredex-local' "${SESSION_CACHE}/session"
  [ -f "${MOCK_STATE}/server" ]
  ! grep -Fq 'rm -f bagredex-human-review_server_1' "${COMMAND_LOG}"

  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review reload
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"URL: http://127.0.0.1:8000/"* ]]
  [[ "${output}" == *"PASSWORD: admin"* ]]
  grep -Fxq 'STATE=ready' "${SESSION_CACHE}/session"
  grep -Fxq 'PORT=8000' "${SESSION_CACHE}/session"
  grep -Fxq 'PASSWORD=admin' "${SESSION_CACHE}/session"
  [ -f "${MOCK_STATE}/volume" ]
}

@test "legacy reload preserves custom credentials and interrupted migration is resumable" {
  run human_review env BAGREDEX_REVIEW_USERNAME=custom \
    BAGREDEX_REVIEW_PASSWORD=custom-password \
    "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 0 ]
  sed -i 's/^PORT=8000$/PORT=8001/' "${SESSION_CACHE}/session"

  run human_review env MOCK_PODMAN_FAIL_MATCH='migrate --noinput' \
    "${REPOSITORY_ROOT}/bagredex.sh" human-review reload
  [ "${status}" -eq 9 ]
  grep -Fxq 'STATE=reloading' "${SESSION_CACHE}/session"
  grep -Fxq 'PORT=8000' "${SESSION_CACHE}/session"
  grep -Fxq 'USERNAME=custom' "${SESSION_CACHE}/session"
  grep -Fxq 'PASSWORD=custom-password' "${SESSION_CACHE}/session"
  [ -f "${MOCK_STATE}/volume" ]

  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review reload
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"STATE: ready"* ]]
  [[ "${output}" == *"URL: http://127.0.0.1:8000/"* ]]
  [[ "${output}" == *"USERNAME: custom"* ]]
  [[ "${output}" == *"PASSWORD: custom-password"* ]]
}

@test "human-review status fails closed for missing established resources and foreign labels" {
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 0 ]

  rm -f "${MOCK_STATE}/volume"
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review status
  [ "${status}" -eq 6 ]
  [[ "${output}" == *"disagrees with its required database resources"* ]]
  touch "${MOCK_STATE}/volume"

  run human_review env MOCK_VOLUME_LABEL=false \
    "${REPOSITORY_ROOT}/bagredex.sh" human-review status
  [ "${status}" -eq 6 ]
  [[ "${output}" == *"volume label does not match"* ]]

  run human_review env MOCK_NETWORK_LABEL=foreign \
    "${REPOSITORY_ROOT}/bagredex.sh" human-review status
  [ "${status}" -eq 6 ]
  [[ "${output}" == *"network label does not match"* ]]

  touch "${MOCK_STATE}/unexpected-container"
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review status
  [ "${status}" -eq 6 ]
  [[ "${output}" == *"Unexpected container"* ]]
}

@test "human-review status distinguishes stopped unhealthy and interrupted states" {
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 0 ]
  rm -f "${MOCK_STATE}/server"
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review status
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"STATE: stopped"* ]]

  touch "${MOCK_STATE}/server"
  run human_review env MOCK_SERVER_HEALTH='running|unhealthy' \
    "${REPOSITORY_ROOT}/bagredex.sh" human-review status
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"STATE: partial-ready"* ]]

  run human_review env MOCK_PODMAN_FAIL_MATCH='migrate --noinput' \
    "${REPOSITORY_ROOT}/bagredex.sh" human-review reload
  [ "${status}" -eq 9 ]
  grep -Fxq 'STATE=reloading' "${SESSION_CACHE}/session"
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review status
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"STATE: partial-reloading"* ]]
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review reload
  [ "${status}" -eq 0 ]
}

@test "zero resources are accepted for interrupted pre-mutation start and finishing recovery" {
  run human_review env MOCK_PODMAN_FAIL_MATCH='build server' \
    "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 9 ]
  [ ! -e "${MOCK_STATE}/volume" ]
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review status
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"STATE: partial-starting"* ]]

  sed -i 's/^STATE=starting$/STATE=finishing/' "${SESSION_CACHE}/session"
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review status
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"STATE: partial-finishing"* ]]
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review finish
  [ "${status}" -eq 0 ]
}

@test "starting reconciliation accepts validated expected resource subsets for reload repair" {
  run human_review env MOCK_PODMAN_FAIL_MATCH='build server' \
    "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 9 ]

  touch "${MOCK_STATE}/volume" "${MOCK_STATE}/network"
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review status
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"STATE: partial-starting"* ]]
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review reload
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"STATE: ready"* ]]
}

@test "human-review status declares curl as a required host tool" {
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 0 ]

  rm -f "${MOCK_BIN}/curl"
  local minimal_bin="${TEST_TEMP}/status-bin"
  mkdir "${minimal_bin}"
  local tool
  for tool in bash dirname flock mkdir chmod podman stat sed; do
    ln -s "$(command -v "${tool}" 2>/dev/null || printf '%s' "${MOCK_BIN}/${tool}")" \
      "${minimal_bin}/${tool}"
  done
  run env PATH="${minimal_bin}" BAGREDEX_HUMAN_REVIEW_CACHE="${SESSION_CACHE}" \
    COMMAND_LOG="${COMMAND_LOG}" MOCK_STATE="${MOCK_STATE}" \
    /bin/bash "${REPOSITORY_ROOT}/bagredex.sh" human-review status
  [ "${status}" -eq 2 ]
  [[ "${output}" == *"Required host tool is unavailable: curl"* ]]
}

@test "readiness failure withholds credentials and interrupted reload preserves review data" {
  run human_review env MOCK_CURL_READY=false \
    "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 1 ]
  [[ "${output}" != *"USERNAME:"* ]]
  [[ "${output}" != *"PASSWORD:"* ]]
  grep -Fxq 'STATE=starting' "${SESSION_CACHE}/session"

  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review reload
  [ "${status}" -eq 0 ]
  printf '%s\n' preserved >"${MOCK_STATE}/review-data"
  run human_review env MOCK_PODMAN_FAIL_MATCH='migrate --noinput' \
    "${REPOSITORY_ROOT}/bagredex.sh" human-review reload
  [ "${status}" -eq 9 ]
  [ "$(cat "${MOCK_STATE}/review-data")" = preserved ]
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review reload
  [ "${status}" -eq 0 ]
  [ "$(cat "${MOCK_STATE}/review-data")" = preserved ]
}

@test "marker field injection and missing all established resources fail closed" {
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 0 ]
  printf '%s\n' 'INJECTED_FIELD=unsafe' >>"${SESSION_CACHE}/session"
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review status
  [ "${status}" -eq 5 ]
  [[ "${output}" == *"unknown field"* ]]

  sed -i '/^INJECTED_FIELD=/d' "${SESSION_CACHE}/session"
  rm -f "${MOCK_STATE}/database" "${MOCK_STATE}/server" \
    "${MOCK_STATE}/volume" "${MOCK_STATE}/network"
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review status
  [ "${status}" -eq 6 ]
  [[ "${output}" == *"disagrees with its required database resources"* ]]
}

@test "human-review skill routes finishing to finish and resumable states to reload" {
  run grep -F 'If status reports `partial-finishing`, ask the deployment agent to run' \
    "${REPOSITORY_ROOT}/.agents/skills/human-review/SKILL.md"
  [ "${status}" -eq 0 ]
  run grep -F '`./bagredex.sh human-review finish` to resume the exact teardown. For `partial-starting`,' \
    "${REPOSITORY_ROOT}/.agents/skills/human-review/SKILL.md"
  [ "${status}" -eq 0 ]
  run grep -F '`partial-reloading`, `partial-ready`, or `stopped`, ask it to run' \
    "${REPOSITORY_ROOT}/.agents/skills/human-review/SKILL.md"
  [ "${status}" -eq 0 ]
  run grep -F 'exactly as shown without injecting a port override' \
    "${REPOSITORY_ROOT}/.agents/skills/human-review/SKILL.md"
  [ "${status}" -eq 0 ]
  run grep -F 'BAGREDEX_HUMAN_REVIEW_PORT=' \
    "${REPOSITORY_ROOT}/.agents/skills/human-review/SKILL.md"
  [ "${status}" -eq 1 ]
}
