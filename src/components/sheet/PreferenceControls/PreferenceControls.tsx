"use client";

import { UserCircle } from "lucide-react";

import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Combobox } from "@/src/components/ui/Combobox";
import { FormSection } from "@/src/components/ui/FormSection";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import type { PreferenceControlsProps } from "./PreferenceControls.types";

export function PreferenceControls({
  title = "Preferences",
  description = "Personalize local display settings without changing payroll data.",
  avatarTitle = "Avatar",
  avatarDescription = "Upload, view, or delete a square avatar.",
  avatarActionLabel = "Change",
  timezoneValue,
  timezoneOptions,
  onTimezoneChange,
  languageValue = "en",
  languageOptions = [
    { value: "en", label: "EN" },
    { value: "hu", label: "HU" },
  ],
  onLanguageChange,
  onAvatarChange,
  className,
}: PreferenceControlsProps) {
  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <FormSection title="Display" description={description}>
          <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <UserCircle className="size-5 text-accent" aria-hidden="true" />
              <div>
                <p className="font-ui text-sm font-semibold">{avatarTitle}</p>
                <p className="text-sm text-muted-foreground">{avatarDescription}</p>
              </div>
            </div>
            {onAvatarChange ? (
              <Button type="button" variant="soft" onClick={onAvatarChange}>
                {avatarActionLabel}
              </Button>
            ) : null}
          </div>
          <Combobox
            label="Timezone"
            value={timezoneValue}
            options={timezoneOptions}
            onValueChange={onTimezoneChange}
          />
          <SegmentedControl
            label="Language"
            value={languageValue}
            onValueChange={onLanguageChange}
            items={languageOptions.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </FormSection>
      </CardContent>
    </Card>
  );
}
