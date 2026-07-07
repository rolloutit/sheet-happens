import { AppShell } from "@/src/components/layout/AppShell";
import { getMemberPreferenceOptions } from "@/src/lib/member-preferences";
import { mapMemberToShellUser, requireAdminAppMember } from "@/src/server/auth/app-access";
import { listProjectsForAdmin } from "@/src/server/projects";
import { listAssignmentRatesForAdmin, listMemberRatesForAdmin } from "@/src/server/rates";
import { AdminRatesTable } from "./AdminRatesTable";

export const dynamic = "force-dynamic";

export default async function AdminRatesPage() {
  const { member: admin } = await requireAdminAppMember("/admin/rates");
  const [rates, assignmentRates, projects] = await Promise.all([
    listMemberRatesForAdmin(),
    listAssignmentRatesForAdmin(),
    listProjectsForAdmin(),
  ]);
  const preferenceOptions = getMemberPreferenceOptions();
  const todayDate = new Date().toISOString().slice(0, 10);

  return (
    <AppShell current="rates" role="admin" user={mapMemberToShellUser(admin)}>
      <section className="mx-auto grid w-full max-w-[58.5rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <p className="font-ui text-sm font-medium uppercase tracking-[0.18em] text-accent">
            Admin
          </p>
          <h1 className="text-4xl font-semibold tracking-normal text-foreground">Rates</h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Internal rates by person and effective period. Contractor project overrides are managed
            in the drawer. Every change is audit-logged.
          </p>
        </div>

        <AdminRatesTable
          rows={rates}
          assignmentRates={assignmentRates}
          projects={projects}
          currencyOptions={preferenceOptions.currencies}
          todayDate={todayDate}
        />
      </section>
    </AppShell>
  );
}
