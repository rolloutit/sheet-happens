import { getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import { SectionHead } from "@/src/components/ui/SectionHead";
import { getMemberPreferenceOptions } from "@/src/lib/member-preferences";
import {
  mapMemberToShellProfile,
  mapMemberToShellUser,
  requireAdminAppMember,
} from "@/src/server/auth/app-access";
import { listPeopleForAdmin, type PeopleListSearchParams } from "@/src/server/users";
import { AdminPeopleTable } from "./AdminPeopleTable";
import { InviteMemberButton } from "./InviteMemberButton";

export const dynamic = "force-dynamic";

type AdminPeoplePageProps = {
  searchParams?: Promise<PeopleListSearchParams>;
};

export default async function AdminPeoplePage({ searchParams }: AdminPeoplePageProps) {
  const { member: admin } = await requireAdminAppMember("/admin/people");
  const t = await getTranslations("AdminPeople");
  const resolvedSearchParams = (await searchParams) ?? {};
  const people = await listPeopleForAdmin(resolvedSearchParams);
  const preferenceOptions = getMemberPreferenceOptions();
  const todayDate = new Date().toISOString().slice(0, 10);

  return (
    <AppShell
      current="people"
      role="admin"
      profile={mapMemberToShellProfile(admin)}
      user={mapMemberToShellUser(admin)}
    >
      <section className="mx-auto grid w-full max-w-[92rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={t("subtitle")}
          actions={
            <>
              <div className="grid min-w-48 grid-cols-2 gap-2 rounded-[var(--radius-lg)] border border-border bg-card/70 p-3 text-center">
                <div>
                  <p className="text-2xl font-semibold text-foreground">
                    {people.stats.totalMembers}
                  </p>
                  <p className="font-ui text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {t("stats.members")}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-accent">
                    {people.stats.invitedMembers}
                  </p>
                  <p className="font-ui text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {t("stats.invited")}
                  </p>
                </div>
              </div>
              <InviteMemberButton />
            </>
          }
        />

        <AdminPeopleTable
          result={people}
          currentMemberId={admin.id}
          preferenceOptions={preferenceOptions}
          todayDate={todayDate}
        />
      </section>
    </AppShell>
  );
}
