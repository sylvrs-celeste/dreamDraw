# dreamDraw

A personal gallery for documenting an art journey. Finished collage images are
uploaded with a title, the date the work was made, a description and tags; the
public side presents them as a dark-studio wall of slightly-angled polaroids.

One person writes, everyone reads. There are no accounts, no comments, and no
social features — just the work, in order.

## Status

Early. The backend core is in place (models, migration, health check); the API
routes, image pipeline, and frontend are not built yet.

## Stack

React 18 + TypeScript on Vite for the frontend, FastAPI on the backend,
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

```bash
docker compose up --build      # not yet written — see Roadmap step 11
```

Until the compose file exists, the backend can be run against a throwaway
database:

```bash
docker run -d --name dd-pg \
  -e POSTGRES_USER=dreamdraw -e POSTGRES_PASSWORD=dreamdraw -e POSTGRES_DB=dreamdraw \
  -p 5432:5432 postgres:16

cd backend
alembic upgrade head
uvicorn app.main:app --reload
```

`GET /api/health` should return `{"status":"ok","database":"ok"}`. Interactive
docs are at `/api/docs` when `ENV=dev`.

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
frontend/    React + TypeScript client            (not started)
infra/       Dockerfiles, nginx config, compose   (not started)
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
