# Commit message examples

Real subjects from this repo's history, plus how features get split. Match this style exactly.

## Contents

- Subject-only commits (the default)
- How a feature is split across commits
- When to add a body
- Branch and PR naming
- What not to write

## Subject-only commits (the default)

```
feat(help): add shared markdown article renderer
feat(reports): add time report snapshot service
feat(timesheets): add contractor invoice upload UI
feat(projects): add URL-backed directory filters
fix(layout): support sidebar collapse
fix(time): show entry save errors in modal
fix(deploy): remove inline hostname assignment
fix(reports): add Docker PDF font fallback
chore(deploy): use Dockerfile builds on Railway
chore(deps): add S3 SDK and pin TypeScript
chore(i18n): add timesheet and rate repair copy
docs(qa): add report PDF export checks
docs(i18n): document bilingual copy requirements
test(projects): cover directory filters
refactor(auth): align auth flows with branded shell
style(scripts): apply prettier formatting
```

## How a feature is split across commits

Timesheet submission shipped as four commits on one branch — domain service, UI flow, i18n copy,
then manual QA coverage:

```
feat(timesheets): add submission snapshot service
feat(timesheets): add contractor submit flow
chore(i18n): add timesheet and rate repair copy
docs(qa): add timesheet submission checks
```

Reporting shipped the same way, with deployment plumbing kept separate from the feature:

```
feat(reports): add time report snapshot service
feat(reports): add admin reports dashboard
feat(reports): add Typst PDF exports
docs(qa): add report PDF export checks
chore(deploy): add Typst Docker runtime
chore(deploy): use Dockerfile builds on Railway
fix(reports): add Docker PDF font fallback
```

Rule of thumb: server/domain code, UI, translations, QA docs, and deployment config are separate
commits even when they land in the same PR.

## When to add a body

Add a body only when the diff does not explain the reason. Wrap at 72 columns, blank line after the
subject.

Input: replaced invoice PDFs were silently overwriting the previous upload, which broke the audit
trail, so a cancellation step is now required first.

```
feat(timesheets): require cancellation before invoice replacement

Replacing an uploaded invoice destroyed the previous document and left the
audit log without a reason for the change. Admins now cancel the current
invoice explicitly, which records who cancelled it and why, before a
replacement can be uploaded.
```

Input: refreshed visual baselines because the sidebar collapse animation changed on purpose.

```
fix(layout): support sidebar collapse

Refreshed the checked-in Playwright baselines; the collapsed-rail width
change is intentional.
```

## Branch and PR naming

```
feature/timesheet
feature/report-pdf-export
fix/sidebar-collapse
docs/qa-invoice-scenarios
```

PR titles read like the lead commit subject ("Help page", "Reporting", "Admin deployment checks" are
the short titles the maintainer put in the merge body). Merge commits on `develop` are
`merge: #<PR>`; release merges into `main` are `merge: #<PR> - release`.

## What not to write

```
update files                          # no type, no scope, says nothing
Feat(Reports): Added PDF Export.      # wrong case, past tense, trailing period
feat: stuff                           # missing scope, vague subject
feat(src/server/reports/pdf.ts): …    # scope is a feature area, not a path
feat(reports): add pdf export and fix sidebar and update deps   # split it
wip                                   # never commit a placeholder subject
```
