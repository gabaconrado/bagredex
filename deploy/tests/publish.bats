#!/usr/bin/env bats

setup() {
  export SOURCE_ROOT="${BATS_TEST_DIRNAME}/../.."
  export TEST_TEMP="$(mktemp -d "${BATS_TEST_TMPDIR}/bagredex-publish.XXXXXX")"
  export TEST_REPOSITORY="${TEST_TEMP}/repository"
  export MOCK_BIN="${TEST_TEMP}/bin"
  export COMMAND_LOG="${TEST_TEMP}/commands.log"
  mkdir -p "${TEST_REPOSITORY}/deploy/scripts" "${TEST_REPOSITORY}/deploy" "${MOCK_BIN}"
  cp "${SOURCE_ROOT}/deploy/scripts/publish.sh" "${TEST_REPOSITORY}/deploy/scripts/publish.sh"
  : >"${TEST_REPOSITORY}/deploy/Containerfile"
  printf '%s\n' '#!/usr/bin/env bash' 'printf "check %s\\n" "$*" >>"${COMMAND_LOG}"' \
    >"${TEST_REPOSITORY}/bagredex.sh"
  chmod +x "${TEST_REPOSITORY}/bagredex.sh" "${TEST_REPOSITORY}/deploy/scripts/publish.sh"
  git -C "${TEST_REPOSITORY}" init -q -b main
  git -C "${TEST_REPOSITORY}" config user.name test
  git -C "${TEST_REPOSITORY}" config user.email test@example.invalid
  git -C "${TEST_REPOSITORY}" add .
  git -C "${TEST_REPOSITORY}" commit -qm initial
  printf '%s\n' '#!/usr/bin/env bash' 'printf "git %s\\n" "$*" >>"${COMMAND_LOG}"' \
    'exec /usr/bin/git "$@"' >"${MOCK_BIN}/git"
  printf '%s\n' '#!/usr/bin/env bash' 'printf "podman %s\\n" "$*" >>"${COMMAND_LOG}"' \
    >"${MOCK_BIN}/podman"
  chmod +x "${MOCK_BIN}/git" "${MOCK_BIN}/podman"
  export PATH="${MOCK_BIN}:${PATH}"
}

teardown() {
  rm -rf -- "${TEST_TEMP}"
}

@test "publish validates, tags, builds both targets, then pushes in order" {
  run "${TEST_REPOSITORY}/deploy/scripts/publish.sh" 1.2.3
  [ "${status}" -eq 0 ]
  login_line="$(grep -n '^podman login docker.io$' "${COMMAND_LOG}" | cut -d: -f1)"
  check_line="$(grep -n '^check check$' "${COMMAND_LOG}" | cut -d: -f1)"
  tag_line="$(grep -n '^git .*tag --annotate v1.2.3' "${COMMAND_LOG}" | cut -d: -f1)"
  app_build_line="$(grep -n 'podman build .*--target application.*bagredex:1.2.3' \
    "${COMMAND_LOG}" | cut -d: -f1)"
  nginx_build_line="$(grep -n 'podman build .*--target nginx.*bagredex-nginx:1.2.3' \
    "${COMMAND_LOG}" | cut -d: -f1)"
  app_push_line="$(grep -n '^podman push docker.io/gabaconrado/bagredex:1.2.3$' \
    "${COMMAND_LOG}" | cut -d: -f1)"
  nginx_push_line="$(grep -n '^podman push docker.io/gabaconrado/bagredex-nginx:1.2.3$' \
    "${COMMAND_LOG}" | cut -d: -f1)"
  [ "${login_line}" -lt "${check_line}" ]
  [ "${check_line}" -lt "${tag_line}" ]
  [ "${tag_line}" -lt "${app_build_line}" ]
  [ "${app_build_line}" -lt "${nginx_build_line}" ]
  [ "${nginx_build_line}" -lt "${app_push_line}" ]
  [ "${app_push_line}" -lt "${nginx_push_line}" ]
  ! grep -Eq '(:latest|git .*push)' "${COMMAND_LOG}"
}

@test "publish accepts an existing annotated version only at HEAD" {
  /usr/bin/git -C "${TEST_REPOSITORY}" tag -a v1.2.3 -m release
  run "${TEST_REPOSITORY}/deploy/scripts/publish.sh" 1.2.3
  [ "${status}" -eq 0 ]
  ! grep -q '^git .*tag --annotate' "${COMMAND_LOG}"

  printf 'next\n' >"${TEST_REPOSITORY}/tracked"
  /usr/bin/git -C "${TEST_REPOSITORY}" add tracked
  /usr/bin/git -C "${TEST_REPOSITORY}" commit -qm next
  : >"${COMMAND_LOG}"
  run "${TEST_REPOSITORY}/deploy/scripts/publish.sh" 1.2.3
  [ "${status}" -eq 2 ]
  ! grep -q '^podman build\|^podman push' "${COMMAND_LOG}"
}
