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
