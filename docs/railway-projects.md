# Railway projects and environments

How Sheet Happens is deployed, and the constraints that shape it. Read this before touching Railway
projects, environments, domains or the deployed databases.

## Topology

Since 2026-08-04 each stage is its own Railway project, in the `Rollout IT Workspace`:

| Project             | Environment   | Branch    | Services                                                  | URL                                |
| ------------------- | ------------- | --------- | --------------------------------------------------------- | ---------------------------------- |
| `SheetHappens`      | `production`  | `main`    | `sheet-happens-next`, `Postgres`                          | `sheet.example.com`               |
| `sheet-happens-dev` | `development` | `develop` | `sheet-happens-next`, `Postgres`, bucket `object-storage` | `<service>-<environment>.up.railway.app` |

`SheetHappens` still contains a `development` environment. It is **dormant**: its deploy trigger was
removed, so it no longer tracks `develop`, and its generated domain was renamed to
`<service>-<environment>.up.railway.app`. Its database and variables are intact and it exists only
as a rollback target. Production is expected to move out of `SheetHappens` into its own project next;
when that happens the old project — and its dormant dev environment — can be deleted.

Each project keeps one persistent environment. Stage differences live in project-scoped variables and
the branch its service tracks, not in per-environment overrides.

## PR environments

Opening a pull request against the branch a project's service tracks creates an ephemeral
environment, forked from that project's base environment. Both projects have it on:
`prDeploys: true`, `focusedPrEnvironments: true`, `botPrEnvironments: false` (no previews for bot
PRs), with `baseEnvironmentId` pointing at the persistent environment. So PRs into `develop` get a
preview in `sheet-happens-dev`, forked from `development`.

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
executable record of how `sheet-happens-dev` was built, and the starting point for splitting
production off. It never writes secrets into command arguments — variable values move through
mode-600 files and are piped into `railway variable set --stdin`.

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

In `SheetHappens` one service is shared between the `production` and `development` environments, with
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
