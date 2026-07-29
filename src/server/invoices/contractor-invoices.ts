import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/src/server/db/client";
import type { Prisma } from "@/src/server/db/generated/client";
import { getObjectStorage, type ObjectStorage } from "@/src/server/storage";
import { formatDateOnly, getMonthStart, normalizeDateOnly } from "@/src/server/time-tracking";

export const CONTRACTOR_INVOICE_MAX_BYTES = 10 * 1024 * 1024;

export type ContractorInvoiceUploadRequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type UploadContractorInvoiceInput = {
  memberId: string;
  actorMemberId: string;
  periodStart: Date;
  invoiceNumber: string;
  declaredAmount: string;
  currencyCode: string;
  file: {
    bytes: Buffer;
    originalFilename: string;
    contentType: string;
    byteSize: number;
  };
  requestMetadata?: ContractorInvoiceUploadRequestMetadata;
};

export type UploadContractorInvoiceResult = {
  invoiceId: string;
  documentId: string;
  timesheetId: string;
  timesheetRevisionId: string;
  invoiceNumber: string;
  status: "UPLOADED";
};

export class ContractorInvoiceUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractorInvoiceUploadError";
  }
}

export async function uploadContractorInvoice(
  input: UploadContractorInvoiceInput,
  deps: { storage?: ObjectStorage; now?: Date } = {},
): Promise<UploadContractorInvoiceResult> {
  const now = deps.now ?? new Date();
  const storage = deps.storage ?? getObjectStorage();
  const periodStart = getMonthStart(normalizeDateOnly(input.periodStart));
  const invoiceNumber = input.invoiceNumber.trim();
  const currencyCode = input.currencyCode.trim().toUpperCase();
  const checksumSha256 = createHash("sha256").update(input.file.bytes).digest("hex");

  validateInvoiceUploadInput({
    invoiceNumber,
    declaredAmount: input.declaredAmount,
    currencyCode,
    file: input.file,
  });

  const uploadContext = await getApprovedTimesheetForInvoiceUpload({
    memberId: input.memberId,
    periodStart,
  });

  const objectKey = buildContractorInvoiceObjectKey({
    memberId: input.memberId,
    periodStart,
    revisionNumber: uploadContext.revisionNumber,
    originalFilename: input.file.originalFilename,
  });

  const objectRef = await storage.putObject({
    key: objectKey,
    body: input.file.bytes,
    contentType: input.file.contentType,
    byteSize: input.file.byteSize,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const timesheet = await tx.timesheet.findUnique({
        where: {
          id: uploadContext.timesheetId,
        },
        select: {
          id: true,
          status: true,
          currentRevisionId: true,
          currentRevision: {
            select: {
              id: true,
              revisionNumber: true,
              totalMinutes: true,
              totalAmount: true,
              currencyCode: true,
            },
          },
          invoices: {
            where: {
              timesheetRevisionId: uploadContext.timesheetRevisionId,
              status: {
                in: ["UPLOADED", "ACCEPTED"],
              },
            },
            select: {
              id: true,
            },
            take: 1,
          },
        },
      });

      if (!timesheet || !timesheet.currentRevision) {
        throw new ContractorInvoiceUploadError("Approved timesheet not found.");
      }

      if (timesheet.status !== "APPROVED") {
        throw new ContractorInvoiceUploadError("Timesheet must be approved before invoice upload.");
      }

      if (timesheet.currentRevisionId !== uploadContext.timesheetRevisionId) {
        throw new ContractorInvoiceUploadError("Timesheet revision changed during upload.");
      }

      if (timesheet.invoices.length > 0) {
        throw new ContractorInvoiceUploadError("Invoice already uploaded for this timesheet.");
      }

      const document = await tx.document.create({
        data: {
          type: "CONTRACTOR_INVOICE",
          status: "AVAILABLE",
          ownerMemberId: input.memberId,
          storageBucket: objectRef.bucket,
          storageKey: objectRef.key,
          originalFilename: input.file.originalFilename,
          contentType: input.file.contentType,
          byteSize: BigInt(input.file.byteSize),
          checksumSha256,
          uploadedByMemberId: input.actorMemberId,
        },
        select: {
          id: true,
        },
      });

      const invoice = await tx.contractorInvoice.create({
        data: {
          timesheetId: timesheet.id,
          timesheetRevisionId: timesheet.currentRevision.id,
          documentId: document.id,
          role: "ORIGINAL",
          status: "UPLOADED",
          invoiceNumber,
          declaredAmount: input.declaredAmount,
          currencyCode,
          uploadedByMemberId: input.actorMemberId,
        },
        select: {
          id: true,
          invoiceNumber: true,
        },
      });

      await tx.timesheet.update({
        where: {
          id: timesheet.id,
        },
        data: {
          status: "INVOICED",
          updatedByMemberId: input.actorMemberId,
        },
        select: {
          id: true,
        },
      });

      await tx.timesheetRevision.update({
        where: {
          id: timesheet.currentRevision.id,
        },
        data: {
          status: "INVOICED",
        },
        select: {
          id: true,
        },
      });

      const eventMetadata = buildInvoiceUploadMetadata({
        invoiceId: invoice.id,
        documentId: document.id,
        documentStorageKey: objectRef.key,
        invoiceNumber: invoice.invoiceNumber,
        declaredAmount: input.declaredAmount,
        currencyCode,
        byteSize: input.file.byteSize,
        checksumSha256,
        revision: timesheet.currentRevision,
      });

      await tx.timesheetEvent.create({
        data: {
          timesheetId: timesheet.id,
          timesheetRevisionId: timesheet.currentRevision.id,
          eventType: "INVOICE_UPLOADED",
          actorMemberId: input.actorMemberId,
          reason: null,
          metadata: eventMetadata,
          createdAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorMemberId: input.actorMemberId,
          action: "invoice.uploaded",
          targetType: "contractor_invoice",
          targetId: invoice.id,
          after: {
            ...eventMetadata,
            timesheetId: timesheet.id,
            timesheetRevisionId: timesheet.currentRevision.id,
            status: "UPLOADED",
          },
          ...input.requestMetadata,
        },
      });

      return {
        invoiceId: invoice.id,
        documentId: document.id,
        timesheetId: timesheet.id,
        timesheetRevisionId: timesheet.currentRevision.id,
        invoiceNumber: invoice.invoiceNumber,
        status: "UPLOADED" as const,
      };
    });
  } catch (error) {
    await storage.deleteObject(objectRef).catch(() => undefined);
    throw error;
  }
}

async function getApprovedTimesheetForInvoiceUpload(input: {
  memberId: string;
  periodStart: Date;
}) {
  const [member, timesheet] = await Promise.all([
    prisma.member.findUnique({
      where: {
        id: input.memberId,
      },
      select: {
        id: true,
        currentProfile: true,
        deletedAt: true,
      },
    }),
    prisma.timesheet.findUnique({
      where: {
        contractorMemberId_periodStart: {
          contractorMemberId: input.memberId,
          periodStart: input.periodStart,
        },
      },
      select: {
        id: true,
        status: true,
        currentRevisionId: true,
        currentRevision: {
          select: {
            id: true,
            revisionNumber: true,
          },
        },
        invoices: {
          where: {
            status: {
              in: ["UPLOADED", "ACCEPTED"],
            },
          },
          select: {
            id: true,
          },
          take: 1,
        },
      },
    }),
  ]);

  if (!member || member.deletedAt) {
    throw new ContractorInvoiceUploadError("Member not found.");
  }

  if (member.currentProfile !== "CONTRACTOR") {
    throw new ContractorInvoiceUploadError("Contractor profile required.");
  }

  if (!timesheet || !timesheet.currentRevisionId || !timesheet.currentRevision) {
    throw new ContractorInvoiceUploadError("Approved timesheet not found.");
  }

  if (timesheet.status !== "APPROVED") {
    throw new ContractorInvoiceUploadError("Timesheet must be approved before invoice upload.");
  }

  if (timesheet.invoices.length > 0) {
    throw new ContractorInvoiceUploadError("Invoice already uploaded for this timesheet.");
  }

  return {
    timesheetId: timesheet.id,
    timesheetRevisionId: timesheet.currentRevision.id,
    revisionNumber: timesheet.currentRevision.revisionNumber,
  };
}

function validateInvoiceUploadInput(input: {
  invoiceNumber: string;
  declaredAmount: string;
  currencyCode: string;
  file: UploadContractorInvoiceInput["file"];
}) {
  if (!input.invoiceNumber) {
    throw new ContractorInvoiceUploadError("Invoice number is required.");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(input.declaredAmount) || Number(input.declaredAmount) <= 0) {
    throw new ContractorInvoiceUploadError("Invoice amount must be positive.");
  }

  if (!/^[A-Z]{3}$/.test(input.currencyCode)) {
    throw new ContractorInvoiceUploadError("Invoice currency is invalid.");
  }

  if (input.file.byteSize <= 0) {
    throw new ContractorInvoiceUploadError("Invoice PDF is required.");
  }

  if (input.file.byteSize > CONTRACTOR_INVOICE_MAX_BYTES) {
    throw new ContractorInvoiceUploadError("Invoice PDF is too large.");
  }

  if (input.file.contentType !== "application/pdf") {
    throw new ContractorInvoiceUploadError("Invoice must be a PDF.");
  }

  if (!input.file.originalFilename.toLowerCase().endsWith(".pdf")) {
    throw new ContractorInvoiceUploadError("Invoice must be a PDF.");
  }

  if (!input.file.bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new ContractorInvoiceUploadError("Invoice must be a PDF.");
  }
}

function buildContractorInvoiceObjectKey(input: {
  memberId: string;
  periodStart: Date;
  revisionNumber: number;
  originalFilename: string;
}) {
  const safeFilename = sanitizeFilename(input.originalFilename);

  return [
    "contractor-invoices",
    input.memberId,
    formatDateOnly(input.periodStart),
    `revision-${input.revisionNumber}`,
    `${randomUUID()}-${safeFilename}`,
  ].join("/");
}

function sanitizeFilename(filename: string) {
  const normalized = filename.trim().replaceAll(/[^a-zA-Z0-9._-]/g, "-");
  return normalized || "invoice.pdf";
}

function buildInvoiceUploadMetadata(input: {
  invoiceId: string;
  documentId: string;
  documentStorageKey: string;
  invoiceNumber: string;
  declaredAmount: string;
  currencyCode: string;
  byteSize: number;
  checksumSha256: string;
  revision: {
    id: string;
    revisionNumber: number;
    totalMinutes: number;
    totalAmount: Prisma.Decimal;
    currencyCode: string;
  };
}): Prisma.InputJsonObject {
  return {
    invoiceId: input.invoiceId,
    documentId: input.documentId,
    documentStorageKey: input.documentStorageKey,
    invoiceNumber: input.invoiceNumber,
    declaredAmount: input.declaredAmount,
    invoiceCurrencyCode: input.currencyCode,
    byteSize: input.byteSize,
    checksumSha256: input.checksumSha256,
    revisionId: input.revision.id,
    revisionNumber: input.revision.revisionNumber,
    timesheetTotalMinutes: input.revision.totalMinutes,
    timesheetTotalAmount: input.revision.totalAmount.toString(),
    timesheetCurrencyCode: input.revision.currencyCode,
  };
}
