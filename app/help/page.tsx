import type { Route } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { BookOpen, FileText, Lock, Pencil, type LucideIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import { MarkdownArticle } from "@/src/components/sheet/MarkdownArticle";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/Card";
import { SectionHead } from "@/src/components/ui/SectionHead";
import { cn } from "@/src/lib/utils";
import {
  mapMemberToShellProfile,
  mapMemberToShellRole,
  mapMemberToShellUser,
  requireActiveAppMember,
} from "@/src/server/auth/app-access";
import {
  getDefaultWelcomeInfoPage,
  getManualTopicsForAccess,
  getPublishedInfoPage,
  HELP_WELCOME_INFO_PAGE_SLUG,
  type ManualTopicAudience,
  type ManualTopicView,
} from "@/src/server/info-pages";

type HelpPageProps = {
  searchParams?: Promise<{
    tab?: string;
  }>;
};

type HelpTab = "welcome" | "manual";

export const dynamic = "force-dynamic";

export default async function HelpPage({ searchParams }: HelpPageProps) {
  const { member } = await requireActiveAppMember("/help");
  const resolvedSearchParams = (await searchParams) ?? {};
  const activeTab = resolveTab(resolvedSearchParams.tab);
  const locale = await getLocale();
  const t = await getTranslations("Help");
  const defaultWelcome = getDefaultWelcomeInfoPage(locale);
  const publishedWelcome = await getPublishedInfoPage(HELP_WELCOME_INFO_PAGE_SLUG);
  const welcome = publishedWelcome ?? {
    ...defaultWelcome,
    version: null,
    updatedAt: null,
  };
  const topics = getManualTopicsForAccess({
    locale,
    role: member.role,
    profile: member.currentProfile,
  });

  return (
    <AppShell
      current="help"
      role={mapMemberToShellRole(member)}
      profile={mapMemberToShellProfile(member)}
      user={mapMemberToShellUser(member)}
    >
      <section className="mx-auto grid w-full max-w-[73.75rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={t("subtitle")}
          actions={
            member.role === "ADMIN" ? (
              <Button asChild variant="soft" icon={Pencil}>
                <Link href={"/admin/info" as Route}>{t("actions.editWelcome")}</Link>
              </Button>
            ) : null
          }
        />

        <nav
          className="inline-flex w-fit rounded-[var(--radius-pill)] border border-border bg-secondary p-1"
          aria-label={t("tabs.label")}
        >
          <HelpTabLink active={activeTab === "welcome"} href="/help?tab=welcome" icon={FileText}>
            {t("tabs.welcome")}
          </HelpTabLink>
          <HelpTabLink active={activeTab === "manual"} href="/help?tab=manual" icon={BookOpen}>
            {t("tabs.manual")}
          </HelpTabLink>
        </nav>

        {activeTab === "welcome" ? (
          <WelcomePanel
            title={welcome.title}
            markdown={welcome.bodyMarkdown}
            badge={publishedWelcome ? t("welcome.publishedBadge") : t("welcome.fallbackBadge")}
            version={
              publishedWelcome
                ? t("welcome.version", {
                    version: publishedWelcome.version,
                  })
                : null
            }
            description={t("welcome.description")}
          />
        ) : (
          <ManualPanel
            topics={topics}
            labels={{
              title: t("manual.title"),
              subtitle: t("manual.subtitle"),
              available: t("manual.available"),
              restricted: t("manual.restricted"),
              restrictedMessage: t("manual.restrictedMessage"),
              audienceAll: t("audience.all"),
              audienceContractor: t("audience.contractor"),
              audienceAdmin: t("audience.admin"),
            }}
          />
        )}
      </section>
    </AppShell>
  );
}

function WelcomePanel({
  title,
  markdown,
  badge,
  version,
  description,
}: {
  title: string;
  markdown: string;
  badge: string;
  version: string | null;
  description: string;
}) {
  return (
    <Card variant="elevated" density="lg">
      <CardHeader className="block">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone="info" dot>
            {badge}
          </Badge>
          {version ? <span className="text-xs text-muted-foreground">{version}</span> : null}
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <MarkdownArticle markdown={markdown} />
      </CardContent>
    </Card>
  );
}

function ManualPanel({
  topics,
  labels,
}: {
  topics: ManualTopicView[];
  labels: {
    title: string;
    subtitle: string;
    available: string;
    restricted: string;
    restrictedMessage: string;
    audienceAll: string;
    audienceContractor: string;
    audienceAdmin: string;
  };
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h3 className="text-xl font-semibold">{labels.title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{labels.subtitle}</p>
      </div>
      <div className="grid gap-4">
        {topics.map((topic) => (
          <ManualTopicCard key={topic.id} topic={topic} labels={labels} />
        ))}
      </div>
    </div>
  );
}

function ManualTopicCard({
  topic,
  labels,
}: {
  topic: ManualTopicView;
  labels: {
    available: string;
    restricted: string;
    restrictedMessage: string;
    audienceAll: string;
    audienceContractor: string;
    audienceAdmin: string;
  };
}) {
  const accessLabel = topic.accessible ? labels.available : labels.restricted;

  return (
    <Card variant={topic.accessible ? "flat" : "warning"} density="lg">
      <CardHeader className="block">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone={topic.accessible ? "success" : "warning"} dot>
            {accessLabel}
          </Badge>
          <Badge tone="neutral">{audienceLabel(topic.audience, labels)}</Badge>
        </div>
        <CardTitle className="text-lg">{topic.title}</CardTitle>
        {topic.accessible ? <CardDescription>{topic.summary}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {topic.accessible ? (
          <MarkdownArticle markdown={topic.bodyMarkdown} />
        ) : (
          <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-warning/35 bg-warning-soft p-4 text-sm leading-6 text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <p>{labels.restrictedMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HelpTabLink({
  active,
  href,
  icon: Icon,
  children,
}: {
  active: boolean;
  href: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Link
      href={href as Route}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-pill)] px-4 py-2 text-sm font-semibold text-muted-foreground transition",
        active && "bg-accent text-accent-foreground shadow-soft",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-4" aria-hidden="true" />
      {children}
    </Link>
  );
}

function audienceLabel(
  audience: ManualTopicAudience,
  labels: {
    audienceAll: string;
    audienceContractor: string;
    audienceAdmin: string;
  },
) {
  if (audience === "admin") return labels.audienceAdmin;
  if (audience === "contractor") return labels.audienceContractor;
  return labels.audienceAll;
}

function resolveTab(tab: string | undefined): HelpTab {
  return tab === "manual" ? "manual" : "welcome";
}
