import type { LeaveCalendarLeave } from "@/src/components/sheet/LeaveCalendar";

/**
 * A leave as the client screens carry it: the calendar's shape plus what the details dialog
 * shows. Built from the server's `LeaveItem`, so redaction has already happened.
 */
export type LeaveView = LeaveCalendarLeave & {
  note: string | null;
  attachment: { filename: string } | null;
};

/** The admin list adds the bookkeeping columns. */
export type AdminLeaveView = LeaveView & {
  memberEmail: string;
  hrProcessedAt: string | null;
  hrProcessedByName: string | null;
};

export type LeaveHoliday = { date: string; name: string };
