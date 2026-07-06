import { AppShell } from "@/src/components/layout/AppShell";
import { DashboardCards } from "@/src/components/sheet/DashboardCards";
import { Badge } from "@/src/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { SectionHead } from "@/src/components/ui/SectionHead";
import {
  mapMemberToShellRole,
  mapMemberToShellUser,
  requireActiveAppMember,
} from "@/src/server/auth/app-access";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { member, authUser } = await requireActiveAppMember("/dashboard");
  const shellRole = mapMemberToShellRole(member);
  const shellUser = mapMemberToShellUser(member);

  return (
    <AppShell current="dashboard" role={shellRole} user={shellUser}>
      <section className="mx-auto grid w-full max-w-[92rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow="Home"
          title="Dashboard"
          subtitle="The protected app shell is now connected to the real member and Better Auth session."
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
        {process.env.NODE_ENV !== "production" ? (
          <Card density="lg">
            <CardHeader>
              <CardTitle>Dev session</CardTitle>
              <Badge tone="info">Local only</Badge>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
              <DevFact label="Member" value={member.id} />
              <DevFact label="Email" value={member.email} />
              <DevFact label="Role" value={member.role} />
              <DevFact label="Profile" value={member.currentProfile} />
              <DevFact label="Status" value={member.status} />
              <DevFact label="Auth user" value={authUser.id} />
            </CardContent>
          </Card>
        ) : null}
      </section>
    </AppShell>
  );
}

function DevFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-secondary/50 p-3">
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-all font-mono text-xs text-foreground">{value}</p>
    </div>
  );
}
