import { getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/Card";
import { listAuditLogsForAdmin, type AuditLogSearchParams } from "@/src/server/audit";
import {
  mapMemberToShellProfile,
  mapMemberToShellUser,
  requireAdminAppMember,
} from "@/src/server/auth/app-access";
import { AdminAuditLogClient } from "./AdminAuditLogClient";

export const dynamic = "force-dynamic";

type AdminAuditPageProps = {
  searchParams?: Promise<AuditLogSearchParams>;
};

export default async function AdminAuditPage({ searchParams }: AdminAuditPageProps) {
  const { member: admin } = await requireAdminAppMember("/admin/audit");
  const t = await getTranslations("AdminAudit");
  const resolvedSearchParams = (await searchParams) ?? {};
  const auditLog = await listAuditLogsForAdmin(resolvedSearchParams, {
    timeZone: "Europe/Budapest",
  });

  return (
    <AppShell
      current="audit"
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
            <div className="grid min-w-72 grid-cols-2 gap-2 rounded-[var(--radius-lg)] border border-border bg-card/70 p-3 text-center">
              <div>
                <p className="text-2xl font-semibold text-foreground">{auditLog.totalItems}</p>
                <p className="font-ui text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {t("stats.matching")}
                </p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-accent">{auditLog.totalPages}</p>
                <p className="font-ui text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {t("stats.pages")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <Card density="lg">
          <CardHeader className="block">
            <CardTitle>{t("watcher.title")}</CardTitle>
            <CardDescription>{t("watcher.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminAuditLogClient result={auditLog} />
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
