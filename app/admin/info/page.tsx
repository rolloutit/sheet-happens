import type { Route } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { AdminInfoEditorClient } from "./AdminInfoEditorClient";
import { AppShell } from "@/src/components/layout/AppShell";
import { Button } from "@/src/components/ui/Button";
import { SectionHead } from "@/src/components/ui/SectionHead";
import {
  mapMemberToShellProfile,
  mapMemberToShellUser,
  requireAdminAppMember,
} from "@/src/server/auth/app-access";
import {
  getDefaultWelcomeInfoPage,
  getEditableInfoPage,
  HELP_WELCOME_INFO_PAGE_SLUG,
} from "@/src/server/info-pages";

export const dynamic = "force-dynamic";

export default async function AdminInfoPage() {
  const { member: admin } = await requireAdminAppMember("/admin/info");
  const t = await getTranslations("AdminInfo");
  const locale = await getLocale();
  const defaultWelcome = getDefaultWelcomeInfoPage(locale);
  const editablePage = await getEditableInfoPage(HELP_WELCOME_INFO_PAGE_SLUG);
  const initialValue = {
    title: editablePage?.title || defaultWelcome.title,
    bodyMarkdown: editablePage?.bodyMarkdown || defaultWelcome.bodyMarkdown,
    status: editablePage?.status ?? ("draft" as const),
    version: editablePage?.version ?? null,
    updatedAtLabel: editablePage?.updatedAt ? formatDateTime(editablePage.updatedAt, locale) : null,
  };

  return (
    <AppShell
      current="info"
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
            <Button asChild variant="soft" icon={ExternalLink}>
              <Link href={"/help?tab=welcome" as Route}>{t("actions.openHelp")}</Link>
            </Button>
          }
        />
        <AdminInfoEditorClient
          slug={HELP_WELCOME_INFO_PAGE_SLUG}
          initialValue={initialValue}
          defaultValue={defaultWelcome}
          labels={{
            editorTitle: t("editor.title"),
            editorDescription: t("editor.description"),
            titleLabel: t("editor.titleLabel"),
            bodyLabel: t("editor.bodyLabel"),
            previewTitle: t("editor.previewTitle"),
            previewDescription: t("editor.previewDescription"),
            publish: t("editor.publish"),
            reset: t("editor.reset"),
            markdownHint: t("editor.markdownHint"),
            fallbackNotice: t("editor.fallbackNotice"),
            statusDraft: t("editor.statusDraft"),
            statusPublished: t("editor.statusPublished"),
            versionLabel: t("editor.versionLabel", {
              version: "{version}",
            }),
            updatedAtLabel: t("editor.updatedAtLabel", {
              date: "{date}",
            }),
          }}
        />
      </section>
    </AppShell>
  );
}

function formatDateTime(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
