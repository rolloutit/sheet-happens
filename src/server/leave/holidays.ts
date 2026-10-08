import { z } from "zod";

import { prisma } from "@/src/server/db/client";
import { formatDateOnly, parseDateOnly } from "@/src/server/time-tracking/dates";

/**
 * Hungarian public holidays, fetched from the Nager.Date API and cached per year.
 *
 * The API is free and keyless but outside our control, so it is never on a request's critical
 * path twice: a year is fetched once, stored, and refreshed in the background by the notification
 * dispatcher. When a fetch fails the calendar simply shows no holidays for that year and the
 * failure is logged; nothing about recording leave depends on the network.
 */

export type PublicHolidayValue = {
  date: string;
  localName: string;
  name: string;
};

const DEFAULT_HOLIDAY_API_BASE_URL = "https://date.nager.at/api/v3";
const FETCH_TIMEOUT_MS = 3_000;
const REFRESH_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
/** Years further from today than this are never fetched on demand, whatever range is asked for. */
const ON_DEMAND_YEAR_WINDOW = 5;
/** After a failed fetch a year is not asked for again on the request path for this long. */
const FAILURE_BACKOFF_MS = 10 * 60 * 1000;

/**
 * Per-process memory of the on-demand fetches: the one in flight for a year, so concurrent page
 * loads share it instead of racing to write the same rows, and when a year last failed, so an
 * outage costs one timeout per year every few minutes rather than one on every request.
 */
const inFlight = new Map<number, Promise<unknown>>();
const lastFailureAt = new Map<number, number>();

/** Test hook: forget fetches and failures between cases. */
export function resetHolidayFetchState() {
  inFlight.clear();
  lastFailureAt.clear();
}

const nagerHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  localName: z.string(),
  name: z.string(),
  global: z.boolean().optional(),
  types: z.array(z.string()).optional(),
});

type HolidayDeps = {
  fetch?: typeof fetch;
  baseUrl?: string;
  now?: Date;
};

export async function fetchPublicHolidays(year: number, deps: HolidayDeps = {}) {
  const baseUrl = deps.baseUrl ?? process.env.HOLIDAY_API_BASE_URL ?? DEFAULT_HOLIDAY_API_BASE_URL;
  const response = await (deps.fetch ?? fetch)(`${baseUrl}/PublicHolidays/${year}/HU`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Holiday API answered ${response.status} for ${year}.`);
  }

  const holidays = z.array(nagerHolidaySchema).parse(await response.json());

  // Nationwide public holidays only; the API also lists regional and observance days elsewhere.
  return holidays
    .filter(
      (holiday) => holiday.global !== false && (holiday.types ?? ["Public"]).includes("Public"),
    )
    .filter((holiday) => holiday.date.startsWith(`${year}-`))
    .map(({ date, localName, name }) => ({ date, localName, name }));
}

/** Fetches a year and replaces whatever was cached for it. */
export async function syncPublicHolidayYear(year: number, deps: HolidayDeps = {}) {
  const now = deps.now ?? new Date();
  const holidays = await fetchPublicHolidays(year, deps);

  await prisma.$transaction([
    prisma.publicHoliday.deleteMany({ where: { year } }),
    prisma.publicHoliday.createMany({
      data: holidays.map((holiday) => ({
        date: parseDateOnly(holiday.date),
        year,
        localName: holiday.localName,
        name: holiday.name,
        fetchedAt: now,
      })),
      skipDuplicates: true,
    }),
    prisma.publicHolidayYear.upsert({
      where: { year },
      create: { year, fetchedAt: now },
      update: { fetchedAt: now },
    }),
  ]);

  return holidays.length;
}

function yearsBetween(start: string, end: string) {
  const first = Number.parseInt(start.slice(0, 4), 10);
  const last = Number.parseInt(end.slice(0, 4), 10);
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index);
}

/**
 * The holidays between two dates, inclusive. Years never fetched before are fetched now; a failed
 * fetch is logged and the year stays empty until the next attempt.
 */
export async function getPublicHolidaysInRange(
  start: string,
  end: string,
  deps: HolidayDeps = {},
): Promise<PublicHolidayValue[]> {
  const thisYear = (deps.now ?? new Date()).getUTCFullYear();
  const years = yearsBetween(start, end).filter(
    (year) => Math.abs(year - thisYear) <= ON_DEMAND_YEAR_WINDOW,
  );
  const cached = await prisma.publicHolidayYear.findMany({
    where: { year: { in: years } },
    select: { year: true },
  });
  const cachedYears = new Set(cached.map(({ year }) => year));

  const now = (deps.now ?? new Date()).getTime();
  const missing = years.filter(
    (year) =>
      !cachedYears.has(year) && now - (lastFailureAt.get(year) ?? -Infinity) >= FAILURE_BACKOFF_MS,
  );
  await Promise.all(missing.map((year) => fetchYearOnce(year, deps, now)));

  const rows = await prisma.publicHoliday.findMany({
    where: { date: { gte: parseDateOnly(start), lte: parseDateOnly(end) } },
    orderBy: { date: "asc" },
    select: { date: true, localName: true, name: true },
  });

  return rows.map((row) => ({
    date: formatDateOnly(row.date),
    localName: row.localName,
    name: row.name,
  }));
}

function fetchYearOnce(year: number, deps: HolidayDeps, now: number) {
  const running = inFlight.get(year);
  if (running) return running;

  const attempt = syncPublicHolidayYear(year, deps)
    .then(() => lastFailureAt.delete(year))
    .catch((error: unknown) => {
      lastFailureAt.set(year, now);
      console.error(`[holidays] Could not fetch public holidays for ${year}.`, error);
    })
    .finally(() => inFlight.delete(year));
  inFlight.set(year, attempt);
  return attempt;
}

/**
 * Keeps this year and next year fresh. Run by the notification dispatcher, so a corrected or
 * newly published holiday list arrives without anyone opening the calendar.
 */
export async function refreshStalePublicHolidays(deps: HolidayDeps = {}) {
  const now = deps.now ?? new Date();
  const thisYear = now.getUTCFullYear();
  const years = [thisYear, thisYear + 1];
  const cached = await prisma.publicHolidayYear.findMany({
    where: { year: { in: years } },
    select: { year: true, fetchedAt: true },
  });
  const fetchedAt = new Map(cached.map((row) => [row.year, row.fetchedAt.getTime()]));
  let refreshed = 0;

  for (const year of years) {
    const last = fetchedAt.get(year);
    if (last !== undefined && now.getTime() - last < REFRESH_AFTER_MS) continue;

    try {
      await syncPublicHolidayYear(year, { ...deps, now });
      refreshed += 1;
    } catch (error) {
      console.error(`[holidays] Could not refresh public holidays for ${year}.`, error);
    }
  }

  return refreshed;
}
