import type { LeaveCalendarLabels, LeaveCalendarLeave } from "./LeaveCalendar.types";

/** Shared by the stories and the tests: October 2026 seen from the 8th, in English. */
export const octoberLeaves: LeaveCalendarLeave[] = [
  {
    id: "own-vacation",
    memberId: "me",
    memberName: "Dóra Kovács",
    kind: "vacation",
    dayPart: "FULL",
    startDate: "2026-10-14",
    endDate: "2026-10-20",
    workdays: 5,
    isOwn: true,
  },
  {
    id: "colleague-away",
    memberId: "bence",
    memberName: "Bence Nagy",
    kind: "absent",
    dayPart: "FULL",
    startDate: "2026-10-12",
    endDate: "2026-10-15",
    workdays: 4,
    isOwn: false,
  },
  {
    id: "own-sick",
    memberId: "me",
    memberName: "Dóra Kovács",
    kind: "sick",
    dayPart: "FULL",
    startDate: "2026-10-05",
    endDate: "2026-10-06",
    workdays: 2,
    isOwn: true,
  },
  {
    id: "colleague-morning",
    memberId: "emma",
    memberName: "Emma Tóth",
    kind: "absent",
    dayPart: "MORNING",
    startDate: "2026-10-22",
    endDate: "2026-10-22",
    workdays: 0.5,
    isOwn: false,
  },
  {
    id: "colleague-afternoon",
    memberId: "bence",
    memberName: "Bence Nagy",
    kind: "absent",
    dayPart: "AFTERNOON",
    startDate: "2026-10-22",
    endDate: "2026-10-22",
    workdays: 0.5,
    isOwn: false,
  },
  {
    id: "colleague-long",
    memberId: "emma",
    memberName: "Emma Tóth",
    kind: "absent",
    dayPart: "FULL",
    startDate: "2026-10-27",
    endDate: "2026-11-06",
    workdays: 9,
    isOwn: false,
  },
];

export const octoberHolidays = [
  { date: "2026-10-23", name: "National Day" },
  { date: "2026-11-01", name: "All Saints' Day" },
];

const kindNames = { vacation: "Vacation", sick: "Sick leave", absent: "Away" } as const;

export const englishLabels: LeaveCalendarLabels = {
  calendar: "October 2026",
  week: (weekNumber) => `Week ${weekNumber}`,
  leave: (leave) =>
    `${leave.isOwn ? "You" : leave.memberName}, ${kindNames[leave.kind].toLowerCase()}, ${leave.startDate} to ${leave.endDate}, ${leave.workdays} workdays`,
  ribbon: (leave) =>
    leave.isOwn ? `You, ${kindNames[leave.kind].toLowerCase()}` : leave.memberName,
  day: (isoDate) =>
    new Intl.DateTimeFormat("en", { dateStyle: "full", timeZone: "UTC" }).format(
      new Date(`${isoDate}T00:00:00Z`),
    ),
  kinds: kindNames,
  holiday: "Public holiday",
  today: "Today",
  morning: "Morning",
  afternoon: "Afternoon",
  empty: "Nobody is away this month.",
};
