#!/usr/bin/env bash
# Delete every billable dreamDraw resource, in dependency order.
#
# Order matters. EBS volumes and the ALB bill until explicitly deleted, and a
# volume detached from a terminated instance is the classic forgotten charge --
# it keeps billing quietly forever.
#
#   ./infra/aws/teardown.sh          show what would be deleted
#   ./infra/aws/teardown.sh --yes    actually delete it
set -uo pipefail

REGION="${AWS_REGION:-ap-southeast-2}"
DRY=1
[[ "${1:-}" == "--yes" ]] && DRY=0

say()  { printf "  %s\n" "$*"; }
run()  { if [[ $DRY -eq 1 ]]; then say "would: $*"; else say "$*"; "$@" >/dev/null 2>&1 || say "  (already gone)"; fi; }

echo "== CloudFront =="
# Must be disabled and fully deployed before it can be deleted; AWS refuses
# otherwise and the wait is 5-15 minutes.
for ID in $(aws cloudfront list-distributions \
      --query "DistributionList.Items[?Comment=='dreamdraw'].Id" --output text 2>/dev/null); do
  say "distribution $ID"
  if [[ $DRY -eq 0 ]]; then
    ETAG=$(aws cloudfront get-distribution-config --id "$ID" --query ETag --output text)
    aws cloudfront get-distribution-config --id "$ID" --query DistributionConfig > /tmp/cf.json
    python3 -c "import json;d=json.load(open('/tmp/cf.json'));d['Enabled']=False;json.dump(d,open('/tmp/cf.json','w'))"
    aws cloudfront update-distribution --id "$ID" --distribution-config file:///tmp/cf.json --if-match "$ETAG" >/dev/null
    say "disabled; waiting for it to deploy (this takes a few minutes)"
    aws cloudfront wait distribution-deployed --id "$ID"
    ETAG=$(aws cloudfront get-distribution --id "$ID" --query ETag --output text)
    aws cloudfront delete-distribution --id "$ID" --if-match "$ETAG" && say "deleted"
  fi
done

echo "== load balancer and target group =="
for ARN in $(aws elbv2 describe-load-balancers --region "$REGION" \
      --query "LoadBalancers[?LoadBalancerName=='dreamdraw-alb'].LoadBalancerArn" --output text 2>/dev/null); do
  run aws elbv2 delete-load-balancer --region "$REGION" --load-balancer-arn "$ARN"
done
[[ $DRY -eq 0 ]] && sleep 20   # the TG cannot go while the listener still references it
for ARN in $(aws elbv2 describe-target-groups --region "$REGION" \
      --query "TargetGroups[?TargetGroupName=='dreamdraw-tg'].TargetGroupArn" --output text 2>/dev/null); do
  run aws elbv2 delete-target-group --region "$REGION" --target-group-arn "$ARN"
done

echo "== EC2 instance =="
IDS=$(aws ec2 describe-instances --region "$REGION" \
  --filters Name=tag:Name,Values=dreamdraw Name=instance-state-name,Values=running,stopped,stopping,pending \
  --query 'Reservations[].Instances[].InstanceId' --output text 2>/dev/null)
if [[ -n "$IDS" ]]; then
  run aws ec2 terminate-instances --region "$REGION" --instance-ids $IDS
  if [[ $DRY -eq 0 ]]; then
    say "waiting for termination (volumes cannot be deleted until it is gone)"
    aws ec2 wait instance-terminated --region "$REGION" --instance-ids $IDS
  fi
fi

echo "== EBS volumes =="
# Root volumes usually delete with the instance; the data volume does not.
for V in $(aws ec2 describe-volumes --region "$REGION" \
      --filters Name=tag:Name,Values=dreamdraw-data --query 'Volumes[].VolumeId' --output text 2>/dev/null); do
  run aws ec2 delete-volume --region "$REGION" --volume-id "$V"
done
say "checking for ANY unattached volume left behind:"
aws ec2 describe-volumes --region "$REGION" --filters Name=status,Values=available \
  --query 'Volumes[].[VolumeId,Size,CreateTime]' --output text 2>/dev/null | sed 's/^/    orphan: /' || true

echo "== security groups =="
[[ $DRY -eq 0 ]] && sleep 10   # ENIs take a moment to detach after termination
for N in dreamdraw-ec2 dreamdraw-alb; do
  for G in $(aws ec2 describe-security-groups --region "$REGION" \
        --filters Name=group-name,Values=$N --query 'SecurityGroups[].GroupId' --output text 2>/dev/null); do
    run aws ec2 delete-security-group --region "$REGION" --group-id "$G"
  done
done

echo
echo "== NOT deleted (deliberately) =="
say "S3 bucket, IAM role, key pair, budget alarm."
say "The bucket holds your images. Empty and delete it only when you mean it:"
say "  aws s3 rm s3://\$S3_BUCKET --recursive && aws s3api delete-bucket --bucket \$S3_BUCKET"
echo
if [[ $DRY -eq 1 ]]; then
  echo "  DRY RUN. Nothing was deleted. Re-run with --yes."
else
  echo "  Done. Verify with: ./infra/aws/costcheck.sh"
fi
