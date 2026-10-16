import { describe, expect, it } from "vitest";

import { resolveOrgBranding } from "./branding";

describe("resolveOrgBranding", () => {
  it("shows no organisation when nothing is configured", () => {
    expect(resolveOrgBranding({})).toEqual({ name: null, logo: null, logoDark: null });
  });

  it("treats blank values as unset", () => {
    expect(resolveOrgBranding({ name: "  ", logo: "", logoDark: " " })).toEqual({
      name: null,
      logo: null,
      logoDark: null,
    });
  });

  it("uses the light logo on dark surfaces when no dark one is given", () => {
    expect(resolveOrgBranding({ name: "Acme", logo: "/brand/acme.svg" })).toEqual({
      name: "Acme",
      logo: "/brand/acme.svg",
      logoDark: "/brand/acme.svg",
    });
  });

  it("uses the dark logo on light surfaces when it is the only one", () => {
    expect(resolveOrgBranding({ logoDark: "https://cdn.example/acme-dark.png" })).toMatchObject({
      logo: "https://cdn.example/acme-dark.png",
      logoDark: "https://cdn.example/acme-dark.png",
    });
  });
});
