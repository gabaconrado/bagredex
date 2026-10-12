#!/bin/sh
set -eu

case "${BAGREDEX_DOMAIN:-}" in
    '' | *[!a-z0-9.-]*)
        printf 'BAGREDEX_DOMAIN must be one lowercase ASCII FQDN.\n' >&2
        exit 2
        ;;
esac
if [ "${#BAGREDEX_DOMAIN}" -gt 253 ] ||
    ! printf '%s\n' "${BAGREDEX_DOMAIN}" |
      grep -Eq '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$'; then
    printf 'BAGREDEX_DOMAIN must be one lowercase ASCII FQDN.\n' >&2
    exit 2
fi

# Replace only this variable so Nginx's own variables remain intact.
# shellcheck disable=SC2016
envsubst '${BAGREDEX_DOMAIN}' </etc/nginx/default.conf.template >/tmp/default.conf
exec "$@"
