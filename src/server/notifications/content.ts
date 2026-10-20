import type { AppLocale } from "@/src/i18n/locales";
import { formatDateRangeLabel } from "@/src/lib/formatting";
import type { NotificationType } from "@/src/server/db/generated/enums";

export type NotificationMetadata = Record<string, unknown>;

export type NotificationContent = {
  title: string;
  body: string;
  emailSubject: string;
};

export function buildNotificationContent(
  type: NotificationType,
  locale: AppLocale,
  metadata: NotificationMetadata,
): NotificationContent {
  const hu = locale === "hu";
  const month = formatMonth(metadata.periodStart, locale);
  const reason = textValue(metadata.reason);
  const projects = stringList(metadata.projectNames);

  switch (type) {
    case "WEEKLY_HOURS_REMINDER":
      return hu
        ? {
            title: "Hiányzó heti időbejegyzések",
            body: projects.length
              ? `Még nincs rögzített időd erre a hétre: ${projects.join(", ")}.`
              : "Még nincs rögzített időd erre a hétre.",
            emailSubject: "Sheet Happens: hiányzó heti időbejegyzések",
          }
        : {
            title: "Missing weekly time entries",
            body: projects.length
              ? `You have not logged time this week for: ${projects.join(", ")}.`
              : "You have not logged time for this week yet.",
            emailSubject: "Sheet Happens: missing weekly time entries",
          };
    case "MONTHLY_INVOICE_REMINDER":
      return hu
        ? {
            title: "Számlafeltöltés szükséges",
            body: `A(z) ${month} havi jóváhagyott timesheethez még nincs feltöltve számla.`,
            emailSubject: `Sheet Happens: számlafeltöltés szükséges (${month})`,
          }
        : {
            title: "Invoice upload required",
            body: `The approved timesheet for ${month} is still waiting for an invoice.`,
            emailSubject: `Sheet Happens: invoice upload required (${month})`,
          };
    case "TIMESHEET_SUBMITTED":
      return hu
        ? {
            title: "Timesheet beküldve",
            body: `${textValue(metadata.memberName) || "Egy kontraktor"} beküldte a(z) ${month} havi timesheetet.`,
            emailSubject: `Sheet Happens: beküldött timesheet (${month})`,
          }
        : {
            title: "Timesheet submitted",
            body: `${textValue(metadata.memberName) || "A contractor"} submitted the timesheet for ${month}.`,
            emailSubject: `Sheet Happens: submitted timesheet (${month})`,
          };
    case "TIMESHEET_APPROVED":
      return workflowContent(
        hu,
        "A timesheeted jóváhagyva",
        `A(z) ${month} havi timesheetet jóváhagyták.`,
        "Your timesheet was approved",
        `Your timesheet for ${month} was approved.`,
      );
    case "TIMESHEET_REJECTED":
      return workflowContent(
        hu,
        "A timesheeted elutasítva",
        reason
          ? `A(z) ${month} havi timesheetet elutasították: ${reason}`
          : `A(z) ${month} havi timesheetet elutasították.`,
        "Your timesheet was rejected",
        reason
          ? `Your timesheet for ${month} was rejected: ${reason}`
          : `Your timesheet for ${month} was rejected.`,
      );
    case "INVOICE_UPLOADED":
      return hu
        ? {
            title: "Új számla ellenőrzésre",
            body: `${textValue(metadata.memberName) || "Egy kontraktor"} számlát töltött fel a(z) ${month} havi timesheethez.`,
            emailSubject: `Sheet Happens: új számla (${month})`,
          }
        : {
            title: "New invoice for review",
            body: `${textValue(metadata.memberName) || "A contractor"} uploaded an invoice for ${month}.`,
            emailSubject: `Sheet Happens: new invoice (${month})`,
          };
    case "INVOICE_REJECTED":
      return workflowContent(
        hu,
        "A számlád elutasítva",
        reason
          ? `A(z) ${month} havi számlát elutasították: ${reason}`
          : `A(z) ${month} havi számlát elutasították.`,
        "Your invoice was rejected",
        reason
          ? `Your invoice for ${month} was rejected: ${reason}`
          : `Your invoice for ${month} was rejected.`,
      );
    case "INVOICE_ACCEPTED":
      return workflowContent(
        hu,
        "A számlád elfogadva",
        `A(z) ${month} havi számlát elfogadták.`,
        "Your invoice was accepted",
        `Your invoice for ${month} was accepted.`,
      );
    case "TIMESHEET_PAID":
      return workflowContent(
        hu,
        "Kifizetés rögzítve",
        `A(z) ${month} havi timesheet kifizetett állapotba került.`,
        "Payment recorded",
        `Your timesheet for ${month} was marked as paid.`,
      );
    case "PAYSLIP_AVAILABLE":
      return workflowContent(
        hu,
        "Új bérjegyzék érhető el",
        `Elérhető a(z) ${month} havi bérjegyzéked.`,
        "New payslip available",
        `Your payslip for ${month} is now available.`,
      );
    case "TIME_ENTRY_ADMIN_MODIFIED":
      return workflowContent(
        hu,
        "Admin módosította az időbejegyzésedet",
        reason
          ? `Egy admin módosította az időbejegyzésedet. Indok: ${reason}`
          : "Egy admin módosította az időbejegyzésedet.",
        "An admin changed your time entry",
        reason
          ? `An admin changed your time entry. Reason: ${reason}`
          : "An admin changed your time entry.",
      );
    case "LEAVE_RECORDED_BY_ADMIN": {
      const leave = formatLeave(metadata, locale);
      return workflowContent(
        hu,
        "Egy admin szabadságot rögzített neked",
        leave
          ? `Egy admin rögzítette a távollétedet: ${leave}.`
          : "Egy admin rögzítette a távollétedet.",
        "An admin recorded leave for you",
        leave ? `An admin recorded your time off: ${leave}.` : "An admin recorded your time off.",
      );
    }
    case "LEAVE_MONTH_END_REMINDER":
      // Lines rather than one paragraph: the email keeps them, the in-app list reads them as one.
      return hu
        ? {
            title: "Közeleg a hónap vége: nézd át a szabadságaidat",
            body: [
              "Szia! 👋",
              "Közeleg a hónap vége, ezért kérlek, nézd meg, hogy az e havi szabikat, betegszabikat (ha volt) beírtad-e. 🗓️",
              "Ha a hónapban még szabadságon leszel, és nem írtad be, akkor kérlek, holnap 12:00-ig tedd meg. 🙂",
              "Ha egy korábbi nap hiányzik, azt már csak admin tudja rögzíteni, ezért szólj az adminnak.",
              "Ha voltál táppénzen, és még nem küldted el a papírt, azt is küldd el addig.",
              "✨ Köszönöm! ✨",
            ].join("\n"),
            emailSubject: `Sheet Happens: szabadságok ellenőrzése (${month})`,
          }
        : {
            title: "Month end is coming: check your leave",
            body: [
              "Hi! 👋",
              "The month is nearly over, so please check that this month's vacation and sick leave (if any) are recorded. 🗓️",
              "If you will be on leave later this month and have not recorded it yet, please do so by 12:00 tomorrow. 🙂",
              "If an earlier day is missing, only an admin can record it now, so please let an admin know.",
              "If you were on sick pay and have not sent the paperwork yet, please send that by then too.",
              "✨ Thank you! ✨",
            ].join("\n"),
            emailSubject: `Sheet Happens: check your leave (${month})`,
          };
    default:
      return hu
        ? {
            title: "Sheet Happens értesítés",
            body: "Új értesítésed érkezett.",
            emailSubject: "Sheet Happens értesítés",
          }
        : {
            title: "Sheet Happens notification",
            body: "You have a new notification.",
            emailSubject: "Sheet Happens notification",
          };
  }
}

function workflowContent(
  hu: boolean,
  huTitle: string,
  huBody: string,
  enTitle: string,
  enBody: string,
): NotificationContent {
  const title = hu ? huTitle : enTitle;
  return { title, body: hu ? huBody : enBody, emailSubject: `Sheet Happens: ${title}` };
}

function formatMonth(value: unknown, locale: AppLocale) {
  if (typeof value !== "string") return locale === "hu" ? "kiválasztott" : "selected";
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

/** `vacation, Oct 12 – 14, 2026` or `betegszabadság, 2026. okt. 12. (délelőtt)`. */
function formatLeave(metadata: NotificationMetadata, locale: AppLocale) {
  const startDate = textValue(metadata.startDate);
  const endDate = textValue(metadata.endDate) || startDate;
  if (!startDate) return "";
  const hu = locale === "hu";
  const kind =
    metadata.type === "SICK"
      ? hu
        ? "betegszabadság"
        : "sick leave"
      : hu
        ? "szabadság"
        : "vacation";
  const dayPart =
    metadata.dayPart === "MORNING"
      ? hu
        ? " (délelőtt)"
        : " (morning)"
      : metadata.dayPart === "AFTERNOON"
        ? hu
          ? " (délután)"
          : " (afternoon)"
        : "";
  return `${kind}, ${formatDateRangeLabel(startDate, endDate, locale)}${dayPart}`;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
