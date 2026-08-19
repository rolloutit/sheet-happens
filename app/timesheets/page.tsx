import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Upload,
  WalletCards,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import { StatusPill } from "@/src/components/sheet/StatusPill";
import { TimesheetStepper } from "@/src/components/sheet/TimesheetStepper";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/Card";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { LockedState } from "@/src/components/ui/LockedState";
import { SectionHead } from "@/src/components/ui/SectionHead";
import {
  formatCount,
  formatHours,
  formatMonthLabel,
  formatMoney as formatMoneyBase,
  formatPeriodRange as formatPeriodRangeBase,
  formatRate as formatRateBase,
  formatTimestamp as formatTimestampBase,
} from "@/src/lib/formatting";
import {
  accountStatusRoute,
  mapMemberToShellProfile,
  mapMemberToShellRole,
  mapMemberToShellUser,
  requireActiveAppMember,
} from "@/src/server/auth/app-access";
import {
  getContractorTimesheetMonthlyPreview,
  parseTimesheetMonthParam,
  type ContractorTimesheetMonthlyPreview,
  type TimesheetProjectPreview,
  type TimesheetPreviewRate,
  type TimesheetPreviewStatus,
} from "@/src/server/timesheets";
import { SubmitTimesheetButton } from "./SubmitTimesheetButton";
import { uploadContractorInvoiceAction } from "./actions";

export const dynamic = "force-dynamic";

type TimesheetsPageProps = {
  searchParams?: Promise<{
    month?: string | string[];
    result?: string | string[];
  }>;
};

type TimesheetsTranslator = Awaited<ReturnType<typeof getTranslations>>;

export default async function TimesheetsPage({ searchParams }: TimesheetsPageProps) {
  const resolvedSearchParams = await searchParams;
  const monthParam = getSingleParam(resolvedSearchParams?.month);
  const callbackURL = `/timesheets${monthParam ? `?month=${encodeURIComponent(monthParam)}` : ""}`;
  const { member } = await requireActiveAppMember(callbackURL);

  if (member.currentProfile !== "CONTRACTOR") {
    redirect(accountStatusRoute(callbackURL, "contractor-required"));
  }

  const [preview, t, locale] = await Promise.all([
    getContractorTimesheetMonthlyPreview({
      memberId: member.id,
      monthStart: parseTimesheetMonthParam(monthParam),
    }),
    getTranslations("Timesheets"),
    getLocale(),
  ]);
  const shellRole = mapMemberToShellRole(member);
  const shellProfile = mapMemberToShellProfile(member);
  const totalAmountLabel = formatPreviewAmount(preview, locale, t);
  const submitReadiness = getSubmitReadiness(preview, t);
  const actionResult = getActionResultMessage(getSingleParam(resolvedSearchParams?.result), t);

  return (
    <AppShell
      current="timesheets"
      role={shellRole}
      profile={shellProfile}
      user={mapMemberToShellUser(member)}
    >
      <section className="mx-auto grid w-full max-w-[73.75rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <SectionHead eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />

        <MonthSelector preview={preview} locale={locale} t={t} />

        {actionResult ? (
          <div
            className={
              actionResult.tone === "success"
                ? "flex items-start gap-3 rounded-[var(--radius-lg)] border border-success/35 bg-success-soft px-4 py-3 text-sm text-success"
                : "flex items-start gap-3 rounded-[var(--radius-lg)] border border-destructive/35 bg-destructive-soft px-4 py-3 text-sm text-destructive"
            }
          >
            {actionResult.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            )}
            <p>{actionResult.message}</p>
          </div>
        ) : null}

        <Card variant="featured" density="lg">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div>
              <StatusPill
                status={preview.status}
                label={getStatusLabel(preview.status, t)}
                density="comfortable"
              />
              <h2 className="mt-3 text-2xl font-semibold text-foreground">
                {formatMonthLabel(preview.periodStart, locale)}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {formatPeriodRange(preview.periodStart, preview.periodEnd, locale)}
              </p>
            </div>
            <div className="grid gap-4 lg:min-w-[28rem]">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <SummaryMetric
                  icon={Clock3}
                  label={t("summary.hours")}
                  value={formatHours(preview.totalMinutes, locale)}
                />
                <SummaryMetric
                  icon={WalletCards}
                  label={t("summary.amount")}
                  value={totalAmountLabel}
                />
                <SummaryMetric
                  icon={FileText}
                  label={t("summary.entries")}
                  value={formatCount(preview.entryCount, locale)}
                />
              </div>
              <SubmitTimesheetButton
                periodStart={preview.periodStart}
                disabled={!submitReadiness.canSubmit}
                disabledReason={submitReadiness.disabledReason}
                labels={{
                  trigger: t("submit.trigger"),
                  title: t("submit.title"),
                  description: t("submit.description"),
                  details: t("submit.details", {
                    month: formatMonthLabel(preview.periodStart, locale),
                  }),
                  confirm: t("submit.confirm"),
                  cancel: t("submit.cancel"),
                  submitting: t("submit.submitting"),
                }}
              />
            </div>
          </div>
        </Card>

        <Card density="lg">
          <CardHeader className="block">
            <CardTitle>{t("workflow.title")}</CardTitle>
            <CardDescription>{t("workflow.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <TimesheetStepper
              status={preview.status}
              aria-label={t("workflow.ariaLabel")}
              labels={{
                created: t("workflow.steps.created"),
                submitted: t("workflow.steps.submitted"),
                approved: t("workflow.steps.approved"),
                invoiced: t("workflow.steps.invoiced"),
                paid: t("workflow.steps.paid"),
              }}
              lockedDescriptions={{
                submitted: t("workflow.locked.submitted"),
                approved: t("workflow.locked.approved"),
                invoiced: t("workflow.locked.invoiced"),
                paid: t("workflow.locked.paid"),
              }}
            />
          </CardContent>
        </Card>

        <PreviewWarnings preview={preview} t={t} />

        <Card variant="elevated" density="lg">
          <CardHeader className="block">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{t("breakdown.title")}</CardTitle>
                <CardDescription>
                  {preview.source === "timesheet_snapshot"
                    ? t("breakdown.snapshotSource")
                    : t("breakdown.currentSource")}
                </CardDescription>
              </div>
              {preview.revisionNumber ? (
                <Badge tone="info">{t("revision", { number: preview.revisionNumber })}</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {preview.projects.length > 0 ? (
              <ProjectBreakdownTable projects={preview.projects} locale={locale} t={t} />
            ) : (
              <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-secondary/45 px-5 py-8 text-center text-sm text-muted-foreground">
                {t("breakdown.empty")}
              </div>
            )}
          </CardContent>
        </Card>

        <InvoicePanel preview={preview} locale={locale} t={t} />
      </section>
    </AppShell>
  );
}

function MonthSelector({
  preview,
  locale,
  t,
}: {
  preview: ContractorTimesheetMonthlyPreview;
  locale: string;
  t: TimesheetsTranslator;
}) {
  return (
    <Card density="sm" className="overflow-hidden">
      <div className="flex gap-2 overflow-x-auto p-2">
        {preview.months.map((month) => {
          const active = month.month === preview.selectedMonth;

          return (
            <Button key={month.month} asChild variant={active ? "primary" : "soft"} size="sm">
              <Link href={`/timesheets?month=${month.month}` as Route}>
                <CalendarDays className="size-4" aria-hidden="true" />
                <span>{formatMonthLabel(month.periodStart, locale)}</span>
                <span className="sr-only">, {getStatusLabel(month.status, t)}</span>
              </Link>
            </Button>
          );
        })}
      </div>
    </Card>
  );
}

function PreviewWarnings({
  preview,
  t,
}: {
  preview: ContractorTimesheetMonthlyPreview;
  t: TimesheetsTranslator;
}) {
  const warnings = [
    preview.mixedCurrency ? t("warnings.mixedCurrency") : null,
    preview.missingRateLineCount > 0
      ? t("warnings.missingRates", { count: preview.missingRateLineCount })
      : null,
    preview.rejectionReason ? t("warnings.rejected", { reason: preview.rejectionReason }) : null,
  ].filter((warning): warning is string => Boolean(warning));

  if (warnings.length === 0) return null;

  return (
    <div className="grid gap-2">
      {warnings.map((warning) => (
        <div
          key={warning}
          className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-warning/35 bg-warning-soft px-4 py-3 text-sm text-warning"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{warning}</p>
        </div>
      ))}
    </div>
  );
}

function ProjectBreakdownTable({
  projects,
  locale,
  t,
}: {
  projects: TimesheetProjectPreview[];
  locale: string;
  t: TimesheetsTranslator;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse">
          <caption className="sr-only">{t("breakdown.caption")}</caption>
          <thead>
            <tr className="border-b border-border bg-background/45">
              <HeadCell>{t("table.project")}</HeadCell>
              <HeadCell>{t("table.hours")}</HeadCell>
              <HeadCell>{t("table.rate")}</HeadCell>
              <HeadCell>{t("table.amount")}</HeadCell>
              <HeadCell>{t("table.entries")}</HeadCell>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.projectId} className="border-b border-border last:border-b-0">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: project.projectColor }}
                      aria-hidden="true"
                    />
                    <span className="font-ui text-sm font-semibold text-foreground">
                      {project.projectName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 font-ui text-sm font-semibold text-foreground">
                  {formatHours(project.totalMinutes, locale)}
                </td>
                <td className="px-4 py-4 text-sm text-muted-foreground">
                  <RateCell project={project} locale={locale} t={t} />
                </td>
                <td className="px-4 py-4 font-ui text-sm font-semibold text-foreground">
                  {formatProjectAmount(project, locale, t)}
                </td>
                <td className="px-4 py-4 text-sm text-muted-foreground">
                  {formatCount(project.entryCount, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvoicePanel({
  preview,
  locale,
  t,
}: {
  preview: ContractorTimesheetMonthlyPreview;
  locale: string;
  t: TimesheetsTranslator;
}) {
  const workflow = getInvoiceWorkflow(preview);

  return (
    <Card variant="elevated" density="lg">
      <CardHeader className="block">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t("invoice.title")}</CardTitle>
            <CardDescription>{getInvoiceWorkflowDescription(workflow, t)}</CardDescription>
          </div>
          {workflow.kind === "summary" ? (
            <Badge tone="success">{getInvoiceStatusLabel(workflow.invoice.status, t)}</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {workflow.kind === "locked" ? (
          <LockedState title={t("invoice.lockedTitle")} reason={t("invoice.lockedReason")} />
        ) : workflow.kind === "summary" ? (
          <InvoiceSummary invoice={workflow.invoice} locale={locale} t={t} />
        ) : (
          <div className="grid gap-4">
            {workflow.kind === "cancellation" || workflow.kind === "replacement" ? (
              <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-destructive/35 bg-destructive-soft px-4 py-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>
                  {t("invoice.rejectedReason", {
                    reason: workflow.rejectedInvoice.rejectionReason ?? "-",
                  })}
                </p>
              </div>
            ) : null}

            {workflow.kind === "replacement" ? (
              <div className="grid gap-3">
                <p className="text-sm font-semibold text-foreground">
                  {t("invoice.cancellationUploaded")}
                </p>
                <InvoiceSummary invoice={workflow.cancellationInvoice} locale={locale} t={t} />
              </div>
            ) : null}

            <InvoiceUploadForm workflow={workflow} preview={preview} t={t} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type TimesheetInvoicePreview = ContractorTimesheetMonthlyPreview["invoices"][number];

type InvoiceWorkflow =
  | {
      kind: "locked";
    }
  | {
      kind: "summary";
      invoice: TimesheetInvoicePreview;
    }
  | {
      kind: "original";
      invoiceRole: "ORIGINAL";
      defaultAmount: string;
      defaultCurrency: string;
    }
  | {
      kind: "cancellation";
      invoiceRole: "CANCELLATION";
      rejectedInvoice: TimesheetInvoicePreview;
      defaultAmount: string;
      defaultCurrency: string;
    }
  | {
      kind: "replacement";
      invoiceRole: "REPLACEMENT";
      rejectedInvoice: TimesheetInvoicePreview;
      cancellationInvoice: TimesheetInvoicePreview;
      defaultAmount: string;
      defaultCurrency: string;
    };

function InvoiceUploadForm({
  workflow,
  preview,
  t,
}: {
  workflow: Extract<InvoiceWorkflow, { invoiceRole: string }>;
  preview: ContractorTimesheetMonthlyPreview;
  t: TimesheetsTranslator;
}) {
  const isCancellation = workflow.invoiceRole === "CANCELLATION";

  return (
    <form
      action={uploadContractorInvoiceAction}
      encType="multipart/form-data"
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <input type="hidden" name="periodStart" value={preview.periodStart} />
      <input type="hidden" name="invoiceRole" value={workflow.invoiceRole} />
      <Field label={t("invoice.invoiceNumber")} required>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="invoiceNumber"
            placeholder={t("invoice.invoiceNumberPlaceholder")}
            aria-describedby={describedBy}
            invalid={invalid}
            required
          />
        )}
      </Field>
      <Field label={t("invoice.file")} required hint={t("invoice.fileHint", { sizeMb: 10 })}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="invoiceFile"
            type="file"
            accept="application/pdf,.pdf"
            aria-describedby={describedBy}
            invalid={invalid}
            required
            className="file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:font-semibold file:text-foreground"
          />
        )}
      </Field>
      <Field label={t("invoice.declaredAmount")} required>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="declaredAmount"
            inputMode="decimal"
            defaultValue={workflow.defaultAmount}
            aria-describedby={describedBy}
            invalid={invalid}
            required
            readOnly={isCancellation}
          />
        )}
      </Field>
      <Field label={t("invoice.currency")} required>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="currencyCode"
            defaultValue={workflow.defaultCurrency}
            aria-describedby={describedBy}
            invalid={invalid}
            required
            readOnly
          />
        )}
      </Field>
      <div className="lg:col-span-2">
        <Button type="submit" variant="cta" icon={Upload}>
          {getInvoiceUploadLabel(workflow, t)}
        </Button>
      </div>
    </form>
  );
}

function InvoiceSummary({
  invoice,
  locale,
  t,
}: {
  invoice: NonNullable<ContractorTimesheetMonthlyPreview["invoice"]>;
  locale: string;
  t: TimesheetsTranslator;
}) {
  return (
    <div className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-card/70 p-4 sm:grid-cols-2 lg:grid-cols-5">
      <SummaryItem label={t("invoice.invoiceNumber")} value={invoice.invoiceNumber} />
      <SummaryItem label={t("invoice.role.label")} value={getInvoiceRoleLabel(invoice.role, t)} />
      <SummaryItem
        label={t("invoice.declaredAmount")}
        value={formatMoney(invoice.declaredAmount, invoice.currencyCode, locale)}
      />
      <SummaryItem label={t("invoice.file")} value={invoice.originalFilename} />
      <SummaryItem
        label={t("invoice.uploadedAt")}
        value={formatDateTime(invoice.uploadedAt, locale)}
      />
    </div>
  );
}

function getInvoiceWorkflow(preview: ContractorTimesheetMonthlyPreview): InvoiceWorkflow {
  const latestMainInvoice = preview.invoice;

  if (preview.status === "approved") {
    return {
      kind: "original",
      invoiceRole: "ORIGINAL",
      defaultAmount: preview.totalAmount ?? "",
      defaultCurrency: preview.currencyCode ?? "",
    };
  }

  if (preview.status === "invoice_rejected") {
    const rejectedInvoice = preview.invoices.find(
      (invoice) => invoice.role !== "cancellation" && invoice.status === "rejected",
    );

    if (!rejectedInvoice) {
      return latestMainInvoice
        ? { kind: "summary", invoice: latestMainInvoice }
        : { kind: "locked" };
    }

    const cancellationInvoice = preview.invoices.find(
      (invoice) =>
        invoice.role === "cancellation" &&
        invoice.referencesInvoiceId === rejectedInvoice.id &&
        invoice.status !== "deleted",
    );

    if (!cancellationInvoice) {
      return {
        kind: "cancellation",
        invoiceRole: "CANCELLATION",
        rejectedInvoice,
        defaultAmount: negateMoney(rejectedInvoice.declaredAmount),
        defaultCurrency: rejectedInvoice.currencyCode,
      };
    }

    return {
      kind: "replacement",
      invoiceRole: "REPLACEMENT",
      rejectedInvoice,
      cancellationInvoice,
      defaultAmount: preview.totalAmount ?? "",
      defaultCurrency: preview.currencyCode ?? rejectedInvoice.currencyCode,
    };
  }

  if (latestMainInvoice) {
    return {
      kind: "summary",
      invoice: latestMainInvoice,
    };
  }

  return {
    kind: "locked",
  };
}

function getInvoiceWorkflowDescription(workflow: InvoiceWorkflow, t: TimesheetsTranslator) {
  if (workflow.kind === "locked") return t("invoice.lockedDescription");
  if (workflow.kind === "summary") return t("invoice.uploadedDescription");
  if (workflow.kind === "cancellation") return t("invoice.cancellationDescription");
  if (workflow.kind === "replacement") return t("invoice.replacementDescription");
  return t("invoice.description");
}

function getInvoiceUploadLabel(
  workflow: Extract<InvoiceWorkflow, { invoiceRole: string }>,
  t: TimesheetsTranslator,
) {
  if (workflow.invoiceRole === "CANCELLATION") return t("invoice.uploadCancellation");
  if (workflow.invoiceRole === "REPLACEMENT") return t("invoice.uploadReplacement");
  return t("invoice.upload");
}

function getInvoiceRoleLabel(role: TimesheetInvoicePreview["role"], t: TimesheetsTranslator) {
  return t(`invoice.role.${role}`);
}

function negateMoney(value: string) {
  return value.startsWith("-") ? value.slice(1) : `-${value}`;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground" title={value}>
        {value}
      </p>
    </div>
  );
}

function RateCell({
  project,
  locale,
  t,
}: {
  project: TimesheetProjectPreview;
  locale: string;
  t: TimesheetsTranslator;
}) {
  if (project.missingRateLineCount > 0) {
    return <Badge tone="warning">{t("rate.missing")}</Badge>;
  }

  if (project.mixedRates) {
    return <Badge tone="neutral">{t("rate.mixed")}</Badge>;
  }

  if (!project.singleRate) {
    return <span>{t("rate.none")}</span>;
  }

  return (
    <span>
      {formatRate(project.singleRate, locale)} · {t(`rateSource.${project.singleRate.source}`)}
    </span>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card/70 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em]">
          {label}
        </span>
      </div>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function HeadCell({ children }: { children: string }) {
  return (
    <th className="px-4 py-3 text-left font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </th>
  );
}

function formatPreviewAmount(
  preview: Pick<
    ContractorTimesheetMonthlyPreview,
    "totalAmount" | "currencyCode" | "mixedCurrency" | "missingRateLineCount"
  >,
  locale: string,
  t: TimesheetsTranslator,
) {
  if (preview.mixedCurrency) return t("amount.mixedCurrency");
  if (!preview.totalAmount || !preview.currencyCode) {
    return preview.missingRateLineCount > 0 ? t("amount.missingRate") : t("amount.none");
  }

  return formatMoney(preview.totalAmount, preview.currencyCode, locale);
}

function formatProjectAmount(
  project: Pick<
    TimesheetProjectPreview,
    "amount" | "currencyCode" | "mixedCurrency" | "missingRateLineCount"
  >,
  locale: string,
  t: TimesheetsTranslator,
) {
  if (project.mixedCurrency) return t("amount.mixedCurrency");
  if (!project.amount || !project.currencyCode) {
    return project.missingRateLineCount > 0 ? t("amount.missingRate") : t("amount.none");
  }

  return formatMoney(project.amount, project.currencyCode, locale);
}

function formatRate(rate: TimesheetPreviewRate, locale: string) {
  return formatRateBase(rate.hourlyRate, rate.currencyCode, locale);
}

/** Contractor-facing amounts spell the currency out to match the invoices they reconcile against. */
function formatMoney(amount: string, currencyCode: string, locale: string) {
  return formatMoneyBase(amount, currencyCode, locale, { display: "code" });
}

function formatDateTime(value: string, locale: string) {
  return formatTimestampBase(value, locale, { timeZone: "UTC" });
}

function formatPeriodRange(start: string, end: string, locale: string) {
  return formatPeriodRangeBase(start, end, locale, { style: "short" });
}

function getStatusLabel(status: TimesheetPreviewStatus, t: TimesheetsTranslator) {
  return t(`status.${status}`);
}

function getInvoiceStatusLabel(
  status: NonNullable<ContractorTimesheetMonthlyPreview["invoice"]>["status"],
  t: TimesheetsTranslator,
) {
  return t(`invoice.status.${status}`);
}

function getActionResultMessage(result: string, t: TimesheetsTranslator) {
  if (!result) return null;

  const successResults = new Set([
    "invoiceUploaded",
    "invoiceCancellationUploaded",
    "invoiceReplacementUploaded",
  ]);
  const knownResults = new Set([
    "invoiceUploaded",
    "invoiceCancellationUploaded",
    "invoiceReplacementUploaded",
    "invoiceInvalidInput",
    "invoiceInvalidMonth",
    "invoiceCurrencyInvalid",
    "invoiceCurrencyMismatch",
    "invoiceApprovedRequired",
    "invoiceRevisionChanged",
    "invoiceAlreadyUploaded",
    "invoiceRejectedNotFound",
    "invoiceCancellationRequired",
    "invoiceReplacementRequired",
    "invoiceInvalidStep",
    "invoiceFileRequired",
    "invoiceFileTooLarge",
    "invoicePdfRequired",
    "invoiceNumberRequired",
    "invoiceAmountInvalid",
    "invoiceCancellationAmountInvalid",
    "invoiceCancellationCurrencyInvalid",
    "invoiceStorageMissing",
    "memberNotFound",
    "contractorRequired",
    "notAllowed",
    "databaseUnavailable",
    "invoiceFailed",
  ]);
  const key = knownResults.has(result) ? result : "invoiceFailed";

  return {
    tone: successResults.has(result) ? "success" : "error",
    message: t(`actionResults.${key}`),
  };
}

function getSubmitReadiness(preview: ContractorTimesheetMonthlyPreview, t: TimesheetsTranslator) {
  if (preview.status !== "not_created" && preview.status !== "rejected") {
    return {
      canSubmit: false,
      disabledReason: t("submit.disabled.notOpen"),
    };
  }

  if (preview.entryCount === 0) {
    return {
      canSubmit: false,
      disabledReason: t("submit.disabled.noEntries"),
    };
  }

  if (preview.missingRateLineCount > 0) {
    return {
      canSubmit: false,
      disabledReason: t("submit.disabled.missingRates"),
    };
  }

  if (preview.mixedCurrency) {
    return {
      canSubmit: false,
      disabledReason: t("submit.disabled.mixedCurrency"),
    };
  }

  if (!preview.totalAmount || !preview.currencyCode) {
    return {
      canSubmit: false,
      disabledReason: t("submit.disabled.notReady"),
    };
  }

  return {
    canSubmit: true,
    disabledReason: null,
  };
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.at(0) ?? "";
  }

  return value ?? "";
}
