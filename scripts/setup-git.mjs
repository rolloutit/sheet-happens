#!/usr/bin/env node

// One-time per clone: `pnpm setup:git`.
//
// Installs the committed pre-push guard and the push defaults that keep a feature
// branch from landing on develop. Everything here is written with `git config --local`,
// so it only ever touches this repository's .git/config — never the developer's
// global or system config.
//
// Deliberately not wired into postinstall: the Dockerfile installs dependencies
// before scripts/ is in the build context, so an install hook would break the image.

import { execFileSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const hooksPath = "scripts/githooks";
const hookFile = join(rootDir, hooksPath, "pre-push");

const settings = [
  ["core.hooksPath", hooksPath, "run the committed pre-push guard"],
  ["branch.autoSetupMerge", "simple", "only track a remote branch that has the same name"],
  ["push.default", "current", "push to the same-named remote branch, whatever the upstream says"],
  ["push.autoSetupRemote", "true", "record the upstream on the first push of a branch"],
];

main();

function main() {
  if (!isInsideWorkTree()) {
    console.log("Not inside a git work tree — skipping git setup.");
    return;
  }

  console.log("Configuring git for this repository (local scope only):");
  for (const [key, value, why] of settings) {
    git(["config", "--local", key, value]);
    console.log(`  ${key} = ${value}  — ${why}`);
  }

  console.log("");
  checkHook();
  reportMistrackedBranches();

  console.log("");
  console.log("Feature branches now push to a remote branch of their own name.");
  console.log("Pushing one onto develop or main is refused by scripts/githooks/pre-push.");
}

function checkHook() {
  try {
    accessSync(hookFile, constants.X_OK);
  } catch {
    console.log(`WARNING: ${hooksPath}/pre-push is missing or not executable.`);
    console.log(`  Fix with: chmod +x ${hooksPath}/pre-push`);
    console.log("  Until then, nothing blocks a push to the wrong branch.");
    return;
  }
  console.log(`Pre-push guard active: ${hooksPath}/pre-push`);
}

// Report, never rewrite. A branch whose upstream points at a differently-named remote
// branch is the exact defect this script exists to prevent, but unsetting it is the
// developer's call — it changes what `git status` and `git pull` do on that branch.
function reportMistrackedBranches() {
  const format = "%(refname:short)%09%(upstream)%09%(upstream:remotename)";
  const rows = git(["for-each-ref", `--format=${format}`, "refs/heads"])
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));

  const mistracked = rows.filter(([branch, upstream, remote]) => {
    if (!upstream || !remote) return false;
    return upstream !== `refs/remotes/${remote}/${branch}`;
  });

  if (mistracked.length === 0) return;

  console.log("");
  console.log("These branches track a remote branch with a different name:");
  for (const [branch, upstream] of mistracked) {
    console.log(`  ${branch} -> ${upstream}`);
  }
  console.log("");
  console.log("A push from one of them is what puts feature commits on the wrong branch.");
  console.log("Clear the upstream (local change only, re-set correctly on the next push -u):");
  for (const [branch] of mistracked) {
    console.log(`  git branch --unset-upstream ${branch}`);
  }
}

function isInsideWorkTree() {
  try {
    return git(["rev-parse", "--is-inside-work-tree"]) === "true";
  } catch {
    return false;
  }
}

function git(args) {
  return execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
