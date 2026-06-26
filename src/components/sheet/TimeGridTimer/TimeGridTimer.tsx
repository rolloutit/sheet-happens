"use client";

import { PauseCircle, Play, TimerReset } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { Combobox } from "@/src/components/ui/Combobox";
import { Input } from "@/src/components/ui/Input";
import type { TimeGridTimerProps } from "./TimeGridTimer.types";

export function TimeGridTimer({
  projectOptions,
  projectValue,
  descriptionValue,
  elapsedLabel = "00:00:00",
  running,
  labels,
  onProjectChange,
  onDescriptionChange,
  onStart,
  onStop,
  onReset,
  className,
}: TimeGridTimerProps) {
  const [localDescription, setLocalDescription] = useState("");
  const description = descriptionValue ?? localDescription;

  function updateDescription(value: string) {
    if (descriptionValue === undefined) setLocalDescription(value);
    onDescriptionChange?.(value);
  }

  return (
    <Card variant="flat" className={className}>
      <div className="grid gap-3 lg:grid-cols-[14rem_1fr_auto] lg:items-end">
        <Combobox
          label={labels?.project ?? "Project"}
          value={projectValue}
          options={projectOptions}
          onValueChange={onProjectChange}
        />
        <Input
          aria-label={labels?.description ?? "Timer description"}
          placeholder={labels?.description ?? "What are you working on?"}
          value={description}
          onChange={(event) => updateDescription(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={running ? "success" : "neutral"}>{elapsedLabel}</Badge>
          <Button type="button" variant="cta" icon={Play} disabled={running} onClick={onStart}>
            {labels?.start ?? "Start"}
          </Button>
          <Button
            type="button"
            variant="soft"
            icon={PauseCircle}
            disabled={!running}
            onClick={onStop}
          >
            {labels?.stop ?? "Stop"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            icon={TimerReset}
            aria-label={labels?.reset ?? "Reset timer"}
            onClick={onReset}
          />
        </div>
      </div>
    </Card>
  );
}
