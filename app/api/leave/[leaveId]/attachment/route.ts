import { NextResponse } from "next/server";

import {
  requireActiveAppMember,
  requireActiveAppMemberForAction,
  type ActiveAppAccess,
} from "@/src/server/auth/app-access";
import { authErrorStatus } from "@/src/server/auth/route-errors";
import { createLeaveAttachmentReadUrl, LeaveError } from "@/src/server/leave";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LeaveAttachmentRouteContext = {
  params: Promise<{
    leaveId: string;
  }>;
};

/**
 * The sick note behind a leave, for its owner or an admin. Same shape as the payslip document
 * route: a short-lived signed URL, an audit row, and a 404 for anyone else so the endpoint does not
 * reveal which leaves carry a note.
 */
export async function GET(request: Request, { params }: LeaveAttachmentRouteContext) {
  const { leaveId } = await params;
  const disposition =
    new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";

  let access: ActiveAppAccess;

  try {
    // A link click should land on the login page when the session is stale; anything else gets a
    // status code. See the payslip route for the full reasoning.
    access =
      request.headers.get("Sec-Fetch-Dest") === "document"
        ? await requireActiveAppMember("/leave")
        : await requireActiveAppMemberForAction();
  } catch (error) {
    const authStatus = authErrorStatus(error);
    if (authStatus) return new Response(null, { status: authStatus });
    throw error;
  }

  try {
    const signedUrl = await createLeaveAttachmentReadUrl({
      leaveId,
      viewer: { memberId: access.member.id, isAdmin: access.member.role === "ADMIN" },
      disposition,
      requestMetadata: {
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      },
    });

    return NextResponse.redirect(signedUrl, {
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    if (error instanceof LeaveError) {
      return new Response(null, { status: 404 });
    }

    console.error("[leave] attachment access failed", error);
    return new Response(null, { status: 500 });
  }
}
