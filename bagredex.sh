#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly script_dir
readonly compose_project="bagredex-local"
readonly base_compose="${script_dir}/deploy/compose.yaml"
readonly local_compose="${script_dir}/deploy/compose.local.yaml"

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
  require_tools podman
  cleanup() {
    local status="${1:-$?}"
    trap - EXIT INT TERM
    compose_local down >/dev/null
    return "${status}"
  }
  trap 'cleanup "$?"' EXIT
  trap 'cleanup 130; exit 130' INT
  trap 'cleanup 143; exit 143' TERM
  compose_local up --build
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
    '  check-backend         Run backend formatting, linting, typing, and Django checks' \
    '  test                  Run backend tests' \
    '  check-deploy          Run documentation, shell, and deployment tests' \
    '  run                   Build and run the local stack in the foreground' \
    '  migrate               Apply local database migrations' \
    '  publish VERSION       Validate, build, tag, and push production images' \
    '  deploy VERSION [--dry-run]  Deploy a published release'
}

main() {
  local command="${1:-}"
  [[ -n "${command}" ]] || { usage >&2; return 2; }
  shift
  case "${command}" in
    check) [[ "$#" -eq 0 ]] || { usage >&2; return 2; }; check_backend; test_backend; check_deploy ;;
    check-backend) [[ "$#" -eq 0 ]] || { usage >&2; return 2; }; check_backend ;;
    test) [[ "$#" -eq 0 ]] || { usage >&2; return 2; }; test_backend ;;
    check-deploy) [[ "$#" -eq 0 ]] || { usage >&2; return 2; }; check_deploy ;;
    run) [[ "$#" -eq 0 ]] || { usage >&2; return 2; }; run_local ;;
    migrate) [[ "$#" -eq 0 ]] || { usage >&2; return 2; }; migrate_local ;;
    publish) exec "${script_dir}/deploy/scripts/publish.sh" "$@" ;;
    deploy) exec "${script_dir}/deploy/scripts/deploy.sh" "$@" ;;
    help | --help | -h) [[ "$#" -eq 0 ]] || { usage >&2; return 2; }; usage ;;
    *) printf 'Unknown command: %s\n' "${command}" >&2; usage >&2; return 2 ;;
  esac
}

main "$@"
