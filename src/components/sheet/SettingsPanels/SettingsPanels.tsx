import { Bell, Fingerprint, KeyRound, Mail, QrCode, ShieldCheck, UserCircle } from "lucide-react";

import { Avatar } from "@/src/components/ui/Avatar";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Combobox } from "@/src/components/ui/Combobox";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { Switch } from "@/src/components/ui/Switch";
import { cn } from "@/src/lib/utils";
import type { SettingsPanelsProps } from "./SettingsPanels.types";

export function SettingsPanels({ section = "profile", className }: SettingsPanelsProps) {
  return (
    <div className={cn("grid gap-4 lg:grid-cols-[14rem_1fr]", className)}>
      <Card variant="flat" className="h-fit">
        <nav className="grid gap-1" aria-label="Settings sections">
          {(["profile", "security", "preferences", "notifications"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={cn(
                "rounded-[var(--radius-md)] px-3 py-2 text-left font-ui text-sm font-semibold capitalize text-muted-foreground transition hover:bg-secondary hover:text-foreground",
                item === section && "bg-primary/14 text-accent",
              )}
            >
              {item}
            </button>
          ))}
        </nav>
      </Card>
      <div className="grid gap-4">
        {section === "profile" ? <ProfileSection /> : null}
        {section === "security" ? <SecuritySection /> : null}
        {section === "preferences" ? <PreferencesSection /> : null}
        {section === "notifications" ? <NotificationsSection /> : null}
      </div>
    </div>
  );
}

function ProfileSection() {
  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <Badge tone="info">Read only</Badge>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Avatar name="Lena Kovacs" size="xl" />
          <div>
            <p className="text-lg font-semibold">Lena Kovacs</p>
            <p className="text-sm text-muted-foreground">Contractor · EUR · Apollo Migration</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Email">
            <Input readOnly defaultValue="lena@example.com" />
          </Field>
          <Field label="Role">
            <Input readOnly defaultValue="Contractor" />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}

function SecuritySection() {
  const methods = [
    { label: "Password", icon: KeyRound, state: "Set" },
    { label: "Google", icon: Mail, state: "Connected" },
    { label: "TOTP", icon: QrCode, state: "Not enabled" },
    { label: "Passkeys", icon: Fingerprint, state: "Recommended" },
  ];
  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Security</CardTitle>
        <Badge tone="success">Protected</Badge>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {methods.map((method) => (
            <div
              key={method.label}
              className="rounded-[var(--radius-lg)] border border-border bg-secondary p-4"
            >
              <method.icon className="mb-3 size-5 text-accent" aria-hidden="true" />
              <p className="font-ui text-sm font-semibold">{method.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{method.state}</p>
            </div>
          ))}
        </div>
        <TotpModalPreview />
      </CardContent>
    </Card>
  );
}

function TotpModalPreview() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-20 place-items-center rounded-[var(--radius-md)] bg-white text-slate-900">
          <QrCode className="size-10" aria-hidden="true" />
        </span>
        <div>
          <p className="font-ui text-sm font-semibold">TOTP setup modal</p>
          <p className="text-sm text-muted-foreground">Manual key: SH-2026-DEMO</p>
        </div>
      </div>
      <Input className="mt-4" placeholder="6 digit code" />
    </div>
  );
}

function PreferencesSection() {
  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-border bg-secondary p-4">
          <div className="flex items-center gap-3">
            <UserCircle className="size-5 text-accent" aria-hidden="true" />
            <div>
              <p className="font-ui text-sm font-semibold">Avatar</p>
              <p className="text-sm text-muted-foreground">
                Upload, view, or delete a square avatar.
              </p>
            </div>
          </div>
          <Button variant="soft">Change</Button>
        </div>
        <Combobox
          label="Timezone"
          value="Europe/Budapest"
          options={[
            { value: "Europe/Budapest", label: "Europe/Budapest", meta: "Detected" },
            { value: "UTC", label: "UTC" },
            { value: "America/New_York", label: "America/New York" },
          ]}
        />
      </CardContent>
    </Card>
  );
}

function NotificationsSection() {
  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <Button variant="ghost" size="sm">
          Reset
        </Button>
      </CardHeader>
      <CardContent>
        {["Weekly reminders", "Month-end reminders", "Workflow events"].map((label, index) => (
          <label
            key={label}
            className="flex items-center justify-between rounded-[var(--radius-lg)] bg-secondary p-4"
          >
            <span className="flex items-center gap-3">
              {index === 2 ? (
                <ShieldCheck className="size-4 text-accent" aria-hidden="true" />
              ) : (
                <Bell className="size-4 text-accent" aria-hidden="true" />
              )}
              <span className="font-ui text-sm font-semibold">{label}</span>
            </span>
            <Switch checked={index !== 1} />
          </label>
        ))}
        <SegmentedControl
          label="Cadence"
          value="fri"
          items={[
            { value: "wed", label: "Wed" },
            { value: "fri", label: "Fri" },
            { value: "mon", label: "Mon" },
          ]}
        />
      </CardContent>
    </Card>
  );
}
