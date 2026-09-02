import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    /** `<html>`'s class at the moment the first paintable element lands in `<body>`. */
    __themeClassAtFirstPaintableElement: string | null;
  }
}

/**
 * Body children that never paint, so seeing one says nothing about a flash. Next.js emits a
 * `<div hidden>` streaming placeholder as the very first child, ahead of the theme script.
 */
const paintableBodyChild = ":scope > *:not(script, template, link, style, [hidden])";

/**
 * Seeds the locale cookie plus an optional stored theme, and records the `<html>` class at the
 * instant the first paintable element is parsed into `<body>`. next-themes' blocking script is
 * rendered as the provider's first child, so a correct setup has already rewritten the class by
 * then — this is what fails if the provider ever moves below the page content.
 */
async function watchInitialThemeClass(page: import("@playwright/test").Page, storedTheme?: string) {
  await page.addInitScript(
    ({ theme, selector }: { theme?: string; selector: string }) => {
      document.cookie = "sheet-happens-locale=en; Path=/; SameSite=Lax";

      // Never clear the key: this runs again on reload, and each test already starts from a fresh
      // context with empty storage.
      if (theme) localStorage.setItem("theme", theme);

      window.__themeClassAtFirstPaintableElement = null;

      new MutationObserver(() => {
        if (window.__themeClassAtFirstPaintableElement !== null) return;
        if (!document.body?.querySelector(selector)) return;

        window.__themeClassAtFirstPaintableElement = document.documentElement.className;
        // `document` rather than `documentElement`: init scripts run before the parser has created
        // the root element.
      }).observe(document, { childList: true, subtree: true });
    },
    { theme: storedTheme, selector: paintableBodyChild },
  );
}

function initialThemeClass(page: import("@playwright/test").Page) {
  return page.evaluate(() => window.__themeClassAtFirstPaintableElement);
}

test.describe("theme preference", () => {
  test("applies a stored light preference before any app markup is parsed", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await watchInitialThemeClass(page, "light");

    await page.goto("/login");

    expect(await initialThemeClass(page)).toBe("light");
    await expect(page.locator("html")).toHaveClass("light");
  });

  test("follows a dark operating system when nothing is stored", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await watchInitialThemeClass(page);

    await page.goto("/login");

    expect(await initialThemeClass(page)).toBe("dark");
    await expect(page.locator("html")).toHaveClass("dark");
  });

  test("follows a light operating system when nothing is stored", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await watchInitialThemeClass(page);

    await page.goto("/login");

    expect(await initialThemeClass(page)).toBe("light");
    await expect(page.locator("html")).toHaveClass("light");
  });

  test("persists a choice made from the auth screen across a reload", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await watchInitialThemeClass(page);

    await page.goto("/login");
    await expect(page.locator("html")).toHaveClass("dark");

    await page.getByRole("button", { name: "Theme" }).click();
    await page.getByRole("menuitemradio", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveClass("light");

    await page.reload();

    expect(await initialThemeClass(page)).toBe("light");
    await expect(page.locator("html")).toHaveClass("light");
  });
});
