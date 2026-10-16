// Design tokens and page setup for generated PDFs.
//
// The values mirror the app's light theme in `app/globals.css` (see docs/tokens.md) so an export
// reads as the same product as the screen it came from. PDFs are always printed light, so there
// is no dark variant here.
//
// The page itself stays white and the cream tokens carry the tint in panels, table headers and
// zebra rows: a full-bleed background would soak every printed page in toner without making
// anything easier to read.
//
// Inter is bundled in src/server/pdf/fonts and passed via --font-path with
// --ignore-system-fonts, so a render is identical on a dev machine, in Docker and in CI.

// Colour — each line names the CSS custom property it comes from.
#let paper = rgb("#ffffff") // --card
#let ink = rgb("#0a2930") // --foreground
#let muted = rgb("#5b6266") // --muted-foreground
#let accent = rgb("#1f7475") // --primary / --accent
#let panel = rgb("#fdfaf4") // --background
#let panel-soft = rgb("#faf5ee") // --secondary
#let panel-strong = rgb("#f4ece1") // --muted
#let border = rgb("#ece4d8") // --border
#let warning = rgb("#9a6500") // --warning
#let warning-soft = rgb("#fff8e7") // --warning-foreground

/// Hairline under table headers and above totals rows. Derived from `--foreground` rather than
/// introduced as a new colour, so the palette stays exactly the app's.
#let rule-color = ink.transparentize(86%)

// --radius-*, converted from the CSS pixel values (1px = 0.75pt).
#let radius-sm = 6.75pt // --radius-xs
#let radius-md = 9pt // --radius-md
#let radius-lg = 12pt // --radius-lg
#let radius-pill = 999pt // --radius-pill

/// The app's uppercase micro label (`text-[10.5px] font-semibold uppercase tracking-[0.12em]`).
/// Used for every eyebrow, column-style caption and metric label in the document.
#let micro-label(label, fill: muted) = text(
  size: 6.5pt,
  weight: "bold",
  tracking: 0.6pt,
  fill: fill,
)[#upper(label)]

/// The deployment's own letterhead logo, or nothing. The renderer writes `/brand.json` next to the
/// data file — `mark` is the logo's path inside the compile root, or `none` when the deployment
/// configured no `ORG_LOGO_PDF_PATH`. Typst can only read inside `--root`, which is why the renderer
/// copies the file in instead of the template pointing at `public/`.
#let org-brand = json("/brand.json")

#let brand-mark(height: 12pt) = if org-brand.mark != none {
  image(org-brand.mark, height: height)
}

/// Wraps a whole document: page geometry, footer and text defaults.
/// Apply with `#show: report-theme.with(brand: "…", page-label: "…")`.
#let report-theme(brand: "Sheet Happens", page-label: "Page", body) = {
  set page(
    paper: "a4",
    fill: paper,
    margin: (x: 13mm, top: 13mm, bottom: 16mm),
    footer: context [
      #set text(size: 6.8pt, fill: muted)
      #line(length: 100%, stroke: 0.6pt + border)
      #v(3.5pt)
      #grid(
        columns: (1fr, auto),
        [#brand],
        // "Page 1 / 3" reads the same way in both locales, so only the word is translated.
        [#page-label #counter(page).display("1") / #counter(page).final().first()],
      )
    ],
  )
  // Tabular figures keep decimal points aligned down every hours, rate and amount column.
  set text(font: "Inter", size: 8.4pt, fill: ink, number-width: "tabular")
  set par(leading: 0.6em)
  set heading(numbering: none)

  body
}
