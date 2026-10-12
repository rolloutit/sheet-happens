import { eachDateValue } from "@/src/lib/leave-days";
import type { Prisma } from "@/src/server/db/generated/client";

import { formatDateOnly, parseDateOnly } from "./dates";

/**
 * The dates in `[from, to]` a live full-day leave covers. A half day leaves the other half of the
 * day open for work, so it never blocks time tracking; every date of a full-day range does,
 * weekends and holidays included, because that is the range the employee recorded.
 */
export async function findFullDayLeaveDates(
  tx: Prisma.TransactionClient,
  memberId: string,
  from: string,
  to: string,
) {
  const leaves = await tx.leave.findMany({
    where: {
      memberId,
      deletedAt: null,
      dayPart: "FULL",
      startDate: { lte: parseDateOnly(to) },
      endDate: { gte: parseDateOnly(from) },
    },
    select: { startDate: true, endDate: true },
  });

  const dates = new Set<string>();
  for (const leave of leaves) {
    const start = formatDateOnly(leave.startDate);
    const end = formatDateOnly(leave.endDate);
    for (const day of eachDateValue(start < from ? from : start, end > to ? to : end)) {
      dates.add(day);
    }
  }
  return dates;
}

/**
 * Takes the member row lock that leave writes take, so a time entry and a leave for the same day
 * cannot both pass their check against each other in concurrent transactions.
 */
export async function lockMemberRow(tx: Prisma.TransactionClient, memberId: string) {
  await tx.$queryRaw`SELECT id FROM members WHERE id = ${memberId}::uuid FOR UPDATE`;
}
