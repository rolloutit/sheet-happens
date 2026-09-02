import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveTypstFontsDir, resolveTypstTemplatesDir } from "./templates";
import { renderTypstDocument, renderTypstDocumentPages, TypstRenderError } from "./typst";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe("resolveTypstTemplatesDir", () => {
  it("anchors on the working directory so dev, tests and standalone all agree", () => {
    expect(resolveTypstTemplatesDir()).toBe(
      path.join(process.cwd(), "src", "server", "pdf", "templates"),
    );
    expect(resolveTypstFontsDir()).toBe(path.join(process.cwd(), "src", "server", "pdf", "fonts"));
  });
});

describe("renderTypstDocument", () => {
  it("names the templates directory when it cannot be read", async () => {
    await expect(
      renderTypstDocument(
        { template: "system-check" },
        { templatesDir: "/nonexistent/typst-templates" },
      ),
    ).rejects.toThrow(TypstRenderError);

    await expect(
      renderTypstDocument(
        { template: "system-check" },
        { templatesDir: "/nonexistent/typst-templates" },
      ),
    ).rejects.toThrow(/\/nonexistent\/typst-templates/);
  });

  it.runIf(process.env.RUN_TYPST_SMOKE === "1")("renders the probe template to a PDF", async () => {
    const pdf = await renderTypstDocument({ template: "system-check" }, { timeoutMs: 20_000 });

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it.runIf(process.env.RUN_TYPST_SMOKE === "1")(
    "renders a raster preview of the first page",
    async () => {
      const png = await renderTypstDocument(
        { template: "system-check", format: "png", pages: "1", ppi: 96 },
        { timeoutMs: 20_000 },
      );

      expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
    },
  );
});

describe("renderTypstDocumentPages", () => {
  it("names the templates directory when it cannot be read", async () => {
    await expect(
      renderTypstDocumentPages(
        { template: "system-check", format: "svg" },
        { templatesDir: "/nonexistent/typst-templates" },
      ),
    ).rejects.toThrow(/\/nonexistent\/typst-templates/);
  });

  it.runIf(process.env.RUN_TYPST_SMOKE === "1")(
    "returns every page the document renders to",
    async () => {
      const pages = await renderTypstDocumentPages(
        { template: "system-check", format: "svg" },
        { timeoutMs: 20_000 },
      );

      expect(pages.length).toBeGreaterThanOrEqual(1);

      for (const page of pages) {
        expect(page.toString("utf8")).toMatch(/^<svg/);
      }
    },
  );
});
