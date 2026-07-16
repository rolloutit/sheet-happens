"use client";

import { ArrowUpRight, Clock3, Send, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { Avatar } from "@/src/components/ui/Avatar";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { cn } from "@/src/lib/utils";
import { FlaggedUserList } from "../FlaggedUserList";
import { StatCard } from "../StatCard";
import { StatusOverview } from "../StatusOverview";
import type {
  DashboardCardsProps,
  DashboardChecklistItem,
  DashboardHeroAction,
} from "./DashboardCards.types";

export function DashboardCards({
  name = "Márta",
  role = "contractor",
  roleLabel,
  greeting,
  summary,
  primaryAction,
  secondaryAction,
  stats,
  checklistTitle,
  checklistDescription,
  checklistBadge,
  checklistItems,
  flaggedUsers,
  selectedFlaggedUserIds = [],
  onFlaggedUserSelectionChange,
  onRemindFlaggedUsers,
  reminderSent,
  statusTitle,
  statusSegments,
  statusAction,
  className,
}: DashboardCardsProps) {
  const t = useTranslations("DashboardCards");
  const isAdmin = role === "admin";
  const resolvedStats =
    stats ??
    ([
      {
        label: t("stats.loggedHours"),
        value: "1 284h",
        icon: Clock3,
        trend: { label: "+8%", direction: "up" },
        sparkline: [30, 48, 35, 64, 58, 82, 72],
      },
      {
        label: t("stats.billableValue"),
        value: "EUR 86k",
        icon: Clock3,
        trend: { label: "+12%", direction: "up" },
        sparkline: [22, 44, 51, 49, 67, 75, 86],
      },
      {
        label: t("stats.submitted"),
        value: "48",
        icon: Users,
        trend: { label: "+6", direction: "up" },
        sparkline: [18, 26, 31, 36, 42, 45, 48],
      },
      {
        label: t("stats.missingDays"),
        value: "17",
        tone: "warning",
        helperText: t("stats.needsAttention"),
        sparkline: [26, 24, 23, 20, 19, 18, 17],
      },
    ] satisfies NonNullable<DashboardCardsProps["stats"]>);
  const resolvedChecklistItems =
    checklistItems ??
    ([
      { id: "descriptions", label: t("checklist.missingDescriptions"), checked: true },
      { id: "invoice", label: t("checklist.uploadInvoice") },
      { id: "bank", label: t("checklist.confirmBank") },
    ] satisfies DashboardChecklistItem[]);
  const resolvedFlaggedUsers =
    flaggedUsers ??
    ([
      { id: "anna", name: "Kovács Anna", detail: t("flagged.missingDays"), severity: "warning" },
      { id: "bence", name: "Tóth Bence", detail: t("flagged.noInvoice"), severity: "danger" },
      { id: "eszter", name: "Nagy Eszter", detail: t("flagged.waitingReview"), severity: "info" },
    ] satisfies NonNullable<DashboardCardsProps["flaggedUsers"]>);
  const resolvedStatusSegments =
    statusSegments ??
    ([
      { id: "submitted", label: t("status.submitted"), value: 46, tone: "info" },
      { id: "approved", label: t("status.approved"), value: 32, tone: "success" },
      { id: "rejected", label: t("status.rejected"), value: 12, tone: "danger" },
      { id: "missing", label: t("status.missing"), value: 10, tone: "neutral" },
    ] satisfies NonNullable<DashboardCardsProps["statusSegments"]>);
  const resolvedPrimaryAction =
    primaryAction ??
    ({
      label: isAdmin ? t("actions.reviewQueue") : t("actions.submitTimesheet"),
      icon: Send,
      variant: "cta",
    } satisfies DashboardHeroAction);
  const resolvedSecondaryAction =
    secondaryAction ??
    ({
      label: t("actions.openReport"),
      icon: ArrowUpRight,
      variant: "soft",
    } satisfies DashboardHeroAction);
  const resolvedStatusAction = statusAction ?? (
    <Button variant="ghost" size="sm" icon={ArrowUpRight}>
      {t("actions.open")}
    </Button>
  );

  return (
    <div className={cn("grid gap-5", className)}>
      <section className="flex flex-col gap-4 rounded-[var(--radius-xl)] border border-border bg-card/80 p-5 shadow-panel md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={name} size="lg" tone={isAdmin ? "teal" : "deep"} />
          <div>
            <Badge tone={isAdmin ? "warning" : "info"}>
              {roleLabel ?? (isAdmin ? "admin" : role)}
            </Badge>
            <h2 className="mt-3 text-2xl font-semibold">{greeting ?? t("greeting", { name })}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary ?? (isAdmin ? t("summary.admin") : t("summary.member"))}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={resolvedSecondaryAction.variant}
            icon={resolvedSecondaryAction.icon}
            onClick={resolvedSecondaryAction.onClick}
          >
            {resolvedSecondaryAction.label}
          </Button>
          <Button
            type="button"
            variant={resolvedPrimaryAction.variant}
            icon={resolvedPrimaryAction.icon}
            onClick={resolvedPrimaryAction.onClick}
          >
            {resolvedPrimaryAction.label}
          </Button>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {resolvedStats.map((stat, index) => (
          <StatCard key={`${stat.label}-${index}`} {...stat} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        {isAdmin ? (
          <FlaggedUserList
            items={resolvedFlaggedUsers}
            selectedIds={selectedFlaggedUserIds}
            onSelectedIdsChange={onFlaggedUserSelectionChange}
            onRemind={onRemindFlaggedUsers}
            reminderSent={reminderSent}
            labels={{
              selectAll: t("flagged.selectAll"),
              remind: t("flagged.remind"),
              sent: t("flagged.sent"),
              selected: (count) => t("flagged.selected", { count }),
            }}
          />
        ) : (
          <PriorityCard
            title={checklistTitle ?? t("checklist.title")}
            description={checklistDescription ?? t("checklist.description")}
            badge={checklistBadge ?? t("checklist.badge")}
            items={resolvedChecklistItems}
          />
        )}
        <StatusOverview
          title={statusTitle ?? t("status.title")}
          segments={resolvedStatusSegments}
          action={resolvedStatusAction}
        />
      </div>
    </div>
  );
}

function PriorityCard({
  title,
  description,
  badge,
  items,
}: {
  title: DashboardCardsProps["checklistTitle"];
  description: DashboardCardsProps["checklistDescription"];
  badge: DashboardCardsProps["checklistBadge"];
  items: DashboardChecklistItem[];
}) {
  return (
    <Card variant="elevated">
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {badge ? <Badge tone="warning">{badge}</Badge> : null}
      </CardHeader>
      <CardContent>
        {items.map((item) => (
          <label
            key={item.id}
            className={cn(
              "flex items-center gap-3 rounded-[var(--radius-md)] bg-secondary p-3",
              item.disabled && "opacity-60",
            )}
          >
            <Checkbox checked={item.checked} disabled={item.disabled} />
            <span className="text-sm">{item.label}</span>
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
