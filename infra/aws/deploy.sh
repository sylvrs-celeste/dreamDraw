#!/usr/bin/env bash
# Push the working tree to the instance and rebuild.
#
#   ./infra/aws/deploy.sh
#
# rsync rather than `git pull` on the instance: the repo is private, and the
# alternative is a deploy key sitting on a box that gets destroyed and rebuilt
# regularly. Nothing here needs credentials on the server.
#
# Note this ships your WORKING TREE, uncommitted changes included.
set -euo pipefail

cd "$(dirname "$0")/../.."
source infra/aws/resources.env

KEY="${SSH_KEY:-$HOME/.ssh/dreamdraw.pem}"
HOST="ec2-user@${INSTANCE_IP}"
SSHOPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i "$KEY")

if [[ -n "$(git status --porcelain)" ]]; then
  echo "note: deploying uncommitted changes:"
  git status --short | sed 's/^/  /'
  echo
fi

echo "== syncing to ${INSTANCE_IP} =="
rsync -az --delete \
  --exclude '.git' --exclude 'node_modules' --exclude 'dist' \
  --exclude '__pycache__' --exclude 'pgdata' --exclude '.env' \
  --exclude 'docs' --exclude 'CLAUDE.md' --exclude 'infra/aws/resources.env' \
  -e "ssh ${SSHOPTS[*]}" ./ "${HOST}:~/app/"

echo "== building and starting =="
# --env-file is not optional. Compose resolves ${VAR} against a .env in the
# COMPOSE FILE's directory, not the working directory. Without it every
# interpolated value silently falls back to its default: POSTGRES_DATA puts the
# database on the root disk instead of the EBS volume, and WEB_PORT leaves
# nginx on 8080 where the ALB cannot reach it. Both fail quietly.
#
# Base compose file only -- the dev overlay mounts local AWS credentials, which
# the instance must not use; it has the IAM role.
ssh "${SSHOPTS[@]}" "$HOST" '
  set -e
  cd ~/app
  docker compose --env-file .env -f infra/docker-compose.yml up -d --build
  docker compose --env-file .env -f infra/docker-compose.yml ps --format "  {{.Service}}  {{.Status}}"

  # The root volume is 8 GB and a full rebuild adds roughly 700 MB of layers.
  # Without this, four or five deploys fill the disk and the next one fails
  # somewhere unhelpful.
  docker builder prune -af >/dev/null 2>&1 || true
  docker image prune -f >/dev/null 2>&1 || true
  df -h / | tail -1 | awk "{printf \"  root disk: %s used of %s (%s)\\n\", \$3, \$2, \$5}"
'

echo "== checks =="
ssh "${SSHOPTS[@]}" "$HOST" bash -s <<'REMOTE'
set -e
MOUNT=$(docker inspect dreamdraw-db-1 --format '{{range .Mounts}}{{.Source}}{{end}}')
case "$MOUNT" in
  /data/*) echo "  database on the EBS volume: $MOUNT" ;;
  *) echo "  WRONG: database is on $MOUNT, not /data."
     echo "         It will not survive instance replacement. Check --env-file."
     exit 1 ;;
esac
# One binding per address family, so take the first rather than concatenating
# them -- two "80"s in a row read as "8080" and the check lies.
PORT=$(docker inspect dreamdraw-web-1 \
  --format '{{range $p, $c := .NetworkSettings.Ports}}{{range $c}}{{.HostPort}} {{end}}{{end}}' | awk '{print $1}')
[ "$PORT" = "80" ] || { echo "  WRONG: nginx published on $PORT; the ALB expects 80"; exit 1; }
echo "  nginx on :80"
curl -sf localhost/api/health | sed 's/^/  health: /'
echo
REMOTE
