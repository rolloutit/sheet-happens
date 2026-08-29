"use client";

import { Bell, CheckCheck } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/Button";
import { cn } from "@/src/lib/utils";
import type { MemberNotificationRow } from "@/src/server/notifications";

export function NotificationCenterClient({
  rows,
  unreadOnly,
}: {
  rows: MemberNotificationRow[];
  unreadOnly: boolean;
}) {
  const t = useTranslations("NotificationsPage");
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState(rows);
  const [pending, startTransition] = useTransition();

  function markAll() {
    startTransition(async () => {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!response.ok) return;
      setItems((current) => (unreadOnly ? [] : current.map((item) => ({ ...item, read: true }))));
      router.refresh();
    });
  }

  function open(item: MemberNotificationRow) {
    startTransition(async () => {
      if (!item.read) {
        const response = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: item.id }),
        });
        if (response.ok) {
          setItems((current) =>
            unreadOnly
              ? current.filter((notification) => notification.id !== item.id)
              : current.map((notification) =>
                  notification.id === item.id ? { ...notification, read: true } : notification,
                ),
          );
        }
      }
      if (item.actionUrl) router.push(item.actionUrl as Route);
      else router.refresh();
    });
  }

  if (items.length === 0) {
    return <div className="py-14 text-center text-sm text-muted-foreground">{t("empty")}</div>;
  }

  return (
    <div className="grid gap-4">
      {items.some((item) => !item.read) ? (
        <div className="flex justify-end">
          <Button variant="ghost" icon={CheckCheck} onClick={markAll} loading={pending}>
            {t("markAllRead")}
          </Button>
        </div>
      ) : null}
      <div className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => open(item)}
            className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 bg-card px-4 py-4 text-left transition hover:bg-secondary sm:px-5"
          >
            <span
              className={cn(
                "mt-1 flex size-9 items-center justify-center rounded-[var(--radius-md)]",
                item.read ? "bg-secondary text-muted-foreground" : "bg-accent-soft text-accent",
              )}
            >
              <Bell className="size-4" aria-hidden="true" />
            </span>
            <span className="grid min-w-0 gap-1">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className={cn("font-semibold", item.read && "text-muted-foreground")}>
                  {item.title}
                </span>
                <time className="text-xs text-muted-foreground" dateTime={item.createdAt}>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(item.createdAt))}
                </time>
              </span>
              <span className="text-sm leading-6 text-muted-foreground">{item.body}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
