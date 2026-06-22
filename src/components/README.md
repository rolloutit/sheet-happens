# Component Library Rules

The component library lives inside the app for v1.

- `src/components/ui`: reusable shadcn/Radix-derived primitives.
- `src/components/sheet`: Sheet Happens product components from the Claude design inventory.
- `src/components/layout`: shell, navigation, page layout, providers, and drawers.

Folder convention:

- Every instantiable component gets a PascalCase folder.
- The implementation file uses the component name: `Button/Button.tsx`.
- Public props live in `Button.types.ts` when the component has exported props.
- CVA or other reusable variant definitions live in `Button.variants.ts`.
- `index.ts` is the component's public import surface.
- Stories, tests, and component-local helpers stay colocated in the same folder.

Example:

```txt
Button/
  Button.tsx
  Button.types.ts
  Button.variants.ts
  Button.stories.tsx
  index.ts
```

Rules:

- Components are functional components with explicit exported prop types.
- Visual differences use typed variant props instead of boolean prop combinations.
- Use `className` only where extension is intentional.
- Prefer Server Components by default; add `"use client"` only for state, effects, browser APIs, timers, forms with live validation, and Radix interactive primitives.
- Every reusable component needs Storybook coverage for variants, disabled/loading/error/empty states, dark/light theme, and mobile-relevant states.
- Behavior gets a Storybook `play` test or a Vitest/Testing Library test.
