import { NextResponse } from "next/server";

import { requireAdminAppMember } from "@/src/server/auth/app-access";
import { prisma } from "@/src/server/db/client";
import { getObjectStorage } from "@/src/server/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HoursProofRouteContext = {
  params: Promise<{
    timesheetId: string;
    declarationId: string;
  }>;
};

/**
 * A declared month's proof, for the admin reviewing the timesheet it belongs to.
 *
 * The same shape as the invoice route beside it, and scoped the same way: the declaration has to
 * belong to *this* timesheet's contractor and period, expressed in the `where` so an id from
 * another month or another person is a 404 rather than a check someone has to remember.
 */
export async function GET(_request: Request, { params }: HoursProofRouteContext) {
  const { timesheetId, declarationId } = await params;

  await requireAdminAppMember(`/admin/timesheets/${timesheetId}`);

  const declaration = await prisma.monthlyHourDeclaration.findFirst({
    where: {
      id: declarationId,
      member: {
        timesheets: {
          some: {
            id: timesheetId,
          },
        },
      },
      proofDocument: {
        deletedAt: null,
        status: "AVAILABLE",
      },
    },
    select: {
      periodStart: true,
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

  const timesheet = declaration
    ? await prisma.timesheet.findFirst({
        where: {
          id: timesheetId,
          periodStart: declaration.periodStart,
        },
        select: { id: true },
      })
    : null;

  if (!declaration?.proofDocument || !timesheet) {
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
