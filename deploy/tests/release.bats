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
    'DJANGO_SECRET_KEY=test-only-secret' >"${REMOTE_DIR}/shared/.env"
  printf '%s\n' '#!/usr/bin/env bash' \
    'printf "version=%s command=%s\\n" "${BAGREDEX_IMAGE_VERSION:-unset}" "$*" >>"${COMMAND_LOG}"' \
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
  grep -Fq ' down' "${COMMAND_LOG}"
  [[ "${output}" == *"No previous release is available"* ]]
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
