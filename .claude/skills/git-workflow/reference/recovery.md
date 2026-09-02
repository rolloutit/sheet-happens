# Git repair and recovery

Only for commits that are **local only** — verify with `git log --oneline origin/develop..HEAD`
first. Anything reachable from `origin/*` must be fixed with a new commit instead.

Commands marked **destructive** discard work that git cannot recover. Show the developer what would
be lost and get explicit confirmation before running one.

## Contents

- Before anything: capture the current state
- Fix the last commit message
- Add a forgotten file to the last commit
- Undo the last commit, keep the changes
- Split one commit into several
- Reorder, squash, or drop local commits
- Unstage without losing changes
- Discard changes to one file (destructive)
- Move commits to the right branch
- Feature commits already pushed to develop
- Find a lost commit or branch
- Abort a rebase or merge in progress
- Recover a dropped stash

## Before anything: capture the current state

```bash
git status --short
git branch --show-current
git log --oneline -10
git stash list
```

If uncommitted work is at risk, snapshot it first — this is always safe and always reversible:

```bash
git stash push -u -m "safety snapshot before <operation>"
git stash apply          # keeps the stash entry as a backup copy
```

## Fix the last commit message

```bash
git commit --amend -m "feat(reports): add admin reports dashboard"
```

## Add a forgotten file to the last commit

```bash
git add path/to/file
git commit --amend --no-edit
```

## Undo the last commit, keep the changes

```bash
git reset --soft HEAD~1     # changes stay staged
git reset HEAD~1            # changes stay in the working tree, unstaged
```

`git reset --hard HEAD~1` also throws away the changes — **destructive**, needs confirmation.

## Split one commit into several

```bash
git reset HEAD~1                       # commit's changes return to the working tree
git add src/server/reports             # stage one logical slice
git commit -m "feat(reports): add time report snapshot service"
git add src/components/sheet/Reports
git commit -m "feat(reports): add admin reports dashboard"
```

Use `git add -p <path>` when one file contains two logical changes.

## Reorder, squash, or drop local commits

Interactive rebase is unavailable in this environment (no interactive terminal). Use the
non-interactive equivalents:

```bash
# squash the last 3 local commits into one
git reset --soft HEAD~3
git commit -m "feat(reports): add admin reports dashboard"

# drop the top commit but keep an earlier one: reset and re-commit the slices you want
git reset HEAD~2
```

To remove a single commit from the middle of a local-only branch, rebuild the branch:

```bash
git switch -c feature/topic-clean --no-track origin/develop
git cherry-pick <keep-sha> <keep-sha>
```

## Unstage without losing changes

```bash
git restore --staged path/to/file      # one path
git reset                              # everything
```

## Discard changes to one file (destructive)

```bash
git restore path/to/file               # working tree back to HEAD, changes are gone
```

Show `git diff -- path/to/file` to the developer and confirm before running it.

## Move commits to the right branch

Committed on `develop` by mistake, nothing pushed:

```bash
git branch feature/<topic>             # bookmark the commits
git reset --hard origin/develop        # destructive for develop's local state: confirm first
git switch feature/<topic>
```

Committed on the wrong feature branch:

```bash
git switch -c feature/<right-topic> --no-track origin/develop
git cherry-pick <sha>
git switch feature/<wrong-topic>
git reset --hard HEAD~1                # destructive: confirm first
```

## Feature commits already pushed to develop

The commits are now on a branch other people pull, so hard rule 4 applies: do not force-push
`develop` back. Undo it forward, as a reviewable change.

```bash
git fetch origin
git switch -c fix/revert-<topic> --no-track origin/develop
git revert --no-commit <oldest-sha>^..<newest-sha>
git commit -m "fix(<scope>): back out <topic> from develop"
```

PR that into `develop`, and open the original feature branch as its own PR afterwards. A merge
commit inside the range needs `git revert -m 1 <sha>` instead.

Rewinding `develop` with `--force-with-lease` is only on the table when the push is minutes old and
every other developer has confirmed they have not fetched it. That is the developer's call to make,
never yours.

## Find a lost commit or branch

The reflog keeps unreachable commits for ~90 days:

```bash
git reflog -30                         # every HEAD position, newest first
git reflog show feature/<topic>        # one branch's history
git show <sha>                         # confirm it is the right commit
git branch recovered-work <sha>        # give it a name again
```

Also useful when nothing is in the reflog:

```bash
git fsck --lost-found
```

## Abort a rebase or merge in progress

```bash
git rebase --abort
git merge --abort
git cherry-pick --abort
```

`git status` names the operation in progress and the next step when you are unsure what state the
repo is in.

## Recover a dropped stash

```bash
git fsck --unreachable | grep commit
git show <sha>
git stash apply <sha>
```
