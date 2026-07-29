import type { Route } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/Card";
import {
  mapMemberToShellProfile,
  mapMemberToShellUser,
  requireAdminAppMember,
} from "@/src/server/auth/app-access";
import {
  runSystemChecks,
  type SystemCheckResult,
  type SystemCheckStatus,
} from "@/src/server/system";

export const dynamic = "force-dynamic";

type AdminSystemTranslator = Awaited<ReturnType<typeof getTranslations>>;

export default async function AdminSystemPage() {
  const { member: admin } = await requireAdminAppMember("/admin/system");
  const t = await getTranslations("AdminSystem");
  const summary = await runSystemChecks();
  const passCount = summary.checks.filter((check) => check.status === "pass").length;
  const warningCount = summary.checks.filter((check) => check.status === "warning").length;
  const failCount = summary.checks.filter((check) => check.status === "fail").length;

  return (
    <AppShell
      current="system"
      role="admin"
      profile={mapMemberToShellProfile(admin)}
      user={mapMemberToShellUser(admin)}
    >
      <section className="mx-auto grid w-full max-w-[92rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <p className="font-ui text-sm font-medium uppercase tracking-[0.18em] text-accent">
            {t("eyebrow")}
          </p>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {t("subtitle")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="soft" icon={RefreshCw}>
                <Link href={"/admin/system" as Route}>{t("actions.refresh")}</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href={"/api/admin/system-check" as Route} target="_blank">
                  {t("actions.openJson")}
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryTile
            label={t("stats.overall")}
            value={t(`statuses.${summary.status}`)}
            tone={summary.status}
          />
          <SummaryTile label={t("stats.passing")} value={String(passCount)} tone="pass" />
          <SummaryTile label={t("stats.warnings")} value={String(warningCount)} tone="warning" />
          <SummaryTile label={t("stats.failing")} value={String(failCount)} tone="fail" />
        </div>

        <Card density="lg">
          <CardHeader className="block">
            <CardTitle>{t("checks.title")}</CardTitle>
            <CardDescription>
              {t("checks.description", { checkedAt: summary.checkedAt })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {summary.checks.map((check) => (
                <SystemCheckCard key={check.id} check={check} t={t} />
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: SystemCheckStatus;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card/70 p-4">
      <p className="font-ui text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className={getSummaryValueClassName(tone)}>{value}</p>
    </div>
  );
}

function SystemCheckCard({ check, t }: { check: SystemCheckResult; t: AdminSystemTranslator }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-secondary/25 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <span className={getIconWrapClassName(check.status)}>{getStatusIcon(check.status)}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-foreground">
                {t(`checks.items.${check.id}.title`)}
              </h3>
              <Badge tone={getBadgeTone(check.status)}>{t(`statuses.${check.status}`)}</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              {t(`messages.${check.code}`)}
            </p>
          </div>
        </div>
        <p className="shrink-0 font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t("duration", { durationMs: check.durationMs })}
        </p>
      </div>

      {check.missingEnv?.length ? (
        <div className="mt-4 rounded-[var(--radius-md)] border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("missingEnv", { names: check.missingEnv.join(", ") })}
        </div>
      ) : null}

      {check.error ? (
        <div className="mt-4 rounded-[var(--radius-md)] border border-border bg-background/55 px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
          {check.error}
        </div>
      ) : null}

      <dl className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {check.details.map((detail) => (
          <div
            key={`${check.id}-${detail.label}`}
            className="rounded-[var(--radius-md)] border border-border bg-background/45 px-3 py-2"
          >
            <dt className="font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {getDetailLabel(detail.label, t)}
            </dt>
            <dd className="mt-1 break-words text-sm font-medium text-foreground">{detail.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function getStatusIcon(status: SystemCheckStatus) {
  if (status === "pass") return <CheckCircle2 className="size-5" aria-hidden="true" />;
  if (status === "warning") return <AlertTriangle className="size-5" aria-hidden="true" />;
  return <XCircle className="size-5" aria-hidden="true" />;
}

function getBadgeTone(status: SystemCheckStatus) {
  if (status === "pass") return "success";
  if (status === "warning") return "warning";
  return "danger";
}

function getSummaryValueClassName(tone: SystemCheckStatus) {
  const base = "mt-2 text-2xl font-semibold";
  if (tone === "pass") return `${base} text-success`;
  if (tone === "warning") return `${base} text-warning`;
  return `${base} text-destructive`;
}

function getIconWrapClassName(status: SystemCheckStatus) {
  const base = "grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] border";
  if (status === "pass") return `${base} border-success/25 bg-success/12 text-success`;
  if (status === "warning") return `${base} border-warning/25 bg-warning/12 text-warning`;
  return `${base} border-destructive/25 bg-destructive/12 text-destructive`;
}

function getDetailLabel(label: string, t: AdminSystemTranslator) {
  if (/^[A-Z0-9_]+$/.test(label)) return label;
  return t(`details.${label}`);
}
