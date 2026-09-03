# Design Tokens

The token source is `app/globals.css`. The **dark palette is "Graphite Aurora"** — a neutral
cool-graphite chassis (H ≈ 264°, C ≤ 0.022), warm ivory type from the brand Beige ramp (H ≈ 79°),
and four widely-separated signal hues — adopted from `docs/dark-mode-redesign.md`, which holds the
full rationale, the computed contrast tables, and the open brand questions. The **light palette is
"Ivory Ledger"** — the brand Beige ramp as the chassis, one near-black-teal ink in three tiers
(H ≈ 216°), the same four signal hues printed darker — from `docs/light-mode-redesign.md`, whose §12
holds what shipped and how it deviates from §1–§11's proposal.

**Both themes were relit in a second pass** (`docs/dark-mode-redesign.md` §12, then
`docs/light-mode-redesign.md` §12). Dark's first pass fixed a monochrome teal wash and overshot into
drabness — the six surfaces sat inside a 0.11 lightness span, the signals were rationed, and the
atmosphere composited to khaki. Three rules changed:

- **The surface ladder is wide.** A card must be visibly a card. Card-over-canvas is 0.051 L and
  card-over-void 0.109. Do not compress these steps back together; it is what makes the interface
  read as panels rather than as murk.
- **Mint's pixel budget is gone; its meaning is not.** Colour may carry gradients, glows and
  tinted surfaces at whatever size the design needs. What survives is semantic: mint =
  system/active/primary, peach = the CTA, green = approved, rose = blocked. And the one structural
  rule that caused the original "too much green" complaint still stands — **mint is never the page
  or the sidebar background.** Structure is neutral; what sits on it may sing.
- **Spend the budget on chroma, not brightness.** Where a value is capped by contrast (the whole
  atmosphere layer is), pick the most _saturated_ source that fits the cap rather than the
  lightest. At a fixed luminance, `--primary` returns 56% more chroma than `--accent`, and
  `--warning` 245% more than the brand peach. This is the single most useful rule in the file.

Light's pass inherited the method and inverted three of the mechanics. **Do not transplant a dark
rule into `.light` without re-deriving it** — these three are the ones that flip:

- **The ladder widens downward, because `--card` is white and cannot lift.** Dark pulled its ramp
  apart upward; light pushes the void down (`--canvas-base` to beige-700, card-over-void 0.057 →
  0.073 L). Elevation in light is therefore the hairline and the shadow, not a lightness step —
  which is why `--border` is a full beige-800.
- **The atmosphere budget is two-sided.** Dark has a luminance ceiling only. Light has a floor
  (0.5390, `--muted-foreground` on the canvas) _and_ a ceiling (0.9406, card-over-canvas at 1.06) —
  lightening the ground erases the white card, which is a bound dark has no equivalent for.
- **The washes draw from the _bright_ end of each ladder, not the saturated middle.** Light's
  resource is luminance _displacement_, so a deep source is rationed to a low alpha and returns
  almost nothing: mint-700 inside budget yields C 0.014 at hue 93° — a grey-olive, light's own
  khaki — against mint-200's C 0.102 at hue 195°. Only the echo lines come from the deep end,
  because a visible line _is_ a luminance difference.

And one rule that does not flip, only changes medium: **a glow is emitted light, and on paper it is
a smudge.** Every coloured bloom in a shared component has a light form that is a directional
coloured shadow, with the omnidirectional version behind `dark:` (`StatCard`'s final sparkline bar,
`ChartPrimitives`' meter bars, the sidebar rail and its active label).

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
  chroma (L 0.134 → 0.300, C 0.005 → 0.022, the way a surface picks up ambient colour as it
  lifts): `--canvas-base` (void) < `surface-inset` < `background` < `card` < `secondary` (hover) <
  `popover`/`muted` (overlays). The sidebar sits **below** the canvas (`surface-inset`) —
  navigation recedes, content comes forward. `surface-inset` is also the fill for inputs, wells,
  and table stripes.
  - **Light runs the same ramp inverted**, straight off the brand Beige steps, with chroma falling
    as the surface lifts (0.0173 → 0, since white has none to give): `--canvas-base` beige-700
    (void) < `muted` beige-600 < `surface-inset`/`sidebar` beige-500 < `secondary` beige-400 <
    `background` beige-300 < `card`/`popover` white. Six tokens, six distinct planes. The sidebar
    recedes here too. Hover fills _dip toward the canvas_ rather than lifting past the card, because
    there is nothing above white to lift to.
  - **The void is not a text surface in light and `--muted` is not the void.** Keeping them apart is
    what lets the void go dark enough for a card to read while `--muted` stays light enough for a
    third text tier to exist. Merging them back collapses the type ladder — see the Focus-adjacent
    rule below and `docs/light-mode-redesign.md` §12.4.
- **Signals:** **eight families**, not four. The original four sit ≥ 42° apart in OKLCH hue (mint
  195°, green 153°, amber 65°, rose 15°), so the `*-soft` tints stay distinguishable when
  composited over the neutral card. **All eight use the same hues in both themes**, so a status
  reads as one colour everywhere.
  What differs per theme is lightness and chroma: a saturated colour on white has to be darker to
  stay legible, so light's values are re-derived — each spending the same _fraction of the sRGB
  gamut ceiling_ its dark counterpart spends, capped so no family exceeds 1.9× the chroma of the
  least-saturated (`--primary`, fixed by the brand). Light clears 4.5:1 on every opaque surface
  including `--muted`, and on its own soft.
  - `--accent` is a **different step from `--primary` in both themes, in opposite directions**: the
    lighter step in dark (`#84f4f4` over `#29c6c6`), the deeper one in light (`#196869` under
    `#1f7475`). It is the text/border/checked step and `--primary` is the fill, so it follows the
    polarity. `Button`'s `primary` variant is a gradient between the two — collapse them and the
    button goes flat.
  - The dark `*-soft` alphas are **per-tone, not a flat 16%** — accent 0.24, warning 0.21, success
    and danger 0.22. Each is the loudest tint whose own full-strength label still clears 4.5:1 on
    every surface the tint can land on, `--popover` included. The four hues do not composite
    alike, so one number cannot serve them all. Raising any of these without redoing that check
    breaks a label somewhere.
  - `--destructive-bright` is **the rose that labels a rose ground**, and like `--accent` it sits on
    the opposite side of `--destructive` in each theme: lighter in dark (L 0.834 over 0.714, because
    the ground is dark), **deeper in light** (`#8a323f`, ΔL 0.100 under `#b64455`, because the ground
    is light). Keep `--destructive` for fills and for text on a plain card. It is not optional in
    light and it is not an alias: `Button variant="danger"` hovers to `bg-destructive/30`, and with
    the two the same colour the label reads 3.42 on a card.
  - Light's `*-soft` are **solid pastels, not alpha**, so the per-tone alpha reasoning above does not
    apply to them — they are searched directly. The cool pair can move much further from the chassis
    than the warm pair (the sRGB ceiling near white is ~3× higher at 196°/153° than at 66°/15°), so
    all four are held to a common band instead of each being pushed to its own limit.
  - **The 45% same-hue border on a tinted pill is mandatory in light**, not decoration. Warning and
    danger sit at ΔE 0.019 from `--muted` and no value fixes that — a warm pastel cannot get far
    from a warm chassis. The border is what makes the chip unambiguous.
  - `--pending` (yellow 96°), `--verified` (blue 238°), `--settled` (violet 294°) and `--blocked`
    (magenta 330°) are **the four added for the timesheet lifecycle**, which has nine states. Four
    hues could not label nine things: `submitted` and `invoiced` were both mint, both rejections
    were both rose, and `approved`/`accepted`/`paid` were one green printed three times. Each has a
    `*-soft` and follows every rule above — 90% of the sRGB ceiling at its own lightness, the set
    still inside 1.9×, per-tone dark alphas (yellow 0.29, the rest 0.20), solid pastels in light.
    Eight families cannot hold the 42° spacing with four hues pinned, so **separation is verified as
    OKLab ΔE over the whole set** the way the chart ramp is, not by hue angle: worst pair 0.104 in
    dark, 0.084 in light, against the ramp's 0.080 target. Lightness stagger is what carries the two
    closest hue pairs — magenta L 0.800 against rose 0.714 in dark, yellow and violet pushed to the
    bottom of the band (L 0.441 / 0.444) in light, where every warm hue collapses toward brown.
  - **Eight chromatic families do not separate under deuteranopia or protanopia**, and no arrangement
    of eight would. Colour is therefore never the only carrier of a status: `StatusPill` prints the
    status name beside its dot and the dashboard legend labels every swatch. Keep it that way.
- **Inks:** `--ink-mint`, `--ink-amber`, `--ink-rose` — the three dark text colours for
  full-strength signal fills. The four added families carry no ink and no `*-foreground`: nothing
  puts text on them at full strength, and adding one would need its own 6:1 derivation. The `*-foreground` tokens reference them in dark; every pairing
  clears 6:1. Components should keep using the semantic `*-foreground` names. Light needs no ink
  tokens of its own — its fills are dark, so every `*-foreground` is plain white (5.29–6.51) — with
  one exception: the CTA is a light peach fill in **both** themes and keeps a dark label, so
  `--cta-foreground` is `var(--ink-amber)` everywhere (11.70 on the fill, 10.77 on hover).
- **Type tiers:** three live tiers plus a disabled one that is a tier, not a token. Light's three
  are one hue by construction (H ≈ 216°, brand ink-800's own, spread 3.1°) and clear 4.5:1 on every
  opaque surface. **Only tiers 1 and 2 may sit on the canvas** — `--text-subtle` never does, and
  requiring it to would collapse it into `--muted-foreground` (ΔL 0.026). That rule is load-bearing
  in light and is verified against every call site in `docs/light-mode-redesign.md` §12.4.
- **Color, second tier** — the prototype's derived set, preferred over ad-hoc opacity modifiers:
  - `accent-soft` / `success-soft` / `warning-soft` / `destructive-soft` / `pending-soft` /
    `verified-soft` / `settled-soft` / `blocked-soft` — the one canonical tint per tone. Use
    `bg-success-soft`, not `bg-success/12`. In light theme these are solid pastels, which a
    percentage of the full-strength colour cannot reproduce.
  - `accent-line` — the accent border colour (`border-accent-line`).
  - `border-strong` — the stronger edge used on inputs, dropdowns, popovers and tooltips. `--input`
    is an alias of it, so `border-input` and `border-border-strong` are the same colour.
  - `subtle-foreground` — the third text tier below `muted-foreground`: table headers, placeholders,
    de-emphasised numbers.
  - `cta-hover`, `header` (the translucent sticky-header fill), `scrim` (overlay backdrops),
    `sidebar-border`.
- **Backdrop:** `--canvas-base` (the void — L 0.134 dark, L 0.927 light) plus the per-theme
  `--canvas-aurora` gradient pair feed the `body`/`.sheet-canvas` background — a cool glow off the
  top-right, a warm one off the bottom-left, over the base. In dark the glows are huge and soft
  (`--atmo-mint` lifts the void to L 0.28); light keeps its own smaller radials and moves the ground
  the other way. Raw CSS variables, not Tailwind color tokens. `AuthShell` also reads `--atmo-mint`
  directly in an inline gradient, so changing it moves the auth panel too.
- **Atmosphere:** `--atmo-mint`, `--atmo-peach`, `--atmo-dot`, `--atmo-blob-mint`,
  `--atmo-blob-peach`, `--atmo-line-mint`, `--atmo-line-peach`, `--atmo-grain` drive the
  decorative layer (`.sheet-atmosphere` + `.sheet-grain`) that `AppShell` and `AuthShell` mount
  via the `Atmosphere` component: the styleguide's blob silhouettes as gradient-lit glows with
  offset outline echoes, a wave ridge on the bottom edge, a line-art swoosh off the top-right
  corner, a gutter-masked dot lattice, and feTurbulence grain that keeps the aurora from banding.
  Geometry lives in `Atmosphere.shapes.ts`, taken verbatim from the raw styleguide exports in
  `src/components/layout/Atmosphere/svgs/` — never redrawn by eye. **Both themes** — the geometry,
  blurs, offsets and drift are shared and only the `--atmo-*` values differ, so dark reads the shapes
  as light and light reads them as printed ink. Only `.sheet-grain` is dark-only (`--atmo-grain: 0`
  in light): banding is a near-black artifact and the tile is white-alpha noise. Content sits above
  at `z-index: 2`; surfaces stay opaque, so on dense screens the atmosphere lives only in the
  gutters.
  - **These alphas have a hard bound and it is not aesthetic.** `AuthForm` renders
    `--muted-foreground` directly on this canvas, so the ground two overlapping layers can reach
    must still carry that tier at 4.5:1.
    - **Dark: a ceiling.** On `--background` — the lighter of the two bases, therefore the worse
      case — the ground may not exceed relative luminance **0.0607**. The shipped values peak at
      0.0525.
    - **Light: a floor _and_ a ceiling.** The floor is **0.5390** (same tier, same 4.5:1, opposite
      direction). The ceiling is **0.9406** and is not a text bound at all — `--card` is `#ffffff`
      and cannot lift, so a canvas driven toward white erases the panel sitting on it. The old
      `--atmo-mint: #ffffff` at full alpha violated it outright, taking card-over-canvas to 1.00.
    - Recompute before moving any of them, in either theme.
  - **Which end of the ladder the layers draw from is per-theme.** Dark takes the **saturated
    middle** (`--primary` / `--warning`), because at a luminance ceiling the palest source spends
    the whole budget on brightness and returns almost no colour — that is what made the old warm
    layer composite to C 0.007 at hue 48°, i.e. khaki. Light takes the **bright end** (mint-200 /
    amber-600), because its resource is luminance _displacement_ and a deep source is rationed to a
    low alpha: mint-700 inside budget returns C 0.014 at hue 93°, a grey-olive.
  - **Fills bloom, lines stay crisp.** The wave and the arc are stroke-only line-art; the blobs are
    gradient fills at 40px blur. A large low-chroma fill with a legible edge is a camouflage
    blotch on this canvas, which is exactly what the wave used to be. In light the same split holds
    for a different reason: the blur destroys the fill's form, so the **fill buys colour and the
    line buys shape** — and the echo lines are the one layer drawn from the deep end, because a
    visible line _is_ a luminance difference.
  - The stacking model is **any two overlapping _area_ layers**. Thin strokes are excluded:
    `--atmo-dot` is 1px dots on a 24px grid (~0.14% pixel coverage, masked out of the centre-top
    where content sits), and the echo lines are 2px strokes. Dark's own aurora+blob+line case scores
    2.67, i.e. dark ships that exclusion too.
- **Charts:** `--chart-1` … `--chart-6` — the categorical ramp (mint, amber, violet, green, rose,
  blue), assigned in fixed order and never cycled or re-ranked. Each step passes the `dataviz`
  skill validator against both the dark card and white, so the ramp is deliberately
  **theme-stable** (`.light` does not override it). Violet and blue are **chart-only** and must
  never appear in UI chrome. Single-series charts use `var(--chart-1)`, not `var(--primary)`.
  - Each step runs at ~95% of the sRGB gamut ceiling for its hue, capped so no series exceeds
    ~1.9× the chroma of the least-saturated. Cyan's ceiling in the validator's dark band is barely
    half of violet's, so a flat fraction of each ceiling would make violet and rose shout while
    mint whispered — not a categorical set.
  - **Lightness is staggered on purpose.** Green and rose are adjacent in the fixed order and
    collapse under deuteranopia at equal lightness (ΔE 1.3); the stagger is what carries that pair.
    Do not flatten the ramp to one lightness "for consistency".
  - Re-run `scripts/validate_palette.js` from the `dataviz` skill against **both** the dark card
    and white before changing any step. Current worst adjacent CVD ΔE is 8.7 (target 8.0) and the
    normal-vision floor 22.5 (floor 15.0), with no contrast relief warning in either mode.
  - Decorative single-series indicators — the `StatCard` sparklines — are **not** bound by this
    ramp and use the brand signal at full strength. The band that keeps chart marks legible in both
    themes does not apply to a mark that only ever renders on a card.
  - **Charts stay on cards.** Against light's white `--card` all six clear 3:1; on `--background`
    two dip below and on `--surface-inset` four do. Moving a chart onto a beige surface means
    re-running the validator against that surface first.
  - The `TrendChart` stroke's `feDropShadow` is themed through CSS, not through the attribute — a
    filter attribute cannot resolve a `var()`. `.sheet-trend-glow` sets `flood-opacity` per theme
    (0.55 dark, 0.14 light), because a bloom around a dark line on a white card is a blurred line,
    not a lit one.
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
- **Shadow:** **two** elevations. `--elevation-pop` is the neutral one every surface uses — teal-
  tinted in light, near-black in dark, each with a hairline ring as its second layer — and both
  `shadow-soft` and `shadow-panel` resolve to it. `--elevation-glow` and `--elevation-glow-warm`
  are the coloured lights that sit under an element carrying a signal, exposed as
  `shadow-accent-glow` and `shadow-cta-glow`. Two of them, because a warm control lit by mint is
  the giveaway of a palette applied by search-and-replace: `primary` takes the cool glow, `cta` the
  warm one. (`shadow-accent-glow` previously resolved to `0 10px 26px -12px var(--accent-line)` — a
  30%-alpha colour pulled in 12px, which rendered as nothing at all. Light held that exact value
  until its own relight and had the same non-glow.)
  - **A glow is emitted light and does not survive the polarity flip.** In dark the two glow
    elevations are omnidirectional bloom; in light they are **directional coloured shadows** — the
    element tints the page beneath it instead of lighting the room around it. Same intent, restated
    in the medium. The four shared components that carry a bloom of their own (`StatCard`'s final
    sparkline bar, `ChartPrimitives`' meter bars, `AppShell`'s nav rail and its active label) follow
    the same pattern: a tight directional shadow in the base class, the bloom behind `dark:`.
  - `--elevation-pop`'s ink is near-black in dark and brand **mint-900** in light — `rgb(12 66 63)`
    is the styleguide's own `--shadow-1..3` recipe and the one sanctioned place teal touches the
    chassis. In light this shadow does more work than in dark, because elevation there cannot be a
    lightness step.
- **Layout:** `--sidebar-w` 256px, `--sidebar-w-collapsed` 76px, `--header-h` 64px.
- **Motion:** `--ease-standard`.

## Focus

Two treatments, and a control picks by whether it draws its own edge. Both key off
`:focus-visible`, so a pointer user never sees either — hover is the pointer affordance.

- **Borderless** (pills, icon buttons, tabs, calendar cells, menu rows): declare **nothing**. The
  only focus rule in `app/globals.css` gives every focusable element `outline: 2px solid var(--ring)`
  at `outline-offset: 2px`. The offset is load-bearing: flush against a filled `--primary` button,
  `--ring` sits at ~1.6:1 and disappears, so the outline needs the neutral background to read
  against.
- **Chrome** (a visible border plus an inset fill — inputs, textareas, the `Select`/`Combobox` and
  date-picker triggers): `focusChromeClassName` from `src/components/ui/focusRing.ts`, which cancels
  that outline and brightens the existing border from `--input` to `--ring` instead. Nothing is
  added, so the control does not gain a second ring around an edge it already has, and no geometry
  moves. `focusChromeWithinClassName` is the `:has()` variant for the several places where the
  border sits on a wrapper and the focusable element is a bare `<input>` inside it.

Three rules make this work, and all three are easy to break:

- The global rule lives in **`@layer base`**. Unlayered — which is how the rest of that file is
  written, deliberately — it would outrank the `focus-visible:outline-none` in `@layer utilities`
  that every chrome control depends on, and the two treatments would composite instead of one
  replacing the other. That is the bug this shape exists to prevent.
- **Menu and option rows carry no focus styling at all.** Radix moves real DOM focus to a
  `Select`/`Dropdown` item on pointer-move, so `focus:bg-secondary` is already the
  where-is-my-mouse tint; cmdk uses active descendant and tints on `data-[selected=true]`. An
  outline on top of either reads as a selection box the user cannot dismiss.
- Two controls take an **inset ring** instead, because an outward outline would be clipped by an
  `overflow-hidden` ancestor or spill onto neighbouring cells: `DataTable` rows and the time-grid
  cell inputs. Both are commented at the call site. Nothing else should join them without one.

## Conventions

- Component code uses Tailwind token classes: `bg-background`, `text-foreground`, `border-border`,
  `bg-cta`, `text-accent`, `bg-success-soft`, `text-subtle-foreground`.
- **Surfaces are opaque.** Cards, tables, panels and popovers use flat `bg-card` — the canvas
  gradient sits behind them rather than showing through. A translucent card samples whatever it
  happens to be over and so never lands on the intended surface colour. Translucency is reserved for
  the two places the prototype uses it: the sticky header (`bg-header`) and overlay scrims
  (`bg-scrim`), both paired with a backdrop blur.
  - A **gradient layered over an opaque base** is not translucency and is the right way to give a
    surface colour: `bg-[radial-gradient(…),var(--card)]`, as `Card`'s `featured` variant, the
    dashboard hero and `EmptyState` all do. The last stop is the opaque token, so the surface still
    lands where it should. `bg-card/70` is the thing to avoid — both the hero and `EmptyState`
    carried it and rendered washed and grey over the void.
- `AppShell`'s root carries `.sheet-canvas` itself, because it owns the `h-screen`/`overflow-hidden`
  scroll container and an opaque fill there would hide the body's gradient entirely.
- Percentage opacity on a tone colour (`bg-warning/55`) is still correct for chart and
  distribution-bar fills, where the value is data-driven rather than a UI tint.
