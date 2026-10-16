import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveOrgLogoFile } from "./org-logo";

describe("resolveOrgLogoFile", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "sheet-happens-logo-"));
    await writeFile(path.join(dir, "logo.PNG"), "x");
    await writeFile(path.join(dir, "logo.txt"), "x");
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns null when nothing is configured", () => {
    expect(resolveOrgLogoFile({})).toBeNull();
    expect(resolveOrgLogoFile({ ORG_LOGO_PDF_PATH: "  " })).toBeNull();
  });

  it("maps an existing image to a fixed path in the compile root", () => {
    expect(resolveOrgLogoFile({ ORG_LOGO_PDF_PATH: path.join(dir, "logo.PNG") })).toEqual({
      source: path.join(dir, "logo.PNG"),
      target: "/org-logo.png",
    });
  });

  it("ignores a missing file or an unsupported extension", () => {
    expect(resolveOrgLogoFile({ ORG_LOGO_PDF_PATH: path.join(dir, "nope.png") })).toBeNull();
    expect(resolveOrgLogoFile({ ORG_LOGO_PDF_PATH: path.join(dir, "logo.txt") })).toBeNull();
  });
});
