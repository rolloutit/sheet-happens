import { NextResponse } from "next/server";

import { requireActiveAppMemberForAction } from "@/src/server/auth/app-access";
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
    return new NextResponse(null, { status: 401 });
  }
}
