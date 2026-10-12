import { createHash, randomUUID } from "node:crypto";

import { countLeaveWorkdays, type LeaveDayPartValue, type LeaveRange } from "@/src/lib/leave-days";
import { listSearchParam, type SearchParamValue } from "@/src/lib/search-params";
import { prisma } from "@/src/server/db/client";
import type { Prisma } from "@/src/server/db/generated/client";
import type { LeaveType } from "@/src/server/db/generated/enums";
import { getObjectStorage, type ObjectStorage } from "@/src/server/storage";
import {
  addDays,
  formatDateOnly,
  getMonday,
  getMonthEnd,
  getMonthStart,
  getTodayIsoInTimezone,
  parseDateOnly,
} from "@/src/server/time-tracking/dates";

import { getPublicHolidaysInRange, type PublicHolidayValue } from "./holidays";
import {
  assertLeaveRangeShape,
  LeaveError,
  validateLeaveAttachment,
  validateLeaveInput,
  type LeaveAttachmentInput,
} from "./leave-rules";

/**
 * Employee leave: who is away when, recorded by the employee and bookkept by the admin.
 *
 * There is no approval. A leave is valid the moment it is recorded; the admin's only workflow
 * state is `hrProcessedAt`, a private tick for "entered into the HR system". Employees record
 * their own leave for the current month or later and can afterwards only add a sick note; every
 * edit and delete is the admin's.
 *
 * What a viewer sees is decided here, not in the UI: colleagues see that someone is away, never
 * why, and never the note or the attachment.
 */

const LEAVE_SIGNED_URL_TTL_SECONDS = 5 * 60;
const ADMIN_PAGE_SIZE = 50;

export type LeaveRequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type LeaveViewer = {
  memberId: string;
  isAdmin: boolean;
};

export type LeaveKind = "vacation" | "sick" | "absent";

export type LeaveItem = {
  id: string;
  memberId: string;
  memberName: string;
  kind: LeaveKind;
  dayPart: LeaveDayPartValue;
  startDate: string;
  endDate: string;
  workdays: number;
  isOwn: boolean;
  note: string | null;
  attachment: { filename: string } | null;
};

export type AdminLeaveRow = LeaveItem & {
  kind: "vacation" | "sick";
  memberEmail: string;
  createdAt: Date;
  hrProcessedAt: Date | null;
  hrProcessedByName: string | null;
};

export type LeaveFormInput = {
  type: LeaveType;
  startDate: string;
  endDate: string;
  dayPart: LeaveDayPartValue;
  note: string | null;
};

const leaveItemSelect = {
  id: true,
  memberId: true,
  type: true,
  dayPart: true,
  startDate: true,
  endDate: true,
  note: true,
  member: { select: { displayName: true, email: true } },
  attachmentDocument: { select: { originalFilename: true, deletedAt: true } },
} satisfies Prisma.LeaveSelect;

type LeaveItemRecord = Prisma.LeaveGetPayload<{ select: typeof leaveItemSelect }>;

const liveEmployee = {
  currentProfile: "EMPLOYEE",
  deletedAt: null,
  status: { not: "DELETED" },
} satisfies Prisma.MemberWhereInput;

/** The first day an employee may still record leave for: the 1st of their current month. */
export function getLeaveEarliestStartDate(timezone: string, now = new Date()) {
  return `${getTodayIsoInTimezone(timezone, now).slice(0, 7)}-01`;
}

export async function createLeave(
  input: LeaveFormInput & {
    memberId: string;
    file?: LeaveAttachmentInput | null;
    requestMetadata?: LeaveRequestMetadata;
  },
  deps: { storage?: ObjectStorage; now?: Date } = {},
) {
  const now = deps.now ?? new Date();
  const member = await prisma.member.findFirst({
    where: { id: input.memberId, ...liveEmployee, status: "ACTIVE" },
    select: { id: true, timezone: true },
  });

  if (!member) {
    throw new LeaveError("Only employees can record leave.", "EMPLOYEE_REQUIRED");
  }

  if (input.file && input.type !== "SICK") {
    throw new LeaveError("Only sick leave takes a sick note.", "ATTACHMENT_SICK_ONLY");
  }

  const contentType = input.file ? validateLeaveAttachment(input.file) : null;
  const earliestStartDate = getLeaveEarliestStartDate(member.timezone, now);
  assertLeaveRangeShape({ ...input, earliestStartDate });
  const holidays = await getHolidayDates(input.startDate, input.endDate);
  // Fails fast before the upload; repeated inside the transaction against a locked member row.
  validateLeaveInput({ ...input, holidayDates: holidays, earliestStartDate, existing: [] });

  const leaveId = randomUUID();
  const stored =
    input.file && contentType
      ? await putAttachment(input.file, contentType, {
          memberId: member.id,
          leaveId,
          storage: deps.storage,
        })
      : null;

  try {
    return await prisma.$transaction(async (tx) => {
      await lockMember(tx, member.id);
      const counted = validateLeaveInput({
        ...input,
        holidayDates: holidays,
        earliestStartDate,
        existing: await listLiveRanges(tx, member.id),
      });
      await assertNoTimeEntriesOnLeaveDays(tx, member.id, input);

      const document = stored
        ? await tx.document.create({
            data: buildDocumentData(stored, member.id, member.id, now),
            select: { id: true },
          })
        : null;

      const leave = await tx.leave.create({
        data: {
          id: leaveId,
          memberId: member.id,
          type: input.type,
          startDate: parseDateOnly(input.startDate),
          endDate: parseDateOnly(input.endDate),
          dayPart: input.dayPart,
          note: input.note,
          attachmentDocumentId: document?.id ?? null,
          createdByMemberId: member.id,
          createdAt: now,
        },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          actorMemberId: member.id,
          action: "leave.created",
          targetType: "leave",
          targetId: leave.id,
          after: {
            ...auditSnapshot(input),
            workdays: counted.workdays,
            documentId: document?.id ?? null,
          },
          ...input.requestMetadata,
          createdAt: now,
        },
      });

      return { leaveId: leave.id, workdays: counted.workdays };
    });
  } catch (error) {
    if (stored) await stored.storage.deleteObject(stored.ref).catch(() => undefined);
    throw error;
  }
}

/** An admin correction: any date, any type, but still no overlap and at least one workday. */
export async function updateLeaveForAdmin(
  input: LeaveFormInput & {
    leaveId: string;
    actorMemberId: string;
    requestMetadata?: LeaveRequestMetadata;
  },
  deps: { now?: Date } = {},
) {
  const now = deps.now ?? new Date();
  assertLeaveRangeShape({ ...input, earliestStartDate: null });
  const holidays = await getHolidayDates(input.startDate, input.endDate);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.leave.findFirst({
      where: { id: input.leaveId, deletedAt: null },
      select: {
        id: true,
        memberId: true,
        type: true,
        startDate: true,
        endDate: true,
        dayPart: true,
        note: true,
        attachmentDocumentId: true,
      },
    });

    if (!existing) throw new LeaveError("Leave not found.", "NOT_FOUND");
    // A sick note is health data; it must not stay attached to what is now a vacation, and
    // deleting it as a side effect of an edit would be a surprise. The admin removes it first.
    if (input.type !== "SICK" && existing.attachmentDocumentId) {
      throw new LeaveError(
        "Remove the sick note before changing this leave to vacation.",
        "SICK_NOTE_ATTACHED",
      );
    }

    await lockMember(tx, existing.memberId);
    const counted = validateLeaveInput({
      ...input,
      holidayDates: holidays,
      earliestStartDate: null,
      existing: await listLiveRanges(tx, existing.memberId, existing.id),
    });
    await assertNoTimeEntriesOnLeaveDays(tx, existing.memberId, input);

    // The note check above is a plain read, and uploads do not take the member lock; repeating it
    // in the update closes the window in which a sick note lands on what this edit makes a vacation.
    const updated = await tx.leave.updateMany({
      where: {
        id: existing.id,
        deletedAt: null,
        ...(input.type === "SICK" ? {} : { attachmentDocumentId: null }),
      },
      data: {
        type: input.type,
        startDate: parseDateOnly(input.startDate),
        endDate: parseDateOnly(input.endDate),
        dayPart: input.dayPart,
        note: input.note,
        updatedAt: now,
      },
    });
    if (updated.count === 0) {
      const live = await tx.leave.findFirst({
        where: { id: existing.id, deletedAt: null },
        select: { id: true },
      });
      throw live
        ? new LeaveError(
            "Remove the sick note before changing this leave to vacation.",
            "SICK_NOTE_ATTACHED",
          )
        : new LeaveError("Leave not found.", "NOT_FOUND");
    }

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "leave.updated",
        targetType: "leave",
        targetId: existing.id,
        before: auditSnapshot({
          type: existing.type,
          startDate: formatDateOnly(existing.startDate),
          endDate: formatDateOnly(existing.endDate),
          dayPart: existing.dayPart,
          note: existing.note,
        }),
        after: { ...auditSnapshot(input), workdays: counted.workdays },
        ...input.requestMetadata,
        createdAt: now,
      },
    });

    return { leaveId: existing.id, workdays: counted.workdays };
  });
}

export async function deleteLeaveForAdmin(
  input: { leaveId: string; actorMemberId: string; requestMetadata?: LeaveRequestMetadata },
  deps: { now?: Date } = {},
) {
  const now = deps.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.leave.findFirst({
      where: { id: input.leaveId, deletedAt: null },
      select: {
        id: true,
        memberId: true,
        type: true,
        startDate: true,
        endDate: true,
        dayPart: true,
        note: true,
      },
    });

    if (!existing) throw new LeaveError("Leave not found.", "NOT_FOUND");

    await tx.leave.update({
      where: { id: existing.id },
      data: { deletedAt: now, deletedByMemberId: input.actorMemberId },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "leave.deleted",
        targetType: "leave",
        targetId: existing.id,
        before: {
          memberId: existing.memberId,
          ...auditSnapshot({
            type: existing.type,
            startDate: formatDateOnly(existing.startDate),
            endDate: formatDateOnly(existing.endDate),
            dayPart: existing.dayPart,
            note: existing.note,
          }),
        },
        ...input.requestMetadata,
        createdAt: now,
      },
    });

    return { leaveId: existing.id };
  });
}

/** Ticks or unticks "entered into HR" on several leaves at once; unchanged ones are skipped. */
export async function setLeaveHrProcessed(
  input: {
    leaveIds: string[];
    processed: boolean;
    actorMemberId: string;
    requestMetadata?: LeaveRequestMetadata;
  },
  deps: { now?: Date } = {},
) {
  const now = deps.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const targets = await tx.leave.findMany({
      where: {
        id: { in: input.leaveIds },
        deletedAt: null,
        hrProcessedAt: input.processed ? null : { not: null },
      },
      select: { id: true },
    });

    if (targets.length === 0) return { changed: 0 };

    await tx.leave.updateMany({
      where: { id: { in: targets.map(({ id }) => id) } },
      data: input.processed
        ? { hrProcessedAt: now, hrProcessedByMemberId: input.actorMemberId }
        : { hrProcessedAt: null, hrProcessedByMemberId: null },
    });

    await tx.auditLog.createMany({
      data: targets.map(({ id }) => ({
        actorMemberId: input.actorMemberId,
        action: input.processed ? "leave.hr_processed" : "leave.hr_unprocessed",
        targetType: "leave",
        targetId: id,
        ...input.requestMetadata,
        createdAt: now,
      })),
    });

    return { changed: targets.length };
  });
}

/**
 * Adds or replaces the sick note on a sick leave. Open to the owner at any time, also once the
 * month is over, because the paper usually arrives after the illness.
 */
export async function uploadLeaveAttachment(
  input: {
    leaveId: string;
    viewer: LeaveViewer;
    file: LeaveAttachmentInput;
    requestMetadata?: LeaveRequestMetadata;
  },
  deps: { storage?: ObjectStorage; now?: Date } = {},
) {
  const now = deps.now ?? new Date();
  const contentType = validateLeaveAttachment(input.file);
  const leave = await prisma.leave.findFirst({
    where: {
      id: input.leaveId,
      deletedAt: null,
      ...(input.viewer.isAdmin ? {} : { memberId: input.viewer.memberId }),
    },
    select: { id: true, memberId: true, type: true },
  });

  if (!leave) throw new LeaveError("Leave not found.", "NOT_FOUND");
  if (leave.type !== "SICK") {
    throw new LeaveError("Only sick leave takes a sick note.", "ATTACHMENT_SICK_ONLY");
  }

  const stored = await putAttachment(input.file, contentType, {
    memberId: leave.memberId,
    leaveId: leave.id,
    storage: deps.storage,
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.leave.findUniqueOrThrow({
        where: { id: leave.id },
        select: {
          attachmentDocument: {
            select: { id: true, storageBucket: true, storageKey: true, originalFilename: true },
          },
        },
      });
      const document = await tx.document.create({
        data: buildDocumentData(stored, leave.memberId, input.viewer.memberId, now),
        select: { id: true },
      });

      // The checks above ran before the upload, so they are repeated in the update itself: an
      // admin may have deleted the leave or changed it to vacation while the file was in flight.
      const attached = await tx.leave.updateMany({
        where: { id: leave.id, deletedAt: null, type: "SICK" },
        data: { attachmentDocumentId: document.id },
      });
      if (attached.count === 0) {
        const changed = await tx.leave.findFirst({
          where: { id: leave.id, deletedAt: null },
          select: { id: true },
        });
        throw changed
          ? new LeaveError("Only sick leave takes a sick note.", "ATTACHMENT_SICK_ONLY")
          : new LeaveError("Leave not found.", "NOT_FOUND");
      }

      const previous = current.attachmentDocument;
      if (previous) {
        await tx.document.update({
          where: { id: previous.id },
          data: { status: "DELETED", deletedAt: now, deletedByMemberId: input.viewer.memberId },
          select: { id: true },
        });
      }

      await tx.auditLog.create({
        data: {
          actorMemberId: input.viewer.memberId,
          action: "leave.attachment_uploaded",
          targetType: "leave",
          targetId: leave.id,
          after: {
            documentId: document.id,
            originalFilename: input.file.originalFilename,
            byteSize: input.file.byteSize,
            replacesDocumentId: previous?.id ?? null,
          },
          ...input.requestMetadata,
          createdAt: now,
        },
      });

      return { previous, replaced: Boolean(previous) };
    });

    if (result.previous) {
      await stored.storage
        .deleteObject({ bucket: result.previous.storageBucket, key: result.previous.storageKey })
        .catch(() => undefined);
    }

    return { replaced: result.replaced };
  } catch (error) {
    await stored.storage.deleteObject(stored.ref).catch(() => undefined);
    throw error;
  }
}

export async function removeLeaveAttachmentForAdmin(
  input: { leaveId: string; actorMemberId: string; requestMetadata?: LeaveRequestMetadata },
  deps: { storage?: ObjectStorage; now?: Date } = {},
) {
  const now = deps.now ?? new Date();
  const storage = deps.storage ?? getObjectStorage();
  const removed = await prisma.$transaction(async (tx) => {
    const leave = await tx.leave.findFirst({
      where: { id: input.leaveId, deletedAt: null },
      select: {
        id: true,
        attachmentDocument: {
          select: { id: true, storageBucket: true, storageKey: true, originalFilename: true },
        },
      },
    });

    if (!leave?.attachmentDocument) throw new LeaveError("Leave not found.", "NOT_FOUND");

    await tx.leave.update({
      where: { id: leave.id },
      data: { attachmentDocumentId: null },
      select: { id: true },
    });
    await tx.document.update({
      where: { id: leave.attachmentDocument.id },
      data: { status: "DELETED", deletedAt: now, deletedByMemberId: input.actorMemberId },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "leave.attachment_removed",
        targetType: "leave",
        targetId: leave.id,
        before: {
          documentId: leave.attachmentDocument.id,
          originalFilename: leave.attachmentDocument.originalFilename,
        },
        ...input.requestMetadata,
        createdAt: now,
      },
    });

    return leave.attachmentDocument;
  });

  await storage
    .deleteObject({ bucket: removed.storageBucket, key: removed.storageKey })
    .catch(() => undefined);
}

/** A short-lived signed URL to the sick note, for its owner or an admin only. */
export async function createLeaveAttachmentReadUrl(
  input: {
    leaveId: string;
    viewer: LeaveViewer;
    disposition: "inline" | "attachment";
    requestMetadata?: LeaveRequestMetadata;
  },
  deps: { storage?: ObjectStorage; now?: Date } = {},
) {
  const storage = deps.storage ?? getObjectStorage();
  const now = deps.now ?? new Date();
  const leave = await prisma.leave.findFirst({
    where: {
      id: input.leaveId,
      deletedAt: null,
      ...(input.viewer.isAdmin ? {} : { memberId: input.viewer.memberId }),
      attachmentDocument: { status: "AVAILABLE", deletedAt: null },
    },
    select: {
      id: true,
      attachmentDocument: {
        select: { storageBucket: true, storageKey: true, originalFilename: true },
      },
    },
  });

  if (!leave?.attachmentDocument) throw new LeaveError("Leave not found.", "NOT_FOUND");

  const filename = leave.attachmentDocument.originalFilename.replaceAll(/[\r\n"]/g, "_");
  const url = await storage.getSignedReadUrl({
    bucket: leave.attachmentDocument.storageBucket,
    key: leave.attachmentDocument.storageKey,
    expiresInSeconds: LEAVE_SIGNED_URL_TTL_SECONDS,
    responseContentDisposition: `${input.disposition}; filename="${filename || "sick-note"}"`,
  });

  await prisma.auditLog.create({
    data: {
      actorMemberId: input.viewer.memberId,
      action: "leave.attachment_read",
      targetType: "leave",
      targetId: leave.id,
      after: { disposition: input.disposition },
      ...input.requestMetadata,
      createdAt: now,
    },
  });

  return url;
}

export type LeaveCalendarResult = {
  monthStart: string;
  gridStart: string;
  gridEnd: string;
  holidays: PublicHolidayValue[];
  items: LeaveItem[];
  /** The viewer's own leave inside the month, in workdays, split by kind. */
  ownSummary: { vacation: number; sick: number };
};

/**
 * Every employee's leave that touches the month's calendar grid (Monday of the first week to
 * Sunday of the last), already redacted for the viewer.
 */
export async function listLeaveCalendar(input: {
  month: string;
  viewer: LeaveViewer;
  memberIds?: string[];
  types?: LeaveType[];
}): Promise<LeaveCalendarResult> {
  const monthStart = getMonthStart(parseDateOnly(`${input.month.slice(0, 7)}-01`));
  const monthEnd = getMonthEnd(monthStart);
  const gridStart = getMonday(monthStart);
  const gridEnd = addDays(getMonday(monthEnd), 6);
  const [holidays, records] = await Promise.all([
    getPublicHolidaysInRange(formatDateOnly(gridStart), formatDateOnly(gridEnd)),
    prisma.leave.findMany({
      where: {
        deletedAt: null,
        startDate: { lte: gridEnd },
        endDate: { gte: gridStart },
        member: liveEmployee,
        ...(input.memberIds?.length ? { memberId: { in: input.memberIds } } : {}),
        ...(input.types?.length ? { type: { in: input.types } } : {}),
      },
      orderBy: [{ startDate: "asc" }, { member: { displayName: "asc" } }, { id: "asc" }],
      select: leaveItemSelect,
    }),
  ]);
  const holidayDates = holidays.map(({ date }) => date);
  const items = records.map((record) => toLeaveItem(record, input.viewer, holidayDates));
  const monthFirst = formatDateOnly(monthStart);
  const monthLast = formatDateOnly(monthEnd);
  const ownSummary = { vacation: 0, sick: 0 };

  for (const item of items) {
    if (!item.isOwn || item.kind === "absent") continue;
    ownSummary[item.kind] += countLeaveWorkdays({
      startDate: item.startDate < monthFirst ? monthFirst : item.startDate,
      endDate: item.endDate > monthLast ? monthLast : item.endDate,
      dayPart: item.dayPart,
      holidayDates,
    }).workdays;
  }

  return {
    monthStart: monthFirst,
    gridStart: formatDateOnly(gridStart),
    gridEnd: formatDateOnly(gridEnd),
    holidays,
    items,
    ownSummary,
  };
}

/** The member's own leave, newest first, split into what is still ahead and what is past. */
export async function listOwnLeave(input: { memberId: string; today: string }) {
  const records = await prisma.leave.findMany({
    where: { memberId: input.memberId, deletedAt: null },
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
    select: leaveItemSelect,
  });
  const holidayDates = await getHolidayDatesFor(records);
  const viewer = { memberId: input.memberId, isAdmin: false };
  const items = records.map((record) => toLeaveItem(record, viewer, holidayDates));

  return {
    upcoming: items.filter((item) => item.endDate >= input.today).reverse(),
    past: items.filter((item) => item.endDate < input.today),
  };
}

export type AdminLeaveFilters = {
  month: string | null;
  memberIds: string[];
  types: LeaveType[];
  hr: "all" | "pending" | "processed";
  page: number;
};

export function normalizeAdminLeaveFilters(raw: {
  month?: SearchParamValue;
  member?: SearchParamValue;
  type?: SearchParamValue;
  hr?: SearchParamValue;
  page?: SearchParamValue;
}): AdminLeaveFilters {
  const month = listSearchParam(raw.month).at(0) ?? "";
  const hr = listSearchParam(raw.hr).at(0);
  const page = Number.parseInt(listSearchParam(raw.page).at(0) ?? "", 10);

  return {
    month: /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null,
    memberIds: listSearchParam(raw.member).filter((id) => /^[0-9a-f-]{36}$/i.test(id)),
    types: listSearchParam(raw.type)
      .map((type) => type.toUpperCase())
      .filter((type): type is LeaveType => type === "VACATION" || type === "SICK"),
    hr: hr === "pending" || hr === "processed" ? hr : "all",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/**
 * The admin's list. The calendar view raises `pageSize`, since it needs a whole month at once, and
 * passes `range` for the grid's Monday-to-Sunday span: leave that only touches the neighbouring
 * months' days in the first and last row would otherwise be missing from the drawing.
 */
export async function listLeaveForAdmin(
  filters: AdminLeaveFilters,
  options: { pageSize?: number; range?: { from: string; to: string } } = {},
) {
  const pageSize = options.pageSize ?? ADMIN_PAGE_SIZE;
  const monthWhere = options.range
    ? {
        startDate: { lte: parseDateOnly(options.range.to) },
        endDate: { gte: parseDateOnly(options.range.from) },
      }
    : filters.month
      ? (() => {
          const start = parseDateOnly(`${filters.month}-01`);
          return { startDate: { lte: getMonthEnd(start) }, endDate: { gte: start } };
        })()
      : {};
  const scope = {
    deletedAt: null,
    member: liveEmployee,
    ...monthWhere,
    ...(filters.memberIds.length ? { memberId: { in: filters.memberIds } } : {}),
    ...(filters.types.length ? { type: { in: filters.types } } : {}),
  } satisfies Prisma.LeaveWhereInput;
  const where = {
    ...scope,
    ...(filters.hr === "pending" ? { hrProcessedAt: null } : {}),
    ...(filters.hr === "processed" ? { hrProcessedAt: { not: null } } : {}),
  } satisfies Prisma.LeaveWhereInput;

  const [totalItems, pendingCount, employees] = await Promise.all([
    prisma.leave.count({ where }),
    prisma.leave.count({ where: { ...scope, hrProcessedAt: null } }),
    prisma.member.findMany({
      where: liveEmployee,
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      select: { id: true, displayName: true, email: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(filters.page, totalPages);
  const records = await prisma.leave.findMany({
    where,
    orderBy: [{ startDate: "desc" }, { member: { displayName: "asc" } }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      ...leaveItemSelect,
      createdAt: true,
      hrProcessedAt: true,
      hrProcessedBy: { select: { displayName: true } },
    },
  });
  const holidayDates = await getHolidayDatesFor(records);
  const admin = { memberId: "", isAdmin: true };

  const rows: AdminLeaveRow[] = records.map((record) => ({
    ...(toLeaveItem(record, admin, holidayDates) as LeaveItem & { kind: "vacation" | "sick" }),
    memberEmail: record.member.email,
    createdAt: record.createdAt,
    hrProcessedAt: record.hrProcessedAt,
    hrProcessedByName: record.hrProcessedBy?.displayName ?? null,
  }));

  return {
    rows,
    page,
    totalPages,
    totalItems,
    pendingCount,
    employeeOptions: employees.map((employee) => ({
      id: employee.id,
      name: employee.displayName,
      email: employee.email,
    })),
  };
}

function toLeaveItem(
  record: LeaveItemRecord,
  viewer: LeaveViewer,
  holidayDates: string[],
): LeaveItem {
  const isOwn = record.memberId === viewer.memberId;
  const canSeeDetails = isOwn || viewer.isAdmin;
  const startDate = formatDateOnly(record.startDate);
  const endDate = formatDateOnly(record.endDate);
  const attachment =
    canSeeDetails && record.attachmentDocument && !record.attachmentDocument.deletedAt
      ? { filename: record.attachmentDocument.originalFilename }
      : null;

  return {
    id: record.id,
    memberId: record.memberId,
    memberName: record.member.displayName,
    kind: canSeeDetails ? (record.type === "SICK" ? "sick" : "vacation") : "absent",
    dayPart: record.dayPart,
    startDate,
    endDate,
    workdays: countLeaveWorkdays({ startDate, endDate, dayPart: record.dayPart, holidayDates })
      .workdays,
    isOwn,
    note: canSeeDetails ? record.note : null,
    attachment,
  };
}

async function getHolidayDates(start: string, end: string) {
  return (await getPublicHolidaysInRange(start, end)).map(({ date }) => date);
}

async function getHolidayDatesFor(records: ReadonlyArray<{ startDate: Date; endDate: Date }>) {
  if (records.length === 0) return [];
  const start = records.reduce(
    (min, record) => (record.startDate < min ? record.startDate : min),
    records[0]!.startDate,
  );
  const end = records.reduce(
    (max, record) => (record.endDate > max ? record.endDate : max),
    records[0]!.endDate,
  );
  return getHolidayDates(formatDateOnly(start), formatDateOnly(end));
}

/** Serializes concurrent writes for one member, so two tabs cannot both pass the overlap check. */
async function lockMember(tx: Prisma.TransactionClient, memberId: string) {
  await tx.$queryRaw`SELECT id FROM members WHERE id = ${memberId}::uuid FOR UPDATE`;
}

/**
 * A full-day leave and logged time exclude each other (see `time-tracking/leave-guard.ts` for the
 * other direction). A half day leaves the rest of the day open, and a declared month is a monthly
 * figure dated to its 1st rather than work on that day, so neither counts. A running timer counts
 * as time on the day it started: once a leave covered that day the timer could never be stopped,
 * and nothing else can end it.
 */
async function assertNoTimeEntriesOnLeaveDays(
  tx: Prisma.TransactionClient,
  memberId: string,
  input: LeaveRange,
) {
  if (input.dayPart !== "FULL") return;

  const entry = await tx.timeEntry.findFirst({
    where: {
      memberId,
      deletedAt: null,
      source: { not: "DECLARED" },
      localDate: { gte: parseDateOnly(input.startDate), lte: parseDateOnly(input.endDate) },
    },
    select: { id: true },
  });

  const timer = entry
    ? null
    : await tx.runningTimer.findUnique({
        where: { memberId },
        select: { startedAt: true, timezone: true },
      });
  const timerDate = timer ? getTodayIsoInTimezone(timer.timezone, timer.startedAt) : null;
  const timerInRange =
    timerDate !== null && timerDate >= input.startDate && timerDate <= input.endDate;

  if (entry || timerInRange) {
    throw new LeaveError("Time is already logged on some of these days.", "TIME_ENTRIES_ON_DAYS");
  }
}

async function listLiveRanges(tx: Prisma.TransactionClient, memberId: string, excludeId?: string) {
  const leaves = await tx.leave.findMany({
    where: { memberId, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { startDate: true, endDate: true, dayPart: true },
  });

  return leaves.map((leave) => ({
    startDate: formatDateOnly(leave.startDate),
    endDate: formatDateOnly(leave.endDate),
    dayPart: leave.dayPart,
  }));
}

function auditSnapshot(input: LeaveFormInput) {
  return {
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
    dayPart: input.dayPart,
    note: input.note,
  };
}

async function putAttachment(
  file: LeaveAttachmentInput,
  contentType: string,
  context: { memberId: string; leaveId: string; storage?: ObjectStorage },
) {
  const storage = context.storage ?? getObjectStorage();
  const checksumSha256 = createHash("sha256").update(file.bytes).digest("hex");
  const ref = await storage.putObject({
    key: buildLeaveAttachmentKey({ ...context, originalFilename: file.originalFilename }),
    body: file.bytes,
    contentType,
    byteSize: file.byteSize,
    checksumSha256,
  });

  return { storage, ref, file, contentType, checksumSha256 };
}

function buildDocumentData(
  stored: Awaited<ReturnType<typeof putAttachment>>,
  ownerMemberId: string,
  uploadedByMemberId: string,
  now: Date,
) {
  return {
    type: "SICK_NOTE" as const,
    status: "AVAILABLE" as const,
    ownerMemberId,
    storageBucket: stored.ref.bucket,
    storageKey: stored.ref.key,
    originalFilename: stored.file.originalFilename,
    contentType: stored.contentType,
    byteSize: BigInt(stored.file.byteSize),
    checksumSha256: stored.checksumSha256,
    uploadedByMemberId,
    createdAt: now,
  };
}

export function buildLeaveAttachmentKey(input: {
  memberId: string;
  leaveId: string;
  originalFilename: string;
}) {
  const filename = input.originalFilename.trim().replaceAll(/[^a-zA-Z0-9._-]/g, "-") || "sick-note";
  return ["sick-notes", input.memberId, input.leaveId, `${randomUUID()}-${filename}`].join("/");
}
