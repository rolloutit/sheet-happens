import { NextResponse } from "next/server";

import { resolveLocale } from "@/src/i18n/locales";
import { requireActiveAppMemberForAction } from "@/src/server/auth/app-access";
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
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { member } = await requireActiveAppMemberForAction();
    const body = (await request.json()) as { notificationId?: unknown; all?: unknown };
    if (body.all === true) {
      await markAllNotificationsRead(member.id);
    } else if (typeof body.notificationId === "string") {
      await markNotificationRead(member.id, body.notificationId);
    } else {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
