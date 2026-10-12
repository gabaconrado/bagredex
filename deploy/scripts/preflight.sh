#!/usr/bin/env bash
set -euo pipefail

remote_dir="${1:?remote directory required}"
for tool in bash curl df flock getconf getent journalctl podman rsync ssh ss systemctl; do
  command -v "${tool}" >/dev/null 2>&1 || {
    printf 'Required production capability is unavailable: %s\n' "${tool}" >&2; exit 2;
  }
done
podman_version="$(podman version --format '{{.Client.Version}}')"
[[ "$(printf '%s\n%s\n' 4.9.0 "${podman_version}" | sort -V | head -n1)" == 4.9.0 ]] || {
  printf 'Podman 4.9 or newer is required; found %s.\n' "${podman_version}" >&2; exit 2;
}
podman compose version >/dev/null
systemctl --user show-environment >/dev/null
journalctl --user --no-pager -n 1 >/dev/null
read -r unprivileged_port_start </proc/sys/net/ipv4/ip_unprivileged_port_start
((unprivileged_port_start <= 80)) || { printf 'Rootless processes cannot bind port 80.\n' >&2; exit 2; }
(("$(getconf _NPROCESSORS_ONLN)" >= 1)) || { printf 'At least one CPU is required.\n' >&2; exit 2; }
memory_kib="$(awk '/^MemTotal:/ { print $2 }' /proc/meminfo)"
((memory_kib >= 900000)) || { printf 'At least 1 GB RAM is required.\n' >&2; exit 2; }
available_kib="$(df -Pk "${remote_dir}" | awk 'NR == 2 { print $4 }')"
((available_kib >= 2000000)) || { printf 'At least 2 GB free disk is required.\n' >&2; exit 2; }
[[ -r "${remote_dir}/shared/.env" ]] || { printf 'shared/.env is missing.\n' >&2; exit 2; }
set -a
# shellcheck disable=SC1091
source "${remote_dir}/shared/.env"
set +a
for variable in BAGREDEX_ENVIRONMENT BAGREDEX_DOMAIN BAGREDEX_EXPECTED_IP LETSENCRYPT_EMAIL \
  DJANGO_SECRET_KEY; do
  [[ -n "${!variable:-}" ]] || {
    printf 'Required production variable is empty: %s\n' "${variable}" >&2; exit 2;
  }
done
[[ "${BAGREDEX_ENVIRONMENT}" == production ]] || {
  printf 'BAGREDEX_ENVIRONMENT must be production.\n' >&2; exit 2;
}
if [[ "${BAGREDEX_DOMAIN}" == *[^a-z0-9.-]* || "${#BAGREDEX_DOMAIN}" -gt 253 || \
  ! "${BAGREDEX_DOMAIN}" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$ ]]; then
  printf 'BAGREDEX_DOMAIN must be one lowercase ASCII FQDN.\n' >&2
  exit 2
fi
getent ahosts "${BAGREDEX_DOMAIN}" | awk '{print $1}' | grep -Fxq "${BAGREDEX_EXPECTED_IP}" || {
  printf 'Domain does not resolve to BAGREDEX_EXPECTED_IP.\n' >&2; exit 2;
}
for port in 80 443; do
  if ss -H -ltn "sport = :${port}" | grep -q .; then
    podman ps --filter label=com.docker.compose.project=bagredex --format '{{.Ports}}' |
      grep -Eq "(^|, )((0\\.0\\.0\\.0|\\[::\\])?:)?${port}->" || {
        printf 'Port %s is occupied outside the Bagredex Compose project.\n' "${port}" >&2; exit 2;
      }
  fi
done
