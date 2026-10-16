import { existsSync } from "node:fs";
import path from "node:path";

/** The raster and vector formats Typst's `image()` reads. */
const LOGO_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

export type OrgLogoFile = {
  /** Absolute path on disk. */
  source: string;
  /** Path inside the compile root, with the leading slash `image()` wants. */
  target: string;
};

/**
 * The organisation logo for PDF letterheads, from `ORG_LOGO_PDF_PATH` (absolute, or relative to the
 * server's working directory). Read from the filesystem at render time rather than through the
 * `NEXT_PUBLIC_ORG_LOGO` URL, because Typst can only read files inside its compile root and the
 * on-screen logo may be a remote URL. Returns null — no mark in the PDF — when it is unset, has an
 * unsupported extension or does not exist, so a typo degrades to the default instead of failing
 * every export.
 */
export function resolveOrgLogoFile(env: Record<string, string | undefined> = process.env) {
  const configured = env.ORG_LOGO_PDF_PATH?.trim();

  if (!configured) {
    return null;
  }

  const source = path.resolve(configured);
  const extension = path.extname(source).toLowerCase();

  if (!LOGO_EXTENSIONS.has(extension) || !existsSync(source)) {
    return null;
  }

  return { source, target: `/org-logo${extension}` } satisfies OrgLogoFile;
}
