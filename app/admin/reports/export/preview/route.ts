import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import { renderTypstDocumentPages } from "@/src/server/pdf";
import {
  buildReportPdfPayload,
  getTimeEntryReportSnapshot,
  parseReportExportLocale,
  parseReportMode,
  parseReportSearchParams,
  resolveReportExportTitle,
} from "@/src/server/reports";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * A preview renders and stores nothing: no document, no report export row, no audit entry and no
 * object in storage. `generateReportPdfExport` writes all four, so it is deliberately not used
 * here — a live preview would otherwise create an export record on every settled keystroke.
 */
const PREVIEW_PAGE_LIMIT = 12;
const RENDER_TIMEOUT_MS = 20_000;

const PREVIEW_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request) {
  let admin;

  try {
    // The throwing variant, not the redirecting `requireAdminAppMember`: a stale session has to come
    // back as JSON the dialog can react to, not as the login page's HTML.
    admin = (await requireAdminAppMemberForAction()).member;
  } catch (error) {
    if (error instanceof AuthorizationError) return errorResponse(403);
    if (error instanceof AuthenticationError) return errorResponse(401);

    console.error("Report export preview could not authorize the request.", error);

    return errorResponse(503);
  }

  const searchParams = new URL(request.url).searchParams;
  const locale = parseReportExportLocale(searchParams.get("locale"));
  const mode = parseReportMode(searchParams.get("mode"));
  const filters = parseReportSearchParams(
    Object.fromEntries(searchParams.entries()),
    admin.timezone,
  );
  const snapshot = await getTimeEntryReportSnapshot({
    periodStart: filters.periodStart,
    periodEnd: filters.periodEnd,
    view: filters.view,
    mode,
    projectId: filters.projectId,
    projectGroupId: filters.projectGroupId,
    memberId: filters.memberId,
  });

  if (snapshot.lines.length === 0) {
    return NextResponse.json({ status: "empty" }, { headers: PREVIEW_HEADERS });
  }

  try {
    // The export locale is chosen in the dialog, not taken from the request cookie, so it is passed
    // explicitly and a preview always speaks the language the download will.
    const t = await getTranslations({ locale, namespace: "AdminReports" });
    const payload = buildReportPdfPayload({
      title: resolveReportExportTitle(searchParams.get("title"), snapshot.period),
      snapshot,
      locale,
      generatedAt: new Date(),
      t,
    });
    const pages = await renderTypstDocumentPages(
      { template: "report", data: payload, filename: "report-preview", format: "svg" },
      { timeoutMs: RENDER_TIMEOUT_MS },
    );

    return NextResponse.json(
      {
        status: "ready",
        pageCount: pages.length,
        truncated: pages.length > PREVIEW_PAGE_LIMIT,
        // Raw SVG rather than data URIs: the markup gzips far better than base64 on the way out.
        pages: pages.slice(0, PREVIEW_PAGE_LIMIT).map((page) => page.toString("utf8")),
      },
      { headers: PREVIEW_HEADERS },
    );
  } catch (error) {
    // The detail names the Typst binary and its stderr, which stays server-side; the dialog shows a
    // localized message instead.
    console.error("Report export preview failed to render.", error);

    return errorResponse(503);
  }
}

function errorResponse(status: number) {
  return NextResponse.json({ status: "error" }, { status, headers: PREVIEW_HEADERS });
}
