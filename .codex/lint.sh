#!/usr/bin/env bash
# Report style violations after a Codex write. This script never modifies files.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly script_dir
repository_root="$(git -C "${script_dir}" rev-parse --show-toplevel)"
readonly repository_root
readonly rumdl_config="${script_dir}/rumdl.toml"

for required_tool in git rumdl shellcheck; do
  if ! command -v "${required_tool}" >/dev/null 2>&1; then
    printf 'Required lint tool is unavailable: %s\n' "${required_tool}" >&2
    exit 2
  fi
done

status=0

while IFS= read -r -d '' relative_path; do
  file="${repository_root}/${relative_path}"
  [[ -f "${file}" ]] || continue
  case "${relative_path}" in
    *.sh)
      if ! shellcheck_output="$(shellcheck "${file}" 2>&1)"; then
        printf 'shellcheck found issues in %s:\n%s\n' \
          "${relative_path}" "${shellcheck_output}" >&2
        status=2
      fi
      ;;
    *.md | *.markdown)
      if ! rumdl_output="$(rumdl check --config "${rumdl_config}" "${file}" 2>&1)"; then
        printf 'rumdl found issues in %s:\n%s\n' \
          "${relative_path}" "${rumdl_output}" >&2
        status=2
      fi
      ;;
  esac
done < <(git -C "${repository_root}" ls-files --cached --others --exclude-standard -z)

exit "${status}"
