import { beforeEach, describe, expect, it, vi } from "vitest";

import { localeCookieName } from "./locales";

const cookieValues = new Map<string, string>();
const headerValues = new Map<string, string>();

// The real react-server entry hands the config factory straight back, so the test can call it
// directly. Only the client entry of `next-intl/server` throws, which is what jsdom would load.
vi.mock("next-intl/server", () => ({
  getRequestConfig: (createRequestConfig: unknown) => createRequestConfig,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieValues.get(name);

      return value === undefined ? undefined : { name, value };
    },
  }),
  headers: async () => ({ get: (name: string) => headerValues.get(name) ?? null }),
}));

const { default: resolveRequestConfig } = await import("./request");

function configFor(requestLocale?: string) {
  return resolveRequestConfig({ requestLocale: Promise.resolve(requestLocale) });
}

describe("i18n request config", () => {
  beforeEach(() => {
    cookieValues.clear();
    headerValues.clear();
  });

  /**
   * The report PDF export renders in a language the reader did not pick, via
   * `getTranslations({ locale })`. If the requested locale lost to the cookie, the document's
   * numbers and dates would follow the selection while its labels stayed in the interface language.
   */
  it("lets an explicitly requested locale win over the interface language", async () => {
    cookieValues.set(localeCookieName, "hu");

    const config = await configFor("en");

    expect(config.locale).toBe("en");
    expect(config.messages?.AdminReports).toMatchObject({
      export: expect.objectContaining({ languageLabel: "PDF language" }),
    });
  });

  it("loads the messages of the requested locale, not just its formats", async () => {
    cookieValues.set(localeCookieName, "en");

    const config = await configFor("hu");

    expect(config.locale).toBe("hu");
    expect(config.messages?.AdminReports).toMatchObject({
      export: expect.objectContaining({ languageLabel: "PDF nyelve" }),
    });
  });

  it("falls back to the cookie when nothing is requested", async () => {
    cookieValues.set(localeCookieName, "en");

    expect((await configFor()).locale).toBe("en");
  });

  it("ignores an unsupported requested locale", async () => {
    cookieValues.set(localeCookieName, "en");

    expect((await configFor("de")).locale).toBe("en");
  });

  it("falls back to the accepted languages when there is no cookie", async () => {
    headerValues.set("accept-language", "en-GB,en;q=0.9");

    expect((await configFor()).locale).toBe("en");
  });

  it("falls back to the default locale when nothing matches", async () => {
    headerValues.set("accept-language", "de-DE,de;q=0.9");

    expect((await configFor()).locale).toBe("hu");
  });
});
