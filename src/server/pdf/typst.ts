import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_TYPST_TIMEOUT_MS = 15_000;

export type RenderTypstPdfInput = {
  source: string;
  filename?: string;
};

export type RenderTypstPdfDeps = {
  typstBin?: string;
  timeoutMs?: number;
};

export class TypstRenderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TypstRenderError";
  }
}

export async function renderTypstPdf(
  input: RenderTypstPdfInput,
  deps: RenderTypstPdfDeps = {},
): Promise<Buffer> {
  const typstBin = deps.typstBin ?? (process.env.TYPST_BIN?.trim() || "typst");
  const workdir = await mkdtemp(path.join(tmpdir(), "sheet-happens-typst-"));
  const basename = sanitizeTypstFilename(input.filename ?? "report");
  const sourcePath = path.join(workdir, `${basename}.typ`);
  const outputPath = path.join(workdir, `${basename}.pdf`);

  try {
    await writeFile(sourcePath, input.source, "utf8");
    await execFileAsync(typstBin, ["compile", sourcePath, outputPath], {
      cwd: workdir,
      timeout: deps.timeoutMs ?? DEFAULT_TYPST_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });

    return await readFile(outputPath);
  } catch (error) {
    throw new TypstRenderError(getTypstErrorMessage(error, typstBin), { cause: error });
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
  }
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
