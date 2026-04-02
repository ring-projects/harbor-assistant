#!/bin/sh
set -eu

log() {
  printf '[harbor-entrypoint] %s\n' "$*" >&2
}

is_truthy() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|on|ON)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

export NODE_ENV="${NODE_ENV:-production}"
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-3400}"
export TRUST_PROXY="${TRUST_PROXY:-false}"
export HARBOR_HOME="${HARBOR_HOME:-/var/lib/harbor}"
export FILE_BROWSER_ROOT_DIRECTORY="${FILE_BROWSER_ROOT_DIRECTORY:-/workspace}"

mkdir -p "${HARBOR_HOME}" "${FILE_BROWSER_ROOT_DIRECTORY}"

if [ -z "${APP_BASE_URL:-}" ]; then
  log "APP_BASE_URL is not set. OAuth callbacks and absolute service URLs may be incorrect behind a reverse proxy."
fi

if [ -z "${WEB_BASE_URL:-}" ]; then
  log "WEB_BASE_URL is not set. Auth redirects will fall back to service-relative paths."
fi

if [ -n "${APP_BASE_URL:-}" ] && ! is_truthy "${TRUST_PROXY}"; then
  log "TRUST_PROXY is disabled. Set TRUST_PROXY=true when Harbor runs behind nginx or another reverse proxy."
fi

if [ "$#" -eq 0 ]; then
  set -- node /app/apps/service/dist/server.js
fi

log "starting Harbor service (host=${HOST} port=${PORT} harbor_home=${HARBOR_HOME} workspace_root=${FILE_BROWSER_ROOT_DIRECTORY} trust_proxy=${TRUST_PROXY})"

exec "$@"
