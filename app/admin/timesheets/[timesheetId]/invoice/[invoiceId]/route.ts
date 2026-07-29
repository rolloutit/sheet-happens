import { NextResponse } from "next/server";

import { requireAdminAppMember } from "@/src/server/auth/app-access";
import { prisma } from "@/src/server/db/client";
import { getObjectStorage } from "@/src/server/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InvoicePdfRouteContext = {
  params: Promise<{
    timesheetId: string;
    invoiceId: string;
  }>;
};

export async function GET(_request: Request, { params }: InvoicePdfRouteContext) {
  const { timesheetId, invoiceId } = await params;

  await requireAdminAppMember(`/admin/timesheets/${timesheetId}`);

  const invoice = await prisma.contractorInvoice.findFirst({
    where: {
      id: invoiceId,
      timesheetId,
      document: {
        deletedAt: null,
      },
    },
    select: {
      document: {
        select: {
          storageBucket: true,
          storageKey: true,
          originalFilename: true,
          contentType: true,
        },
      },
    },
  });

  if (!invoice) {
    return new Response(null, {
      status: 404,
    });
  }

  const object = await getObjectStorage().getObject({
    bucket: invoice.document.storageBucket,
    key: invoice.document.storageKey,
  });
  const filename = sanitizeHeaderFilename(invoice.document.originalFilename);
  const body = new Uint8Array(object.body);

  return new NextResponse(body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(object.body.byteLength),
      "Content-Type": object.contentType ?? invoice.document.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function sanitizeHeaderFilename(filename: string) {
  return filename.replaceAll(/[\r\n"]/g, "_") || "invoice.pdf";
}
