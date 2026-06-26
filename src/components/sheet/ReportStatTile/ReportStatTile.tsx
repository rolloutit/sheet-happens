import { FileSpreadsheet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { cn } from "@/src/lib/utils";
import type { ReportStatTileProps, ReportStatTone } from "./ReportStatTile.types";

const iconTone: Record<ReportStatTone, string> = {
  neutral: "text-muted-foreground",
  info: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

export function ReportStatTile({
  label,
  value,
  helperText = "Current filter",
  tone = "info",
  icon: Icon = FileSpreadsheet,
  className,
}: ReportStatTileProps) {
  const warning = tone === "warning" || tone === "danger";

  return (
    <Card variant={warning ? "warning" : "elevated"} className={className}>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <Icon className={cn("size-5", iconTone[tone])} aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
        {helperText ? <p className="text-sm text-muted-foreground">{helperText}</p> : null}
      </CardContent>
    </Card>
  );
}
