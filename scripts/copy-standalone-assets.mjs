import { cp, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");

if (!(await exists(standaloneDir))) {
  console.warn("[standalone-assets] .next/standalone does not exist; skipping asset copy.");
  process.exit(0);
}

await copyIfExists(path.join(root, "public"), path.join(standaloneDir, "public"));
await copyIfExists(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"));

async function copyIfExists(from, to) {
  if (!(await exists(from))) {
    return;
  }

  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true, force: true });
  console.info(`[standalone-assets] copied ${path.relative(root, from)}.`);
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}
