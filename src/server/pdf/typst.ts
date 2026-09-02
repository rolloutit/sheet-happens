import { execFile } from "node:child_process";
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { resolveTypstFontsDir, resolveTypstTemplatesDir, type TypstTemplate } from "./templates";

const execFileAsync = promisify(execFile);
const DEFAULT_TYPST_TIMEOUT_MS = 15_000;
const DATA_FILENAME = "data.json";

export type TypstOutputFormat = "pdf" | "png" | "svg";

export type RenderTypstDocumentInput = {
  template: TypstTemplate;
  /**
   * Written to `data.json` in the compile root and read by the template via `json("/data.json")`.
   *
   * Deliberately a file rather than `--input`/`sys.inputs`: those values ride on argv, and Linux
   * caps a single argument at 128 KB, which a report with a few hundred lines exceeds.
   */
  data?: unknown;
  filename?: string;
  /** Defaults to `pdf`. `png` powers export previews. */
  format?: TypstOutputFormat;
  /** Page selection, e.g. `"1"` for a preview thumbnail. All pages when omitted. */
  pages?: string;
  /** PNG only; Typst defaults to 144. */
  ppi?: number;
};

export type RenderTypstDocumentDeps = {
  typstBin?: string;
  timeoutMs?: number;
  templatesDir?: string;
  fontsDir?: string;
};

export class TypstRenderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TypstRenderError";
  }
}

export async function renderTypstDocument(
  input: RenderTypstDocumentInput,
  deps: RenderTypstDocumentDeps = {},
): Promise<Buffer> {
  const outputs = await compileTypstDocument(input, deps);

  return outputs[0];
}

/**
 * Every rendered page rather than only the first, for the export preview. PDF output is a single
 * file, so this is raster/vector formats only.
 */
export async function renderTypstDocumentPages(
  input: RenderTypstDocumentInput & { format: Exclude<TypstOutputFormat, "pdf"> },
  deps: RenderTypstDocumentDeps = {},
): Promise<Buffer[]> {
  return await compileTypstDocument(input, deps);
}

async function compileTypstDocument(
  input: RenderTypstDocumentInput,
  deps: RenderTypstDocumentDeps,
): Promise<Buffer[]> {
  const typstBin = deps.typstBin ?? (process.env.TYPST_BIN?.trim() || "typst");
  const templatesDir = deps.templatesDir ?? resolveTypstTemplatesDir();
  const fontsDir = deps.fontsDir ?? resolveTypstFontsDir();
  const format = input.format ?? "pdf";
  const workdir = await mkdtemp(path.join(tmpdir(), "sheet-happens-typst-"));
  const basename = sanitizeTypstFilename(input.filename ?? input.template);

  try {
    // The templates are copied per render so the compile root holds nothing but this
    // document's own templates and data, and is removed again below.
    try {
      await cp(templatesDir, workdir, { recursive: true });
    } catch (error) {
      throw new TypstRenderError(
        `Typst templates could not be read from ${templatesDir}. Set TYPST_TEMPLATES_DIR or check that the build included them.`,
        { cause: error },
      );
    }

    if (input.data !== undefined) {
      await writeFile(path.join(workdir, DATA_FILENAME), JSON.stringify(input.data), "utf8");
    }

    await execFileAsync(
      typstBin,
      [
        "compile",
        path.join(workdir, `${input.template}.typ`),
        path.join(workdir, buildOutputPattern(basename, format)),
        "--root",
        workdir,
        "--font-path",
        fontsDir,
        // Renders identically on a dev machine, in Docker and in CI.
        "--ignore-system-fonts",
        "--format",
        format,
        ...(input.pages ? ["--pages", input.pages] : []),
        ...(format === "png" && input.ppi ? ["--ppi", String(input.ppi)] : []),
      ],
      {
        cwd: workdir,
        timeout: deps.timeoutMs ?? DEFAULT_TYPST_TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
      },
    );

    return await readOutputs(workdir, basename, format);
  } catch (error) {
    if (error instanceof TypstRenderError) throw error;

    throw new TypstRenderError(getTypstErrorMessage(error, typstBin), { cause: error });
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Typst requires a page-number pattern in the output path whenever the document renders more
 * than one page, so raster output always uses one and the first page is read back by name.
 */
function buildOutputPattern(basename: string, format: TypstOutputFormat) {
  return format === "pdf" ? `${basename}.pdf` : `${basename}-{0p}.${format}`;
}

async function readOutputs(workdir: string, basename: string, format: TypstOutputFormat) {
  if (format === "pdf") {
    return [await readFile(path.join(workdir, `${basename}.pdf`))];
  }

  // `{0p}` pads to the page count, so the emitted name is only known after compiling. The padding
  // is what makes a plain string sort put page 2 before page 10.
  const entries = await readdir(workdir);
  const outputs = entries
    .filter((entry) => entry.startsWith(`${basename}-`) && entry.endsWith(`.${format}`))
    .sort((left, right) => left.localeCompare(right, "en"));

  if (outputs.length === 0) {
    throw new TypstRenderError(`Typst produced no ${format.toUpperCase()} output.`);
  }

  return await Promise.all(outputs.map((output) => readFile(path.join(workdir, output))));
}

function getTypstErrorMessage(error: unknown, typstBin: string) {
  if (isNodeError(error) && error.code === "ENOENT") {
    return `Typst binary not found. Install Typst or set TYPST_BIN. Current binary: ${typstBin}`;
  }

  const details = getProcessErrorOutput(error);
  return details ? `Typst failed to render the PDF. ${details}` : "Typst failed to render the PDF.";
}

function getProcessErrorOutput(error: unknown) {
  const processError = error as {
    stderr?: string | Buffer;
    stdout?: string | Buffer;
    message?: string;
  };
  const stderr = processError.stderr?.toString().trim();
  const stdout = processError.stdout?.toString().trim();

  return stderr || stdout || processError.message || "";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function sanitizeTypstFilename(filename: string) {
  return (
    filename
      .trim()
      .replaceAll(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/\.pdf$/i, "") || "report"
  );
}
