import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    // Route handlers live in `app/`, so their colocated tests cannot sit under `src/`. Next
    // treats only `route`/`page` basenames as routable, so a `route.test.ts` beside a handler is
    // never served.
    include: ["src/**/*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}"],
    // `*.browser.test.ts` matches the includes above but belongs to `pnpm test:browser`; without
    // this it would also run here in jsdom, where the browser APIs it tests do not exist.
    exclude: [...configDefaults.exclude, "**/*.browser.{test,spec}.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
