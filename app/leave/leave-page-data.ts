import type { LeaveItem, PublicHolidayValue } from "@/src/server/leave";
import type { LeaveHoliday, LeaveView } from "./leave-view-types";

/** The server's leave as the client screens carry it. */
export function toLeaveView(item: LeaveItem): LeaveView {
  return {
    id: item.id,
    memberId: item.memberId,
    memberName: item.memberName,
    kind: item.kind,
    dayPart: item.dayPart,
    startDate: item.startDate,
    endDate: item.endDate,
    workdays: item.workdays,
    isOwn: item.isOwn,
    note: item.note,
    attachment: item.attachment,
  };
}

/** Holidays named in the reader's language: the API's local name is Hungarian. */
export function toLeaveHolidays(holidays: PublicHolidayValue[], locale: string): LeaveHoliday[] {
  return holidays.map((holiday) => ({
    date: holiday.date,
    name: locale === "hu" ? holiday.localName : holiday.name,
  }));
}

/** `YYYY-MM` from a search param, or `fallback` when it is missing or malformed. */
export function readMonthParam(value: string | string[] | undefined, fallback: string) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : fallback;
}
