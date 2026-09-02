import { NextResponse } from "next/server";

import { requireActiveAppMemberForAction } from "@/src/server/auth/app-access";
import { authErrorStatus } from "@/src/server/auth/route-errors";
import { createMemberAvatarReadUrl, MemberPreferenceError } from "@/src/server/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { member } = await requireActiveAppMemberForAction();
    const signedUrl = await createMemberAvatarReadUrl(member.id);
    const response = NextResponse.redirect(signedUrl);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    if (error instanceof MemberPreferenceError) {
      return new NextResponse(null, { status: 404 });
    }

    const authStatus = authErrorStatus(error);
    if (authStatus) return new NextResponse(null, { status: authStatus });

    console.error("[profile] avatar access failed", error);
    return new NextResponse(null, { status: 500 });
  }
}
