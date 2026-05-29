#!/usr/bin/env bash
# Stop paying for the site without destroying it.
#
#   ./infra/aws/park.sh
#
# Stops the instance and deletes the load balancer. Keeps the EBS volume (your
# database), the S3 bucket (your images), and the CloudFront distribution
# (free when idle, and keeping it avoids a 15 minute wait on the way back up).
#
# Parked cost is the EBS volumes only, about $2.70/month.
set -euo pipefail
cd "$(dirname "$0")/../.."
source infra/aws/resources.env

echo "== deleting the load balancer (\$0.0252/hr) =="
aws elbv2 delete-load-balancer --region "$AWS_REGION" --load-balancer-arn "$ALB_ARN" 2>/dev/null \
  && echo "  deleted" || echo "  already gone"
sleep 20
aws elbv2 delete-target-group --region "$AWS_REGION" --target-group-arn "$TARGET_GROUP" 2>/dev/null \
  && echo "  target group deleted" || echo "  target group already gone"

echo "== stopping the instance (\$0.0212/hr) =="
aws ec2 stop-instances --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" >/dev/null
aws ec2 wait instance-stopped --region "$AWS_REGION" --instance-ids "$INSTANCE_ID"
echo "  stopped"

# The ALB is gone, so these are stale. bringup.sh rewrites them.
sed -i.bak '/^ALB_ARN=/d;/^ALB_DNS=/d;/^TARGET_GROUP=/d' infra/aws/resources.env && rm -f infra/aws/resources.env.bak

echo
echo "== parked =="
echo "  still billing: EBS volumes only, ~\$2.70/month"
echo "  kept: database on /data, images in S3, CloudFront distribution"
echo "  the CloudFront URL will 502 until you run bringup.sh"
