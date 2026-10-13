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

const crowd: Array<
  [string, string, string, LeaveCalendarLeave["kind"], LeaveCalendarLeave["dayPart"]]
> = [
  ["Anna Kiss", "2026-10-19", "2026-10-23", "sick", "FULL"],
  ["Bence Nagy", "2026-10-19", "2026-10-30", "vacation", "FULL"],
  ["Csilla Tóth", "2026-10-20", "2026-10-22", "vacation", "FULL"],
  ["Dávid Szabó", "2026-10-21", "2026-10-27", "vacation", "FULL"],
  ["Eszter Horváth", "2026-10-21", "2026-10-21", "sick", "MORNING"],
  ["Ferenc Varga", "2026-10-22", "2026-10-22", "vacation", "FULL"],
  ["Gréta Kovács", "2026-10-19", "2026-10-21", "vacation", "FULL"],
  ["Hanna Molnár", "2026-10-26", "2026-10-30", "vacation", "FULL"],
  ["István Farkas", "2026-10-20", "2026-10-28", "sick", "FULL"],
  ["Judit Balogh", "2026-10-22", "2026-10-29", "vacation", "FULL"],
  ["Kristóf Papp", "2026-10-21", "2026-10-21", "vacation", "AFTERNOON"],
  ["Lilla Takács", "2026-10-19", "2026-10-20", "vacation", "FULL"],
];

/**
 * A week when most of the team is off at once (the autumn school break around 23 October), for
 * the lane cap: four lanes drawn, the rest behind each day's "+N more".
 */
export const crowdedOctoberLeaves: LeaveCalendarLeave[] = crowd.map(
  ([memberName, startDate, endDate, kind, dayPart], index) => ({
    id: `crowd-${index}`,
    memberId: memberName,
    memberName,
    kind,
    dayPart,
    startDate,
    endDate,
    workdays: 1,
    isOwn: index === 1,
  }),
);

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
  away: (count) => `${count} away`,
  more: (count) => `+${count} more`,
  awayOn: (isoDate) =>
    `Away on ${new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00Z`))}`,
};
