#!/bin/sh
set -eu

log() {
  printf '[harbor-entrypoint] %s\n' "$*" >&2
}

export NODE_ENV="${NODE_ENV:-production}"

if [ -z "${DATABASE_URL:-}" ]; then
  log "DATABASE_URL is required."
  exit 1
fi

if [ "$#" -eq 0 ]; then
  set -- node /app/apps/service/dist/server.js
fi

log "starting Harbor service"

exec "$@"
