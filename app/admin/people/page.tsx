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
  const people = await listPeopleForAdmin();
  const preferenceOptions = getMemberPreferenceOptions();
  const todayDate = new Date().toISOString().slice(0, 10);

  return (
    <AppShell current="people" role="admin" user={mapMemberToShellUser(admin)}>
      <section className="mx-auto grid w-full max-w-[92rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <p className="font-ui text-sm font-medium uppercase tracking-[0.18em] text-accent">
            Admin
          </p>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-3xl font-bold text-foreground">People</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Invite contractors and employees, track activation state, and keep the member
                profile layer separate from Better Auth accounts.
              </p>
            </div>
            <div className="grid min-w-48 grid-cols-2 gap-2 rounded-[var(--radius-lg)] border border-border bg-card/70 p-3 text-center">
              <div>
                <p className="text-2xl font-semibold text-foreground">{people.length}</p>
                <p className="font-ui text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Members
                </p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-accent">
                  {people.filter((person) => person.state === "invited").length}
                </p>
                <p className="font-ui text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Invited
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <Card density="lg">
            <CardHeader className="block">
              <CardTitle>Invite member</CardTitle>
              <CardDescription>
                Creates an invited member profile, stores the invitation audit event, and sends the
                acceptance link through the configured SMTP transport.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InviteMemberForm preferenceOptions={preferenceOptions} />
            </CardContent>
          </Card>

          <Card density="lg">
            <CardHeader className="block">
              <CardTitle>Member directory</CardTitle>
              <CardDescription>
                This table is backed by the domain member profile, not raw Better Auth users.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminPeopleTable
                rows={people}
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
