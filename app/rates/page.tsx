import { GitBranch, LockKeyhole } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import { Badge } from "@/src/components/ui/Badge";
import { Card } from "@/src/components/ui/Card";
import { SectionHead } from "@/src/components/ui/SectionHead";
import { formatDateLabel, formatRate } from "@/src/lib/formatting";
import {
  mapMemberToShellProfile,
  mapMemberToShellRole,
  mapMemberToShellUser,
  requireActiveAppMember,
} from "@/src/server/auth/app-access";
import { getOwnRatesForMember, type OwnProjectRate, type OwnRatePeriod } from "@/src/server/rates";

export const dynamic = "force-dynamic";

export default async function MyRatesPage() {
  const { member } = await requireActiveAppMember("/rates");
  const [rates, t, locale] = await Promise.all([
    getOwnRatesForMember(member),
    getTranslations("MyRates"),
    getLocale(),
  ]);
  const isEmployee = rates.profile === "EMPLOYEE";

  return (
    <AppShell
      current="my-rates"
      role={mapMemberToShellRole(member)}
      profile={mapMemberToShellProfile(member)}
      user={mapMemberToShellUser(member)}
    >
      <section className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={isEmployee ? t("subtitle.employee") : t("subtitle.contractor")}
          actions={
            <Badge tone={isEmployee ? "warning" : "info"} dot>
              {isEmployee ? t("profiles.employee") : t("profiles.contractor")}
            </Badge>
          }
        />

        <Card density="lg">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">{t("central.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEmployee ? t("central.employeeDescription") : t("central.contractorDescription")}
            </p>
          </div>
          {rates.centralPeriods.length > 0 ? (
            <RateTimeline periods={rates.centralPeriods} locale={locale} />
          ) : (
            <div className="rounded-[var(--radius-md)] border border-dashed border-border-strong px-5 py-8 text-center">
              <p className="font-semibold">{t("central.emptyTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("central.emptyDescription")}</p>
            </div>
          )}
        </Card>

        {!isEmployee && rates.projectRates.length > 0 ? (
          <Card density="lg">
            <h2 className="mb-2 text-lg font-semibold">{t("projects.title")}</h2>
            <div className="divide-y divide-border">
              {rates.projectRates.map((project) => (
                <ProjectRateRow key={project.projectId} project={project} locale={locale} />
              ))}
            </div>
          </Card>
        ) : null}

        <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-secondary px-4 py-3 text-sm text-muted-foreground">
          <LockKeyhole className="size-4 shrink-0" aria-hidden="true" />
          {t("privacy")}
        </div>
      </section>
    </AppShell>
  );
}

async function RateTimeline({ periods, locale }: { periods: OwnRatePeriod[]; locale: string }) {
  const t = await getTranslations("MyRates");

  return (
    <div className="grid">
      {periods.map((period, index) => (
        <div
          key={period.id}
          className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[1.25rem_minmax(0,1fr)_auto_auto] sm:items-center"
        >
          <div className="relative flex h-full min-h-14 justify-center">
            <span
              className={
                period.current
                  ? "mt-5 size-2.5 rounded-full border-[3px] border-accent-soft bg-accent"
                  : "mt-5 size-2 rounded-full bg-border-strong"
              }
            />
            {index < periods.length - 1 ? (
              <span className="absolute bottom-0 top-8 w-px bg-border" />
            ) : null}
          </div>
          <p className="py-4 text-sm text-muted-foreground">
            {formatDateLabel(period.validFrom, locale)} {t("period.to")}{" "}
            {period.validTo ? formatDateLabel(period.validTo, locale) : t("period.open")}
          </p>
          <p className="col-start-2 pb-4 text-base font-semibold sm:col-auto sm:py-4 sm:text-lg">
            {formatRate(period.hourlyRate, period.currencyCode, locale)}
          </p>
          <div className="col-start-2 pb-4 sm:col-auto sm:py-4">
            {period.current ? (
              <Badge tone="info" dot>
                {t("period.current")}
              </Badge>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

async function ProjectRateRow({ project, locale }: { project: OwnProjectRate; locale: string }) {
  const t = await getTranslations("MyRates");

  return (
    <div className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-semibold">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: project.projectColor }}
          />
          <span className="truncate">{project.projectName}</span>
        </p>
        <p className="ml-[1.125rem] mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {project.source === "override" ? (
            <>
              <GitBranch className="size-3 text-accent" aria-hidden="true" />
              <span className="text-accent">{t("projects.override")}</span>
            </>
          ) : project.source === "central" ? (
            t("projects.followsCentral")
          ) : (
            t("projects.missing")
          )}
        </p>
      </div>
      <div className="ml-[1.125rem] text-left sm:ml-0 sm:text-right">
        <p className="text-lg font-semibold">
          {project.hourlyRate && project.currencyCode
            ? formatRate(project.hourlyRate, project.currencyCode, locale)
            : t("projects.notSet")}
        </p>
        <p className="text-xs text-muted-foreground">{t("projects.current")}</p>
      </div>
    </div>
  );
}
