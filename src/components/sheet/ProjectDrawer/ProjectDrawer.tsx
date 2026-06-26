"use client";

import { CalendarRange } from "lucide-react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { ChipButton } from "@/src/components/ui/ChipButton";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/src/components/ui/Drawer";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { Switch } from "@/src/components/ui/Switch";
import { Textarea } from "@/src/components/ui/Textarea";
import type { ProjectDrawerData, ProjectDrawerProps } from "./ProjectDrawer.types";

export function ProjectDrawer({
  project,
  trigger,
  open,
  onOpenChange,
  onActiveChange,
  onSave,
  saveLabel = "Save changes",
  cancelLabel = "Cancel",
}: ProjectDrawerProps) {
  const currentProject: ProjectDrawerData = project;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="soft">
            Open project
          </Button>
        )}
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-xl font-semibold">{project.name}</DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">
            Project settings, members, timeline, notes, and rate source flags.
          </DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-4">
          <label className="flex items-center justify-between rounded-[var(--radius-md)] bg-secondary p-3">
            <span className="font-ui text-sm font-semibold">Active project</span>
            <Switch
              aria-label="Active project"
              checked={project.active}
              onCheckedChange={(checked) => onActiveChange?.(Boolean(checked))}
            />
          </label>
          <Field label="Project name">
            {({ id }) => <Input id={id} defaultValue={project.name} />}
          </Field>
          {project.description ? (
            <p className="rounded-[var(--radius-md)] bg-secondary p-3 text-sm text-muted-foreground">
              {project.description}
            </p>
          ) : null}
          {project.tags?.length ? (
            <div className="flex flex-wrap gap-2" aria-label="Project tags">
              {project.tags.map((tag) => (
                <ChipButton key={tag}>{tag}</ChipButton>
              ))}
            </div>
          ) : null}
          {project.members?.length ? (
            <div className="flex flex-wrap gap-2" aria-label="Project members">
              {project.members.map((member) => (
                <ChipButton key={member.id}>{member.name}</ChipButton>
              ))}
            </div>
          ) : null}
          {project.dateRange ? (
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-secondary p-3 text-sm text-muted-foreground">
              <CalendarRange className="size-4" aria-hidden="true" />
              {project.dateRange}
            </div>
          ) : null}
          {project.rateSource ? <Badge tone="info">{project.rateSource}</Badge> : null}
          <Field label="Notes">
            {({ id }) => <Textarea id={id} defaultValue={project.notes ?? ""} />}
          </Field>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button type="button" variant="ghost">
              {cancelLabel}
            </Button>
          </DrawerClose>
          <DrawerClose asChild>
            <Button type="button" variant="cta" onClick={() => onSave?.(currentProject)}>
              {saveLabel}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
