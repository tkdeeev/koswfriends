#!/bin/sh
set -eu
umask 077
mkdir -p /backups
while true; do
  target="/backups/koswfriends-$(date -u +%Y%m%dT%H%M%SZ).dump"
  if pg_dump --format=custom --no-owner --no-acl > "$target.tmp" && pg_restore --list "$target.tmp" > /dev/null; then
    mv "$target.tmp" "$target"
    find /backups -name 'koswfriends-*.dump' -mtime +6 -delete
    echo 'Database backup complete'
  else
    rm -f "$target.tmp"
    echo 'Database backup failed' >&2
    exit 1
  fi
  sleep 86400 &
  wait $!
done
