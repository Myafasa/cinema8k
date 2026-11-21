#!/bin/sh
set -eu

while true; do
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  tmp="/backups/cinema-${stamp}.dump.tmp"
  final="/backups/cinema-${stamp}.dump"
  pg_dump --format=custom --no-owner --file="$tmp"
  mv "$tmp" "$final"
  find /backups -type f -name 'cinema-*.dump' -mtime "+${BACKUP_RETENTION_DAYS:-14}" -delete
  sleep 86400
done
