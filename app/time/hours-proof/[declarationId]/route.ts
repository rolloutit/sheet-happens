import { NextResponse } from "next/server";

import { requireActiveAppMember } from "@/src/server/auth/app-access";
import { prisma } from "@/src/server/db/client";
import { getObjectStorage } from "@/src/server/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HoursProofRouteContext = {
  params: Promise<{
    declarationId: string;
  }>;
};

/**
 * The member's own hours proof, streamed the way the invoice viewer streams an invoice.
 *
 * Scoped by `memberId` in the `where` rather than checked afterwards, so an id belonging to someone
 * else is a 404 and not a decision anyone has to remember to make. The admin side has its own route
 * under the timesheet review, where the scope is the timesheet rather than the signed-in member.
 */
export async function GET(_request: Request, { params }: HoursProofRouteContext) {
  const { declarationId } = await params;
  const { member } = await requireActiveAppMember("/time");

  const declaration = await prisma.monthlyHourDeclaration.findFirst({
    where: {
      id: declarationId,
      memberId: member.id,
      proofDocument: {
        deletedAt: null,
        status: "AVAILABLE",
      },
    },
    select: {
      proofDocument: {
        select: {
          storageBucket: true,
          storageKey: true,
          originalFilename: true,
          contentType: true,
        },
      },
    },
  });

  if (!declaration?.proofDocument) {
    return new Response(null, {
      status: 404,
    });
  }

  const object = await getObjectStorage().getObject({
    bucket: declaration.proofDocument.storageBucket,
    key: declaration.proofDocument.storageKey,
  });
  const filename = sanitizeHeaderFilename(declaration.proofDocument.originalFilename);
  const body = new Uint8Array(object.body);

  return new NextResponse(body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(object.body.byteLength),
      "Content-Type": object.contentType ?? declaration.proofDocument.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function sanitizeHeaderFilename(filename: string) {
  return filename.replaceAll(/[\r\n"]/g, "_") || "hours-proof.pdf";
}
