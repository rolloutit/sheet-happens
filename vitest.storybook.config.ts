import path from "node:path";
import { fileURLToPath } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const dirname =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        plugins: [storybookTest({ configDir: path.join(dirname, ".storybook") })],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            /**
             * The width the stories are asserted at, stated rather than inherited.
             *
             * Every interaction story here drives the desktop layout, and several reach controls
             * Tailwind hides below `sm` — the Pager's numbered buttons, a table's sort headers, the
             * language toggle. Which viewport a headless run gets has been the provider's business
             * so far: `@vitest/browser-playwright` 4 nulls it when `browser.ui` is on and otherwise
             * leaves Playwright's 1280x720 default, so this line changes nothing today. Version 5
             * starts honouring `browser.viewport`, whose own default is phone-sized, and without
             * this those stories fail with "unable to find" on controls that are merely behind a
             * breakpoint. Declaring it keeps the answer the same in both.
             *
             * A story that wants a narrow viewport should say so itself rather than rely on this.
             */
            viewport: { width: 1280, height: 800 },
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
