#!/usr/bin/env bats

setup() {
  export SOURCE_ROOT="${BATS_TEST_DIRNAME}/../.."
  export TEST_TEMP="$(mktemp -d "${BATS_TEST_TMPDIR}/bagredex-deploy.XXXXXX")"
  export TEST_REPOSITORY="${TEST_TEMP}/repository"
  export MOCK_BIN="${TEST_TEMP}/bin"
  export COMMAND_LOG="${TEST_TEMP}/commands.log"
  export METADATA_LOG="${TEST_TEMP}/metadata.log"
  mkdir -p "${TEST_REPOSITORY}/deploy/scripts" "${MOCK_BIN}"
  cp "${SOURCE_ROOT}/deploy/scripts/deploy.sh" "${TEST_REPOSITORY}/deploy/scripts/deploy.sh"
  cp "${SOURCE_ROOT}/deploy/scripts/preflight.sh" "${TEST_REPOSITORY}/deploy/scripts/preflight.sh"
  git -C "${TEST_REPOSITORY}" init -q -b main
  git -C "${TEST_REPOSITORY}" config user.name test
  git -C "${TEST_REPOSITORY}" config user.email test@example.invalid
  git -C "${TEST_REPOSITORY}" add .
  git -C "${TEST_REPOSITORY}" commit -qm initial
  git -C "${TEST_REPOSITORY}" tag -a v1.2.3 -m release
  printf '%s\n' '#!/usr/bin/env bash' 'printf "ssh %s\\n" "$*" >>"${COMMAND_LOG}"' \
    'if [[ "$*" == *"cat >"* ]]; then cat >"${METADATA_LOG}"; fi' >"${MOCK_BIN}/ssh"
  printf '%s\n' '#!/usr/bin/env bash' 'printf "rsync %s\\n" "$*" >>"${COMMAND_LOG}"' \
    >"${MOCK_BIN}/rsync"
  chmod +x "${MOCK_BIN}/ssh" "${MOCK_BIN}/rsync"
  export PATH="${MOCK_BIN}:${PATH}"
  export DEPLOY_SSH_TARGET=test-host DEPLOY_REMOTE_DIR=/srv/bagredex
}

teardown() {
  rm -rf -- "${TEST_TEMP}"
}

@test "dry run performs only the remote read-only preflight" {
  run "${TEST_REPOSITORY}/deploy/scripts/deploy.sh" 1.2.3 --dry-run
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"Dry run complete"* ]]
  grep -Fxq 'ssh test-host bash -s -- /srv/bagredex' "${COMMAND_LOG}"
  ! grep -q '^rsync\|mkdir\|remote-release\|cat >' "${COMMAND_LOG}"
}

@test "real deploy transfers only deployment assets and records metadata" {
  run "${TEST_REPOSITORY}/deploy/scripts/deploy.sh" 1.2.3
  [ "${status}" -eq 0 ]
  grep -Fxq 'BAGREDEX_IMAGE_VERSION=1.2.3' "${METADATA_LOG}"
  grep -Fxq 'BAGREDEX_GIT_BRANCH=main' "${METADATA_LOG}"
  [ "$(grep -c '^rsync ' "${COMMAND_LOG}")" -eq 1 ]
  grep -Fq "${TEST_REPOSITORY}/deploy/" "${COMMAND_LOG}"
  ! grep -Eq '/src/(backend|web)' "${COMMAND_LOG}"
  grep -Fq 'remote-release.sh' "${COMMAND_LOG}"
}

@test "defaults and target overrides are safe and independent" {
  unset DEPLOY_SSH_TARGET DEPLOY_REMOTE_DIR
  run "${TEST_REPOSITORY}/deploy/scripts/deploy.sh" 1.2.3 --dry-run
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"Target: bagredex:/home/bagredex/bagredex"* ]]

  DEPLOY_SSH_TARGET='bad target' run \
    "${TEST_REPOSITORY}/deploy/scripts/deploy.sh" 1.2.3 --dry-run
  [ "${status}" -eq 2 ]

  DEPLOY_REMOTE_DIR=/ run "${TEST_REPOSITORY}/deploy/scripts/deploy.sh" 1.2.3 --dry-run
  [ "${status}" -eq 2 ]
}
