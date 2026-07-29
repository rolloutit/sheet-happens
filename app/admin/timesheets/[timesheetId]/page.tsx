import {
  AlertTriangle,
  ArrowLeft,
  CheckCheck,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  ShieldCheck,
  Unlock,
  WalletCards,
  XCircle,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import { StatusPill } from "@/src/components/sheet/StatusPill";
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
import { SectionHead } from "@/src/components/ui/SectionHead";
import { Textarea } from "@/src/components/ui/Textarea";
import {
  mapMemberToShellProfile,
  mapMemberToShellUser,
  requireAdminAppMember,
} from "@/src/server/auth/app-access";
import {
  getTimesheetReviewForAdmin,
  type AdminTimesheetReview,
  type AdminTimesheetReviewEvent,
  type AdminTimesheetReviewInvoice,
  type AdminTimesheetReviewLine,
  type AdminTimesheetReviewProject,
} from "@/src/server/timesheets";
import {
  acceptInvoiceReviewAction,
  approveTimesheetReviewAction,
  rejectInvoiceReviewAction,
  rejectTimesheetReviewAction,
} from "../actions";
import {
  formatCount,
  formatHours,
  formatMoney,
  formatMonthLabel,
  formatPeriodRange,
  formatRate,
  formatTimestamp,
  getActionResultMessage,
  getStatusLabel,
  toTimesheetPreviewStatus,
} from "../formatting";

export const dynamic = "force-dynamic";

type AdminTimesheetReviewPageProps = {
  params: Promise<{
    timesheetId: string;
  }>;
  searchParams?: Promise<{
    result?: string | string[];
  }>;
};

type AdminTimesheetsTranslator = Awaited<ReturnType<typeof getTranslations>>;

export default async function AdminTimesheetReviewPage({
  params,
  searchParams,
}: AdminTimesheetReviewPageProps) {
  const { timesheetId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { member: admin } = await requireAdminAppMember(`/admin/timesheets/${timesheetId}`);
  const [review, t, locale] = await Promise.all([
    getTimesheetReviewForAdmin(timesheetId),
    getTranslations("AdminTimesheets"),
    getLocale(),
  ]);

  if (!review) notFound();

  const actionResult = getSingleParam(resolvedSearchParams.result);
  const actionResultMessage = getActionResultMessage(actionResult, t);

  return (
    <AppShell
      current="review"
      role="admin"
      profile={mapMemberToShellProfile(admin)}
      user={mapMemberToShellUser(admin)}
    >
      <section className="mx-auto grid w-full max-w-[92rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Button asChild variant="ghost" size="sm" className="w-fit">
          <Link href={"/admin/timesheets" as Route}>
            <ArrowLeft className="size-4" aria-hidden />
            {t("detail.back")}
          </Link>
        </Button>

        <SectionHead
          eyebrow={t("eyebrow")}
          title={t("detail.title", { name: review.contractorName })}
          subtitle={t("detail.subtitle", {
            month: formatMonthLabel(review.periodStart, locale),
          })}
        />

        {actionResultMessage ? (
          <div className="rounded-[var(--radius-lg)] border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
            {actionResultMessage}
          </div>
        ) : null}

        <ReviewHeader review={review} locale={locale} t={t} />

        {review.rejectionReason ? (
          <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{t("detail.rejectionReason", { reason: review.rejectionReason })}</p>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="grid gap-6">
            <ProjectSnapshot review={review} locale={locale} t={t} />
            <InvoiceReviewCard review={review} locale={locale} t={t} />
            <EventHistory events={review.events} locale={locale} t={t} />
          </div>
          <ReviewActions review={review} t={t} />
        </div>
      </section>
    </AppShell>
  );
}

function ReviewHeader({
  review,
  locale,
  t,
}: {
  review: AdminTimesheetReview;
  locale: string;
  t: AdminTimesheetsTranslator;
}) {
  return (
    <Card variant="featured" density="lg">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="flex items-start gap-4">
          <AvatarLabel name={review.contractorName} />
          <div>
            <StatusPill
              status={toTimesheetPreviewStatus(review.status)}
              label={getStatusLabel(review.status, t)}
              density="comfortable"
            />
            <h2 className="mt-3 text-2xl font-semibold text-foreground">
              {formatMonthLabel(review.periodStart, locale)}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {formatPeriodRange(review.periodStart, review.periodEnd, locale)}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {review.contractorName} · {review.contractorEmail}
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[34rem] xl:grid-cols-4">
          <SummaryMetric
            icon={Clock3}
            label={t("summary.hours")}
            value={formatHours(review.totalMinutes, locale)}
          />
          <SummaryMetric
            icon={WalletCards}
            label={t("summary.amount")}
            value={formatMoney(review.totalAmount, review.currencyCode, locale)}
          />
          <SummaryMetric
            icon={FileText}
            label={t("summary.entries")}
            value={formatCount(review.entryCount, locale)}
          />
          <SummaryMetric
            icon={ShieldCheck}
            label={t("summary.revision")}
            value={formatCount(review.revisionNumber, locale)}
          />
        </div>
      </div>
    </Card>
  );
}

function ProjectSnapshot({
  review,
  locale,
  t,
}: {
  review: AdminTimesheetReview;
  locale: string;
  t: AdminTimesheetsTranslator;
}) {
  return (
    <Card density="lg">
      <CardHeader className="block">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t("snapshot.title")}</CardTitle>
            <CardDescription>{t("snapshot.description")}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">{t("revision", { number: review.revisionNumber })}</Badge>
            <Badge tone={review.activeLockCount > 0 ? "success" : "warning"}>
              {review.activeLockCount > 0 ? t("snapshot.locked") : t("snapshot.unlocked")}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {review.projects.length > 0 ? (
          <div className="grid gap-4">
            {review.projects.map((project) => (
              <ProjectSnapshotCard
                key={project.projectId}
                project={project}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-secondary/45 px-5 py-8 text-center text-sm text-muted-foreground">
            {t("snapshot.empty")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectSnapshotCard({
  project,
  locale,
  t,
}: {
  project: AdminTimesheetReviewProject;
  locale: string;
  t: AdminTimesheetsTranslator;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-background/45 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className="size-3 rounded-full"
            style={{ backgroundColor: project.projectColor }}
            aria-hidden="true"
          />
          <div>
            <h3 className="font-ui text-sm font-semibold text-foreground">{project.projectName}</h3>
            <p className="text-xs text-muted-foreground">
              {t("snapshot.projectSummary", {
                hours: formatHours(project.totalMinutes, locale),
                entries: project.entryCount,
              })}
            </p>
          </div>
        </div>
        <p className="font-ui text-sm font-semibold text-foreground">
          {formatMoney(project.totalAmount, project.currencyCode, locale)}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse">
          <caption className="sr-only">{t("snapshot.lineCaption")}</caption>
          <thead>
            <tr className="border-b border-border">
              <HeadCell>{t("lineTable.date")}</HeadCell>
              <HeadCell>{t("lineTable.description")}</HeadCell>
              <HeadCell>{t("lineTable.hours")}</HeadCell>
              <HeadCell>{t("lineTable.rate")}</HeadCell>
              <HeadCell>{t("lineTable.amount")}</HeadCell>
            </tr>
          </thead>
          <tbody>
            {project.lines.map((line) => (
              <SnapshotLineRow key={line.id} line={line} locale={locale} t={t} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SnapshotLineRow({
  line,
  locale,
  t,
}: {
  line: AdminTimesheetReviewLine;
  locale: string;
  t: AdminTimesheetsTranslator;
}) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {formatDateOnlyLabel(line.localDate, locale)}
      </td>
      <td className="px-4 py-3 text-sm text-foreground">{line.description}</td>
      <td className="px-4 py-3 font-ui text-sm font-semibold text-foreground">
        {formatHours(line.durationMinutes, locale)}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {formatRate(line.hourlyRate, line.currencyCode, locale)} ·{" "}
        {t(`rateSource.${line.rateSource}`)}
      </td>
      <td className="px-4 py-3 font-ui text-sm font-semibold text-foreground">
        {formatMoney(line.lineAmount, line.currencyCode, locale)}
      </td>
    </tr>
  );
}

function InvoiceReviewCard({
  review,
  locale,
  t,
}: {
  review: AdminTimesheetReview;
  locale: string;
  t: AdminTimesheetsTranslator;
}) {
  const invoice = review.invoice;

  if (!invoice && review.status !== "APPROVED") {
    return null;
  }

  const pdfHref = invoice
    ? (`/admin/timesheets/${review.id}/invoice/${invoice.id}` as Route)
    : null;
  const comparison = invoice ? getInvoiceComparison(review, invoice, locale, t) : null;
  const canReviewInvoice =
    review.status === "INVOICED" &&
    invoice?.status === "UPLOADED" &&
    invoice.role !== "CANCELLATION";
  const relatedInvoices = invoice
    ? review.invoices.filter((relatedInvoice) => relatedInvoice.id !== invoice.id)
    : [];

  return (
    <Card density="lg">
      <CardHeader className="block">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t("invoice.title")}</CardTitle>
            <CardDescription>
              {invoice ? t("invoice.description") : t("invoice.awaitingDescription")}
            </CardDescription>
          </div>
          {invoice ? (
            <Badge tone={getInvoiceStatusTone(invoice.status)}>
              {t(`invoice.status.${invoice.status.toLowerCase()}`)}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {!invoice ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-secondary/45 px-5 py-8 text-center text-sm text-muted-foreground">
            {t("invoice.empty")}
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="grid gap-3 md:grid-cols-3">
              <InvoiceMetric
                label={t("invoice.systemTotal")}
                value={comparison?.systemTotal ?? "-"}
              />
              <InvoiceMetric
                label={t("invoice.invoiceTotal")}
                value={comparison?.invoiceTotal ?? "-"}
              />
              <div className="rounded-[var(--radius-lg)] border border-border bg-card/70 p-3">
                <div className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {t("invoice.matchState")}
                </div>
                <div
                  className={
                    comparison?.matches
                      ? "mt-2 inline-flex items-center gap-2 rounded-full bg-success/15 px-3 py-1 text-sm font-semibold text-success"
                      : "mt-2 inline-flex items-center gap-2 rounded-full bg-warning/15 px-3 py-1 text-sm font-semibold text-warning"
                  }
                >
                  {comparison?.matches ? (
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="size-4" aria-hidden="true" />
                  )}
                  {comparison?.matches ? t("invoice.match") : t("invoice.mismatch")}
                </div>
                {!comparison?.matches ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("invoice.difference", { amount: comparison?.difference ?? "-" })}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.72fr)_minmax(22rem,1fr)]">
              <div className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-background/45 p-4">
                <div>
                  <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t("invoice.metadata")}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-foreground">
                    {invoice.invoiceNumber}
                  </h3>
                </div>
                <dl className="grid gap-3 text-sm">
                  <InvoiceDefinition
                    label={t("invoice.role.label")}
                    value={getInvoiceRoleLabel(invoice.role, t)}
                  />
                  <InvoiceDefinition label={t("invoice.file")} value={invoice.originalFilename} />
                  <InvoiceDefinition
                    label={t("invoice.uploadedAt")}
                    value={formatTimestamp(invoice.uploadedAt, locale)}
                  />
                  <InvoiceDefinition
                    label={t("invoice.fileSize")}
                    value={formatBytes(invoice.byteSize, locale)}
                  />
                  {invoice.rejectionReason ? (
                    <InvoiceDefinition
                      label={t("invoice.rejectionReason")}
                      value={invoice.rejectionReason}
                    />
                  ) : null}
                </dl>
                <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {t("invoice.compareHint")}
                </p>
              </div>

              <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-background">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/45 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                    <p className="truncate text-sm font-semibold text-foreground">
                      {invoice.originalFilename}
                    </p>
                  </div>
                  {pdfHref ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={pdfHref} target="_blank">
                        <Download className="size-4" aria-hidden="true" />
                        {t("invoice.openPdf")}
                      </Link>
                    </Button>
                  ) : null}
                </div>
                {pdfHref ? (
                  <iframe
                    src={pdfHref}
                    title={t("invoice.pdfTitle", { filename: invoice.originalFilename })}
                    className="h-[38rem] w-full bg-white"
                  />
                ) : null}
              </div>
            </div>

            {relatedInvoices.length > 0 ? (
              <RelatedInvoiceDocuments
                timesheetId={review.id}
                invoices={relatedInvoices}
                locale={locale}
                t={t}
              />
            ) : null}

            {canReviewInvoice ? (
              <div className="grid gap-4 rounded-[var(--radius-lg)] border border-border bg-secondary/35 p-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
                <form action={acceptInvoiceReviewAction}>
                  <input type="hidden" name="timesheetId" value={review.id} />
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <Button type="submit" icon={CheckCheck} className="w-full">
                    {t("invoice.accept")}
                  </Button>
                </form>

                <form action={rejectInvoiceReviewAction} className="grid gap-3">
                  <input type="hidden" name="timesheetId" value={review.id} />
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <Field label={t("invoice.rejectReason")} htmlFor="invoice-reject-reason" required>
                    <Textarea
                      id="invoice-reject-reason"
                      name="reason"
                      required
                      minLength={3}
                      rows={4}
                      placeholder={t("invoice.rejectPlaceholder")}
                    />
                  </Field>
                  <Button type="submit" variant="danger" icon={XCircle} className="w-full">
                    {t("invoice.reject")}
                  </Button>
                </form>
              </div>
            ) : (
              <div className="rounded-[var(--radius-lg)] border border-border bg-secondary/35 p-4 text-sm text-muted-foreground">
                {getInvoiceClosedMessage(review, t)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InvoiceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card/70 p-3">
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function InvoiceDefinition({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium text-foreground">{value}</dd>
    </div>
  );
}

function RelatedInvoiceDocuments({
  timesheetId,
  invoices,
  locale,
  t,
}: {
  timesheetId: string;
  invoices: AdminTimesheetReviewInvoice[];
  locale: string;
  t: AdminTimesheetsTranslator;
}) {
  return (
    <div className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-background/45 p-4">
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {t("invoice.relatedDocuments")}
      </p>
      <div className="grid gap-2">
        {invoices.map((invoice) => {
          const pdfHref = `/admin/timesheets/${timesheetId}/invoice/${invoice.id}` as Route;

          return (
            <div
              key={invoice.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-card/70 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={getInvoiceStatusTone(invoice.status)}>
                    {t(`invoice.status.${invoice.status.toLowerCase()}`)}
                  </Badge>
                  <Badge tone="neutral">{getInvoiceRoleLabel(invoice.role, t)}</Badge>
                </div>
                <p className="mt-2 truncate text-sm font-semibold text-foreground">
                  {invoice.invoiceNumber} ·{" "}
                  {formatMoney(invoice.declaredAmount, invoice.currencyCode, locale)}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {invoice.originalFilename}
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href={pdfHref} target="_blank">
                  <Download className="size-4" aria-hidden="true" />
                  {t("invoice.openPdf")}
                </Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventHistory({
  events,
  locale,
  t,
}: {
  events: AdminTimesheetReviewEvent[];
  locale: string;
  t: AdminTimesheetsTranslator;
}) {
  return (
    <Card density="lg">
      <CardHeader className="block">
        <CardTitle>{t("events.title")}</CardTitle>
        <CardDescription>{t("events.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length > 0 ? (
          <div className="grid gap-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="rounded-[var(--radius-lg)] border border-border bg-background/45 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge tone={getEventTone(event.eventType)}>
                      {t(`events.types.${event.eventType.toLowerCase()}`)}
                    </Badge>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {event.actorName} · {event.actorEmail}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatTimestamp(event.createdAt, locale)}
                  </p>
                </div>
                {event.reason ? (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{event.reason}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-secondary/45 px-5 py-8 text-center text-sm text-muted-foreground">
            {t("events.empty")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewActions({
  review,
  t,
}: {
  review: AdminTimesheetReview;
  t: AdminTimesheetsTranslator;
}) {
  const canReview = review.status === "SUBMITTED";

  return (
    <Card density="lg" className="h-fit">
      <CardHeader className="block">
        <CardTitle>{t("actions.title")}</CardTitle>
        <CardDescription>{t("actions.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {canReview ? (
          <div className="grid gap-5">
            <form action={approveTimesheetReviewAction}>
              <input type="hidden" name="timesheetId" value={review.id} />
              <Button type="submit" icon={CheckCircle2} className="w-full">
                {t("actions.approve")}
              </Button>
            </form>

            <form action={rejectTimesheetReviewAction} className="grid gap-3">
              <input type="hidden" name="timesheetId" value={review.id} />
              <Field label={t("actions.rejectReason")} htmlFor="timesheet-reject-reason" required>
                <Textarea
                  id="timesheet-reject-reason"
                  name="reason"
                  required
                  minLength={3}
                  rows={5}
                  placeholder={t("actions.rejectPlaceholder")}
                />
              </Field>
              <Button type="submit" variant="danger" icon={XCircle} className="w-full">
                {t("actions.rejectAndUnlock")}
              </Button>
            </form>
          </div>
        ) : (
          <div className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-secondary/45 p-4 text-sm text-muted-foreground">
            <p>{t("actions.closed", { status: getStatusLabel(review.status, t) })}</p>
            {review.activeLockCount > 0 ? (
              <p>{t("actions.locked")}</p>
            ) : (
              <p className="inline-flex items-center gap-2">
                <Unlock className="size-4" aria-hidden />
                {t("actions.unlocked")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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

function AvatarLabel({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part.at(0))
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent/20 font-ui text-sm font-bold text-accent">
      {initials || "TS"}
    </span>
  );
}

function HeadCell({ children }: { children: string }) {
  return (
    <th className="px-4 py-3 text-left font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </th>
  );
}

function formatDateOnlyLabel(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function getEventTone(eventType: string) {
  if (eventType === "APPROVED") return "success";
  if (eventType === "REJECTED" || eventType === "INVOICE_REJECTED") return "danger";
  if (eventType === "INVOICE_ACCEPTED") return "success";
  if (eventType === "UNLOCKED") return "warning";
  if (eventType === "SUBMITTED" || eventType === "RESUBMITTED") return "info";
  return "neutral";
}

function getInvoiceStatusTone(status: NonNullable<AdminTimesheetReview["invoice"]>["status"]) {
  if (status === "ACCEPTED") return "success";
  if (status === "REJECTED" || status === "CANCELLED" || status === "DELETED") return "danger";
  if (status === "REPLACED") return "warning";
  return "info";
}

function getInvoiceRoleLabel(
  role: NonNullable<AdminTimesheetReview["invoice"]>["role"],
  t: AdminTimesheetsTranslator,
) {
  return t(`invoice.role.${role.toLowerCase()}`);
}

function getInvoiceComparison(
  review: AdminTimesheetReview,
  invoice: NonNullable<AdminTimesheetReview["invoice"]>,
  locale: string,
  t: AdminTimesheetsTranslator,
) {
  const systemAmount = Number(review.totalAmount);
  const invoiceAmount = Number(invoice.declaredAmount);
  const sameCurrency = review.currencyCode === invoice.currencyCode;
  const difference = sameCurrency ? invoiceAmount - systemAmount : null;

  return {
    systemTotal: formatMoney(review.totalAmount, review.currencyCode, locale),
    invoiceTotal: formatMoney(invoice.declaredAmount, invoice.currencyCode, locale),
    matches: sameCurrency && Math.abs(difference ?? 0) < 0.005,
    difference:
      difference === null
        ? t("invoice.currencyDifference", {
            system: review.currencyCode,
            invoice: invoice.currencyCode,
          })
        : formatMoney(difference.toFixed(2), review.currencyCode, locale),
  };
}

function getInvoiceClosedMessage(review: AdminTimesheetReview, t: AdminTimesheetsTranslator) {
  if (review.invoice?.status === "ACCEPTED" || review.status === "ACCEPTED") {
    return t("invoice.acceptedMessage");
  }

  if (review.invoice?.status === "REJECTED" || review.status === "INVOICE_REJECTED") {
    return t("invoice.rejectedMessage");
  }

  return t("invoice.notReviewable");
}

function formatBytes(value: number, locale: string) {
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(value / 1024);

  return `${formatted} KB`;
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.at(0) ?? "";
  return value ?? "";
}
