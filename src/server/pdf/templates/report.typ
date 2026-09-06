// Report export document.
//
// Every dynamic value arrives through `/data.json`, which the renderer writes into the compile
// root. Nothing is ever concatenated into markup, so no escaping is needed: strings loaded via
// `json()` are values and Typst never re-parses them as markup.
//
// The payload is already display-ready — see `buildReportPdfPayload` in
// src/server/reports/report-pdf-payload.ts. Do not format numbers, money or dates here; locale
// rules live in TypeScript so `Intl` stays the single authority.
//
// The document never names its export mode. An internal export is distinguishable only by the
// rate and amount columns it carries, and the payload for a cost-free export does not contain
// those fields at all.

#import "lib/theme.typ": (
  accent,
  brand-mark,
  micro-label,
  muted,
  radius-lg,
  report-theme,
  rule-color,
)
#import "lib/components.typ": (
  cell,
  data-table,
  entity,
  metric,
  panel-box,
  pill,
  section,
  share-cell,
  summary-band,
  warning-banner,
)

#let data = json("/data.json")
#let labels = data.labels
#let internal = data.mode == "INTERNAL"

#show: report-theme.with(brand: labels.brand, page-label: labels.page)

// ─── Document header ────────────────────────────────────────────────────────────────────────
#panel-box(radius: radius-lg, inset: 11pt)[
  // Letterhead: the pictogram left of the wordmark, the same composition as the app's sidebar
  // header. Sized to the pill opposite it, so the mark reads as branding rather than as a graphic.
  #grid(
    columns: (auto, 1fr, auto),
    column-gutter: (5.5pt, 0pt),
    align: (horizon, horizon + left, horizon + right),
    brand-mark(),
    micro-label(labels.brand, fill: accent),
    pill(labels.confidential),
  )

  #v(7pt)

  #grid(
    columns: (1fr, auto),
    column-gutter: 12pt,
    align: (bottom + left, bottom + right),
    text(size: 19pt, weight: "bold")[#data.title],
    [
      #align(right)[#micro-label(labels.generatedAt)]
      #v(2.5pt)
      #align(right)[#text(size: 8.2pt, weight: "semibold")[#data.header.generatedAt]]
    ],
  )

  #v(10pt)
  #line(length: 100%, stroke: 0.6pt + rule-color)
  #v(9pt)

  // Scope facets, so a reader can tell exactly what the numbers below cover. A single-project
  // export states the project here instead of repeating it down a details column.
  #grid(
    columns: (1fr,) * data.header.facets.len(),
    column-gutter: 9pt,
    ..data.header.facets.map(facet => metric(facet.label, facet.value, color: facet.color)),
  )
]

#v(9pt)

#summary-band(data.summary.heroes, data.summary.metrics)

#warning-banner(labels.attention, data.warnings)

// ─── Breakdown ──────────────────────────────────────────────────────────────────────────────
// A single group breaks down into itself: its row, its 100% bar and its totals row would all
// restate the summary band, so the section is left out entirely.
#if data.groups.len() > 1 {
  v(13pt)
  section(labels.breakdown, labels.breakdownDescription)

  data-table(
    columns: if internal {
      (1fr, 20mm, 30mm, 20mm, 28mm)
    } else {
      (1fr, 22mm, 30mm, 22mm)
    },
    align: if internal {
      (left, right, left, right, right)
    } else {
      (left, right, left, right)
    },
    headers: if internal {
      (labels.name, labels.hours, labels.share, labels.entries, labels.amount)
    } else {
      (labels.name, labels.hours, labels.share, labels.entries)
    },
    rows: data.groups.map(group => {
      let row = (
        entity(group.label, color: group.color, initials: group.initials),
        cell(group.hours),
        share-cell(group.sharePercent, group.share),
        cell(group.entries),
      )
      if internal { row + (cell(group.amount),) } else { row }
    }),
    footer: {
      let row = (
        cell(labels.total, strong: true),
        cell(data.totals.hours, strong: true),
        [],
        cell(data.totals.entries, strong: true),
      )
      if internal { row + (cell(data.totals.amount, strong: true),) } else { row }
    },
  )
}

// ─── Details ────────────────────────────────────────────────────────────────────────────────
#v(13pt)
#section(labels.details, labels.detailsDescription)

// Both modes share one table: the mode only adds the rate and amount columns, and
// `detailColumns` decides which identifying columns are worth drawing at all — a dimension a
// filter pinned to one value is stated once in the header instead, and the description takes the
// freed width back.
#{
  // The date column fits the longest localized medium date ("2026. júl. 12.") on one line, and the
  // project column a two-word project name next to its colour dot. A cost-free row has fewer
  // columns competing for the page, so its identifying column can be wider.
  let columns = (22mm,)
  let aligns = (left,)
  let headers = (labels.date,)

  if data.detailColumns.member {
    columns.push(if internal { 25mm } else { 34mm })
    aligns.push(left)
    headers.push(labels.member)
  }

  if data.detailColumns.project {
    columns.push(if internal { 31mm } else { 34mm })
    aligns.push(left)
    headers.push(labels.project)
  }

  data-table(
    columns: columns + if internal { (1fr, 16mm, 19mm, 22mm) } else { (1fr, 16mm) },
    align: aligns + if internal { (left, right, right, right) } else { (left, right) },
    headers: headers
      + if internal {
        (labels.description, labels.hours, labels.rate, labels.amount)
      } else {
        (labels.description, labels.hours)
      },
    rows: data.lines.map(line => {
      let row = (cell(line.date),)

      if data.detailColumns.member {
        // The four-column cost-free row has space for an initials chip. On an internal row that
        // already carries a project, a rate and an amount, it would only add noise.
        row.push(if internal {
          cell(line.member, strong: true)
        } else {
          entity(line.member, initials: line.memberInitials)
        })
      }

      if data.detailColumns.project {
        row.push(entity(line.project, color: line.projectColor))
      }

      row += (cell(line.description), cell(line.hours))
      if internal { row + (cell(line.rate), cell(line.amount)) } else { row }
    }),
    footer: {
      let total = (
        // Everything left of the hours column.
        table.cell(colspan: headers.len() + 1)[#text(weight: "semibold")[#labels.total]],
        cell(data.totals.hours, strong: true),
      )
      if internal { total + ([], cell(data.totals.amount, strong: true)) } else { total }
    },
  )
}

#v(9pt)
#stack(
  spacing: 3pt,
  ..data.footnotes.map(note => text(size: 6.8pt, fill: muted)[#note]),
)
