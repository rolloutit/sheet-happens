import { writeFile } from "node:fs/promises";

import en from "@/messages/en.json";
import hu from "@/messages/hu.json";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { buildReportPdfPayload, type ReportPdfTranslator } from "./report-pdf-payload";
import type { DurationDisplayFormat } from "@/src/lib/formatting";
import {
  createCostFreeReportSnapshot,
  createInternalReportSnapshot,
  createInternalReportSnapshotWithWarnings,
} from "./report-snapshot.fixture";

const generatedAt = new Date("2026-07-31T12:00:00.000Z");

function translator(locale: "en" | "hu"): ReportPdfTranslator {
  return createTranslator({
    locale,
    messages: locale === "en" ? en : hu,
    namespace: "AdminReports",
  }) as unknown as ReportPdfTranslator;
}

function buildPayload(
  snapshot: Parameters<typeof buildReportPdfPayload>[0]["snapshot"],
  locale: "en" | "hu" = "en",
  title = "Client July report",
  durationDisplayFormat: DurationDisplayFormat = "DECIMAL_HOURS",
) {
  return buildReportPdfPayload({
    title,
    snapshot,
    locale,
    generatedAt,
    durationDisplayFormat,
    t: translator(locale),
  });
}

describe("report PDF payload", () => {
  it("omits rates and amounts entirely for cost-free exports", () => {
    const payload = buildPayload(createCostFreeReportSnapshot());

    expect(payload.mode).toBe("COST_FREE");
    // Structural, not textual: the fields are absent from the serialized payload, so a
    // cost-free export cannot leak cost data even if the template asked for it.
    const serialized = JSON.parse(JSON.stringify(payload));
    for (const line of serialized.lines) {
      expect(line).not.toHaveProperty("rate");
      expect(line).not.toHaveProperty("amount");
    }
    for (const group of serialized.groups) {
      expect(group).not.toHaveProperty("amount");
    }
    expect(serialized.totals).not.toHaveProperty("amount");
    expect(payload.summary.heroes.map((metric) => metric.label)).not.toContain("Amount");
    expect(JSON.stringify(payload)).not.toContain("EUR");
  });

  it("never names the export mode in the copy it renders", () => {
    for (const snapshot of [createCostFreeReportSnapshot(), createInternalReportSnapshot()]) {
      for (const locale of ["en", "hu"] as const) {
        const payload = buildPayload(snapshot, locale);
        // Every string the document prints, as opposed to `mode`, which only selects columns.
        const copy = [
          ...Object.values(payload.labels),
          ...payload.header.facets.flatMap((facet) => [facet.label, facet.value]),
          ...[...payload.summary.heroes, ...payload.summary.metrics].map((metric) => metric.label),
          ...payload.warnings,
          ...payload.footnotes,
        ]
          .join(" ")
          .toLowerCase();

        for (const wording of ["cost-free", "internal", "költségmentes", "belső"]) {
          expect(copy).not.toContain(wording);
        }
      }
    }
  });

  it("carries rates and amounts for internal exports", () => {
    const payload = buildPayload(createInternalReportSnapshot());

    if (payload.mode !== "INTERNAL") throw new Error("expected an internal payload");
    expect(payload.lines[0].rate).toBe("100 EUR/h");
    expect(payload.lines[0].amount).toBe("€300.00");
    expect(payload.groups[0].amount).toBe("€300.00");
    expect(payload.summary.heroes.at(-1)).toEqual({ label: "Amount", value: "€300.00" });
    // Hours are pinned decimal on an internal export (see "pins decimal hours..." below), so a
    // whole-hour total still carries its two zero decimals rather than dropping them.
    expect(payload.totals).toEqual({ hours: "3.00 h", entries: "1", amount: "€300.00" });
  });

  it("totals the report once for both tables", () => {
    const payload = buildPayload(createCostFreeReportSnapshot());

    expect(payload.totals).toEqual({ hours: "3 h", entries: "1" });
  });

  it("uses the independently selected hour-minute format throughout a cost-free PDF", () => {
    const snapshot = createCostFreeReportSnapshot();
    snapshot.lines[0].durationMinutes = 203;
    snapshot.groups[0].totalMinutes = 203;
    snapshot.summary.totalMinutes = 203;
    const payload = buildPayload(snapshot, "en", "Client July report", "HOURS_MINUTES");

    expect(payload.summary.heroes[0].value).toBe("3:23");
    expect(payload.groups[0].hours).toBe("3:23");
    expect(payload.lines[0].hours).toBe("3:23");
    expect(payload.totals.hours).toBe("3:23");
  });

  it("pins decimal hours on an internal export regardless of the requested format", () => {
    const snapshot = createInternalReportSnapshot();
    snapshot.lines[0].durationMinutes = 203;
    snapshot.groups[0].totalMinutes = 203;
    snapshot.summary.totalMinutes = 203;
    const payload = buildPayload(snapshot, "en", "Client July report", "HOURS_MINUTES");

    if (payload.mode !== "INTERNAL") throw new Error("expected an internal payload");
    // An internal export prints amounts beside every hours figure, so the member's
    // HOURS_MINUTES preference is overridden — hours stay checkable against the amount printed
    // beside them, the same rule Harvest and Clockify apply on their own money-facing screens.
    expect(payload.summary.heroes[0].value).toBe("3.38 h");
    expect(payload.groups[0].hours).toBe("3.38 h");
    expect(payload.lines[0].hours).toBe("3.38 h");
    expect(payload.totals.hours).toBe("3.38 h");
  });

  it("describes the export scope through header facets instead of the mode", () => {
    const snapshot = createCostFreeReportSnapshot();
    const payload = buildPayload(snapshot);

    expect(payload.header.facets).toEqual([
      { label: "View", value: "User view", color: null },
      { label: "Period", value: "Jul 1, 2026 - Jul 31, 2026", color: null },
      { label: "Project", value: "All projects", color: null },
      { label: "Member", value: "All members", color: null },
    ]);
    expect(payload.header.generatedAt).toBe("Jul 31, 2026, 02:00 PM");
  });

  it("names the applied filters and adds the group facet only when one is set", () => {
    const snapshot = createCostFreeReportSnapshot();
    const payload = buildPayload({
      ...snapshot,
      filters: {
        ...snapshot.filters,
        projectName: "Client Portal",
        projectGroupName: "Key accounts",
        memberName: "Contractor Example",
      },
    });

    expect(payload.header.facets.map((facet) => facet.value)).toEqual([
      "User view",
      "Jul 1, 2026 - Jul 31, 2026",
      "Client Portal",
      "Key accounts",
      "Contractor Example",
    ]);
  });

  it("shows the dimension a cost-free report is not grouped by", () => {
    const userView = buildPayload(createCostFreeReportSnapshot());
    const projectView = buildPayload({ ...createCostFreeReportSnapshot(), view: "PROJECT" });

    expect(userView.detailColumns).toEqual({ member: false, project: true });
    expect(projectView.detailColumns).toEqual({ member: true, project: false });
    // Both dimensions travel with the line; the columns decide which of them is drawn.
    expect(userView.lines[0]).toMatchObject({
      member: "Contractor Example",
      memberInitials: "CE",
      project: "Client Portal",
      projectColor: "#1f807f",
    });
  });

  it("swaps in the other dimension when a filter pins the one it would have shown", () => {
    const snapshot = createCostFreeReportSnapshot();
    const singleProject = buildPayload({
      ...snapshot,
      filters: { ...snapshot.filters, projectId: "project-1", projectName: "Client Portal" },
    });
    const singleMember = buildPayload({
      ...snapshot,
      view: "PROJECT",
      filters: { ...snapshot.filters, memberId: "member-1", memberName: "Contractor Example" },
    });

    // A user-view report normally lists projects. With one project selected it lists members
    // instead, so the rows stay attributable rather than turning anonymous.
    expect(singleProject.detailColumns).toEqual({ member: true, project: false });
    expect(singleMember.detailColumns).toEqual({ member: false, project: true });
  });

  it("drops both identifying columns only when both dimensions are pinned", () => {
    const snapshot = createCostFreeReportSnapshot();
    const payload = buildPayload({
      ...snapshot,
      filters: {
        ...snapshot.filters,
        projectId: "project-1",
        projectName: "Client Portal",
        memberId: "member-1",
        memberName: "Contractor Example",
      },
    });

    expect(payload.detailColumns).toEqual({ member: false, project: false });
  });

  it("keeps both columns in an internal export and drops only the pinned one", () => {
    const snapshot = createInternalReportSnapshot();

    expect(buildPayload(snapshot).detailColumns).toEqual({ member: true, project: true });
    expect(
      buildPayload({
        ...snapshot,
        filters: { ...snapshot.filters, projectId: "project-1", projectName: "Client Portal" },
      }).detailColumns,
    ).toEqual({ member: true, project: false });
  });

  it("keeps the project column when a project group is filtered rather than one project", () => {
    const snapshot = createCostFreeReportSnapshot();
    const payload = buildPayload({
      ...snapshot,
      filters: { ...snapshot.filters, projectGroupId: "group-1", projectGroupName: "Key accounts" },
    });

    // A group still spans several projects, so the column is doing work.
    expect(payload.detailColumns).toEqual({ member: false, project: true });
  });

  it("drops the redundant count metric and dots the facet for a single-project export", () => {
    const snapshot = createCostFreeReportSnapshot();
    const payload = buildPayload({
      ...snapshot,
      filters: { ...snapshot.filters, projectId: "project-1", projectName: "Client Portal" },
    });

    expect(payload.summary.metrics.map((metric) => metric.label)).toEqual(["Entries", "People"]);
    expect(payload.header.facets[2]).toEqual({
      label: "Project",
      value: "Client Portal",
      color: "#1f807f",
    });
  });

  it("drops the people metric for a single-member export", () => {
    const snapshot = createCostFreeReportSnapshot();
    const payload = buildPayload({
      ...snapshot,
      filters: { ...snapshot.filters, memberId: "member-1", memberName: "Contractor Example" },
    });

    expect(payload.summary.metrics.map((metric) => metric.label)).toEqual(["Entries", "Projects"]);
    // Colour is how the app identifies a project; a member facet carries no dot.
    expect(payload.header.facets.at(-1)?.color).toBeNull();
  });

  it("identifies groups by initials in user view and by colour in project view", () => {
    const snapshot = createCostFreeReportSnapshot();
    const userGroup = buildPayload(snapshot).groups[0];
    const projectGroup = buildPayload({
      ...snapshot,
      view: "PROJECT",
      groups: [
        { ...snapshot.groups[0], kind: "PROJECT", color: "#37e3de", initials: null, label: "Ops" },
      ],
    }).groups[0];

    expect(userGroup).toMatchObject({ initials: "CE", color: null });
    expect(projectGroup).toMatchObject({ initials: null, color: "#37e3de" });
  });

  it("drops a colour Typst could not parse rather than failing the render", () => {
    const snapshot = createCostFreeReportSnapshot();
    const payload = buildPayload({
      ...snapshot,
      lines: [
        {
          ...snapshot.lines[0],
          project: { ...snapshot.lines[0].project, color: "var(--color-primary)" },
        },
      ],
    });

    if (payload.mode !== "COST_FREE") throw new Error("expected a cost-free payload");
    expect(payload.lines[0].projectColor).toBeNull();
  });

  it("carries the share both as a label and as a bar width", () => {
    const payload = buildPayload({
      ...createCostFreeReportSnapshot(),
      groups: [
        { ...createCostFreeReportSnapshot().groups[0], percentageOfTotal: 33.333 },
        { ...createCostFreeReportSnapshot().groups[0], percentageOfTotal: 140 },
      ],
    });

    expect(payload.groups[0]).toMatchObject({ share: "33%", sharePercent: 33.333 });
    // The bar width is clamped so an unexpected value cannot overflow the track.
    expect(payload.groups[1].sharePercent).toBe(100);
  });

  it("resolves every label from the message catalogue", () => {
    const payload = buildPayload(createInternalReportSnapshot());

    expect(payload.labels).toEqual({
      brand: "Sheet Happens",
      confidential: "Confidential",
      page: "Page",
      generatedAt: "Generated",
      attention: "Attention",
      breakdown: "Breakdown",
      breakdownDescription: "Grouped hours and entry counts for the selected report view.",
      details: "Details",
      detailsDescription: "Time entries included in this report export.",
      name: "Name",
      hours: "Hours",
      share: "Share",
      entries: "Entries",
      amount: "Amount",
      total: "Total",
      date: "Date",
      member: "Member",
      project: "Project",
      description: "Description",
      rate: "Rate",
    });
    // No label may fall through as a missing-message marker.
    for (const value of Object.values(payload.labels)) {
      expect(value).not.toMatch(/AdminReports/);
    }
  });

  it("localizes the header, labels and formatted values in Hungarian", () => {
    const payload = buildPayload(createInternalReportSnapshot(), "hu", "Júliusi riport");

    expect(payload.title).toBe("Júliusi riport");
    expect(payload.labels.page).toBe("Oldal");
    expect(payload.labels.confidential).toBe("Bizalmas");
    expect(payload.header.facets[0]).toEqual({
      label: "Nézet",
      value: "Felhasználó nézet",
      color: null,
    });
    expect(payload.header.facets[1].value).toBe("2026. júl. 1. - 2026. júl. 31.");
    expect(payload.lines[0].date).toBe("2026. júl. 12.");
  });

  it("renders warnings through ICU messages", () => {
    const payload = buildPayload(createInternalReportSnapshotWithWarnings());

    expect(payload.warnings).toEqual([
      "1 entry is missing a rate.",
      "The report contains multiple currencies: EUR, USD.",
    ]);

    const huPayload = buildPayload(createInternalReportSnapshotWithWarnings(), "hu");
    expect(huPayload.warnings[0]).toBe("1 bejegyzéshez hiányzik az óradíj.");
  });

  it("marks a rate-less line and explains the marker in a footnote", () => {
    const payload = buildPayload(createInternalReportSnapshotWithWarnings());

    if (payload.mode !== "INTERNAL") throw new Error("expected an internal payload");
    // A sentence would wrap inside a numeric column, so the cell carries a marker instead.
    expect(payload.lines[1].rate).toBe("—");
    expect(payload.lines[1].amount).toBe("—");
    expect(payload.lines[1].description).toBe("No description");
    expect(payload.footnotes.at(-1)).toBe(
      "— marks a time entry with no hourly rate for its period.",
    );
  });

  it("normalizes the title and notes the member time zones", () => {
    const payload = buildPayload(createCostFreeReportSnapshot(), "en", "  Spaced   out  title  ");

    expect(payload.title).toBe("Spaced out title");
    // Nothing is missing a rate, so the marker legend stays out of the document.
    expect(payload.footnotes).toEqual([
      "Member-local date boundaries. Time zones: Europe/Budapest",
    ]);
  });

  it("falls back to a placeholder when no time zone is present", () => {
    const snapshot = createCostFreeReportSnapshot();
    const payload = buildPayload({ ...snapshot, period: { ...snapshot.period, timezones: [] } });

    expect(payload.footnotes[0]).toBe("Member-local date boundaries. Time zones: none");
  });

  it.runIf(process.env.RUN_TYPST_SMOKE === "1")(
    "renders both modes and the export previews with the local Typst binary",
    async () => {
      const { renderTypstDocument, renderTypstDocumentPages } = await import("@/src/server/pdf");

      const costFree = createCostFreeReportSnapshot();

      for (const [name, snapshot] of [
        ["cost-free", costFree],
        ["internal", createInternalReportSnapshotWithWarnings()],
        // Pinning both dimensions drops both identifying columns, which is a different set of
        // table columns for Typst to lay out — and the only case with no breakdown section.
        [
          "single-project",
          {
            ...costFree,
            filters: {
              ...costFree.filters,
              projectId: "project-1",
              projectName: "Client Portal",
              memberId: "member-1",
              memberName: "Contractor Example",
            },
          },
        ],
      ] as const) {
        for (const locale of ["en", "hu"] as const) {
          const pdf = await renderTypstDocument(
            {
              template: "report",
              data: buildPayload(snapshot, locale),
              filename: `report-${name}-${locale}`,
            },
            { timeoutMs: 20_000 },
          );

          expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");

          if (process.env.REPORT_PDF_SMOKE_DIR) {
            await writeFile(`${process.env.REPORT_PDF_SMOKE_DIR}/${name}-${locale}.pdf`, pdf);
          }
        }
      }

      // The export preview relies on the same template and payload.
      const preview = await renderTypstDocument(
        {
          template: "report",
          data: buildPayload(createInternalReportSnapshot()),
          filename: "report-preview",
          format: "png",
          pages: "1",
          ppi: 96,
        },
        { timeoutMs: 20_000 },
      );

      expect(preview.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      // What the preview route serves: every page of the real document, as SVG.
      const previewPages = await renderTypstDocumentPages(
        {
          template: "report",
          data: buildPayload(createInternalReportSnapshot()),
          filename: "report-preview",
          format: "svg",
        },
        { timeoutMs: 20_000 },
      );

      expect(previewPages.length).toBeGreaterThan(0);

      for (const page of previewPages) {
        expect(page.toString("utf8")).toMatch(/^<svg/);
      }
    },
  );
});
