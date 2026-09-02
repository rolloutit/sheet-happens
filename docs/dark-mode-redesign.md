# Dark Mode Redesign — "Graphite Aurora"

Status: **implemented** (feature/dark-mode-graphite-aurora, 2026-08), then **relit** in a second
pass — see [§12](#12-the-relight-pass-2026-08) for what changed and why. §1–§11 are the original
record and are left as written; where §12 contradicts them, §12 is what ships. The adopted token
families live in `docs/tokens.md`; this file is the rationale record. Deviations from the proposal
as written, and why:

- **Chart ramp (§7):** the literal six hex values failed the repo's `dataviz` validator (its own
  adoption gate) — every step sat above the dark mark-lightness band and peach fell below the
  chroma floor. The shipped ramp keeps the same six hues in the same order, snapped into the band;
  it passes all checks against both the dark card and white, so it is theme-stable and `.light`
  carries no override.
- **Atmosphere positioning (§5.2):** `absolute` within each shell's positioned root rather than
  `fixed`, so the auth screen keeps the layer off the brand panel.
- **Blobs (§5, Layer 2):** initially shipped as superellipse stubs; replaced with the real
  styleguide silhouettes once the _Graphical elements_ exports landed in
  `src/components/layout/Atmosphere/svgs/`. The shipped composition goes slightly beyond the
  proposal's two-blob budget on request: two echo-outlined blob glows plus a stationary wave
  ridge and line-art swoosh, with a gentler blur so the forms read to the eye.
- **Empty-state doodles (§5, Layer 5):** not shipped in the redesign pass — the line-art exports
  now exist in the same folder, so this is unblocked as a follow-up.
- **Tables (§6):** zebra striping and sticky headers do not exist in the current table markup;
  introducing them is structural work deferred to its own change. Tables did move to the new
  raised surface and neutral hairlines via the tokens.
- **Light-mode signals (§9, decision 2 = yes):** success/danger light values were re-derived
  against light's own surfaces (`#247f48`, `#be3c52`) so every text pairing clears 4.5:1 — the
  proposal deferred these numbers to implementation.

Open items beyond the asset export: brand sign-off on the non-teal chassis and the two
palette extensions (§9.1), and the light-mode atmosphere treatment (§9.3, deliberately not in
this pass).

Every contrast ratio and OKLCH coordinate below was computed, not estimated. Ratios are WCAG 2.1
(`(L1+0.05)/(L2+0.05)`); `L`/`C`/`H` are OKLCH.

---

## 1. What is actually wrong today

The complaint — "too standard, and the green is too much" — has a precise, measurable cause.

**Every neutral in the dark theme is teal.** Not the accents: the _neutrals_.

| Token          | Hex       | OKLCH L | OKLCH C | OKLCH H |
| -------------- | --------- | ------- | ------- | ------- |
| `--background` | `#0a1716` | 0.192   | 0.019   | 189.5°  |
| `--card`       | `#11221f` | 0.236   | 0.024   | 181.7°  |
| `--secondary`  | `#1a302c` | 0.289   | 0.029   | 181.3°  |
| `--muted`      | `#244039` | 0.347   | 0.036   | 176.3°  |
| `--foreground` | `#ecf6f3` | 0.965   | 0.011   | 176.3°  |

Six surfaces and the body text all sit inside a 13° hue band. There is no neutral anywhere in the
theme — the page, the cards, the hover states, the dividers and the type are all the same colour at
different lightnesses. That is what "too much green" is: not a loud accent, a **monochrome wash**. And
because the chassis is already teal, the teal accent has nothing to contrast against, so it stops
reading as a signal and becomes the atmosphere.

Three concrete failures follow from it.

**a) The accent and the success colour are too close to tell apart.** `--accent` `#37e3de` (H 191.9°)
and `--success` `#5fdaa8` (H 163.8°) are **28.1° apart**. At a glance, in a status pill, next to each
other in a distribution bar, they are the same colour.

**b) Alpha tints get contaminated by the surface underneath.** The second-tier `*-soft` tokens are
16% alpha over `--card`. Composite them and the chromatic card poisons the result:

| Tint at 16% over `#11221f` | Result    | OKLCH C   | OKLCH H    |
| -------------------------- | --------- | --------- | ---------- |
| `--warning-soft`           | `#373A2A` | 0.027     | **116.5°** |
| `--destructive-soft`       | `#37332F` | **0.009** | 67.5°      |

The warning tint bends 52° off its source hue into **olive green**. The danger tint collapses to
`C = 0.009` — effectively **achromatic** — and lands at 67.5°, which is where the warning tint was
supposed to be. This is why "danger" and "warning" pills are indistinguishable on the dashboard: the
danger tint has no colour left, and the warning tint has turned green. A chromatic surface cannot
carry a system of alpha tints.

**c) Nothing recedes.** One shadow, one card colour, teal borders on teal cards. Depth is carried
entirely by a hairline that is itself teal, so the interface reads as flat panels floating on a
slightly darker version of themselves.

**The brand palette already contains the fix, and dark mode ignores it.** The styleguide ships a
ten-step **Grey Dark** ramp (`#131313` → `#74767C`) and a **Beige** ramp. Dark mode uses neither. It
invented green-tinted greys instead of using the neutral ramp the brand actually specifies.

---

## 2. Design thesis

> **A cold graphite room, lit by two warm-and-cool light sources.**

Three separated systems, each with one job:

| System         | Job                                  | Colour                                        |
| -------------- | ------------------------------------ | --------------------------------------------- |
| **Chassis**    | structure — surfaces, borders, depth | cool graphite, near-neutral (C ≤ 0.017)       |
| **Signals**    | meaning — state, action, status      | mint · peach · green · rose, widely separated |
| **Atmosphere** | brand feeling — the background layer | mint & peach glows, brand blobs, dots, grain  |

Two moves make it feel new rather than merely correct:

**Warm type on a cool chassis.** Surfaces run cool (H ≈ 264°, blue-graphite). Type runs **warm ivory**
(H ≈ 79°, drawn from the brand Beige ramp). Both at very low chroma, so neither reads as tinted — but
the 185° opposition gives the interface a quiet warmth that pure-grey-on-pure-grey never has. This is
the brand's Beige ramp finally doing work in dark mode. Almost no dark SaaS UI does this; it reads
editorial and expensive rather than "developer tool".

**Chroma rises with elevation.** As surfaces lift, they gain lightness _and_ a trace more chroma
(C 0.005 → 0.016), the way a real surface picks up more ambient colour the more light reaches it.
Deliberately kept below the threshold where it reads as a colour cast — it stops the greys feeling
dead without reintroducing a wash.

And one discipline rule, which is what actually cures "too much green":

> **Mint is a signal, never a surface.** It appears only where it carries meaning: active navigation,
> focus, links, the running timer, the primary action, and the "system" data series. Structure is
> always neutral. As a budget: **mint should cover under ~5% of the pixels on any screen.**

---

## 3. The chassis

### 3.1 Surfaces

A six-step ramp. Monotonic in lightness and chroma, single hue (H ≈ 264°).

| Token              | Hex       | L     | C      | H      | Use                                           |
| ------------------ | --------- | ----- | ------ | ------ | --------------------------------------------- |
| `--surface-void`   | `#090A0C` | 0.145 | 0.0047 | 263.8° | behind everything; the atmosphere paints here |
| `--surface-inset`  | `#0B0C0F` | 0.155 | 0.0066 | 271.0° | sidebar, inputs, table stripes, wells         |
| `--surface-base`   | `#0E1014` | 0.173 | 0.0089 | 264.3° | app canvas                                    |
| `--surface-raised` | `#15181E` | 0.209 | 0.0128 | 264.2° | cards, tables, panels                         |
| `--surface-hover`  | `#1A1D24` | 0.231 | 0.0143 | 266.9° | hover, secondary fills                        |
| `--surface-over`   | `#1E222A` | 0.251 | 0.0163 | 264.2° | popovers, dialogs, dropdowns, command palette |

Note the sidebar sits **below** the canvas, not above it. Navigation should recede; content should
come forward. The current theme has it the other way round.

### 3.2 Type — warm ivory

| Token     | Hex       | L     | C      | H     | inset | base  | raised | hover | over  |
| --------- | --------- | ----- | ------ | ----- | ----- | ----- | ------ | ----- | ----- |
| primary   | `#F3EFE9` | 0.954 | 0.0091 | 78.3° | 17.08 | 16.62 | 15.52  | 14.72 | 13.92 |
| secondary | `#B7B2AA` | 0.765 | 0.0126 | 79.8° | 9.28  | 9.03  | 8.43   | 8.00  | 7.56  |
| tertiary  | `#948F87` | 0.652 | 0.0131 | 79.8° | 6.09  | 5.93  | 5.53   | 5.25  | 4.96  |
| disabled  | `#5C5952` | 0.465 | 0.0117 | 87.5° | 2.80  | 2.73  | 2.54   | 2.41  | 2.28  |

The three live tiers clear **4.5:1 on every surface including the lightest** — tertiary was tuned up
from a first pass at `#8A857D`, which failed at 4.32:1 on `--surface-over`. Disabled text is
deliberately below 4.5:1 (WCAG exempts it) and must never be the sole carrier of information.

### 3.3 Borders and depth

Elevation comes from **hairlines plus the surface step**, not from stacked shadows — the surfaces
already differ in lightness, so shadows only need to sell the edge.

| Token             | Value                     | Composited on `--surface-raised` |
| ----------------- | ------------------------- | -------------------------------- |
| `--border`        | `rgb(232 236 242 / 0.08)` | `#26292F`                        |
| `--border-strong` | `rgb(232 236 242 / 0.16)` | `#373A40`                        |

Neutral, not mint. A mint hairline is reserved for elements that _carry_ the accent (the timer pill,
the focused input, the active nav rail).

```css
--elevation-pop: 0 20px 48px -16px rgb(0 0 0 / 0.72), 0 0 0 1px rgb(232 236 242 / 0.06);
```

Keep the repo's single-elevation discipline. The one addition is `--elevation-glow` for the primary
button and avatar, unchanged in spirit from today's `shadow-accent-glow`.

---

## 4. The signals

Four signal colours, chosen so that **no two are close in hue** and so that each survives being
composited as a 16% tint.

| Token         | Hex       | L     | C     | H      | on base | on raised |
| ------------- | --------- | ----- | ----- | ------ | ------- | --------- |
| mint (accent) | `#29C6C6` | 0.752 | 0.121 | 194.9° | 9.06    | 8.45      |
| success       | `#5CE08C` | 0.813 | 0.167 | 152.7° | 11.33   | 10.58     |
| warning       | `#FAAB59` | 0.803 | 0.135 | 64.7°  | 10.00   | 9.34      |
| danger        | `#FF6A7E` | 0.714 | 0.182 | 14.8°  | 6.90    | 6.45      |

Pairwise hue separation:

|             | mint      | success | warning |
| ----------- | --------- | ------- | ------- |
| **success** | **42.2°** |         |         |
| **warning** | 130.2°    | 88.0°   |         |
| **danger**  | 179.9°    | 137.9°  | 49.9°   |

The weakest pair is mint/success at 42.2° — up from today's 28.1°, and now backed by a chroma gap
(0.121 vs 0.167) and a lightness gap as well. Mint and danger land 179.9° apart: as close to exactly
complementary as the brand permits, which is what you want from "system" versus "something is wrong".

**Two changes from the brand sheet, and why.** The styleguide has no red and no green. Today's theme
improvises `#5fdaa8` and `#ff8f86`, and both fail — the green collides with the accent, and the
salmon is a desaturated peach that loses all its chroma as a tint. So:

- **success `#5CE08C`** is pushed to a true green (152.7°) instead of a mint-green (163.8°).
- **danger `#FF6A7E`** is a **rose**, not a salmon: hue pulled down to 14.8° and chroma up to 0.182.
  It is unmistakably not the amber, and it is unmistakably urgent.

Both are extensions to the brand palette and need brand sign-off (§9).

### 4.1 Tints now survive compositing

Same 16% tints, over the neutral `--surface-raised`:

| Tint    | Composited | C          | H      | Was (over `#11221f`)                |
| ------- | ---------- | ---------- | ------ | ----------------------------------- |
| mint    | `#183439`  | 0.0350     | 210.4° | `#17413E` · C 0.0467 · H 188.8°     |
| success | `#203830`  | 0.0335     | 171.0° | `#1D3F35` · C 0.0439 · H 172.2°     |
| warning | `#3A3027`  | 0.0212     | 63.9°  | `#373A2A` · C 0.0271 · H **116.5°** |
| danger  | `#3A252D`  | **0.0342** | 354.9° | `#37332F` · C **0.0090** · H 67.5°  |

The warning tint now holds its hue (63.9° against a 64.7° source — a 0.8° shift, versus 51.8° before).
The danger tint carries **3.8× the chroma** it did and reads as a rose blush, not a grey smudge. Four
tints, four clearly different colours. This single table is the strongest argument for a neutral
chassis.

### 4.2 Inks for filled surfaces

Three dark inks, one per family, for text on a full-strength fill:

| Ink           | Hex       | on mint | on peach CTA | on warning | on success | on danger |
| ------------- | --------- | ------- | ------------ | ---------- | ---------- | --------- |
| `--ink-mint`  | `#04211F` | 8.04    | 11.46        | 8.88       | 10.06      | 6.13      |
| `--ink-amber` | `#2A1608` | 8.21    | 11.70        | 9.07       | 10.27      | 6.26      |
| `--ink-rose`  | `#2A0A10` | 8.69    | 12.39        | 9.60       | 10.87      | 6.63      |

Assign mint→`--ink-mint`, peach/warning→`--ink-amber`, danger→`--ink-rose`, success→`--ink-mint`.
Every pairing clears 6:1.

### 4.3 The brand ladder, unchanged

Straight from the styleguide, for glows, deep fills and accent type:

| Token        | Hex       | L     | C     | H      | on base | Use                            |
| ------------ | --------- | ----- | ----- | ------ | ------- | ------------------------------ |
| `mint-glow`  | `#84F4F4` | 0.901 | 0.103 | 195.5° | 14.71   | accent type, icons, focus ring |
| `mint`       | `#29C6C6` | 0.752 | 0.121 | 194.9° | 9.06    | accent fill                    |
| `mint-mid`   | `#23AEAE` | 0.683 | 0.110 | 194.9° | 7.02    | pressed states                 |
| `mint-deep`  | `#196869` | 0.473 | 0.073 | 196.2° | 2.92    | deep fills, chart bases        |
| `mint-abyss` | `#0C423F` | 0.345 | 0.054 | 189.4° | 1.69    | atmosphere only                |
| `peach`      | `#FFD9B4` | 0.908 | 0.064 | 66.1°  | 14.36   | warm accent type               |
| `cta`        | `#FFCB97` | 0.876 | 0.089 | 66.2°  | 12.91   | the CTA fill (brand)           |
| `cta-hover`  | `#FAB976` | 0.832 | 0.113 | 66.1°  | 11.12   | CTA hover                      |

---

## 5. The atmosphere

The second reference sheet — blobs, dot grids, quarter-circles, line-art doodles, the thin ring with
a travelling dot — is a light-mode brand kit. Ported literally to dark it would either vanish or
shout. The translation rule:

> **In dark mode the brand shapes stop being ink and become light.** A blob is not a filled shape; it
> is a soft glow in the shape of that blob.

Five layers, bottom to top.

### Layer 0 — Void

Flat `--surface-void` `#090A0C` on `html`. The floor.

### Layer 1 — Aurora

Replaces today's two hard radial gradients with much larger, much fainter ones. Verified lift over the
void:

| Glow        | 4%      | 6%      | 10%     |
| ----------- | ------- | ------- | ------- |
| `mint-deep` | L 0.160 | L 0.168 | L 0.180 |
| `mint`      | L 0.175 | L 0.187 | L 0.217 |
| `cta` peach | L 0.183 | L 0.202 | L 0.235 |

Against a void at L 0.145, mint at 10% lifts to L 0.217 — a clear but soft presence. Keep the current
composition (cool top-right, warm bottom-left) so the change reads as a refinement, not a relocation.

```css
:root {
  --atmo-mint: rgb(41 198 198 / 0.1);
  --atmo-peach: rgb(255 203 151 / 0.06);
  --atmo-dot: rgb(132 244 244 / 0.055);
  --atmo-blob-mint: rgb(41 198 198 / 0.055);
  --atmo-blob-peach: rgb(255 203 151 / 0.045);
  --atmo-grain: 0.04;
}
```

### Layer 2 — Blobs

The brand's organic silhouettes, as inline SVG, filled with a colour→transparent gradient at 4.5–5.5%
and blurred 60–80px. Two per screen maximum, anchored to opposite corners, bleeding off-canvas so no
whole shape is ever visible — a glimpsed shape reads as depth, a complete one reads as clip art.

> **Asset dependency:** the real path data must be exported from the styleguide's _Graphical elements_
> frame as SVG. Do not redraw them by eye — the specific silhouettes are the brand. Until they land,
> stub with a rounded superellipse and treat the visual as provisional.

### Layer 3 — Dot grid

The brand's dot lattice, masked so it appears **only in the gutters** and fades out behind content.

```css
.sheet-atmosphere::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle at 1px 1px, var(--atmo-dot) 1px, transparent 0);
  background-size: 24px 24px;
  /* Transparent at the centre-top where content lives, opaque toward the edges. */
  mask-image: radial-gradient(120% 90% at 50% 0%, transparent 34%, #000 100%);
}
```

### Layer 4 — Grain

Non-negotiable, and not decorative: **8-bit gradients over near-black band visibly.** The aurora will
show stair-stepping on any decent panel without dithering. `feTurbulence` supplies it, with
`feColorMatrix` moving noise luminance into _alpha_ so the grain is white-with-varying-opacity and
composites normally — `mix-blend-mode: overlay` is the usual advice and it is wrong here, because
overlay preserves blacks and would do almost nothing at L 0.145.

```css
.sheet-grain {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: var(--atmo-grain);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0.28 0.28 0.28 0 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E");
}
```

`stitchTiles="stitch"` makes the 160px tile seamless. The SVG parses and encodes to 406 characters, so
it inlines cheaply. **`baseFrequency` and `--atmo-grain` are the two numbers to tune on real hardware**
— filters are cheap in bytes and expensive in CPU, so if paint cost shows up, rasterise the tile to a
WebP and ship it from `public/`.

### Layer 5 — Accent line-art

The doodles (spark, spiral, coil, arrow, sun) earn a real job rather than decorating:

- **Empty states** — one doodle per state, mint stroke at 30%, replacing generic iconography.
- **Stat cards** — a quarter-circle bleeding out of one corner, clipped by the card's own
  `overflow: hidden`. This is how the shapes get _inside_ opaque surfaces without breaking the
  opaque-surface rule.
- **Section headings** — the short stroke as a rule between a heading and its content.
- **Auth** — `AuthGyroscope` already _is_ the thin-ring-with-travelling-dot element. Retint it to the
  new palette; do not rebuild it.

### 5.1 Where the atmosphere is allowed to be

`docs/tokens.md` says surfaces are opaque, and that rule stays — a translucent card samples whatever
it happens to sit over and never lands on its intended colour. So the atmosphere is **a gutter
phenomenon**: it lives in page margins, behind empty states, on the auth screen, and around the
dashboard hero. On a dense table screen it is almost invisible, which is correct — a screen full of
financial data should be calm. The card-internal quarter-circles are how the language reaches inside.

### 5.2 Integration

One decorative element, rendered once by `AppShell` and once by `AuthShell`:

```tsx
<div className="sheet-atmosphere" aria-hidden="true" />
<div className="sheet-grain" aria-hidden="true" />
```

```css
.sheet-atmosphere {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  contain: strict; /* isolates paint; the layer never reflows with content */
}
```

`AppShell` owns the `h-screen`/`overflow-hidden` scroll container, so — exactly as `.sheet-canvas`
does today — it needs the atmosphere mounted inside itself, and its content wrapper needs
`position: relative; z-index: 2` to sit above both decorative layers.

### 5.3 Motion, and the two constraints already in this repo

If the blobs drift, they must obey the rules `app/globals.css` already establishes for
`AuthGyroscope` — the comments there are load-bearing:

1. **`prefers-reduced-motion` drops every animation to one iteration**, so each keyframe loop must end
   where it began. Frame 0 must be the resting state.
2. **`playwright.visual.config.ts` screenshots with `animations: "disabled"`**, which cancels infinite
   animations to frame 0. Frame 0 is therefore what every visual baseline captures, and must be a
   deliberate composition rather than an accident.

So: drift on **prime-numbered periods** (the gyroscope uses 53s/79s/37s so its composite path only
closes after ~70 minutes), one axis per element, and frame 0 = centred and unscaled. Nothing may
depend on `Date.now()` or `Math.random()`, or the visual baselines will flake.

Suggested: 120s and 170s on the two blobs, ±3% scale on a 90s clock. Slow enough that it is felt
rather than seen.

---

## 6. Component treatments

| Element             | Treatment                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Sidebar             | `--surface-inset` — recedes below the canvas. Inactive items tertiary; hover `--surface-hover`.                   |
| Active nav item     | mint tint 12% + `mint-glow` label + a 2px rounded rail, gradient `mint-glow`→`mint`. Currently a flat bar.        |
| Header              | `--surface-base` at 72% + `blur(14px)`, hairline underneath. Unchanged in structure.                              |
| Cards               | `--surface-raised` + hairline + `--elevation-pop`. Radius `lg` (16px).                                            |
| Hero / stat cards   | as above, plus one clipped quarter-circle glow in a corner.                                                       |
| Metrics             | Lexend 500, `-0.02em` tracking, **`font-variant-numeric: tabular-nums`** — columns of hours and money must align. |
| Sparklines          | `mint-deep` bars with the final bar in `mint`; not every bar at full accent as today.                             |
| Status pills        | soft tint + full-strength label + a 24%-alpha border of the same hue. Today's are borderless and washed.          |
| Primary button      | `mint` fill, `--ink-mint` label, `--elevation-glow`.                                                              |
| CTA button          | `cta` fill, `--ink-amber` label. Brand-mandated; unchanged.                                                       |
| Inputs              | `--surface-inset` fill, `--border-strong` edge, `mint-glow` focus ring.                                           |
| Tables              | `--surface-raised` body, `--surface-inset` zebra, hairline dividers, sticky header on base.                       |
| Distribution bars   | success / warning / danger — now 88° and 49.9° apart instead of collapsing into two warm blushes.                 |
| Checkboxes, avatars | neutral until checked/active. These are a large share of today's stray teal.                                      |
| Focus               | `mint-glow` 2px, offset 2px. Unchanged mechanism, new colour.                                                     |
| Selection           | `rgb(41 198 198 / 0.26)`.                                                                                         |
| Skeletons           | `rgb(232 236 242 / 0.05)` → `/ 0.10` sheen. Neutral, not teal.                                                    |

**Radii and type scale stay exactly as they are.** The blob language already supplies the softness, and
the repo has 130-odd `rounded-[var(--radius-lg)]` call sites — churning them buys nothing.

---

## 7. Charts

`Reports` needs a categorical ramp, and mint+peach is only two series. Proposed six, verified for
mutual separation:

| Series   | Hex       | L     | C     | H      | on raised |
| -------- | --------- | ----- | ----- | ------ | --------- |
| 1 mint   | `#29C6C6` | 0.752 | 0.121 | 194.9° | 8.45      |
| 2 peach  | `#FFCB97` | 0.876 | 0.089 | 66.2°  | 12.06     |
| 3 violet | `#9E8CFF` | 0.706 | 0.164 | 288.7° | 6.48      |
| 4 green  | `#5CE08C` | 0.813 | 0.167 | 152.7° | 10.58     |
| 5 rose   | `#FF6A7E` | 0.714 | 0.182 | 14.8°  | 6.45      |
| 6 blue   | `#63A6FF` | 0.720 | 0.147 | 256.1° | 7.14      |

Smallest hue gap 32.6° (violet/blue); all six clear 6.45:1 on the card. A first pass used the brand
`sand #DCCFC2` as series 6 and it had to be dropped — at H 67.5° it sat **1.3°** from peach.

Two rules: violet and blue are **chart-only** and must never appear in UI chrome, or the palette
stops being a two-accent system; and series must differ by more than colour (marker shape, dash) per
the repo's `dataviz` skill, whose validator should be run before this ramp is adopted.

---

## 8. Token diff for `app/globals.css`

`:root` carries the dark palette (per `docs/tokens.md`), so this replaces the `:root` block only.
`.light` is untouched except where noted in §9.

```css
:root {
  color-scheme: dark;

  /* Atmosphere */
  --canvas-base: #090a0c;
  --atmo-mint: rgb(41 198 198 / 0.1);
  --atmo-peach: rgb(255 203 151 / 0.06);
  --atmo-dot: rgb(132 244 244 / 0.055);
  --atmo-blob-mint: rgb(41 198 198 / 0.055);
  --atmo-blob-peach: rgb(255 203 151 / 0.045);
  --atmo-grain: 0.04;

  /* Chassis */
  --background: #0e1014;
  --surface-inset: #0b0c0f;
  --card: #15181e;
  --popover: #1e222a;
  --secondary: #1a1d24;
  --muted: #1e222a;
  --sidebar: #0b0c0f;

  /* Type — warm ivory */
  --foreground: #f3efe9;
  --card-foreground: #f3efe9;
  --popover-foreground: #f3efe9;
  --secondary-foreground: #f3efe9;
  --muted-foreground: #b7b2aa;
  --text-subtle: #948f87;

  /* Inks */
  --ink-mint: #04211f;
  --ink-amber: #2a1608;
  --ink-rose: #2a0a10;

  /* Signals */
  --primary: #29c6c6;
  --primary-foreground: var(--ink-mint);
  --accent: #84f4f4;
  --accent-foreground: var(--ink-mint);
  --accent-soft: rgb(41 198 198 / 0.16);
  --accent-line: rgb(132 244 244 / 0.3);
  --cta: #ffcb97;
  --cta-hover: #fab976;
  --cta-foreground: var(--ink-amber);
  --success: #5ce08c;
  --success-soft: rgb(92 224 140 / 0.16);
  --success-foreground: var(--ink-mint);
  --warning: #faab59;
  --warning-soft: rgb(250 171 89 / 0.16);
  --warning-foreground: var(--ink-amber);
  --destructive: #ff6a7e;
  --destructive-soft: rgb(255 106 126 / 0.16);
  --destructive-foreground: var(--ink-rose);

  /* Edges, depth, chrome */
  --border: rgb(232 236 242 / 0.08);
  --border-strong: rgb(232 236 242 / 0.16);
  --input: var(--border-strong);
  --ring: #84f4f4;
  --sidebar-border: rgb(232 236 242 / 0.06);
  --header-bg: rgb(14 16 20 / 0.72);
  --scrim: rgb(9 10 12 / 0.66);
  --skeleton: rgb(232 236 242 / 0.05);
  --skeleton-sheen: rgb(232 236 242 / 0.1);
  --elevation-pop: 0 20px 48px -16px rgb(0 0 0 / 0.72), 0 0 0 1px rgb(232 236 242 / 0.06);

  /* Charts */
  --chart-1: #29c6c6;
  --chart-2: #ffcb97;
  --chart-3: #9e8cff;
  --chart-4: #5ce08c;
  --chart-5: #ff6a7e;
  --chart-6: #63a6ff;
}
```

**Renames this forces.** `--canvas-glow-teal` and `--canvas-glow-warm` disappear into the `--atmo-*`
set. In `.light` they are currently `#ffffff` and a peach — the name `canvas-glow-teal` holding pure
white is already misleading, so the rename is overdue either way. New `@theme inline` entries are
needed for `--surface-inset`, the inks and the chart ramp.

---

## 9. Open decisions

These need an answer before implementation, and only the first is a real fork.

1. **Does a non-teal chassis clear brand review?** The defence is strong — Grey Dark is a brand ramp
   and dark mode is the only place it can be used — but it is a visible departure from the styleguide's
   teal-forward feel, so it should be shown before it is built.
2. **Do the success and danger hues change in light mode too?** Recommend **yes**. A green that means
   "approved" in light and a mint-green that means it in dark is a semantic split with no upside.
   Light-mode equivalents need their own contrast pass against `#ffffff`.
3. **Does the atmosphere ship to light mode?** Recommend **not in this pass**. Light mode is the
   brand kit's native habitat and deserves its own treatment rather than an inversion.
4. **Grain: inline SVG or rasterised WebP?** Ship inline, measure, rasterise if paint cost shows.

---

## 10. Implementation plan

Sequenced so each phase is independently reviewable, and so the enormous baseline churn lands once.

| #   | Phase              | Scope                                                 | Notes                                                                                                   |
| --- | ------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | Chassis + signals  | `app/globals.css` `:root` only                        | No component edits. Every dark visual baseline changes here.                                            |
| 2   | Baseline refresh   | `visual/storybook.spec.ts-snapshots/`                 | `pnpm test:visual:update`, **its own commit**, stating the intentional visual change (repo convention). |
| 3   | Light-mode signals | `.light` block                                        | Only if decision 2 is yes.                                                                              |
| 4   | Atmosphere         | `Atmosphere` component + `globals.css`                | Blocked on the SVG export (§5.2). Mount in `AppShell` + `AuthShell`.                                    |
| 5   | Component polish   | pills, stat cards, sparklines, nav rail, empty states | Per §6. Storybook coverage for each variant, both themes.                                               |
| 6   | Charts             | `ChartPrimitives`, `ReportChartCard`                  | Run the `dataviz` validator first.                                                                      |
| 7   | Docs + QA          | `docs/tokens.md`, `docs/manual-qa-test-plan.md`       | Fold §3–§7 into `tokens.md`; QA scenarios in a separate `docs(qa):` commit.                             |

**Verification gate.** `pnpm verify` after each phase. Phase 1 needs no new tests but _does_ need
`pnpm test:visual` reviewed image-by-image rather than blanket-accepted — it is the one phase where a
regression hides easily in a wall of legitimately-changed screenshots.

**Accessibility gate.** Every ratio in §3 and §4 is verified above, but three things need checking on
a real build: the atmosphere must not reduce any text contrast (it sits behind opaque surfaces, so it
should not — confirm on the auth screen, where copy sits directly on the canvas); the disabled tier
must never be the only signal; and `prefers-reduced-motion` plus `prefers-reduced-transparency` must
both switch the drift off. Research suggests APCA thresholds around Lc 75–90 for body text in dark
mode; worth running the four text tiers through the APCA calculator as a second opinion, since WCAG 2.1
is known to be unreliable at this polarity.

---

## 11. Inspiration and sources

- [UI Color Trends to Watch in 2026 — Updivision](https://updivision.com/blog/post/ui-color-trends-to-watch-in-2026) · [The Modern Color Palette: UI/UX Color Trends That Define 2026 — Recursion](https://recursion.software/blog/ui-color-trends-2026) — dark-first as the default rather than the variant; teal/cyan as the accent family that stays legible without irritating.
- [Geist — Vercel](https://vercel.com/geist/material) · [Geist breakdown — DesignSystems.one](https://www.designsystems.one/design-systems/vercel-geist) — a deliberate step for every divider, border and disabled state, rather than ad-hoc alphas.
- [Linear design system — Refero](https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1) — elevation carried by hairline borders and surface steps instead of shadow stacks; the four-level surface ladder that §3.1 follows.
- [Dark Mode First: Why Your SaaS Dashboard Should Default to Dark — Brent Haskins](https://brenthaskins.com/blog/dark-mode-first-saas-dashboard) · [35 SaaS Dashboard Design Examples — 925 Studios](https://www.925studios.co/blog/saas-dashboard-design-examples-2026) — never pure black; build depth from neutral layers _before_ introducing colour.
- [Designing Luminance-First Color Systems with OKLCH — BoldVanta](https://www.boldvanta.com/design/designing-luminance-cefirst-color-systems-with-oklch-tokens-ramps-and-real-ceworld-pitfalls.html) · [OKLCH explained for designers — UX Collective](https://uxdesign.cc/oklch-explained-for-designers-dc6af4433611) — luminance first, then hue and chroma; why brightness-sliding a brand colour into dark mode produces mud.
- [Grainy Gradients — CSS-Tricks](https://css-tricks.com/grainy-gradients/) · [SVG Filter Effects: Creating Texture with feTurbulence — Codrops](https://tympanus.net/codrops/2019/02/19/svg-filter-effects-creating-texture-with-feturbulence/) · [gggrain — fffuel](https://www.fffuel.co/gggrain/) — the `baseFrequency`/`numOctaves` grain technique in §5, and the note that filters are cheap in bytes and expensive in CPU.
- [Web Design Trends 2026 — Fireart](https://fireart.studio/blog/the-best-web-design-trends/) · [Top 16 Web Design Trends for 2026 — WP Creative](https://wpcreative.com.au/web-design-trends/) — organic, anti-grid composition: soft blobs and biomorphic shapes bending a grid that is still structurally there.
- [APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html) · [Why APCA?](https://git.apcacontrast.com/documentation/WhyAPCA) — polarity-aware contrast, and why light-on-dark needs its own thresholds.
- **Internal:** the styleguide's _Colors_ and _Graphical elements_ frames (Grey Dark and Beige ramps, blob silhouettes, dot grids, line-art); `claude_design_proto/_ds/**/colors_and_type.css`; the `AuthGyroscope` comments in `app/globals.css`, whose reduced-motion and frozen-frame constraints §5.3 inherits.

---

## 12. The relight pass (2026-08)

Status: **implemented**. The verdict on §1–§11 as shipped was that the interface "resembles
military camouflage". That is a fair reading and it has a measurable cause: the pass cured the
monochrome teal wash of §1 and overshot into drabness. Camouflage is, precisely, low value
contrast plus low-chroma khaki/olive/drab-teal — and the shipped theme had all four.

Every number below was computed, not estimated. The brief was to keep the palette, the forms and
the assets, and to make the result vibrant, modern and alive.

### 12.1 What actually caused the camouflage read

**a) The value ladder was too narrow to separate anything.** §3.1's ramp spans L 0.145 → 0.251.
A card sat 0.036 L above the canvas behind it — below the threshold where an edge reads, so panels
dissolved into their ground. This was the single largest contributor.

|      | void  | inset | base  | card  | hover | over  | card−base | card−void |
| ---- | ----- | ----- | ----- | ----- | ----- | ----- | --------- | --------- |
| §3.1 | 0.145 | 0.155 | 0.173 | 0.209 | 0.231 | 0.251 | 0.036     | 0.064     |
| now  | 0.134 | 0.160 | 0.192 | 0.243 | 0.272 | 0.300 | **0.051** | **0.109** |

**b) The chart ramp was literally a camouflage swatch set.** `#C08442` is tan, `#3FA164` olive,
`#2CA2A2` drab teal, `#B23A4E` brick. The §7 note blames the validator's mark-lightness band, but
that is not what happened: every one of those steps sat _inside_ the band while using only 59–80%
of the chroma available at its own lightness. The band was never the constraint — the chroma
headroom simply went unspent.

**c) The atmosphere composited to mud.** A composite carries `alpha × source` chroma, so the §5
warm layers — a low-chroma peach at 6–8.5% over near-black — landed at C 0.007 and hue 48°. That
is a desaturated brown. The wave made it worse by being a _filled_ silhouette at 6px blur: a large
soft-edged warm mass with a still-legible edge, which is the definition of a camouflage blotch.

**d) The discipline rule was doing exactly what it said.** "Mint is a signal, never a surface,
under ~5% of the pixels" (§2) is what prevented anything on screen from having life in it. Paired
with one flat elevation, no gradients, and a `--shadow-accent-glow` of
`0 10px 26px -12px var(--accent-line)` — a 30%-alpha colour pulled in 12px, i.e. invisible — there
was no lit element anywhere in the interface.

### 12.2 The four moves

**1. Pull the ladder apart.** The table above. Nothing else buys as much.

**2. Keep the semantics, drop the pixel budget.** Mint still means system/active/primary, peach
still means the CTA, and **mint is still never the page or sidebar background** — that rule is what
cured the original complaint and it stands. What is gone is the ~5% cap: colour may now carry
gradients, glows and tinted surfaces at whatever size the design needs.

**3. Spend a capped budget on chroma, not brightness.** This is the generalisable finding. The
atmosphere's ceiling is a _luminance_ ceiling (§12.3), and at a fixed resulting luminance the
choice of source colour changes the returned chroma enormously:

| family | pale source           | C returned | saturated source    | C returned | gain  |
| ------ | --------------------- | ---------- | ------------------- | ---------- | ----- |
| cool   | `mint-glow` `#84F4F4` | 0.034      | `mint` `#29C6C6`    | 0.054      | +56%  |
| warm   | `peach` `#FFD9B4`     | 0.013      | `warning` `#FAAB59` | 0.044      | +245% |

The lightest step spends the whole budget on brightness and returns almost no colour. Both
atmosphere families therefore now draw from the saturated middle of their ladder. Chroma is up
62–103% across the four glow layers with no loss of legibility.

**4. Give the theme a second, coloured elevation.** `--elevation-glow` and
`--elevation-glow-warm`, exposed as `shadow-accent-glow` / `shadow-cta-glow`. Two, so a warm
control is lit by warm light. This is the §3.3 `--elevation-glow` that was specified and never
shipped.

### 12.3 The constraint that shapes the atmosphere

`AuthForm` renders `--muted-foreground` **directly on the canvas** — it has no card of its own —
so the brightest point two overlapping atmosphere layers can reach must still carry that tier at
4.5:1. On `--background`, the lighter of the two bases and therefore the worse case, that puts a
hard ceiling on the ground of **relative luminance 0.0607**. The shipped values peak at 0.0525.

This is why the atmosphere cannot simply be turned up, and why move 3 above exists at all. Verified
stacked cases (muted-foreground on the composite): mint aurora + mint blob on `--background` 4.94;
warm pair 4.95; mint pair on the void 5.58. `--atmo-dot` is excluded from the stack — 1px dots on a
24px grid is ~0.14% coverage and the lattice is masked out of the content area, so modelling it as
a full third layer would fail a case that cannot occur.

Two further rules fell out of it: **fills bloom, lines stay crisp** — the wave is now stroke-only
line-art alongside the arc, and the blobs blur 40px rather than 26px — and a _complete_ shape reads
as a sticker, which is why the `StatCard` corner glow lost its outline ring when `--accent-line`
rose to 42%.

### 12.4 The chart ramp, re-derived

Same six hues, same fixed order, chroma spent. Each step now runs at ~95% of the sRGB gamut ceiling
for its hue, capped so no series exceeds ~1.9× the chroma of the least-saturated — cyan's ceiling
in the dark band is barely half of violet's, and a flat fraction of each ceiling produces a set
where violet and rose shout while mint whispers, which is not a categorical ramp.

| slot     | was       | C     | now       | C     | gain |
| -------- | --------- | ----- | --------- | ----- | ---- |
| 1 mint   | `#2CA2A2` | 0.100 | `#1EA5A5` | 0.107 | +6%  |
| 2 amber  | `#C08442` | 0.111 | `#CE801A` | 0.141 | +28% |
| 3 violet | `#715CC7` | 0.160 | `#8969F9` | 0.206 | +29% |
| 4 green  | `#3FA164` | 0.130 | `#199552` | 0.144 | +11% |
| 5 rose   | `#B23A4E` | 0.155 | `#F64C6A` | 0.205 | +32% |
| 6 blue   | `#427BC6` | 0.131 | `#1681F9` | 0.200 | +53% |

**Lightness is staggered deliberately.** Green and rose are adjacent in the fixed order and
collapse under deuteranopia when they share a lightness — ΔE 1.3 at equal L, against a target of
8.0. The stagger is what carries that pair, and it is why the ramp is not simply the six brand hues
at full strength. Do not flatten it "for consistency".

All five `dataviz` validator checks **PASS** against both the dark card `#1C2027` and white, with
no contrast relief warning in either mode: band, chroma floor, CVD separation (worst adjacent ΔE
8.7), normal-vision floor (22.5), contrast ≥ 3:1. The ramp stays theme-stable and `.light` carries
no override.

### 12.5 The one palette addition

`--destructive-bright` `#FF91A3` — the lighter rose step, same hue and chroma as `--destructive` at
L 0.834. Rose is the darkest of the four signals (L 0.714) and cannot serve as both the fill and
the label on its own tint. It was already marginal before this pass (4.54:1 on the old popover) and
the lifted ladder drops it to 3.92:1. The new step is exactly the relationship `--accent` already
has to `--primary`; it is a lightness step inside an existing family, not a new hue. Use it for a
rose label _on_ a rose tint; keep `--destructive` for fills and for text on a plain card. Light
aliases it to `--destructive`, whose tints are solid pastels.

The `*-soft` alphas also became per-tone (accent 0.24, warning 0.21, success and danger 0.22) — each
the loudest tint whose own label still clears 4.5:1 on every surface it can land on, `--popover`
included. Warning is the tightest and is the reason a flat number does not work.

### 12.6 Verified

- Every text tier on all six surfaces; every signal label on its own tint over `base`, `card`,
  `secondary` and `popover`; body text on all four tints; all three inks on their fills; the chart
  ramp against the card; the atmosphere's stacked worst cases. All pass.
- `--text-subtle` was lifted `#948F87` → `#9E9991` (L 0.652 → 0.684): the old value was tuned
  against a `--popover` at L 0.251 and fell to 4.25:1 against the new one at L 0.300.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` clean; all 27 changed visual baselines reviewed.

**Baseline gotcha.** `maxDiffPixelRatio: 0.01` with Playwright's default per-pixel `threshold: 0.2`
means a theme-wide recolour of this size **passes** `pnpm test:visual` without regenerating
anything — the per-pixel deltas fall under the threshold, so nothing is counted as different. Use
`--update-snapshots=all`; a plain `--update-snapshots` will silently leave the old baselines in
place and the diff will look like the theme never changed.

### 12.7 Light mode

The `.light` **token palette is unchanged**, bar three additions that exist only so the shared
`@theme` names resolve: `--destructive-bright` (aliased to `--destructive`), `--elevation-glow` and
`--elevation-glow-warm` (both set to the literal value `--shadow-accent-glow` already held, so
light renders as before).

Component treatments are shared between themes, so light does pick up the structural polish —
the CTA gradient and glow, stronger status-pill borders, gradient sparkline bars, the opaque
`EmptyState` fill. Its own redesign (`docs/light-mode-redesign.md`, "Ivory Ledger") remains a
proposal and is untouched.
