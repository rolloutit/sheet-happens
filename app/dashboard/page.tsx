import { getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import { DashboardCards } from "@/src/components/sheet/DashboardCards";
import { SectionHead } from "@/src/components/ui/SectionHead";
import {
  mapMemberToShellRole,
  mapMemberToShellUser,
  requireActiveAppMember,
} from "@/src/server/auth/app-access";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { member } = await requireActiveAppMember("/dashboard");
  const t = await getTranslations("Dashboard");
  const shellRole = mapMemberToShellRole(member);
  const shellUser = mapMemberToShellUser(member);

  return (
    <AppShell current="dashboard" role={shellRole} user={shellUser}>
      <section className="mx-auto grid w-full max-w-[92rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <SectionHead eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
        <DashboardCards
          name={shellUser.name}
          role={shellRole === "admin" ? "admin" : shellRole}
          roleLabel={shellUser.role}
          greeting={t("greeting", { name: shellUser.name })}
          summary={shellRole === "admin" ? t("summary.admin") : t("summary.member")}
        />
      </section>
    </AppShell>
  );
}
