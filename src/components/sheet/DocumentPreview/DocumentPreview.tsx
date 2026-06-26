import { Badge } from "@/src/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import type { DocumentPreviewProps } from "./DocumentPreview.types";

export function DocumentPreview({
  title,
  eyebrow = "Sheet Happens report",
  mode = "cost-free",
  rows,
  className,
}: DocumentPreviewProps) {
  const visibleRows = rows.filter((row) => mode === "internal" || !row.internalOnly);

  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <CardTitle>Export document</CardTitle>
        <Badge tone={mode === "internal" ? "warning" : "info"}>{mode}</Badge>
      </CardHeader>
      <CardContent>
        <div className="rounded bg-white p-5 text-slate-900 shadow-inner">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase text-slate-500">{eyebrow}</p>
          ) : null}
          <h3 className="mt-2 text-xl font-semibold">{title}</h3>
          <div className="mt-4 grid gap-2 text-sm">
            {visibleRows.map((row) => (
              <div key={row.id} className="flex justify-between border-b border-slate-200 py-2">
                <span>{row.label}</span>
                <span>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
