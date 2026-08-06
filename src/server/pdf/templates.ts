import path from "node:path";

/**
 * Typst templates and fonts are read from disk at render time rather than embedded in the
 * server bundle, so they can be edited as real `.typ` files with Typst tooling.
 *
 * `next.config.ts` traces them into `.next/standalone` via `outputFileTracingIncludes`, and
 * Next's standalone server `chdir()`s into that directory — so `process.cwd()` is the correct
 * anchor in dev, in tests and in production alike.
 *
 * The `TYPST_*_DIR` overrides mirror `TYPST_BIN` and exist as a deployment escape hatch.
 */

export const TYPST_TEMPLATES = ["report", "system-check"] as const;

export type TypstTemplate = (typeof TYPST_TEMPLATES)[number];

export function resolveTypstTemplatesDir() {
  return resolveDir(process.env.TYPST_TEMPLATES_DIR, ["src", "server", "pdf", "templates"]);
}

export function resolveTypstFontsDir() {
  return resolveDir(process.env.TYPST_FONTS_DIR, ["src", "server", "pdf", "fonts"]);
}

function resolveDir(override: string | undefined, segments: string[]) {
  const trimmed = override?.trim();

  return trimmed ? path.resolve(trimmed) : path.join(process.cwd(), ...segments);
}
