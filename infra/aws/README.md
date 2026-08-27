# AWS provisioning

Resources are created with the CLI, not a template tool. Terraform would be the
right answer for anything long-lived; this stack exists for about a month and
then gets deleted, and a state file is more machinery than the job needs.

## What exists

| Resource | Name | Cost |
|---|---|---|
| S3 bucket | `dreamdraw-images-<account>` | pay per use, pennies |
| IAM role + instance profile | `dreamdraw-ec2` | free |
| Security group (ALB) | `dreamdraw-alb` | free |
| Security group (EC2) | `dreamdraw-ec2` | free |
| Budget alarm | `dreamdraw-monthly`, $60 | free |

Concrete ids land in `resources.env`, which is gitignored — it describes one
account's topology and there is no reason to publish it.

## The lockdown

The ALB accepts port 80 **only** from the AWS-managed prefix list
`com.amazonaws.global.cloudfront.origin-facing`. Its DNS name is therefore
unreachable directly, and the site is only available over CloudFront HTTPS.
That is what makes the `Secure` session cookie mean anything.

The instance accepts port 80 only from the ALB's security group, and port 22
only from the owner's IP at the time of provisioning. **A changed home IP locks
you out of SSH** — re-authorise with:

```bash
aws ec2 authorize-security-group-ingress --group-id "$EC2_SG" \
  --ip-permissions "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=$(curl -s https://checkip.amazonaws.com)/32}]"
```

## Teardown

Order matters, and **EBS and the ALB bill until explicitly deleted**. A detached
volume is the classic forgotten charge. See the checklist in `CLAUDE.md`.
