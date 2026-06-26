"use client";

import { Avatar } from "@/src/components/ui/Avatar";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Field } from "@/src/components/ui/Field";
import { FormSection } from "@/src/components/ui/FormSection";
import { Input } from "@/src/components/ui/Input";
import type { ProfileSettingsPanelProps } from "./ProfileSettingsPanel.types";

export function ProfileSettingsPanel({
  title = "Profile",
  description = "Profile details are synced from onboarding and payroll data.",
  badge = "Read only",
  name,
  subtitle,
  avatarTone,
  fields,
  action,
  className,
}: ProfileSettingsPanelProps) {
  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {badge ? <Badge tone="info">{badge}</Badge> : null}
      </CardHeader>
      <CardContent>
        <FormSection
          title="Identity"
          description={description}
          actions={
            action ? (
              <Button
                type="button"
                variant={action.variant ?? "soft"}
                icon={action.icon}
                disabled={action.disabled}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ) : null
          }
        >
          <div className="flex items-center gap-4">
            <Avatar name={name} size="xl" tone={avatarTone} />
            <div>
              <p className="text-lg font-semibold">{name}</p>
              {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {fields.map((field) => (
              <Field key={field.id} label={field.label}>
                {({ id }) => (
                  <Input
                    id={id}
                    readOnly={field.readOnly ?? true}
                    defaultValue={field.value}
                    aria-label={field.label}
                  />
                )}
              </Field>
            ))}
          </div>
        </FormSection>
      </CardContent>
    </Card>
  );
}
