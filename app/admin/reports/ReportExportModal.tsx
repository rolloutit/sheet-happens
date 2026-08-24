"use client";

import {
  AlertTriangle,
  Check,
  Clock,
  Download,
  Eye,
  FileDown,
  FileText,
  Globe,
  Loader2,
  Lock,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/Button";
import { Checkbox } from "@/src/components/ui/Checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/Dialog";
import { Input } from "@/src/components/ui/Input";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { Select } from "@/src/components/ui/Select";
import { Skeleton } from "@/src/components/ui/Skeleton";
import { Textarea } from "@/src/components/ui/Textarea";
import { resolveLocale, type AppLocale } from "@/src/i18n/locales";
import type { DurationDisplayFormat } from "@/src/lib/formatting";
import { serializeReportLineEdits, type ReportLineEdit } from "@/src/lib/report-line-edits";
import { cn } from "@/src/lib/utils";
import type { ReportExportFields, ReportMode } from "@/src/server/reports";

import { saveReportLineEditsAction } from "./actions";

export type ReportExportModalProps = {
  /** Serialized applied filters, posted with the download and sent with every preview request. */
  exportFields: ReportExportFields;
  /** The generated title in every supported language, so switching the language can swap it. */
  defaultTitles: Record<AppLocale, string>;
  /** The interface language, which is the default export language but no longer the only one. */
  initialLocale: AppLocale;
  timezone: string;
  initialDurationDisplayFormat: DurationDisplayFormat;
  disabled: boolean;
  lineEdits: ReportLineEdit[];
  onLineEditsSaved: (message: string) => void;
};

type PreviewState =
  | { status: "loading" }
  /**
   * `pending` marks pages that are still on screen while a newer render is in flight. Replacing
   * them with the skeleton would blank the whole preview pane on every mode or title change.
   */
  | { status: "ready"; pages: string[]; truncated: boolean; pending: boolean }
  | { status: "empty" }
  | { status: "error" };

const PREVIEW_DEBOUNCE_MS = 500;
const PREVIEW_ENDPOINT = "/admin/reports/export/preview";
const MICRO_LABEL =
  "font-ui text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";
// Endonyms: each option reads in its own language, so it means the same thing whichever language
// the dialog itself is in.
const LANGUAGE_ITEMS = [
  { value: "hu", label: "Magyar" },
  { value: "en", label: "English" },
];

export function ReportExportModal({
  exportFields,
  defaultTitles,
  initialLocale,
  timezone,
  initialDurationDisplayFormat,
  disabled,
  lineEdits,
  onLineEditsSaved,
}: ReportExportModalProps) {
  const t = useTranslations("AdminReports");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitles[initialLocale]);
  const [exportLocale, setExportLocale] = useState<AppLocale>(initialLocale);
  const [mode, setMode] = useState<ReportMode>("COST_FREE");
  const [durationDisplayFormat, setDurationDisplayFormat] = useState<DurationDisplayFormat>(
    initialDurationDisplayFormat,
  );
  const [preview, setPreview] = useState<PreviewState>({ status: "loading" });
  // Bumped to re-run the effect when the user retries a failed render without changing anything.
  const [reloadToken, setReloadToken] = useState(0);
  const [saveRecordedTime, setSaveRecordedTime] = useState(false);
  const [saveReason, setSaveReason] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingRecordedTime, setSavingRecordedTime] = useState(false);
  const internal = mode === "INTERNAL";
  // Serialized so the effect depends on a value rather than on the prop object's identity.
  const filterQuery = useMemo(() => new URLSearchParams(exportFields).toString(), [exportFields]);
  const serializedEdits = useMemo(() => serializeReportLineEdits(lineEdits), [lineEdits]);
  const generatedTitles = useMemo(() => new Set(Object.values(defaultTitles)), [defaultTitles]);

  function changeLocale(value: string) {
    const nextLocale = resolveLocale(value) ?? initialLocale;

    setExportLocale(nextLocale);
    // A generated title belongs to the document's language; a hand-written one belongs to the user.
    setTitle((current) => (generatedTitles.has(current) ? defaultTitles[nextLocale] : current));
  }

  async function handleExportSubmit(event: FormEvent<HTMLFormElement>) {
    if (!saveRecordedTime || lineEdits.length === 0) return;

    event.preventDefault();
    if (!saveReason.trim()) {
      setSaveError(t("persistence.errors.EMPTY_REASON"));
      return;
    }

    const form = event.currentTarget;
    setSavingRecordedTime(true);
    setSaveError(null);
    const result = await saveReportLineEditsAction({ edits: lineEdits, reason: saveReason });
    setSavingRecordedTime(false);

    if (result.status === "error") {
      setSaveError(result.message);
      return;
    }

    // Submit the already-rendered form immediately. The source records now contain the same
    // values, while the hidden edits keep this download deterministic during revalidation.
    form.submit();
    setSaveRecordedTime(false);
    setSaveReason("");
    onLineEditsSaved(result.message);
  }

  useEffect(() => {
    if (!open) return undefined;

    const controller = new AbortController();
    // The title re-renders the document, so wait for typing to settle instead of compiling per key.
    const timer = window.setTimeout(async () => {
      setPreview((current) =>
        current.status === "ready" ? { ...current, pending: true } : { status: "loading" },
      );

      try {
        const body = new URLSearchParams(filterQuery);
        body.set("mode", mode);
        body.set("title", title);
        body.set("locale", exportLocale);
        body.set("durationDisplayFormat", durationDisplayFormat);
        if (serializedEdits) body.set("lineEdits", serializedEdits);

        const response = await fetch(PREVIEW_ENDPOINT, {
          method: "POST",
          body,
          signal: controller.signal,
        });

        if (!response.ok) {
          setPreview({ status: "error" });
          return;
        }

        const result = (await response.json()) as {
          status?: string;
          pages?: string[];
          truncated?: boolean;
        };

        if (result.status === "empty") {
          setPreview({ status: "empty" });
        } else if (result.status === "ready" && result.pages) {
          setPreview({
            status: "ready",
            pages: result.pages,
            truncated: Boolean(result.truncated),
            pending: false,
          });
        } else {
          setPreview({ status: "error" });
        }
      } catch (error) {
        // An aborted request is a superseded one; its state belongs to the newer render.
        if (controller.signal.aborted) return;

        console.error("Report export preview request failed.", error);
        setPreview({ status: "error" });
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    durationDisplayFormat,
    exportLocale,
    filterQuery,
    mode,
    open,
    reloadToken,
    serializedEdits,
    title,
  ]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);

        if (nextOpen) {
          setTitle(defaultTitles[initialLocale]);
          setExportLocale(initialLocale);
          setMode("COST_FREE");
          setDurationDisplayFormat(initialDurationDisplayFormat);
          setPreview({ status: "loading" });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="cta" icon={FileDown} disabled={disabled}>
          {t("export.action")}
        </Button>
      </DialogTrigger>
      <DialogContent
        closeLabel={t("export.close")}
        className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[85rem] flex-col gap-0 overflow-hidden p-0"
      >
        <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-5 py-4 pr-14">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-accent-soft text-accent">
            <FileDown className="size-[18px]" aria-hidden="true" />
          </span>
          <DialogTitle className="font-display text-lg font-semibold">
            {t("export.dialogTitle")}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("export.dialogDescription")}</DialogDescription>
        </div>

        {/* A real form POST keeps the download on the existing export route: no blob plumbing, and
            an expired session lands on the login page rather than failing silently. */}
        <form
          action="/admin/reports/export"
          method="post"
          target="_blank"
          className="flex min-h-0 min-w-0 flex-1 flex-col"
          onSubmit={handleExportSubmit}
        >
          {Object.entries(exportFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="locale" value={exportLocale} />
          <input type="hidden" name="durationDisplayFormat" value={durationDisplayFormat} />
          {serializedEdits ? (
            <input type="hidden" name="lineEdits" value={serializedEdits} />
          ) : null}

          <div className="grid min-h-0 min-w-0 flex-1 overflow-x-hidden md:grid-cols-[21.25rem_minmax(0,1fr)]">
            <div className="grid min-w-0 content-start gap-5 overflow-x-hidden overflow-y-auto border-b border-border p-5 md:border-b-0 md:border-r">
              <label className="grid gap-2">
                <span className={MICRO_LABEL}>{t("export.titleLabel")}</span>
                <Input
                  name="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t("export.titlePlaceholder")}
                  maxLength={120}
                />
              </label>

              <div className="grid gap-2">
                <span id="report-export-language-label" className={MICRO_LABEL}>
                  {t("export.languageLabel")}
                </span>
                {/* The document's language, not the interface's: the dialog stays in the app
                    language while the PDF follows this. */}
                <SegmentedControl
                  items={LANGUAGE_ITEMS}
                  value={exportLocale}
                  onValueChange={changeLocale}
                  label={t("export.languageLabel")}
                  aria-labelledby="report-export-language-label"
                  width="full"
                />
              </div>

              <div className="grid gap-2">
                <span id="report-export-duration-label" className={MICRO_LABEL}>
                  {t("export.durationFormatLabel")}
                </span>
                <Select
                  options={[
                    {
                      value: "DECIMAL_HOURS",
                      label: t("export.durationFormatDecimal"),
                    },
                    {
                      value: "HOURS_MINUTES",
                      label: t("export.durationFormatHoursMinutes"),
                    },
                  ]}
                  value={durationDisplayFormat}
                  onValueChange={(value) =>
                    setDurationDisplayFormat(value as DurationDisplayFormat)
                  }
                  aria-label={t("export.durationFormatLabel")}
                  searchable={false}
                />
              </div>

              <div className="grid gap-2">
                <span id="report-export-mode-label" className={MICRO_LABEL}>
                  {t("export.modeLabel")}
                </span>
                <div
                  className="grid gap-2 sm:grid-cols-2"
                  role="group"
                  aria-labelledby="report-export-mode-label"
                >
                  <ModeCard
                    icon={Globe}
                    label={t("export.modeCostFree")}
                    hint={t("export.modeCostFreeHint")}
                    selected={!internal}
                    tone="accent"
                    onSelect={() => setMode("COST_FREE")}
                  />
                  <ModeCard
                    icon={Lock}
                    label={t("export.modeInternal")}
                    hint={t("export.modeInternalHint")}
                    selected={internal}
                    tone="warning"
                    onSelect={() => setMode("INTERNAL")}
                  />
                </div>
                {internal ? (
                  <div className="flex gap-3 rounded-[var(--radius-md)] border border-warning/40 bg-warning-soft p-3.5">
                    <AlertTriangle
                      className="mt-0.5 size-[18px] shrink-0 text-warning"
                      aria-hidden="true"
                    />
                    <div className="grid gap-1">
                      <span className="font-ui text-sm font-semibold text-foreground">
                        {t("export.internalWarningTitle")}
                      </span>
                      <span className="text-[13px] leading-relaxed text-muted-foreground">
                        {t("export.internalWarningBody")}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-2">
                <span className={MICRO_LABEL}>{t("export.formatLabel")}</span>
                <div className="flex items-center gap-2.5 rounded-[var(--radius-md)] border-[1.5px] border-accent bg-accent-soft px-3.5 py-2.5">
                  <FileText className="size-[18px] text-accent" aria-hidden="true" />
                  <span className="font-ui text-sm font-semibold text-foreground">
                    {t("export.formatPdf")}
                  </span>
                  <Check className="ml-auto size-4 text-accent" aria-hidden="true" />
                </div>
              </div>

              <div className="grid gap-3 rounded-[var(--radius-md)] border border-border bg-secondary/55 p-3.5">
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={saveRecordedTime}
                    disabled={lineEdits.length === 0}
                    onCheckedChange={(checked) => {
                      setSaveRecordedTime(checked === true);
                      setSaveError(null);
                    }}
                    aria-describedby="report-save-recorded-time-hint"
                  />
                  <span className="grid gap-1">
                    <span className="font-ui text-sm font-semibold text-foreground">
                      {t("persistence.exportOption")}
                    </span>
                    <span
                      id="report-save-recorded-time-hint"
                      className="text-xs leading-relaxed text-muted-foreground"
                    >
                      {lineEdits.length > 0
                        ? t("persistence.exportOptionHint", { count: lineEdits.length })
                        : t("persistence.exportOptionEmpty")}
                    </span>
                  </span>
                </label>

                {saveRecordedTime && lineEdits.length > 0 ? (
                  <label className="grid gap-2">
                    <span className={MICRO_LABEL}>{t("persistence.reasonLabel")}</span>
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
                    {saveError ? (
                      <span role="alert" className="text-xs font-medium text-destructive">
                        {saveError}
                      </span>
                    ) : null}
                  </label>
                ) : null}
              </div>
            </div>

            <div className="flex min-h-0 min-w-0 flex-col bg-secondary/40">
              {/* Outside the scroll area, so a refresh is still announced once the pages are
                  scrolled past — and reported here rather than in the pane, so nothing moves. */}
              <span
                className={cn("flex shrink-0 items-center gap-1.5 px-6 pb-3 pt-6", MICRO_LABEL)}
                aria-live="polite"
              >
                <Eye className="size-3.5" aria-hidden="true" />
                {t("export.previewLabel")}
                {preview.status === "ready" && preview.pending ? (
                  <span className="flex items-center gap-1.5 normal-case tracking-normal">
                    <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                    {t("export.previewLoading")}
                  </span>
                ) : null}
              </span>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
                <ReportExportPreview
                  preview={preview}
                  labels={{
                    loading: t("export.previewLoading"),
                    error: t("export.previewError"),
                    retry: t("export.previewRetry"),
                    emptyTitle: t("empty.title"),
                    emptyDescription: t("empty.description"),
                    truncated: (count: number) => t("export.previewTruncated", { count }),
                    page: t("export.previewLabel"),
                  }}
                  onRetry={() => setReloadToken((token) => token + 1)}
                />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5">
            <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Clock className="size-3.5" aria-hidden="true" />
              {t("export.timezoneLabel")}: {timezone}
            </span>
            <div className="flex items-center gap-2.5">
              <DialogClose asChild>
                <Button type="button" variant="soft">
                  {t("export.cancel")}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                variant="cta"
                icon={Download}
                loading={savingRecordedTime}
                disabled={
                  preview.status === "empty" ||
                  savingRecordedTime ||
                  (saveRecordedTime && !saveReason.trim())
                }
              >
                {t("export.download")}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ModeCard({
  icon: Icon,
  label,
  hint,
  selected,
  tone,
  onSelect,
}: {
  icon: typeof Globe;
  label: string;
  hint: string;
  selected: boolean;
  tone: "accent" | "warning";
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "grid gap-1.5 rounded-[var(--radius-md)] border-[1.5px] border-border bg-card p-3.5 text-left transition duration-200 ease-[var(--ease-standard)] hover:border-border/80",
        selected && tone === "accent" && "border-accent bg-accent-soft",
        selected && tone === "warning" && "border-warning bg-warning-soft",
      )}
    >
      <span className="flex items-center gap-1.5 font-ui text-sm font-semibold text-foreground">
        <Icon
          className={cn(
            "size-4",
            selected
              ? tone === "accent"
                ? "text-accent"
                : "text-warning"
              : "text-muted-foreground",
          )}
          aria-hidden="true"
        />
        {label}
      </span>
      <span className="text-xs leading-relaxed text-muted-foreground">{hint}</span>
    </button>
  );
}

function ReportExportPreview({
  preview,
  labels,
  onRetry,
}: {
  preview: PreviewState;
  labels: {
    loading: string;
    error: string;
    retry: string;
    emptyTitle: string;
    emptyDescription: string;
    truncated: (count: number) => string;
    page: string;
  };
  onRetry: () => void;
}) {
  if (preview.status === "loading") {
    return (
      <div className="grid justify-items-center gap-3">
        <Skeleton variant="document" className="w-full max-w-[50rem]" />
        <span className="text-[13px] text-muted-foreground">{labels.loading}</span>
      </div>
    );
  }

  if (preview.status === "empty") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-card/60 px-5 py-10 text-center">
        <p className="font-ui text-sm font-semibold text-foreground">{labels.emptyTitle}</p>
        <p className="mt-2 text-sm text-muted-foreground">{labels.emptyDescription}</p>
      </div>
    );
  }

  if (preview.status === "error") {
    return (
      <div className="grid justify-items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border bg-card/60 px-5 py-10 text-center">
        <p className="text-sm text-muted-foreground">{labels.error}</p>
        <Button type="button" variant="soft" size="sm" onClick={onRetry}>
          {labels.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid justify-items-center gap-4">
      {preview.pages.map((page, index) => (
        // Rendered as an image, not injected as markup: an <img> cannot run scripts or load
        // subresources out of the SVG. `next/image` has nothing to optimize on an inline data URI.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={index}
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(page)}`}
          alt={`${labels.page} ${index + 1}`}
          className="block h-auto w-full max-w-[50rem] rounded-[4px] bg-white shadow-[0_14px_50px_-16px_rgb(0_0_0_/_0.45)]"
        />
      ))}
      {preview.truncated ? (
        <span className="text-[13px] text-muted-foreground">
          {labels.truncated(preview.pages.length)}
        </span>
      ) : null}
    </div>
  );
}
