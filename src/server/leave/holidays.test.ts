import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  publicHolidayYear: { findMany: vi.fn(), upsert: vi.fn() },
  publicHoliday: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(async (operations: unknown[]) => operations),
}));

vi.mock("@/src/server/db/client", () => ({ prisma: db }));

const { fetchPublicHolidays, getPublicHolidaysInRange, refreshStalePublicHolidays } =
  await import("./holidays");

const nagerPayload = [
  {
    date: "2026-10-23",
    localName: "Nemzeti ünnep",
    name: "1956 Revolution Memorial Day",
    global: true,
    types: ["Public"],
  },
  {
    date: "2026-12-24",
    localName: "Szenteste",
    name: "Christmas Eve",
    global: true,
    types: ["Observance"],
  },
  {
    date: "2026-05-01",
    localName: "Regional",
    name: "Regional day",
    global: false,
    types: ["Public"],
  },
];

function jsonFetch(body: unknown, status = 200) {
  return vi.fn(
    async () => new Response(JSON.stringify(body), { status }),
  ) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.publicHoliday.findMany.mockResolvedValue([]);
});

describe("fetchPublicHolidays", () => {
  it("keeps only nationwide public holidays of the requested year", async () => {
    const fetcher = jsonFetch(nagerPayload);

    await expect(
      fetchPublicHolidays(2026, { fetch: fetcher, baseUrl: "https://api.test" }),
    ).resolves.toEqual([
      { date: "2026-10-23", localName: "Nemzeti ünnep", name: "1956 Revolution Memorial Day" },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.test/PublicHolidays/2026/HU",
      expect.anything(),
    );
  });

  it("throws on a failed response", async () => {
    await expect(fetchPublicHolidays(2026, { fetch: jsonFetch({}, 503) })).rejects.toThrow("503");
  });
});

describe("getPublicHolidaysInRange", () => {
  it("does not touch the network for a cached year", async () => {
    db.publicHolidayYear.findMany.mockResolvedValue([{ year: 2026 }]);
    db.publicHoliday.findMany.mockResolvedValue([
      {
        date: new Date("2026-10-23T00:00:00.000Z"),
        localName: "Nemzeti ünnep",
        name: "National day",
      },
    ]);
    const fetcher = jsonFetch(nagerPayload);

    await expect(
      getPublicHolidaysInRange("2026-10-01", "2026-10-31", { fetch: fetcher }),
    ).resolves.toEqual([{ date: "2026-10-23", localName: "Nemzeti ünnep", name: "National day" }]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fetches each uncached year of the range and stores it", async () => {
    db.publicHolidayYear.findMany.mockResolvedValue([{ year: 2026 }]);
    const fetcher = jsonFetch([]);

    await getPublicHolidaysInRange("2026-12-28", "2027-01-03", { fetch: fetcher });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/PublicHolidays/2027/HU"),
      expect.anything(),
    );
    expect(db.publicHolidayYear.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { year: 2027 } }),
    );
  });

  it("keeps working when the API is down", async () => {
    db.publicHolidayYear.findMany.mockResolvedValue([]);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      getPublicHolidaysInRange("2026-10-01", "2026-10-31", { fetch: jsonFetch({}, 500) }),
    ).resolves.toEqual([]);
    expect(error).toHaveBeenCalled();
    expect(db.publicHolidayYear.upsert).not.toHaveBeenCalled();
  });
});

describe("refreshStalePublicHolidays", () => {
  it("refreshes only the years that are missing or older than 30 days", async () => {
    const now = new Date("2026-10-08T10:00:00.000Z");
    db.publicHolidayYear.findMany.mockResolvedValue([
      { year: 2026, fetchedAt: new Date("2026-10-01T00:00:00.000Z") },
    ]);
    const fetcher = jsonFetch([]);

    await expect(refreshStalePublicHolidays({ fetch: fetcher, now })).resolves.toBe(1);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("/2027/HU"), expect.anything());
  });
});
