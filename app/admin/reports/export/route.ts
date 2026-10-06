import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { applyReportLineEdits, parseReportLineEdits } from "@/src/lib/report-line-edits";
import { isDurationDisplayFormat } from "@/src/lib/formatting";
import { requireAdminAppMember } from "@/src/server/auth/app-access";
import {
  generateReportPdfExport,
  getTimeEntryReportSnapshot,
  parseReportExportLocale,
  parseReportMode,
  parseReportSearchParams,
  reportSearchParamsFromFormData,
  resolveReportExportTitle,
  type ReportPdfExportFilters,
} from "@/src/server/reports";
import { formatDateOnly } from "@/src/server/time-tracking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const { member: admin } = await requireAdminAppMember("/admin/reports");
  const formData = await request.formData();
  const locale = parseReportExportLocale(formData.get("locale"));
  const mode = parseReportMode(formData.get("mode"));
  const requestedDurationDisplayFormat = formData.get("durationDisplayFormat");
  const durationDisplayFormat = isDurationDisplayFormat(requestedDurationDisplayFormat)
    ? requestedDurationDisplayFormat
    : admin.durationDisplayFormat;
  const filters = parseReportSearchParams(reportSearchParamsFromFormData(formData), admin.timezone);
  // The export locale is chosen in the dialog, not taken from the request cookie, so it is passed
  // explicitly and the interface language never decides what the document says.
  const t = await getTranslations({ locale, namespace: "AdminReports" });
  const sourceSnapshot = await getTimeEntryReportSnapshot({
    periodStart: filters.periodStart,
    periodEnd: filters.periodEnd,
    view: filters.view,
    mode,
    projectIds: filters.projectIds,
    projectGroupIds: filters.projectGroupIds,
    memberIds: filters.memberIds,
  });
  const snapshot = applyReportLineEdits(
    sourceSnapshot,
    parseReportLineEdits(formData.get("lineEdits")),
  );
  const title = resolveReportExportTitle(formData.get("title"), snapshot.period);

  if (snapshot.lines.length === 0) {
    return new Response("No tracked time matches these export filters.", {
      status: 400,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  try {
    const result = await generateReportPdfExport({
      title,
      snapshot,
      locale,
      timezone: admin.timezone,
      generatedByMemberId: admin.id,
      durationDisplayFormat,
      filters: buildExportFilters(filters, durationDisplayFormat),
      t,
      requestMetadata: {
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      },
    });

    return new NextResponse(new Uint8Array(result.pdfBytes), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${sanitizeHeaderFilename(result.filename)}"`,
        "Content-Length": String(result.pdfBytes.byteLength),
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
        "X-Report-Export-Id": result.reportExportId,
        "X-Document-Id": result.documentId,
      },
    });
  } catch (error) {
    return new Response(getExportErrorMessage(error), {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}

function buildExportFilters(
  filters: ReturnType<typeof parseReportSearchParams>,
  durationDisplayFormat: ReportPdfExportFilters["durationDisplayFormat"],
): ReportPdfExportFilters {
  return {
    period: filters.period,
    anchor: filters.anchor,
    periodStart: formatDateOnly(filters.periodStart),
    periodEnd: formatDateOnly(filters.periodEnd),
    projectIds: filters.projectIds,
    projectGroupIds: filters.projectGroupIds,
    memberIds: filters.memberIds,
    durationDisplayFormat,
  };
}

function sanitizeHeaderFilename(filename: string) {
  return filename.replaceAll(/[\r\n"]/g, "_") || "time-report.pdf";
}

function getExportErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The report PDF could not be generated.";
}
