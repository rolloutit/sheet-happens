"use client";

import { ShieldCheck } from "lucide-react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { FormSection } from "@/src/components/ui/FormSection";
import type { BadgeProps } from "@/src/components/ui/Badge";
import type { SecurityMethodListProps, SecurityMethodState } from "./SecurityMethodList.types";

const stateTone: Record<SecurityMethodState, BadgeProps["tone"]> = {
  set: "success",
  connected: "success",
  not_enabled: "warning",
  recommended: "info",
};

const stateLabels: Record<SecurityMethodState, string> = {
  set: "Set",
  connected: "Connected",
  not_enabled: "Not enabled",
  recommended: "Recommended",
};

export function SecurityMethodList({
  title = "Security",
  description = "Manage sign-in methods and account protection.",
  methods,
  onMethodAction,
  className,
}: SecurityMethodListProps) {
  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge tone="success">Protected</Badge>
      </CardHeader>
      <CardContent>
        <FormSection title="Sign-in methods" description={description}>
          <div className="grid gap-3 md:grid-cols-2">
            {methods.map((method) => {
              const Icon = method.icon ?? ShieldCheck;
              return (
                <div
                  key={method.id}
                  className="grid gap-4 rounded-[var(--radius-lg)] border border-border bg-secondary p-4"
                >
                  <div>
                    <Icon className="mb-3 size-5 text-accent" aria-hidden="true" />
                    <p className="font-ui text-sm font-semibold">{method.label}</p>
                    {method.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{method.description}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone={stateTone[method.state]}>
                      {method.stateLabel ?? stateLabels[method.state]}
                    </Badge>
                    {onMethodAction && method.actionLabel ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="soft"
                        disabled={method.disabled}
                        onClick={() => onMethodAction(method)}
                      >
                        {method.actionLabel}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </FormSection>
      </CardContent>
    </Card>
  );
}

export { stateLabels as securityMethodStateLabels, stateTone as securityMethodStateTone };
