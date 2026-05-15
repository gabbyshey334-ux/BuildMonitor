#!/usr/bin/env bash
# Export Supabase data for off-site backups. Requires supabase CLI and project link.
# Schedule via cron: 0 2 * * * /path/to/backup-supabase.sh
set -euo pipefail

OUT_DIR="${BACKUP_DIR:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT_DIR"

if ! command -v supabase &>/dev/null; then
  echo "Install Supabase CLI: https://supabase.com/docs/guides/cli"
  exit 1
fi

echo "[backup] Dumping schema..."
supabase db dump -f "$OUT_DIR/schema-$STAMP.sql" --schema public

echo "[backup] Dumping data..."
supabase db dump -f "$OUT_DIR/data-$STAMP.sql" --data-only --schema public

# Keep last 14 daily backups
find "$OUT_DIR" -name '*.sql' -mtime +14 -delete 2>/dev/null || true

echo "[backup] Done: $OUT_DIR/*-$STAMP.sql"
