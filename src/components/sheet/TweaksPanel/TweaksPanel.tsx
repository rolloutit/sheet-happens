"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { Input } from "@/src/components/ui/Input";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { Select } from "@/src/components/ui/Select";
import { Switch } from "@/src/components/ui/Switch";
import { cn } from "@/src/lib/utils";
import type { TweaksPanelProps, TweaksPanelValue } from "./TweaksPanel.types";

export const defaultTweaksPanelValue: TweaksPanelValue = {
  radius: 12,
  denseTables: true,
  density: "comfortable",
  font: "lexend",
  accent: "#37e3de",
  panelWidth: 384,
};

const defaultAccentOptions = ["#37e3de", "#ffc68b", "#72df9a", "#ff6b6b"];

export function TweaksPanel({
  open = true,
  value,
  accentOptions = defaultAccentOptions,
  labels,
  className,
  onOpenChange,
  onValueChange,
  onReset,
  onApply,
}: TweaksPanelProps) {
  const [draft, setDraft] = useState<TweaksPanelValue>({
    ...defaultTweaksPanelValue,
    ...value,
  });
  const currentValue = value ? { ...defaultTweaksPanelValue, ...value } : draft;

  function updateValue(nextValue: TweaksPanelValue) {
    if (!value) setDraft(nextValue);
    onValueChange?.(nextValue);
  }

  function updateField<Key extends keyof TweaksPanelValue>(
    key: Key,
    nextFieldValue: TweaksPanelValue[Key],
  ) {
    updateValue({ ...currentValue, [key]: nextFieldValue });
  }

  function reset() {
    if (!value) setDraft(defaultTweaksPanelValue);
    onReset?.(defaultTweaksPanelValue);
    onValueChange?.(defaultTweaksPanelValue);
  }

  if (!open) {
    return (
      <Button variant="soft" icon={SlidersHorizontal} onClick={() => onOpenChange?.(true)}>
        {labels?.open ?? "Tweaks"}
      </Button>
    );
  }

  return (
    <Card
      variant="elevated"
      className={cn("fixed bottom-6 right-6 z-40 w-[min(24rem,calc(100vw-2rem))] p-0", className)}
    >
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <p className="font-ui text-sm font-semibold">{labels?.title ?? "Design tweaks"}</p>
          <p className="text-xs text-muted-foreground">
            {labels?.description ?? "Local preview controls"}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          icon={RotateCcw}
          aria-label={labels?.reset ?? "Reset tweaks"}
          onClick={reset}
        />
      </div>
      <div className="grid gap-4 p-4">
        <TweakSlider
          label={labels?.radius ?? "Radius"}
          value={currentValue.radius}
          onValueChange={(nextValue) => updateField("radius", nextValue)}
        />
        <TweakToggle
          label={labels?.denseTables ?? "Dense tables"}
          checked={currentValue.denseTables}
          onCheckedChange={(checked) => updateField("denseTables", checked)}
        />
        <SegmentedControl
          label={labels?.density ?? "Density"}
          value={currentValue.density}
          size="sm"
          width="full"
          onValueChange={(nextValue) =>
            updateField("density", nextValue as TweaksPanelValue["density"])
          }
          items={[
            { value: "compact", label: labels?.compact ?? "Compact" },
            { value: "comfortable", label: labels?.comfortable ?? "Comfort" },
          ]}
        />
        <Select
          aria-label={labels?.font ?? "Font"}
          value={currentValue.font}
          onValueChange={(nextValue) => updateField("font", nextValue as TweaksPanelValue["font"])}
          options={[
            { value: "lexend", label: "Lexend" },
            { value: "system", label: "System" },
          ]}
        />
        <TweakColor
          label={labels?.accent ?? "Accent"}
          value={currentValue.accent}
          options={accentOptions}
          onValueChange={(nextValue) => updateField("accent", nextValue)}
        />
        <TweakNumber
          label={labels?.panelWidth ?? "Panel width"}
          value={currentValue.panelWidth}
          onValueChange={(nextValue) => updateField("panelWidth", nextValue)}
        />
        <Button type="button" variant="cta" onClick={() => onApply?.(currentValue)}>
          {labels?.apply ?? "Apply preview"}
        </Button>
      </div>
    </Card>
  );
}

function TweakSlider({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="flex justify-between font-ui text-sm font-semibold">
        {label}
        <span className="text-muted-foreground">{value}px</span>
      </span>
      <input
        type="range"
        min="0"
        max="24"
        value={value}
        className="accent-[var(--accent)]"
        onChange={(event) => onValueChange(Number(event.target.value))}
      />
    </label>
  );
}

function TweakToggle({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between">
      <span className="font-ui text-sm font-semibold">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function TweakColor({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: string[];
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <p className="font-ui text-sm font-semibold">{label}</p>
      <div className="flex gap-2">
        {options.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Use ${color}`}
            aria-pressed={value === color}
            className="size-8 rounded-full border border-white/30 ring-offset-2 ring-offset-background transition aria-pressed:ring-2 aria-pressed:ring-ring"
            style={{ background: color }}
            onClick={() => onValueChange(color)}
          />
        ))}
      </div>
    </div>
  );
}

function TweakNumber({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="font-ui text-sm font-semibold">{label}</span>
      <Input
        type="number"
        value={value}
        min={280}
        max={520}
        onChange={(event) => onValueChange(Number(event.target.value))}
      />
    </label>
  );
}
