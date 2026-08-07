# Design Tokens

The token source is `app/globals.css`. The **dark palette is "Graphite Aurora"** — a neutral
cool-graphite chassis (H ≈ 264°, C ≤ 0.017), warm ivory type from the brand Beige ramp (H ≈ 79°),
and four widely-separated signal hues — adopted from `docs/dark-mode-redesign.md`, which holds the
full rationale, the computed contrast tables, and the open brand questions. The light palette
remains the prototype transcription (`claude_design_proto/shell/theme.css`, gitignored), except
that its success and danger hues are aligned to the dark palette's (see below).

The one discipline rule that keeps the theme working: **mint is a signal, never a surface.** It
appears only where it carries meaning — active navigation, focus, links, the running timer, the
primary action — and structure is always neutral. As a budget, mint should cover under ~5% of the
pixels on any screen.

## Theme modes

- `:root` carries the dark palette, so dark is the baseline and `.dark` only sets `color-scheme`.
- Light is supported through the `.light` class, which overrides the token values.
- Theme switching is handled by `next-themes` (`src/components/layout/ThemeProvider`), which is the
  only module allowed to import it. The preference is `light`, `dark` or `system`, stored per device
  in `localStorage` under `theme`; **`system` is the default** when nothing is stored.
- `app/layout.tsx` server-renders `<html class="dark">` as a baseline and next-themes' blocking
  script rewrites it before first paint. The class is always physically present, which is what the
  `dark:` utilities in `AuthShell`/`AuthForm` rely on.
- `src/lib/theme.ts` holds the preference union, the storage key and the default.

## How `@theme inline` constrains this file

Tailwind resolves a `@theme inline` entry whose value is a `var()` reference **into the utility
itself** — `bg-accent-soft` emits `background-color: var(--accent-soft)`, so it re-resolves per theme.
The trade-off is that such an entry is **not** emitted as a custom property. Two consequences:

- Plain CSS must read the underlying variable (`var(--elevation-pop)`), never the theme name
  (`var(--shadow-soft)`), which would be undefined. `.sheet-panel` is the one place this matters.
- Literal entries _are_ still emitted, which is what keeps the 130-odd
  `rounded-[var(--radius-lg)]` call sites working.

## Token families

- **Color, base:** `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`,
  `accent`, `cta`, `success`, `warning`, `destructive`, `border`, `input`, `ring`, `sidebar`,
  `surface-inset`. In dark these form a six-step surface ramp — monotonic in lightness _and_
  chroma (C 0.005 → 0.016, the way a surface picks up ambient colour as it lifts):
  `--canvas-base` (void) < `surface-inset` < `background` < `card` < `secondary` (hover) <
  `popover`/`muted` (overlays). The sidebar sits **below** the canvas (`surface-inset`) —
  navigation recedes, content comes forward. `surface-inset` is also the fill for inputs, wells,
  and table stripes.
- **Signals:** the four families sit ≥ 42° apart in OKLCH hue (mint 195°, green 153°, amber 65°,
  rose 15°), so the 16% `*-soft` tints stay distinguishable when composited over the neutral card.
  Success and danger use the **same hues in both themes**, so a status reads as one colour
  everywhere; the light values are tuned so every text pairing (on white, `--background`,
  `--secondary`, and their own soft) clears 4.5:1.
- **Inks:** `--ink-mint`, `--ink-amber`, `--ink-rose` — the three dark text colours for
  full-strength signal fills. The `*-foreground` tokens reference them in dark; every pairing
  clears 6:1. Components should keep using the semantic `*-foreground` names.
- **Color, second tier** — the prototype's derived set, preferred over ad-hoc opacity modifiers:
  - `accent-soft` / `success-soft` / `warning-soft` / `destructive-soft` — the one canonical tint per
    tone. Use `bg-success-soft`, not `bg-success/12`. In light theme these are solid pastels, which a
    percentage of the full-strength colour cannot reproduce.
  - `accent-line` — the accent border colour (`border-accent-line`).
  - `border-strong` — the stronger edge used on inputs, dropdowns, popovers and tooltips. `--input`
    is an alias of it, so `border-input` and `border-border-strong` are the same colour.
  - `subtle-foreground` — the third text tier below `muted-foreground`: table headers, placeholders,
    de-emphasised numbers.
  - `cta-hover`, `header` (the translucent sticky-header fill), `scrim` (overlay backdrops),
    `sidebar-border`.
- **Backdrop:** `--canvas-base` (the void) plus the per-theme `--canvas-aurora` gradient pair feed
  the `body`/`.sheet-canvas` background — a cool glow off the top-right, a warm one off the
  bottom-left, over the base. In dark the glows are huge and faint (`--atmo-mint` at 10% lifts the
  void from L 0.145 to L 0.217); light keeps its original composition. Raw CSS variables, not
  Tailwind color tokens.
- **Atmosphere:** `--atmo-mint`, `--atmo-peach`, `--atmo-dot`, `--atmo-blob-mint`,
  `--atmo-blob-peach`, `--atmo-line-mint`, `--atmo-line-peach`, `--atmo-grain` drive the
  decorative layer (`.sheet-atmosphere` + `.sheet-grain`) that `AppShell` and `AuthShell` mount
  via the `Atmosphere` component: the styleguide's blob silhouettes as gradient-lit glows with
  offset outline echoes, a wave ridge on the bottom edge, a line-art swoosh off the top-right
  corner, a gutter-masked dot lattice, and feTurbulence grain that keeps the aurora from banding.
  Geometry lives in `Atmosphere.shapes.ts`, taken verbatim from the raw styleguide exports in
  `src/components/layout/Atmosphere/svgs/` — never redrawn by eye. **Dark-only** — `.light` hides
  both layers. Content sits above at `z-index: 2`; surfaces stay opaque, so on dense screens the
  atmosphere lives only in the gutters.
- **Charts:** `--chart-1` … `--chart-6` — the categorical ramp (mint, amber, violet, green, rose,
  blue), assigned in fixed order and never cycled or re-ranked. Each step passes the `dataviz`
  skill validator against both the dark card and white, so the ramp is deliberately
  **theme-stable** (`.light` does not override it). Violet and blue are **chart-only** and must
  never appear in UI chrome. Single-series charts use `var(--chart-1)`, not `var(--primary)`.
- **Radius:** `xs` 6 · `sm` 9 · `md` 12 · `lg` 16 · `xl` 22 · `pill` 999.
- **Font:** Lexend sans token (`--font-sans`, applied to `body`) and Poppins UI token (`font-ui`).
  Both are **self-hosted** from `public/fonts`, declared as `@font-face` at the top of
  `app/globals.css` rather than loaded through `next/font`. That is deliberate:
  `app/layout.tsx` and `.storybook/preview.tsx` both import `globals.css`, and
  `@storybook/nextjs-vite` ships no `next/font` transform — a loader in the layout would leave
  Storybook and all 26 Playwright baselines rendering system-ui while production rendered Lexend.
  It also matches the PDF pipeline's bundled Inter (`src/server/pdf/templates/lib/theme.typ`), so a
  render is identical on a dev machine, in Docker and in CI, with no build-time network call.
  - Both the `latin` **and** `latin-ext` subsets are required. Hungarian ő (U+0151) and ű (U+0171)
    live in `latin-ext`; shipping only `latin` silently falls back to a system face mid-word.
  - Lexend has a real `wght` axis, so one variable file per subset serves 100–900. Poppins has no
    variable release, so each weight is its own file — **400/500/600/700 only**. Using a weight
    outside that set (e.g. `font-extrabold`) gets a synthesised approximation, not a real cut; add
    the file first.
  - `unicode-range` values are copied verbatim from the Google Fonts CSS API and stay paired with
    the file they were fetched with. Re-fetch both together or matching breaks.
- **Shadow:** the prototype has exactly **one** elevation. `--elevation-pop` holds it per theme —
  teal-tinted in light, near-black in dark, each with a hairline ring as its second layer — and both
  `shadow-soft` and `shadow-panel` resolve to it. `shadow-accent-glow` is the separate glow that sits
  under gradient primary buttons and avatars.
- **Layout:** `--sidebar-w` 256px, `--sidebar-w-collapsed` 76px, `--header-h` 64px.
- **Motion:** `--ease-standard`.

## Conventions

- Component code uses Tailwind token classes: `bg-background`, `text-foreground`, `border-border`,
  `bg-cta`, `text-accent`, `bg-success-soft`, `text-subtle-foreground`.
- **Surfaces are opaque.** Cards, tables, panels and popovers use flat `bg-card` — the canvas
  gradient sits behind them rather than showing through. A translucent card samples whatever it
  happens to be over and so never lands on the intended surface colour. Translucency is reserved for
  the two places the prototype uses it: the sticky header (`bg-header`) and overlay scrims
  (`bg-scrim`), both paired with a backdrop blur.
- `AppShell`'s root carries `.sheet-canvas` itself, because it owns the `h-screen`/`overflow-hidden`
  scroll container and an opaque fill there would hide the body's gradient entirely.
- Percentage opacity on a tone colour (`bg-warning/55`) is still correct for chart and
  distribution-bar fills, where the value is data-driven rather than a UI tint.
