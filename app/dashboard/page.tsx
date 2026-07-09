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
  const shellRole = mapMemberToShellRole(member);
  const shellUser = mapMemberToShellUser(member);

  return (
    <AppShell current="dashboard" role={shellRole} user={shellUser}>
      <section className="mx-auto grid w-full max-w-[92rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow="Home"
          title="Dashboard"
          subtitle="Track work, review assignments, and continue from the workflows available to you."
        />
        <DashboardCards
          name={shellUser.name}
          role={shellRole === "admin" ? "admin" : shellRole}
          roleLabel={shellUser.role}
          greeting={`Welcome, ${shellUser.name}`}
          summary={
            shellRole === "admin"
              ? "Admin workflows are available from the sidebar."
              : "Your time tracking workspace is ready."
          }
        />
      </section>
    </AppShell>
  );
}
