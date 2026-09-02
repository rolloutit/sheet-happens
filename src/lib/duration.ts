import type { DurationDisplayFormat } from "./formatting";

const unitTokenPattern =
  /([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*(hours|hour|hrs|hr|h|minutes|minute|mins|min|m)/gi;

export function formatDurationForInput(
  minutes: number,
  format: DurationDisplayFormat = "DECIMAL_HOURS",
) {
  const normalizedMinutes = Math.max(0, Math.round(minutes));

  if (format === "HOURS_MINUTES") {
    const hours = Math.floor(normalizedMinutes / 60);
    const remainingMinutes = normalizedMinutes % 60;
    return `${hours}:${String(remainingMinutes).padStart(2, "0")}`;
  }

  return Number((normalizedMinutes / 60).toFixed(2)).toString();
}

export function parseDurationToMinutes(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");

  if (!normalized) return 0;

  const colonMinutes = parseColonDuration(normalized);
  if (colonMinutes !== null) return colonMinutes;

  const unitMinutes = parseUnitDuration(normalized);
  if (unitMinutes !== null) return unitMinutes;

  return parseDecimalHours(normalized);
}

function parseColonDuration(value: string) {
  const match = /^(\d+):(\d{1,2})$/.exec(value);
  if (!match) return null;

  const hours = Number.parseInt(match[1] ?? "", 10);
  const minutes = Number.parseInt(match[2] ?? "", 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes >= 60) {
    return null;
  }

  return hours * 60 + minutes;
}

function parseUnitDuration(value: string) {
  let consumed = "";
  let totalMinutes = 0;
  let matched = false;

  for (const match of value.matchAll(unitTokenPattern)) {
    matched = true;
    consumed += match[0];

    const amount = Number.parseFloat((match[1] ?? "").replace(",", "."));
    const unit = match[2] ?? "";

    if (Number.isNaN(amount) || amount < 0) return null;

    if (unit.startsWith("h")) {
      totalMinutes += amount * 60;
    } else {
      if (!Number.isInteger(amount)) return null;
      totalMinutes += amount;
    }
  }

  if (!matched) return null;

  if (removeTokenSeparators(consumed) !== removeTokenSeparators(value)) {
    return null;
  }

  return Math.round(totalMinutes);
}

function parseDecimalHours(value: string) {
  if (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(value)) return null;

  const hours = Number.parseFloat(value.replace(",", "."));
  if (Number.isNaN(hours) || hours < 0) return null;

  return Math.round(hours * 60);
}

function removeTokenSeparators(value: string) {
  return value.replace(/\s+/g, "");
}
