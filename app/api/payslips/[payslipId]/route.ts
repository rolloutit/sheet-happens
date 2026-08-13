import { NextResponse } from "next/server";

import { requireActiveAppMember } from "@/src/server/auth/app-access";
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
  const access = await requireActiveAppMember(`/payslips`);
  const disposition =
    new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";

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
