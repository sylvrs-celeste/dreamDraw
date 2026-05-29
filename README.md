# dreamDraw

A personal gallery for documenting an art journey. Finished collage images are
uploaded with a title, the date the work was made, a description and tags; the
public side presents them as a dark-studio wall of slightly-angled polaroids.

One person writes, everyone reads. There are no accounts, no comments, and no
social features — just the work, in order.

## Status

Working end to end locally: gallery, timeline, entry pages with a lightbox, and
an admin area for writing entries and uploading images. Runs under compose.
Not yet deployed — the AWS infrastructure is the remaining piece.

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

## A note on the architecture

A single EC2 instance behind a load balancer is not a high-availability setup,
and isn't meant to look like one. The ALB is there because it terminates
cleanly behind CloudFront and lets the instance's security group be locked down
to the CloudFront origin-facing prefix list, so the site can only be reached
over HTTPS. If the instance goes down, the site goes down.

This is expected to run for about a month and then be torn down. Decisions
throughout favour "simple enough to finish and delete" over "durable".
