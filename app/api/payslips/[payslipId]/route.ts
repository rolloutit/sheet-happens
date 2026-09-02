import { NextResponse } from "next/server";

import {
  requireActiveAppMember,
  requireActiveAppMemberForAction,
  type ActiveAppAccess,
} from "@/src/server/auth/app-access";
import { authErrorStatus } from "@/src/server/auth/route-errors";
import { createPayslipReadUrl, PayslipError } from "@/src/server/payslips";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PayslipDocumentRouteContext = {
  params: Promise<{
    payslipId: string;
  }>;
};

export async function GET(request: Request, { params }: PayslipDocumentRouteContext) {
  const { payslipId } = await params;
  const disposition =
    new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";

  let access: ActiveAppAccess;

  try {
    access = await requireAccessFor(request);
  } catch (error) {
    const authStatus = authErrorStatus(error);
    if (authStatus) return new Response(null, { status: authStatus });

    // `redirect()` reports itself by throwing, so the navigation path's NEXT_REDIRECT — and any
    // unexpected guard failure — has to keep bubbling. This is also why the guard runs in its own
    // try: the document-serving catch below would otherwise log a redirect as a 500.
    throw error;
  }

  try {
    const signedUrl = await createPayslipReadUrl({
      payslipId,
      actorMemberId: access.member.id,
      isAdmin: access.member.role === "ADMIN",
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
    if (error instanceof PayslipError) {
      return new Response(null, { status: 404 });
    }

    console.error("[payslips] document access failed", error);
    return new Response(null, { status: 500 });
  }
}

/**
 * This endpoint has two kinds of caller and they need opposite failure handling.
 *
 * The download button is a plain `<a>`, so a stale session there should land on the login page —
 * and on the two-factor, security-setup or account-status page for the other inactive states,
 * which only the redirecting guard knows how to target.
 *
 * The preview `<iframe>` is a subresource. Redirecting it renders the entire login form inside the
 * preview dialog, where signing in would nest the app in the frame; nothing sets
 * `X-Frame-Options` or a `frame-ancestors` policy that would stop it. Those callers get a status
 * code instead.
 *
 * `Sec-Fetch-Dest` is `document` only for a top-level navigation (an iframe reports `iframe`), so
 * it answers exactly that question. A caller that sends no such header — curl, a script — is not a
 * browser navigation either, and 401 is the right answer for it.
 */
function requireAccessFor(request: Request): Promise<ActiveAppAccess> {
  return request.headers.get("Sec-Fetch-Dest") === "document"
    ? requireActiveAppMember(`/payslips`)
    : requireActiveAppMemberForAction();
}
