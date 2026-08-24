"use client";

import { AlertTriangle, Check, Info, Pencil, RotateCcw, Save } from "lucide-react";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import { Input } from "@/src/components/ui/Input";
import { SectionHead } from "@/src/components/ui/SectionHead";
import { Textarea } from "@/src/components/ui/Textarea";
import type { AppLocale } from "@/src/i18n/locales";
import { addUtcDays, parseDateValue, toDateValue } from "@/src/lib/date-values";
import {
  formatCount,
  formatDateLabel,
  formatHours,
  formatHoursWithUnit,
  formatPeriodRange,
  type DurationDisplayFormat,
} from "@/src/lib/formatting";
import { applyReportLineEdits, type ReportLineEdit } from "@/src/lib/report-line-edits";
import type {
  ReportCostFreeLine,
  ReportExportFields,
  ReportSnapshot,
  ReportView,
} from "@/src/server/reports";

import { ReportExportModal } from "./ReportExportModal";
import { saveReportLineEditsAction } from "./actions";

type ReportWorkspaceProps = {
  snapshot: ReportSnapshot;
  locale: string;
  filters: ReactNode;
  exportFields: ReportExportFields;
  defaultTitles: Record<AppLocale, string>;
  initialLocale: AppLocale;
  timezone: string;
  durationDisplayFormat: DurationDisplayFormat;
};

export function ReportWorkspace({
  snapshot,
  locale,
  filters,
  exportFields,
  defaultTitles,
  initialLocale,
  timezone,
  durationDisplayFormat,
}: ReportWorkspaceProps) {
  const t = useTranslations("AdminReports");
  const [editMode, setEditMode] = useState(false);
  const [edits, setEdits] = useState<Record<string, Omit<ReportLineEdit, "id">>>({});
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveReason, setSaveReason] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const originalLines = useMemo(
    () => new Map(snapshot.lines.map((line) => [line.id, line])),
    [snapshot.lines],
  );
  const lineEdits = useMemo(
    () => Object.entries(edits).map(([id, edit]) => ({ id, ...edit })),
    [edits],
  );
  const workingSnapshot = useMemo(
    () => applyReportLineEdits(snapshot, lineEdits),
    [lineEdits, snapshot],
  );

  function updateDescription(id: string, description: string) {
    setSavedNotice(null);
    const original = originalLines.get(id);
    if (!original) return;

    updateEdit(id, "description", description === original.description ? undefined : description);
  }

  function updateDuration(id: string, hours: number) {
    setSavedNotice(null);
    const original = originalLines.get(id);
    if (!original) return;

    const durationMinutes = Math.min(24 * 60, Math.max(0, Math.round(hours * 60)));
    updateEdit(
      id,
      "durationMinutes",
      durationMinutes === original.durationMinutes ? undefined : durationMinutes,
    );
  }

  function updateEdit<Key extends "description" | "durationMinutes">(
    id: string,
    key: Key,
    value: ReportLineEdit[Key] | undefined,
  ) {
    setEdits((current) => {
      const nextRow = { ...current[id] };

      if (value === undefined) delete nextRow[key];
      else nextRow[key] = value as never;

      if (Object.keys(nextRow).length === 0) {
        const next = { ...current };
        delete next[id];
        return next;
      }

      return { ...current, [id]: nextRow };
    });
  }

  function clearEdits(message?: string) {
    setEdits({});
    setEditMode(false);
    setSaveReason("");
    setSaveError(null);
    setSavedNotice(message ?? null);
  }

  function saveEdits() {
    startSaving(async () => {
      const result = await saveReportLineEditsAction({
        edits: lineEdits,
        reason: saveReason,
      });

      if (result.status === "error") {
        setSaveError(result.message);
        return;
      }

      setSaveDialogOpen(false);
      clearEdits(result.message);
    });
  }

  return (
    <section className="mx-auto grid w-full max-w-[73.75rem] gap-4 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHead eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
        <ReportExportModal
          exportFields={exportFields}
          defaultTitles={defaultTitles}
          initialLocale={initialLocale}
          timezone={timezone}
          initialDurationDisplayFormat={durationDisplayFormat}
          disabled={workingSnapshot.lines.length === 0}
          lineEdits={lineEdits}
          onLineEditsSaved={(message) => clearEdits(message)}
        />
      </div>

      {filters}

      {lineEdits.length > 0 ? (
        <div className="sticky top-20 z-20 flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-warning/45 bg-warning-soft px-4 py-3 shadow-panel">
          <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden="true" />
          <div className="min-w-52 flex-1">
            <p className="font-ui text-sm font-semibold text-foreground">
              {t("persistence.unsavedTitle", { count: lineEdits.length })}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("persistence.unsavedDescription")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            onClick={() => clearEdits()}
          >
            {t("persistence.discard")}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={Save}
            onClick={() => setSaveDialogOpen(true)}
          >
            {t("persistence.save")}
          </Button>
        </div>
      ) : savedNotice ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-[var(--radius-md)] border border-success/35 bg-success-soft px-4 py-3 text-sm font-medium text-success"
        >
          <Check className="size-4 shrink-0" aria-hidden="true" />
          {savedNotice}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard
          label={t("stats.totalHours")}
          value={formatHoursWithUnit(
            workingSnapshot.summary.totalMinutes,
            locale,
            durationDisplayFormat,
          )}
        />
        <SummaryCard
          label={t("stats.period")}
          value={formatPeriod(workingSnapshot.period.start, workingSnapshot.period.end, locale)}
        />
        <SummaryCard
          label={t("stats.people")}
          value={formatCount(workingSnapshot.summary.peopleCount, locale)}
        />
        <SummaryCard
          label={t("stats.projects")}
          value={formatCount(workingSnapshot.summary.projectCount, locale)}
        />
      </div>

      {workingSnapshot.lines.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-soft">
          <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-secondary/45 px-5 py-10 text-center">
            <p className="font-ui text-sm font-semibold text-foreground">{t("empty.title")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("empty.description")}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(24rem,1fr)]">
            <div className="rounded-[var(--radius-lg)] border border-border bg-card px-5 py-5 shadow-soft">
              <div className="mb-4 font-display text-[15px] font-semibold text-foreground">
                {t("charts.time")}
              </div>
              <WeekBars
                lines={workingSnapshot.lines}
                locale={locale}
                durationDisplayFormat={durationDisplayFormat}
              />
            </div>

            <div className="rounded-[var(--radius-lg)] border border-border bg-card px-5 py-5 shadow-soft">
              <div className="mb-4 font-display text-[15px] font-semibold text-foreground">
                {workingSnapshot.view === "USER" ? t("charts.users") : t("charts.projects")}
              </div>
              <DonutBreakdown
                snapshot={workingSnapshot}
                locale={locale}
                durationDisplayFormat={durationDisplayFormat}
              />
            </div>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-border bg-card px-5 py-5 shadow-soft">
            <div className="mb-4 font-display text-lg font-semibold text-foreground">
              {workingSnapshot.view === "USER" ? t("charts.projects") : t("charts.users")}
            </div>
            <HorizontalBreakdown
              snapshot={workingSnapshot}
              locale={locale}
              durationDisplayFormat={durationDisplayFormat}
            />
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">
                  {t("detail.title")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("detail.description")}</p>
              </div>
              <Button
                type="button"
                variant="soft"
                size="sm"
                icon={editMode ? Check : Pencil}
                className={editMode ? "border-accent text-accent" : undefined}
                onClick={() => setEditMode((current) => !current)}
              >
                {editMode ? t("detail.editingDone") : t("detail.edit")}
              </Button>
            </div>

            {editMode ? (
              <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] bg-accent-soft px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                <span>{t("detail.editHint")}</span>
              </div>
            ) : null}

            <ReportDetail
              snapshot={workingSnapshot}
              locale={locale}
              durationDisplayFormat={durationDisplayFormat}
              editMode={editMode}
              editedIds={new Set(Object.keys(edits))}
              onDescriptionChange={updateDescription}
              onDurationChange={updateDuration}
            />
          </div>
        </>
      )}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent closeLabel={t("persistence.cancel")}>
          <DialogHeader>
            <DialogTitle>{t("persistence.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("persistence.dialogDescription", { count: lineEdits.length })}
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-2">
            <span className="font-ui text-xs font-semibold text-foreground">
              {t("persistence.reasonLabel")}
            </span>
            <Textarea
              value={saveReason}
              maxLength={500}
              placeholder={t("persistence.reasonPlaceholder")}
              invalid={Boolean(saveError)}
              onChange={(event) => {
                setSaveReason(event.target.value);
                setSaveError(null);
              }}
            />
          </label>
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-secondary px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            {t("persistence.memberVisibility")}
          </div>
          {saveError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {saveError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="soft" onClick={() => setSaveDialogOpen(false)}>
              {t("persistence.cancel")}
            </Button>
            <Button
              type="button"
              variant="primary"
              icon={Save}
              loading={isSaving}
              disabled={!saveReason.trim() || isSaving}
              onClick={saveEdits}
            >
              {t("persistence.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card px-5 py-4 shadow-soft">
      <p className="font-ui text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-semibold leading-none text-foreground">
        {value}
      </p>
    </div>
  );
}

function WeekBars({
  lines,
  locale,
  durationDisplayFormat,
}: {
  lines: ReportCostFreeLine[];
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
}) {
  const buckets = buildWeekBuckets(lines);
  const maxMinutes = Math.max(1, ...buckets.map((bucket) => bucket.totalMinutes));

  return (
    <div className="flex min-h-52 items-end gap-4 overflow-x-auto pb-1">
      {buckets.map((bucket) => {
        const height = Math.max(12, Math.round((bucket.totalMinutes / maxMinutes) * 142));

        return (
          <div
            key={bucket.key}
            className="flex min-h-48 min-w-16 flex-1 flex-col items-center justify-end gap-2"
          >
            <span className="text-sm font-semibold text-foreground">
              {bucket.totalMinutes
                ? formatHoursWithUnit(bucket.totalMinutes, locale, durationDisplayFormat)
                : ""}
            </span>
            <span
              className="w-12 rounded-t-[var(--radius-md)] bg-accent shadow-[0_12px_28px_rgba(31,128,127,0.18)]"
              style={{ height }}
              aria-hidden="true"
            />
            <span className="font-ui text-[11px] font-semibold uppercase text-muted-foreground">
              {bucket.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DonutBreakdown({
  snapshot,
  locale,
  durationDisplayFormat,
}: {
  snapshot: ReportSnapshot;
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
}) {
  const segments = snapshot.groups.map((group, index) => ({
    key: group.key,
    label: group.label,
    percentage: group.percentageOfTotal,
    color: getGroupColor(snapshot.view, group.color, index),
  }));

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div
        className="relative grid size-36 shrink-0 place-items-center rounded-full"
        style={{ background: buildConicGradient(segments) }}
        aria-hidden="true"
      >
        <div className="grid size-24 place-items-center rounded-full bg-card text-center shadow-inner">
          <span className="font-display text-2xl font-semibold leading-none text-foreground">
            {formatHours(snapshot.summary.totalMinutes, locale, durationDisplayFormat)}
          </span>
          <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            h
          </span>
        </div>
      </div>
      <div className="min-w-44 flex-1">
        <LegendList segments={segments} />
      </div>
    </div>
  );
}

function HorizontalBreakdown({
  snapshot,
  locale,
  durationDisplayFormat,
}: {
  snapshot: ReportSnapshot;
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
}) {
  const dimension = snapshot.view === "USER" ? "PROJECT" : "USER";
  const rows = buildBreakdown(snapshot.lines, dimension, snapshot.summary.totalMinutes);

  return (
    <div className="grid gap-2">
      {rows.map((row, index) => (
        <div
          key={row.key}
          className="grid grid-cols-[minmax(8rem,10rem)_1fr_6rem] items-center gap-3 py-1.5"
        >
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
            {dimension === "PROJECT" ? (
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: getGroupColor("PROJECT", row.color, index) }}
                aria-hidden="true"
              />
            ) : (
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft font-ui text-[11px] font-bold text-accent">
                {row.initials}
              </span>
            )}
            <span className="truncate">{row.label}</span>
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-secondary">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.max(2, row.percentage)}%`,
                backgroundColor: getGroupColor(dimension, row.color, index),
              }}
            />
          </span>
          <span className="text-right text-sm text-muted-foreground">
            <b className="font-display text-foreground">
              {formatHoursWithUnit(row.totalMinutes, locale, durationDisplayFormat)}
            </b>{" "}
            · {Math.round(row.percentage)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function LegendList({
  segments,
}: {
  segments: Array<{ key: string; label: string; percentage: number; color: string }>;
}) {
  return (
    <div className="grid gap-2">
      {segments.map((segment) => (
        <div key={segment.key} className="flex items-center gap-2 text-sm">
          <span
            className="size-2.5 shrink-0 rounded-[3px]"
            style={{ backgroundColor: segment.color }}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{segment.label}</span>
          <span className="font-display font-semibold text-foreground">
            {Math.round(segment.percentage)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function ReportDetail({
  snapshot,
  locale,
  durationDisplayFormat,
  editMode,
  editedIds,
  onDescriptionChange,
  onDurationChange,
}: {
  snapshot: ReportSnapshot;
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
  editMode: boolean;
  editedIds: Set<string>;
  onDescriptionChange(id: string, description: string): void;
  onDurationChange(id: string, hours: number): void;
}) {
  const t = useTranslations("AdminReports");

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-soft">
      {snapshot.groups.map((group) => {
        const lines = snapshot.lines.filter((line) =>
          snapshot.view === "USER" ? line.member.id === group.key : line.project.id === group.key,
        );

        return (
          <div key={group.key} className="border-b border-border last:border-b-0">
            <div className="flex flex-wrap items-center gap-3 bg-secondary/50 px-5 py-4">
              {snapshot.view === "PROJECT" ? (
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: getGroupColor("PROJECT", group.color, 0) }}
                  aria-hidden="true"
                />
              ) : (
                <span className="grid size-9 place-items-center rounded-full bg-accent-soft font-ui text-xs font-bold text-accent">
                  {lines[0]?.member.initials ?? group.label.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-display text-base font-semibold text-foreground">
                  {group.label}
                </div>
                {snapshot.view === "USER" && group.profile ? (
                  <Badge tone={group.profile === "CONTRACTOR" ? "info" : "warning"}>
                    {t(
                      group.profile === "CONTRACTOR"
                        ? "detail.profileContractor"
                        : "detail.profileEmployee",
                    )}
                  </Badge>
                ) : null}
                {snapshot.view === "PROJECT" && group.isInternalProject ? (
                  <Badge tone="warning">{t("detail.internalProject")}</Badge>
                ) : null}
              </div>
              <div className="font-display text-lg font-semibold text-foreground">
                {formatHoursWithUnit(group.totalMinutes, locale, durationDisplayFormat)}
              </div>
            </div>
            <div className="divide-y divide-border/70">
              {lines.map((line) => (
                <div
                  key={line.id}
                  className="grid gap-3 px-5 py-3 md:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_7rem] md:items-center"
                >
                  <div className="min-w-0">
                    {editMode ? (
                      <Input
                        value={line.description}
                        maxLength={1_000}
                        aria-label={t("detail.descriptionInput", { name: line.member.name })}
                        onChange={(event) =>
                          onDescriptionChange(line.id, event.currentTarget.value)
                        }
                      />
                    ) : (
                      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                        <span className="truncate">
                          {line.description || t("table.noDescription")}
                        </span>
                        {editedIds.has(line.id) ? (
                          <Pencil className="size-3 shrink-0 text-accent" aria-hidden="true" />
                        ) : null}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDate(line.localDate, locale)}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {snapshot.view === "USER" ? line.project.name : line.member.name}
                  </div>
                  <div className="font-display text-sm font-semibold text-foreground md:text-right">
                    {editMode ? (
                      <Input
                        type="number"
                        min={0}
                        max={24}
                        step={0.5}
                        value={line.durationMinutes / 60}
                        aria-label={t("detail.hoursInput", { name: line.member.name })}
                        className="text-right"
                        onChange={(event) =>
                          onDurationChange(
                            line.id,
                            Number.parseFloat(event.currentTarget.value) || 0,
                          )
                        }
                      />
                    ) : (
                      formatHoursWithUnit(line.durationMinutes, locale, durationDisplayFormat)
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function buildBreakdown(lines: ReportCostFreeLine[], dimension: ReportView, totalMinutes: number) {
  const rows = new Map<
    string,
    {
      key: string;
      label: string;
      color: string | null;
      initials: string | null;
      totalMinutes: number;
      percentage: number;
    }
  >();

  for (const line of lines) {
    const key = dimension === "PROJECT" ? line.project.id : line.member.id;
    const existing = rows.get(key) ?? {
      key,
      label: dimension === "PROJECT" ? line.project.name : line.member.name,
      color: dimension === "PROJECT" ? line.project.color : null,
      initials: dimension === "USER" ? line.member.initials : null,
      totalMinutes: 0,
      percentage: 0,
    };

    existing.totalMinutes += line.durationMinutes;
    rows.set(key, existing);
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      percentage: totalMinutes === 0 ? 0 : (row.totalMinutes / totalMinutes) * 100,
    }))
    .sort((left, right) => right.totalMinutes - left.totalMinutes);
}

function buildConicGradient(segments: Array<{ percentage: number; color: string }>) {
  if (segments.length === 0) return "var(--secondary)";

  let cursor = 0;
  return `conic-gradient(${segments
    .map((segment) => {
      const start = cursor;
      const end = cursor + segment.percentage;
      cursor = end;
      return `${segment.color} ${start}% ${end}%`;
    })
    .join(", ")})`;
}

const userChartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

function getGroupColor(view: ReportView, color: string | null, index: number) {
  if (view === "PROJECT" && color) return color;
  return userChartColors[index % userChartColors.length] ?? "var(--chart-1)";
}

function buildWeekBuckets(lines: ReportCostFreeLine[]) {
  const buckets = new Map<string, { key: string; label: string; totalMinutes: number }>();

  for (const line of lines) {
    const date = parseDateValue(line.localDate);
    if (!date) continue;

    const weekStart = addUtcDays(date, -((date.getUTCDay() + 6) % 7));
    const key = toDateValue(weekStart);
    const existing = buckets.get(key) ?? { key, label: key.slice(5), totalMinutes: 0 };

    existing.totalMinutes += line.durationMinutes;
    buckets.set(key, existing);
  }

  return [...buckets.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function formatDate(value: string, locale: string) {
  return formatDateLabel(value, locale, { style: "short" });
}

function formatPeriod(start: string, end: string, locale: string) {
  return formatPeriodRange(start, end, locale, { style: "short" });
}
