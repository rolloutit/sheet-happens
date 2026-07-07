import { AppShell } from "@/src/components/layout/AppShell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/Card";
import { mapMemberToShellUser, requireAdminAppMember } from "@/src/server/auth/app-access";
import { listProjectsForAdmin } from "@/src/server/projects";
import { AdminProjectsTable } from "./AdminProjectsTable";
import { ProjectCreateForm } from "./ProjectCreateForm";

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  const { member: admin } = await requireAdminAppMember("/admin/projects");
  const projects = await listProjectsForAdmin();
  const activeProjects = projects.filter((project) => project.status === "ACTIVE").length;
  const internalProjects = projects.filter((project) => project.isInternal).length;

  return (
    <AppShell current="projects" role="admin" user={mapMemberToShellUser(admin)}>
      <section className="mx-auto grid w-full max-w-[92rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <p className="font-ui text-sm font-medium uppercase tracking-[0.18em] text-accent">
            Admin
          </p>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Projects</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Create work targets, control their active state, and keep archived projects
                available for historical reporting.
              </p>
            </div>
            <div className="grid min-w-72 grid-cols-3 gap-2 rounded-[var(--radius-lg)] border border-border bg-card/70 p-3 text-center">
              <div>
                <p className="text-2xl font-semibold text-foreground">{projects.length}</p>
                <p className="font-ui text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Projects
                </p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-accent">{activeProjects}</p>
                <p className="font-ui text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Active
                </p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-warning">{internalProjects}</p>
                <p className="font-ui text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Internal
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <Card density="lg">
            <CardHeader className="block">
              <CardTitle>Create project</CardTitle>
              <CardDescription>
                Projects are the primary work targets for assignments, time entries, and future
                timesheet validation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectCreateForm />
            </CardContent>
          </Card>

          <Card density="lg">
            <CardHeader className="block">
              <CardTitle>Project directory</CardTitle>
              <CardDescription>
                Active projects are available for future assignment and time tracking. Archived
                projects stay out of the working list but remain in historical data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminProjectsTable rows={projects} />
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
