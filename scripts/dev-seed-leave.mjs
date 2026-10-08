import { createHash, randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Leave and public holidays for the dev and e2e databases.
 *
 * Holidays are written here rather than fetched, so neither a fresh clone nor CI needs the holiday
 * API: the rows match what Nager.Date returns for Hungary, and the year rows mark them as fetched.
 *
 * Two kinds of leave, for the same reason the time entries have a frozen week:
 * - FROZEN_LEAVES sit on fixed dates beside the frozen week, so e2e can assert them literally.
 * - The relative ones land in the current and next month, so the calendar has something to show
 *   whenever the seed runs. They are never asserted on.
 */

export const FROZEN_LEAVES = [
  {
    memberEmail: "admin@example.com",
    type: "vacation",
    startDate: "2025-03-12",
    endDate: "2025-03-14",
    dayPart: "full",
    note: "Family trip",
  },
  {
    memberEmail: "dora.kovacs@example.com",
    type: "sick",
    startDate: "2025-03-11",
    endDate: "2025-03-11",
    dayPart: "morning",
    note: "Doctor's appointment",
  },
];

/** Offsets in days from the first of the current month, so the leave moves with the calendar. */
const RELATIVE_LEAVES = [
  { memberEmail: "dora.kovacs@example.com", type: "vacation", from: 13, to: 17 },
  { memberEmail: "bence.nagy@example.com", type: "sick", from: 6, to: 7, sickNote: true },
  {
    memberEmail: "bence.nagy@example.com",
    type: "vacation",
    from: 20,
    to: 20,
    dayPart: "afternoon",
  },
  { memberEmail: "emma.toth@example.com", type: "vacation", from: 15, to: 24 },
  { memberEmail: "emma.toth@example.com", type: "sick", from: 2, to: 2 },
  { memberEmail: "dora.kovacs@example.com", type: "vacation", from: 38, to: 42 },
];

export async function seedLeave(client, { memberIds, objectStorage, today = new Date() }) {
  const holidays = await ensurePublicHolidays(client, today);
  let leaves = 0;

  for (const leave of FROZEN_LEAVES) {
    leaves += await ensureLeave(client, { ...leave, memberId: memberIds.get(leave.memberEmail) });
  }

  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const storage = createStorageClient(objectStorage);

  for (const leave of RELATIVE_LEAVES) {
    const memberId = memberIds.get(leave.memberEmail);
    // Offsets that land on a weekend move to the following Monday: the app refuses a leave with
    // no workday in it, and the seed should not hold anything the app could not have stored.
    const start = nextWorkday(addDays(monthStart, leave.from));
    const end = nextWorkday(addDays(monthStart, leave.to));
    const startDate = toDateOnly(start);
    const endDate = toDateOnly(end < start ? start : end);
    const created = await ensureLeave(client, {
      memberId,
      type: leave.type,
      startDate,
      endDate,
      dayPart: leave.dayPart ?? "full",
      note: null,
    });

    if (created && leave.sickNote) {
      await attachSickNote(client, { memberId, startDate, storage, objectStorage });
    }
    leaves += created;
  }

  return { leaves, holidays };
}

async function ensureLeave(client, leave) {
  if (!leave.memberId) return 0;

  const existing = await client.query(
    `SELECT 1 FROM leaves WHERE member_id = $1::uuid AND start_date = $2::date AND deleted_at IS NULL`,
    [leave.memberId, leave.startDate],
  );
  if (existing.rowCount > 0) return 0;

  await client.query(
    `
      INSERT INTO leaves (member_id, type, start_date, end_date, day_part, note, created_by_member_id, updated_at)
      VALUES ($1::uuid, $2::leave_type, $3::date, $4::date, $5::leave_day_part, $6, $1::uuid, now())
    `,
    [leave.memberId, leave.type, leave.startDate, leave.endDate, leave.dayPart, leave.note],
  );
  return 1;
}

async function attachSickNote(client, { memberId, startDate, storage, objectStorage }) {
  const leave = await client.query(
    `SELECT id FROM leaves WHERE member_id = $1::uuid AND start_date = $2::date AND deleted_at IS NULL`,
    [memberId, startDate],
  );
  const leaveId = leave.rows[0]?.id;
  if (!leaveId) return;

  const filename = "orvosi-igazolas.pdf";
  const bytes = createSickNotePdf();
  const storageKey = ["sick-notes", memberId, leaveId, `${randomUUID()}-${filename}`].join("/");

  await storage.send(
    new PutObjectCommand({
      Bucket: objectStorage.bucket,
      Key: storageKey,
      Body: bytes,
      ContentType: "application/pdf",
      ContentLength: bytes.length,
    }),
  );

  const document = await client.query(
    `
      INSERT INTO documents (
        type, status, owner_member_id, storage_bucket, storage_key, original_filename,
        content_type, byte_size, checksum_sha256, uploaded_by_member_id
      )
      VALUES ('sick_note'::document_type, 'available'::document_status, $1::uuid, $2, $3, $4,
        'application/pdf', $5, $6, $1::uuid)
      RETURNING id
    `,
    [
      memberId,
      objectStorage.bucket,
      storageKey,
      filename,
      bytes.length,
      createHash("sha256").update(bytes).digest("hex"),
    ],
  );

  await client.query(`UPDATE leaves SET attachment_document_id = $1::uuid WHERE id = $2::uuid`, [
    document.rows[0].id,
    leaveId,
  ]);
}

/**
 * Last year, this year and next year, plus 2025 for the frozen leave. Rows are replaced per year
 * so a re-seed after a rule change converges.
 */
async function ensurePublicHolidays(client, today) {
  const thisYear = today.getUTCFullYear();
  const years = [...new Set([2025, thisYear - 1, thisYear, thisYear + 1])];
  let count = 0;

  for (const year of years) {
    const holidays = hungarianPublicHolidays(year);
    await client.query(`DELETE FROM public_holidays WHERE year = $1`, [year]);
    for (const holiday of holidays) {
      await client.query(
        `
          INSERT INTO public_holidays (date, year, local_name, name, fetched_at)
          VALUES ($1::date, $2, $3, $4, now())
          ON CONFLICT (date) DO NOTHING
        `,
        [holiday.date, year, holiday.localName, holiday.name],
      );
    }
    await client.query(
      `
        INSERT INTO public_holiday_years (year, fetched_at) VALUES ($1, now())
        ON CONFLICT (year) DO UPDATE SET fetched_at = excluded.fetched_at
      `,
      [year],
    );
    count += holidays.length;
  }

  return count;
}

/** The same list Nager.Date publishes for Hungary: eight fixed dates and five tied to Easter. */
export function hungarianPublicHolidays(year) {
  const easter = easterSunday(year);
  const fromEaster = (days) => toDateOnly(addDays(easter, days));

  return [
    { date: `${year}-01-01`, localName: "Újév", name: "New Year's Day" },
    { date: `${year}-03-15`, localName: "Nemzeti ünnep", name: "1848 Revolution Memorial Day" },
    { date: fromEaster(-2), localName: "Nagypéntek", name: "Good Friday" },
    { date: fromEaster(0), localName: "Húsvétvasárnap", name: "Easter Sunday" },
    { date: fromEaster(1), localName: "Húsvéthétfő", name: "Easter Monday" },
    { date: `${year}-05-01`, localName: "A munka ünnepe", name: "Labour day" },
    { date: fromEaster(49), localName: "Pünkösdvasárnap", name: "Pentecost" },
    { date: fromEaster(50), localName: "Pünkösdhétfő", name: "Whit Monday" },
    { date: `${year}-08-20`, localName: "Az államalapítás ünnepe", name: "State Foundation Day" },
    { date: `${year}-10-23`, localName: "Nemzeti ünnep", name: "1956 Revolution Memorial Day" },
    { date: `${year}-11-01`, localName: "Mindenszentek", name: "All Saints Day" },
    { date: `${year}-12-25`, localName: "Karácsony", name: "Christmas Day" },
    { date: `${year}-12-26`, localName: "Karácsony másnapja", name: "St. Stephen's Day" },
  ];
}

/** Gregorian Easter Sunday (the anonymous Meeus/Jones/Butcher algorithm), as a UTC date. */
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, days) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function nextWorkday(date) {
  const weekday = date.getUTCDay();
  return weekday === 6 ? addDays(date, 2) : weekday === 0 ? addDays(date, 1) : date;
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function createStorageClient(objectStorage) {
  return new S3Client({
    endpoint: objectStorage.endpoint,
    region: objectStorage.region,
    forcePathStyle: objectStorage.forcePathStyle !== "false",
    credentials: {
      accessKeyId: objectStorage.accessKeyId,
      secretAccessKey: objectStorage.secretAccessKey,
    },
  });
}

/** A one-line PDF with a correct cross-reference table, enough for the viewer to open. */
function createSickNotePdf() {
  const text = "Orvosi igazolas - minta (seed)";
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}
