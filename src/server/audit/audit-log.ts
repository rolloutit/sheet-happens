import { firstSearchParam, listSearchParam } from "@/src/lib/search-params";
import { anyOf } from "@/src/server/db/any-of";
import type { Prisma } from "@/src/server/db/generated/client";
import { prisma } from "@/src/server/db/client";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SYSTEM_ACTOR_VALUE = "system";
const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|backup|credential|publickey|privatekey|accesstoken|refreshtoken|idtoken)/i;

export type AuditLogSearchParams = Record<string, string | string[] | undefined>;

export type AuditLogFilters = {
  query: string;
  /** Empty means every event, the same way no filter at all does. */
  actions: string[];
  targetTypes: string[];
  /** May contain the `system` pseudo-actor alongside real member ids. */
  actorMemberIds: string[];
  fromDate: string;
  toDate: string;
  page: number;
  pageSize: number;
};

export type AuditLogFilterOption = {
  value: string;
  label: string;
};

export type AuditLogActorOption = AuditLogFilterOption & {
  email: string | null;
};

export type AuditLogRow = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actorMemberId: string | null;
  actorName: string;
  actorEmail: string | null;
  before: unknown;
  after: unknown;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  createdAtLabel: string;
};

export type AuditLogListResult = {
  rows: AuditLogRow[];
  filters: AuditLogFilters;
  totalItems: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  refreshedAt: string;
  actionOptions: AuditLogFilterOption[];
  targetTypeOptions: AuditLogFilterOption[];
  actorOptions: AuditLogActorOption[];
};

type AuditLogDb = {
  auditLog: {
    findMany(args: unknown): Promise<unknown[]>;
    count(args: unknown): Promise<number>;
    groupBy(args: unknown): Promise<unknown[]>;
  };
  member: {
    findMany(args: unknown): Promise<unknown[]>;
  };
};

type AuditLogRecord = {
  id: string;
  actorMemberId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  before: Prisma.JsonValue | null;
  after: Prisma.JsonValue | null;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  actor: AuditLogActorRecord | null;
};

type AuditLogActorRecord = {
  id: string;
  displayName: string;
  email: string;
};

type ActorOptionRecord = AuditLogActorRecord;

export type ListAuditLogsDeps = {
  db?: AuditLogDb;
  now?: () => Date;
  timeZone?: string;
};

export async function listAuditLogsForAdmin(
  searchParams: AuditLogSearchParams = {},
  deps: ListAuditLogsDeps = {},
): Promise<AuditLogListResult> {
  const db = deps.db ?? (prisma as unknown as AuditLogDb);
  const filters = normalizeAuditLogFilters(searchParams);
  const where = buildAuditLogWhere(filters);

  const [totalItems, actionRecords, targetTypeRecords, actorRecords] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.groupBy({
      by: ["action"],
      orderBy: {
        action: "asc",
      },
    }) as Promise<Array<{ action: string }>>,
    db.auditLog.groupBy({
      by: ["targetType"],
      orderBy: {
        targetType: "asc",
      },
    }) as Promise<Array<{ targetType: string }>>,
    db.member.findMany({
      where: {
        auditLogs: {
          some: {},
        },
      },
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      select: {
        id: true,
        displayName: true,
        email: true,
      },
    }) as Promise<ActorOptionRecord[]>,
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / filters.pageSize));
  const safeFilters = {
    ...filters,
    page: Math.min(filters.page, totalPages),
  };
  const skip = (safeFilters.page - 1) * safeFilters.pageSize;
  const records = (await db.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take: safeFilters.pageSize,
    select: {
      id: true,
      actorMemberId: true,
      action: true,
      targetType: true,
      targetId: true,
      before: true,
      after: true,
      requestId: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  })) as AuditLogRecord[];

  return {
    rows: records.map((record) => mapAuditLogRecord(record, deps.timeZone)),
    filters: safeFilters,
    totalItems,
    totalPages,
    pageStart: totalItems === 0 ? 0 : skip + 1,
    pageEnd: Math.min(skip + records.length, totalItems),
    refreshedAt: (deps.now?.() ?? new Date()).toISOString(),
    actionOptions: actionRecords.map((record) => ({
      value: record.action,
      label: formatAuditLabel(record.action),
    })),
    targetTypeOptions: targetTypeRecords.map((record) => ({
      value: record.targetType,
      label: formatAuditLabel(record.targetType),
    })),
    actorOptions: [
      {
        value: SYSTEM_ACTOR_VALUE,
        label: "System",
        email: null,
      },
      ...actorRecords.map((record) => ({
        value: record.id,
        label: record.displayName,
        email: record.email,
      })),
    ],
  };
}

export function normalizeAuditLogFilters(searchParams: AuditLogSearchParams = {}): AuditLogFilters {
  return {
    query: firstSearchParam(searchParams.q).trim().slice(0, 120),
    actions: listSearchParam(searchParams.action).map(capValueLength),
    targetTypes: listSearchParam(searchParams.targetType).map(capValueLength),
    actorMemberIds: listSearchParam(searchParams.actor).map(capValueLength),
    fromDate: normalizeDateInput(firstSearchParam(searchParams.from)),
    toDate: normalizeDateInput(firstSearchParam(searchParams.to)),
    page: parsePositiveInteger(firstSearchParam(searchParams.page), DEFAULT_PAGE),
    pageSize: Math.min(
      parsePositiveInteger(firstSearchParam(searchParams.pageSize), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    ),
  };
}

export function buildAuditLogWhere(filters: AuditLogFilters): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];

  if (filters.query) {
    const containsFilter = {
      contains: filters.query,
      mode: "insensitive" as const,
    };

    and.push({
      OR: [
        { action: containsFilter },
        { targetType: containsFilter },
        { targetId: containsFilter },
        { requestId: containsFilter },
        { ipAddress: containsFilter },
        {
          actor: {
            is: {
              OR: [
                { displayName: containsFilter },
                { email: containsFilter },
                { firstName: containsFilter },
                { lastName: containsFilter },
              ],
            },
          },
        },
      ],
    });
  }

  if (filters.actions.length > 0) {
    and.push({
      action: { in: filters.actions },
    });
  }

  if (filters.targetTypes.length > 0) {
    and.push({
      targetType: { in: filters.targetTypes },
    });
  }

  const actorClause = buildActorClause(filters.actorMemberIds);

  if (actorClause) and.push(actorClause);

  const createdAt: Prisma.DateTimeFilter<"AuditLog"> = {};
  const fromDate = parseDateBoundary(filters.fromDate, "start");
  const toDate = parseDateBoundary(filters.toDate, "end");

  if (fromDate) createdAt.gte = fromDate;
  if (toDate) createdAt.lte = toDate;

  if (Object.keys(createdAt).length > 0) {
    and.push({
      createdAt,
    });
  }

  if (and.length === 0) return {};
  if (and.length === 1) return and[0];
  return { AND: and };
}

/**
 * `system` is a pseudo-actor standing for rows no member owns, so it cannot ride along in
 * the same `in` as real member ids — picking it together with a person means "either".
 */
function buildActorClause(actorMemberIds: string[]) {
  const memberIds = actorMemberIds.filter((actorMemberId) => actorMemberId !== SYSTEM_ACTOR_VALUE);
  const clauses: Prisma.AuditLogWhereInput[] = [];

  if (memberIds.length < actorMemberIds.length) clauses.push({ actorMemberId: null });
  if (memberIds.length > 0) clauses.push({ actorMemberId: { in: memberIds } });

  return anyOf(clauses);
}

function capValueLength(value: string) {
  return value.slice(0, 120);
}

export function redactAuditPayload(value: Prisma.JsonValue | null): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactAuditPayload(item));
  }

  if (!isPlainRecord(value)) {
    return value;
  }

  const redacted: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value)) {
    redacted[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : redactAuditPayload(child);
  }

  return redacted;
}

export function formatAuditLabel(value: string) {
  return value
    .replace(/[-_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mapAuditLogRecord(record: AuditLogRecord, timeZone?: string): AuditLogRow {
  return {
    id: record.id,
    action: record.action,
    targetType: record.targetType,
    targetId: record.targetId,
    actorMemberId: record.actorMemberId,
    actorName: record.actor?.displayName ?? "System",
    actorEmail: record.actor?.email ?? null,
    before: redactAuditPayload(record.before),
    after: redactAuditPayload(record.after),
    requestId: record.requestId,
    ipAddress: record.ipAddress,
    userAgent: record.userAgent,
    createdAt: record.createdAt.toISOString(),
    createdAtLabel: formatAuditDate(record.createdAt, timeZone),
  };
}

function formatAuditDate(date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat("hu-HU", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone,
  }).format(date);
}

function normalizeDateInput(value: string) {
  const trimmed = value.trim();
  return DATE_INPUT_PATTERN.test(trimmed) ? trimmed : "";
}

function parsePositiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDateBoundary(value: string, boundary: "start" | "end") {
  if (!value) return null;

  const date = new Date(`${value}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPlainRecord(value: unknown): value is Record<string, Prisma.JsonValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
