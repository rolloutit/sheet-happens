# Railway projects and environments

How Sheet Happens is deployed, and the constraints that shape it. Read this before touching Railway
projects, environments, domains or the deployed databases.

## Topology

Since 2026-08-04 each stage is its own Railway project, in the `Rollout IT Workspace`:

| Project              | Environment   | Branch    | Services                                                       | URL                                |
| -------------------- | ------------- | --------- | -------------------------------------------------------------- | ---------------------------------- |
| `sheet-happens-prod` | `production`  | `main`    | `sheet-happens-next`, `Postgres`, bucket `object-storage-prod` | `sheet.example.com`               |
| `sheet-happens-dev`  | `development` | `develop` | `sheet-happens-next`, `Postgres`, bucket `object-storage`      | `<service>-<environment>.up.railway.app` |

`sheet-happens-prod` was the original shared project (named `SheetHappens` until 2026-08-04), so it
still contains a leftover `development` environment. That environment is **dormant**: its deploy
trigger was deleted, so it no longer tracks `develop`, and its generated domain was renamed to
`<service>-<environment>.up.railway.app`. Its database and variables are intact, and it exists only
as a rollback target for the split. Once `sheet-happens-dev` has proven itself, deleting that
environment finishes the separation — production itself does not need to move anywhere.

Each project should keep one persistent environment. Stage differences live in project-scoped
variables and the branch the service tracks, not in per-environment overrides.

Renaming a project is safe and touches nothing else: the project ID is what deploy triggers, the
GitHub integration, dashboard URLs and `railway link` all key off, generated domains are
`<service>-<environment>.up.railway.app` with no project name in them, and `RAILWAY_PROJECT_NAME` is
computed at deploy time rather than stored, so no redeploy is triggered. Only docs need updating.

## PR environments

Opening a pull request creates an ephemeral environment, forked from the project's base environment
and deleted when the PR merges or closes.

**Previews come from `sheet-happens-dev` only.** It has `prDeploys: true`,
`focusedPrEnvironments: true`, `botPrEnvironments: false` (no previews for bot PRs), and
`baseEnvironmentId` pointing at its `development` environment — so a PR into `develop` gets a preview
forked from live dev. `sheet-happens-prod` has `prDeploys: false` deliberately: its only deploy trigger is
`main`, and its base environment is the dormant `development` one whose `BETTER_AUTH_URL` and
`NEXT_PUBLIC_APP_URL` still name the hostname the new project now serves, so anything forked from it
would come up with the wrong auth URLs. Disabling it also rules out a duplicate preview per PR.

That last point matters because Railway's docs do not say whether previews are scoped by the PR's
base branch or by "a service in this project is connected to the PR's repo" — and both projects'
services are connected to the same repo. Keep previews enabled in exactly one project.

This is a **project-level setting that connecting the repo does not imply** — a fresh project has
`prDeploys: false` and silently creates no previews. It is not visible in `railway status`; check it
explicitly:

```bash
railway api 'query($id: String!) { project(id: $id) {
  prDeploys botPrEnvironments focusedPrEnvironments baseEnvironmentId } }' --raw-var id=<project-id>
```

A PR environment forks the base environment's services and volumes, so each open PR carries its own
copy of the dev database. Google sign-in and passkeys do **not** work in a PR environment — its
hostname is per-PR, so it matches neither the registered Google redirect URI nor a passkey's RP ID.
Use email/password or magic-link sign-in there.

## Reprovisioning

`scripts/railway/provision-dev-project.sh` performs the whole split, one re-runnable step at a time
(`export_source`, `create_project`, … , `cutover`; run it with no arguments to list them). It is the
executable record of how `sheet-happens-dev` was built, and the template for standing up any further
environment as its own project. It never writes secrets into command arguments — variable values move
through mode-600 files and are piped into `railway variable set --stdin`.

## Constraints worth knowing

**A Postgres 18 client is mandatory, and it lives in Docker.** Railway's Postgres is 18.x; a 17.x
`pg_dump` refuses to dump from it and `pg_restore` refuses its archives. Rather than requiring
`postgresql@18` on every machine, all dump/restore/psql work runs inside `postgres:18-alpine`. Docker
is already a prerequisite for `pnpm db:dev`.

**The deployed databases are private-network only.** Railway no longer provisions a public TCP proxy
with Postgres, and we do not add one permanently. To reach a deployed database from a local tool:

```bash
railway connect Postgres --tunnel-only   # prints host/port for TablePlus, DBeaver, psql, …
```

The provisioning script creates a temporary proxy for the one-off restore and deletes it again,
because a container cannot reach a tunnel bound to host loopback.

**The app connects over the private network.** `DATABASE_URL` is the reference
`${{Postgres.DATABASE_URL}}`, which resolves to `postgres.railway.internal`. Pre-deploy commands run
inside the same network, so `prisma migrate deploy` works from there.

**The container listens on 8080, not 3000.** Railway injects `PORT=8080`, which overrides the
Dockerfile's `ENV PORT=3000`, so a domain must route to 8080. Railway-generated domains left with no
explicit target port auto-detect it correctly; if you pin a port, pin 8080 or the domain answers 502.

**Build-time variables.** The Dockerfile takes `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_BETTER_AUTH_URL` as build args, and `NEXT_PUBLIC_*` are baked
into the client bundle. Set them **before** the first build, or rebuild after changing them —
changing the variable alone does not change an already-built bundle.

**`BETTER_AUTH_SECRET` is load-bearing across a database copy.** Sessions in the database are signed
with it and stored Google OAuth tokens are encrypted with it (`encryptOAuthTokens: true`,
`src/server/auth/auth.ts`). Copy it byte-for-byte or every restored session and linked Google account
breaks.

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

In `sheet-happens-prod` one service is shared between the `production` and `development` environments, with
a separate deploy trigger per environment. `railway service source disconnect` is too blunt there —
delete just the trigger:

```bash
railway api 'query($id: String!) { project(id: $id) { deploymentTriggers { edges { node
  { id branch environmentId } } } } }' --raw-var id=<project-id>
railway api 'mutation($id: String!) { deploymentTriggerDelete(id: $id) }' --raw-var id=<trigger-id>
```

Always re-query afterwards and confirm production's trigger is still there.

## Why not Infrastructure as Code (yet)

Railway has two code-based configuration systems: config as code (`railway.json`, read during
deploy) and Infrastructure as Code (`.railway/railway.ts`, applied by `railway config apply`).
**A service cannot be managed by both**, and `railway config plan` refuses to run while a service is
still managed by `railway.json`.

This repo's `railway.json` is what gives every environment its Dockerfile builder,
`preDeployCommand` (`prisma migrate deploy` + `railway:bootstrap-admin`), healthcheck and restart
policy — production included. Adopting IaC therefore means deleting `railway.json` and re-declaring
production's deploy settings in the same change, on a feature Railway still labels experimental. That
is a bigger blast radius than the dev/prod split needed, so it was deliberately deferred.

The DSL does cover everything this repo needs, so the follow-up is mechanical when we want it:
`builder: "DOCKERFILE"`, `dockerfilePath`, `preDeployCommand`, `healthcheckPath`,
`healthcheckTimeout`, `restartPolicyType`/`restartPolicyMaxRetries`, `watchPatterns`, `region`, plus
`database(name, "postgres", { image })` to pin the Postgres image and `bucket(name, { region })`.
Adopting it means: `railway config pull --force`, translate `railway.json`, delete `railway.json`,
clear any custom config-file path in service settings, `railway config plan`, then
`railway config apply` — one project at a time.
