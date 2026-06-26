"use client";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
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
import type { BadgeProps } from "@/src/components/ui/Badge";
import type { RateDrawerData, RateDrawerProps } from "./RateDrawer.types";

const statusTone: Record<NonNullable<RateDrawerData["status"]>, BadgeProps["tone"]> = {
  current: "success",
  override: "info",
  missing: "warning",
  scheduled: "cta",
};

export function RateDrawer({
  rate,
  trigger,
  open,
  onOpenChange,
  onSave,
  saveLabel = "Save rate",
  cancelLabel = "Cancel",
}: RateDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="soft">
            Edit rate
          </Button>
        )}
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-xl font-semibold">{rate.label}</DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">
            Rate amount, currency, effective date, and override source.
          </DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-[var(--radius-md)] bg-secondary p-3">
            <span className="font-ui text-sm font-semibold">{rate.scope}</span>
            <Badge tone={statusTone[rate.status ?? "current"]}>{rate.status ?? "current"}</Badge>
          </div>
          <Field label="Amount">
            {({ id }) => <Input id={id} type="number" defaultValue={rate.amount} />}
          </Field>
          <Field label="Currency">
            {({ id }) => <Input id={id} defaultValue={rate.currency} />}
          </Field>
          <Field label="Unit">
            {({ id }) => <Input id={id} defaultValue={rate.unit ?? "hour"} />}
          </Field>
          <Field label="Effective from">
            {({ id }) => <Input id={id} defaultValue={rate.effectiveFrom ?? ""} />}
          </Field>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button type="button" variant="ghost">
              {cancelLabel}
            </Button>
          </DrawerClose>
          <DrawerClose asChild>
            <Button type="button" variant="cta" onClick={() => onSave?.(rate)}>
              {saveLabel}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
