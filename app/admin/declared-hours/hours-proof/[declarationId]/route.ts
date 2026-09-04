import { NextResponse } from "next/server";

import { requireAdminAppMember } from "@/src/server/auth/app-access";
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
 * A declared month's proof, for the admin correcting it.
 *
 * The same shape as the two routes it joins — the member's own under `/time` and the reviewer's
 * under `/admin/timesheets/[timesheetId]` — and the reason it is a third rather than a reuse is the
 * scope each one expresses in its `where`. The member's is scoped by `memberId`; the reviewer's by
 * the timesheet's contractor and period, so an id from another month is a 404. Neither scope exists
 * here: the correction surface is company-wide and month-scoped, and there is no timesheet in play
 * at all — a declaration is correctable precisely when *no* submitted timesheet holds it.
 *
 * So the scope is admin access itself, which `requireAdminAppMember` establishes (and which also
 * demands the authenticator app). That is a real widening over the review route, and it is the
 * point: an admin who may rewrite the figure must be able to read the document it is checked
 * against, or they are correcting it blind.
 *
 * **Read only.** Uploading and replacing a proof stay with the member — see the page's own note.
 */
export async function GET(_request: Request, { params }: HoursProofRouteContext) {
  const { declarationId } = await params;

  await requireAdminAppMember("/admin/declared-hours");

  const declaration = await prisma.monthlyHourDeclaration.findFirst({
    where: {
      id: declarationId,
      member: {
        deletedAt: null,
      },
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
      /* Pinned, not echoed — the same invariant the two sibling routes state: a document served
         `inline` on this origin must never take its content type from a value that travelled
         through object storage. An hours proof is a PDF by construction. */
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function sanitizeHeaderFilename(filename: string) {
  return filename.replaceAll(/[\r\n"]/g, "_") || "hours-proof.pdf";
}
