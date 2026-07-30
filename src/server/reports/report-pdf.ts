import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/src/server/db/client";
import type { Prisma } from "@/src/server/db/generated/client";
import { renderTypstPdf } from "@/src/server/pdf/typst";
import { getObjectStorage, type ObjectStorage } from "@/src/server/storage";

import type {
  ReportCostFreeLine,
  ReportCurrencyTotal,
  ReportInternalGroup,
  ReportInternalLine,
  ReportSnapshot,
  ReportWarning,
} from "./reports";

export type ReportPdfExportFilters = {
  period: string;
  anchor: string;
  periodStart: string;
  periodEnd: string;
  projectId: string | null;
  projectGroupId: string | null;
  memberId: string | null;
};

export type GenerateReportPdfExportInput = {
  title: string;
  snapshot: ReportSnapshot;
  locale: string;
  timezone: string;
  generatedByMemberId: string;
  filters: ReportPdfExportFilters;
  requestMetadata?: {
    ipAddress?: string | null;
    userAgent?: string | null;
  };
};

export type GenerateReportPdfExportResult = {
  reportExportId: string;
  documentId: string;
  filename: string;
  pdfBytes: Buffer;
};

export type GenerateReportPdfExportDeps = {
  storage?: ObjectStorage;
  renderer?: (input: { source: string; filename: string }) => Promise<Buffer>;
  now?: Date;
};

export class ReportPdfExportError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ReportPdfExportError";
  }
}

export async function generateReportPdfExport(
  input: GenerateReportPdfExportInput,
  deps: GenerateReportPdfExportDeps = {},
): Promise<GenerateReportPdfExportResult> {
  const title = normalizeTitle(input.title);
  const now = deps.now ?? new Date();
  const filename = `${sanitizeFilename(title)}.pdf`;
  const source = buildReportExportTypstSource({
    title,
    snapshot: input.snapshot,
    locale: input.locale,
    generatedAt: now,
  });
  const renderer = deps.renderer ?? ((renderInput) => renderTypstPdf(renderInput));
  const storage = deps.storage ?? getObjectStorage();
  const pdfBytes = await renderer({ source, filename });
  const checksumSha256 = createHash("sha256").update(pdfBytes).digest("hex");
  const objectKey = buildReportExportObjectKey({
    generatedByMemberId: input.generatedByMemberId,
    periodStart: input.snapshot.period.start,
    filename,
  });
  const objectRef = await storage.putObject({
    key: objectKey,
    body: pdfBytes,
    contentType: "application/pdf",
    byteSize: pdfBytes.byteLength,
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          type: "REPORT_EXPORT",
          status: "AVAILABLE",
          ownerMemberId: null,
          storageBucket: objectRef.bucket,
          storageKey: objectRef.key,
          originalFilename: filename,
          contentType: "application/pdf",
          byteSize: BigInt(pdfBytes.byteLength),
          checksumSha256,
          uploadedByMemberId: input.generatedByMemberId,
          createdAt: now,
        },
        select: {
          id: true,
        },
      });

      const reportExport = await tx.reportExport.create({
        data: {
          title,
          mode: input.snapshot.mode,
          view: input.snapshot.view,
          filters: input.filters as unknown as Prisma.InputJsonObject,
          timezone: input.timezone,
          renderSnapshot: input.snapshot as unknown as Prisma.InputJsonObject,
          documentId: document.id,
          generatedByMemberId: input.generatedByMemberId,
          createdAt: now,
        },
        select: {
          id: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorMemberId: input.generatedByMemberId,
          action: "report.exported",
          targetType: "report_export",
          targetId: reportExport.id,
          after: {
            reportExportId: reportExport.id,
            documentId: document.id,
            documentStorageKey: objectRef.key,
            title,
            mode: input.snapshot.mode,
            view: input.snapshot.view,
            periodStart: input.snapshot.period.start,
            periodEnd: input.snapshot.period.end,
            byteSize: pdfBytes.byteLength,
            checksumSha256,
          },
          ...input.requestMetadata,
          createdAt: now,
        },
      });

      return {
        reportExportId: reportExport.id,
        documentId: document.id,
      };
    });

    return {
      ...result,
      filename,
      pdfBytes,
    };
  } catch (error) {
    await storage.deleteObject(objectRef).catch(() => undefined);
    throw error;
  }
}

export function buildReportExportTypstSource(input: {
  title: string;
  snapshot: ReportSnapshot;
  locale: string;
  generatedAt: Date;
}) {
  const { snapshot, locale } = input;
  const labels = getReportPdfLabels(locale);
  const title = normalizeTitle(input.title);
  const detailsTable =
    snapshot.mode === "INTERNAL"
      ? buildInternalDetailsTable(snapshot.lines, labels, locale)
      : buildCostFreeDetailsTable(snapshot.lines, snapshot.view, labels, locale);

  return [
    buildTypstPreamble(labels),
    buildDocumentHeader({
      title,
      snapshot,
      labels,
      locale,
      generatedAt: input.generatedAt,
    }),
    "#v(9pt)",
    buildSummaryGrid(snapshot, labels, locale),
    buildWarningsBlock(snapshot.warnings, labels, locale),
    "#v(10pt)",
    buildSection(labels.breakdown, labels.breakdownDescription),
    buildGroupTable(snapshot, labels, locale),
    "#v(10pt)",
    buildSection(labels.details, labels.detailsDescription),
    detailsTable,
    "#v(10pt)",
    `#text(size: 7pt, fill: muted)[${escapeTypstContent(labels.timezoneNote)} ${escapeTypstContent(
      snapshot.period.timezones.join(", ") || labels.none,
    )}.]`,
    "",
  ].join("\n");
}

function buildTypstPreamble(labels: ReportPdfLabels) {
  return [
    '#let ink = rgb("#0b2c2e")',
    '#let bg = rgb("#f4ebdd")',
    '#let panel = rgb("#fffaf4")',
    '#let panelSoft = rgb("#f8f3ea")',
    '#let border = rgb("#e7dccc")',
    '#let muted = rgb("#66706f")',
    '#let accent = rgb("#1f807f")',
    '#let accentSoft = rgb("#d7eeee")',
    '#let warning = rgb("#a96f0f")',
    '#let warningSoft = rgb("#fff3dc")',
    '#set page(paper: "a4", fill: bg, margin: (x: 14mm, y: 14mm), footer: [',
    "  #set text(size: 7pt, fill: muted)",
    "  #line(length: 100%, stroke: border)",
    "  #v(3pt)",
    `  #grid(columns: (1fr, auto), [Sheet Happens], [${escapeTypstContent(
      labels.page,
    )} #context counter(page).display("1")])`,
    "])",
    '#set text(font: ("Inter", "Arial", "Helvetica", "Libertinus Serif"), size: 8.7pt, fill: ink)',
    "#set par(leading: 0.58em)",
    "#set heading(numbering: none)",
    "",
  ].join("\n");
}

function buildDocumentHeader(input: {
  title: string;
  snapshot: ReportSnapshot;
  labels: ReportPdfLabels;
  locale: string;
  generatedAt: Date;
}) {
  const modeLabel =
    input.snapshot.mode === "INTERNAL" ? input.labels.internalMode : input.labels.costFreeMode;

  return [
    "#rect(width: 100%, fill: panel, stroke: border, radius: 8pt, inset: 12pt)[",
    "  #grid(columns: (1fr, 43mm), gutter: 10pt,",
    "    [",
    `      #text(size: 7pt, fill: accent, weight: "bold")[${escapeTypstContent(
      input.labels.brand,
    )}]`,
    "      #v(3pt)",
    `      #text(size: 22pt, weight: "bold")[${escapeTypstContent(input.title)}]`,
    "      #v(5pt)",
    `      #text(size: 8.5pt, fill: muted)[${escapeTypstContent(
      formatReportSubtitle(input.snapshot, input.labels, input.locale),
    )}]`,
    "    ],",
    "    [",
    "      #align(right)[",
    `        #rect(fill: accentSoft, stroke: accent, radius: 10pt, inset: (x: 7pt, y: 3pt))[#text(size: 7pt, fill: accent, weight: "bold")[${escapeTypstContent(
      modeLabel.toUpperCase(),
    )}]]`,
    "      ]",
    "      #v(7pt)",
    `      #align(right)[#text(size: 7pt, fill: muted)[${escapeTypstContent(
      input.labels.generatedAt,
    )}]]`,
    `      #align(right)[#text(size: 8pt, weight: "semibold")[${escapeTypstContent(
      formatDateTime(input.generatedAt, input.locale),
    )}]]`,
    "    ],",
    "  )",
    "]",
  ].join("\n");
}

function buildSummaryGrid(snapshot: ReportSnapshot, labels: ReportPdfLabels, locale: string) {
  const summaryCards = [
    [labels.totalHours, formatHours(snapshot.summary.totalMinutes, locale)],
    [labels.period, formatPeriod(snapshot.period.start, snapshot.period.end, locale)],
    [labels.people, formatInteger(snapshot.summary.peopleCount, locale)],
    [labels.projects, formatInteger(snapshot.summary.projectCount, locale)],
  ];

  if (snapshot.mode === "INTERNAL") {
    summaryCards.push([
      labels.amount,
      snapshot.summary.currencyTotals.length > 0
        ? formatCurrencyTotals(snapshot.summary.currencyTotals, locale)
        : labels.missingRate,
    ]);
  }

  return [
    "#grid(columns: (1fr, 1.75fr, 1fr), gutter: 6pt,",
    ...summaryCards.map(([label, value]) =>
      [
        "  rect(width: 100%, fill: panel, stroke: border, radius: 6pt, inset: 8pt)[",
        `    #text(size: 7pt, fill: muted, weight: "bold")[${escapeTypstContent(label)}]`,
        "    #v(2pt)",
        `    #text(size: 14pt, weight: "bold")[${escapeTypstContent(value)}]`,
        "  ],",
      ].join("\n"),
    ),
    ")",
  ].join("\n");
}

function buildWarningsBlock(warnings: ReportWarning[], labels: ReportPdfLabels, locale: string) {
  if (warnings.length === 0) return "";

  return [
    "#v(8pt)",
    "#rect(width: 100%, fill: warningSoft, stroke: warning, radius: 6pt, inset: 8pt)[",
    `  #text(size: 7pt, fill: warning, weight: "bold")[${escapeTypstContent(labels.attention)}]`,
    "  #v(3pt)",
    ...warnings.map(
      (warning) =>
        `  #text(size: 8pt, fill: warning)[${escapeTypstContent(
          formatReportWarning(warning, labels, locale),
        )}]`,
    ),
    "]",
  ].join("\n");
}

function buildSection(title: string, description: string) {
  return [
    `#text(size: 11pt, weight: "bold")[${escapeTypstContent(title)}]`,
    "#v(2pt)",
    `#text(size: 7.6pt, fill: muted)[${escapeTypstContent(description)}]`,
    "#v(5pt)",
  ].join("\n");
}

function buildGroupTable(snapshot: ReportSnapshot, labels: ReportPdfLabels, locale: string) {
  const rows =
    snapshot.mode === "INTERNAL"
      ? (snapshot.groups as ReportInternalGroup[]).map((group) => {
          const amount = formatCurrencyTotals(group.currencyTotals, locale) || labels.missingRate;

          return [
            typstCell(group.label, { strong: true }),
            typstCell(formatHours(group.totalMinutes, locale)),
            typstCell(`${Math.round(group.percentageOfTotal)}%`),
            typstCell(formatInteger(group.entryCount, locale)),
            typstCell(amount),
          ].join(", ");
        })
      : snapshot.groups.map((group) =>
          [
            typstCell(group.label, { strong: true }),
            typstCell(formatHours(group.totalMinutes, locale)),
            typstCell(`${Math.round(group.percentageOfTotal)}%`),
            typstCell(formatInteger(group.entryCount, locale)),
          ].join(", "),
        );
  const headers = [labels.name, labels.hours, labels.share, labels.entries];

  if (snapshot.mode === "INTERNAL") {
    headers.push(labels.amount);
  }

  return [
    `#table(columns: ${snapshot.mode === "INTERNAL" ? "(2fr, 1fr, 1fr, 1fr, 1.4fr)" : "(2fr, 1fr, 1fr, 1fr)"}, stroke: border, inset: 0pt,`,
    `  table.header(${headers.map(typstHeaderCell).join(", ")}),`,
    rows.map((row) => `  ${row},`).join("\n"),
    ")",
  ].join("\n");
}

function buildCostFreeDetailsTable(
  lines: ReportCostFreeLine[],
  view: string,
  labels: ReportPdfLabels,
  locale: string,
) {
  const oppositeHeader = view === "USER" ? labels.project : labels.member;

  return [
    "#table(columns: (2.2cm, 3.2cm, 1fr, 1.8cm), stroke: border, inset: 0pt,",
    `  table.header(${[labels.date, oppositeHeader, labels.description, labels.hours].map(typstHeaderCell).join(", ")}),`,
    lines
      .map((line) =>
        [
          typstCell(formatDate(line.localDate, locale)),
          typstCell(view === "USER" ? line.project.name : line.member.name, { strong: true }),
          typstCell(line.description || labels.noDescription),
          typstCell(formatHours(line.durationMinutes, locale)),
        ].join(", "),
      )
      .map((row) => `  ${row},`)
      .join("\n"),
    ")",
  ].join("\n");
}

function buildInternalDetailsTable(
  lines: ReportInternalLine[],
  labels: ReportPdfLabels,
  locale: string,
) {
  return [
    "#table(columns: (2.1cm, 2.35cm, 2.35cm, 1fr, 1.35cm, 2cm, 2cm), stroke: border, inset: 0pt,",
    `  table.header(${[
      labels.date,
      labels.member,
      labels.project,
      labels.description,
      labels.hours,
      labels.rate,
      labels.amount,
    ]
      .map(typstHeaderCell)
      .join(", ")}),`,
    lines
      .map((line) =>
        [
          typstCell(formatDate(line.localDate, locale)),
          typstCell(line.member.name, { strong: true }),
          typstCell(line.project.name, { strong: true }),
          typstCell(line.description || labels.noDescription),
          typstCell(formatHours(line.durationMinutes, locale)),
          typstCell(formatRate(line, labels, locale)),
          typstCell(formatLineAmount(line, labels, locale)),
        ].join(", "),
      )
      .map((row) => `  ${row},`)
      .join("\n"),
    ")",
  ].join("\n");
}

function typstHeaderCell(value: string) {
  return `table.cell(fill: panelSoft, inset: 5pt)[#text(size: 7pt, fill: muted, weight: "bold")[${escapeTypstContent(value)}]]`;
}

function typstCell(value: string, options: { strong?: boolean } = {}) {
  const content = options.strong
    ? `#text(weight: "semibold")[${escapeTypstContent(value)}]`
    : escapeTypstContent(value);

  return `table.cell(inset: 5pt)[${content}]`;
}

function escapeTypstContent(value: string) {
  return value
    .replaceAll(/[\r\n\t]+/g, " ")
    .replaceAll("\\", "\\\\")
    .replaceAll("#", "\\#")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("*", "\\*")
    .replaceAll("_", "\\_")
    .replaceAll("$", "\\$")
    .replaceAll("<", "\\<")
    .replaceAll(">", "\\>");
}

type ReportPdfLabels = {
  brand: string;
  page: string;
  generatedAt: string;
  costFreeMode: string;
  internalMode: string;
  userView: string;
  projectView: string;
  totalHours: string;
  period: string;
  people: string;
  projects: string;
  amount: string;
  breakdown: string;
  breakdownDescription: string;
  details: string;
  detailsDescription: string;
  attention: string;
  name: string;
  hours: string;
  share: string;
  entries: string;
  date: string;
  member: string;
  project: string;
  description: string;
  rate: string;
  missingRate: string;
  noDescription: string;
  timezoneNote: string;
  none: string;
  missingRateWarning: (lineCount: string) => string;
  mixedCurrencyWarning: (currencies: string) => string;
};

function getReportPdfLabels(locale: string): ReportPdfLabels {
  if (locale.toLowerCase().startsWith("hu")) {
    return {
      brand: "SHEET HAPPENS - RIPORT EXPORT",
      page: "Oldal",
      generatedAt: "Generálva",
      costFreeMode: "Költségmentes időriport",
      internalMode: "Belső költségriport",
      userView: "felhasználó nézet",
      projectView: "projekt nézet",
      totalHours: "Összes óra",
      period: "Időszak",
      people: "Személyek",
      projects: "Projektek",
      amount: "Összeg",
      breakdown: "Bontás",
      breakdownDescription: "Összesített idő és bejegyzésszám a kiválasztott nézet szerint.",
      details: "Részletek",
      detailsDescription: "A riport alapjául szolgáló időbejegyzések.",
      attention: "FIGYELMEZTETÉS",
      name: "Név",
      hours: "Óra",
      share: "Arány",
      entries: "Bejegyzés",
      date: "Dátum",
      member: "Személy",
      project: "Projekt",
      description: "Leírás",
      rate: "Óradíj",
      missingRate: "Hiányzó óradíj",
      noDescription: "Nincs leírás",
      timezoneNote: "A dátumhatárok a tagok időzónája szerint értendők:",
      none: "nincs",
      missingRateWarning: (lineCount) => `${lineCount} bejegyzéshez hiányzik az óradíj.`,
      mixedCurrencyWarning: (currencies) => `A riport több pénznemet tartalmaz: ${currencies}.`,
    };
  }

  return {
    brand: "SHEET HAPPENS - REPORT EXPORT",
    page: "Page",
    generatedAt: "Generated",
    costFreeMode: "Cost-free time report",
    internalMode: "Internal cost report",
    userView: "user view",
    projectView: "project view",
    totalHours: "Total hours",
    period: "Period",
    people: "People",
    projects: "Projects",
    amount: "Amount",
    breakdown: "Breakdown",
    breakdownDescription: "Grouped hours and entry counts for the selected report view.",
    details: "Details",
    detailsDescription: "Time entries included in this report export.",
    attention: "ATTENTION",
    name: "Name",
    hours: "Hours",
    share: "Share",
    entries: "Entries",
    date: "Date",
    member: "Member",
    project: "Project",
    description: "Description",
    rate: "Rate",
    missingRate: "Missing rate",
    noDescription: "No description",
    timezoneNote: "Date boundaries follow member time zones:",
    none: "none",
    missingRateWarning: (lineCount) => `${lineCount} entries are missing rates.`,
    mixedCurrencyWarning: (currencies) => `The report contains multiple currencies: ${currencies}.`,
  };
}

function formatReportSubtitle(snapshot: ReportSnapshot, labels: ReportPdfLabels, locale: string) {
  const mode = snapshot.mode === "INTERNAL" ? labels.internalMode : labels.costFreeMode;
  const view = snapshot.view === "USER" ? labels.userView : labels.projectView;

  return `${mode}, ${view}, ${formatPeriod(snapshot.period.start, snapshot.period.end, locale)}`;
}

function formatReportWarning(warning: ReportWarning, labels: ReportPdfLabels, locale: string) {
  if (warning.code === "MISSING_RATE") {
    return labels.missingRateWarning(formatInteger(warning.lineCount, locale));
  }

  return labels.mixedCurrencyWarning(warning.currencyCodes.join(", "));
}

function formatRate(line: ReportInternalLine, labels: ReportPdfLabels, locale: string) {
  if (!line.rate) return labels.missingRate;

  return `${formatDecimal(line.rate.hourlyRate, locale)} ${line.rate.currencyCode}/h`;
}

function formatLineAmount(line: ReportInternalLine, labels: ReportPdfLabels, locale: string) {
  if (!line.amount || !line.currencyCode) return labels.missingRate;

  return formatMoney(line.amount, line.currencyCode, locale);
}

function formatCurrencyTotals(totals: ReportCurrencyTotal[], locale: string) {
  return totals.map((total) => formatMoney(total.amount, total.currencyCode, locale)).join(", ");
}

function formatMoney(amount: string, currencyCode: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

function formatHours(minutes: number, locale: string) {
  const hours = minutes / 60;

  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: hours % 1 === 0 ? 0 : 2,
  }).format(hours)} h`;
}

function formatInteger(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

function formatDecimal(value: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateTime(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatPeriod(start: string, end: string, locale: string) {
  return `${formatDate(start, locale)} - ${formatDate(end, locale)}`;
}

function normalizeTitle(title: string) {
  return title.trim().replaceAll(/\s+/g, " ").slice(0, 120) || "Time report";
}

function buildReportExportObjectKey(input: {
  generatedByMemberId: string;
  periodStart: string;
  filename: string;
}) {
  return [
    "report-exports",
    input.generatedByMemberId,
    input.periodStart,
    `${randomUUID()}-${sanitizeFilename(input.filename)}.pdf`,
  ].join("/");
}

function sanitizeFilename(filename: string) {
  const normalized = filename
    .trim()
    .replaceAll(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/\.pdf$/i, "");

  return normalized || "time-report";
}
