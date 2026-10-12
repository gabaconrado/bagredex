#!/usr/bin/env bash
set -euo pipefail

release_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly release_dir
set -a
# shellcheck disable=SC1091
source "${release_dir}/shared/.env"
# shellcheck disable=SC1091
source "${release_dir}/release.env"
set +a
: "${BAGREDEX_DOMAIN:?BAGREDEX_DOMAIN is required}"
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL is required}"
compose=(podman compose -p bagredex -f "${release_dir}/deploy/compose.yaml" \
  -f "${release_dir}/deploy/compose.production.yaml")
"${compose[@]}" run -d --service-ports --name bagredex-nginx-bootstrap \
  -v "${release_dir}/deploy/nginx/bootstrap.conf.template:/etc/nginx/default.conf.template:ro" nginx
cleanup() { podman rm -f bagredex-nginx-bootstrap >/dev/null 2>&1 || true; }
trap cleanup EXIT
"${compose[@]}" --profile operations run --rm certbot certonly --webroot -w /var/www/certbot \
  --non-interactive --agree-tos --email "${LETSENCRYPT_EMAIL}" -d "${BAGREDEX_DOMAIN}"
"${compose[@]}" --profile operations run --rm --entrypoint sh certbot -c \
  'chgrp 101 /etc/letsencrypt && chmod 0750 /etc/letsencrypt && chgrp -R 101 /etc/letsencrypt/live /etc/letsencrypt/archive && find /etc/letsencrypt/live /etc/letsencrypt/archive -type d -exec chmod 0750 {} + && find /etc/letsencrypt/archive -type f -exec chmod 0640 {} +'
cleanup
trap - EXIT
"${compose[@]}" up -d nginx
