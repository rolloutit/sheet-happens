"use client";

import { Eye, RefreshCw, Search, X } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { Pager } from "@/src/components/ui/Pager";
import { DataTable, type TableColumn } from "@/src/components/ui/Table";
import { cn } from "@/src/lib/utils";
import type { AuditLogListResult, AuditLogRow } from "@/src/server/audit";

export type AdminAuditLogClientProps = {
  result: AuditLogListResult;
};

type AuditTableRow = AuditLogRow & Record<string, unknown>;

const selectClassName =
  "flex h-10 w-full rounded-[var(--radius-md)] border border-input bg-background/50 px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35";

export function AdminAuditLogClient({ result }: AdminAuditLogClientProps) {
  const t = useTranslations("AdminAudit");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [watching, setWatching] = useState(false);
  const [selectedRow, setSelectedRow] = useState<AuditLogRow | null>(null);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const rows = result.rows as AuditTableRow[];
  const auditColumns = getAuditColumns(t);

  useEffect(() => {
    if (!watching) return undefined;

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 15_000);

    return () => window.clearInterval(intervalId);
  }, [router, watching]);

  function updatePage(page: number) {
    const params = new URLSearchParams(searchParams.toString());

    if (page <= 1) params.delete("page");
    else params.set("page", String(page));

    router.push(buildUrl(pathname, params) as Route);
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams(searchParams.toString());

    setParam(params, "q", formData.get("q"));
    setParam(params, "action", formData.get("action"));
    setParam(params, "targetType", formData.get("targetType"));
    setParam(params, "actor", formData.get("actor"));
    setParam(params, "from", formData.get("from"));
    setParam(params, "to", formData.get("to"));
    params.delete("page");

    router.push(buildUrl(pathname, params) as Route);
  }

  function refreshNow() {
    startRefreshTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col justify-between gap-3 rounded-[var(--radius-lg)] border border-border bg-card/70 p-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("client.showing", {
              start: result.pageStart,
              end: result.pageEnd,
              total: result.totalItems,
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("client.lastRefreshed", { time: formatIsoTimestamp(result.refreshedAt) })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-background/50 px-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 accent-[color:var(--accent)]"
              checked={watching}
              onChange={(event) => setWatching(event.currentTarget.checked)}
            />
            {t("client.watch")}
          </label>
          <Button
            type="button"
            variant="soft"
            size="sm"
            icon={RefreshCw}
            loading={isRefreshing}
            onClick={refreshNow}
          >
            {t("client.refresh")}
          </Button>
        </div>
      </div>

      <form
        className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-4"
        onSubmit={submitFilters}
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_repeat(3,minmax(10rem,12rem))]">
          <Field label={t("client.search")} htmlFor="audit-search">
            <Input
              id="audit-search"
              name="q"
              type="search"
              defaultValue={result.filters.query}
              placeholder={t("client.searchPlaceholder")}
            />
          </Field>
          <Field label={t("client.event")} htmlFor="audit-action">
            <select
              id="audit-action"
              name="action"
              defaultValue={result.filters.action}
              className={selectClassName}
            >
              <option value="">{t("client.allEvents")}</option>
              {result.actionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("client.target")} htmlFor="audit-target-type">
            <select
              id="audit-target-type"
              name="targetType"
              defaultValue={result.filters.targetType}
              className={selectClassName}
            >
              <option value="">{t("client.allTargets")}</option>
              {result.targetTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("client.actor")} htmlFor="audit-actor">
            <select
              id="audit-actor"
              name="actor"
              defaultValue={result.filters.actorMemberId}
              className={selectClassName}
            >
              <option value="">{t("client.allActors")}</option>
              {result.actorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.email ? `${option.label} (${option.email})` : option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(10rem,12rem)_minmax(10rem,12rem)_auto_auto] sm:items-end">
          <Field label={t("client.from")} htmlFor="audit-from">
            <Input id="audit-from" name="from" type="date" defaultValue={result.filters.fromDate} />
          </Field>
          <Field label={t("client.to")} htmlFor="audit-to">
            <Input id="audit-to" name="to" type="date" defaultValue={result.filters.toDate} />
          </Field>
          <Button type="submit" icon={Search}>
            {t("client.apply")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            icon={X}
            onClick={() => router.push(pathname as Route)}
          >
            {t("client.clear")}
          </Button>
        </div>
      </form>

      <DataTable<AuditTableRow>
        rows={rows}
        columns={auditColumns}
        getRowKey={(row) => row.id}
        empty={t("client.empty")}
        displayMode="responsive"
        density="compact"
        aria-label={t("client.ariaLabel")}
        rowActions={(row) => (
          <Button
            type="button"
            variant="soft"
            size="sm"
            icon={Eye}
            onClick={() => setSelectedRow(row)}
          >
            {t("client.details")}
          </Button>
        )}
      />

      <Pager
        page={result.filters.page}
        totalPages={result.totalPages}
        totalItems={result.totalItems}
        showPageNumbers
        onPageChange={updatePage}
      />

      <AuditLogDetailsDialog
        row={selectedRow}
        onOpenChange={(open) => !open && setSelectedRow(null)}
      />
    </div>
  );
}

function getAuditColumns(t: ReturnType<typeof useTranslations>): TableColumn<AuditTableRow>[] {
  return [
    {
      id: "createdAt",
      header: t("client.time"),
      cell: (row) => (
        <span className="font-ui text-xs font-semibold text-foreground">{row.createdAtLabel}</span>
      ),
      width: "12rem",
    },
    {
      id: "action",
      header: t("client.event"),
      cell: (row) => (
        <span className="grid gap-1">
          <Badge tone={getActionTone(row.action)} dot>
            {row.action}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">{row.id.slice(0, 8)}</span>
        </span>
      ),
      width: "17rem",
    },
    {
      id: "actor",
      header: t("client.actor"),
      cell: (row) => (
        <span className="grid gap-0.5">
          <span className="font-medium text-foreground">{row.actorName}</span>
          {row.actorEmail ? <span className="text-xs">{row.actorEmail}</span> : null}
        </span>
      ),
      width: "14rem",
    },
    {
      id: "target",
      header: t("client.target"),
      cell: (row) => (
        <span className="grid gap-0.5">
          <span className="font-medium text-foreground">{row.targetType}</span>
          <span className="break-all font-mono text-xs">{row.targetId}</span>
        </span>
      ),
    },
    {
      id: "request",
      header: t("client.request"),
      cell: (row) => (
        <span className="grid gap-0.5">
          <span>{row.ipAddress ?? t("client.noIp")}</span>
          {row.requestId ? <span className="font-mono text-xs">{row.requestId}</span> : null}
        </span>
      ),
      width: "12rem",
    },
  ];
}

function AuditLogDetailsDialog({
  row,
  onOpenChange,
}: {
  row: AuditLogRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("AdminAudit");

  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row ? row.action : t("client.auditEvent")}</DialogTitle>
          <DialogDescription>{t("client.dialogDescription")}</DialogDescription>
        </DialogHeader>
        {row ? (
          <div className="grid gap-4">
            <dl className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-card/70 p-4 text-sm sm:grid-cols-2">
              <AuditMeta label={t("client.time")} value={row.createdAtLabel} />
              <AuditMeta
                label={t("client.actor")}
                value={row.actorEmail ? `${row.actorName} (${row.actorEmail})` : row.actorName}
              />
              <AuditMeta label={t("client.target")} value={`${row.targetType} / ${row.targetId}`} />
              <AuditMeta
                label={t("client.request")}
                value={row.requestId ?? t("client.noRequestId")}
              />
              <AuditMeta label={t("client.ipAddress")} value={row.ipAddress ?? t("client.noIp")} />
              <AuditMeta
                label={t("client.userAgent")}
                value={row.userAgent ?? t("client.noUserAgent")}
              />
            </dl>
            <div className="grid gap-4 lg:grid-cols-2">
              <JsonBlock title={t("client.before")} value={row.before} />
              <JsonBlock title={t("client.after")} value={row.after} />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AuditMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="font-ui text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="break-words text-foreground">{value}</dd>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  const t = useTranslations("AdminAudit");
  const hasValue = value !== null && value !== undefined;

  return (
    <section className="grid gap-2">
      <h3 className="font-ui text-sm font-semibold text-foreground">{title}</h3>
      <pre
        className={cn(
          "max-h-80 overflow-auto rounded-[var(--radius-lg)] border border-border bg-background/70 p-3 text-xs leading-5 text-muted-foreground",
          !hasValue && "text-muted-foreground/70",
        )}
      >
        {hasValue ? JSON.stringify(value, null, 2) : t("client.noData")}
      </pre>
    </section>
  );
}

function setParam(params: URLSearchParams, key: string, value: FormDataEntryValue | null) {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (normalized) params.set(key, normalized);
  else params.delete(key);
}

function buildUrl(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function formatIsoTimestamp(value: string) {
  return `${value.slice(0, 10)} ${value.slice(11, 19)} UTC`;
}

function getActionTone(action: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (action.includes("deleted") || action.includes("revoked") || action.includes("disabled")) {
    return "danger";
  }

  if (action.includes("reset") || action.includes("changed") || action.includes("updated")) {
    return "warning";
  }

  if (action.includes("created") || action.includes("activated") || action.includes("enabled")) {
    return "success";
  }

  if (action.startsWith("security.")) {
    return "info";
  }

  return "neutral";
}
