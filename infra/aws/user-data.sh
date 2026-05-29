#!/bin/bash
# Instance bootstrap. Runs once, at first boot, via EC2 user-data.
set -eux

dnf -y update
dnf -y install docker git

# Compose v2 as a CLI plugin. AL2023 does not package it, and the standalone
# docker-compose binary is the old Python one.
mkdir -p /usr/local/lib/docker/cli-plugins
curl -sSL "https://github.com/docker/compose/releases/download/v2.32.4/docker-compose-linux-$(uname -m)" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

systemctl enable --now docker
usermod -aG docker ec2-user

# --- data volume -----------------------------------------------------------
# Find the EBS data volume. Nitro renames devices, so /dev/sdf is not what you
# asked for and cannot be assumed.
#
# A candidate has no partitions, no filesystem, and nothing mounted under it.
# The "no partitions" test is the important one: a whole disk reports no
# FSTYPE even when its partitions are formatted, so matching on FSTYPE alone
# selects the ROOT disk first and the next line is mkfs. Do not remove it.
pick_data_disk() {
  local d children
  for d in $(lsblk -dpno NAME,TYPE | awk '$2=="disk"{print $1}'); do
    children=$(lsblk -no NAME "$d" | tail -n +2 | wc -l)
    [ "$children" -ne 0 ] && continue
    [ -n "$(lsblk -no FSTYPE "$d" | tr -d '[:space:]')" ] && continue
    [ -n "$(lsblk -no MOUNTPOINT "$d" | tr -d '[:space:]')" ] && continue
    blkid "$d" >/dev/null 2>&1 && continue
    echo "$d"; return 0
  done
  return 1
}

# The volume is attached just after the instance starts, so it may not be
# present yet when this runs.
DEV=""
for _ in $(seq 1 60); do
  DEV=$(pick_data_disk) && break
  DEV=""; sleep 2
done

if [ -n "$DEV" ]; then
  mkfs -t xfs "$DEV"
  mkdir -p /data
  UUID=$(blkid -s UUID -o value "$DEV")
  # nofail: a missing volume must never stop the instance booting, or you lose
  # SSH and have no way in to fix it.
  grep -q "$UUID" /etc/fstab || echo "UUID=$UUID /data xfs defaults,nofail 0 2" >> /etc/fstab
  mount -a
  mkdir -p /data/postgres
fi

# --- swap ------------------------------------------------------------------
# 2 GB. Pillow resizing a 25 MB photo spikes hard, and an OOM kill mid-upload
# is a miserable thing to diagnose from the outside.
if [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

touch /var/log/dreamdraw-bootstrap-done
