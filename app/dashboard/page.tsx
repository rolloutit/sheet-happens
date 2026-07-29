import { getTranslations } from "next-intl/server";
import type { Route } from "next";
import Link from "next/link";
import { Clock3, FolderKanban, ShieldCheck, UsersRound } from "lucide-react";

import { AppShell } from "@/src/components/layout/AppShell";
import { Button } from "@/src/components/ui/Button";
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
  mapMemberToShellRole,
  mapMemberToShellUser,
  requireActiveAppMember,
} from "@/src/server/auth/app-access";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { member } = await requireActiveAppMember("/dashboard");
  const t = await getTranslations("Dashboard");
  const shellRole = mapMemberToShellRole(member);
  const shellProfile = mapMemberToShellProfile(member);
  const shellUser = mapMemberToShellUser(member);
  const links =
    shellRole === "admin"
      ? [
          {
            href: "/admin/people",
            label: t("actions.people"),
            icon: UsersRound,
          },
          {
            href: "/admin/projects",
            label: t("actions.projects"),
            icon: FolderKanban,
          },
        ]
      : [
          {
            href: "/time",
            label: t("actions.time"),
            icon: Clock3,
          },
          {
            href: "/settings",
            label: t("actions.settings"),
            icon: ShieldCheck,
          },
        ];

  return (
    <AppShell current="dashboard" role={shellRole} profile={shellProfile} user={shellUser}>
      <section className="mx-auto grid w-full max-w-[92rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <SectionHead eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
        <Card variant="elevated" density="lg" className="max-w-3xl">
          <CardHeader className="block">
            <CardTitle>{t("placeholder.title")}</CardTitle>
            <CardDescription>{t("placeholder.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {links.map((link) => {
                const LinkIcon = link.icon;

                return (
                  <Button key={link.href} asChild variant="soft">
                    <Link href={link.href as Route}>
                      <LinkIcon className="size-4" aria-hidden="true" />
                      {link.label}
                    </Link>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
