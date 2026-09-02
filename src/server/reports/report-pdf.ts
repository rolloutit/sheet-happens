import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/src/server/db/client";
import type { Prisma } from "@/src/server/db/generated/client";
import { renderTypstDocument, type RenderTypstDocumentInput } from "@/src/server/pdf";
import { getObjectStorage, type ObjectStorage } from "@/src/server/storage";

import {
  buildReportPdfPayload,
  normalizeReportPdfTitle,
  type ReportPdfTranslator,
} from "./report-pdf-payload";
import type { ReportSnapshot } from "./reports";
import type { DurationDisplayFormat } from "@/src/lib/formatting";

export type ReportPdfExportFilters = {
  period: string;
  anchor: string;
  periodStart: string;
  periodEnd: string;
  projectId: string | null;
  projectGroupId: string | null;
  memberId: string | null;
  durationDisplayFormat: DurationDisplayFormat;
};

export type GenerateReportPdfExportInput = {
  title: string;
  snapshot: ReportSnapshot;
  locale: string;
  timezone: string;
  generatedByMemberId: string;
  durationDisplayFormat: DurationDisplayFormat;
  filters: ReportPdfExportFilters;
  /** Translator scoped to the `AdminReports` namespace. */
  t: ReportPdfTranslator;
  requestMetadata?: {
    ipAddress?: string | null;
    userAgent?: string | null;
  };
};

export type GenerateReportPdfExportResult = {
  reportExportId: string;
  documentId: string;
  filename: string;
  pdfBytes: Buffer;
};

export type GenerateReportPdfExportDeps = {
  storage?: ObjectStorage;
  renderer?: (input: RenderTypstDocumentInput) => Promise<Buffer>;
  now?: Date;
};

export class ReportPdfExportError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ReportPdfExportError";
  }
}

export async function generateReportPdfExport(
  input: GenerateReportPdfExportInput,
  deps: GenerateReportPdfExportDeps = {},
): Promise<GenerateReportPdfExportResult> {
  const title = normalizeReportPdfTitle(input.title);
  const now = deps.now ?? new Date();
  const filename = `${sanitizeFilename(title)}.pdf`;
  const payload = buildReportPdfPayload({
    title,
    snapshot: input.snapshot,
    locale: input.locale,
    generatedAt: now,
    durationDisplayFormat: input.durationDisplayFormat,
    t: input.t,
  });
  const renderer = deps.renderer ?? ((renderInput) => renderTypstDocument(renderInput));
  const storage = deps.storage ?? getObjectStorage();
  const pdfBytes = await renderer({ template: "report", data: payload, filename });
  const checksumSha256 = createHash("sha256").update(pdfBytes).digest("hex");
  const objectKey = buildReportExportObjectKey({
    generatedByMemberId: input.generatedByMemberId,
    periodStart: input.snapshot.period.start,
    filename,
  });
  const objectRef = await storage.putObject({
    key: objectKey,
    body: pdfBytes,
    contentType: "application/pdf",
    byteSize: pdfBytes.byteLength,
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          type: "REPORT_EXPORT",
          status: "AVAILABLE",
          ownerMemberId: null,
          storageBucket: objectRef.bucket,
          storageKey: objectRef.key,
          originalFilename: filename,
          contentType: "application/pdf",
          byteSize: BigInt(pdfBytes.byteLength),
          checksumSha256,
          uploadedByMemberId: input.generatedByMemberId,
          createdAt: now,
        },
        select: {
          id: true,
        },
      });

      const reportExport = await tx.reportExport.create({
        data: {
          title,
          mode: input.snapshot.mode,
          view: input.snapshot.view,
          filters: input.filters as unknown as Prisma.InputJsonObject,
          timezone: input.timezone,
          renderSnapshot: input.snapshot as unknown as Prisma.InputJsonObject,
          documentId: document.id,
          generatedByMemberId: input.generatedByMemberId,
          createdAt: now,
        },
        select: {
          id: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorMemberId: input.generatedByMemberId,
          action: "report.exported",
          targetType: "report_export",
          targetId: reportExport.id,
          after: {
            reportExportId: reportExport.id,
            documentId: document.id,
            documentStorageKey: objectRef.key,
            title,
            mode: input.snapshot.mode,
            view: input.snapshot.view,
            periodStart: input.snapshot.period.start,
            periodEnd: input.snapshot.period.end,
            byteSize: pdfBytes.byteLength,
            checksumSha256,
          },
          ...input.requestMetadata,
          createdAt: now,
        },
      });

      return {
        reportExportId: reportExport.id,
        documentId: document.id,
      };
    });

    return {
      ...result,
      filename,
      pdfBytes,
    };
  } catch (error) {
    await storage.deleteObject(objectRef).catch(() => undefined);
    throw error;
  }
}

function buildReportExportObjectKey(input: {
  generatedByMemberId: string;
  periodStart: string;
  filename: string;
}) {
  return [
    "report-exports",
    input.generatedByMemberId,
    input.periodStart,
    `${randomUUID()}-${sanitizeFilename(input.filename)}.pdf`,
  ].join("/");
}

function sanitizeFilename(filename: string) {
  const normalized = filename
    .trim()
    .replaceAll(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/\.pdf$/i, "");

  return normalized || "time-report";
}
