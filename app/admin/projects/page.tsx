import { getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/Card";
import { SectionHead } from "@/src/components/ui/SectionHead";
import {
  mapMemberToShellProfile,
  mapMemberToShellUser,
  requireAdminAppMember,
} from "@/src/server/auth/app-access";
import {
  listProjectAssignableMembersForAdmin,
  listProjectAssignmentsForAdmin,
  listProjectDirectoryForAdmin,
  listProjectGroupsForAdmin,
  listProjectOptionsForAdmin,
  type ProjectListSearchParams,
} from "@/src/server/projects";
import { listAssignmentRatesForAdmin } from "@/src/server/rates";
import { AdminProjectGroupsPanel } from "./AdminProjectGroupsPanel";
import { AdminProjectsTable } from "./AdminProjectsTable";
import { ProjectBulkAssignButton } from "./ProjectBulkAssignButton";
import { ProjectCreateButton } from "./ProjectCreateButton";
import { ProjectGroupCreateButton } from "./ProjectGroupCreateButton";

export const dynamic = "force-dynamic";

type AdminProjectsPageProps = {
  searchParams?: Promise<ProjectListSearchParams>;
};

export default async function AdminProjectsPage({ searchParams }: AdminProjectsPageProps) {
  const { member: admin } = await requireAdminAppMember("/admin/projects");
  const t = await getTranslations("AdminProjects");
  const resolvedSearchParams = (await searchParams) ?? {};
  const [
    projectDirectory,
    projectOptions,
    groups,
    assignments,
    assignmentRates,
    assignableMembers,
  ] = await Promise.all([
    listProjectDirectoryForAdmin(resolvedSearchParams),
    listProjectOptionsForAdmin(),
    listProjectGroupsForAdmin(),
    listProjectAssignmentsForAdmin(),
    listAssignmentRatesForAdmin(),
    listProjectAssignableMembersForAdmin(),
  ]);
  const activeProjects = projectDirectory.stats.activeProjects;
  const internalProjects = projectDirectory.stats.internalProjects;
  const totalProjects = projectDirectory.stats.totalProjects;
  const todayDate = new Date().toISOString().slice(0, 10);

  return (
    <AppShell
      current="projects"
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
              <div className="grid min-w-72 grid-cols-3 gap-2 rounded-[var(--radius-lg)] border border-border bg-card/70 p-3 text-center">
                <div>
                  <p className="text-2xl font-semibold text-foreground">{totalProjects}</p>
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
              <ProjectCreateButton />
            </>
          }
        />

        <div className="grid gap-6">
          <Card density="lg">
            <CardHeader className="flex-col sm:flex-row">
              <div>
                <CardTitle>{t("directory.title")}</CardTitle>
                <CardDescription>{t("directory.description")}</CardDescription>
              </div>
              <ProjectBulkAssignButton className="shrink-0" />
            </CardHeader>
            <CardContent>
              <AdminProjectsTable
                result={projectDirectory}
                projectOptions={projectOptions}
                groups={groups}
                assignments={assignments}
                assignmentRates={assignmentRates}
                assignableMembers={assignableMembers}
                todayDate={todayDate}
              />
            </CardContent>
          </Card>

          <Card density="lg">
            <CardHeader className="flex-col sm:flex-row">
              <div>
                <CardTitle>{t("groups.title")}</CardTitle>
                <CardDescription>{t("groups.description")}</CardDescription>
              </div>
              <ProjectGroupCreateButton className="shrink-0" />
            </CardHeader>
            <CardContent>
              <AdminProjectGroupsPanel groups={groups} projects={projectOptions} />
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
