#!/usr/bin/env bash
# Bring the parked site back.
#
#   ./infra/aws/bringup.sh
#
# Starts the instance, builds a new load balancer, and repoints CloudFront at
# it. A new ALB always gets a new DNS name, which is why the origin has to be
# rewritten every time -- that is the one unavoidable cost of parking.
set -euo pipefail
cd "$(dirname "$0")/../.."
source infra/aws/resources.env

echo "== starting the instance =="
aws ec2 start-instances --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" >/dev/null
aws ec2 wait instance-running --region "$AWS_REGION" --instance-ids "$INSTANCE_ID"
IP=$(aws ec2 describe-instances --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
echo "  running, public ip $IP (it changes on every start)"
sed -i.bak "s/^INSTANCE_IP=.*/INSTANCE_IP=$IP/" infra/aws/resources.env && rm -f infra/aws/resources.env.bak

echo "== target group and load balancer =="
TG=$(aws elbv2 create-target-group --region "$AWS_REGION" --name dreamdraw-tg \
  --protocol HTTP --port 80 --vpc-id "$VPC_ID" --target-type instance \
  --health-check-protocol HTTP --health-check-path /api/health \
  --health-check-interval-seconds 30 --matcher HttpCode=200 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)
aws elbv2 register-targets --region "$AWS_REGION" --target-group-arn "$TG" --targets Id="$INSTANCE_ID" >/dev/null
ALB=$(aws elbv2 create-load-balancer --region "$AWS_REGION" --name dreamdraw-alb \
  --type application --scheme internet-facing \
  --subnets "$SUBNET_A" "$SUBNET_B" --security-groups "$ALB_SG" \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)
DNS=$(aws elbv2 describe-load-balancers --region "$AWS_REGION" --load-balancer-arns "$ALB" \
  --query 'LoadBalancers[0].DNSName' --output text)
aws elbv2 create-listener --region "$AWS_REGION" --load-balancer-arn "$ALB" \
  --protocol HTTP --port 80 --default-actions Type=forward,TargetGroupArn="$TG" >/dev/null
echo "  $DNS"
cat >> infra/aws/resources.env <<EOF
TARGET_GROUP=$TG
ALB_ARN=$ALB
ALB_DNS=$DNS
EOF

echo "== repointing CloudFront at the new origin =="
ETAG=$(aws cloudfront get-distribution-config --id "$CLOUDFRONT_ID" --query ETag --output text)
aws cloudfront get-distribution-config --id "$CLOUDFRONT_ID" --query DistributionConfig > /tmp/cf.json
python3 - "$DNS" <<'PY'
import json, sys
d = json.load(open("/tmp/cf.json"))
d["Origins"]["Items"][0]["DomainName"] = sys.argv[1]
json.dump(d, open("/tmp/cf.json", "w"))
PY
aws cloudfront update-distribution --id "$CLOUDFRONT_ID" \
  --distribution-config file:///tmp/cf.json --if-match "$ETAG" >/dev/null
echo "  updated; propagating (5-15 min)"

echo "== waiting for the target to go healthy =="
for _ in $(seq 1 30); do
  H=$(aws elbv2 describe-target-health --region "$AWS_REGION" --target-group-arn "$TG" \
    --query 'TargetHealthDescriptions[0].TargetHealth.State' --output text)
  [ "$H" = "healthy" ] && { echo "  healthy"; break; }
  sleep 10
done

echo "== waiting for CloudFront =="
aws cloudfront wait distribution-deployed --id "$CLOUDFRONT_ID"
echo
echo "  live: https://${CLOUDFRONT_DOMAIN}"
echo "  note: the instance IP changed, so deploy.sh now targets $IP"
