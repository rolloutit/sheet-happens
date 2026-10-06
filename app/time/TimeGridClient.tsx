"use client";

import {
  AlertTriangle,
  Check,
  Clock3,
  Copy,
  Info,
  Keyboard,
  LayoutGrid as GridIcon,
  List as ListIcon,
  MoreHorizontal,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { DayAgenda, type DayAgendaEntry } from "@/src/components/sheet/DayAgenda";
import type { EntryCardEntry, EntryHighlight } from "@/src/components/sheet/EntryCard";
import {
  buildHeatWeeks,
  countWorkdays,
  MonthHeatNavigator,
} from "@/src/components/sheet/MonthHeatNavigator";
import {
  MonthOverview,
  type MonthOverviewDeclaredProject,
  type MonthOverviewProject,
} from "@/src/components/sheet/MonthOverview";
import { PeriodNavigator } from "@/src/components/sheet/PeriodNavigator";
import { PeriodTotal, type PeriodTotalStatus } from "@/src/components/sheet/PeriodTotal";
import {
  QuickEntryComposer,
  type QuickEntryComposerValue,
} from "@/src/components/sheet/QuickEntryComposer";
import { ShortcutSheet } from "@/src/components/sheet/ShortcutSheet";
import { TimeScopeBar } from "@/src/components/sheet/TimeScopeBar";
import { notify } from "@/src/components/sheet/Toast";
import { WeekAgenda, type WeekAgendaDay } from "@/src/components/sheet/WeekAgenda";
import { Button } from "@/src/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/src/components/ui/Drawer";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from "@/src/components/ui/Dropdown";
import { isoWeekNumber } from "@/src/lib/date-values";
import { parseDurationToMinutes } from "@/src/lib/duration";
import {
  formatDateLabel,
  formatDateRangeLabel,
  formatDateTime,
  formatDayHeading,
  formatMonthLabel,
  formatWeekdayLabel,
  type DurationDisplayFormat,
} from "@/src/lib/formatting";
import { useAfterFirstPaint, type TimeMove } from "@/src/lib/motion";
import { DAILY_HARD_LIMIT_MINUTES, DAILY_SOFT_WARNING_MINUTES } from "@/src/lib/time-entry-limits";
import { useElapsedLabel } from "@/src/lib/use-elapsed-label";
import { useMediaQuery } from "@/src/lib/use-media-query";
import { useOverlayParam } from "@/src/lib/use-overlay-param";
import { usePickerLabels } from "@/src/i18n/picker-labels";
import { cn } from "@/src/lib/utils";
import type {
  MemberMonthOverview,
  TimeGridAssignedProject,
  TimeGridDay,
  TimeGridEntry,
  TimeGridWeek,
} from "@/src/server/time-tracking";

import {
  clearTimeEntryDraftAction,
  copyPreviousDayEntriesAction,
  createTimeEntryAction,
  deleteTimeEntryAction,
  duplicatePreviousWeekAction,
  markInactiveProjectWeekAction,
  restoreTimeEntryAction,
  saveMonthlyHourDeclarationAction,
  saveTimeEntryDraftAction,
  startRunningTimerAction,
  stopRunningTimerAction,
  unmarkInactiveProjectWeekAction,
  updateTimeEntryAction,
  uploadDeclarationProofAction,
} from "./actions";
import { TIME_ENTRY_FORM_DRAFT_KEY, type TimeTrackingActionState } from "./actions.types";
import { BreakdownDialog } from "./BreakdownDialog";
import { EntryModal, type EntryModalState } from "./EntryModal";
import { TimeCommandPalette, type TimeCommand } from "./TimeCommandPalette";
import {
  countDaysInMonth,
  formatAdminModifiedAt,
  formatBytesLabel,
  formatDraftTimestamp,
  getCellEntries,
  getEntryWarnings,
  groupEntriesByCell,
  groupEntriesByDay,
  isSimpleDurationEntry,
  type TimeTrackingTranslator,
} from "./time-entry-helpers";
import { TIME_OVERLAY_PARAM, TIMER_OVERLAY_VALUE } from "./time-overlays";
import { TimerControl } from "./TimerControl";
import { TimerCreateDialog } from "./TimerCreateDialog";
import { TimeZoomShell, type TimeZoomDay } from "./TimeZoomShell";
import { useDescriptionSuggestions } from "./use-description-suggestions";
import { DurationDisplayContext, useDurationFormatting } from "./use-duration-formatting";
import { useTimeView } from "./use-time-view";
import { WeekGridLens } from "./WeekGridLens";
import {
  DAY_PARAM,
  LENS_PARAM,
  resolveMonthStartIso,
  resolveScopeStops,
  resolveSelectedMonthStartIso,
  resolveWeekStartIso,
  SCOPE_PARAM,
  shiftIsoDate,
  shiftMonthStartIso,
  stepScope,
  WEEK_PARAM,
  type TimeScope,
  type WeekLens,
} from "./zoom";

const FIRST_VISIT_HINT_KEY = "time-redesign-hint-seen";
const UNDO_TOAST_MS = 6_000;
const DESKTOP_QUERY = "(min-width: 64rem)";

type Notice = {
  tone: "success" | "error";
  message: string;
} | null;

/** Which declared row is mid-write, and how the last write went. See `declarationState`. */
type DeclarationRowState = {
  projectId: string | null;
  saving: boolean;
  uploading: boolean;
  /** Set on a successful save so the row can confirm it until the fields change again. */
  savedAt: number | null;
  error: string | null;
};

type BreakdownState = {
  projectId: string;
  localDate: string;
} | null;

type PendingQuickAction =
  | {
      type: "copyPreviousDay";
      sourceDate: string;
      targetDate: string;
    }
  | {
      type: "duplicatePreviousWeek";
      sourceWeekEnd: string;
      sourceWeekStart: string;
      targetWeekEnd: string;
      targetWeekStart: string;
    };

/**
 * Where the quick composer is open. `column` is the popover anchored to a Week column's `+`,
 * `sheet` is the phone's bottom sheet. The Day scope's rail composer is not a state: it is open
 * whenever the rail is, so it renders unconditionally there.
 */
type ComposerAnchor = "column" | "sheet";

type ComposerState = {
  localDate: string;
  anchor: ComposerAnchor;
} | null;

/**
 * What the next data arrival should light up (§7.7): the one card that was not there before, or a
 * named card that was just edited. Resolved into `highlight` the moment the refreshed week lands,
 * because the actions report a sentence rather than an id.
 */
type PendingHighlight = { type: "new" } | { type: "entry"; id: string } | null;

type EntrySnapshot = {
  ids: Set<string>;
  /** Ids and update stamps joined, so an edit changes it as much as an arrival does. */
  signature: string;
};

function snapshotEntries(entries: readonly TimeGridEntry[]): EntrySnapshot {
  return {
    ids: new Set(entries.map((entry) => entry.id)),
    signature: entries.map((entry) => `${entry.id}:${entry.updatedAt}`).join("|"),
  };
}

type TimeGridClientProps = {
  week: TimeGridWeek;
  /**
   * Every month the visible week touches — one, or two when the week spans a month boundary.
   *
   * A second payload beside `week` rather than a field inside it. `TimeGridWeek` means "the visible
   * week", every field on it is week-scoped, and `getMemberMonthOverview` is its own domain
   * function with its own queries. Shipping it with the page is what makes the Month scope
   * reachable with no round-trip, which is what lets the scope change stay a pure layout animation.
   */
  months: MemberMonthOverview[];
  durationDisplayFormat: DurationDisplayFormat;
};

export function TimeGridClient({ week, months, durationDisplayFormat }: TimeGridClientProps) {
  return (
    <DurationDisplayContext.Provider value={durationDisplayFormat}>
      <TimeGridContent week={week} months={months} />
    </DurationDisplayContext.Provider>
  );
}

function TimeGridContent({ week, months }: { week: TimeGridWeek; months: MemberMonthOverview[] }) {
  const router = useRouter();
  const t = useTranslations("TimeTracking");
  const locale = useLocale();
  const pickerLabels = usePickerLabels();
  const { durationDisplayFormat, formatMinutesAsHours, formatMinutesWithUnit } =
    useDurationFormatting();
  const [isPending, startTransition] = useTransition();
  /* Desktop-first on the server: the columns and the full chrome are in the HTML the server sends,
     and a phone corrects itself before its first paint. */
  const desktop = useMediaQuery(DESKTOP_QUERY, { serverSnapshot: true });
  const animateEntries = useAfterFirstPaint();

  /**
   * The member's own scope list, derived from the resolved tracking mode on each assignment. A
   * declared-only member gets the month alone, and no control at all.
   */
  const stops = useMemo(() => resolveScopeStops(week.projects), [week.projects]);
  const { scope, lens, selectedDayIso, setScope, setLens, setSelectedDayIso, zoomToDay, openWeek } =
    useTimeView(week, stops);

  const [move, setMove] = useState<TimeMove | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [entryModal, setEntryModal] = useState<EntryModalState>(null);
  const [breakdown, setBreakdown] = useState<BreakdownState>(null);
  const [pendingQuickAction, setPendingQuickAction] = useState<PendingQuickAction | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [composer, setComposer] = useState<ComposerState>(null);
  const [composerValue, setComposerValue] = useState<QuickEntryComposerValue>({
    projectId: "",
    durationText: "",
    description: "",
  });
  const [composerError, setComposerError] = useState<string | null>(null);
  /* The member's own recent descriptions, ready to be scoped to whichever chip is selected. */
  const descriptionSuggestions = useDescriptionSuggestions(week.descriptionSuggestions);
  const [composerDraftStatus, setComposerDraftStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [railFocusToken, setRailFocusToken] = useState(0);
  const [highlight, setHighlight] = useState<EntryHighlight | null>(null);
  const [pendingHighlight, setPendingHighlight] = useState<PendingHighlight>(null);
  const [seenEntries, setSeenEntries] = useState(() => snapshotEntries(week.entries));
  const [declarationState, setDeclarationState] = useState<DeclarationRowState>({
    projectId: null,
    saving: false,
    uploading: false,
    savedAt: null,
    error: null,
  });
  const [, setTimerOpen] = useOverlayParam(TIME_OVERLAY_PARAM, TIMER_OVERLAY_VALUE);
  const periodLabelRef = useRef<HTMLButtonElement>(null);

  /**
   * The saved pulse, resolved as the data changes. Adjusted during render rather than in an effect
   * — React's own recipe for state derived from a prop change — so the card lights up in the same
   * paint the refreshed week arrives in, and nothing is written from an effect.
   */
  const entrySnapshot = snapshotEntries(week.entries);
  if (entrySnapshot.signature !== seenEntries.signature) {
    setSeenEntries(entrySnapshot);
    if (pendingHighlight?.type === "new") {
      const arrived = week.entries.filter((entry) => !seenEntries.ids.has(entry.id));
      const arrivedId = arrived.length === 1 ? arrived[0]?.id : undefined;
      setHighlight((current) =>
        arrivedId ? { id: arrivedId, token: (current?.token ?? 0) + 1 } : null,
      );
      setPendingHighlight(null);
    } else if (pendingHighlight?.type === "entry") {
      const editedId = pendingHighlight.id;
      setHighlight((current) => ({ id: editedId, token: (current?.token ?? 0) + 1 }));
      setPendingHighlight(null);
    } else {
      setHighlight(null);
    }
  }

  const inactiveProjectIds = useMemo(
    () => new Set(week.inactiveWeeks.map((inactiveWeek) => inactiveWeek.projectId)),
    [week.inactiveWeeks],
  );
  const entriesByCell = useMemo(() => groupEntriesByCell(week.entries), [week.entries]);
  const entriesByDay = useMemo(() => groupEntriesByDay(week.entries), [week.entries]);
  const weekHasLockedPeriod = week.lockedMonthStarts.length > 0;
  const adminModifiedEntryCount = week.entries.filter((entry) => entry.adminModification).length;

  /**
   * The projects the finer scopes are allowed to offer, and the ones they explain instead.
   *
   * `week.projects` stays the complete assignment list — `resolveScopeStops` reads it — and the
   * split happens here, once. Every consumer that could offer a project to write against reads
   * `projectRows`, the tracked list; the declared half feeds the handoff line, the Grid's ghost rows
   * and the Month segment's badge.
   */
  const projectRows = useMemo(
    () => week.projects.filter((project) => project.trackingMode === "TRACKED"),
    [week.projects],
  );
  const declaredProjects = useMemo(
    () => week.projects.filter((project) => project.trackingMode === "DECLARED"),
    [week.projects],
  );
  const hasAssignments = week.projects.length > 0;
  const projectsById = useMemo(
    () => new Map(projectRows.map((project) => [project.projectId, project])),
    [projectRows],
  );
  const recentProjects = week.recentProjects.filter((project) =>
    projectsById.has(project.projectId),
  );
  /** Recent first, then the rest of the assigned projects — the composer's chip order. */
  const composerProjects = useMemo(() => {
    const recentIds = new Set(recentProjects.map((project) => project.projectId));
    return [
      ...recentProjects,
      ...projectRows.filter((project) => !recentIds.has(project.projectId)),
    ].map((project) => ({
      projectId: project.projectId,
      name: project.name,
      color: project.color,
    }));
  }, [projectRows, recentProjects]);

  const dailyTotals = week.days.map((day) =>
    projectRows.reduce((sum, project) => {
      if (inactiveProjectIds.has(project.projectId)) return sum;
      return sum + getCellEntries(entriesByCell, project.projectId, day.isoDate).totalMinutes;
    }, 0),
  );
  const weekTotal = dailyTotals.reduce((sum, minutes) => sum + minutes, 0);
  const selectedDay =
    week.days.find((day) => day.isoDate === selectedDayIso) ?? week.days[0] ?? null;
  const selectedDayEntries = selectedDay ? (entriesByDay.get(selectedDay.isoDate) ?? []) : [];
  const targetDate = selectedDay?.isoDate ?? week.weekStart;
  const selectedDayTotalMinutes = selectedDay
    ? (dailyTotals[week.days.indexOf(selectedDay)] ?? 0)
    : 0;

  /**
   * The days as every header renders them: the server's shape plus the total, and the weekday
   * names formatted in the member's locale rather than the English the payload carries.
   */
  const days: TimeZoomDay[] = week.days.map((day, dayIndex) => ({
    isoDate: day.isoDate,
    label: capitalize(formatWeekdayLabel(day.isoDate, locale, { style: "long" })),
    shortLabel: capitalize(formatWeekdayLabel(day.isoDate, locale, { style: "short" })),
    dayNumber: day.dayNumber,
    state: day.state,
    locked: day.locked,
    totalMinutes: dailyTotals[dayIndex] ?? 0,
  }));
  const daysByIso = new Map(days.map((day) => [day.isoDate, day]));

  /** The month the Month scope shows, derived from the **selected day** and never from the week. */
  const selectedMonthStart = resolveSelectedMonthStartIso(
    selectedDayIso,
    months.map((month) => month.monthStart),
  );
  const monthOverview = months.find((month) => month.monthStart === selectedMonthStart);
  const monthLabel = formatMonthLabel(selectedMonthStart, locale);
  const monthTotalMinutes = monthOverview?.totalMinutes ?? 0;
  const monthLocked = week.lockedMonthStarts.includes(selectedMonthStart);
  const heatWeeks = buildHeatWeeks({
    monthStart: selectedMonthStart,
    todayIso: week.todayIso,
    totals: monthOverview?.days ?? [],
  });
  const workdays = countWorkdays(heatWeeks);
  const monthProjects: MonthOverviewProject[] = (monthOverview?.tracked ?? []).map((project) => ({
    projectId: project.projectId,
    name: project.name,
    color: project.color,
    minutes: project.minutes,
  }));
  const declarationSanityLimitMinutes = countDaysInMonth(selectedMonthStart) * 24 * 60;
  const declaredRows: MonthOverviewDeclaredProject[] = (monthOverview?.declared ?? []).map(
    (project) => ({
      projectId: project.projectId,
      name: project.name,
      color: project.color,
      minutes: project.minutes,
      note: project.note,
      proof: project.proof
        ? {
            filename: project.proof.filename,
            href: `/time/hours-proof/${project.proof.declarationId}`,
            sizeLabel: formatBytesLabel(project.proof.byteSize, locale),
            uploadedAtLabel: formatDateTime(project.proof.uploadedAt, locale),
          }
        : null,
      warning:
        project.minutes !== null && project.minutes > declarationSanityLimitMinutes
          ? t("declared.sanityWarning", {
              hours: formatMinutesWithUnit(declarationSanityLimitMinutes),
            })
          : null,
      error: declarationState.projectId === project.projectId ? declarationState.error : null,
      saving: declarationState.projectId === project.projectId && declarationState.saving,
      uploading: declarationState.projectId === project.projectId && declarationState.uploading,
      savedAt: declarationState.projectId === project.projectId ? declarationState.savedAt : null,
    }),
  );

  /* ------------------------------------------------------------------------------------------ */
  /* The period: label, key, unit and "are we on today"                                         */
  /* ------------------------------------------------------------------------------------------ */

  const periodStart =
    scope === "day" ? selectedDayIso : scope === "week" ? week.weekStart : selectedMonthStart;
  const periodLabel =
    scope === "day"
      ? formatDayHeading(selectedDayIso, locale)
      : scope === "week"
        ? t("period.week", {
            week: isoWeekNumber(week.weekStart),
            range: formatDateRangeLabel(week.weekStart, week.weekEnd, locale),
          })
        : monthLabel;
  const periodUnit = t(
    scope === "day" ? "period.unitDay" : scope === "week" ? "period.unitWeek" : "period.unitMonth",
  );
  const atToday =
    scope === "day"
      ? selectedDayIso === week.todayIso
      : scope === "week"
        ? week.weekStart === week.thisWeek
        : selectedMonthStart === resolveMonthStartIso(week.todayIso);
  const viewKey = `${scope}:${scope === "week" ? lens : "-"}:${periodStart}`;

  const periodTotalMinutes =
    scope === "day" ? selectedDayTotalMinutes : scope === "week" ? weekTotal : monthTotalMinutes;
  const targetLabel = formatMinutesWithUnit(DAILY_SOFT_WARNING_MINUTES);
  const totalStatus: PeriodTotalStatus | null =
    scope === "day" && selectedDayTotalMinutes > DAILY_SOFT_WARNING_MINUTES
      ? { tone: "warning", label: t("total.overTarget", { target: targetLabel }) }
      : scope === "day" && selectedDayTotalMinutes === DAILY_SOFT_WARNING_MINUTES
        ? { tone: "success", label: t("total.onTarget") }
        : null;

  const announcement = t("view.announce", {
    scope: t(`view.${scope}`) + (scope === "week" ? ` · ${t(`lens.${lens}`)}` : ""),
    period: periodLabel,
    total: formatMinutesWithUnit(periodTotalMinutes),
  });

  /* ------------------------------------------------------------------------------------------ */
  /* Moves                                                                                      */
  /* ------------------------------------------------------------------------------------------ */

  function changeScope(next: TimeScope) {
    if (next === scope) return;
    setMove({
      kind: "zoom",
      direction: stops.indexOf(next) < stops.indexOf(scope) ? "in" : "out",
    });
    setScope(next);
  }

  function changeLens(next: WeekLens) {
    if (next === lens) return;
    setMove({ kind: "lens" });
    setLens(next);
  }

  function toggleLens() {
    if (!stops.includes("week")) return;
    if (scope !== "week") {
      setMove({
        kind: "zoom",
        direction: stops.indexOf("week") < stops.indexOf(scope) ? "in" : "out",
      });
      openWeek("grid");
      return;
    }
    setMove({ kind: "lens" });
    setLens(lens === "grid" ? "agenda" : "grid");
  }

  /**
   * Changing weeks is a real navigation — new data, new server queries — unlike changing scope or
   * day, which the view writes with `replaceState`. Both of those still have to survive it.
   */
  function navigateTo(
    weekStart: string,
    dayIso: string,
    overrides: { scope?: TimeScope; lens?: WeekLens } = {},
  ) {
    const nextScope = overrides.scope ?? scope;
    const params = new URLSearchParams({
      [WEEK_PARAM]: weekStart,
      [SCOPE_PARAM]: nextScope,
      [DAY_PARAM]: dayIso,
    });
    if (nextScope === "week") params.set(LENS_PARAM, overrides.lens ?? lens);

    router.push(`/time?${params.toString()}` as Route);
  }

  function stepPeriod(direction: "previous" | "next") {
    const sign: 1 | -1 = direction === "next" ? 1 : -1;
    setMove({ kind: "step", direction: sign });

    if (scope === "day") {
      const target = shiftIsoDate(selectedDayIso, sign);
      if (daysByIso.has(target)) setSelectedDayIso(target);
      else navigateTo(resolveWeekStartIso(target), target);
      return;
    }

    if (scope === "week") {
      const weekdayIndex = Math.max(
        0,
        week.days.findIndex((day) => day.isoDate === selectedDayIso),
      );
      const weekStart = sign === 1 ? week.nextWeek : week.previousWeek;
      navigateTo(weekStart, shiftIsoDate(weekStart, weekdayIndex));
      return;
    }

    const targetMonthStart = shiftMonthStartIso(selectedMonthStart, sign);
    navigateTo(resolveWeekStartIso(targetMonthStart), targetMonthStart);
  }

  function jumpTo(dayIso: string) {
    const sign: 1 | -1 | 0 = dayIso > selectedDayIso ? 1 : dayIso < selectedDayIso ? -1 : 0;
    setMove({ kind: "jump", direction: sign === 0 ? 1 : sign });

    if (daysByIso.has(dayIso)) {
      setSelectedDayIso(dayIso);
      return;
    }

    navigateTo(resolveWeekStartIso(dayIso), dayIso);
  }

  function goToToday() {
    if (atToday) return;
    jumpTo(week.todayIso);
  }

  function pickMonth(month: string) {
    jumpTo(`${month}-01`);
  }

  function openDay(isoDate: string) {
    setMove({ kind: "zoom", direction: "in" });
    if (daysByIso.has(isoDate)) zoomToDay(isoDate);
    else navigateTo(resolveWeekStartIso(isoDate), isoDate, { scope: "day" });
  }

  function openWeekOf(weekStart: string) {
    setMove({ kind: "zoom", direction: "in" });
    if (weekStart === week.weekStart) {
      openWeek("agenda");
      return;
    }
    navigateTo(weekStart, weekStart, { scope: "week", lens: "agenda" });
  }

  /* ------------------------------------------------------------------------------------------ */
  /* Mutations                                                                                  */
  /* ------------------------------------------------------------------------------------------ */

  function refreshWithResult(result: TimeTrackingActionState) {
    setNotice(
      result.status === "success"
        ? { tone: "success", message: result.message }
        : { tone: "error", message: result.message },
    );

    if (result.status === "success") router.refresh();
  }

  function runAction(action: () => Promise<TimeTrackingActionState>) {
    startTransition(async () => {
      refreshWithResult(await action());
    });
  }

  function editEntryById(entryId: string) {
    const entry = week.entries.find((candidate) => candidate.id === entryId);
    if (entry) setEntryModal({ mode: "edit", entry });
  }

  /**
   * Delete is undoable for six seconds (§5.8, A2). The card leaves through its exit transition, a
   * toast offers Undo, and Undo is a real restore — a second audited write — so nothing is held
   * back waiting on a timer.
   */
  function deleteEntryById(entryId: string) {
    startTransition(async () => {
      const result = await deleteTimeEntryAction({ timeEntryId: entryId });

      if (result.status !== "success") {
        setNotice({ tone: "error", message: result.message });
        return;
      }

      router.refresh();
      notify("info", t("undo.deleted"), {
        duration: UNDO_TOAST_MS,
        action: {
          label: t("undo.action"),
          onClick: () => {
            startTransition(async () => {
              const restored = await restoreTimeEntryAction({ timeEntryId: entryId });
              if (restored.status === "success") {
                router.refresh();
                notify("success", t("undo.restored"));
              } else {
                notify("error", restored.message);
              }
            });
          },
        },
      });
    });
  }

  /** Continue (A3 / C2): a timer with this entry's project and description, one press. */
  function continueEntry(entry: EntryCardEntry) {
    const source = week.entries.find((candidate) => candidate.id === entry.id);
    if (!source) return;
    runAction(() =>
      startRunningTimerAction({ projectId: source.projectId, description: source.description }),
    );
  }

  function toggleTimer() {
    if (week.runningTimer) {
      runAction(stopRunningTimerAction);
      return;
    }
    if (projectRows.length) setTimerOpen(true);
  }

  function saveDeclaration(input: { projectId: string; minutes: number; note: string }) {
    setDeclarationState({
      projectId: input.projectId,
      saving: true,
      uploading: false,
      savedAt: null,
      error: null,
    });

    startTransition(async () => {
      const result = await saveMonthlyHourDeclarationAction({
        projectId: input.projectId,
        periodStart: selectedMonthStart,
        minutes: input.minutes,
        note: input.note,
      });

      setDeclarationState({
        projectId: input.projectId,
        saving: false,
        uploading: false,
        savedAt: result.status === "success" ? Date.now() : null,
        error: result.status === "success" ? null : result.message,
      });

      if (result.status === "success") router.refresh();
      else setNotice({ tone: "error", message: result.message });
    });
  }

  function uploadDeclarationProof(input: { projectId: string; file: File }) {
    setDeclarationState({
      projectId: input.projectId,
      saving: false,
      uploading: true,
      savedAt: null,
      error: null,
    });

    startTransition(async () => {
      const formData = new FormData();
      formData.set("projectId", input.projectId);
      formData.set("periodStart", selectedMonthStart);
      formData.set("proofFile", input.file);

      const result = await uploadDeclarationProofAction({ status: "idle", message: "" }, formData);

      setDeclarationState({
        projectId: input.projectId,
        saving: false,
        uploading: false,
        savedAt: null,
        error: result.status === "success" ? null : result.message,
      });

      if (result.status === "success") {
        setNotice({ tone: "success", message: result.message });
        router.refresh();
      }
    });
  }

  function confirmQuickAction() {
    const action = pendingQuickAction;
    if (!action) return;

    setPendingQuickAction(null);
    setPendingHighlight(null);

    if (action.type === "copyPreviousDay") {
      runAction(() => copyPreviousDayEntriesAction({ targetDate: action.targetDate }));
      return;
    }

    runAction(() => duplicatePreviousWeekAction({ weekStartDate: action.targetWeekStart }));
  }

  function requestCopyPreviousDay(target = targetDate) {
    setPendingQuickAction({
      type: "copyPreviousDay",
      sourceDate: shiftIsoDate(target, -1),
      targetDate: target,
    });
  }

  function requestDuplicatePreviousWeek() {
    setPendingQuickAction({
      type: "duplicatePreviousWeek",
      sourceWeekStart: shiftIsoDate(week.weekStart, -7),
      sourceWeekEnd: shiftIsoDate(week.weekStart, -1),
      targetWeekStart: week.weekStart,
      targetWeekEnd: week.weekEnd,
    });
  }

  function handleCellCommit(project: TimeGridAssignedProject, day: TimeGridDay, rawValue: string) {
    const parsedMinutes = parseDurationToMinutes(rawValue);
    const cell = getCellEntries(entriesByCell, project.projectId, day.isoDate);

    if (parsedMinutes === null) {
      setNotice({ tone: "error", message: t("errors.invalidDurationFormat") });
      return;
    }

    if (parsedMinutes <= 0) {
      if (cell.entries.length === 1 && !cell.entries[0].locked) {
        deleteEntryById(cell.entries[0].id);
      }
      return;
    }

    if (parsedMinutes > DAILY_HARD_LIMIT_MINUTES) {
      setNotice({ tone: "error", message: t("warnings.durationOver24Blocked") });
      return;
    }

    if (cell.entries.length === 0) {
      setEntryModal({
        mode: "create",
        source: "GRID",
        projectId: project.projectId,
        localDate: day.isoDate,
        durationMinutes: parsedMinutes,
        prefill: true,
      });
      return;
    }

    const entry = cell.entries[0];

    if (cell.entries.length === 1 && isSimpleDurationEntry(entry) && !entry.locked) {
      setPendingHighlight({ type: "entry", id: entry.id });
      runAction(() =>
        updateTimeEntryAction({
          timeEntryId: entry.id,
          durationMinutes: parsedMinutes,
        }),
      );
      return;
    }

    setBreakdown({ projectId: project.projectId, localDate: day.isoDate });
  }

  function toggleInactive(project: TimeGridAssignedProject, inactive: boolean) {
    runAction(() =>
      inactive
        ? unmarkInactiveProjectWeekAction({
            projectId: project.projectId,
            weekStartDate: week.weekStart,
          })
        : markInactiveProjectWeekAction({
            projectId: project.projectId,
            weekStartDate: week.weekStart,
          }),
    );
  }

  function restoreEntryDraft() {
    const draft = week.entryDraft;
    const fallbackProject = projectRows[0];
    if (!draft || !fallbackProject) return;

    const projectId = projectsById.has(draft.payload.projectId)
      ? draft.payload.projectId
      : fallbackProject.projectId;
    const durationMinutes = parseDurationToMinutes(draft.payload.durationText) ?? 60;

    setEntryModal({
      mode: "create",
      source: draft.payload.source,
      projectId,
      localDate: draft.payload.localDate,
      durationMinutes,
      durationText: draft.payload.durationText,
      description: draft.payload.description,
      timingMode: draft.payload.timingMode,
      startTime: draft.payload.startTime,
      endTime: draft.payload.endTime,
      prefill: draft.payload.prefill,
      draftKey: draft.draftKey,
    });
  }

  function discardEntryDraft() {
    const draft = week.entryDraft;
    if (!draft) return;

    runAction(() => clearTimeEntryDraftAction({ draftKey: draft.draftKey }));
  }

  /* ------------------------------------------------------------------------------------------ */
  /* The quick composer                                                                         */
  /* ------------------------------------------------------------------------------------------ */

  /** The chip the composer shows selected: what was picked, or the first chip when that is gone. */
  const effectiveComposerValue: QuickEntryComposerValue = {
    ...composerValue,
    projectId: projectsById.has(composerValue.projectId)
      ? composerValue.projectId
      : (composerProjects[0]?.projectId ?? ""),
  };
  /** The Day rail's composer is open whenever the rail is; there is no state to open it. */
  const railComposerOpen =
    scope === "day" && desktop && projectRows.length > 0 && !(selectedDay?.locked ?? false);
  const composerOpenFor = composer?.localDate ?? (railComposerOpen ? targetDate : null);

  function openComposer(localDate: string, anchor: ComposerAnchor) {
    if (!composerProjects.length) return;

    setComposerError(null);
    setComposerDraftStatus("idle");
    setComposerValue((current) => ({ ...current, durationText: "", description: "" }));
    setComposer({ localDate, anchor });
  }

  function updateComposerValue(next: QuickEntryComposerValue) {
    setComposerValue(next);
    setComposerError(null);
    setComposerDraftStatus(next.description.trim() ? "saving" : "idle");
  }

  /** `N`: the composer for the selected day, wherever it lives at this scope and width. */
  function compose() {
    if (!projectRows.length || !selectedDay || selectedDay.locked) return;
    if (!desktop) {
      openComposer(targetDate, "sheet");
      return;
    }
    if (scope === "week" && lens === "agenda") {
      openComposer(targetDate, "column");
      return;
    }
    if (scope === "day") {
      setRailFocusToken((current) => current + 1);
      return;
    }
    setEntryModal({
      mode: "create",
      source: "FORM",
      projectId: effectiveComposerValue.projectId || projectRows[0].projectId,
      localDate: targetDate,
      durationMinutes: 60,
    });
  }

  function closeComposer() {
    setComposer(null);
    setComposerError(null);
  }

  /**
   * A half-typed entry survives a stray click, the same way the dialog's does (§15.8). The effect
   * only schedules the save; "saving" is set where the typing happens and "saved" when the write
   * comes back.
   */
  const draftProjectId = effectiveComposerValue.projectId;
  const draftDescription = composerValue.description;
  const draftDurationText = composerValue.durationText;

  useEffect(() => {
    if (!composerOpenFor || !draftDescription.trim() || !draftProjectId) return;

    let cancelled = false;
    const timerId = window.setTimeout(() => {
      void saveTimeEntryDraftAction({
        draftKey: TIME_ENTRY_FORM_DRAFT_KEY,
        payload: {
          kind: "time-entry-form",
          version: 1,
          source: "FORM",
          projectId: draftProjectId,
          localDate: composerOpenFor,
          timingMode: "DURATION",
          durationText: draftDurationText,
          startTime: "09:00",
          endTime: "10:00",
          description: draftDescription,
        },
      }).then((result) => {
        if (cancelled) return;
        setComposerDraftStatus(result.status === "success" ? "saved" : "idle");
      });
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [composerOpenFor, draftDescription, draftDurationText, draftProjectId]);

  function submitComposer(
    localDate: string,
    value: QuickEntryComposerValue & { durationMinutes: number },
  ) {
    startTransition(async () => {
      const result = await createTimeEntryAction({
        projectId: value.projectId,
        localDate,
        description: value.description,
        source: "FORM",
        timingMode: "DURATION",
        durationMinutes: value.durationMinutes,
        startTime: null,
        endTime: null,
      });

      if (result.status !== "success") {
        setComposerError(result.message);
        return;
      }

      setPendingHighlight({ type: "new" });
      /* The refresh below is what makes this description a real suggestion. Until it lands the
         composer may already be open again, so it is remembered locally too (§7). */
      descriptionSuggestions.remember(value.projectId, value.description);
      await clearTimeEntryDraftAction({ draftKey: TIME_ENTRY_FORM_DRAFT_KEY });
      setComposerValue((current) => ({ ...current, durationText: "", description: "" }));
      setComposerDraftStatus("idle");
      setComposer(null);
      setNotice({ tone: "success", message: result.message });
      router.refresh();
    });
  }

  /** `More options`: the full dialog, with what was typed carried over. */
  function expandComposer(localDate: string, timingMode: "DURATION" | "INTERVAL") {
    const minutes = parseDurationToMinutes(composerValue.durationText);

    setEntryModal({
      mode: "create",
      source: "FORM",
      projectId: effectiveComposerValue.projectId || projectRows[0]?.projectId || "",
      localDate,
      durationMinutes: minutes && minutes > 0 ? minutes : 60,
      durationText: composerValue.durationText || undefined,
      description: composerValue.description || undefined,
      timingMode,
    });
    closeComposer();
  }

  function renderComposer(
    localDate: string,
    autoFocus: "duration" | "description" | null = "duration",
    focusToken?: number,
  ) {
    return (
      <QuickEntryComposer
        projects={composerProjects}
        value={effectiveComposerValue}
        suggestions={descriptionSuggestions.optionsFor(effectiveComposerValue.projectId)}
        pending={isPending}
        error={composerError}
        autoFocus={autoFocus}
        focusToken={focusToken}
        footnote={
          composerDraftStatus === "saving"
            ? t("draft.saving")
            : composerDraftStatus === "saved"
              ? t("draft.saved")
              : null
        }
        labels={{
          title: t("composer.title", {
            date: formatDateLabel(localDate, locale, { style: "short" }),
          }),
          project: t("composer.project"),
          duration: t("composer.duration"),
          durationPlaceholder: t("composer.durationPlaceholder"),
          description: t("composer.description"),
          descriptionPlaceholder: t("fields.descriptionPlaceholder"),
          more: t("composer.more"),
          interval: t("composer.interval"),
          add: t("composer.add"),
          submitHint: t("composer.submitHint"),
          invalidDuration: t("errors.invalidDurationFormat"),
          descriptionRequired: t("composer.descriptionRequired"),
          noProject: t("composer.noProject"),
          suggestions: descriptionSuggestions.labels,
        }}
        onValueChange={updateComposerValue}
        onSubmit={(value) => submitComposer(localDate, value)}
        onMoreOptions={() => expandComposer(localDate, "DURATION")}
        onInterval={() => expandComposer(localDate, "INTERVAL")}
      />
    );
  }

  /* ------------------------------------------------------------------------------------------ */
  /* First-visit hint                                                                           */
  /* ------------------------------------------------------------------------------------------ */

  useEffect(() => {
    if (!hasAssignments) return;
    try {
      if (window.localStorage.getItem(FIRST_VISIT_HINT_KEY)) return;
      window.localStorage.setItem(FIRST_VISIT_HINT_KEY, new Date().toISOString());
    } catch {
      return;
    }
    notify("info", t("hint.firstVisit"), {
      duration: 8_000,
      action: { label: t("hint.dismiss"), onClick: () => {} },
    });
  }, [hasAssignments, t]);

  /* ------------------------------------------------------------------------------------------ */
  /* View-models                                                                                */
  /* ------------------------------------------------------------------------------------------ */

  function describeEntry(entry: TimeGridEntry): EntryCardEntry {
    const project = projectsById.get(entry.projectId);

    return {
      id: entry.id,
      projectName: project?.name ?? t("labels.archivedProject"),
      projectColor: project?.color ?? "var(--muted-foreground)",
      description: entry.description,
      durationMinutes: entry.durationMinutes,
      startTime: entry.startTime,
      endTime: entry.endTime,
      timed: entry.source === "TIMER",
      locked: entry.locked,
      adminModified: Boolean(entry.adminModification),
      warnings: getEntryWarnings(entry, entriesByDay.get(entry.localDate) ?? [], t),
    };
  }

  const dayAgendaEntries: DayAgendaEntry[] = selectedDayEntries.map((entry) => {
    const described = describeEntry(entry);
    const { adminModification } = entry;

    return {
      ...described,
      warnings:
        selectedDay?.state === "future"
          ? [...described.warnings, t("warnings.futureDate")]
          : described.warnings,
      adminNotice: adminModification
        ? {
            changedBy: t("adminModification.changedBy", {
              name: adminModification.modifiedByName ?? t("adminModification.adminFallback"),
              date: formatAdminModifiedAt(adminModification, locale),
            }),
            reason: t("adminModification.reason", { reason: adminModification.reason }),
          }
        : null,
    };
  });

  const daySplit = projectRows
    .map((project) => ({
      projectId: project.projectId,
      name: project.name,
      color: project.color,
      minutes: getCellEntries(entriesByCell, project.projectId, targetDate).totalMinutes,
    }))
    .filter((item) => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  const weekAgendaDays: WeekAgendaDay[] = days.map((day) => ({
    ...day,
    entries: (entriesByDay.get(day.isoDate) ?? []).map(describeEntry),
    canCopyPreviousDay: (entriesByDay.get(shiftIsoDate(day.isoDate, -1))?.length ?? 0) > 0,
  }));

  const runningTimerView = week.runningTimer
    ? {
        projectName: week.runningTimer.projectName,
        projectColor: week.runningTimer.projectColor,
        description: week.runningTimer.description,
      }
    : null;
  const elapsedLabel = useElapsedLabel(week.runningTimer?.startedAt ?? null);

  const cardLabels = {
    edit: (entry: EntryCardEntry) => t("week.editEntryNamed", { entry: entry.description }),
    delete: (entry: EntryCardEntry) => t("week.deleteEntryNamed", { entry: entry.description }),
    continue: (entry: EntryCardEntry) => t("card.continue", { description: entry.description }),
    adminModified: t("week.adminModified"),
    timed: t("card.timer"),
    locked: t("card.locked"),
  };
  const timerLabels = { live: t("card.live"), stop: t("timer.stopTimer") };
  const capacityLabel = (day: TimeZoomDay) =>
    t("week.capacity", {
      logged: formatMinutesWithUnit(day.totalMinutes),
      target: targetLabel,
    });
  const overLabel = t("header.over", { target: targetLabel });

  const handoff =
    declaredProjects.length && projectRows.length ? (
      <p>
        {declaredProjects.length === 1
          ? t.rich("month.declaredElsewhere", {
              project: declaredProjects[0]?.name ?? "",
              link: (chunks) => (
                <button
                  type="button"
                  className="font-medium text-accent underline underline-offset-2"
                  onClick={() => changeScope("month")}
                >
                  {chunks}
                </button>
              ),
            })
          : t.rich("month.declaredElsewhereMany", {
              count: declaredProjects.length,
              link: (chunks) => (
                <button
                  type="button"
                  className="font-medium text-accent underline underline-offset-2"
                  onClick={() => changeScope("month")}
                >
                  {chunks}
                </button>
              ),
            })}
      </p>
    ) : null;

  const shortcutGroups = [
    {
      id: "view",
      title: t("shortcuts.groupView"),
      rows: [
        ...stops.map((stop) => ({
          keys: [String(stops.indexOf(stop) + 1)],
          label: t(`shortcuts.${stop}`),
        })),
        { keys: ["−"], label: t("shortcuts.zoomOut") },
        { keys: ["+"], label: t("shortcuts.zoomIn") },
        { keys: ["Esc"], label: t("shortcuts.escape") },
        ...(stops.includes("week") ? [{ keys: ["G"], label: t("shortcuts.grid") }] : []),
      ],
    },
    {
      id: "move",
      title: t("shortcuts.groupMove"),
      rows: [
        { keys: ["K", "["], label: t("shortcuts.previous", { unit: periodUnit }) },
        { keys: ["J", "]"], label: t("shortcuts.next", { unit: periodUnit }) },
        { keys: ["T"], label: t("shortcuts.today") },
      ],
    },
    {
      id: "add",
      title: t("shortcuts.groupAdd"),
      rows: [
        { keys: ["N"], label: t("shortcuts.newEntry") },
        { keys: ["?"], label: t("shortcuts.help") },
        { keys: ["⌘K"], label: t("shortcuts.palette") },
      ],
    },
    {
      id: "timer",
      title: t("shortcuts.groupTimer"),
      rows: [{ keys: ["S"], label: t("shortcuts.timer") }],
    },
  ];

  function handleCommand(command: TimeCommand) {
    switch (command.type) {
      case "today":
        goToToday();
        break;
      case "scope":
        changeScope(command.scope);
        break;
      case "lens":
        if (scope === "week") changeLens(command.lens);
        else {
          setMove({
            kind: "zoom",
            direction: stops.indexOf("week") < stops.indexOf(scope) ? "in" : "out",
          });
          openWeek(command.lens);
        }
        break;
      case "compose":
        compose();
        break;
      case "timer":
        toggleTimer();
        break;
      case "duplicateWeek":
        requestDuplicatePreviousWeek();
        break;
      case "copyYesterday":
        requestCopyPreviousDay();
        break;
      case "shortcuts":
        setShortcutsOpen(true);
        break;
    }
  }

  const breakdownProject = breakdown
    ? projectRows.find((project) => project.projectId === breakdown.projectId)
    : undefined;
  const breakdownDay = breakdown
    ? week.days.find((day) => day.isoDate === breakdown.localDate)
    : undefined;
  const breakdownEntries =
    breakdown && breakdownProject
      ? getCellEntries(entriesByCell, breakdown.projectId, breakdown.localDate).entries
      : [];

  const canZoomIn = stepScope(scope, "in", stops) !== scope;
  const canZoomOut = stepScope(scope, "out", stops) !== scope;
  const nextIn = stepScope(scope, "in", stops);
  const nextOut = stepScope(scope, "out", stops);

  /* ------------------------------------------------------------------------------------------ */
  /* Rows 1 and 2                                                                               */
  /* ------------------------------------------------------------------------------------------ */

  const actions = desktop ? (
    <>
      <TimerControl
        runningTimer={week.runningTimer}
        disabled={isPending}
        canStart={projectRows.length > 0}
        onStart={() => setTimerOpen(true)}
        onStop={() => runAction(stopRunningTimerAction)}
      />
      <Button
        type="button"
        variant="cta"
        icon={Plus}
        disabled={!projectRows.length || isPending}
        onClick={() =>
          setEntryModal({
            mode: "create",
            source: "FORM",
            projectId: composerProjects[0]?.projectId ?? projectRows[0]?.projectId ?? "",
            localDate: targetDate,
            durationMinutes: 60,
          })
        }
      >
        {t("actions.newEntry")}
      </Button>
    </>
  ) : null;

  const moreMenu =
    projectRows.length > 0 ? (
      <Dropdown>
        <DropdownTrigger asChild>
          <button
            type="button"
            aria-label={t("actions.more")}
            className="grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors duration-[var(--duration-micro)] hover:bg-secondary hover:text-foreground"
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>
        </DropdownTrigger>
        <DropdownContent align="end">
          <DropdownItem
            disabled={isPending || weekHasLockedPeriod}
            onSelect={requestDuplicatePreviousWeek}
          >
            <Copy className="size-4" aria-hidden="true" />
            {t("actions.duplicateLastWeek")}
          </DropdownItem>
          <DropdownItem
            disabled={isPending || !selectedDay || selectedDay.locked}
            onSelect={() => requestCopyPreviousDay()}
          >
            <Copy className="size-4" aria-hidden="true" />
            {t("actions.copyYesterdayInto", {
              day: selectedDay ? (daysByIso.get(selectedDay.isoDate)?.label ?? "") : "",
            })}
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem onSelect={() => setShortcutsOpen(true)}>
            <Keyboard className="size-4" aria-hidden="true" />
            {t("shortcuts.open")}
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
    ) : null;

  const toolbar = (
    <div className="grid gap-3">
      {stops.length > 1 ? (
        <TimeScopeBar
          scopes={stops.map((stop) => ({
            value: stop,
            label: t(`view.${stop}`),
            shortcut: String(stops.indexOf(stop) + 1),
            badge:
              stop === "month" && declaredProjects.length && projectRows.length && scope !== "month"
                ? t("view.monthBadge")
                : undefined,
          }))}
          scope={scope}
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          lenses={[
            { value: "agenda", label: t("lens.agenda"), icon: ListIcon, shortcut: "G" },
            { value: "grid", label: t("lens.grid"), icon: GridIcon, shortcut: "G" },
          ]}
          lens={lens}
          lensVisible={scope === "week" && projectRows.length > 0}
          labels={{
            view: t("view.label"),
            zoomIn: canZoomIn
              ? t("view.zoomIn", { scope: t(`view.${nextIn}`) })
              : t("view.zoomInMost"),
            zoomOut: canZoomOut
              ? t("view.zoomOut", { scope: t(`view.${nextOut}`) })
              : t("view.zoomOutMost"),
            lens: t("lens.label"),
          }}
          shortcuts={{ zoomIn: "+", zoomOut: "−" }}
          density={desktop ? "comfortable" : "compact"}
          actions={actions}
          disabled={isPending}
          onScopeChange={(value) => changeScope(value as TimeScope)}
          onLensChange={(value) => changeLens(value as WeekLens)}
          onZoom={(direction) => changeScope(stepScope(scope, direction, stops))}
        />
      ) : desktop && actions ? (
        <div className="flex justify-end gap-2">{actions}</div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <PeriodNavigator
          label={periodLabel}
          periodKey={periodStart}
          direction={move?.kind === "step" || move?.kind === "jump" ? move.direction : 0}
          atToday={atToday}
          month={selectedMonthStart.slice(0, 7)}
          locale={locale}
          labelRef={periodLabelRef}
          labels={{
            previous: t("period.previous", { unit: periodUnit }),
            next: t("period.next", { unit: periodUnit }),
            today: t("period.today"),
            atToday: t("period.atToday"),
            pick: t("period.pick"),
            monthPicker: pickerLabels.month,
          }}
          shortcuts={{ previous: "K", next: "J", today: "T" }}
          menu={moreMenu}
          disabled={isPending}
          onPrevious={() => stepPeriod("previous")}
          onNext={() => stepPeriod("next")}
          onToday={goToToday}
          onPickMonth={pickMonth}
        />
        <PeriodTotal
          figure={formatMinutesAsHours(periodTotalMinutes)}
          unit={durationDisplayFormat === "DECIMAL_HOURS" ? "h" : undefined}
          caption={t(
            scope === "day" ? "total.today" : scope === "week" ? "total.week" : "total.month",
          )}
          minutes={periodTotalMinutes}
          status={totalStatus}
          secondary={
            scope === "month"
              ? t("heat.workdays", { logged: workdays.logged, workdays: workdays.workdays })
              : null
          }
          align={desktop ? "end" : "start"}
        />
      </div>
    </div>
  );

  /* ------------------------------------------------------------------------------------------ */
  /* Content per scope                                                                          */
  /* ------------------------------------------------------------------------------------------ */

  const content =
    scope === "day" ? (
      <DayAgenda
        isoDate={targetDate}
        dayState={selectedDay?.state ?? "normal"}
        totalMinutes={selectedDayTotalMinutes}
        capacityMinutes={DAILY_SOFT_WARNING_MINUTES}
        entries={dayAgendaEntries}
        split={daySplit}
        locale={locale}
        durationDisplayFormat={durationDisplayFormat}
        disabled={isPending}
        locked={selectedDay?.locked ?? false}
        animateEntries={animateEntries}
        runningTimer={runningTimerView ? { ...runningTimerView, elapsedLabel } : null}
        highlight={highlight}
        canContinue={!week.runningTimer}
        canCopyPreviousDay={(entriesByDay.get(shiftIsoDate(targetDate, -1))?.length ?? 0) > 0}
        composer={railComposerOpen ? renderComposer(targetDate, null, railFocusToken) : undefined}
        labels={{
          futureDay: t("warnings.futureDateAllowed"),
          overCapacity: t("warnings.dayOver8"),
          emptyTitle: t("day.emptyTitle"),
          emptyDescription: t("day.emptyDescription"),
          addEntry: t("actions.addEntry"),
          copyYesterday: t("empty.copyYesterday"),
          glance: t("day.glance"),
          target: t("day.target", { target: targetLabel }),
          over: t("total.overTarget", { target: targetLabel }),
          split: t("day.split"),
          noSplit: t("day.noSplit"),
          quickAdd: t("day.quickAdd"),
          card: cardLabels,
          timer: timerLabels,
        }}
        onAddEntry={(iso) =>
          desktop ? setRailFocusToken((current) => current + 1) : openComposer(iso, "sheet")
        }
        onEditEntry={(entry) => editEntryById(entry.id)}
        onDeleteEntry={(entry) => deleteEntryById(entry.id)}
        onContinueEntry={continueEntry}
        onCopyPreviousDay={(iso) => requestCopyPreviousDay(iso)}
        onStopTimer={() => runAction(stopRunningTimerAction)}
      />
    ) : scope === "week" && lens === "agenda" ? (
      <WeekAgenda
        days={weekAgendaDays}
        selectedDayIso={targetDate}
        capacityMinutes={DAILY_SOFT_WARNING_MINUTES}
        layout={desktop ? "columns" : "accordion"}
        locale={locale}
        durationDisplayFormat={durationDisplayFormat}
        disabled={isPending}
        animateEntries={animateEntries}
        runningTimer={runningTimerView ? { ...runningTimerView, elapsedLabel } : null}
        highlight={highlight}
        canContinue={!week.runningTimer}
        canDuplicatePreviousWeek={!weekHasLockedPeriod}
        composerDayIso={desktop && composer?.anchor === "column" ? composer.localDate : null}
        renderComposer={(day) => renderComposer(day.isoDate)}
        footnote={handoff}
        labels={{
          openDay: (day) => t("header.open", { date: `${day.label}, ${day.dayNumber}` }),
          expandDay: (day) => t("week.expandDay", { day: day.label }),
          capacity: capacityLabel,
          over: overLabel,
          locked: t("header.locked"),
          today: t("header.today"),
          columnEmpty: t("week.columnEmpty"),
          copyYesterday: t("empty.copyYesterday"),
          addEntry: (day) => t("week.addEntryOn", { day: day.label }),
          emptyWeekTitle: t("empty.weekTitle"),
          emptyWeekDescription: t("empty.weekDescription"),
          addEntryPlain: t("actions.addEntry"),
          duplicateLastWeek: t("actions.duplicateLastWeek"),
          card: cardLabels,
          timer: timerLabels,
        }}
        onSelectDay={setSelectedDayIso}
        onOpenDay={openDay}
        onAddEntry={(iso) => (desktop ? openComposer(iso, "column") : openComposer(iso, "sheet"))}
        onComposerOpenChange={(iso, open) => {
          if (!open && composer?.anchor === "column" && composer.localDate === iso) closeComposer();
        }}
        onEditEntry={(entry) => editEntryById(entry.id)}
        onDeleteEntry={(entry) => deleteEntryById(entry.id)}
        onContinueEntry={continueEntry}
        onCopyPreviousDay={(iso) => requestCopyPreviousDay(iso)}
        onDuplicatePreviousWeek={requestDuplicatePreviousWeek}
        onStopTimer={() => runAction(stopRunningTimerAction)}
      />
    ) : scope === "week" ? (
      <WeekGridLens
        days={days}
        projects={projectRows}
        declaredProjects={declaredProjects}
        inactiveProjectIds={inactiveProjectIds}
        entriesByCell={entriesByCell}
        entriesByDay={entriesByDay}
        dailyTotals={dailyTotals}
        weekTotal={weekTotal}
        weekHasLockedPeriod={weekHasLockedPeriod}
        layout={desktop ? "table" : "stack"}
        disabled={isPending}
        animateRows={animateEntries}
        onOpenDay={openDay}
        onCellCommit={handleCellCommit}
        onOpenBreakdown={(projectId, localDate) => setBreakdown({ projectId, localDate })}
        onCreateFromCell={(project, day) =>
          setEntryModal({
            mode: "create",
            source: "GRID",
            projectId: project.projectId,
            localDate: day.isoDate,
            durationMinutes: 60,
            prefill: true,
          })
        }
        onToggleInactive={toggleInactive}
        onSeeMonth={() => changeScope("month")}
      />
    ) : (
      <MonthOverview
        projects={monthProjects}
        declared={declaredRows}
        monthLocked={monthLocked}
        locale={locale}
        durationDisplayFormat={durationDisplayFormat}
        disabled={isPending}
        animateRows={animateEntries}
        navigator={
          projectRows.length ? (
            <MonthHeatNavigator
              weeks={heatWeeks}
              weekdayLabels={days.map((day) => day.shortLabel)}
              selectedWeekStart={week.weekStart}
              selectedDayIso={selectedDayIso}
              capacityMinutes={DAILY_SOFT_WARNING_MINUTES}
              locked={monthLocked}
              formatMinutes={formatMinutesWithUnit}
              animate={animateEntries}
              disabled={isPending}
              labels={{
                grid: t("heat.label", { month: monthLabel }),
                openWeek: (heatWeek) => t("heat.openWeek", { week: heatWeek.weekNumber }),
                weekRow: (heatWeek) => `W${heatWeek.weekNumber}`,
                cell: (day) =>
                  t("heat.cell", {
                    date: formatDateLabel(day.isoDate, locale, { style: "full" }),
                    hours: formatMinutesWithUnit(day.minutes),
                  }),
                empty: (day) =>
                  t("heat.empty", {
                    date: formatDateLabel(day.isoDate, locale, { style: "full" }),
                  }),
                future: (day) =>
                  t("heat.future", {
                    date: formatDateLabel(day.isoDate, locale, { style: "full" }),
                  }),
                outside: (day) =>
                  t("heat.outside", {
                    date: formatDateLabel(day.isoDate, locale, { style: "full" }),
                  }),
                detail: (day) =>
                  t("heat.cellDetail", {
                    hours: formatMinutesWithUnit(day.minutes),
                    count: day.entryCount,
                  }),
                locked: t("heat.locked"),
                legendLogged: t("heat.legendLogged"),
                legendEmpty: t("heat.legendEmpty"),
                legendFuture: t("heat.legendFuture"),
              }}
              onSelectDay={openDay}
              onSelectWeek={openWeekOf}
            />
          ) : undefined
        }
        labels={{
          trackedHeading: t("month.trackedHeading"),
          declaredHeading: t("month.declaredHeading"),
          zoomToProject: (project) => t("zoom.zoomToProject", { project: project.name }),
          emptyTitle: t("month.emptyTitle"),
          emptyDescription: t("month.emptyDescription"),
          declared: {
            hoursLabel: (project) => t("declared.hoursLabel", { project: project.name }),
            hoursPlaceholder: t("declared.hoursPlaceholder"),
            hoursHint: t("declared.hoursHint"),
            noteLabel: (project) => t("declared.noteLabel", { project: project.name }),
            notePlaceholder: t("declared.notePlaceholder"),
            noteRequired: t("declared.noteRequired"),
            proofLabel: t("declared.proofLabel"),
            proofUpload: t("declared.proofUpload"),
            proofReplace: t("declared.proofReplace"),
            proofView: t("declared.proofView"),
            proofMissing: t("declared.proofMissing"),
            proofNeedsHours: t("declared.proofNeedsHours"),
            proofUploading: t("declared.proofUploading"),
            save: t("declared.save"),
            saving: t("declared.saving"),
            saved: t("declared.saved"),
            locked: t("declared.locked"),
            nothingDeclared: t("declared.nothingDeclared"),
            externalSystem: t("declared.externalSystem"),
          },
        }}
        onSaveDeclaration={saveDeclaration}
        onUploadProof={uploadDeclarationProof}
        /* A pure scope change, not a filter: the Grid lens of the week the month is anchored on. */
        onZoomToProject={() => {
          setMove({ kind: "zoom", direction: "in" });
          openWeek("grid");
        }}
      />
    );

  const fabVisible = hasAssignments && projectRows.length > 0 && !desktop;

  return (
    /* Room under the last card for the FAB on a phone, so nothing ends up permanently behind it. */
    <div className={cn("grid gap-4", fabVisible && "pb-20")}>
      {notice ? (
        <div
          className={cn(
            "flex items-center gap-2 rounded-[var(--radius-md)] border px-4 py-3 text-sm font-medium",
            notice.tone === "success"
              ? "border-success/35 bg-success-soft text-success"
              : "border-destructive/35 bg-destructive-soft text-destructive",
          )}
          role="status"
        >
          {notice.tone === "success" ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <AlertTriangle className="size-4" aria-hidden="true" />
          )}
          {notice.message}
        </div>
      ) : null}

      {adminModifiedEntryCount > 0 ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-accent-line bg-accent-soft px-4 py-3 text-sm text-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <span className="font-semibold">
              {t("adminModification.weekTitle", { count: adminModifiedEntryCount })}
            </span>{" "}
            <span className="text-muted-foreground">{t("adminModification.weekDescription")}</span>
          </div>
        </div>
      ) : null}

      {weekHasLockedPeriod ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <span className="font-semibold">{t("locked.title")}</span> {t("locked.description")}
          </div>
        </div>
      ) : null}

      {week.entryDraft && !entryModal && projectRows.length ? (
        <DraftRestoreBanner
          updatedAt={week.entryDraft.updatedAt}
          onDiscard={discardEntryDraft}
          onRestore={restoreEntryDraft}
        />
      ) : null}

      {hasAssignments ? (
        <TimeZoomShell
          scope={scope}
          lens={lens}
          stops={stops}
          days={days}
          selectedDayIso={selectedDayIso}
          weekStart={week.weekStart}
          viewKey={viewKey}
          move={move}
          announcement={announcement}
          toolbar={toolbar}
          swipeEnabled={!(scope === "week" && lens === "grid")}
          focusFallback={periodLabelRef}
          formatMinutes={formatMinutesWithUnit}
          disabled={isPending}
          ribbonLabels={{
            group: t("zoom.dayStrip"),
            selectDay: (day) => t("zoom.selectDay", { day: day.label }),
            capacity: capacityLabel,
            over: overLabel,
            locked: t("header.locked"),
            today: t("header.today"),
          }}
          onScopeChange={changeScope}
          onSelectDay={(iso) => {
            setMove({ kind: "step", direction: iso > selectedDayIso ? 1 : -1 });
            setSelectedDayIso(iso);
          }}
          onPeriod={stepPeriod}
          onToday={goToToday}
          onToggleLens={toggleLens}
          onCompose={compose}
          onTimer={toggleTimer}
          onHelp={() => setShortcutsOpen(true)}
        >
          {content}
        </TimeZoomShell>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-border bg-card px-6 py-12 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
            <Clock3 className="size-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">{t("empty.title")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {t("empty.description")}
          </p>
        </div>
      )}

      {/* The phone's `+`: a fixed FAB above the bottom bar, opening the composer as a sheet (§9). */}
      {fabVisible ? (
        <button
          type="button"
          aria-label={t("mobile.addEntry")}
          disabled={isPending || (selectedDay?.locked ?? false)}
          className="fixed bottom-24 right-4 z-30 grid size-14 place-items-center rounded-full bg-[linear-gradient(135deg,var(--cta),var(--cta-hover))] text-cta-foreground shadow-cta-glow transition-transform duration-[var(--duration-micro)] active:scale-95 disabled:opacity-50 lg:hidden"
          onClick={() => openComposer(targetDate, "sheet")}
        >
          <Plus className="size-6" aria-hidden="true" />
        </button>
      ) : null}

      <Drawer
        open={composer?.anchor === "sheet"}
        onOpenChange={(open) => {
          if (!open) closeComposer();
        }}
      >
        <DrawerContent
          side="bottom"
          closeLabel={t("composer.close")}
          className="pb-8"
          /* The composer names itself; a description would repeat its title. */
          aria-describedby={undefined}
        >
          <DrawerTitle className="sr-only">
            {composer
              ? t("composer.title", { date: formatDateLabel(composer.localDate, locale) })
              : ""}
          </DrawerTitle>
          {composer?.anchor === "sheet" ? renderComposer(composer.localDate, "duration") : null}
        </DrawerContent>
      </Drawer>

      {hasAssignments ? (
        <TimeCommandPalette
          stops={stops}
          timerRunning={Boolean(week.runningTimer)}
          canCompose={projectRows.length > 0}
          onCommand={handleCommand}
        />
      ) : null}

      <ShortcutSheet
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        groups={shortcutGroups}
        labels={{
          title: t("shortcuts.title"),
          description: t("shortcuts.description"),
          close: t("actions.close"),
          keyHeader: t("shortcuts.keyHeader"),
          actionHeader: t("shortcuts.actionHeader"),
        }}
      />

      <TimerCreateDialog
        projects={projectRows}
        recentProjects={recentProjects}
        suggestions={descriptionSuggestions}
        onStarted={refreshWithResult}
      />

      {entryModal ? (
        <EntryModal
          state={entryModal}
          week={week}
          projects={projectRows}
          suggestions={descriptionSuggestions}
          onClose={() => setEntryModal(null)}
          onDone={(result) => {
            if (result.status === "success") {
              setPendingHighlight(
                entryModal.mode === "create"
                  ? { type: "new" }
                  : { type: "entry", id: entryModal.entry.id },
              );
              setEntryModal(null);
            }
            refreshWithResult(result);
          }}
          t={t}
        />
      ) : null}

      {breakdown && breakdownProject && breakdownDay ? (
        <BreakdownDialog
          day={breakdownDay}
          entries={breakdownEntries}
          entriesByDay={entriesByDay}
          project={breakdownProject}
          onAdd={() => {
            setBreakdown(null);
            setEntryModal({
              mode: "create",
              source: "GRID",
              projectId: breakdownProject.projectId,
              localDate: breakdownDay.isoDate,
              durationMinutes: 60,
              prefill: true,
            });
          }}
          onClose={() => setBreakdown(null)}
          onDelete={(entry) => deleteEntryById(entry.id)}
          onEdit={(entry) => {
            setBreakdown(null);
            setEntryModal({ mode: "edit", entry });
          }}
          t={t}
        />
      ) : null}

      <QuickActionConfirmDialog
        action={pendingQuickAction}
        pending={isPending}
        onCancel={() => setPendingQuickAction(null)}
        onConfirm={confirmQuickAction}
        t={t}
      />
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

function DraftRestoreBanner({
  updatedAt,
  onDiscard,
  onRestore,
}: {
  updatedAt: string;
  onDiscard: () => void;
  onRestore: () => void;
}) {
  const t = useTranslations("TimeTracking");

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card text-accent">
          <Info className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold">{t("draft.title")}</p>
          <p className="text-muted-foreground">
            {t("draft.lastSaved", { time: formatDraftTimestamp(updatedAt) })}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          onClick={onDiscard}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {t("actions.discard")}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-[color-mix(in_srgb,var(--accent)_88%,black)]"
          onClick={onRestore}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          {t("actions.restoreDraft")}
        </button>
      </div>
    </div>
  );
}

type QuickActionConfirmDialogProps = {
  action: PendingQuickAction | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  t: TimeTrackingTranslator;
};

function QuickActionConfirmDialog({
  action,
  pending,
  onCancel,
  onConfirm,
  t,
}: QuickActionConfirmDialogProps) {
  const isCopyPreviousDay = action?.type === "copyPreviousDay";
  const title = isCopyPreviousDay
    ? t("quickActionConfirm.copyPreviousDay.title")
    : t("quickActionConfirm.duplicatePreviousWeek.title");
  const description =
    !action || isCopyPreviousDay
      ? t("quickActionConfirm.copyPreviousDay.description", {
          sourceDate: action?.type === "copyPreviousDay" ? action.sourceDate : "",
          targetDate: action?.type === "copyPreviousDay" ? action.targetDate : "",
        })
      : t("quickActionConfirm.duplicatePreviousWeek.description", {
          sourceWeekEnd: action.sourceWeekEnd,
          sourceWeekStart: action.sourceWeekStart,
          targetWeekEnd: action.targetWeekEnd,
          targetWeekStart: action.targetWeekStart,
        });

  return (
    <Dialog open={Boolean(action)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="rounded-[var(--radius-md)] border border-warning/35 bg-warning-soft px-3 py-2 text-sm text-warning">
          {t("quickActionConfirm.skipExisting")}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
            {t("actions.cancel")}
          </Button>
          <Button type="button" variant="cta" icon={Copy} loading={pending} onClick={onConfirm}>
            {t("quickActionConfirm.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
