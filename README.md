# dreamDraw

A personal gallery for documenting an art journey. Finished collage images are
uploaded with a title, the date the work was made, a description and tags; the
public side presents them as a dark-studio wall of slightly-angled polaroids.

One person writes, everyone reads. There are no accounts, no comments, and no
social features — just the work, in order.

## Status

Deployed and working: gallery, timeline, entry pages with a lightbox, and an
admin area for writing entries and uploading images. Runs under compose on a
single EC2 instance behind an ALB, with CloudFront in front for HTTPS.

## Stack

React 19 + TypeScript on Vite for the frontend, FastAPI on the backend,
PostgreSQL 16 for metadata, S3 for the images themselves. Everything runs in
containers, deployed to a single EC2 instance behind an Application Load
Balancer, with CloudFront in front of that for HTTPS.

## Running it locally

Requires Docker. Copy the environment template and fill in the blanks:

```bash
cp .env.example .env
```

`ADMIN_PASSWORD_HASH` and `JWT_SECRET` need real values before the auth routes
land; the health check works without them.

**Escape every `$` in `ADMIN_PASSWORD_HASH` as `$$`.** Compose treats `$NAME`
in an env file as a variable and substitutes it away, which quietly truncates a
bcrypt hash and makes every login fail while the app otherwise looks healthy.
The API refuses to start if the hash arrives malformed.

The whole stack, nginx on port 8080:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up --build
```

The dev overlay only exists to pass your AWS credentials through to the API.
On the instance the IAM role supplies them, so deployment uses the base file
alone.

`GET /api/health` returns `{"status":"ok","database":"ok"}`. Interactive docs
are at `/api/docs` when `ENV=dev`.

### Working on the frontend

Compose serves a production build, so it will not hot-reload. For frontend work
run Vite against the API instead — it proxies `/api` through, so the session
cookie behaves the same as it does behind CloudFront:

```bash
cd frontend && npm run dev      # http://localhost:5173
```

## Database changes

Schema is managed entirely by Alembic. There is no `create_all` anywhere in the
application, so a model edit without a migration simply won't take effect.

```bash
alembic revision --autogenerate -m "what changed"
alembic upgrade head
alembic downgrade -1
```

Read what autogenerate produces before applying it. It does not always get
circular foreign keys right — see the comment in `0001_initial_schema.py` for
one case where the generated output was silently missing a constraint.

## Layout

```
backend/     FastAPI app, SQLAlchemy models, Alembic migrations
frontend/    React + TypeScript client
infra/       Dockerfiles, nginx config, compose
docs/        SRS and working notes                (gitignored)
```

## Deployment

Everything lives in `infra/aws/`. There is no CI: deployment is one script that
rsyncs the working tree to the instance and rebuilds.

```bash
./infra/aws/deploy.sh      # push code, rebuild, run migrations, assert health
./infra/aws/costcheck.sh   # what is currently billing
```

`deploy.sh` checks two things afterwards that have both silently broken before:
that Postgres is on the EBS volume rather than the root disk, and that nginx is
published on port 80 where the ALB expects it. Both stem from `docker compose`
resolving `${VAR}` against a `.env` beside the *compose file* rather than the
working directory, which is why every compose invocation passes `--env-file`.

### Running costs

About **$36.57/month** if left up, roughly $1.20/day:

| | |
|---|---|
| ALB | $18.40/mo — billed hourly whether or not anyone visits |
| EC2 `t4g.small` | $15.48/mo |
| EBS 28 GB | $2.69/mo |
| CloudFront, S3 | effectively free at this volume |

A $60 monthly budget alarm emails at 80% actual and 100% forecast.

### Parking it between sessions

The ALB cannot be stopped, only deleted, and it is half the bill. Parking
deletes it and stops the instance, keeping the database, the images and the
CloudFront distribution:

```bash
./infra/aws/park.sh        # -> ~$2.70/month (EBS only)
./infra/aws/bringup.sh     # -> back up in ~10 minutes
```

A rebuilt ALB always gets a new DNS name, so `bringup.sh` repoints the
CloudFront origin and waits for it to propagate. The instance also gets a new
public IP on every start; `bringup.sh` rewrites `infra/aws/resources.env` so
`deploy.sh` keeps working.

### Backups

A nightly `pg_dump` goes to `s3://<bucket>/backups/` at 03:00 UTC, kept 14 days.
The database otherwise lives on a single EBS volume with no snapshots, and
`teardown.sh` deletes that volume — the dump is the backstop for exactly that
mistake. Restore with:

```bash
aws s3 cp s3://<bucket>/backups/<file>.sql.gz - | gunzip | \
  docker compose --env-file .env -f infra/docker-compose.yml exec -T db psql -U dreamdraw dreamdraw
```

## Teardown

**Order matters, and things bill until explicitly deleted.** A volume detached
from a terminated instance is the classic forgotten charge — it keeps billing
quietly and nothing reminds you.

```bash
./infra/aws/teardown.sh          # dry run, prints what it would delete
./infra/aws/teardown.sh --yes    # actually delete
```

It works through the dependencies in order:

1. **CloudFront** — disable, wait for it to deploy, then delete. AWS refuses to
   delete an enabled distribution, and the wait is 5–15 minutes.
2. **ALB**, then the target group (the group cannot go while a listener holds it)
3. **EC2 instance**, waiting for termination — volumes cannot be deleted first
4. **EBS volumes**, including a sweep for *any* unattached volume left behind
5. **Security groups**, once their network interfaces have detached

Deliberately **not** deleted: the S3 bucket, the IAM role, the key pair and the
budget alarm. The bucket holds your images *and* your database backups, so
emptying it is a decision to make on purpose:

```bash
aws s3 rm s3://<bucket> --recursive && aws s3api delete-bucket --bucket <bucket>
```

Afterwards, `./infra/aws/costcheck.sh` should report zeroes. It flags unattached
volumes, idle elastic IPs and NAT gateways specifically, because those are the
three that bill silently.

## A note on the architecture

A single EC2 instance behind a load balancer is not a high-availability setup,
and isn't meant to look like one. The ALB is there because it terminates
cleanly behind CloudFront and lets the instance's security group be locked down
to the CloudFront origin-facing prefix list, so the site can only be reached
over HTTPS. If the instance goes down, the site goes down.

This is expected to run for about a month and then be torn down. Decisions
throughout favour "simple enough to finish and delete" over "durable".
