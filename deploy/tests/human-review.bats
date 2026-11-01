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

create_candidate_repository() {
  local repository="${TEST_TEMP}/candidate-repository"
  mkdir -p "${repository}/deploy/scripts" "${repository}/docs/plans" \
    "${repository}/docs/reports"
  cp "${REPOSITORY_ROOT}/bagredex.sh" "${repository}/bagredex.sh"
  cp "${REPOSITORY_ROOT}/deploy/scripts/human-review.sh" \
    "${repository}/deploy/scripts/human-review.sh"
  printf '# Candidate plan\n' >"${repository}/docs/plans/2026-01-01-candidate.md"
  printf '# Candidate report\n\n## Commits\n\nPending.\n' \
    >"${repository}/docs/reports/2026-01-01-candidate.md"
  git -C "${repository}" init -q
  git -C "${repository}" config user.name 'Bagredex Test'
  git -C "${repository}" config user.email 'test@bagredex.local'
  git -C "${repository}" add .
  git -C "${repository}" commit -qm 'feat: candidate boundary'
  CANDIDATE_COMMIT="$(git -C "${repository}" rev-parse HEAD)"
  printf '# Candidate report\n\n## Commits\n\n`%s`\n' "${CANDIDATE_COMMIT}" \
    >"${repository}/docs/reports/2026-01-01-candidate.md"
  git -C "${repository}" add docs/reports/2026-01-01-candidate.md
  git -C "${repository}" commit -qm 'docs: record candidate commit'
  CANDIDATE_REPOSITORY="${repository}"
  export CANDIDATE_COMMIT CANDIDATE_REPOSITORY
}

candidate_review() {
  env BAGREDEX_HUMAN_REVIEW_CACHE="${TEST_TEMP}/candidate-cache" \
    "${CANDIDATE_REPOSITORY}/bagredex.sh" human-review "$@"
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

@test "candidate is read-only and reports available then reviewed without older fallback" {
  create_candidate_repository
  run candidate_review candidate
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"TARGET: candidate"* ]]
  [[ "${output}" == *"STATE: available"* ]]
  [[ "${output}" == *"EXPLICIT_TARGET_REQUIRED: false"* ]]

  local receipt="${CANDIDATE_REPOSITORY}/docs/reports/2026-01-01-candidate-human-review-completion.md"
  printf '%s\n' '# Completion' '' '## Completion records' '' '```text' \
    "v1|2026-01-02T00:00:00Z|candidate|docs/plans/2026-01-01-candidate.md|docs/reports/2026-01-01-candidate.md|${CANDIDATE_COMMIT}|unchanged|${CANDIDATE_COMMIT}|-" \
    '```' >"${receipt}"
  git -C "${CANDIDATE_REPOSITORY}" add "${receipt}"
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'docs: record review completion'

  run candidate_review candidate
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"STATE: reviewed"* ]]
  [[ "${output}" == *"EXPLICIT_TARGET_REQUIRED: true"* ]]
  [[ "${output}" == *"RESULT_COMMIT: ${CANDIDATE_COMMIT}"* ]]
}

@test "candidate fails closed instead of falling back past a newer pending boundary" {
  create_candidate_repository
  printf '# Human review completion tracking\n' \
    >"${CANDIDATE_REPOSITORY}/docs/plans/2026-10-24-human-review-completion-tracking.md"
  printf '# Human review completion tracking\n\n## Commits\n\nPending.\n' \
    >"${CANDIDATE_REPOSITORY}/docs/reports/2026-10-24-human-review-completion-tracking.md"
  git -C "${CANDIDATE_REPOSITORY}" add docs
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'docs: add pending completion tracking artifacts'

  run candidate_review candidate
  [ "${status}" -eq 2 ]
  [[ "${output}" == *"still has pending commit evidence"* ]]
  [[ "${output}" == *"human-review-completion-tracking"* ]]
}

@test "candidate skips an older pending boundary behind a finalized feature" {
  create_candidate_repository
  printf '# Historical pending plan\n' \
    >"${CANDIDATE_REPOSITORY}/docs/plans/2026-02-01-historical-pending.md"
  printf '# Historical pending report\n\n## Commits\n\nPending.\n' \
    >"${CANDIDATE_REPOSITORY}/docs/reports/2026-02-01-historical-pending.md"
  git -C "${CANDIDATE_REPOSITORY}" add docs
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'feat: add historical pending boundary'

  printf '# Finalized plan\n' \
    >"${CANDIDATE_REPOSITORY}/docs/plans/2026-03-01-finalized.md"
  printf '# Finalized report\n\n## Commits\n\nPending.\n' \
    >"${CANDIDATE_REPOSITORY}/docs/reports/2026-03-01-finalized.md"
  git -C "${CANDIDATE_REPOSITORY}" add docs
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'feat: add finalized boundary'
  local finalized_commit
  finalized_commit="$(git -C "${CANDIDATE_REPOSITORY}" rev-parse HEAD)"
  printf '# Finalized report\n\n## Commits\n\n`%s`\n' "${finalized_commit}" \
    >"${CANDIDATE_REPOSITORY}/docs/reports/2026-03-01-finalized.md"
  git -C "${CANDIDATE_REPOSITORY}" add docs/reports/2026-03-01-finalized.md
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'docs: finalize newer boundary'

  run candidate_review candidate
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"TARGET: finalized"* ]]
  [[ "${output}" == *"STATE: available"* ]]
  [[ "${output}" == *"FEATURE_COMMIT: ${finalized_commit}"* ]]
}

@test "candidate fails closed for a committed report without a hash or pending marker" {
  create_candidate_repository
  printf '# Candidate report\n\n## Commits\n\nUnknown boundary.\n' \
    >"${CANDIDATE_REPOSITORY}/docs/reports/2026-01-01-candidate.md"
  git -C "${CANDIDATE_REPOSITORY}" add docs/reports/2026-01-01-candidate.md
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'docs: corrupt candidate boundary'

  run candidate_review candidate
  [ "${status}" -eq 2 ]
  [[ "${output}" == *"malformed completion evidence"* ]]
}

@test "candidate uses commit topology instead of artifact filename or mtime" {
  create_candidate_repository
  printf '# Earlier-named plan\n' \
    >"${CANDIDATE_REPOSITORY}/docs/plans/2025-01-01-earlier-named.md"
  printf '# Earlier-named report\n\n## Commits\n\nPending.\n' \
    >"${CANDIDATE_REPOSITORY}/docs/reports/2025-01-01-earlier-named.md"
  git -C "${CANDIDATE_REPOSITORY}" add docs
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'feat: later history boundary'
  local later_commit
  later_commit="$(git -C "${CANDIDATE_REPOSITORY}" rev-parse HEAD)"
  printf '# Earlier-named report\n\n## Commits\n\n`%s`\n' "${later_commit}" \
    >"${CANDIDATE_REPOSITORY}/docs/reports/2025-01-01-earlier-named.md"
  git -C "${CANDIDATE_REPOSITORY}" add docs/reports/2025-01-01-earlier-named.md
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'docs: record later history boundary'
  touch "${CANDIDATE_REPOSITORY}/docs/plans/2026-01-01-candidate.md" \
    "${CANDIDATE_REPOSITORY}/docs/reports/2026-01-01-candidate.md"

  run candidate_review candidate
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"TARGET: earlier-named"* ]]
  [[ "${output}" == *"FEATURE_COMMIT: ${later_commit}"* ]]
}

@test "candidate reports a reviewed newest boundary without falling back to older available" {
  create_candidate_repository
  printf '# Newest plan\n' >"${CANDIDATE_REPOSITORY}/docs/plans/2026-02-01-newest.md"
  printf '# Newest report\n\n## Commits\n\nPending.\n' \
    >"${CANDIDATE_REPOSITORY}/docs/reports/2026-02-01-newest.md"
  git -C "${CANDIDATE_REPOSITORY}" add docs
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'feat: newest boundary'
  local newest_commit
  newest_commit="$(git -C "${CANDIDATE_REPOSITORY}" rev-parse HEAD)"
  printf '# Newest report\n\n## Commits\n\n`%s`\n' "${newest_commit}" \
    >"${CANDIDATE_REPOSITORY}/docs/reports/2026-02-01-newest.md"
  git -C "${CANDIDATE_REPOSITORY}" add docs/reports/2026-02-01-newest.md
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'docs: record newest boundary'
  local receipt="${CANDIDATE_REPOSITORY}/docs/reports/2026-02-01-newest-human-review-completion.md"
  printf '%s\n' '# Completion' '```text' \
    "v1|2026-02-02T00:00:00Z|newest|docs/plans/2026-02-01-newest.md|docs/reports/2026-02-01-newest.md|${newest_commit}|unchanged|${newest_commit}|-" \
    '```' >"${receipt}"
  git -C "${CANDIDATE_REPOSITORY}" add "${receipt}"
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'docs: record newest completion'

  run candidate_review candidate
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"TARGET: newest"* ]]
  [[ "${output}" == *"STATE: reviewed"* ]]
  [[ "${output}" == *"EXPLICIT_TARGET_REQUIRED: true"* ]]
}

@test "candidate rejects dirty and malformed completion evidence without Podman" {
  create_candidate_repository
  local receipt="${CANDIDATE_REPOSITORY}/docs/reports/2026-01-01-candidate-human-review-completion.md"
  printf '%s\n' '# Completion' '```text' 'v1|malformed' '```' >"${receipt}"
  git -C "${CANDIDATE_REPOSITORY}" add "${receipt}"
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'docs: add malformed receipt'

  run candidate_review candidate
  [ "${status}" -eq 10 ]
  [[ "${output}" == *"Malformed human-review completion record"* ]]

  printf '\nDirty.\n' >>"${receipt}"
  run candidate_review candidate
  [ "${status}" -eq 10 ]
  [[ "${output}" == *"must be tracked and unchanged"* ]]
}

@test "candidate accepts changed completion only with corrected supplemental evidence" {
  create_candidate_repository
  local supplemental="docs/reports/2026-01-03-candidate-human-review.md"
  printf '# Supplemental report\n\n## Commits\n\nPending.\n' \
    >"${CANDIDATE_REPOSITORY}/${supplemental}"
  printf 'reviewed change\n' >"${CANDIDATE_REPOSITORY}/reviewed-change.txt"
  git -C "${CANDIDATE_REPOSITORY}" add "${supplemental}" reviewed-change.txt
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'fix: apply review feedback'
  local result_commit
  result_commit="$(git -C "${CANDIDATE_REPOSITORY}" rev-parse HEAD)"
  printf '# Supplemental report\n\n## Commits\n\n`%s`\n' "${result_commit}" \
    >"${CANDIDATE_REPOSITORY}/${supplemental}"
  git -C "${CANDIDATE_REPOSITORY}" add "${supplemental}"
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'docs: correct supplemental boundary'

  local receipt="${CANDIDATE_REPOSITORY}/docs/reports/2026-01-01-candidate-human-review-completion.md"
  printf '%s\n' '# Completion' '```text' \
    "v1|2026-01-04T00:00:00Z|candidate|docs/plans/2026-01-01-candidate.md|docs/reports/2026-01-01-candidate.md|${CANDIDATE_COMMIT}|changed|${result_commit}|${supplemental}" \
    '```' >"${receipt}"
  git -C "${CANDIDATE_REPOSITORY}" add "${receipt}"
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'docs: record changed review completion'

  run candidate_review candidate
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"STATE: reviewed"* ]]
  [[ "${output}" == *"RESULT_COMMIT: ${result_commit}"* ]]

  printf '# Supplemental report\n\n## Commits\n\nPending.\n' \
    >"${CANDIDATE_REPOSITORY}/${supplemental}"
  git -C "${CANDIDATE_REPOSITORY}" add "${supplemental}"
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'docs: invalidate supplemental boundary'
  run candidate_review candidate
  [ "${status}" -eq 10 ]
  [[ "${output}" == *"does not record the exact result commit"* ]]
}

@test "candidate rejects two targets at the same newest commit boundary" {
  create_candidate_repository
  printf '# Second plan\n' >"${CANDIDATE_REPOSITORY}/docs/plans/2026-01-02-second.md"
  printf '# Second report\n\n## Commits\n\nPending.\n' \
    >"${CANDIDATE_REPOSITORY}/docs/reports/2026-01-02-second.md"
  git -C "${CANDIDATE_REPOSITORY}" add docs
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'feat: shared candidate boundary'
  local shared_commit
  shared_commit="$(git -C "${CANDIDATE_REPOSITORY}" rev-parse HEAD)"
  printf '# Candidate report\n\n## Commits\n\n`%s`\n' "${shared_commit}" \
    >"${CANDIDATE_REPOSITORY}/docs/reports/2026-01-01-candidate.md"
  printf '# Second report\n\n## Commits\n\n`%s`\n' "${shared_commit}" \
    >"${CANDIDATE_REPOSITORY}/docs/reports/2026-01-02-second.md"
  git -C "${CANDIDATE_REPOSITORY}" add docs/reports
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'docs: record shared boundary'

  run candidate_review candidate
  [ "${status}" -eq 2 ]
  [[ "${output}" == *"boundary is ambiguous"* ]]
}

@test "complete requires a record not older than the session and removes only the marker" {
  create_candidate_repository
  local receipt="${CANDIDATE_REPOSITORY}/docs/reports/2026-01-01-candidate-human-review-completion.md"
  printf '%s\n' '# Completion' '' '## Completion records' '' '```text' \
    "v1|2026-01-02T00:00:00Z|candidate|docs/plans/2026-01-01-candidate.md|docs/reports/2026-01-01-candidate.md|${CANDIDATE_COMMIT}|unchanged|${CANDIDATE_COMMIT}|-" \
    '```' >"${receipt}"
  git -C "${CANDIDATE_REPOSITORY}" add "${receipt}"
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'docs: record old completion'
  local cache="${TEST_TEMP}/candidate-cache"
  mkdir -p "${cache}"
  printf '%s\n' 'FORMAT_VERSION=1' 'TARGET=candidate' 'STATE=recording' \
    'PLAN=docs/plans/2026-01-01-candidate.md' \
    'REPORT=docs/reports/2026-01-01-candidate.md' \
    "BASE_COMMIT=${CANDIDATE_COMMIT}" 'ACTIVE_BUNDLE=test-bundle' 'PORT=8000' \
    'USERNAME=admin' 'PASSWORD=admin' 'CREATED_AT=2026-01-03T00:00:00Z' \
    >"${cache}/session"
  chmod 600 "${cache}/session"

  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" \
    MOCK_STATE="${MOCK_STATE}" BAGREDEX_HUMAN_REVIEW_CACHE="${cache}" \
    "${CANDIDATE_REPOSITORY}/bagredex.sh" human-review complete
  [ "${status}" -eq 10 ]
  [ -f "${cache}/session" ]

  sed -i '$i\v1|2026-01-04T00:00:00Z|candidate|docs/plans/2026-01-01-candidate.md|docs/reports/2026-01-01-candidate.md|'"${CANDIDATE_COMMIT}"'|unchanged|'"${CANDIDATE_COMMIT}"'|-' "${receipt}"
  git -C "${CANDIDATE_REPOSITORY}" add "${receipt}"
  git -C "${CANDIDATE_REPOSITORY}" commit -qm 'docs: record repeat completion'
  run env PATH="${MOCK_BIN}:${PATH}" COMMAND_LOG="${COMMAND_LOG}" \
    MOCK_STATE="${MOCK_STATE}" BAGREDEX_HUMAN_REVIEW_CACHE="${cache}" \
    "${CANDIDATE_REPOSITORY}/bagredex.sh" human-review complete
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"STATE: complete"* ]]
  [[ "${output}" == *"OUTCOME: unchanged"* ]]
  [ ! -e "${cache}/session" ]
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
  grep -Fq 'load_pokemon_data /app/src/data/releases/showdown-multi-s5-i7-49850c617dd2' \
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
  [[ "${output}" == *"STATE: completion-pending"* ]]
  grep -Fxq 'STATE=recording' "${SESSION_CACHE}/session"
  [[ "${output}" != *"USERNAME:"* ]]
  [[ "${output}" != *"PASSWORD:"* ]]
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
  grep -Fxq 'STATE=recording' "${SESSION_CACHE}/session"
}

@test "completion-pending finish and status are idempotent and reload start complete fail closed" {
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 0 ]
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review finish
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"STATE: completion-pending"* ]]
  [[ "${output}" == *"FEATURE_COMMIT:"* ]]
  [[ "${output}" != *"USERNAME:"* ]]
  : >"${COMMAND_LOG}"

  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review finish
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"STATE: completion-pending"* ]]
  [ ! -s "${COMMAND_LOG}" ]
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review status
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"STATE: completion-pending"* ]]
  [ ! -s "${COMMAND_LOG}" ]

  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review reload
  [ "${status}" -eq 7 ]
  [[ "${output}" == *"completion recording is pending"* ]]
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review start basic-team-builder
  [ "${status}" -eq 3 ]
  run human_review "${REPOSITORY_ROOT}/bagredex.sh" human-review complete
  [ "${status}" -eq 10 ]
  grep -Fxq 'STATE=recording' "${SESSION_CACHE}/session"
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
  grep -Fxq 'ACTIVE_BUNDLE=showdown-multi-s5-i7-49850c617dd2' \
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
  grep -Fxq 'STATE=recording' "${SESSION_CACHE}/session"
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
  run grep -F 'Route `partial-finishing` to `./bagredex.sh human-review finish`.' \
    "${REPOSITORY_ROOT}/.agents/skills/human-review/SKILL.md"
  [ "${status}" -eq 0 ]
  run grep -F 'For bare `$human-review`, ask the deployment agent to run' \
    "${REPOSITORY_ROOT}/.agents/skills/human-review/SKILL.md"
  [ "${status}" -eq 0 ]
  run grep -F '`./bagredex.sh human-review candidate`.' \
    "${REPOSITORY_ROOT}/.agents/skills/human-review/SKILL.md"
  [ "${status}" -eq 0 ]
  run grep -F 'Route `completion-pending` to completion recording below;' \
    "${REPOSITORY_ROOT}/.agents/skills/human-review/SKILL.md"
  [ "${status}" -eq 0 ]
  run grep -F 'exactly as shown without injecting a port override' \
    "${REPOSITORY_ROOT}/.agents/skills/human-review/SKILL.md"
  [ "${status}" -eq 0 ]
  run grep -F 'BAGREDEX_HUMAN_REVIEW_PORT=' \
    "${REPOSITORY_ROOT}/.agents/skills/human-review/SKILL.md"
  [ "${status}" -eq 1 ]
}
