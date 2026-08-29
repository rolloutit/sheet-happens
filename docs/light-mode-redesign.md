# Light Mode Redesign — "Ivory Ledger"

Status: **§1–§11 are the proposal; §12 is what shipped.** The proposal was written before the dark
relight (`docs/dark-mode-redesign.md` §12) and parts of it did not survive contact with that pass or
with the measurements — §12 records what was adopted, what was revised, and why, with the computed
tables. Read §12 first if you want the current state; §1–§11 remain as the reasoning that led there.

It is the light-theme counterpart of
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

---

## 12. The relight pass (2026-08)

Status: **implemented**. The brief was the light-side mirror of dark's: keep the palette's identity
(warm cream canvas, deep teal primary, peach CTA, near-black-teal ink), keep the same radii, type
tokens, brand silhouettes and variant APIs, and make the result vibrant, modern and alive without
regressing dark.

Every number below was computed, not estimated, with a scratch OKLab/OKLCH + WCAG + alpha-compositing
library. The library was validated by reproducing dark §12.3's three published stacked ratios
(4.94 / 4.95 / 5.58) to two decimals before any light value was derived from it.

### 12.1 What was actually wrong

**a) The third text tier failed WCAG on every surface it touched.** `--text-subtle` `#8a938f`
carried table headers, placeholders and sidebar nav labels — running text:

| `#8a938f` on | white    | `--background` | `--secondary` | `--muted` | canvas   |
| ------------ | -------- | -------------- | ------------- | --------- | -------- |
| contrast     | **3.16** | **3.03**       | **2.91**      | **2.70**  | **2.67** |

**b) The whole warning family failed.** `#b07a1e` scored 3.72 on white falling to 3.15 on the
canvas, its own soft at 3.26, and `--warning-foreground` `#fff8e7` on the fill at **3.51**. Its hue
sat at 75.0°, 10° off dark's amber — the one family that escaped the cross-theme alignment was also
the only one that failed contrast.

**c) A white card had almost nothing to sit on, and in one corner nothing at all.** `--card` is
`#ffffff` and `--background` `#fdfaf4`, i.e. ΔL 0.014 and a 1.04 ratio; card-over-void was 0.057 L
against dark's 0.109. Worse, `--atmo-mint` held the literal value **`#ffffff` at full alpha** inside
`radial-gradient(1150px 700px at 100% -8%, …)`, so in the top-right corner of every page the canvas
_was_ white — card-over-canvas 1.00, with a `--border` hairline at 1.26 as the only evidence a panel
existed. This is light's exact equivalent of dark's "a card sat 0.036 L above the canvas and every
panel dissolved into its ground".

**d) The ink was three different pens.** `--foreground` 215.4°, `--muted-foreground` 232.6°,
`--text-subtle` 167.6° — a 64.9° hue spread across three tiers of one ladder, plus a scrim at 186.3°
and a skeleton at 215.4°.

**e) Seven surface tokens resolved to four planes.** `--sidebar` = `--card` = white, `--secondary` =
`--surface-inset`, and `--muted` sat ΔL 0.003 from `--canvas-base`.

**f) The tints camouflaged, and the two warm ones camouflaged worst.** Minimum ΔE across the
surfaces each can land on: accent 0.028, success 0.031, warning 0.023, danger 0.020 — against dark's
tint band of 0.118–0.146. Warning's hue (85.4°) sat _inside_ the chassis's own 76–85° band.

**g) The brand layer did not exist**, and **h) `--elevation-glow` was the invisible glow** — light
still held `0 10px 26px -12px var(--accent-line)`, the exact value dark §12.2 move 4 was written to
kill.

### 12.2 The four moves

**1. Widen the ladder — downward.** Dark pulled its ramp apart upward. Light cannot: `--card` is
already white. So the void drops to beige-700 and the whole chassis snaps onto real brand steps.

|     | void      | muted     | inset     | secondary | base      | card      | card−void |
| --- | --------- | --------- | --------- | --------- | --------- | --------- | --------- |
| was | `#f4ebdd` | `#f4ece1` | `#faf5ee` | `#faf5ee` | `#fdfaf4` | `#ffffff` | 0.057     |
| now | `#efe5db` | `#f4ece3` | `#f8f2eb` | `#faf6f1` | `#fdfaf4` | `#ffffff` | **0.073** |

Six tokens, six distinct planes, chroma falling monotonically (0.0173 → 0) as the surface lifts.
beige-800 was tested and rejected: at relative luminance 0.7166 it sits below the text floor in
§12.3.

**2. Elevation is the hairline and the shadow, because it cannot be a lightness step.**
`--border` moves to beige-800 — 1.37 against the card, the same weight class as dark's
`--border-strong` composite (1.56), where `#ece4d8` gave 1.26 and the card's own shadow ring gave
1.09. Both `--elevation-pop` layers strengthen (ring 0.05 → 0.07, cast 0.22 → 0.26); the ink stays
brand mint-900, which is the styleguide's own `--shadow-1..3` recipe.

**3. Spend the budget on chroma — but the ends of the ladder swap.** Dark's rule is that at a
luminance _ceiling_ the pale end returns almost no colour, so draw from the saturated middle. Light's
resource is luminance _displacement_, and a source far from the ground's own luminance displaces it
fast and is therefore rationed to a low alpha:

| source over the void            | max alpha in budget | C returned | hue        |
| ------------------------------- | ------------------- | ---------- | ---------- |
| mint-700 `#1F7475` (deep)       | 0.06                | 0.0138     | 93.0°      |
| mint-300 `#29C6C6` (mid)        | 0.14                | 0.0185     | 155.8°     |
| **mint-200 `#84F4F4` (bright)** | **1.00**            | **0.1023** | **195.5°** |

The deep end is light's khaki: subtracting luminance from a warm cream drags the result toward the
chassis hue, not toward the source's. So the washes come from the bright end here — the exact
opposite instruction to dark's, reached by the same argument.

**4. Translate the glows instead of transplanting them.** A glow is emitted light; on paper the same
shape is a smudge. Every coloured bloom in the shared components now has a light form that is a
_directional coloured shadow_ — the element tints the page beneath it rather than lighting the room
around it — with the omnidirectional version behind `dark:`. Still two elevations, still keyed to the
control's own family.

### 12.3 The constraint that shapes the atmosphere — and it is two-sided

Dark has one bound. Light has two, because its atmosphere can move the ground in both directions and
each direction breaks something different:

| bound       | value                | what it protects                       | what binds it                  |
| ----------- | -------------------- | -------------------------------------- | ------------------------------ |
| **floor**   | rel lum ≥ **0.5390** | dark text sitting on the canvas        | `--muted-foreground`, at 4.5:1 |
| **ceiling** | rel lum ≤ **0.9406** | the white card that sits on the canvas | card-over-ground at 1.06:1     |

**Tier 2 binds the floor**, not tier 1 and not tier 3. `AuthForm` renders its heading in
`--foreground` and everything else — description, field labels, the ghost button — in
`--muted-foreground`, directly on the canvas; tier 1 is far more forgiving, and tier 3 never lands on
the canvas at all (§12.4). The ceiling is not a text bound at all, which is the part with no
counterpart in dark: `--card` cannot go lighter, so every step the canvas takes toward white is a
step of card separation destroyed. That bound is what the shipped `#ffffff` aurora violated outright.

The stacking model is dark's, made explicit: **any two overlapping _area_ layers** must land inside
the band. Thin strokes are excluded — dark spells this out for the dot lattice (~0.14% coverage,
masked out of the content area) and leaves it implicit for the echo lines, whose own three-layer case
in dark scores 2.67. Light checks all three pairs:

| stacked pair (over the void) | composite | rel lum | tier 2 | card:ground |
| ---------------------------- | --------- | ------- | ------ | ----------- |
| aurora + blob, mint          | `#a6e6e1` | 0.7014  | 5.74   | 1.40        |
| aurora + echo line, mint     | `#9ed3ce` | 0.5831  | 4.84   | 1.66        |
| blob + its own echo, mint    | `#a8c9c2` | 0.5399  | 4.51   | 1.78        |
| aurora + blob, peach         | `#f8cb9c` | 0.6507  | 5.35   | 1.50        |
| aurora + echo line, peach    | `#f9bc7e` | 0.5761  | 4.78   | 1.68        |
| blob + its own echo, peach   | `#f7ba7b` | 0.5632  | 4.69   | 1.71        |

**Fills bloom, lines stay crisp — costed the other way round.** In dark the wave became line-art
because a large soft warm mass is a camouflage blotch. In light the division of labour survives but
the price does not: the 40px blur destroys the fill's form, so the _fill buys colour_ and the _line
buys shape_ — and the line is the only layer drawn from the deep end, because a visible line simply
_is_ a luminance difference and that cost cannot be optimised away. The echo lines therefore take the
budget the washes give up, landing at 1.31 against the void.

### 12.4 The rule that makes a third text tier possible

> **Only tiers 1 and 2 may sit directly on the canvas. Tier 3 always sits on an opaque surface.**

This is not a convenience. Require tier 3 to clear 4.5:1 on the void as well and it collapses into
tier 2 — searched that way the two land ΔL 0.026 apart (ΔE 0.028), which is not a ladder, it is one
colour printed twice. Excluding the void buys the third step ΔL 0.088. Verified against every tier-3
call site in the codebase: `Input`/`Textarea`/`PasswordInput` placeholders and the sidebar/drawer nav
labels on `--surface-inset` (4.97), `Table`'s `<thead>` and the command-palette input on the card
(5.53), nav hover on `--secondary` (5.14), `AuthForm`'s placeholder on the card. None renders on the
canvas.

The ladder is rebuilt at `--foreground`'s own hue rather than replaced — see the deviations below:

| tier                 | hex       | L     | C      | H      | card  | base  | secondary | inset | muted | APCA/white |
| -------------------- | --------- | ----- | ------ | ------ | ----- | ----- | --------- | ----- | ----- | ---------- |
| `--foreground`       | `#0a2930` | 0.262 | 0.0379 | 215.4° | 15.30 | 14.68 | 14.22     | 13.76 | 13.08 | 102.1      |
| `--muted-foreground` | `#3d545b` | 0.430 | 0.0303 | 218.5° | 8.02  | 7.70  | 7.46      | 7.22  | 6.86  | 87.8       |
| `--text-subtle`      | `#5d6b6f` | 0.517 | 0.0181 | 216.8° | 5.53  | 5.31  | 5.14      | 4.97  | 4.73  | 77.6       |

Hue spread 3.1°, against 64.9° before. On the canvas: tier 1 12.31, tier 2 6.46. Dark's own ladder on
its raised surface is 14.26 / 7.75 / 5.77, so light's 15.30 / 8.02 / 5.53 is deliberately the same
shape.

### 12.5 Signals, tints, and a second rose step after all

Hues are dark's to within hex rounding (196.2° / 153.0° / 64.7° / 14.5°). What is re-derived is
lightness and chroma, because a saturated colour on white must be darker to stay legible. Each family
spends **the same fraction of the sRGB gamut ceiling its dark counterpart spends** — that is what
makes them feel equally saturated rather than merely equally named — with the spread then **capped at
1.9× the least-saturated**, which is `--primary`, fixed by the brand at C 0.0776. That cap is the
chart ramp's rule applied to chrome: uncapped, danger lands at C 0.223, 2.9× the accent, shouting
beside a whispering teal in the same status column.

| family        | was       | now       | L     | C      | card | base | secondary | inset | muted | own tint |
| ------------- | --------- | --------- | ----- | ------ | ---- | ---- | --------- | ----- | ----- | -------- |
| accent (text) | `#1f7475` | `#196869` | 0.473 | 0.0726 | 6.51 | 6.25 | 6.05      | 5.86  | 5.57  | 5.95     |
| primary(fill) | `#1f7475` | `#1f7475` | 0.511 | 0.0776 | 5.51 | 5.29 | 5.12      | 4.95  | 4.71  | 5.04     |
| success       | `#247f48` | `#2e794a` | 0.516 | 0.1052 | 5.32 | 5.10 | 4.94      | 4.78  | 4.55  | 4.89     |
| warning       | `#b07a1e` | `#995e18` | 0.536 | 0.1107 | 5.29 | 5.08 | 4.92      | 4.76  | 4.52  | 4.53     |
| destructive   | `#be3c52` | `#b64455` | 0.547 | 0.1477 | 5.32 | 5.11 | 4.94      | 4.79  | 4.55  | 4.54     |

**`--accent` becomes mint-800, a genuinely different step from `--primary`.** Two things needed it.
`Button variant="primary"` is `linear-gradient(135deg, var(--primary), var(--accent))`, which in
light was a gradient between one colour and itself — a flat fill where dark has a lit one. And
`--accent` is the _text_ step (`text-accent`, `border-accent`, checked checkboxes), which in this
polarity wants to be darker than the fill, not lighter. It is the exact mirror of dark's pair, where
`--accent` `#84f4f4` is the lighter step above `--primary` `#29c6c6`.

**Tints.** Solid pastels get their own derivation, not a per-tone alpha. §4.1 concluded from the warm
pair that all four were gamut-stuck; that is **half right**. Near white the ceiling at 196°/153° is
0.075/0.081 against 0.033/0.025 at 66°/15°, so letting the cool tints darken buys them separation the
warm ones can never have. Pushed to their own maxima the four span 6.8× — not a set — so they are
held to a common band instead:

| tint                 | was       | now       | ΔE card | ΔE base | ΔE secondary | ΔE inset | ΔE muted |
| -------------------- | --------- | --------- | ------- | ------- | ------------ | -------- | -------- |
| `--accent-soft`      | `#e4f7f6` | `#cdfefe` | 0.0618  | 0.0580  | 0.0556       | 0.0569   | 0.0618   |
| `--success-soft`     | `#e5faea` | `#dbfee3` | 0.0619  | 0.0527  | 0.0510       | 0.0503   | 0.0540   |
| `--warning-soft`     | `#fbefd6` | `#feead7` | 0.0617  | 0.0454  | 0.0370       | 0.0272   | 0.0187   |
| `--destructive-soft` | `#fee8e9` | `#fee8e8` | 0.0567  | 0.0432  | 0.0334       | 0.0249   | 0.0194   |

`--muted` is the honest exception: a warm pastel cannot move far from a warm chassis, and warning and
danger sit at ΔE 0.019 from beige-600 with no value able to fix it. This is why the 45% same-hue
border on `StatusPill`, `Card` and `Button` is **mandatory** in light rather than decorative — it
composites to 1.82–1.88 against its own tint.

**`--destructive-bright` is a real token in light now, and the old note was wrong about why it was
not.** The alias was checked against the tint (4.54, fine) and never against the other ground this
token labels: `Button variant="danger"` hovers to `bg-destructive/30`, and under the alias the label
and the wash are the same colour, so every point of alpha eats contrast directly — **3.42** on a
card, 3.02 over `--muted`. The token's job is "the rose that labels a rose ground"; in dark that
ground is dark so the step is lighter, in light the ground is light so the step is **deeper**. Same
role, mirrored, exactly like the `--accent`/`--primary` pair. `#8a323f` — same hue, same 68% of the
gamut ceiling, ΔL 0.100 below `--destructive` (dark's pair is ΔL 0.064 the other way). It clears 6.87
on the tint and 4.57 on the darkest hover wash it can meet.

### 12.6 What was adopted from §1–§11, what was revised

**Adopted:** the thesis that light is the brand kit's native medium and the shapes go back to being
ink (§5); the brand Beige ramp as the chassis (§3.1); the receding sidebar (§9.2); the darker amber
(§9.3); app-wide atmosphere reach (§9.4); beige-800 hairlines (§9.5); `--cta-foreground` →
`var(--ink-amber)` and `--cta-hover` → amber-700 (§4); the mandatory pill border (§4.1); "only tiers
1–2 on the canvas" (§5.1); no grain in light (§5, Layer 4); no chart-ramp override (§7).

**Revised, with the reason:**

1. **Cool graphite ink → the teal ladder stays.** §3.2 proposed replacing `--foreground` with a
   graphite ladder at H 265° and parked it as open decision #1. The brief settles it the other way:
   near-black-teal ink is named as part of the light identity to keep. The diagnosis in §1d was never
   "the ink is the wrong colour" but "there are three different inks", and that is fixed by deriving
   tiers 2 and 3 at ink-800's own hue — 64.9° of spread down to 3.1° — without touching the brand
   anchor.
2. **The void separates from `--muted`.** §3.1 set both to beige-600, which regularises the values
   onto brand steps but does not widen the ladder at all (card-over-void 0.053, marginally _flatter_
   than the 0.057 it replaced). Splitting them lets the void drop to beige-700 for card separation
   while `--muted` stays light enough for a third text tier to exist. The proposal predates dark's
   "pull the ladder apart" finding.
3. **`--surface-inset` is beige-500, but the drift table was off.** §1f lists it as ΔE 0.0083 from
   beige-500; recomputed it is ΔE 0.0040 from **beige-400**. beige-500 is still the right assignment —
   it makes the ladder monotonic — but as a choice, not as a snap.
4. **The cool tints are not gamut-stuck.** §4.1's "all four are physically stuck at ΔE ≈ 0.021" holds
   only if the tint is pinned near L 0.95. See §12.5.
5. **`--destructive-bright` is needed.** See §12.5.
6. **`--accent` moves off `--primary`.** Not in the proposal; forced by the primary button's gradient.
7. **The AuthGyroscope needs no light retint.** §5 Layer 5 asserts its cyan glows "wash out on
   paper". They do not: the gyroscope lives inside `AuthShell`'s `<aside>`, whose background is
   `radial-gradient(…#2c7c7c…#0c423f…#08302d)` in **both** themes — the file's own comment reads "The
   panel is teal in both themes". The premise is false and the whole phase is dropped.
8. **The signal values differ from §4** because the constraint set is stricter (every opaque surface
   including `--muted`, plus the gamut-fraction and 1.9× spread rules), and because they are solved
   against the widened chassis rather than the shipped one.
9. **`--elevation-glow` is re-derived, not left alone.** §8 keeps light's existing value; it is the
   invisible glow dark deleted.

### 12.7 Verified

- Every text tier on all five opaque surfaces plus the canvas; every signal label on every surface
  and on its own tint; body text on all four tints; every ink on every fill; `--destructive-bright`
  on the tint and on the hover wash over each surface; the pill borders; the hairlines; the ring on
  every surface an outline can land on; `--scrim`, `--skeleton`, `::selection`, `--accent-line`; both
  atmosphere families' single layers and all six stacked pairs; the chart ramp on all four light
  surfaces. **100 gated checks, all pass.**
- `dataviz` `scripts/validate_palette.js` re-run against `#ffffff` (light's `--card`): all five checks
  PASS with no contrast relief warning. The ramp is unchanged and carries no `.light` override.
  Against the beige surfaces three steps dip below 3:1, which is the standing "charts stay on cards"
  rule, not a regression.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` clean.

**Two findings handed on rather than fixed here.**

1. **Dark's `--destructive-bright` is marginal on the same hover wash.** Over `--popover` it scores
   **4.02** and over `--secondary` 4.35 — §12.5 of the dark doc verified the token against the tint
   only. Pre-existing, and dark is finished, so nothing was changed; it wants either a lighter rose
   or a lower hover alpha.
2. **`chart-primitives-trend-dark` is not a stable baseline.** Recharts' `ResponsiveContainer`
   settles at a different width run to run, moving ~0.15–0.30% of pixels. It passes normally because
   that is under `maxDiffPixelRatio`, but it re-renders differently under `--update-snapshots=all`
   every single time. Two forced regenerations were inspected and discarded during this pass.
