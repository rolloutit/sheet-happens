import { getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/Card";
import { getMemberPreferenceOptions } from "@/src/lib/member-preferences";
import { mapMemberToShellUser, requireAdminAppMember } from "@/src/server/auth/app-access";
import { listPeopleForAdmin } from "@/src/server/users";
import { AdminPeopleTable } from "./AdminPeopleTable";
import { InviteMemberForm } from "./InviteMemberForm";

export const dynamic = "force-dynamic";

export default async function AdminPeoplePage() {
  const { member: admin } = await requireAdminAppMember("/admin/people");
  const t = await getTranslations("AdminPeople");
  const people = await listPeopleForAdmin();
  const preferenceOptions = getMemberPreferenceOptions();
  const todayDate = new Date().toISOString().slice(0, 10);

  return (
    <AppShell current="people" role="admin" user={mapMemberToShellUser(admin)}>
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
            <div className="grid min-w-48 grid-cols-2 gap-2 rounded-[var(--radius-lg)] border border-border bg-card/70 p-3 text-center">
              <div>
                <p className="text-2xl font-semibold text-foreground">{people.length}</p>
                <p className="font-ui text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {t("stats.members")}
                </p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-accent">
                  {people.filter((person) => person.state === "invited").length}
                </p>
                <p className="font-ui text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {t("stats.invited")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <Card density="lg">
            <CardHeader className="block">
              <CardTitle>{t("invite.title")}</CardTitle>
              <CardDescription>{t("invite.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <InviteMemberForm preferenceOptions={preferenceOptions} />
            </CardContent>
          </Card>

          <Card density="lg">
            <CardHeader className="block">
              <CardTitle>{t("directory.title")}</CardTitle>
              <CardDescription>{t("directory.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminPeopleTable
                rows={people}
                currentMemberId={admin.id}
                preferenceOptions={preferenceOptions}
                todayDate={todayDate}
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
