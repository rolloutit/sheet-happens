"use client";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { payslipStatusLabels, payslipStatusTone } from "../PayslipStatus";
import type { PayslipSummaryAction, PayslipSummaryCardProps } from "./PayslipSummaryCard.types";

function SummaryButton({
  action,
  fallbackVariant,
}: {
  action: PayslipSummaryAction;
  fallbackVariant: ButtonPropsVariant;
}) {
  return (
    <Button
      type="button"
      variant={action.variant ?? fallbackVariant}
      icon={action.icon}
      disabled={action.disabled}
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );
}

type ButtonPropsVariant = NonNullable<PayslipSummaryAction["variant"]>;

export function PayslipSummaryCard({
  title,
  status = "available",
  statusLabel,
  meta,
  primaryAction,
  secondaryAction,
  className,
}: PayslipSummaryCardProps) {
  return (
    <Card variant="featured" className={className}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Badge tone={payslipStatusTone[status]}>
            {statusLabel ?? payslipStatusLabels[status]}
          </Badge>
          <h2 className="mt-3 text-2xl font-semibold">{title}</h2>
          {meta ? <p className="mt-1 text-sm text-muted-foreground">{meta}</p> : null}
        </div>
        {primaryAction || secondaryAction ? (
          <div className="flex flex-wrap gap-2">
            {secondaryAction ? (
              <SummaryButton action={secondaryAction} fallbackVariant="soft" />
            ) : null}
            {primaryAction ? <SummaryButton action={primaryAction} fallbackVariant="cta" /> : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
