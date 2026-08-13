import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/src/server/db/client";
import { getObjectStorage, type ObjectStorage } from "@/src/server/storage";
import { formatDateOnly, getMonthStart, normalizeDateOnly } from "@/src/server/time-tracking";

export const PAYSLIP_MAX_BYTES = 10 * 1024 * 1024;
const PAYSLIP_SIGNED_URL_TTL_SECONDS = 5 * 60;

export type PayslipRequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type PayslipFileInput = {
  bytes: Buffer;
  originalFilename: string;
  contentType: string;
  byteSize: number;
};

export type UploadPayslipInput = {
  employeeMemberId: string;
  actorMemberId: string;
  periodStart: Date;
  file: PayslipFileInput;
  requestMetadata?: PayslipRequestMetadata;
};

export type PayslipReadAccessInput = {
  payslipId: string;
  actorMemberId: string;
  isAdmin: boolean;
  disposition: "inline" | "attachment";
  requestMetadata?: PayslipRequestMetadata;
};

export type PayslipListFilters = {
  employeeMemberId?: string | null;
  month?: string | null;
  query?: string | null;
  page?: string | number | null;
  pageSize?: string | number | null;
};

export type PayslipListRow = {
  id: string;
  employeeMemberId: string;
  employeeName: string;
  employeeEmail: string;
  employeeStatus: "ACTIVE" | "INACTIVE" | "INVITED" | "DELETED";
  periodStart: Date;
  periodEnd: Date;
  originalFilename: string;
  byteSize: bigint;
  publishedAt: Date | null;
  publishedByName: string | null;
};

export type PayslipListResult = {
  rows: PayslipListRow[];
  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
  employeeOptions: Array<{ id: string; name: string; email: string; status: string }>;
  filters: {
    employeeMemberId: string | null;
    month: string | null;
    query: string;
  };
};

export type EmployeePayslipListResult = {
  latest: PayslipListRow | null;
  history: PayslipListRow[];
  totalHistoryItems: number;
  totalHistoryPages: number;
  historyPage: number;
  historyPageSize: number;
};

export type PayslipMonthOverview = {
  month: Date;
  expectedCount: number;
  postedCount: number;
  missingEmployees: Array<{ id: string; name: string; email: string }>;
};

export class PayslipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayslipError";
  }
}

export async function uploadPayslip(
  input: UploadPayslipInput,
  deps: { storage?: ObjectStorage; now?: Date } = {},
) {
  const now = deps.now ?? new Date();
  const storage = deps.storage ?? getObjectStorage();
  const periodStart = getMonthStart(normalizeDateOnly(input.periodStart));

  validatePayslipFile(input.file);

  const employee = await prisma.member.findFirst({
    where: {
      id: input.employeeMemberId,
      currentProfile: "EMPLOYEE",
      deletedAt: null,
      status: {
        not: "DELETED",
      },
    },
    select: {
      id: true,
    },
  });

  if (!employee) {
    throw new PayslipError("Employee profile required.");
  }

  const checksumSha256 = createHash("sha256").update(input.file.bytes).digest("hex");
  const objectRef = await storage.putObject({
    key: buildPayslipObjectKey({
      employeeMemberId: input.employeeMemberId,
      periodStart,
      originalFilename: input.file.originalFilename,
    }),
    body: input.file.bytes,
    contentType: "application/pdf",
    byteSize: input.file.byteSize,
    checksumSha256,
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.payslip.findUnique({
        where: {
          employeeMemberId_periodStart: {
            employeeMemberId: input.employeeMemberId,
            periodStart,
          },
        },
        select: {
          id: true,
          documentId: true,
          document: {
            select: {
              storageBucket: true,
              storageKey: true,
              originalFilename: true,
              checksumSha256: true,
            },
          },
        },
      });

      const document = await tx.document.create({
        data: {
          type: "PAYSLIP",
          status: "AVAILABLE",
          ownerMemberId: input.employeeMemberId,
          storageBucket: objectRef.bucket,
          storageKey: objectRef.key,
          originalFilename: input.file.originalFilename,
          contentType: "application/pdf",
          byteSize: BigInt(input.file.byteSize),
          checksumSha256,
          uploadedByMemberId: input.actorMemberId,
          createdAt: now,
        },
        select: {
          id: true,
        },
      });

      const periodEnd = getMonthEnd(periodStart);
      const payslip = existing
        ? await tx.payslip.update({
            where: { id: existing.id },
            data: {
              documentId: document.id,
              periodEnd,
              status: "AVAILABLE",
              publishedAt: now,
              publishedByMemberId: input.actorMemberId,
            },
            select: { id: true },
          })
        : await tx.payslip.create({
            data: {
              employeeMemberId: input.employeeMemberId,
              periodStart,
              periodEnd,
              status: "AVAILABLE",
              documentId: document.id,
              publishedAt: now,
              publishedByMemberId: input.actorMemberId,
            },
            select: { id: true },
          });

      if (existing) {
        await tx.document.update({
          where: { id: existing.documentId },
          data: {
            status: "DELETED",
            deletedAt: now,
            deletedByMemberId: input.actorMemberId,
          },
          select: { id: true },
        });
      }

      await tx.auditLog.create({
        data: {
          actorMemberId: input.actorMemberId,
          action: existing ? "payslip.replaced" : "payslip.uploaded",
          targetType: "payslip",
          targetId: payslip.id,
          after: {
            employeeMemberId: input.employeeMemberId,
            periodStart: formatDateOnly(periodStart),
            documentId: document.id,
            storageKey: objectRef.key,
            originalFilename: input.file.originalFilename,
            byteSize: input.file.byteSize,
            checksumSha256,
            replacesDocumentId: existing?.documentId ?? null,
            replacesFilename: existing?.document.originalFilename ?? null,
          },
          ...input.requestMetadata,
          createdAt: now,
        },
      });

      return {
        payslipId: payslip.id,
        documentId: document.id,
        previousObject: existing?.document ?? null,
        replaced: Boolean(existing),
      };
    });

    if (result.previousObject) {
      await storage
        .deleteObject({
          bucket: result.previousObject.storageBucket,
          key: result.previousObject.storageKey,
        })
        .catch(() => undefined);
    }

    return result;
  } catch (error) {
    await storage.deleteObject(objectRef).catch(() => undefined);
    throw error;
  }
}

export async function deletePayslip(
  input: Omit<PayslipReadAccessInput, "disposition">,
  deps: { storage?: ObjectStorage; now?: Date } = {},
) {
  if (!input.isAdmin) {
    throw new PayslipError("Admin access required.");
  }

  const now = deps.now ?? new Date();
  const storage = deps.storage ?? getObjectStorage();
  const deleted = await prisma.$transaction(async (tx) => {
    const payslip = await tx.payslip.findUnique({
      where: { id: input.payslipId },
      select: {
        id: true,
        employeeMemberId: true,
        periodStart: true,
        documentId: true,
        document: {
          select: {
            storageBucket: true,
            storageKey: true,
            originalFilename: true,
            checksumSha256: true,
          },
        },
      },
    });

    if (!payslip) {
      throw new PayslipError("Payslip not found.");
    }

    await tx.payslip.delete({
      where: { id: payslip.id },
      select: { id: true },
    });
    await tx.document.update({
      where: { id: payslip.documentId },
      data: {
        status: "DELETED",
        deletedAt: now,
        deletedByMemberId: input.actorMemberId,
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "payslip.deleted",
        targetType: "payslip",
        targetId: payslip.id,
        before: {
          employeeMemberId: payslip.employeeMemberId,
          periodStart: formatDateOnly(payslip.periodStart),
          documentId: payslip.documentId,
          storageKey: payslip.document.storageKey,
          originalFilename: payslip.document.originalFilename,
          checksumSha256: payslip.document.checksumSha256,
        },
        ...input.requestMetadata,
        createdAt: now,
      },
    });

    return payslip.document;
  });

  await storage
    .deleteObject({
      bucket: deleted.storageBucket,
      key: deleted.storageKey,
    })
    .catch(() => undefined);
}

export async function createPayslipReadUrl(
  input: PayslipReadAccessInput,
  deps: { storage?: ObjectStorage; now?: Date } = {},
) {
  const storage = deps.storage ?? getObjectStorage();
  const now = deps.now ?? new Date();
  const payslip = await prisma.payslip.findFirst({
    where: {
      id: input.payslipId,
      ...(input.isAdmin ? {} : { employeeMemberId: input.actorMemberId }),
      document: {
        status: "AVAILABLE",
        deletedAt: null,
      },
    },
    select: {
      id: true,
      employeeMemberId: true,
      periodStart: true,
      document: {
        select: {
          storageBucket: true,
          storageKey: true,
          originalFilename: true,
        },
      },
    },
  });

  if (!payslip) {
    throw new PayslipError("Payslip not found.");
  }

  const filename = sanitizeHeaderFilename(payslip.document.originalFilename);
  const url = await storage.getSignedReadUrl({
    bucket: payslip.document.storageBucket,
    key: payslip.document.storageKey,
    expiresInSeconds: PAYSLIP_SIGNED_URL_TTL_SECONDS,
    responseContentDisposition: `${input.disposition}; filename="${filename}"`,
  });

  await prisma.auditLog.create({
    data: {
      actorMemberId: input.actorMemberId,
      action: input.disposition === "attachment" ? "payslip.downloaded" : "payslip.previewed",
      targetType: "payslip",
      targetId: payslip.id,
      after: {
        employeeMemberId: payslip.employeeMemberId,
        periodStart: formatDateOnly(payslip.periodStart),
        disposition: input.disposition,
        signedUrlTtlSeconds: PAYSLIP_SIGNED_URL_TTL_SECONDS,
      },
      ...input.requestMetadata,
      createdAt: now,
    },
  });

  return url;
}

export async function listEmployeePayslips(
  employeeMemberId: string,
  rawPage?: string | number | null,
): Promise<EmployeePayslipListResult> {
  const historyPageSize = 12;
  const requestedPage = normalizeEmployeePayslipPage(rawPage);
  const where = {
    employeeMemberId,
    document: {
      status: "AVAILABLE" as const,
      deletedAt: null,
    },
  };
  const [latest, totalItems] = await Promise.all([
    prisma.payslip.findFirst({
      where,
      orderBy: [{ periodStart: "desc" }, { id: "desc" }],
      select: payslipListSelect,
    }),
    prisma.payslip.count({ where }),
  ]);

  if (!latest) {
    return {
      latest: null,
      history: [],
      totalHistoryItems: 0,
      totalHistoryPages: 1,
      historyPage: 1,
      historyPageSize,
    };
  }

  const totalHistoryItems = Math.max(0, totalItems - 1);
  const totalHistoryPages = Math.max(1, Math.ceil(totalHistoryItems / historyPageSize));
  const historyPage = Math.min(requestedPage, totalHistoryPages);
  const history = await prisma.payslip.findMany({
    where,
    orderBy: [{ periodStart: "desc" }, { id: "desc" }],
    skip: 1 + (historyPage - 1) * historyPageSize,
    take: historyPageSize,
    select: payslipListSelect,
  });

  return {
    latest: mapPayslipListRow(latest),
    history: history.map(mapPayslipListRow),
    totalHistoryItems,
    totalHistoryPages,
    historyPage,
    historyPageSize,
  };
}

export async function listPayslipsForAdmin(
  rawFilters: PayslipListFilters = {},
): Promise<PayslipListResult> {
  const filters = normalizePayslipListFilters(rawFilters);
  const where = {
    document: {
      status: "AVAILABLE" as const,
      deletedAt: null,
    },
    ...(filters.employeeMemberId ? { employeeMemberId: filters.employeeMemberId } : {}),
    ...(filters.month
      ? {
          periodStart: getMonthStart(new Date(`${filters.month}-01T00:00:00.000Z`)),
        }
      : {}),
    ...(filters.query
      ? {
          employee: {
            OR: [
              { displayName: { contains: filters.query, mode: "insensitive" as const } },
              { email: { contains: filters.query, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  };
  const [totalItems, employees] = await Promise.all([
    prisma.payslip.count({ where }),
    prisma.member.findMany({
      where: {
        currentProfile: "EMPLOYEE",
        deletedAt: null,
        status: { not: "DELETED" },
      },
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      select: {
        id: true,
        displayName: true,
        email: true,
        status: true,
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalItems / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const rows = await prisma.payslip.findMany({
    where,
    orderBy: [{ periodStart: "desc" }, { employee: { displayName: "asc" } }, { id: "desc" }],
    skip: (page - 1) * filters.pageSize,
    take: filters.pageSize,
    select: payslipListSelect,
  });

  return {
    rows: rows.map(mapPayslipListRow),
    totalItems,
    totalPages,
    page,
    pageSize: filters.pageSize,
    employeeOptions: employees.map((employee) => ({
      id: employee.id,
      name: employee.displayName,
      email: employee.email,
      status: employee.status,
    })),
    filters: {
      employeeMemberId: filters.employeeMemberId,
      month: filters.month,
      query: filters.query,
    },
  };
}

export async function getPayslipMonthOverview(month: Date): Promise<PayslipMonthOverview> {
  const periodStart = getMonthStart(normalizeDateOnly(month));
  const [employees, payslips] = await Promise.all([
    prisma.member.findMany({
      where: {
        currentProfile: "EMPLOYEE",
        status: "ACTIVE",
        deletedAt: null,
      },
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      select: {
        id: true,
        displayName: true,
        email: true,
      },
    }),
    prisma.payslip.findMany({
      where: {
        periodStart,
        document: {
          status: "AVAILABLE",
          deletedAt: null,
        },
      },
      select: {
        employeeMemberId: true,
      },
    }),
  ]);
  const postedEmployeeIds = new Set(payslips.map((payslip) => payslip.employeeMemberId));
  const missingEmployees = employees.filter((employee) => !postedEmployeeIds.has(employee.id));

  return {
    month: periodStart,
    expectedCount: employees.length,
    postedCount: employees.length - missingEmployees.length,
    missingEmployees: missingEmployees.map((employee) => ({
      id: employee.id,
      name: employee.displayName,
      email: employee.email,
    })),
  };
}

export function validatePayslipFile(file: PayslipFileInput) {
  if (file.byteSize <= 0) {
    throw new PayslipError("Payslip PDF is required.");
  }

  if (file.byteSize > PAYSLIP_MAX_BYTES) {
    throw new PayslipError("Payslip PDF is too large.");
  }

  if (file.contentType !== "application/pdf") {
    throw new PayslipError("Payslip must be a PDF.");
  }

  if (!file.originalFilename.toLowerCase().endsWith(".pdf")) {
    throw new PayslipError("Payslip must be a PDF.");
  }

  if (!file.bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new PayslipError("Payslip must be a PDF.");
  }
}

export function buildPayslipObjectKey(input: {
  employeeMemberId: string;
  periodStart: Date;
  originalFilename: string;
}) {
  return [
    "payslips",
    input.employeeMemberId,
    formatDateOnly(getMonthStart(input.periodStart)),
    `${randomUUID()}-${sanitizeFilename(input.originalFilename)}`,
  ].join("/");
}

export function normalizePayslipListFilters(filters: PayslipListFilters) {
  const month = normalizeMonth(filters.month);
  const pageSize = Math.min(100, Math.max(1, toPositiveInteger(filters.pageSize, 20)));

  return {
    employeeMemberId: normalizeOptionalString(filters.employeeMemberId),
    month,
    query: normalizeOptionalString(filters.query) ?? "",
    page: toPositiveInteger(filters.page, 1),
    pageSize,
  };
}

export function normalizeEmployeePayslipPage(page: unknown) {
  if (typeof page !== "string" && typeof page !== "number") return 1;
  return toPositiveInteger(page, 1);
}

const payslipListSelect = {
  id: true,
  employeeMemberId: true,
  periodStart: true,
  periodEnd: true,
  publishedAt: true,
  employee: {
    select: {
      displayName: true,
      email: true,
      status: true,
    },
  },
  publishedBy: {
    select: {
      displayName: true,
    },
  },
  document: {
    select: {
      originalFilename: true,
      byteSize: true,
    },
  },
} as const;

function mapPayslipListRow(row: {
  id: string;
  employeeMemberId: string;
  periodStart: Date;
  periodEnd: Date;
  publishedAt: Date | null;
  employee: { displayName: string; email: string; status: PayslipListRow["employeeStatus"] };
  publishedBy: { displayName: string } | null;
  document: { originalFilename: string; byteSize: bigint };
}): PayslipListRow {
  return {
    id: row.id,
    employeeMemberId: row.employeeMemberId,
    employeeName: row.employee.displayName,
    employeeEmail: row.employee.email,
    employeeStatus: row.employee.status,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    originalFilename: row.document.originalFilename,
    byteSize: row.document.byteSize,
    publishedAt: row.publishedAt,
    publishedByName: row.publishedBy?.displayName ?? null,
  };
}

function getMonthEnd(monthStart: Date) {
  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  nextMonth.setUTCDate(0);
  return normalizeDateOnly(nextMonth);
}

function sanitizeFilename(filename: string) {
  const normalized = filename.trim().replaceAll(/[^a-zA-Z0-9._-]/g, "-");
  return normalized || "payslip.pdf";
}

function sanitizeHeaderFilename(filename: string) {
  return filename.replaceAll(/[\r\n"]/g, "_") || "payslip.pdf";
}

function normalizeMonth(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return null;
  const month = new Date(`${value}-01T00:00:00.000Z`);
  return Number.isNaN(month.getTime()) || formatDateOnly(month).slice(0, 7) !== value
    ? null
    : value;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toPositiveInteger(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
