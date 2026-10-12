# Deploying on Railway

How Sheet Happens runs on [Railway](https://railway.com), and the constraints that shape it. Read
this before setting up Railway projects, environments, domains or touching a deployed database.
Names in angle brackets (`<your-project>`, `<project-id>`) and `app.example.com` are placeholders.

The repo's `railway.json` (config as code) gives every environment its Dockerfile builder,
`preDeployCommand` (`pnpm db:migrate:deploy && pnpm railway:bootstrap-admin`), start command,
healthcheck (`/api/health`) and restart policy. Nothing else about the deployment lives in the repo.

## Topology

The recommended layout is one Railway project per stage, each with a single persistent environment:

| Project           | Environment   | Branch    | Services                          | URL                                      |
| ----------------- | ------------- | --------- | --------------------------------- | ---------------------------------------- |
| `<your-app>-prod` | `production`  | `main`    | app service, `Postgres`, a bucket | `app.example.com` (custom domain)        |
| `<your-app>-dev`  | `development` | `develop` | app service, `Postgres`, a bucket | `<service>-<environment>.up.railway.app` |

Stage differences live in project-scoped variables and the branch the service tracks, not in
per-environment overrides. Separate projects keep a staging deploy, its database and its secrets
from ever sharing a blast radius with production.

Renaming a project is safe and touches nothing else: the project ID is what deploy triggers, the
GitHub integration, dashboard URLs and `railway link` all key off, generated domains are
`<service>-<environment>.up.railway.app` with no project name in them, and `RAILWAY_PROJECT_NAME` is
computed at deploy time rather than stored, so no redeploy is triggered.

## Setting up a project

1. `railway init --name <your-project>` (the CLI always names the first environment `production`;
   rename it in the dashboard if this project is for another stage).
2. `railway add --database postgres` — Railway provisions it private-network only.
3. Add a bucket (Railway object storage or any S3-compatible service).
4. `railway add --service <app-service>`, connect it to your fork of the repo and the branch it should
   deploy. `railway.json` takes care of build and deploy settings.
5. Set the variables listed in `.env.example`, in particular:
   - `DATABASE_URL` as the reference `${{Postgres.DATABASE_URL}}`
   - `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` from the
     bucket's credentials
   - a fresh `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), never shared between projects
   - `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL` set to the public URL
     **before** the first build (see build-time variables below)
6. Generate or attach a domain routed to port **8080** (see below).

Pipe secret values into `railway variable set <NAME> --stdin` rather than passing them as command
arguments, so they never land in shell history.

## PR environments

Railway can create an ephemeral environment per pull request, forked from a base environment and
deleted when the PR merges or closes. This is a **project-level setting that connecting the repo does
not imply** — a fresh project has `prDeploys: false` and silently creates no previews. It is not
visible in `railway status`; check it explicitly:

```bash
railway api 'query($id: String!) { project(id: $id) {
  prDeploys botPrEnvironments focusedPrEnvironments baseEnvironmentId } }' --raw-var id=<project-id>
```

If you enable previews:

- Enable them in **one** project only, the non-production one, with `baseEnvironmentId` pointing at
  its persistent environment. Railway's docs do not say whether previews are scoped by the PR's base
  branch or by "a service in this project is connected to the PR's repo", so two projects connected to
  the same repo could both create a preview per PR.
- Keep them off in production: a preview is a fork of the base environment's variables, services and
  volumes, so it carries a copy of that environment's database and secrets.
- If your repository accepts pull requests from forks, make sure untrusted fork PRs cannot build a
  preview that inherits real credentials.

Google sign-in and passkeys do **not** work in a PR environment — its hostname is per-PR, so it
matches neither the registered Google redirect URI nor a passkey's RP ID. Use email/password or
magic-link sign-in there.

## Constraints worth knowing

**A Postgres 18 client is needed for dump/restore.** Railway's Postgres is 18.x; a 17.x `pg_dump`
refuses to dump from it and `pg_restore` refuses its archives. Rather than installing `postgresql@18`
locally, run dump/restore/psql inside a `postgres:18-alpine` container. Docker is already a
prerequisite for `pnpm db:dev`.

**The deployed databases are private-network only.** Railway does not provision a public TCP proxy
with Postgres; avoid adding one permanently. To reach a deployed database from a local tool:

```bash
railway connect Postgres --tunnel-only   # prints host/port for TablePlus, DBeaver, psql, …
```

A container cannot reach a tunnel bound to host loopback, so a one-off restore from a container needs
a temporary TCP proxy — delete it again afterwards.

**The app connects over the private network.** `DATABASE_URL` is the reference
`${{Postgres.DATABASE_URL}}`, which resolves to the database's private hostname. Pre-deploy commands
run inside the same network, so `prisma migrate deploy` works from there.

**The container listens on 8080, not 3000.** Railway injects `PORT=8080`, which overrides the
Dockerfile's `ENV PORT=3000`, so a domain must route to 8080. Railway-generated domains left with no
explicit target port auto-detect it correctly; if you pin a port, pin 8080 or the domain answers 502.

**Build-time variables.** The Dockerfile takes `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_BETTER_AUTH_URL` as build args, and `NEXT_PUBLIC_*` are baked
into the client bundle. Set them **before** the first build, or rebuild after changing them —
changing the variable alone does not change an already-built bundle.

**`BETTER_AUTH_SECRET` is load-bearing across a database copy.** Sessions in the database are signed
with it and stored Google OAuth tokens are encrypted with it (`encryptOAuthTokens: true`,
`src/server/auth/auth.ts`). When you copy a database to another environment, either copy the secret
byte-for-byte or accept that every restored session and linked Google account breaks.

## Moving a domain between projects

Better Auth derives the passkey RP ID from the hostname (`src/server/auth/auth.ts`) and Google OAuth
redirect URIs are hostname-specific, so keeping the same URL is much cheaper than changing it: no
Google Cloud Console edit, no passkey re-registration. A Railway-generated domain can be moved:

```bash
# free the label on the old service
railway domain update <domain-id> --domain <label>-legacy --project <old-project> -e <env> -s <service>
# claim it on the new one
railway domain --service <service> --port 8080            # generates a placeholder
railway domain update <generated-host> --domain <label> --service <service>
```

Expect a short TLS/DNS settling window. If the URL does have to change, remember the Google redirect
URI (`https://<host>/api/auth/callback/google`) and that existing passkeys will stop working.

## Removing a deploy trigger from a shared service

If one service is shared between two environments of the same project, each environment has its own
deploy trigger. `railway service source disconnect` is too blunt there — delete just the trigger:

```bash
railway api 'query($id: String!) { project(id: $id) { deploymentTriggers { edges { node
  { id branch environmentId } } } } }' --raw-var id=<project-id>
railway api 'mutation($id: String!) { deploymentTriggerDelete(id: $id) }' --raw-var id=<trigger-id>
```

Always re-query afterwards and confirm the other environment's trigger is still there.

## Why not Infrastructure as Code (yet)

Railway has two code-based configuration systems: config as code (`railway.json`, read during
deploy) and Infrastructure as Code (`.railway/railway.ts`, applied by `railway config apply`).
**A service cannot be managed by both**, and `railway config plan` refuses to run while a service is
still managed by `railway.json`.

Adopting IaC therefore means deleting `railway.json` and re-declaring production's deploy settings
in the same change, on a feature Railway still labels experimental, so it is deliberately deferred.

The DSL does cover everything this repo needs, so the follow-up is mechanical when we want it:
`builder: "DOCKERFILE"`, `dockerfilePath`, `preDeployCommand`, `healthcheckPath`,
`healthcheckTimeout`, `restartPolicyType`/`restartPolicyMaxRetries`, `watchPatterns`, `region`, plus
`database(name, "postgres", { image })` to pin the Postgres image and `bucket(name, { region })`.
Adopting it means: `railway config pull --force`, translate `railway.json`, delete `railway.json`,
clear any custom config-file path in service settings, `railway config plan`, then
`railway config apply` — one project at a time.
