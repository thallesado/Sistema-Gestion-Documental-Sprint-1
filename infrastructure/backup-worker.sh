#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
: "${BACKUP_QUEUE:?Set BACKUP_QUEUE to the host directory shared with the backend}"
: "${BACKUP_DESTINATION:?Set BACKUP_DESTINATION to an independent mounted disk}"
[[ "$BACKUP_QUEUE" = /* && -d "$BACKUP_QUEUE" ]] || exit 1
exec 8>/run/lock/nexodocs-backup-worker.lock
flock -n 8 || exit 0
heartbeat() {
  local target="$BACKUP_QUEUE/worker-ready"
  if [[ -e "$target" || -L "$target" ]]; then
    [[ -f "$target" && ! -L "$target" ]] || return 1
    touch -h -- "$target"
  else
    (set -o noclobber; : > "$target")
  fi
}
# An orphaned running marker means the previous operator was interrupted.
for operation in "$BACKUP_QUEUE"/*; do
  [[ -d "$operation" && ! -L "$operation" && "${operation##*/}" =~ ^[0-9a-f-]{36}$ ]] || continue
  if [[ -f "$operation/running" && ! -L "$operation/running" ]]; then mv -T -- "$operation/running" "$operation/failed"; fi
done
heartbeat
for operation in "$BACKUP_QUEUE"/*; do
  [[ -d "$operation" && ! -L "$operation" && "${operation##*/}" =~ ^[0-9a-f-]{36}$ ]] || continue
  [[ -f "$operation/requested" && ! -L "$operation/requested" ]] || continue
  mv -T -- "$operation/requested" "$operation/running"
  # Keep privileged output outside the untrusted writable request directory.
  if bash "$ROOT/infrastructure/backup-full.sh"; then
    mv -T -- "$operation/running" "$operation/completed"
  else
    mv -T -- "$operation/running" "$operation/failed"
  fi
  heartbeat
done
