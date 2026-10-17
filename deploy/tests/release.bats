#!/usr/bin/env bats

setup() {
  export REPOSITORY_ROOT="${BATS_TEST_DIRNAME}/../.."
  export TEST_TEMP="$(mktemp -d "${BATS_TEST_TMPDIR}/bagredex-release.XXXXXX")"
  export REMOTE_DIR="${TEST_TEMP}/bagredex"
  export MOCK_BIN="${TEST_TEMP}/bin"
  export COMMAND_LOG="${TEST_TEMP}/commands.log"
  mkdir -p "${REMOTE_DIR}/releases" "${REMOTE_DIR}/shared" "${MOCK_BIN}"
  printf '%s\n' \
    'BAGREDEX_ENVIRONMENT=production' \
    'BAGREDEX_DOMAIN=bagredex.example.invalid' \
    'BAGREDEX_EXPECTED_IP=192.0.2.1' \
    'LETSENCRYPT_EMAIL=admin@example.invalid' \
    'DJANGO_SECRET_KEY=test-only-secret' \
    'BAGREDEX_DATABASE_NAME=bagredex' \
    'BAGREDEX_DATABASE_USER=bagredex' \
    'BAGREDEX_DATABASE_PASSWORD=test-only-password' \
    'BAGREDEX_DATABASE_HOST=database' \
    'BAGREDEX_DATABASE_PORT=5432' >"${REMOTE_DIR}/shared/.env"
  printf '%s\n' '#!/usr/bin/env bash' \
    'printf "version=%s command=%s\\n" "${BAGREDEX_IMAGE_VERSION:-unset}" "$*" >>"${COMMAND_LOG}"' \
    '[[ "${MOCK_FAIL_MIGRATE:-false}" == true && "$*" == *"manage.py migrate --noinput"* ]] && exit 9' \
    '[[ "${MOCK_FAIL_LOAD:-false}" == true && "$*" == *"manage.py load_pokemon_data"* ]] && exit 10' \
    '[[ "${MOCK_FAIL_ACTIVATE:-false}" == true && "$*" == *"manage.py activate_pokemon_data"* ]] && exit 11' \
    'exit 0' \
    >"${MOCK_BIN}/podman"
  printf '%s\n' '#!/usr/bin/env bash' \
    'if [[ "${CURL_STATUS:-1}" -eq 0 ]]; then printf '\''{"status": "ok"}'\''; fi' \
    'exit "${CURL_STATUS:-1}"' >"${MOCK_BIN}/curl"
  printf '%s\n' '#!/usr/bin/env bash' 'exit 0' >"${MOCK_BIN}/sleep"
  chmod +x "${MOCK_BIN}/podman" "${MOCK_BIN}/curl" "${MOCK_BIN}/sleep"
}

teardown() {
  rm -rf -- "${TEST_TEMP}"
}

make_release() {
  local release_id="$1" version="$2"
  local release_dir="${REMOTE_DIR}/releases/${release_id}"
  mkdir -p "${release_dir}/deploy"
  : >"${release_dir}/deploy/compose.yaml"
  : >"${release_dir}/deploy/compose.production.yaml"
  cp "${REPOSITORY_ROOT}/deploy/pokemon-data.env" "${release_dir}/deploy/pokemon-data.env"
  printf 'BAGREDEX_RELEASE_ID=%s\nBAGREDEX_IMAGE_VERSION=%s\n' \
    "${release_id}" "${version}" >"${release_dir}/release.env"
}

@test "failed first release is stopped and does not stay current" {
  make_release new-release 1.0.0
  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" \
    "${REPOSITORY_ROOT}/deploy/scripts/remote-release-worker.sh" "${REMOTE_DIR}" new-release
  [ "${status}" -ne 0 ]
  [ ! -e "${REMOTE_DIR}/current" ]
  grep -Fq 'command=compose' "${COMMAND_LOG}"
  grep -Fq ' stop nginx server' "${COMMAND_LOG}"
  [[ "${output}" == *"No previous release is available"* ]]
}

@test "migrations load and first activation precede the release switch" {
  make_release old-release 0.9.0
  make_release new-release 1.0.0
  ln -s "${REMOTE_DIR}/releases/old-release" "${REMOTE_DIR}/current"
  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" CURL_STATUS=0 \
    "${REPOSITORY_ROOT}/deploy/scripts/remote-release-worker.sh" "${REMOTE_DIR}" new-release
  [ "${status}" -eq 0 ]
  database_line="$(grep -n ' up -d database' "${COMMAND_LOG}" | head -n1 | cut -d: -f1)"
  health_line="$(grep -n 'exec -T database pg_isready' "${COMMAND_LOG}" | head -n1 | cut -d: -f1)"
  migration_line="$(grep -n 'manage.py migrate --noinput' "${COMMAND_LOG}" | head -n1 | cut -d: -f1)"
  load_line="$(grep -n 'manage.py load_pokemon_data' "${COMMAND_LOG}" | head -n1 | cut -d: -f1)"
  activation_line="$(grep -n 'manage.py activate_pokemon_data' "${COMMAND_LOG}" | head -n1 | cut -d: -f1)"
  stop_line="$(grep -n ' stop nginx server' "${COMMAND_LOG}" | head -n1 | cut -d: -f1)"
  [ "${database_line}" -lt "${health_line}" ]
  [ "${health_line}" -lt "${migration_line}" ]
  [ "${migration_line}" -lt "${load_line}" ]
  [ "${load_line}" -lt "${activation_line}" ]
  [ "${activation_line}" -lt "${stop_line}" ]
  grep -Fq 'activate_pokemon_data showdown-multi-s3-i4-5073b2ab1402 --if-none' \
    "${COMMAND_LOG}"
}

@test "migration failure leaves the current release serving" {
  make_release old-release 0.9.0
  make_release new-release 1.0.0
  ln -s "${REMOTE_DIR}/releases/old-release" "${REMOTE_DIR}/current"
  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" MOCK_FAIL_MIGRATE=true \
    "${REPOSITORY_ROOT}/deploy/scripts/remote-release-worker.sh" "${REMOTE_DIR}" new-release
  [ "${status}" -eq 9 ]
  [ "$(readlink -f "${REMOTE_DIR}/current")" = "${REMOTE_DIR}/releases/old-release" ]
  ! grep -Fq ' stop nginx server' "${COMMAND_LOG}"
  ! grep -Eq 'down[[:space:]]+(-v|--volumes)' "${COMMAND_LOG}"
}

@test "data load failure leaves the current release serving" {
  make_release old-release 0.9.0
  make_release new-release 1.0.0
  ln -s "${REMOTE_DIR}/releases/old-release" "${REMOTE_DIR}/current"
  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" MOCK_FAIL_LOAD=true \
    "${REPOSITORY_ROOT}/deploy/scripts/remote-release-worker.sh" "${REMOTE_DIR}" new-release
  [ "${status}" -eq 10 ]
  [ "$(readlink -f "${REMOTE_DIR}/current")" = "${REMOTE_DIR}/releases/old-release" ]
  ! grep -Fq 'manage.py activate_pokemon_data' "${COMMAND_LOG}"
  ! grep -Fq ' stop nginx server' "${COMMAND_LOG}"
}

@test "initial activation failure leaves the current release serving" {
  make_release old-release 0.9.0
  make_release new-release 1.0.0
  ln -s "${REMOTE_DIR}/releases/old-release" "${REMOTE_DIR}/current"
  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" MOCK_FAIL_ACTIVATE=true \
    "${REPOSITORY_ROOT}/deploy/scripts/remote-release-worker.sh" "${REMOTE_DIR}" new-release
  [ "${status}" -eq 11 ]
  [ "$(readlink -f "${REMOTE_DIR}/current")" = "${REMOTE_DIR}/releases/old-release" ]
  grep -Fq 'manage.py load_pokemon_data' "${COMMAND_LOG}"
  ! grep -Fq ' stop nginx server' "${COMMAND_LOG}"
}

@test "repeated deployment uses idempotent load and only if-none activation" {
  make_release old-release 0.9.0
  make_release new-release 1.0.0
  ln -s "${REMOTE_DIR}/releases/old-release" "${REMOTE_DIR}/current"
  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" CURL_STATUS=0 \
    "${REPOSITORY_ROOT}/deploy/scripts/remote-release-worker.sh" "${REMOTE_DIR}" new-release
  [ "${status}" -eq 0 ]
  [ "$(grep -Fc 'manage.py load_pokemon_data /app/src/data/releases/showdown-multi-s3-i4-5073b2ab1402' "${COMMAND_LOG}")" -eq 1 ]
  [ "$(grep -Fc 'manage.py activate_pokemon_data showdown-multi-s3-i4-5073b2ab1402 --if-none' "${COMMAND_LOG}")" -eq 1 ]
  ! grep -E 'activate_pokemon_data .*--if-none' "${COMMAND_LOG}" | grep -Eq -- '--force|--replace'
}

@test "failed release restores previous release and image version" {
  make_release old-release 0.9.0
  make_release new-release 1.0.0
  ln -s "${REMOTE_DIR}/releases/old-release" "${REMOTE_DIR}/current"
  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" \
    "${REPOSITORY_ROOT}/deploy/scripts/remote-release-worker.sh" "${REMOTE_DIR}" new-release
  [ "${status}" -ne 0 ]
  [ "$(readlink -f "${REMOTE_DIR}/current")" = "${REMOTE_DIR}/releases/old-release" ]
  grep -Fq "version=0.9.0 command=compose -p bagredex -f ${REMOTE_DIR}/releases/old-release/deploy/compose.yaml -f ${REMOTE_DIR}/releases/old-release/deploy/compose.production.yaml up -d server" \
    "${COMMAND_LOG}"
  [[ "${output}" == *"Previous release was restarted"* ]]
}

@test "successful release advances current previous and retains only both" {
  make_release old-release 0.9.0
  make_release stale-release 0.8.0
  make_release new-release 1.0.0
  ln -s "${REMOTE_DIR}/releases/old-release" "${REMOTE_DIR}/current"
  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" CURL_STATUS=0 \
    "${REPOSITORY_ROOT}/deploy/scripts/remote-release-worker.sh" "${REMOTE_DIR}" new-release
  [ "${status}" -eq 0 ]
  [ "$(readlink -f "${REMOTE_DIR}/current")" = "${REMOTE_DIR}/releases/new-release" ]
  [ "$(readlink -f "${REMOTE_DIR}/previous")" = "${REMOTE_DIR}/releases/old-release" ]
  [ -d "${REMOTE_DIR}/releases/new-release" ]
  [ -d "${REMOTE_DIR}/releases/old-release" ]
  [ ! -e "${REMOTE_DIR}/releases/stale-release" ]
  ! grep -Fq 'image prune' "${COMMAND_LOG}"
}

@test "release wrapper reports a nonblocking deployment lock conflict" {
  printf '%s\n' '#!/usr/bin/env bash' 'exit 73' >"${MOCK_BIN}/flock"
  chmod +x "${MOCK_BIN}/flock"
  run env PATH="${MOCK_BIN}:${PATH}" \
    "${REPOSITORY_ROOT}/deploy/scripts/remote-release.sh" "${REMOTE_DIR}" new-release
  [ "${status}" -eq 3 ]
  [[ "${output}" == *"Another deployment is already running"* ]]
}

@test "release wrapper rejects unsafe paths" {
  run "${REPOSITORY_ROOT}/deploy/scripts/remote-release.sh" / unsafe/identifier
  [ "${status}" -eq 2 ]
}
