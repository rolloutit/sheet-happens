// Reusable building blocks for generated PDFs.
//
// Every value these take is already display-ready: the TypeScript payload builder does all
// number, money and date formatting through Intl. Nothing here formats or localizes. The only
// raw numbers that reach a component are geometry inputs — a share percentage drives a bar
// width, it is never printed.

#import "theme.typ": (
  accent,
  border,
  micro-label,
  muted,
  panel,
  panel-soft,
  panel-strong,
  paper,
  radius-lg,
  radius-md,
  radius-pill,
  radius-sm,
  rule-color,
  warning,
  warning-soft,
)

/// Rounded tinted surface — the document header and the summary band sit on one.
#let panel-box(
  body,
  fill: panel,
  radius: radius-md,
  inset: 9pt,
  stroke: 0.6pt + border,
) = block(width: 100%, fill: fill, stroke: stroke, radius: radius, inset: inset)[#body]

/// Solid accent pill, matching the app's badge language.
#let pill(label) = box(fill: accent, radius: radius-pill, inset: (x: 7pt, y: 3.5pt))[
  #text(size: 6.4pt, weight: "bold", tracking: 0.6pt, fill: paper)[#upper(label)]
]

/// Project colour dot, using the same palette as the project chips on screen.
#let swatch(color) = box(
  baseline: -0.5pt,
  circle(radius: 1.1mm, fill: rgb(color), stroke: none),
)

/// Micro label above a value. The eye lands on the number first, then on its caption. `color`
/// prefixes the value with a project dot.
#let metric(label, value, size: 8.4pt, color: none) = [
  #micro-label(label)
  #v(2.5pt)
  #text(size: size, weight: "bold")[#if color != none [#swatch(color)#h(3.6pt)]#value]
]

/// Metric band: hero metrics first at a larger size, then the supporting counts, split by
/// hairlines. One band scales to either mode, so no orphan card is ever left on its own row.
#let summary-band(heroes, metrics) = {
  let cells = heroes.map(entry => (entry, true)) + metrics.map(entry => (entry, false))

  panel-box(inset: 0pt, radius: radius-lg)[
    #grid(
      // Heroes get the wider columns: a money total can carry two currencies at once.
      columns: heroes.map(_ => 1.7fr) + metrics.map(_ => 1fr),
      inset: (x: 10pt, y: 9.5pt),
      stroke: (x, y) => (left: if x > 0 { 0.6pt + border } else { none }),
      ..cells.map(((entry, hero)) => metric(
        entry.label,
        entry.value,
        size: if hero { 15pt } else { 11.5pt },
      )),
    )
  ]
}

/// Section heading: an accent tick, the title, and a muted one-line description.
#let section(title, description) = [
  #grid(
    columns: (2.2pt, 1fr),
    column-gutter: 7pt,
    rect(width: 2.2pt, height: 11pt, fill: accent, radius: radius-pill, stroke: none),
    [
      #text(size: 10.5pt, weight: "bold")[#title]
      #v(1.5pt)
      #text(size: 7.4pt, fill: muted)[#description]
    ],
  )
  #v(6pt)
]

/// Amber callout listing report warnings, one per line. Renders nothing when there are none.
#let warning-banner(title, messages) = if messages.len() > 0 {
  v(9pt)
  panel-box(fill: warning-soft, stroke: 0.6pt + warning.transparentize(55%), inset: 9pt)[
    #micro-label(title, fill: warning)
    #v(4.5pt)
    #stack(
      spacing: 5pt,
      ..messages.map(message => text(size: 7.8pt, fill: warning)[#message]),
    )
  ]
}

/// Member initials, the print form of the app's avatar.
#let initials-chip(initials) = box(
  baseline: 1.8pt,
  fill: accent.transparentize(88%),
  radius: radius-sm,
  inset: (x: 3.2pt, y: 2.2pt),
)[#text(size: 6.2pt, weight: "bold", fill: accent)[#initials]]

/// The identifying cell of a row: an optional dot or initials, then the name.
#let entity(name, color: none, initials: none) = [
  #if color != none [#swatch(color)#h(3.4pt)] else if initials != none [
    #initials-chip(initials)#h(4pt)
  ]
  #text(weight: "semibold")[#name]
]

/// Share of total as a bar plus its percentage. The bar makes relative weight readable without
/// comparing numbers; `percent` is a geometry input and is never printed.
#let share-cell(percent, label) = {
  let track = 17mm

  grid(
    columns: (track, 1fr),
    column-gutter: 7pt,
    align: (horizon, horizon + right),
    box(width: track, height: 3.6pt, radius: radius-pill, fill: panel-strong)[
      // A hairline of colour is kept for 0% rows so the bar never disappears entirely.
      #box(
        width: calc.max(track * percent / 100, 0.8mm),
        height: 3.6pt,
        radius: radius-pill,
        fill: accent,
      )
    ],
    text(fill: muted)[#label],
  )
}

/// Table body cell. `strong: true` emphasizes the identifying column of a row.
#let cell(value, strong: false) = if strong [#text(weight: "semibold")[#value]] else [#value]

/// Header cell caption. Alignment comes from the table's per-column `align`, so a numeric
/// column's label sits over its digits.
#let header-cell(label) = micro-label(label)

/// Bordered-free data table: a tinted header, zebra body rows, and an optional repeating totals
/// row. Row fills do the separating, so no interior rules are drawn — only a hairline under the
/// header and above the totals.
///
/// `rows` is an array of arrays of `cell(..)` content; `footer` is a single such array.
#let data-table(columns: (), align: auto, headers: (), rows: (), footer: none) = {
  let footer-y = rows.len() + 1

  // Line items sit a notch below body prose: a month of tracked time is a long table, and the
  // extra room is what keeps descriptions on one line.
  set text(size: 8pt)

  table(
    columns: columns,
    align: align,
    inset: (x: 5pt, y: 4.8pt),
    stroke: (x, y) => (
      top: if y == 1 or (footer != none and y == footer-y) { 0.7pt + rule-color } else { none },
      bottom: none,
      left: none,
      right: none,
    ),
    fill: (x, y) => if y == 0 {
      panel-strong
    } else if footer != none and y == footer-y {
      panel-soft
    } else if calc.even(y) { panel },
    table.header(..headers.map(header-cell)),
    ..rows.flatten(),
    // The header repeats on every page, the totals row does not: a grand total printed at the
    // foot of a table that continues overleaf would read as a subtotal.
    ..if footer != none { (table.footer(repeat: false, ..footer),) } else { () },
  )
}
