#!/usr/bin/env bash
# Nightly database dump to S3, kept for 14 days.
#
# Installed on the instance by install-backup.sh and run by cron. The database
# lives on a single EBS volume with no snapshot schedule, and teardown.sh
# deletes that volume -- one mistyped command and the whole journey is gone.
# A dump costs pennies and takes seconds.
set -euo pipefail

BUCKET="${S3_BUCKET:?S3_BUCKET not set}"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
KEY="backups/dreamdraw-${STAMP}.sql.gz"
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

cd "$HOME/app"
# Read the credentials from the env file rather than baking them in.
PGUSER=$(grep '^POSTGRES_USER=' .env | cut -d= -f2-)
PGDB=$(grep '^POSTGRES_DB=' .env | cut -d= -f2-)

docker compose --env-file .env -f infra/docker-compose.yml exec -T db \
  pg_dump -U "$PGUSER" "$PGDB" | gzip > "$TMP"

SIZE=$(wc -c < "$TMP")
# A dump of an empty database is still a few KB; anything tiny means pg_dump
# failed and we would be uploading a useless file over a good one.
[ "$SIZE" -gt 1000 ] || { echo "dump suspiciously small (${SIZE}B), refusing to upload"; exit 1; }

aws s3 cp "$TMP" "s3://${BUCKET}/${KEY}" --quiet
echo "$(date -u +%FT%TZ) uploaded ${KEY} (${SIZE} bytes)"

# Prune anything older than 14 days.
CUTOFF=$(date -u -d '14 days ago' +%Y-%m-%d 2>/dev/null || date -u -v-14d +%Y-%m-%d)
aws s3 ls "s3://${BUCKET}/backups/" | while read -r d _ _ f; do
  [[ "$d" < "$CUTOFF" ]] && aws s3 rm "s3://${BUCKET}/backups/${f}" --quiet
done || true
