import { fn } from "storybook/test";

import { isSupportedLocale } from "@/src/i18n/locales";
import type { SetLocaleActionState } from "@/src/i18n/actions";

export type { SetLocaleActionState };

/**
 * Storybook mock for the `"use server"` module.
 *
 * `@storybook/nextjs-vite` uses the Vite builder, which has no `"use server"` transform, so without
 * this redirect Vite follows the real module into `@prisma/adapter-pg` → `pg` → `postgres-bytea`
 * and the story dies on a bare `Buffer`. A plain `sb.mock()` automock is not enough: automocked
 * modules are still evaluated along with their dependencies. A `__mocks__` file replaces resolution
 * outright, so the real module never loads.
 *
 * Registered in `.storybook/preview.tsx`.
 *
 * Imports here must use the `@/` alias: Storybook serves this content under the *original* module's
 * path (`src/i18n/actions.ts`), so a relative specifier would resolve from the wrong directory.
 */
export const setLocaleAction = fn(async (locale: string): Promise<SetLocaleActionState> =>
  isSupportedLocale(locale)
    ? { status: "success", locale }
    : { status: "error", message: "Unsupported language." },
).mockName("setLocaleAction");
