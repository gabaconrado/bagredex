#!/usr/bin/env bash
set -euo pipefail

remote_dir="${1:?remote directory required}"
release_id="${2:?release id required}"
[[ "${remote_dir}" =~ ^/[A-Za-z0-9._/-]+$ && "${remote_dir}" != / && "${remote_dir}" != *..* ]] || {
  printf 'Unsafe remote directory.\n' >&2; exit 2;
}
[[ "${release_id}" =~ ^[A-Za-z0-9._-]+$ ]] || { printf 'Unsafe release identifier.\n' >&2; exit 2; }
release_dir="${remote_dir}/releases/${release_id}"
shared_dir="${remote_dir}/shared"
previous_target=""
recovery_armed=false

release_image_version() {
  local target="${1:?release directory required}" target_id="${2:?release id required}"
  local metadata_id="" image_version="" key value
  [[ -f "${target}/release.env" ]] || {
    printf 'Release metadata is unavailable: %s\n' "${target}/release.env" >&2; return 2;
  }
  while IFS='=' read -r key value; do
    case "${key}" in
      BAGREDEX_RELEASE_ID) metadata_id="${value}" ;;
      BAGREDEX_IMAGE_VERSION) image_version="${value}" ;;
    esac
  done <"${target}/release.env"
  [[ "${metadata_id}" == "${target_id}" ]] || {
    printf 'Release metadata does not match release %s.\n' "${target_id}" >&2; return 2;
  }
  [[ "${image_version}" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || {
    printf 'Release %s has an invalid image version.\n' "${target_id}" >&2; return 2;
  }
  printf '%s\n' "${image_version}"
}

compose_release() {
  local target="${1:?release directory required}" target_id="${2:?release id required}"
  local image_version
  shift 2
  image_version="$(release_image_version "${target}" "${target_id}")" || return $?
  BAGREDEX_RELEASE_ID="${target_id}" BAGREDEX_IMAGE_VERSION="${image_version}" \
    BAGREDEX_ENV_FILE="${shared_dir}/.env" podman compose -p bagredex \
    -f "${target}/deploy/compose.yaml" -f "${target}/deploy/compose.production.yaml" "$@"
}

wait_for_server() {
  local target="${1:?release directory required}" target_id="${2:?release id required}"
  local attempt
  for ((attempt = 1; attempt <= 60; attempt++)); do
    if compose_release "${target}" "${target_id}" exec -T server \
      python -c "import os, urllib.request; request = urllib.request.Request('http://127.0.0.1:8000/health/ready', headers={'Host': os.environ['BAGREDEX_DOMAIN'], 'X-Forwarded-Proto': 'https'}); urllib.request.urlopen(request, timeout=2)"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_for_database() {
  local target="${1:?release directory required}" target_id="${2:?release id required}"
  local attempt
  for ((attempt = 1; attempt <= 60; attempt++)); do
    if compose_release "${target}" "${target_id}" exec -T database \
      pg_isready -U "${BAGREDEX_DATABASE_USER}" -d "${BAGREDEX_DATABASE_NAME}"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

capture_previous_target() {
  local candidate=""
  if [[ -L "${remote_dir}/current" ]]; then
    candidate="$(readlink -f "${remote_dir}/current" 2>/dev/null || true)"
  fi
  if [[ "${candidate}" == "${remote_dir}/releases/"* && -d "${candidate}" && \
    -f "${candidate}/deploy/compose.yaml" && -f "${candidate}/deploy/compose.production.yaml" ]]; then
    previous_target="${candidate}"
  fi
}

current_points_to_failed_release() {
  local target=""
  [[ -L "${remote_dir}/current" ]] || return 1
  target="$(readlink -f "${remote_dir}/current" 2>/dev/null || true)"
  [[ "${target}" == "${release_dir}" ]]
}

certificate_exists() {
  local target="${1:?release directory required}" target_id="${2:?release id required}"
  compose_release "${target}" "${target_id}" --profile operations run --rm \
    --entrypoint sh certbot \
    -c "test -f '/etc/letsencrypt/live/${BAGREDEX_DOMAIN}/fullchain.pem'"
}

recover_previous_release() {
  local original_status=$? previous_id=""
  local recovery_failed=false
  [[ "${recovery_armed}" == true ]] || { trap - EXIT; exit "${original_status}"; }
  recovery_armed=false
  trap - EXIT
  set +e
  printf 'Deployment failed with status %s; attempting recovery.\n' "${original_status}" >&2
  compose_release "${release_dir}" "${release_id}" stop nginx server || recovery_failed=true
  if [[ -n "${previous_target}" ]]; then
    previous_id="$(basename "${previous_target}")"
    if ! ln -sfn "${previous_target}" "${remote_dir}/current" \
      || ! compose_release "${previous_target}" "${previous_id}" up -d server \
      || ! wait_for_server "${previous_target}" "${previous_id}" \
      || ! certificate_exists "${previous_target}" "${previous_id}" \
      || ! compose_release "${previous_target}" "${previous_id}" up -d nginx; then
      recovery_failed=true
    fi
  else
    if current_points_to_failed_release; then rm -- "${remote_dir}/current" || recovery_failed=true; fi
    printf 'No previous release is available to restart.\n' >&2
  fi
  if [[ "${recovery_failed}" == true ]]; then
    printf 'Previous-release recovery could not be verified.\n' >&2
  elif [[ -n "${previous_target}" ]]; then
    printf 'Previous release was restarted.\n' >&2
  fi
  exit "${original_status}"
}

wait_for_public_health() {
  local attempt response
  for ((attempt = 1; attempt <= 60; attempt++)); do
    response="$(curl --fail --silent --show-error \
      "https://${BAGREDEX_DOMAIN}/health/live" 2>/dev/null || true)"
    [[ "${response}" == '{"status": "ok"}' ]] && return 0
    sleep 1
  done
  return 1
}

set -a
# shellcheck disable=SC1091
source "${shared_dir}/.env"
# shellcheck disable=SC1091
source "${release_dir}/release.env"
# shellcheck disable=SC1091
source "${release_dir}/deploy/pokemon-data.env"
set +a
[[ "${BAGREDEX_ENVIRONMENT:-}" == production ]] || {
  printf 'Remote environment is not production.\n' >&2; exit 2;
}
[[ "${BAGREDEX_RELEASE_ID:-}" == "${release_id}" ]] || {
  printf 'Release metadata does not match release %s.\n' "${release_id}" >&2; exit 2;
}
[[ "${BAGREDEX_IMAGE_VERSION:-}" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || {
  printf 'Release %s has an invalid image version.\n' "${release_id}" >&2; exit 2;
}
[[ "${BAGREDEX_POKEMON_DATA_VERSION:-}" =~ ^showdown-[a-f0-9]{8}-s[0-9]+-i[0-9]+-[a-f0-9]{12}$ ]] || {
  printf 'Release %s has an invalid Pokemon data version.\n' "${release_id}" >&2; exit 2;
}
pokemon_data_bundle="/app/src/data/releases/${BAGREDEX_POKEMON_DATA_VERSION}"
readonly pokemon_data_bundle

capture_previous_target
compose_release "${release_dir}" "${release_id}" pull database
compose_release "${release_dir}" "${release_id}" pull server
compose_release "${release_dir}" "${release_id}" pull nginx
compose_release "${release_dir}" "${release_id}" run --rm --no-deps server \
  python manage.py check --deploy --fail-level WARNING
ln -sfn "${shared_dir}" "${release_dir}/shared"

compose_release "${release_dir}" "${release_id}" up -d database
wait_for_database "${release_dir}" "${release_id}"
compose_release "${release_dir}" "${release_id}" run --rm --no-deps server \
  python manage.py migrate --noinput
compose_release "${release_dir}" "${release_id}" run --rm --no-deps server \
  python manage.py load_pokemon_data "${pokemon_data_bundle}"
compose_release "${release_dir}" "${release_id}" run --rm --no-deps server \
  python manage.py activate_pokemon_data "${BAGREDEX_POKEMON_DATA_VERSION}" --if-none

recovery_armed=true
trap recover_previous_release EXIT
compose_release "${release_dir}" "${release_id}" stop nginx server
if [[ -n "${previous_target}" ]]; then ln -sfn "${previous_target}" "${remote_dir}/previous"; fi
ln -sfn "${release_dir}" "${remote_dir}/current"
compose_release "${release_dir}" "${release_id}" up -d server
wait_for_server "${release_dir}" "${release_id}"
if certificate_exists "${release_dir}" "${release_id}"; then
  compose_release "${release_dir}" "${release_id}" up -d nginx
else
  "${release_dir}/deploy/scripts/bootstrap-certificates.sh"
fi
wait_for_public_health

recovery_armed=false
trap - EXIT
current_target="$(readlink -f "${remote_dir}/current")"
previous_link="$(readlink -f "${remote_dir}/previous" 2>/dev/null || printf '/nonexistent')"
find "${remote_dir}/releases" -mindepth 1 -maxdepth 1 -type d \
  ! -path "${current_target}" ! -path "${previous_link}" -exec rm -rf -- {} +
