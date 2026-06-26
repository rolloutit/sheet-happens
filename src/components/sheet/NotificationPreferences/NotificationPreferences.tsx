"use client";

import { Bell } from "lucide-react";

import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { FormSection } from "@/src/components/ui/FormSection";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { Switch } from "@/src/components/ui/Switch";
import type { NotificationPreferencesProps } from "./NotificationPreferences.types";

export function NotificationPreferences({
  title = "Notifications",
  description = "Choose which operational reminders should reach you.",
  items,
  cadenceValue = "fri",
  cadenceOptions = [
    { value: "wed", label: "Wed" },
    { value: "fri", label: "Fri" },
    { value: "mon", label: "Mon" },
  ],
  onPreferenceChange,
  onCadenceChange,
  onReset,
  resetLabel = "Reset",
  className,
}: NotificationPreferencesProps) {
  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {onReset ? (
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            {resetLabel}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <FormSection title="Delivery" description={description}>
          {items.map((item) => {
            const Icon = item.icon ?? Bell;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-[var(--radius-lg)] bg-secondary p-4"
              >
                <span className="flex items-center gap-3">
                  <Icon className="size-4 text-accent" aria-hidden="true" />
                  <span>
                    <span className="block font-ui text-sm font-semibold">{item.label}</span>
                    {item.description ? (
                      <span className="block text-sm text-muted-foreground">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </span>
                <Switch
                  checked={item.enabled}
                  disabled={item.disabled}
                  aria-label={`Toggle ${item.label}`}
                  onCheckedChange={(checked) => onPreferenceChange?.(item.id, checked)}
                />
              </div>
            );
          })}
          <SegmentedControl
            label="Cadence"
            value={cadenceValue}
            onValueChange={onCadenceChange}
            items={cadenceOptions.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </FormSection>
      </CardContent>
    </Card>
  );
}
