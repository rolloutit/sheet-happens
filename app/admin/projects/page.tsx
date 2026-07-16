import { getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/Card";
import { mapMemberToShellUser, requireAdminAppMember } from "@/src/server/auth/app-access";
import {
  listProjectAssignableMembersForAdmin,
  listProjectAssignmentsForAdmin,
  listProjectGroupsForAdmin,
  listProjectsForAdmin,
} from "@/src/server/projects";
import { listAssignmentRatesForAdmin } from "@/src/server/rates";
import { AdminProjectGroupsPanel } from "./AdminProjectGroupsPanel";
import { AdminProjectsTable } from "./AdminProjectsTable";
import { ProjectCreateForm } from "./ProjectCreateForm";

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  const { member: admin } = await requireAdminAppMember("/admin/projects");
  const t = await getTranslations("AdminProjects");
  const [projects, groups, assignments, assignmentRates, assignableMembers] = await Promise.all([
    listProjectsForAdmin(),
    listProjectGroupsForAdmin(),
    listProjectAssignmentsForAdmin(),
    listAssignmentRatesForAdmin(),
    listProjectAssignableMembersForAdmin(),
  ]);
  const activeProjects = projects.filter((project) => project.status === "ACTIVE").length;
  const internalProjects = projects.filter((project) => project.isInternal).length;
  const todayDate = new Date().toISOString().slice(0, 10);

  return (
    <AppShell current="projects" role="admin" user={mapMemberToShellUser(admin)}>
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
            <div className="grid min-w-72 grid-cols-3 gap-2 rounded-[var(--radius-lg)] border border-border bg-card/70 p-3 text-center">
              <div>
                <p className="text-2xl font-semibold text-foreground">{projects.length}</p>
                <p className="font-ui text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {t("stats.projects")}
                </p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-accent">{activeProjects}</p>
                <p className="font-ui text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {t("stats.active")}
                </p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-warning">{internalProjects}</p>
                <p className="font-ui text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {t("stats.internal")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <Card density="lg">
            <CardHeader className="block">
              <CardTitle>{t("create.title")}</CardTitle>
              <CardDescription>{t("create.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectCreateForm />
            </CardContent>
          </Card>

          <Card density="lg">
            <CardHeader className="block">
              <CardTitle>{t("directory.title")}</CardTitle>
              <CardDescription>{t("directory.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminProjectsTable
                rows={projects}
                groups={groups}
                assignments={assignments}
                assignmentRates={assignmentRates}
                assignableMembers={assignableMembers}
                todayDate={todayDate}
              />
            </CardContent>
          </Card>

          <Card density="lg">
            <CardHeader className="block">
              <CardTitle>{t("groups.title")}</CardTitle>
              <CardDescription>{t("groups.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminProjectGroupsPanel groups={groups} projects={projects} />
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
