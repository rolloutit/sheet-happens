import { RotateCcw, SlidersHorizontal } from "lucide-react";

import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { Input } from "@/src/components/ui/Input";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { Select } from "@/src/components/ui/Select";
import { Switch } from "@/src/components/ui/Switch";
import { cn } from "@/src/lib/utils";
import type { TweaksPanelProps } from "./TweaksPanel.types";

export function TweaksPanel({ open = true, className }: TweaksPanelProps) {
  if (!open) {
    return (
      <Button variant="soft" icon={SlidersHorizontal}>
        Tweaks
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
          <p className="font-ui text-sm font-semibold">Design tweaks</p>
          <p className="text-xs text-muted-foreground">Prototype controls for Claude exports</p>
        </div>
        <Button variant="ghost" size="icon" icon={RotateCcw} aria-label="Reset tweaks" />
      </div>
      <div className="grid gap-4 p-4">
        <TweakSlider label="Radius" value="12px" />
        <TweakToggle label="Dense tables" checked />
        <TweakRadio />
        <TweakSelect />
        <TweakColor />
        <TweakNumber />
        <Button variant="cta">Apply preview</Button>
      </div>
    </Card>
  );
}

function TweakSlider({ label, value }: { label: string; value: string }) {
  return (
    <label className="grid gap-2">
      <span className="flex justify-between font-ui text-sm font-semibold">
        {label}
        <span className="text-muted-foreground">{value}</span>
      </span>
      <input type="range" min="0" max="24" defaultValue="12" className="accent-[var(--accent)]" />
    </label>
  );
}

function TweakToggle({ label, checked }: { label: string; checked?: boolean }) {
  return (
    <label className="flex items-center justify-between">
      <span className="font-ui text-sm font-semibold">{label}</span>
      <Switch checked={checked} />
    </label>
  );
}

function TweakRadio() {
  return (
    <SegmentedControl
      label="Density"
      value="comfortable"
      size="sm"
      items={[
        { value: "compact", label: "Compact" },
        { value: "comfortable", label: "Comfort" },
      ]}
    />
  );
}

function TweakSelect() {
  return (
    <Select
      aria-label="Font"
      defaultValue="lexend"
      options={[
        { value: "lexend", label: "Lexend" },
        { value: "system", label: "System" },
      ]}
    />
  );
}

function TweakColor() {
  return (
    <div className="grid gap-2">
      <p className="font-ui text-sm font-semibold">Accent</p>
      <div className="flex gap-2">
        {["#37e3de", "#ffc68b", "#72df9a", "#ff6b6b"].map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Use ${color}`}
            className="size-8 rounded-full border border-white/30"
            style={{ background: color }}
          />
        ))}
      </div>
    </div>
  );
}

function TweakNumber() {
  return (
    <label className="grid gap-2">
      <span className="font-ui text-sm font-semibold">Panel width</span>
      <Input type="number" defaultValue={384} min={280} max={520} />
    </label>
  );
}
