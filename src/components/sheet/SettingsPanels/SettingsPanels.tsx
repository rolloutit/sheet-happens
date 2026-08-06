"use client";

import { Bell, Fingerprint, KeyRound, Mail, QrCode, ShieldCheck } from "lucide-react";

import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { cn } from "@/src/lib/utils";
import { NotificationPreferences } from "../NotificationPreferences";
import { PreferenceControls } from "../PreferenceControls";
import { ProfileSettingsPanel } from "../ProfileSettingsPanel";
import { SecurityMethodList } from "../SecurityMethodList";
import { TotpSetupDialog } from "../TotpSetupDialog";
import type { NotificationPreferenceItem } from "../NotificationPreferences";
import type { SecurityMethod } from "../SecurityMethodList";
import type { SettingsPanelsProps } from "./SettingsPanels.types";

const sections = ["profile", "security", "preferences", "notifications"] as const;

const defaultProfile: NonNullable<SettingsPanelsProps["profile"]> = {
  name: "Lena Kovacs",
  subtitle: "Contractor - EUR - Apollo Migration",
  fields: [
    { id: "email", label: "Email", value: "lena@example.com" },
    { id: "role", label: "Role", value: "Contractor" },
  ],
};

const defaultSecurityMethods = [
  {
    id: "password",
    label: "Password",
    description: "Used for email sign-in.",
    state: "set",
    icon: KeyRound,
    actionLabel: "Change",
  },
  {
    id: "google",
    label: "Google",
    description: "Connected single sign-on provider.",
    state: "connected",
    icon: Mail,
    actionLabel: "Manage",
  },
  {
    id: "totp",
    label: "TOTP",
    description: "Use an authenticator app for 2FA.",
    state: "not_enabled",
    icon: QrCode,
    actionLabel: "Enable",
  },
  {
    id: "passkeys",
    label: "Passkeys",
    description: "Fast device-bound sign-in.",
    state: "recommended",
    icon: Fingerprint,
    actionLabel: "Add",
  },
] satisfies SecurityMethod[];

const defaultTimezoneOptions = [
  { value: "Europe/Budapest", label: "Europe/Budapest", meta: "Detected" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New York" },
];

const defaultNotificationItems = [
  {
    id: "weekly",
    label: "Weekly reminders",
    description: "Prompt users before the week closes.",
    enabled: true,
    icon: Bell,
  },
  {
    id: "month-end",
    label: "Month-end reminders",
    description: "Remind users before payroll lock.",
    enabled: false,
    icon: Bell,
  },
  {
    id: "workflow",
    label: "Workflow events",
    description: "Approval, rejection, upload, and payment events.",
    enabled: true,
    icon: ShieldCheck,
  },
] satisfies NotificationPreferenceItem[];

export function SettingsPanels({
  section = "profile",
  onSectionChange,
  profile = defaultProfile,
  securityMethods = defaultSecurityMethods,
  security,
  totp,
  preferences,
  notifications,
  onSecurityMethodAction,
  className,
}: SettingsPanelsProps) {
  return (
    <div className={cn("grid gap-4 lg:grid-cols-[14rem_1fr]", className)}>
      <Card variant="flat" className="h-fit">
        <nav className="grid gap-1" aria-label="Settings sections">
          {sections.map((item) => (
            <button
              key={item}
              type="button"
              aria-current={item === section ? "page" : undefined}
              className={cn(
                "rounded-[var(--radius-md)] px-3 py-2 text-left font-ui text-sm font-semibold capitalize text-muted-foreground transition hover:bg-secondary hover:text-foreground",
                item === section && "bg-accent-soft text-accent",
              )}
              onClick={() => onSectionChange?.(item)}
            >
              {item}
            </button>
          ))}
        </nav>
      </Card>
      <div className="grid gap-4">
        {section === "profile" ? <ProfileSettingsPanel {...profile} /> : null}
        {section === "security" ? (
          <>
            <SecurityMethodList
              methods={securityMethods}
              onMethodAction={onSecurityMethodAction}
              {...security}
            />
            <TotpSetupDialog
              trigger={
                <Button type="button" variant="cta" icon={QrCode}>
                  Enable TOTP
                </Button>
              }
              {...totp}
            />
          </>
        ) : null}
        {section === "preferences" ? (
          <PreferenceControls
            timezoneValue="Europe/Budapest"
            timezoneOptions={defaultTimezoneOptions}
            {...preferences}
          />
        ) : null}
        {section === "notifications" ? (
          <NotificationPreferences items={defaultNotificationItems} {...notifications} />
        ) : null}
      </div>
    </div>
  );
}
