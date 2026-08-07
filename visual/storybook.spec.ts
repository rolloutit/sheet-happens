import { expect, test, type Page } from "@playwright/test";

type VisualProject = "desktop" | "mobile";

type StoryVisualCase = {
  id: string;
  slug: string;
  theme: "dark" | "light";
  locale: "en" | "hu";
  projects?: VisualProject[];
  prepare?: (page: Page) => Promise<void>;
};

const storyCases: StoryVisualCase[] = [
  {
    id: "ui-button--variants",
    slug: "button-variants-dark",
    theme: "dark",
    locale: "en",
  },
  {
    id: "ui-field--error",
    slug: "field-error-light",
    theme: "light",
    locale: "en",
  },
  {
    id: "sheet-weeklytimegrid--cell-states",
    slug: "weekly-grid-cell-states-light",
    theme: "light",
    locale: "hu",
  },
  {
    id: "sheet-dashboardcards--data-driven-admin",
    slug: "dashboard-admin-dark",
    theme: "dark",
    locale: "hu",
  },
  {
    id: "layout-appshell--foundation-page",
    slug: "app-shell-desktop-dark",
    theme: "dark",
    locale: "hu",
    projects: ["desktop"],
  },
  {
    id: "layout-atmosphere--over-canvas",
    slug: "atmosphere-over-canvas-dark",
    theme: "dark",
    locale: "en",
    projects: ["desktop"],
  },
  {
    id: "layout-appshell--mobile-navigation",
    slug: "app-shell-mobile-drawer-dark",
    theme: "dark",
    locale: "hu",
    projects: ["mobile"],
    prepare: async (page) => {
      await page.getByRole("button", { name: /navigáció megnyitása/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
  {
    id: "layout-commandpill--default",
    slug: "command-pill-dark",
    theme: "dark",
    locale: "en",
  },
  {
    id: "layout-languagetoggle--default",
    slug: "language-toggle-dark",
    theme: "dark",
    locale: "en",
  },
  {
    id: "layout-notificationbutton--unread",
    slug: "notification-menu-dark",
    theme: "dark",
    locale: "en",
    projects: ["desktop"],
    prepare: async (page) => {
      await page.getByRole("button", { name: /notifications/i }).click();
      await expect(page.getByRole("menu")).toBeVisible();
    },
  },
  {
    id: "layout-usermenu--default",
    slug: "user-menu-dark",
    theme: "dark",
    locale: "en",
    projects: ["desktop"],
    prepare: async (page) => {
      await page.getByRole("button", { name: /user menu/i }).click();
      await expect(page.getByRole("menu")).toBeVisible();
    },
  },
  {
    id: "layout-mobilebottombar--default",
    slug: "mobile-bottom-bar-dark",
    theme: "dark",
    locale: "en",
    projects: ["mobile"],
  },
  {
    id: "layout-commandpalette--default",
    slug: "command-palette-dark",
    theme: "dark",
    locale: "en",
    projects: ["desktop"],
    prepare: async (page) => {
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
  {
    id: "sheet-timeentryform--default",
    slug: "time-entry-form-light",
    theme: "light",
    locale: "en",
    projects: ["desktop", "mobile"],
  },
  {
    id: "sheet-daydetailpanel--default",
    slug: "day-detail-panel-dark",
    theme: "dark",
    locale: "en",
    projects: ["desktop"],
  },
  {
    id: "sheet-timebreakdowndialog--default",
    slug: "time-breakdown-dialog-dark",
    theme: "dark",
    locale: "en",
    projects: ["desktop"],
    prepare: async (page) => {
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
  {
    id: "sheet-pdfviewer--ready",
    slug: "pdf-viewer-light",
    theme: "light",
    locale: "en",
    projects: ["desktop"],
  },
  {
    id: "sheet-chartprimitives--trend",
    slug: "chart-primitives-trend-dark",
    theme: "dark",
    locale: "en",
    projects: ["desktop"],
  },
  {
    id: "sheet-infopageeditor--default",
    slug: "info-page-editor-light",
    theme: "light",
    locale: "en",
    projects: ["desktop"],
  },
];

async function openStory(page: Page, story: StoryVisualCase) {
  const globals = new URLSearchParams({
    globals: `theme:${story.theme};locale:${story.locale}`,
  });

  await page.goto(`/iframe.html?id=${story.id}&${globals.toString()}`);
  await page.locator("#storybook-root").waitFor({ state: "visible" });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
}

for (const story of storyCases) {
  test(`${story.slug}`, async ({ page }, testInfo) => {
    const project = testInfo.project.name as VisualProject;
    if (story.projects && !story.projects.includes(project)) {
      test.skip(true, `${story.slug} is scoped to ${story.projects.join(", ")}`);
    }

    await openStory(page, story);
    await story.prepare?.(page);
    await expect(page).toHaveScreenshot(`${story.slug}.png`, {
      fullPage: true,
    });
  });
}
