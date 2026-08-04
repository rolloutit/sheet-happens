---
name: git-workflow
description: Git workflow for this repo — feature branches off develop, Conventional Commit messages, staging and reviewing a diff, integrating develop, PR handoff, and local history repair. Never pushes to a remote.
when_to_use: Use when creating or switching branches, staging changes, writing a commit message, splitting or amending commits, rebasing on develop, resolving conflicts, preparing a pull request, or recovering from a bad git state.
allowed-tools: Bash(git status:*) Bash(git diff:*) Bash(git log:*) Bash(git show:*) Bash(git branch:*) Bash(git rev-parse:*) Bash(git add:*) Bash(git commit:*)
---

# Git workflow

Multi-developer repo: `main` is released code, `develop` is the integration branch, all work happens
on short-lived feature branches merged into `develop` through GitHub pull requests.

## Hard rules

These are standing rules for the whole session, not one-time steps.

1. **NEVER push.** No `git push`, no force push, nothing that writes to `origin` — including
   `gh pr create`, `gh pr merge`, and `git remote set-url`. Work ends at a local commit; print the
   push and PR commands and let the developer run them. (`git push` is also denied in
   `.claude/settings.json`.)
2. **Commit only when the developer asks.** Staging and committing locally is allowed; deciding on
   your own that work is "ready to commit" is not.
3. **Never commit on `develop` or `main`.** Check `git branch --show-current` first; if you are on
   either, create a feature branch before staging anything.
4. **Never rewrite history that exists on `origin`.** Amend, rebase, reset, and squash are for
   commits that are local only. Verify with
   `git log --oneline origin/develop..HEAD` — only those commits are yours to rewrite.
5. **Never run a destructive command on unreviewed working-tree changes** — `git reset --hard`,
   `git checkout -- .`, `git clean -fd`, `git stash drop`. Show the developer what would be lost and
   get explicit confirmation first.
6. **Never stage secrets or noise**: `.env`, `.env*.local`, `src/server/db/generated/`,
   `playwright-report/`, `test-results/`, `storybook-static/`, `coverage/`, `*.log`. Stage explicit
   paths rather than `git add -A`, and read `git diff --cached` before committing.
7. **No merge commits from the local side.** Merging into `develop` happens in the GitHub PR.

## Branch model

| Branch            | Role                                                    |
| ----------------- | ------------------------------------------------------- |
| `main`            | Released. Only receives release PRs from `develop`.     |
| `develop`         | Integration. Feature PRs merge here.                    |
| `feature/<topic>` | Your work. Also `fix/`, `chore/`, `docs/`, `refactor/`. |

Branch names are lowercase kebab-case after the prefix, scoped to one deliverable:
`feature/timesheet`, `fix/sidebar-collapse`, `docs/qa-report-exports`.

Start a branch from up-to-date `develop`:

```bash
git fetch origin                                  # read-only, allowed
git switch -c feature/<topic> origin/develop
```

If the developer already has uncommitted work on the wrong branch, carry it over with
`git stash push -m "wip"` → `git switch -c …` → `git stash pop` rather than committing it in place.

## Commit messages

Conventional Commits, matching the existing history:

```
type(scope): imperative subject
```

- **Types**: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`.
- **Scope** is the feature area, never a file path: `timesheets`, `reports`, `rates`, `projects`,
  `project-groups`, `time`, `auth`, `layout`, `shell`, `ui`, `i18n`, `settings`, `system`,
  `storage`, `deploy`, `deps`, `dev`, `qa` (with `docs`).
- Subject: imperative mood, lowercase after the colon, no trailing period, ≤ 72 characters.
- Body: this repo ships subject-only commits by default. Add a body only when the _why_ is not
  obvious from the diff; wrap at 72 columns. Keep any assistant attribution trailers your session
  requires last, after a blank line.

See `reference/commit-examples.md` for real examples from this repo's history, including how a
feature is split across commits.

**One logical change per commit.** The established pattern for a feature is a sequence:
service/domain layer → UI → i18n copy → `docs(qa):` manual test coverage. If a diff needs "and" to
describe it, split it with `git add <paths>` per commit.

## Standard flow

Copy this checklist and tick items off:

```
- [ ] 1. Inspect state: git status --short, git branch --show-current
- [ ] 2. On a feature branch off origin/develop (create one if not)
- [ ] 3. Implement, then run the gates the change touches
- [ ] 4. Stage explicit paths, read git diff --cached
- [ ] 5. Commit with a Conventional Commit subject
- [ ] 6. Report branch + commits, hand push/PR to the developer
```

Step 3 gates, matched to the change (full chain is `pnpm ci`):

- any code: `pnpm typecheck` · `pnpm lint` · `pnpm format`
- logic under `src/`: `pnpm test`
- component or story changes: `pnpm test-storybook`, and `pnpm test:visual` if visuals moved
- route or flow changes: `pnpm e2e`

Step 6 output — give the developer exactly this, do not run it:

```bash
git push -u origin <branch>
gh pr create --base develop --title "<subject>" --body "<what changed, why, how to test>"
```

PR body: what changed, why, how to verify. Link the `docs/manual-qa-test-plan.md` scenarios for
user-visible changes. Maintainers merge with the repo's `merge: #<PR>` subject and a short title in
the body; release PRs into `main` use `merge: #<PR> - release`.

## Integrating develop

Rebase while the branch is local-only; merge once it has been pushed and others may have it:

```bash
git fetch origin
git rebase origin/develop      # local-only branch
git merge origin/develop       # branch already on origin
```

On conflict: resolve, re-run the affected gates, `git add <paths>`, `git rebase --continue`. Bail out
with `git rebase --abort` (or `git merge --abort`) — never resolve by taking a whole side blindly on
`messages/*.json` or Prisma migrations, where both sides usually need to survive.

Prisma migrations conflict by directory name. Two branches that both added migrations need the newer
one regenerated after rebasing, not hand-edited.

## Repair and recovery

Undo a commit, amend, split, unstage, restore a file, find a lost commit: see
`reference/recovery.md`. Read it before running anything with `reset`, `restore`, or `reflog` —
confirm the destructive variants with the developer first.

## Inspecting history

```bash
git log --oneline -20                      # recent work
git log --oneline origin/develop..HEAD     # commits that are yours to rewrite
git log --first-parent --oneline develop   # integration history (merge: #N)
git log -p --follow -- <path>              # how one file evolved
git log --oneline -S"<symbol>"             # when a symbol appeared or vanished
git diff origin/develop...HEAD --stat      # full branch diff, ignoring develop's moves
```
