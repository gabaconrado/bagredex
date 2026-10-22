#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly script_dir
readonly compose_project="bagredex-local"
readonly base_compose="${script_dir}/deploy/compose.yaml"
readonly local_compose="${script_dir}/deploy/compose.local.yaml"
readonly pokemon_data_env="${script_dir}/deploy/pokemon-data.env"
readonly human_review_script="${script_dir}/deploy/scripts/human-review.sh"

require_tools() {
  local tool
  for tool in "$@"; do
    command -v "${tool}" >/dev/null 2>&1 || {
      printf 'Required host tool is unavailable: %s\n' "${tool}" >&2
      return 2
    }
  done
}

compose_local() {
  podman compose -p "${compose_project}" -f "${base_compose}" -f "${local_compose}" "$@"
}

install_frontend() {
  require_tools npm
  npm --prefix "${script_dir}/src/web" ci --ignore-scripts --no-audit --no-fund
}

build_frontend() {
  require_tools npm node
  npm --prefix "${script_dir}/src/web" run build
  node "${script_dir}/deploy/scripts/verify-vite-assets.mjs" \
    "${script_dir}/src/web/static/web/dist/.vite/manifest.json" \
    "${script_dir}/src/web/static/web/dist"
}

check_frontend() {
  require_tools npm
  npm --prefix "${script_dir}/src/web" run check
  npm --prefix "${script_dir}/src/web" test
  build_frontend
}

check_backend() {
  require_tools uv
  uv --directory "${script_dir}/src/backend" run ruff format --check .
  uv --directory "${script_dir}/src/backend" run ruff check .
  uv --directory "${script_dir}/src/backend" run mypy --config-file pyproject.toml .
  uv --directory "${script_dir}/src/backend" run python manage.py check
  DJANGO_SETTINGS_MODULE=bagredex.settings.production \
    DJANGO_SECRET_KEY=deployment-check-only-secret-key-000000000000000000000000 \
    BAGREDEX_DOMAIN=bagredex.example.invalid BAGREDEX_IMAGE_VERSION=0.0.0 \
    BAGREDEX_DATABASE_NAME=bagredex BAGREDEX_DATABASE_USER=bagredex \
    BAGREDEX_DATABASE_PASSWORD=deployment-check-only BAGREDEX_DATABASE_HOST=database \
    BAGREDEX_DATABASE_PORT=5432 \
    uv --directory "${script_dir}/src/backend" run python manage.py check --deploy \
      --fail-level WARNING
}

test_backend() {
  require_tools podman
  compose_local build server
  compose_local up -d database
  compose_local run --rm server pytest -c pyproject.toml
}

check_deploy() {
  require_tools bash shellcheck bats find xargs
  "${script_dir}/.codex/lint.sh"
  bash -n "${script_dir}/bagredex.sh"
  find "${script_dir}/deploy/scripts" -type f -name '*.sh' -print0 | xargs -0 -r bash -n
  shellcheck "${script_dir}/bagredex.sh"
  find "${script_dir}/deploy/scripts" -type f -name '*.sh' -print0 | xargs -0 -r shellcheck
  bats "${script_dir}/deploy/tests"
}

run_local() {
  require_tools podman npm
  cleanup() {
    local status="${1:-$?}"
    trap - EXIT INT TERM
    compose_local down >/dev/null
    return "${status}"
  }
  trap 'cleanup "$?"' EXIT
  trap 'cleanup 130; exit 130' INT
  trap 'cleanup 143; exit 143' TERM
  install_frontend
  build_frontend
  compose_local up --build
  cleanup 0
}

review_data_version_from() {
  local data_env="${1}"
  local -a versions=()
  [[ -f "${data_env}" ]] || {
    printf 'Review data pin is unavailable: %s\n' "${data_env}" >&2
    return 2
  }
  mapfile -t versions < <(
    sed -n 's/^BAGREDEX_POKEMON_DATA_VERSION=//p' "${data_env}"
  )
  [[ "${#versions[@]}" -eq 1 && "${versions[0]}" =~ ^[A-Za-z0-9._-]+$ ]] || {
    printf 'Review data pin must contain one valid BAGREDEX_POKEMON_DATA_VERSION.\n' >&2
    return 2
  }
  printf '%s\n' "${versions[0]}"
}

review_data_version() {
  review_data_version_from "${pokemon_data_env}"
}

wait_for_review_database() {
  # The variables belong to the database container, not this host shell.
  # shellcheck disable=SC2016
  compose_local exec -T database sh -c \
    'attempt=0; until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
       attempt=$((attempt + 1)); [ "$attempt" -lt 30 ] || exit 1; sleep 1
     done' || {
    printf 'Local review database did not become ready within 30 seconds.\n' >&2
    return 1
  }
}

wait_for_review_server() {
  local port="${1:?review port required}" attempt
  for ((attempt = 1; attempt <= 30; attempt++)); do
    if curl --fail --silent --output /dev/null \
      "http://127.0.0.1:${port}/health/ready"; then
      return 0
    fi
    sleep 1
  done
  printf 'Local review server did not become ready within 30 seconds.\n' >&2
  return 1
}

configure_review_account() {
  local compose_function="${1:?compose function required}"
  local review_username="${2:?review username required}"
  local review_password="${3:?review password required}"
  local account_python
  account_python='import sys
from django.contrib.auth import get_user_model
from django.db import transaction

username, password, terminator = sys.stdin.buffer.read().split(b"\0")
if terminator:
    raise ValueError("invalid review credential input")
with transaction.atomic():
    user, _ = get_user_model().objects.update_or_create(
        username=username.decode(),
        defaults={"is_active": True, "is_staff": True, "is_superuser": True},
    )
    user.set_password(password.decode())
    user.save(update_fields=["password"])'
  printf '%s\0%s\0' "${review_username}" "${review_password}" | \
    "${compose_function}" run --rm -T server python manage.py shell -c "${account_python}"
}

review_local() {
  require_tools podman npm node sed curl
  local review_port="${BAGREDEX_PORT-8000}"
  local review_username="${BAGREDEX_REVIEW_USERNAME-admin}"
  local review_password="${BAGREDEX_REVIEW_PASSWORD-bagredex-local}"
  local data_version
  [[ "${review_port}" =~ ^[0-9]+$ && "${review_port}" -ge 1 && \
    "${review_port}" -le 65535 ]] || {
    printf 'BAGREDEX_PORT must be an integer from 1 through 65535.\n' >&2
    return 2
  }
  [[ -n "${review_username}" ]] || {
    printf 'BAGREDEX_REVIEW_USERNAME must not be empty.\n' >&2
    return 2
  }
  [[ -n "${review_password}" ]] || {
    printf 'BAGREDEX_REVIEW_PASSWORD must not be empty.\n' >&2
    return 2
  }
  [[ ! "${review_username}" =~ [[:cntrl:]] && \
    ! "${review_password}" =~ [[:cntrl:]] ]] || {
    printf 'Review credentials must not contain control characters.\n' >&2
    return 2
  }
  data_version="$(review_data_version)" || return $?

  cleanup() {
    local status="${1:-$?}"
    trap - EXIT INT TERM
    compose_local down >/dev/null
    return "${status}"
  }
  trap 'cleanup "$?"' EXIT
  trap 'cleanup 130; exit 130' INT
  trap 'cleanup 143; exit 143' TERM

  install_frontend
  build_frontend
  compose_local build server
  compose_local up -d database
  wait_for_review_database
  compose_local run --rm server python manage.py migrate --noinput
  compose_local run --rm server python manage.py load_pokemon_data \
    "/app/src/data/releases/${data_version}"
  compose_local run --rm server python manage.py activate_pokemon_data "${data_version}"

  configure_review_account compose_local "${review_username}" "${review_password}"

  compose_local up -d server
  wait_for_review_server "${review_port}"
  printf '\nBagredex review is ready.\n'
  printf 'URL:      http://127.0.0.1:%s/\n' "${review_port}"
  printf 'Username: %s\n' "${review_username}"
  printf 'Password: %s\n' "${review_password}"
  printf 'Active data: %s\n' "${data_version}"
  printf 'Press Ctrl+C to stop the containers; the database volume is preserved.\n\n'
  compose_local up server
  cleanup 0
}

migrate_local() {
  require_tools podman
  compose_local build server
  compose_local up -d database
  compose_local run --rm server python manage.py migrate --noinput
}

usage() {
  printf '%s\n' \
    'Usage: ./bagredex.sh COMMAND [ARGUMENTS]' \
    '' \
    'Commands:' \
    '  check                 Run all local checks and tests' \
    '  check-web             Check, test, and build the Web GUI' \
    '  build-web             Install locked dependencies and build the Web GUI' \
    '  watch-web             Rebuild Web GUI assets when source files change' \
    '  check-backend         Run backend formatting, linting, typing, and Django checks' \
    '  test                  Run backend tests' \
    '  check-deploy          Run documentation, shell, and deployment tests' \
    '  run                   Build and run the local stack in the foreground' \
    '  review                Initialize and run a complete local review stack' \
    '  human-review ACTION   Manage an explicit isolated review session' \
    '  migrate               Apply local database migrations' \
    '  publish VERSION       Validate, build, tag, and push production images' \
    '  deploy VERSION [--dry-run]  Deploy a published release'
}

main() {
  local command="${1:-}"
  [[ -n "${command}" ]] || { usage >&2; return 2; }
  shift
  case "${command}" in
    check) [[ "$#" -eq 0 ]] || { usage >&2; return 2; }; check_frontend; check_backend; test_backend; check_deploy ;;
    check-web) [[ "$#" -eq 0 ]] || { usage >&2; return 2; }; check_frontend ;;
    build-web) [[ "$#" -eq 0 ]] || { usage >&2; return 2; }; install_frontend; build_frontend ;;
    watch-web) [[ "$#" -eq 0 ]] || { usage >&2; return 2; }; install_frontend; npm --prefix "${script_dir}/src/web" run build -- --watch ;;
    check-backend) [[ "$#" -eq 0 ]] || { usage >&2; return 2; }; check_backend ;;
    test) [[ "$#" -eq 0 ]] || { usage >&2; return 2; }; test_backend ;;
    check-deploy) [[ "$#" -eq 0 ]] || { usage >&2; return 2; }; check_deploy ;;
    run) [[ "$#" -eq 0 ]] || { usage >&2; return 2; }; run_local ;;
    review) [[ "$#" -eq 0 ]] || { usage >&2; return 2; }; review_local ;;
    human-review)
      # shellcheck source=deploy/scripts/human-review.sh
      # shellcheck disable=SC1091
      source "${human_review_script}"
      human_review_main "$@"
      ;;
    migrate) [[ "$#" -eq 0 ]] || { usage >&2; return 2; }; migrate_local ;;
    publish) exec "${script_dir}/deploy/scripts/publish.sh" "$@" ;;
    deploy) exec "${script_dir}/deploy/scripts/deploy.sh" "$@" ;;
    help | --help | -h) [[ "$#" -eq 0 ]] || { usage >&2; return 2; }; usage ;;
    *) printf 'Unknown command: %s\n' "${command}" >&2; usage >&2; return 2 ;;
  esac
}

main "$@"
