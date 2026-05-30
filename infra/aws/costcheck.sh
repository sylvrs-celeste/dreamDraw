#!/usr/bin/env bash
# What is currently costing money. Run this after teardown, and any time you
# are not sure whether something was left running.
set -uo pipefail
REGION="${AWS_REGION:-ap-southeast-2}"

echo "== billable resources in $REGION =="
printf "  running instances : %s\n" "$(aws ec2 describe-instances --region "$REGION" \
  --filters Name=instance-state-name,Values=running --query 'length(Reservations[].Instances[])' --output text)"
printf "  stopped instances : %s  (no compute charge, but their volumes still bill)\n" "$(aws ec2 describe-instances --region "$REGION" \
  --filters Name=instance-state-name,Values=stopped --query 'length(Reservations[].Instances[])' --output text)"
printf "  load balancers    : %s  (~\$18.40/mo each)\n" "$(aws elbv2 describe-load-balancers --region "$REGION" --query 'length(LoadBalancers)' --output text 2>/dev/null || echo 0)"
printf "  EBS volumes       : %s\n" "$(aws ec2 describe-volumes --region "$REGION" --query 'length(Volumes)' --output text)"
printf "  unattached EBS    : %s  <- pure waste if not zero\n" "$(aws ec2 describe-volumes --region "$REGION" --filters Name=status,Values=available --query 'length(Volumes)' --output text)"
# An ALB allocates one public IP per AZ and manages them itself; those are
# fine. Only unattached addresses are waste.
printf "  elastic IPs       : %s total, %s UNATTACHED  <- only the unattached ones waste money\n" \
  "$(aws ec2 describe-addresses --region "$REGION" --query 'length(Addresses)' --output text)" \
  "$(aws ec2 describe-addresses --region "$REGION" --query 'length(Addresses[?AssociationId==null])' --output text)"
printf "  NAT gateways      : %s  <- expensive; should be 0\n" "$(aws ec2 describe-nat-gateways --region "$REGION" --filter Name=state,Values=available --query 'length(NatGateways)' --output text)"
printf "  CloudFront dists  : %s  (free at this volume)\n" "$(aws cloudfront list-distributions --query 'length(DistributionList.Items)' --output text 2>/dev/null || echo 0)"
printf "  S3 buckets        : %s  (pennies)\n" "$(aws s3api list-buckets --query 'length(Buckets)' --output text)"

echo
echo "== month to date =="
aws ce get-cost-and-usage --time-period Start=$(date -u +%Y-%m-01),End=$(date -u -v+1d +%Y-%m-%d 2>/dev/null || date -u -d tomorrow +%Y-%m-%d) \
  --granularity MONTHLY --metrics UnblendedCost \
  --query 'ResultsByTime[0].Total.UnblendedCost.[Amount,Unit]' --output text 2>/dev/null \
  | awk '{printf "  $%.2f %s\n", $1, $2}' || echo "  (Cost Explorer not enabled yet; it takes ~24h after first use)"
