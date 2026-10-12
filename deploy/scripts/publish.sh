#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly script_dir
repository_root="$(cd "${script_dir}/../.." && pwd)"
readonly repository_root registry="docker.io"
readonly application_repository="${registry}/gabaconrado/bagredex"
readonly nginx_repository="${registry}/gabaconrado/bagredex-nginx"

fail() { printf 'Publication preflight failed: %s\n' "$*" >&2; return 2; }
require_tool() { command -v "$1" >/dev/null 2>&1 || fail "required tool is unavailable: $1"; }
validate_version() {
  [[ "$1" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] ||
    fail "VERSION must be a stable MAJOR.MINOR.PATCH value"
}
validate_git_state() {
  [[ -z "$(git -C "${repository_root}" status --porcelain)" ]] || fail "working tree is dirty"
  [[ "$(git -C "${repository_root}" branch --show-current)" == main ]] ||
    fail "publications must originate from main"
}

main() {
  [[ "$#" -eq 1 ]] || fail "expected exactly one VERSION argument"
  local version="${1:-}"
  validate_version "${version}"
  local tool
  for tool in git podman uv curl shellcheck bats find xargs bash; do require_tool "${tool}"; done
  validate_git_state
  podman login "${registry}"
  "${repository_root}/bagredex.sh" check
  validate_git_state

  local tag="v${version}"
  local application_image="${application_repository}:${version}"
  local nginx_image="${nginx_repository}:${version}"
  local existing_commit=""
  if git -C "${repository_root}" show-ref --verify --quiet "refs/tags/${tag}"; then
    [[ "$(git -C "${repository_root}" cat-file -t "refs/tags/${tag}")" == tag ]] ||
      fail "existing ${tag} is not annotated"
    existing_commit="$(git -C "${repository_root}" rev-parse "${tag}^{commit}")"
    [[ "${existing_commit}" == "$(git -C "${repository_root}" rev-parse HEAD)" ]] ||
      fail "existing ${tag} does not reference HEAD"
  else
    git -C "${repository_root}" tag --annotate "${tag}" --message "Release ${version}" HEAD
  fi

  local build=(podman build --platform linux/amd64 --file "${repository_root}/deploy/Containerfile")
  "${build[@]}" --target application --tag "${application_image}" "${repository_root}"
  "${build[@]}" --target nginx --tag "${nginx_image}" "${repository_root}"
  podman push "${application_image}"
  podman push "${nginx_image}"
}

main "$@"
