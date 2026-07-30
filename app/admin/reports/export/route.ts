import { NextResponse } from "next/server";

import { requireAdminAppMember } from "@/src/server/auth/app-access";
import {
  generateReportPdfExport,
  getTimeEntryReportSnapshot,
  normalizeReportExportTitle,
  parseReportMode,
  parseReportSearchParams,
  reportSearchParamsFromFormData,
  type ReportPdfExportFilters,
} from "@/src/server/reports";
import { formatDateOnly } from "@/src/server/time-tracking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const { member: admin } = await requireAdminAppMember("/admin/reports");
  const formData = await request.formData();
  const locale = parseLocale(formString(formData, "locale"));
  const mode = parseReportMode(formData.get("mode"));
  const filters = parseReportSearchParams(reportSearchParamsFromFormData(formData), admin.timezone);
  const snapshot = await getTimeEntryReportSnapshot({
    periodStart: filters.periodStart,
    periodEnd: filters.periodEnd,
    view: filters.view,
    mode,
    projectId: filters.projectId,
    projectGroupId: filters.projectGroupId,
    memberId: filters.memberId,
  });
  const title =
    normalizeReportExportTitle(formData.get("title")) ||
    `Time report ${snapshot.period.start} ${snapshot.period.end}`;

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
      filters: buildExportFilters(filters),
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
): ReportPdfExportFilters {
  return {
    period: filters.period,
    anchor: filters.anchor,
    periodStart: formatDateOnly(filters.periodStart),
    periodEnd: formatDateOnly(filters.periodEnd),
    projectId: filters.projectId,
    projectGroupId: filters.projectGroupId,
    memberId: filters.memberId,
  };
}

function parseLocale(value: string | undefined) {
  return value === "en" ? "en" : "hu";
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
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
