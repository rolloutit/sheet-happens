# Security policy

## Supported versions

Only the latest `main` is supported. Fixes are not backported to older commits or tags.

## Reporting a vulnerability

**Please do not report security problems in public issues, discussions, or pull requests.**

Use GitHub private vulnerability reporting instead:
[Report a vulnerability](https://github.com/rolloutit/sheet-happens/security/advisories/new).
Only the maintainers can see the report.

Helpful things to include: what you found, the affected version or commit, steps to reproduce, and
the impact you expect. A proof of concept is welcome but not required.

## What to expect

We aim to respond within 5 working days, to keep you informed while we investigate, and to credit
you in the advisory if you want that. This is a small team, so these are goals rather than a
service-level agreement.

## Scope

- Sheet Happens is self-hosted. The security of a deployment (hosting, network, TLS, secrets,
  backups, updates, access control) is the responsibility of whoever operates it. Reports about a
  misconfigured instance are out of scope.
- Authentication (magic link, passkeys, OAuth) is built on [Better Auth](https://www.better-auth.com).
  Vulnerabilities in Better Auth itself should be reported to that project; tell us as well if
  Sheet Happens is affected by how it uses it.
- Never include real customer or employee data in a report.
