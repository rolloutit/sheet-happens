"use client";

import { Bell, Clock3, Info, Mail, MonitorDot, Save, Users } from "lucide-react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/Button";
import { Switch } from "@/src/components/ui/Switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/Tooltip";
import type {
  ConfigurableNotificationType,
  NotificationConfigurationValue,
} from "@/src/server/notifications";
import { updateNotificationSettingsAction } from "./actions";
import type { NotificationSettingsActionState } from "./actions.types";

const initialState: NotificationSettingsActionState = { status: "idle", message: "" };

const workflowTypes = [
  "TIMESHEET_SUBMITTED",
  "TIMESHEET_APPROVED",
  "TIMESHEET_REJECTED",
  "INVOICE_UPLOADED",
  "INVOICE_REJECTED",
  "INVOICE_ACCEPTED",
  "TIMESHEET_PAID",
  "PAYSLIP_AVAILABLE",
  "TIME_ENTRY_ADMIN_MODIFIED",
] as const satisfies readonly ConfigurableNotificationType[];

export function NotificationSettingsClient({
  value,
  timezoneOptions,
}: {
  value: NotificationConfigurationValue;
  timezoneOptions: readonly { value: string; label: string }[];
}) {
  const t = useTranslations("Settings.notifications");
  const [state, action, pending] = useActionState(updateNotificationSettingsAction, initialState);
  const rules = new Map(value.rules.map((rule) => [rule.type, rule]));

  return (
    <form action={action} className="grid gap-6">
      <div className="flex gap-3 rounded-[var(--radius-md)] bg-accent-soft px-4 py-3 text-sm text-muted-foreground">
        <Users className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
        <p>{t("systemWide")}</p>
      </div>

      <div className="grid gap-3 border-b border-border pb-6 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          {t("companyTimezone")}
          <select
            name="companyTimezone"
            defaultValue={value.companyTimezone}
            className="h-11 min-w-0 rounded-[var(--radius-md)] border border-border bg-background px-3 text-sm"
          >
            {timezoneOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ScheduleRule
        icon={Clock3}
        title={t("weekly.title")}
        description={t("weekly.description")}
        type="WEEKLY_HOURS_REMINDER"
        emailEnabled={rules.get("WEEKLY_HOURS_REMINDER")?.emailEnabled ?? true}
        inAppEnabled={rules.get("WEEKLY_HOURS_REMINDER")?.inAppEnabled ?? true}
        t={t}
      >
        <label className="grid gap-2 text-sm font-semibold">
          {t("weekly.day")}
          <select
            name="weeklyWeekday"
            defaultValue={value.weeklyWeekday}
            className={selectClassName}
          >
            {Array.from({ length: 7 }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>
                {t(`weekdays.${day}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          {t("weekly.time")}
          <input
            name="weeklyTime"
            type="time"
            defaultValue={value.weeklyTime}
            className={selectClassName}
            required
          />
        </label>
      </ScheduleRule>

      <ScheduleRule
        icon={Bell}
        title={t("invoice.title")}
        description={t("invoice.description")}
        type="MONTHLY_INVOICE_REMINDER"
        emailEnabled={rules.get("MONTHLY_INVOICE_REMINDER")?.emailEnabled ?? true}
        inAppEnabled={rules.get("MONTHLY_INVOICE_REMINDER")?.inAppEnabled ?? true}
        t={t}
      >
        <label className="grid gap-2 text-sm font-semibold">
          {t("invoice.initialDelay")}
          <input
            name="invoiceInitialDelayHours"
            type="number"
            min={1}
            max={2160}
            step={1}
            defaultValue={value.invoiceInitialDelayHours}
            className={selectClassName}
            required
          />
          <span className="text-xs font-normal text-muted-foreground">{t("hoursUnit")}</span>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          {t("invoice.repeat")}
          <input
            name="invoiceRepeatIntervalHours"
            type="number"
            min={1}
            max={720}
            step={1}
            defaultValue={value.invoiceRepeatIntervalHours}
            className={selectClassName}
            required
          />
          <span className="text-xs font-normal text-muted-foreground">{t("hoursUnit")}</span>
        </label>
        <p className="sm:col-span-2 text-xs text-muted-foreground">{t("invoice.exactHours")}</p>
      </ScheduleRule>

      <section className="grid gap-3">
        <div>
          <h3 className="font-semibold">{t("workflow.title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("workflow.description")}</p>
        </div>
        <TooltipProvider delayDuration={250}>
          <div className="divide-y divide-border rounded-[var(--radius-md)] border border-border">
            {workflowTypes.map((type) => (
              <ChannelRow
                key={type}
                type={type}
                label={t(`types.${type}`)}
                description={t(`typeDescriptions.${type}`)}
                emailEnabled={rules.get(type)?.emailEnabled ?? true}
                inAppEnabled={rules.get(type)?.inAppEnabled ?? true}
                t={t}
              />
            ))}
          </div>
        </TooltipProvider>
      </section>

      {state.status !== "idle" ? (
        <p
          className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-success"}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" icon={Save} loading={pending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

function ScheduleRule({
  icon: Icon,
  title,
  description,
  type,
  emailEnabled,
  inAppEnabled,
  children,
  t,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  type: ConfigurableNotificationType;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  children: React.ReactNode;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <section className="grid gap-4 border-b border-border pb-6">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-accent-soft text-accent">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      <ChannelRow
        type={type}
        label={t("deliveryMethods")}
        emailEnabled={emailEnabled}
        inAppEnabled={inAppEnabled}
        t={t}
        compact
      />
    </section>
  );
}

function ChannelRow({
  type,
  label,
  description,
  emailEnabled,
  inAppEnabled,
  t,
  compact = false,
}: {
  type: ConfigurableNotificationType;
  label: string;
  description?: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  t: ReturnType<typeof useTranslations>;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "flex flex-wrap items-center justify-between gap-3"
          : "grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
      }
    >
      <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
        <span>{label}</span>
        {description ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("workflow.moreInfo", { notification: label })}
              >
                <Info className="size-4" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{description}</TooltipContent>
          </Tooltip>
        ) : null}
      </span>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Mail className="size-4" aria-hidden="true" />
        {t("email")}
        <Switch
          name={`email_${type}`}
          defaultChecked={emailEnabled}
          aria-label={`${label}: ${t("email")}`}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <MonitorDot className="size-4" aria-hidden="true" />
        {t("inApp")}
        <Switch
          name={`inApp_${type}`}
          defaultChecked={inAppEnabled}
          aria-label={`${label}: ${t("inApp")}`}
        />
      </label>
    </div>
  );
}

const selectClassName =
  "h-11 min-w-0 rounded-[var(--radius-md)] border border-border bg-background px-3 text-sm";
