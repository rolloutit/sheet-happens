# Frontend Stack

This repo implements the approved frontend foundation for Sheet Happens.

## Stack

- Next.js App Router with React Server Components.
- React 19 and TypeScript strict mode.
- Tailwind CSS v4 with CSS variables as the token source.
- shadcn/ui conventions with owned component source.
- Radix UI for accessible interactive primitives.
- next-themes for the light / dark / system theme preference (system by default).
- next-intl for HU/EN-ready app text and Intl formatting.
- react-hook-form and Zod for rich forms and shared validation.
- TanStack Table for server-side admin tables.
- Recharts for dashboard and report visualizations.
- Storybook 10 with `@storybook/nextjs-vite`.
- Vitest, React Testing Library, Vitest Browser Mode, Playwright, and Chromatic-ready visual CI.

## Component boundaries

Pages and layout composition should stay as Server Components unless they need client-only behavior. Client Components are reserved for local state, effects, browser APIs, timers, drag/drop, overlays, comboboxes, rich forms, and custom interactive grids.

Server Actions must stay thin: authenticate, authorize, validate with Zod, call server domain code, and return a typed result.

## State

Use local React state for component-local UI state. Use URL search params for shareable table/filter state. Do not add Redux, Zustand, or TanStack Query for v1.

## i18n

All user-facing runtime text must be bilingual in Hungarian and English. UI copy belongs in `messages/hu.json` and `messages/en.json`; server actions should return localized messages with `getTranslations`; auth emails must use locale-aware templates. New features are not complete until labels, validation messages, empty/error states, toasts, dialogs, and emails are covered in both locales.
