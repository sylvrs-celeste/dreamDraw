#!/usr/bin/env bash
# Install the nightly backup cron job on the instance.
set -euo pipefail
cd "$(dirname "$0")/../.."
source infra/aws/resources.env
KEY="${SSH_KEY:-$HOME/.ssh/dreamdraw.pem}"
SSHOPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i "$KEY")

scp "${SSHOPTS[@]}" infra/aws/backup.sh "ec2-user@${INSTANCE_IP}:~/backup.sh"
ssh "${SSHOPTS[@]}" "ec2-user@${INSTANCE_IP}" "
  # AL2023 minimal ships without cron.
  command -v crontab >/dev/null || { sudo dnf -y install cronie >/dev/null && sudo systemctl enable --now crond; }
  chmod +x ~/backup.sh
  # 03:00 UTC, which is a quiet hour in Perth.
  ( crontab -l 2>/dev/null | grep -v 'backup.sh' ; \
    echo 'S3_BUCKET=${S3_BUCKET}' ; \
    echo '0 3 * * * /home/ec2-user/backup.sh >> /home/ec2-user/backup.log 2>&1' ) | crontab -
  crontab -l | sed 's/^/  /'
"
