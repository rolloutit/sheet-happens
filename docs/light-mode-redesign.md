# Light Mode Redesign — "Ivory Ledger"

Status: **proposal** (docs/light-mode-redesign, 2026-08). Not implemented; no token or component
changes ship with this document. It is the light-theme counterpart of
`docs/dark-mode-redesign.md` ("Graphite Aurora") and builds on everything that redesign shipped —
the cross-theme signal hues, the theme-stable chart ramp and inks, the single-elevation
discipline, the opaque-surface rule, and the `Atmosphere` component with its motion constraints.
Where the dark doc's proposal deviated in implementation, this document follows the shipped
reality, not the original text.

Every contrast ratio and OKLCH coordinate below was computed, not estimated. Ratios are WCAG 2.1
(`(L1+0.05)/(L2+0.05)`); `L`/`C`/`H` are OKLCH; composites are CSS alpha blending in sRGB. ΔE is
Euclidean distance in OKLab (roughly: 0.02 is a subtle difference, 0.05 is a clearly different
colour).

---

## 1. What is actually wrong today

The current `.light` block is not a designed system — it is a verbatim transcription of the
prototype (`claude_design_proto/shell/theme.css`), and it predates Graphite Aurora. Dark got a
redesign; light got two retuned signal values and was otherwise carried forward. It is closer to
correct than the old dark theme was — the chassis is warm and brand-true, and the signal hue
geometry was already fixed cross-theme — so this is a tightening, not a teardown. But the
weaknesses are real and measurable.

**a) The third text tier fails WCAG on every surface it touches.** `--text-subtle` `#8a938f` is
the token for table headers, placeholders and de-emphasised numbers — running text, not decoration:

| `#8a938f` on | white    | `--background` | `--secondary` | `--muted` | canvas   |
| ------------ | -------- | -------------- | ------------- | --------- | -------- |
| contrast     | **3.16** | **3.03**       | **2.91**      | **2.70**  | **2.67** |

Nothing clears 4.5:1. (`--foreground` and `--muted-foreground` pass everywhere — 12.95+ and
5.25+ — the failure is confined to this tier.)

**b) The entire warning family fails.** When success and danger were re-derived for light
(`#247f48`, `#be3c52`), warning was left at the prototype's `#b07a1e`:

| Pairing                                      | Ratio    |
| -------------------------------------------- | -------- |
| `--warning` on white                         | **3.72** |
| `--warning` on `--background`                | **3.57** |
| `--warning` on `--warning-soft`              | **3.26** |
| `--warning-foreground` `#fff8e7` on the fill | **3.51** |
| white on the fill                            | **3.72** |

Every warning text pairing is below 4.5:1. And its hue sits at 75.0° — 10° off the dark theme's
64.7° amber, so the one signal family that escaped the cross-theme hue alignment is also the one
that fails contrast.

**c) The warm tints camouflage against the warm chassis.** The `*-soft` pastels are solid colours
(correctly — alpha tints can't produce them), but two of the four sit almost exactly on the beige
neutrals they're supposed to stand out from:

| Tint                           | OKLCH                   | ΔE vs `--muted` | ΔE vs `--secondary` |
| ------------------------------ | ----------------------- | --------------- | ------------------- |
| `--warning-soft` `#fbefd6`     | L 0.955 C 0.035 H 85.4° | **0.0206**      | 0.0300              |
| `--destructive-soft` `#fee8e9` | L 0.949 C 0.024 H 14.4° | **0.0221**      | 0.0315              |

The warning tint's hue (85.4°) is _inside_ the chassis's own hue band (the beige neutrals run
76–85°) — a warning pill on a `bg-muted` chip or a beige table stripe is a slightly different
beige. This is light's version of the dark theme's tint-contamination problem: not alpha bleeding,
but pigment camouflage.

**d) The ink is three different pens.** Dark's diagnosis was "every neutral is teal." Light's
inverse: the surfaces are consistent, but every foreground is a different colour, none of them
deliberate:

| Token                          | Hex       | OKLCH H    | Family     |
| ------------------------------ | --------- | ---------- | ---------- |
| `--foreground`                 | `#0a2930` | **215.4°** | teal-dark  |
| `--muted-foreground`           | `#5b6266` | **232.6°** | blue-grey  |
| `--text-subtle`                | `#8a938f` | **167.6°** | green-grey |
| shadow ink (`--elevation-pop`) | `#0c423f` | 189.4°     | teal       |
| scrim ink                      | `#0c1e1c` | 186.3°     | teal       |
| skeleton ink                   | `#0a2930` | 215.4°     | teal-dark  |

A 65° hue spread across three text tiers that are supposed to read as one ladder. Where dark got a
disciplined two-hue system (cool graphite surfaces, warm ivory type), light has a warm chassis and
a junk drawer of cool inks.

**e) The structure has fewer steps than tokens.** `--sidebar` = `--card` = white, so navigation
sits on the same plane as content — dark deliberately put the sidebar _below_ the canvas.
`--secondary` = `--surface-inset` (both `#faf5ee`). `--muted` (L 0.946) is within ΔL 0.003 of the
canvas (L 0.943). Seven surface tokens resolve to about three and a half distinct planes, with the
neutral hue wandering 76.6°→84.6° between them.

**f) Five values are transcription drift off the brand ramp.** Not a visual failure — a
maintenance one. Each of these is within ΔE 0.008 of a styleguide step without being it:

| Token             | Current   | Nearest brand step  | ΔE     |
| ----------------- | --------- | ------------------- | ------ |
| `--canvas-base`   | `#f4ebdd` | beige-600 `#f4ece3` | 0.0076 |
| `--surface-inset` | `#faf5ee` | beige-500 `#f8f2eb` | 0.0083 |
| `--muted`         | `#f4ece1` | beige-600 `#f4ece3` | 0.0027 |
| `--border-strong` | `#dccfc0` | beige-900 `#dccfc2` | 0.0027 |
| `--cta-hover`     | `#f9c088` | amber-700 `#f9c289` | 0.0048 |

The light theme is _almost_ the brand's Beige ramp. It should simply be the ramp.

**g) The brand layer doesn't exist.** `.light` hides the entire `Atmosphere` — blobs, wave,
swoosh, dot lattice, grain — even though light is the brand kit's native habitat: every silhouette
in `src/components/layout/Atmosphere/svgs/` was drawn as ink on a warm page. And the one remnant,
the aurora, stores pure `#ffffff` in `--atmo-mint` — the same name/value mismatch the dark doc
flagged when the token was still called `--canvas-glow-teal`.

---

## 2. Design thesis

> **A fresh ledger page: warm paper, graphite ink, teal signals — the brand shapes printed on the
> page, not shining through it.**

The same three systems as Graphite Aurora, translated to the opposite polarity:

| System         | Job                                  | Colour                                             |
| -------------- | ------------------------------------ | -------------------------------------------------- |
| **Chassis**    | structure — surfaces, borders, depth | the brand Beige ramp + white, verbatim             |
| **Signals**    | meaning — state, action, status      | teal · green · amber · rose, same hues as dark     |
| **Atmosphere** | brand feeling — the background layer | the silhouettes as printed pastels with echo lines |

Two moves carry the character, and both are mirrors of dark's:

**Cool ink on a warm chassis.** Dark runs cool graphite surfaces (H ≈ 264°) under warm ivory type
(H ≈ 79°) — a 174° opposition. Light exchanges the roles: warm beige surfaces (H ≈ 71–85°) under
**cool graphite type** (H ≈ 265°, C ≈ 0.010–0.012) — a 163° opposition. Same two hues, same
tension, swapped jobs. The graphite ladder is literally the hue of dark's chassis: light's primary
ink `#1d1f24` is a near-neighbour of dark's `--secondary` surface `#1a1d24`. One system, two
exposures.

**Chroma falls as surfaces lift.** Dark's surfaces gain chroma with elevation (C 0.005 → 0.016) —
lifted surfaces gather ambient light. Light inverts it: C 0.0148 at the void falling to 0 at the
white card — lifted surfaces shed pigment as they approach the light. Same physics, opposite
exposure.

And the discipline rule carries over verbatim, because it is what keeps both themes calm:

> **Teal is a signal, never a surface.** Active navigation, focus, links, the running timer, the
> primary action — and under ~5% of the pixels on any screen. Structure is always neutral.

One honest constraint shapes everything below: light's structural range is **half** of dark's
(ΔL 0.053 from void to white, versus dark's 0.106 from void to popover), because elevation
saturates at white. Light therefore leans harder on hairlines and the single shadow, and its
hover states _dip toward the canvas_ instead of lifting past the card — there is nothing above
white to lift to.

---

## 3. The chassis

### 3.1 Surfaces

Brand beige steps and white — nothing invented. Ordered by lightness:

| Role   | Token(s)                       | Hex       | Brand step | L     | C      | H     | Use                                    |
| ------ | ------------------------------ | --------- | ---------- | ----- | ------ | ----- | -------------------------------------- |
| void   | `--canvas-base`, `--muted`     | `#f4ece3` | beige-600  | 0.947 | 0.0148 | 70.9° | behind everything; muted fills, chips  |
| inset  | `--surface-inset`, `--sidebar` | `#f8f2eb` | beige-500  | 0.964 | 0.0113 | 71.9° | sidebar, inputs, wells, table stripes  |
| hover  | `--secondary`                  | `#faf6f1` | beige-400  | 0.975 | 0.0079 | 73.7° | hover fills, secondary fills           |
| base   | `--background`                 | `#fdfaf4` | beige-300  | 0.986 | 0.0085 | 84.6° | app canvas (unchanged — already brand) |
| raised | `--card`, `--popover`          | `#ffffff` | white      | 1.000 | 0.0000 | —     | cards, tables, panels, overlays        |

Chroma falls monotonically toward white (0.0148 → 0.0113 → 0.0079 → ~0 → 0; beige-300's 0.0085 is
the brand ramp's own wobble, kept verbatim rather than corrected). The sidebar moves off the card
plane down to `--surface-inset`, mirroring dark: navigation recedes, content comes forward.
Popovers share white with cards — depth above the card plane is carried entirely by
`--elevation-pop`, which is the honest consequence of the saturating ramp.

### 3.2 Type — cool graphite

One hue family (H ≈ 265°), one chroma band (C 0.010–0.012), four tiers. Contrast on every surface:

| Tier      | Hex       | L     | C      | H      | white | base  | hover | inset | muted/void |
| --------- | --------- | ----- | ------ | ------ | ----- | ----- | ----- | ----- | ---------- |
| primary   | `#1d1f24` | 0.239 | 0.0100 | 268.3° | 16.49 | 15.83 | 15.32 | 14.83 | 14.10      |
| secondary | `#4c4f56` | 0.427 | 0.0122 | 267.2° | 8.20  | 7.87  | 7.62  | 7.38  | 7.01       |
| tertiary  | `#686c73` | 0.530 | 0.0120 | 261.8° | 5.27  | 5.06  | 4.90  | 4.75  | **4.51**   |
| disabled  | `#95989f` | 0.679 | 0.0108 | 267.3° | 2.89  | 2.77  | 2.68  | 2.60  | 2.47       |

All three live tiers clear **4.5:1 on every surface including the beige-600 void** — the tertiary
tier was searched downward until it did (the binding constraint is `--muted`, where today's
equivalent scores 2.70). Disabled is deliberately below 4.5:1, exactly like dark's, and must never
be the sole carrier of information; it is a tier, not yet a token, matching dark.

Mapping: `--foreground`/`--card-foreground`/`--popover-foreground`/`--secondary-foreground` →
primary; `--muted-foreground` → secondary; `--text-subtle` → tertiary. The secondary tier gets
_stronger_, not weaker (8.20 vs today's 6.21 on white): with the tertiary tier finally legal,
`--muted-foreground` no longer has to stretch across both jobs.

### 3.3 Borders and depth

Warm hairlines from the same Beige ramp — cool grey dividers (the styleguide's grey-500 is a
marketing-page assignment) would read dirty on warm surfaces:

| Token              | Value     | Brand step | vs white | vs inset | Dark equivalent (composited) |
| ------------------ | --------- | ---------- | -------- | -------- | ---------------------------- |
| `--border`         | `#e8dacc` | beige-800  | 1.37     | 1.22     | 1.22 (`#26292f` on raised)   |
| `--border-strong`  | `#dccfc2` | beige-900  | 1.53     | 1.37     | 1.56 (`#373a40` on raised)   |
| `--sidebar-border` | `#efe5db` | beige-700  | —        | 1.12     | —                            |

Same weight class as dark's hairlines, so edges feel consistent across themes. As in dark,
hairlines are structure, not affordance — inputs are identified by fill + border + focus ring
together, never the hairline alone.

`--elevation-pop` stays exactly as shipped: `0 18px 44px -14px rgb(12 66 63 / 0.22), 0 0 0 1px rgb(12 66 63 / 0.05)`.
Its shadow ink `#0c423f` **is** brand mint-900, and rgba(12, 66, 63) is the styleguide's own shadow
recipe (`--shadow-1..3`) — the one sanctioned place teal touches the chassis. The single-elevation
discipline stays.

---

## 4. The signals

Same four hues as dark — with this proposal, **all four** families are hue-aligned across themes
(the shipped state aligned green and rose; this adds amber). Values are searched so that **every
text pairing clears 4.5:1 on every chassis surface, including `--muted` and each family's own
soft** — a stricter matrix than the shipped tuning, which stopped at `--secondary`:

| Signal        | Hex       | L     | C      | H      | white | base | hover | inset | muted | own soft | white on fill |
| ------------- | --------- | ----- | ------ | ------ | ----- | ---- | ----- | ----- | ----- | -------- | ------------- |
| accent (teal) | `#1f7475` | 0.511 | 0.0776 | 196.2° | 5.51  | 5.29 | 5.12  | 4.95  | 4.71  | 4.91     | 5.51          |
| success       | `#1e7b44` | 0.516 | 0.1209 | 152.5° | 5.29  | 5.07 | 4.91  | 4.76  | 4.52  | 4.70     | 5.29          |
| warning       | `#9c5c01` | 0.536 | 0.1200 | 64.8°  | 5.32  | 5.11 | 4.95  | 4.79  | 4.55  | 4.50     | 5.32          |
| danger        | `#be3c52` | 0.550 | 0.1655 | 14.7°  | 5.31  | 5.09 | 4.93  | 4.77  | 4.54  | 4.54     | 5.31          |

Pairwise hue separation — essentially identical to dark's geometry (dark's values in parentheses):

|             | accent           | success        | warning      |
| ----------- | ---------------- | -------------- | ------------ |
| **success** | **43.7°** (42.2) |                |              |
| **warning** | 131.4° (130.2)   | 87.7° (88.0)   |              |
| **danger**  | 178.5° (179.9)   | 137.8° (137.9) | 50.1° (49.9) |

The same geometry, printed darker. What changes and what doesn't:

- **accent `#1f7475`** — unchanged. It is brand mint-700, a constant.
- **danger `#be3c52`** — unchanged. The shipped value already passes the full matrix.
- **success `#247f48` → `#1e7b44`** — hue preserved to within hex rounding (152.5° vs the shared
  152.7°), darkened just enough to fix the one failing cell: today it scores **4.27** on
  `--muted`. The invariant keeps the hue; this retune is the sanctioned kind, with numbers.
- **warning `#b07a1e` → `#9c5c01`** — the real fix. Hue realigned from 75.0° to **64.8°**, on top
  of dark's 64.7° amber, and darkened until the whole row passes (today: 3.26–3.72 everywhere).
  `--warning-foreground` becomes plain `#ffffff` (5.32), replacing the failing `#fff8e7` (3.51).

All four fills take white labels at ≥ 5.29 — light needs no new ink tokens. The exception is the
CTA, which is a _light_ fill in both themes and keeps a dark ink: `--cta-foreground` becomes
`var(--ink-amber)` (`#2a1608`, theme-stable, already in `:root`) — 11.70 on the CTA, 10.77 on
hover — replacing the one-off `#20140a` (12.22; the change is consolidation, not contrast).

### 4.1 Soft tints: one recipe, honest limits

Solid pastels, as the token doc requires (`.light` softs cannot be alpha tints). All four are
generated from one recipe — L 0.943–0.956, chroma pushed to 2–2.6× the chassis's — instead of
today's four unrelated colours:

| Tint                 | Hex       | L     | C      | H      | ΔE vs muted | C ratio vs chassis | pill edge (24%) |
| -------------------- | --------- | ----- | ------ | ------ | ----------- | ------------------ | --------------- |
| `--accent-soft`      | `#d4f9f8` | 0.956 | 0.0382 | 194.5° | 0.0488      | 2.6×               | `#a9d9d9` 1.37  |
| `--success-soft`     | `#def8e4` | 0.955 | 0.0380 | 152.5° | 0.0395      | 2.6×               | `#b0dabe` 1.37  |
| `--warning-soft`     | `#ffe8d5` | 0.945 | 0.0357 | 62.0°  | 0.0213      | 2.4×               | `#e7c6a2` 1.37  |
| `--destructive-soft` | `#ffe8e9` | 0.950 | 0.0252 | 14.6°  | 0.0212      | 1.7×               | `#efbfc5` 1.39  |

(Destructive-soft lands one channel away from the shipped `#fee8e9` — ΔE 0.0014; it was already
right.) Pairwise, the four tints sit ΔE 0.026–0.069 apart, with the closest pair
(warning/destructive) separated by 47° of hue.

The honest limit: **a warm pastel cannot move far from a warm chassis.** Near white, the sRGB gamut
caps orange/rose chroma, so warning-soft and destructive-soft are physically stuck at ΔE ≈ 0.021
from `--muted` — better hue positioning (62.0° vs today's 85.4°, out of the chassis band) and a
2.4× chroma ratio are all the gamut allows. The redesign therefore adopts dark's §6 pill treatment
as _mandatory_ in light: **soft tint + full-strength label + a 24%-alpha same-hue border**
(edge ratios 1.37–1.39 above). The border is what makes a warning pill on a beige stripe
unambiguous; the tint alone never will be.

### 4.2 The brand ladder in light

The teal ladder works top-down in light — the deep end is for text and fills, the bright end for
echoes and selection:

| Step      | Hex       | on white | on void | Use in light                                  |
| --------- | --------- | -------- | ------- | --------------------------------------------- |
| mint-900  | `#0c423f` | 11.25    | 9.62    | shadow ink (`--elevation-pop`), deep emphasis |
| mint-800  | `#196869` | 6.51     | 5.57    | pressed states                                |
| mint-700  | `#1f7475` | 5.51     | 4.71    | **accent text & fills, ring** (`--primary`)   |
| mint-500  | `#2d9494` | 3.64     | 3.11    | sparkline bars, non-text accents              |
| mint-300  | `#29c6c6` | 2.10     | 1.80    | selection tint, atmosphere fills — never text |
| amber-600 | `#ffcb97` | 1.47     | 1.26    | the CTA fill (brand)                          |
| amber-700 | `#f9c289` | —        | —       | CTA hover (snapped from `#f9c088`)            |
| amber-900 | `#faab59` | 1.90     | 1.63    | atmosphere lines & fills — never text         |

`::selection` stays `rgb(41 198 198 / 0.26)` globally — composited on white it is `#c7f0f0`, and
primary ink on it reads at 13.47.

---

## 5. The atmosphere

Dark's translation rule was: _in dark mode the brand shapes stop being ink and become light._
Light gets the inverse, which is no translation at all — this is the kit's native medium:

> **In light mode the brand shapes go back to being ink.** A blob is a printed pastel with its
> offset echo line — pigment on paper, not light in a room.

The component does not change. Same two silhouettes (`Vector copy 2`, `Vector-1 copy 2`), same
wave and swoosh, same anchors, same drift keyframes, same gradient-fill-plus-echo structure. Only
the `.light` token values change, plus one CSS rule: `.light` stops hiding `.sheet-atmosphere`
(the grain stays hidden — see Layer 4). Layer by layer, with composites over the void `#f4ece3`:

### Layer 0 — Void

`--canvas-base: #f4ece3` (beige-600, snapped from `#f4ebdd`). The page.

### Layer 1 — Aurora

Light keeps its shipped composition and geometry (the smaller radials; cool top-right, warm
bottom-left — the same arrangement as dark, so the themes feel like two exposures of one room).
Two value changes:

| Token          | Value                     | Composite over void | L                           | Meaning                        |
| -------------- | ------------------------- | ------------------- | --------------------------- | ------------------------------ |
| `--atmo-mint`  | `rgb(242 251 250 / 0.95)` | `#f2faf9`           | 0.947 → **0.979**           | daylight off the top-right     |
| `--atmo-peach` | `rgb(253 207 174 / 0.45)` | `#f8dfcb`           | 0.947 → **0.919**, C 0.0385 | warm pigment wash, bottom-left |

`--atmo-mint` stops storing pure white — the token finally holds a mint-white, fixing the
name/value mismatch the dark doc flagged. Note the polarity: in light, the cool corner is _light_
(L rises) and the warm corner is _pigment_ (L falls, chroma rises). Both corners stay within
ΔL 0.03 of the void — presence, not spotlight.

### Layer 2 — Blobs

Printed pastels with crisp echoes. The fill gradient and 26px blur dissolve the pastel into a
wash exactly as they dissolve the dark glow; the near-crisp echo line carries the form in both
themes, so no blur values change:

| Token               | Value                    | Composite over void | vs void  |
| ------------------- | ------------------------ | ------------------- | -------- |
| `--atmo-blob-mint`  | `rgb(41 198 198 / 0.12)` | `#dce7e0`           | 1.08     |
| `--atmo-blob-peach` | `rgb(250 171 89 / 0.14)` | `#f5e3d0`           | 1.07     |
| `--atmo-line-mint`  | `rgb(31 116 117 / 0.25)` | `#bfcec8`           | **1.39** |
| `--atmo-line-peach` | `rgb(250 171 89 / 0.5)`  | `#f7cc9e`           | **1.27** |

The fills whisper (1.07–1.08); the echo lines are the visible signature (1.27–1.39), exactly the
styleguide's fill-plus-offset-outline device. The wave ridge inherits the peach fill and the
swoosh the mint line, unchanged in geometry.

### Layer 3 — Dot lattice

Ink dots, not glow dots: `--atmo-dot: rgb(29 31 36 / 0.1)` — graphite at 10%, compositing to
`#dfd8d0` (1.21 against the void). Same 24px grid, same gutter mask (transparent centre-top,
opaque toward the edges).

### Layer 4 — Grain

**Does not ship in light.** Grain exists in dark because 8-bit near-black radials band visibly;
the light aurora spans ΔL ≈ 0.03 across enormous radii at L ≈ 0.95, where 8-bit quantisation steps
are far below perceptual threshold — and white-alpha noise composites to nothing on a near-white
page anyway. `.light .sheet-grain { display: none }` stays, and `--atmo-grain: 0` in `.light`
documents the intent.

### Layer 5 — Accent line-art

Same jobs as dark: empty-state doodles (mint-700 stroke, ~45% alpha, replacing generic icons —
still the shared follow-up now that the exports exist), quarter-circles clipped inside stat cards,
the short stroke as a heading rule. One light-specific item:

**AuthGyroscope needs a light retint.** Its cyan glows (`#3affff` cores, additive box-shadows) are
hard-coded for a dark room and wash out on paper. The light treatment turns the same geometry into
ink — indicative values, tuned in implementation under the unchanged motion constraints:

| Element       | Dark (shipped)               | Light (proposed)                                               | Check                                  |
| ------------- | ---------------------------- | -------------------------------------------------------------- | -------------------------------------- |
| dot cores     | `#3affff` radial + glow      | mint-700 `#1f7475` radial, no additive glow                    | 4.71 vs void                           |
| trails/comets | `rgb(58 255 255 / …)` conics | `rgb(31 116 117 / …)` conics                                   | head composite `#549291`, 3.04 vs void |
| aura/halo     | mint glows                   | `rgb(41 198 198 / 0.14)`                                       | 1.09 vs void (a breath)                |
| hub tile      | white glass, cyan shadow     | white glass kept; hairline `rgb(29 31 36 / 0.1)`, brand shadow | —                                      |

These land as `.light .auth-gyro-*` overrides in `globals.css`; keyframes, timings and the frame-0
composition are untouched.

### 5.1 Where the atmosphere is allowed to be

The gutter rule carries over verbatim: surfaces are opaque, so the layer lives in page margins,
behind empty states, on the auth screen, around the dashboard hero. One rule is new, and it is
backed by the composite table:

> **Only the primary and secondary text tiers may sit directly on the canvas.** Over the deepest
> atmosphere composite (the mint echo line, `#bfcec8`), primary reads at 10.11 and secondary at
> 5.03 — but tertiary bottoms out at **3.23**. Tertiary and disabled text always sit on an opaque
> surface.

This matches current usage — the auth screen's copy (the only canvas-dwelling text) uses the
primary and secondary tiers — and becomes a verification item in §10.

### 5.2 Integration and motion

Nothing changes. The `Atmosphere` component stays mounted `absolute` inside `AppShell` and
`AuthShell` (keeping it off the auth brand panel), content stays at `z-index: 2`, and the drift
obeys the two load-bearing constraints from `globals.css` exactly as dark does: every loop's
frame 0 is its resting state (centred, unscaled), because `prefers-reduced-motion` collapses each
loop to one iteration and the visual baselines freeze infinite animations at frame 0; and
`prefers-reduced-transparency` switches the drift off. Prime-numbered periods (120s/170s/90s) are
already in the shipped keyframes. Frame 0 of the light atmosphere is therefore a deliberate
composition of printed shapes — which is precisely what the brand kit's static pages look like.

---

## 6. Component treatments

| Element             | Treatment                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar             | `--surface-inset` beige-500 — recedes below the canvas. Inactive items tertiary; hover `--secondary` (lifts toward white).       |
| Active nav item     | `--accent-soft` fill + mint-700 label (4.91 on the soft) + 2px rounded rail, gradient mint-700→mint-500.                         |
| Header              | `--header-bg` (beige-300 at 82%) + blur, hairline underneath. Unchanged.                                                         |
| Cards               | white + `#e8dacc` hairline + `--elevation-pop`. Radius `lg` (16px), unchanged.                                                   |
| Hero / stat cards   | as above, plus one clipped quarter-circle in `--atmo-line-mint` ink bleeding out of a corner.                                    |
| Metrics             | Lexend 500, `-0.02em`, `tabular-nums` — unchanged from dark's spec.                                                              |
| Sparklines          | mint-500 bars with the final bar mint-700 — deep end for emphasis, mirroring dark's mint-deep/mint split.                        |
| Status pills        | soft tint + full-strength label + 24% same-hue border (§4.1) — **mandatory** in light, not optional.                             |
| Primary button      | mint-700 fill, white label (5.51).                                                                                               |
| CTA button          | amber-600 fill, `var(--ink-amber)` label (11.70). Brand-mandated; hover snaps to amber-700.                                      |
| Inputs              | `--surface-inset` fill, beige-900 `--border-strong` edge, mint-700 focus ring (5.51 on white, 4.71 on void).                     |
| Tables              | white body, `--surface-inset` stripes, `--border` hairlines. (Zebra/sticky headers remain deferred structural work, as in dark.) |
| Distribution bars   | success / warning / danger fills — 87.7° and 50.1° apart.                                                                        |
| Checkboxes, avatars | neutral until checked/active.                                                                                                    |
| Focus               | `--ring` mint-700, 2px, offset 2px. Unchanged mechanism.                                                                         |
| Selection           | `rgb(41 198 198 / 0.26)` — `#c7f0f0` on white; primary ink on it 13.47.                                                          |
| Skeletons           | `rgb(29 31 36 / 0.05)` → `/ 0.025` sheen — graphite, replacing the teal ink.                                                     |
| Scrim               | `rgb(29 31 36 / 0.36)` — graphite, replacing teal `rgb(12 30 28 / 0.32)`.                                                        |
| Empty states        | line-art doodle, mint-700 stroke at ~45% — shared follow-up with dark (§5, Layer 5).                                             |
| AuthGyroscope       | ink retint per §5, Layer 5. Geometry and keyframes untouched.                                                                    |

**Radii and type scale stay exactly as they are**, for the same reason as dark: the silhouettes
supply the softness, and churning 130-odd radius call sites buys nothing.

---

## 7. Charts

**No change.** The ramp `--chart-1..6` is theme-stable and passed the `dataviz` validator against
both the dark card and white at adoption — white _is_ the light card, so the adoption-time gate
already covers this theme. Verification against the proposed surfaces:

| Series   | Hex       | vs white/card | vs base  | vs inset |
| -------- | --------- | ------------- | -------- | -------- |
| 1 mint   | `#2ca2a2` | 3.09          | **2.97** | **2.78** |
| 2 amber  | `#c08442` | 3.17          | 3.04     | **2.85** |
| 3 violet | `#715cc7` | 5.18          | 4.97     | 4.66     |
| 4 green  | `#3fa164` | 3.23          | 3.10     | **2.91** |
| 5 rose   | `#b23a4e` | 5.82          | 5.59     | 5.24     |
| 6 blue   | `#427bc6` | 4.30          | 4.13     | 3.87     |

All six clear 3:1 on the white card, where every chart lives (`ReportChartCard`,
`ChartPrimitives`, stat sparkline wells). The bold cells are the finding: three steps dip below
3:1 on the beige surfaces, so **charts must stay on cards** — no chart may be moved onto
`--background` or `--surface-inset` without re-running the validator. Since no step changes,
no re-validation is required; if any step is ever retuned, the validator runs in both modes (the
standing invariant). Violet and blue remain chart-only; single-series charts keep `var(--chart-1)`.

---

## 8. Token diff for `app/globals.css`

Replaces the `.light` block only; `:root` (dark) is untouched. No `@theme inline` changes are
needed — every Tailwind-facing name already exists, and the atmosphere values are raw variables.

```css
.light {
  color-scheme: light;

  /* Atmosphere — "Ivory Ledger" (docs/light-mode-redesign.md §5). In light the brand shapes are
     ink, not light: pastel-filled silhouettes with crisp echo lines printed on the warm page.
     The aurora keeps light's shipped geometry — mint-white daylight off the top-right, a peach
     pigment wash off the bottom-left. Grain does not ship in light: banding is a near-black
     artifact, and white-alpha noise is invisible on paper. */
  --canvas-base: #f4ece3;
  --atmo-mint: rgb(242 251 250 / 0.95);
  --atmo-peach: rgb(253 207 174 / 0.45);
  --atmo-dot: rgb(29 31 36 / 0.1);
  --atmo-blob-mint: rgb(41 198 198 / 0.12);
  --atmo-blob-peach: rgb(250 171 89 / 0.14);
  --atmo-line-mint: rgb(31 116 117 / 0.25);
  --atmo-line-peach: rgb(250 171 89 / 0.5);
  --atmo-grain: 0;
  --canvas-aurora:
    radial-gradient(1150px 700px at 100% -8%, var(--atmo-mint), transparent 58%),
    radial-gradient(880px 600px at -8% 112%, var(--atmo-peach), transparent 60%);

  /* Chassis — the brand Beige ramp, verbatim; chroma falls as surfaces lift toward white.
     The sidebar recedes below the canvas, as in dark. */
  --background: #fdfaf4;
  --surface-inset: #f8f2eb;
  --card: #ffffff;
  --popover: #ffffff;
  --secondary: #faf6f1;
  --muted: #f4ece3;
  --sidebar: #f8f2eb;

  /* Type — cool graphite (H ≈ 265°) on the warm page: dark's chassis hue is light's ink. All
     three live tiers clear 4.5:1 on every surface including the beige-600 void. */
  --foreground: #1d1f24;
  --card-foreground: #1d1f24;
  --popover-foreground: #1d1f24;
  --secondary-foreground: #1d1f24;
  --muted-foreground: #4c4f56;
  --text-subtle: #686c73;

  /* Signals — the same four hues as dark (196°/153°/65°/15°); every text pairing clears 4.5:1
     on every chassis surface, including --muted and each family's own soft. */
  --primary: #1f7475;
  --primary-foreground: #ffffff;
  --accent: #1f7475;
  --accent-foreground: #ffffff;
  --accent-soft: #d4f9f8;
  --accent-line: rgb(31 116 117 / 0.4);
  --cta: #ffcb97;
  --cta-hover: #f9c289;
  --cta-foreground: var(--ink-amber);
  --destructive: #be3c52;
  --destructive-soft: #ffe8e9;
  --destructive-foreground: #ffffff;
  --success: #1e7b44;
  --success-soft: #def8e4;
  --success-foreground: #ffffff;
  --warning: #9c5c01;
  --warning-soft: #ffe8d5;
  --warning-foreground: #ffffff;

  /* Edges, depth, chrome — warm hairlines from the Beige ramp; the shadow ink is brand mint-900,
     the styleguide's own shadow recipe. */
  --border: #e8dacc;
  --border-strong: #dccfc2;
  --ring: #1f7475;
  --sidebar-border: #efe5db;
  --header-bg: rgb(253 250 244 / 0.82);
  --scrim: rgb(29 31 36 / 0.36);

  --skeleton: rgb(29 31 36 / 0.05);
  --skeleton-sheen: rgb(29 31 36 / 0.025);

  --elevation-pop: 0 18px 44px -14px rgb(12 66 63 / 0.22), 0 0 0 1px rgb(12 66 63 / 0.05);
}
```

Two rule changes elsewhere in the file:

1. `.light .sheet-atmosphere, .light .sheet-grain { display: none }` loses its first selector —
   the atmosphere ships to light; only the grain stays hidden.
2. A `.light .auth-gyro-*` override group for the gyroscope retint (§5, Layer 5) — colours only,
   no keyframe or layout changes.

No renames. `--input` keeps riding `--border-strong` via the `:root` alias. The theme-stable
tokens (`--ink-*`, `--chart-*`) stay un-overridden, as today.

---

## 9. Open decisions

Product-owner and brand calls, parked here rather than blocking the proposal:

1. **Does graphite ink clear brand review?** The proposal replaces the brand's teal-dark heading
   ink (ink-800 `#0a2930`) with a cool graphite ladder as the app's text colour. The defence: the
   styleguide's own _body_ ink is ink-600 `#171717`, a near-neutral — the graphite ladder is that
   neutral with a whisper of the dark theme's 265° coolness, and ink-800 keeps its home on the
   auth brand panel and marketing surfaces. But it is a visible identity call, like dark's
   non-teal chassis was, and should be shown before it is built.
2. **Does the sidebar recede?** The proposal moves it from white to beige-500, mirroring dark's
   "navigation recedes" thesis. It is the most visible structural change of the pass and a
   legitimate taste fork — the white sidebar reads "crisp", the inset one reads "calm".
   Recommend: recede.
3. **Warning swatch sign-off.** `#9c5c01` is unavoidably darker and browner than today's failing
   `#b07a1e` — that is what 4.5:1 over a cream soft costs. The alternative (keeping a bright amber
   and giving up on amber _text_) would fork warning's grammar from the other three families.
   Recommend: accept the darker amber.
4. **Atmosphere reach.** Ship the light atmosphere app-wide at once (as dark did), or auth-screen
   first and app shell a release later? The blobs are the largest visual delta of the whole pass.
   Recommend: app-wide, one baseline churn instead of two.
5. **Hairline weight.** `--border` at beige-800 (1.37 vs white) is one step firmer than today's
   near-invisible 1.26. If review finds it heavy, beige-700 `#efe5db` (1.24) is the fallback —
   but then card edges lean almost entirely on the shadow. Recommend: beige-800.

---

## 10. Implementation plan

Sequenced like dark's: each phase independently reviewable, baseline churn lands once per theme
pass. `pnpm verify` gates every phase.

| #   | Phase             | Scope                                            | Notes                                                                                                |
| --- | ----------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 1   | Chassis + signals | `app/globals.css` `.light` block only            | No component edits. Every light visual baseline changes.                                             |
| 2   | Baseline refresh  | `visual/storybook.spec.ts-snapshots/`            | Own commit, stating the intentional change (repo convention). See the trap below.                    |
| 3   | Atmosphere        | `.light` atmosphere tokens + un-hide rule        | Component untouched. Verify §5.1's text-over-canvas rule on the auth screen, both locales.           |
| 4   | Auth retint       | `.light .auth-gyro-*` overrides                  | Colours only; frame-0 composition must survive (visual baselines will prove it).                     |
| 5   | Component polish  | pill borders, nav rail, sparklines, stat corners | Per §6. Storybook coverage per variant, both themes. Shared items (doodles) joint with dark backlog. |
| 6   | Docs + QA         | `docs/tokens.md`, `docs/manual-qa-test-plan.md`  | Fold §3–§7 into `tokens.md`; QA scenarios as a separate `docs(qa):` commit.                          |

**The visual-suite trap, again.** Theme-wide light recolors will dodge the visual suite's 1% diff
ratio exactly as the dark ones did — most stories change by less than the threshold and
`--update-snapshots=changed` silently keeps stale PNGs. Phases 2 (and 3's refresh) must run with
**`--update-snapshots=all`**, followed by an image-by-image review rather than a blanket accept;
expect a couple of unrelated screenshots to re-render with antialiasing jitter — inspect and keep
or discard those deliberately, and say in the commit that the refresh was forced.

**Accessibility gate.** Every ratio in §3–§5 is computed above; on a real build verify: the
atmosphere reduces no text contrast (auth screen copy is the only canvas-dwelling text — §5.1's
tier rule); tertiary/disabled tiers never sit on the canvas; disabled is never the sole signal;
`prefers-reduced-motion` and `prefers-reduced-transparency` both quiet the drift (inherited
behaviour — confirm it survives the un-hiding). WCAG 2.1 is more trustworthy in this polarity than
in dark's, but run the four tiers through the APCA calculator anyway as the second opinion —
body-text targets around Lc 75–90 — since the tertiary tier sits at 4.51 by design.

**i18n.** No user-facing strings change in any phase; the completion requirement is untouched.

---

## 11. Inspiration and sources

- `docs/dark-mode-redesign.md` — the structural template: the chassis/signals/atmosphere
  separation, the tint-compositing method, the motion constraints, and the shipped deviations this
  proposal builds on.
- **Internal:** the styleguide's _Colors_ and _Graphical elements_ frames via
  `claude_design_proto/_ds/**/colors_and_type.css` (the Beige/Grey/Ink ramps, the teal and amber
  ladders, the shadow recipe) and `claude_design_proto/shell/theme.css` (the prototype light block
  §1 diagnoses); the `AuthGyroscope` and atmosphere comments in `app/globals.css`, whose
  reduced-motion and frozen-frame constraints §5.2 inherits; the raw silhouette exports in
  `src/components/layout/Atmosphere/svgs/`.
- [Neutral Color Palettes: Warm vs Cool — ColorArchive](https://colorarchive.org/guides/neutral-color-palettes/) ·
  [Top 2026 Web Design Color Trends — Lounge Lizard](https://www.loungelizard.com/blog/web-design-color-trends/) —
  warm paper neutrals as the humane light-mode default; the warm-canvas/cool-ink pairing with a
  single calming accent that §2 formalises.
- [Geist — Vercel](https://vercel.com/geist/material) · [Linear design system — Refero](https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1) —
  a deliberate step for every divider and disabled state; elevation from hairlines and surface
  steps rather than shadow stacks. Both carried over from the dark doc; they cut both ways.
- [Designing Luminance-First Color Systems with OKLCH — BoldVanta](https://www.boldvanta.com/design/designing-luminance-cefirst-color-systems-with-oklch-tokens-ramps-and-real-ceworld-pitfalls.html) ·
  [OKLCH explained for designers — UX Collective](https://uxdesign.cc/oklch-explained-for-designers-dc6af4433611) —
  luminance first, then hue and chroma; the method behind every table above.
- [APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html) ·
  [Why APCA?](https://git.apcacontrast.com/documentation/WhyAPCA) — polarity-aware contrast; §10's
  second-opinion gate.
