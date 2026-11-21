#!/bin/sh
set -e

echo "migrate: starting…"
node /app/scripts/migrate.mjs
echo "migrate: done"

exec node /app/server.js
