#!/usr/bin/env bash

# This file is sourced by bagredex.sh so it can reuse the ordinary review helpers.
# shellcheck disable=SC2154

readonly human_review_project="bagredex-human-review"
readonly human_review_volume="bagredex-human-review-database"
readonly human_review_network="bagredex-human-review_application"
readonly human_review_server="bagredex-human-review_server_1"
readonly human_review_compose="${script_dir}/deploy/compose.human-review.yaml"
readonly human_review_cache="${BAGREDEX_HUMAN_REVIEW_CACHE-${script_dir}/.cache/human-review}"
readonly human_review_marker="${human_review_cache}/session"
readonly human_review_lock="${human_review_cache}/lock"

hr_target=""
hr_state=""
hr_plan=""
hr_report=""
hr_base_commit=""
hr_bundle=""
hr_port=""
hr_username=""
hr_password=""
hr_created_at=""
hr_has_database=false
hr_has_server=false
hr_has_volume=false
hr_has_network=false

human_review_usage() {
  printf '%s\n' \
    'Usage:' \
    '  ./bagredex.sh human-review start TARGET' \
    '  ./bagredex.sh human-review status' \
    '  ./bagredex.sh human-review reload' \
    '  ./bagredex.sh human-review finish'
}

human_compose() {
  BAGREDEX_HUMAN_REVIEW_PORT="${hr_port}" podman compose \
    -p "${human_review_project}" -f "${base_compose}" -f "${human_review_compose}" "$@"
}

human_review_lock_session() {
  require_tools flock mkdir
  mkdir -p "${human_review_cache}"
  chmod 700 "${human_review_cache}"
  exec 9>"${human_review_lock}"
  chmod 600 "${human_review_lock}"
  flock -n 9 || {
    printf 'Human-review session is busy; another lifecycle command holds the lock.\n' >&2
    return 3
  }
}

human_review_write_marker() {
  local temporary
  umask 077
  temporary="$(mktemp "${human_review_cache}/session.tmp.XXXXXX")"
  chmod 600 "${temporary}"
  printf '%s\n' \
    'FORMAT_VERSION=1' \
    "TARGET=${hr_target}" \
    "STATE=${hr_state}" \
    "PLAN=${hr_plan}" \
    "REPORT=${hr_report}" \
    "BASE_COMMIT=${hr_base_commit}" \
    "ACTIVE_BUNDLE=${hr_bundle}" \
    "PORT=${hr_port}" \
    "USERNAME=${hr_username}" \
    "PASSWORD=${hr_password}" \
    "CREATED_AT=${hr_created_at}" >"${temporary}"
  mv -f "${temporary}" "${human_review_marker}"
}

human_review_read_marker() {
  local key value format_version="" seen=""
  [[ -f "${human_review_marker}" && ! -L "${human_review_marker}" ]] || {
    printf 'No valid human-review session marker exists.\n' >&2
    return 4
  }
  [[ "$(stat -c '%a' "${human_review_marker}")" == 600 ]] || {
    printf 'Human-review marker must have mode 0600.\n' >&2
    return 5
  }
  hr_target="" hr_state="" hr_plan="" hr_report="" hr_base_commit="" hr_bundle=""
  hr_port="" hr_username="" hr_password="" hr_created_at=""
  while IFS='=' read -r key value; do
    [[ "${seen}" != *"|${key}|"* ]] || {
      printf 'Human-review marker contains a duplicate field: %s\n' "${key}" >&2
      return 5
    }
    seen+="|${key}|"
    case "${key}" in
      FORMAT_VERSION) format_version="${value}" ;;
      TARGET) hr_target="${value}" ;;
      STATE) hr_state="${value}" ;;
      PLAN) hr_plan="${value}" ;;
      REPORT) hr_report="${value}" ;;
      BASE_COMMIT) hr_base_commit="${value}" ;;
      ACTIVE_BUNDLE) hr_bundle="${value}" ;;
      PORT) hr_port="${value}" ;;
      USERNAME) hr_username="${value}" ;;
      PASSWORD) hr_password="${value}" ;;
      CREATED_AT) hr_created_at="${value}" ;;
      *) printf 'Human-review marker contains an unknown field: %s\n' "${key}" >&2; return 5 ;;
    esac
  done <"${human_review_marker}"
  [[ "${format_version}" == 1 && "${hr_target}" =~ ^[a-z0-9][a-z0-9-]*$ &&
    "${hr_state}" =~ ^(starting|ready|reloading|finishing)$ &&
    "${hr_plan}" =~ ^docs/plans/[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+\.md$ &&
    "${hr_report}" =~ ^docs/reports/[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+\.md$ &&
    "${hr_base_commit}" =~ ^[0-9a-f]{40,64}$ && "${hr_bundle}" =~ ^[A-Za-z0-9._-]+$ &&
    "${hr_port}" =~ ^[0-9]+$ &&
    "${hr_port}" -ge 1 && "${hr_port}" -le 65535 && -n "${hr_username}" &&
    -n "${hr_password}" && ! "${hr_username}" =~ [[:cntrl:]] &&
    ! "${hr_password}" =~ [[:cntrl:]] && "${hr_created_at}" =~ ^[0-9TZ:-]+$ ]] || {
    printf 'Human-review marker is invalid; no lifecycle mutation was attempted.\n' >&2
    return 5
  }
  [[ "${hr_plan}" == docs/plans/*-"${hr_target}".md &&
    "${hr_report}" == docs/reports/*-"${hr_target}".md ]] || {
    printf 'Human-review marker target does not match its artifacts.\n' >&2
    return 5
  }
}

human_review_resources_present() {
  local containers status
  containers="$(podman ps -a --filter \
    "label=io.podman.compose.project=${human_review_project}" --format '{{.Names}}')" || {
    printf 'Could not inspect fixed human-review containers.\n' >&2
    return 8
  }
  [[ -z "${containers}" ]] || return 0
  if podman volume exists "${human_review_volume}"; then
    return 0
  else
    status=$?
    [[ "${status}" -eq 1 ]] || return "${status}"
  fi
  if podman network exists "${human_review_network}"; then
    return 0
  else
    status=$?
    [[ "${status}" -eq 1 ]] || return "${status}"
  fi
  return 1
}

human_review_reconcile() {
  local containers volume_label network_label name status
  hr_has_database=false hr_has_server=false hr_has_volume=false hr_has_network=false
  containers="$(podman ps -a --filter \
    "label=io.podman.compose.project=${human_review_project}" --format '{{.Names}}')" || {
    printf 'Could not inspect fixed human-review containers.\n' >&2
    return 8
  }
  while IFS= read -r name; do
    case "${name}" in
      "") ;;
      "${human_review_project}_database_1") hr_has_database=true ;;
      "${human_review_project}_server_1") hr_has_server=true ;;
      "${human_review_project}_server_tmp"*) ;;
      *) printf 'Unexpected container in fixed human-review project: %s\n' "${name}" >&2; return 6 ;;
    esac
  done <<<"${containers}"
  if podman volume exists "${human_review_volume}"; then
    hr_has_volume=true
    volume_label="$(podman volume inspect --format \
      '{{ index .Labels "bagredex.human-review" }}' "${human_review_volume}")"
    [[ "${volume_label}" == true ]] || {
      printf 'Human-review volume label does not match the workflow.\n' >&2
      return 6
    }
  else
    status=$?
    [[ "${status}" -eq 1 ]] || return "${status}"
  fi
  if podman network exists "${human_review_network}"; then
    hr_has_network=true
    network_label="$(podman network inspect --format \
      '{{ index .Labels "io.podman.compose.project" }}' "${human_review_network}")"
    [[ "${network_label}" == "${human_review_project}" ]] || {
      printf 'Human-review network label does not match the workflow.\n' >&2
      return 6
    }
  else
    status=$?
    [[ "${status}" -eq 1 ]] || return "${status}"
  fi
  if [[ "${hr_state}" == starting ]]; then
    return 0
  fi
  if [[ "${hr_state}" == finishing ]]; then
    return 0
  fi
  [[ "${hr_has_volume}" == true && "${hr_has_network}" == true &&
    "${hr_has_database}" == true ]] || {
    printf 'Human-review marker disagrees with its required database resources.\n' >&2
    return 6
  }
}

human_review_reported_commits() {
  local report="${1}"
  awk '
    /^## Commits[[:space:]]*$/ { in_commits = 1; next }
    /^## / && in_commits { exit }
    in_commits { print }
  ' "${report}" | grep -Eo '[0-9a-f]{40,64}' || true
}

human_review_resolve_target() {
  local target="${1}" plan_pattern report_pattern reported_commit
  local -a plans reports reported_commits
  [[ "${target}" =~ ^[a-z0-9][a-z0-9-]*$ ]] || {
    printf 'Human-review target must match [a-z0-9][a-z0-9-]*.\n' >&2
    return 2
  }
  plan_pattern="${script_dir}/docs/plans/????-??-??-${target}.md"
  report_pattern="${script_dir}/docs/reports/????-??-??-${target}.md"
  mapfile -t plans < <(compgen -G "${plan_pattern}" || true)
  mapfile -t reports < <(compgen -G "${report_pattern}" || true)
  [[ "${#plans[@]}" -eq 1 && "${#reports[@]}" -eq 1 ]] || {
    printf 'Target must have exactly one matching completed plan and report.\n' >&2
    return 2
  }
  hr_plan="${plans[0]#"${script_dir}/"}"
  hr_report="${reports[0]#"${script_dir}/"}"
  git -C "${script_dir}" ls-files --error-unmatch "${hr_plan}" "${hr_report}" >/dev/null
  git -C "${script_dir}" diff --quiet HEAD -- "${hr_plan}" "${hr_report}" || {
    printf 'Target artifacts must be committed and unchanged before human review.\n' >&2
    return 2
  }
  mapfile -t reported_commits < <(
    human_review_reported_commits "${script_dir}/${hr_report}"
  )
  [[ "${#reported_commits[@]}" -gt 0 ]] || {
    printf 'Target report does not record a completed local commit.\n' >&2
    return 2
  }
  reported_commit="${reported_commits[${#reported_commits[@]} - 1]}"
  git -C "${script_dir}" cat-file -e "${reported_commit}^{commit}" || {
    printf 'Target report references a commit that is not in local history.\n' >&2
    return 2
  }
  git -C "${script_dir}" merge-base --is-ancestor "${reported_commit}" HEAD || {
    printf 'Target commit is not reachable from the current local history.\n' >&2
    return 2
  }
  if ! git -C "${script_dir}" cat-file -e "${reported_commit}:${hr_plan}" ||
    ! git -C "${script_dir}" cat-file -e "${reported_commit}:${hr_report}"; then
    printf 'Target commit does not represent the matched completed artifact boundary.\n' >&2
    return 2
  fi
  hr_target="${target}"
  hr_base_commit="${reported_commit}"
}

human_review_port_is_free() {
  local listeners
  listeners="$(ss -H -ltn "sport = :${hr_port}")" || {
    printf 'Could not inspect the requested human-review port.\n' >&2
    return 1
  }
  if [[ -n "${listeners}" ]]; then
    printf 'Human-review port is already occupied: %s\n' "${hr_port}" >&2
    return 1
  fi
}

human_review_wait_for_health() {
  local health attempts=0
  while [[ "${attempts}" -lt 30 ]]; do
    health="$(podman inspect --format \
      '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}' \
      "${human_review_server}" 2>/dev/null || true)"
    [[ "${health}" == 'running|healthy' ]] && return 0
    attempts=$((attempts + 1))
    sleep 1
  done
  printf 'Human-review server did not become container-healthy.\n' >&2
  return 1
}

human_review_initialize() {
  local restart_server="${1:-false}"
  install_frontend
  build_frontend
  human_compose build server
  human_compose up -d database
  # The variables are resolved inside the database container.
  # shellcheck disable=SC2016
  human_compose exec -T database sh -c \
    'attempt=0; until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
       attempt=$((attempt + 1)); [ "$attempt" -lt 30 ] || exit 1; sleep 1
     done'
  human_compose run --rm server python manage.py migrate --noinput
  human_compose run --rm server python manage.py load_pokemon_data \
    "/app/src/data/releases/${hr_bundle}"
  human_compose run --rm server python manage.py activate_pokemon_data "${hr_bundle}"
  configure_review_account human_compose "${hr_username}" "${hr_password}"
  if [[ "${restart_server}" == true ]] && podman container exists "${human_review_server}"; then
    podman rm -f "${human_review_server}" >/dev/null
  fi
  human_compose up -d server
  wait_for_review_server "${hr_port}"
  human_review_wait_for_health
  hr_state="ready"
  human_review_write_marker
}

human_review_print_status() {
  local display_state="partial-${hr_state}" database_health server_health
  if [[ "${hr_state}" == ready ]]; then
    database_health="$(podman inspect --format \
      '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}' \
      "${human_review_project}_database_1")" || {
      printf 'Could not inspect human-review database health.\n' >&2
      return 8
    }
    if [[ "${hr_has_server}" == false ]]; then
      [[ "${database_health}" == 'running|healthy' ]] && display_state="stopped"
    else
      server_health="$(podman inspect --format \
        '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}' \
        "${human_review_server}")" || {
        printf 'Could not inspect human-review server health.\n' >&2
        return 8
      }
      if [[ "${database_health}" == 'running|healthy' &&
        "${server_health}" == 'running|healthy' ]] &&
        curl --fail --silent --output /dev/null \
          "http://127.0.0.1:${hr_port}/health/ready"; then
        display_state="ready"
      fi
    fi
  fi
  printf 'TARGET: %s\n' "${hr_target}"
  printf 'STATE: %s\n' "${display_state}"
  printf 'URL: http://127.0.0.1:%s/\n' "${hr_port}"
  printf 'USERNAME: %s\n' "${hr_username}"
  printf 'PASSWORD: %s\n' "${hr_password}"
  printf 'ACTIVE_BUNDLE: %s\n' "${hr_bundle}"
  printf 'PROJECT: %s\n' "${human_review_project}"
  printf 'VOLUME: %s\n' "${human_review_volume}"
}

human_review_start() {
  local target="${1}" resource_status
  require_tools podman npm node sed curl git grep stat mktemp date mv chmod ss
  [[ ! -e "${human_review_marker}" ]] || {
    printf 'A human-review session is already active; use status, reload, or finish.\n' >&2
    return 3
  }
  human_review_resolve_target "${target}"
  if human_review_resources_present; then
    printf 'Fixed human-review resources exist without a valid session marker.\n' >&2
    return 6
  else
    resource_status=$?
    [[ "${resource_status}" -eq 1 ]] || return "${resource_status}"
  fi
  hr_port="${BAGREDEX_HUMAN_REVIEW_PORT-8001}"
  hr_username="${BAGREDEX_REVIEW_USERNAME-admin}"
  hr_password="${BAGREDEX_REVIEW_PASSWORD-bagredex-local}"
  hr_bundle="$(review_data_version_from \
    "${BAGREDEX_HUMAN_REVIEW_DATA_ENV-${pokemon_data_env}}")"
  [[ "${hr_port}" =~ ^[0-9]+$ && "${hr_port}" -ge 1 && "${hr_port}" -le 65535 &&
    -n "${hr_username}" && -n "${hr_password}" &&
    ! "${hr_username}" =~ [[:cntrl:]] && ! "${hr_password}" =~ [[:cntrl:]] ]] || {
    printf 'Human-review port and credentials must be valid and contain no control characters.\n' >&2
    return 2
  }
  human_review_port_is_free
  hr_created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  hr_state="starting"
  human_review_write_marker
  human_review_initialize false
  human_review_reconcile
  human_review_print_status
}

human_review_status() {
  require_tools podman stat sed curl
  human_review_read_marker
  human_review_reconcile
  human_review_print_status
}

human_review_reload() {
  require_tools podman npm node sed curl stat mktemp mv chmod
  human_review_read_marker
  [[ "${hr_state}" != finishing ]] || {
    printf 'Human-review teardown is pending; run finish to resume it.\n' >&2
    return 7
  }
  human_review_reconcile
  [[ "${hr_state}" == starting ]] || podman volume exists "${human_review_volume}" || {
    printf 'Active human-review session is missing its validated database volume.\n' >&2
    return 6
  }
  hr_state="reloading"
  human_review_write_marker
  human_review_initialize true
  human_review_reconcile
  human_review_print_status
}

human_review_finish() {
  local resource_status
  require_tools podman stat mktemp mv chmod
  human_review_read_marker
  human_review_reconcile
  [[ "${hr_state}" == finishing ]] || podman volume exists "${human_review_volume}" || {
    printf 'Expected human-review volume is missing; teardown is not authorized.\n' >&2
    return 7
  }
  hr_state="finishing"
  human_review_write_marker
  human_compose down --volumes --remove-orphans || {
    printf 'Human-review teardown failed; the session marker was preserved.\n' >&2
    return 7
  }
  if podman network exists "${human_review_network}"; then
    podman network rm "${human_review_network}" || {
      printf 'Human-review network teardown failed; the session marker was preserved.\n' >&2
      return 7
    }
  fi
  if human_review_resources_present; then
    printf 'Human-review resources remain after teardown; the marker was preserved.\n' >&2
    return 7
  else
    resource_status=$?
    [[ "${resource_status}" -eq 1 ]] || {
      printf 'Could not confirm human-review teardown; the marker was preserved.\n' >&2
      return 7
    }
  fi
  rm -f -- "${human_review_marker}"
  printf 'TARGET: %s\nSTATE: absent\nPROJECT: %s\nVOLUME: %s\n' \
    "${hr_target}" "${human_review_project}" "${human_review_volume}"
}

human_review_main() {
  local action="${1:-}"
  [[ -n "${action}" ]] || { human_review_usage >&2; return 2; }
  shift
  human_review_lock_session
  case "${action}" in
    start) [[ "$#" -eq 1 ]] || { human_review_usage >&2; return 2; }; human_review_start "$1" ;;
    status) [[ "$#" -eq 0 ]] || { human_review_usage >&2; return 2; }; human_review_status ;;
    reload) [[ "$#" -eq 0 ]] || { human_review_usage >&2; return 2; }; human_review_reload ;;
    finish) [[ "$#" -eq 0 ]] || { human_review_usage >&2; return 2; }; human_review_finish ;;
    *) printf 'Unknown human-review action: %s\n' "${action}" >&2; human_review_usage >&2; return 2 ;;
  esac
}
