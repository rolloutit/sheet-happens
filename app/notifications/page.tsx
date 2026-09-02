import type { Route } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent } from "@/src/components/ui/Card";
import { SectionHead } from "@/src/components/ui/SectionHead";
import { resolveLocale } from "@/src/i18n/locales";
import {
  mapMemberToShellProfile,
  mapMemberToShellRole,
  mapMemberToShellUser,
  requireActiveAppMember,
} from "@/src/server/auth/app-access";
import { getMemberNotifications } from "@/src/server/notifications";
import { NotificationCenterClient } from "./NotificationCenterClient";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; unread?: string }>;
}) {
  const { member } = await requireActiveAppMember("/notifications");
  const locale = resolveLocale(await getLocale()) ?? "hu";
  const t = await getTranslations("NotificationsPage");
  const params = await searchParams;
  const unreadOnly = params.unread === "1";
  const result = await getMemberNotifications({
    memberId: member.id,
    locale,
    page: Number(params.page) || 1,
    unreadOnly,
  });

  return (
    <AppShell
      current="notifications"
      role={mapMemberToShellRole(member)}
      profile={mapMemberToShellProfile(member)}
      user={mapMemberToShellUser(member)}
    >
      <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <SectionHead eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
        <div className="flex gap-2">
          <Button asChild variant={unreadOnly ? "ghost" : "soft"}>
            <Link href={"/notifications" as Route}>{t("all")}</Link>
          </Button>
          <Button asChild variant={unreadOnly ? "soft" : "ghost"}>
            <Link href={"/notifications?unread=1" as Route}>{t("unread")}</Link>
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <NotificationCenterClient
              key={notificationResultKey(result.rows, result.page, unreadOnly)}
              rows={result.rows}
              unreadOnly={unreadOnly}
            />
          </CardContent>
        </Card>
        {result.totalPages > 1 ? (
          <nav className="flex items-center justify-between gap-3" aria-label={t("pagination")}>
            {result.page <= 1 ? (
              <Button variant="ghost" disabled>
                {t("previous")}
              </Button>
            ) : (
              <Button asChild variant="ghost">
                <Link href={pageHref(result.page - 1, unreadOnly)}>{t("previous")}</Link>
              </Button>
            )}
            <span className="text-sm text-muted-foreground">
              {t("page", { page: result.page, total: result.totalPages })}
            </span>
            {result.page >= result.totalPages ? (
              <Button variant="ghost" disabled>
                {t("next")}
              </Button>
            ) : (
              <Button asChild variant="ghost">
                <Link href={pageHref(result.page + 1, unreadOnly)}>{t("next")}</Link>
              </Button>
            )}
          </nav>
        ) : null}
      </section>
    </AppShell>
  );
}

function pageHref(page: number, unreadOnly: boolean) {
  const params = new URLSearchParams({ page: String(Math.max(1, page)) });
  if (unreadOnly) params.set("unread", "1");
  return `/notifications?${params.toString()}` as Route;
}

function notificationResultKey(
  rows: Awaited<ReturnType<typeof getMemberNotifications>>["rows"],
  page: number,
  unreadOnly: boolean,
) {
  return `${unreadOnly}:${page}:${rows.map((row) => `${row.id}:${row.read}`).join(",")}`;
}
