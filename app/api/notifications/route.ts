import { NextResponse } from "next/server";

import { resolveLocale } from "@/src/i18n/locales";
import { requireActiveAppMemberForAction } from "@/src/server/auth/app-access";
import { authErrorStatus } from "@/src/server/auth/route-errors";
import {
  getMemberNotificationSummary,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/src/server/notifications";

export async function GET(request: Request) {
  try {
    const { member } = await requireActiveAppMemberForAction();
    const url = new URL(request.url);
    const locale = resolveLocale(url.searchParams.get("locale")) ?? "hu";
    const summary = await getMemberNotificationSummary({ memberId: member.id, locale, limit: 5 });
    return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error, "[notifications] summary read failed");
  }
}

export async function PATCH(request: Request) {
  try {
    const { member } = await requireActiveAppMemberForAction();

    let body: { notificationId?: unknown; all?: unknown };
    try {
      const parsed: unknown = await request.json();
      if (typeof parsed !== "object" || parsed === null) throw new Error("Body must be an object.");
      body = parsed as { notificationId?: unknown; all?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (body.all === true) {
      await markAllNotificationsRead(member.id);
    } else if (typeof body.notificationId === "string") {
      await markNotificationRead(member.id, body.notificationId);
    } else {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "[notifications] read-state update failed");
  }
}

function errorResponse(error: unknown, logMessage: string) {
  const authStatus = authErrorStatus(error);

  if (authStatus === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (authStatus === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  console.error(logMessage, error);
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
