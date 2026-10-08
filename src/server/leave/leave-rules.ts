import { isDateValue } from "@/src/lib/date-values";
import { countLeaveWorkdays, leaveRangesOverlap, type LeaveRange } from "@/src/lib/leave-days";

export const LEAVE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const LEAVE_MAX_SPAN_DAYS = 366;
export const LEAVE_NOTE_MAX_LENGTH = 500;

export type LeaveErrorCode =
  | "INVALID_RANGE"
  | "HALF_DAY_RANGE"
  | "NO_WORKDAYS"
  | "BEFORE_CURRENT_MONTH"
  | "TOO_LONG"
  | "OVERLAP"
  | "EMPLOYEE_REQUIRED"
  | "NOT_FOUND"
  | "ATTACHMENT_SICK_ONLY"
  | "ATTACHMENT_REQUIRED"
  | "ATTACHMENT_TOO_LARGE"
  | "ATTACHMENT_TYPE";

export class LeaveError extends Error {
  readonly code: LeaveErrorCode;

  constructor(message: string, code: LeaveErrorCode) {
    super(message);
    this.name = "LeaveError";
    this.code = code;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The checks that need no data: real dates, in order, a half day on a single date, not before the
 * earliest allowed day, at most a year long. Callers run this before anything that scales with the
 * range, such as fetching that range's holidays, so an absurd range costs nothing.
 *
 * `earliestStartDate` is the first of the employee's current month; an admin edit passes `null`
 * because correcting a past leave is exactly what the admin is for.
 */
export function assertLeaveRangeShape(input: LeaveRange & { earliestStartDate: string | null }) {
  if (!isDateValue(input.startDate) || !isDateValue(input.endDate)) {
    throw new LeaveError("Choose valid dates.", "INVALID_RANGE");
  }

  if (input.endDate < input.startDate) {
    throw new LeaveError("The leave must end on or after its first day.", "INVALID_RANGE");
  }

  if (input.dayPart !== "FULL" && input.startDate !== input.endDate) {
    throw new LeaveError("A half day can only be a single date.", "HALF_DAY_RANGE");
  }

  if (input.earliestStartDate && input.startDate < input.earliestStartDate) {
    throw new LeaveError(
      "Leave can only be recorded for the current month or later.",
      "BEFORE_CURRENT_MONTH",
    );
  }

  const spanDays =
    (Date.parse(`${input.endDate}T00:00:00.000Z`) -
      Date.parse(`${input.startDate}T00:00:00.000Z`)) /
      DAY_MS +
    1;
  if (spanDays > LEAVE_MAX_SPAN_DAYS) {
    throw new LeaveError("A single leave cannot be longer than a year.", "TOO_LONG");
  }
}

/**
 * Every rule a leave has to satisfy before it is stored, for a new leave and an admin edit alike.
 * `existing` is the member's other live leaves, so an edit must leave itself out.
 */
export function validateLeaveInput(
  input: LeaveRange & {
    holidayDates: Iterable<string>;
    earliestStartDate: string | null;
    existing: readonly LeaveRange[];
  },
) {
  assertLeaveRangeShape(input);

  const count = countLeaveWorkdays(input);
  if (count.workdays === 0) {
    throw new LeaveError("The selected days contain no workday.", "NO_WORKDAYS");
  }

  if (input.existing.some((other) => leaveRangesOverlap(input, other))) {
    throw new LeaveError("This overlaps a leave you already recorded.", "OVERLAP");
  }

  return count;
}

export type LeaveAttachmentInput = {
  bytes: Buffer;
  originalFilename: string;
  contentType: string;
  byteSize: number;
};

const attachmentKinds = [
  {
    contentType: "application/pdf",
    extensions: [".pdf"],
    signature: [0x25, 0x50, 0x44, 0x46, 0x2d],
  },
  { contentType: "image/png", extensions: [".png"], signature: [0x89, 0x50, 0x4e, 0x47] },
  { contentType: "image/jpeg", extensions: [".jpg", ".jpeg"], signature: [0xff, 0xd8, 0xff] },
] as const;

/**
 * A sick note is a PDF or a phone photo. The declared type, the extension and the file's own
 * signature all have to agree, so a renamed file is refused. Returns the content type to store.
 */
export function validateLeaveAttachment(file: LeaveAttachmentInput) {
  if (file.byteSize <= 0) {
    throw new LeaveError("Choose a file to upload.", "ATTACHMENT_REQUIRED");
  }

  if (file.byteSize > LEAVE_ATTACHMENT_MAX_BYTES) {
    throw new LeaveError("The file is larger than 10 MB.", "ATTACHMENT_TOO_LARGE");
  }

  const filename = file.originalFilename.toLowerCase();
  const kind = attachmentKinds.find(
    (candidate) =>
      candidate.contentType === file.contentType &&
      candidate.extensions.some((extension) => filename.endsWith(extension)) &&
      file.bytes.subarray(0, candidate.signature.length).equals(Buffer.from(candidate.signature)),
  );

  if (!kind) {
    throw new LeaveError("Upload a PDF, JPG or PNG file.", "ATTACHMENT_TYPE");
  }

  return kind.contentType;
}
