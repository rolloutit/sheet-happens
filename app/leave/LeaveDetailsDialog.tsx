"use client";

import {
  Download,
  ExternalLink,
  Paperclip,
  Pencil,
  Sunrise,
  Sunset,
  Trash2,
  Upload,
} from "lucide-react";
import type { Route } from "next";
import { useRef, useState, useTransition } from "react";

import { notify } from "@/src/components/sheet/Toast";
import { LeaveKindBadge } from "@/src/components/sheet/LeaveKindBadge";
import { Button } from "@/src/components/ui/Button";
import { Checkbox } from "@/src/components/ui/Checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import { FormMessage } from "@/src/components/ui/FormMessage";
import { formatDateTime } from "@/src/lib/formatting";
import { initialLeaveActionState, type LeaveActionState } from "./action-state";
import { uploadLeaveAttachmentAction } from "./actions";
import type { AdminLeaveView, LeaveView } from "./leave-view-types";
import { useLeaveText } from "./use-leave-labels";

export type LeaveAdminControls = {
  onEdit: (leave: AdminLeaveView) => void;
  deleteLeave: (leaveId: string) => Promise<LeaveActionState>;
  setHrProcessed: (leaveIds: string[], processed: boolean) => Promise<LeaveActionState>;
  removeAttachment: (leaveId: string) => Promise<LeaveActionState>;
};

export type LeaveDetailsDialogProps = {
  leave: LeaveView | AdminLeaveView | null;
  onOpenChange: (open: boolean) => void;
  /** Present on the admin screen only; the employee screen has no edit, delete or HR controls. */
  admin?: LeaveAdminControls;
};

function isAdminLeave(leave: LeaveView | AdminLeaveView): leave is AdminLeaveView {
  return "hrProcessedAt" in leave;
}

/**
 * Everything about one leave, and the few things that can still be done to it.
 *
 * For an employee that is only the sick note: changing or removing a recorded leave is the admin's
 * job, and the dialog says so rather than offering buttons that would be refused.
 */
export function LeaveDetailsDialog({ leave, onOpenChange, admin }: LeaveDetailsDialogProps) {
  const text = useLeaveText();
  const { t, locale } = text;

  return (
    <Dialog open={leave !== null} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("actions.close")} className="sm:max-w-lg">
        {leave ? (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <LeaveKindBadge kind={leave.kind} label={text.kind(leave)} />
                {leave.dayPart !== "FULL" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    {leave.dayPart === "MORNING" ? (
                      <Sunrise className="size-3.5" aria-hidden="true" />
                    ) : (
                      <Sunset className="size-3.5" aria-hidden="true" />
                    )}
                    {text.dayPart(leave)}
                  </span>
                ) : null}
              </div>
              <DialogTitle className="pt-1">{text.range(leave)}</DialogTitle>
              <DialogDescription>
                {leave.isOwn
                  ? text.workdays(leave.workdays)
                  : `${leave.memberName}, ${text.workdays(leave.workdays)}`}
              </DialogDescription>
            </DialogHeader>

            {leave.note ? (
              <section className="grid gap-1">
                <h3 className="font-ui text-xs font-semibold text-muted-foreground">
                  {t("details.note")}
                </h3>
                <p className="text-sm whitespace-pre-wrap text-foreground">{leave.note}</p>
              </section>
            ) : null}

            {leave.kind === "sick" && (leave.isOwn || admin) ? (
              <AttachmentSection leave={leave} admin={admin} />
            ) : null}

            {admin && isAdminLeave(leave) ? (
              <AdminSection leave={leave} admin={admin} onClose={() => onOpenChange(false)} />
            ) : leave.isOwn ? (
              <p className="text-xs text-muted-foreground">{t("details.adminOnly")}</p>
            ) : null}

            {admin && isAdminLeave(leave) && leave.hrProcessedAt ? (
              <p className="text-xs text-muted-foreground">
                {t("admin.hr.processedBy", {
                  name: leave.hrProcessedByName ?? "",
                  date: formatDateTime(leave.hrProcessedAt, locale),
                })}
              </p>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AttachmentSection({ leave, admin }: { leave: LeaveView; admin?: LeaveAdminControls }) {
  const { t } = useLeaveText();
  const [uploading, startUploading] = useTransition();
  const [removing, startRemoving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const href = `/api/leave/${leave.id}/attachment`;

  return (
    <section className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-secondary/40 p-3">
      <h3 className="flex items-center gap-1.5 font-ui text-xs font-semibold text-muted-foreground">
        <Paperclip className="size-3.5" aria-hidden="true" />
        {t("details.attachment")}
      </h3>

      {leave.attachment ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {leave.attachment.filename}
          </span>
          <Button asChild variant="soft" size="sm">
            <a href={href as Route} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" />
              {t("details.open")}
            </a>
          </Button>
          <Button asChild variant="soft" size="sm">
            <a href={`${href}?download=1` as Route}>
              <Download aria-hidden="true" />
              {t("details.download")}
            </a>
          </Button>
          {admin ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={removing}
              onClick={() =>
                startRemoving(async () => {
                  const result = await admin.removeAttachment(leave.id);
                  notify(result.status === "success" ? "success" : "error", result.message);
                })
              }
            >
              <Trash2 aria-hidden="true" />
              {t("details.removeAttachment")}
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("details.noAttachment")}</p>
      )}

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startUploading(async () => {
            const result = await uploadLeaveAttachmentAction(initialLeaveActionState, formData);
            if (result.status !== "success") {
              setError(result.message);
              return;
            }
            setError(null);
            setChosen(null);
            if (fileRef.current) fileRef.current.value = "";
            notify("success", result.message);
          });
        }}
      >
        <input type="hidden" name="leaveId" value={leave.id} />
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t("form.file")}</span>
          <input
            ref={fileRef}
            name="file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(event) => setChosen(event.target.files?.[0]?.name ?? null)}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-[var(--radius-pill)] file:border file:border-border-strong file:bg-card file:px-3 file:py-1.5 file:font-ui file:text-sm file:font-semibold file:text-foreground hover:file:bg-muted"
          />
        </label>
        <Button
          type="submit"
          size="sm"
          disabled={!chosen || uploading}
          aria-busy={uploading || undefined}
        >
          <Upload aria-hidden="true" />
          {leave.attachment ? t("details.replace") : t("details.upload")}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">{t("form.fileHint")}</p>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </section>
  );
}

function AdminSection({
  leave,
  admin,
  onClose,
}: {
  leave: AdminLeaveView;
  admin: LeaveAdminControls;
  onClose: () => void;
}) {
  const { t } = useLeaveText();
  const [pending, startAction] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const run = (task: () => Promise<LeaveActionState>, after?: () => void) =>
    startAction(async () => {
      const result = await task();
      notify(result.status === "success" ? "success" : "error", result.message);
      if (result.status === "success") after?.();
    });

  return (
    <>
      <label className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-lg)] border border-border px-3 py-3">
        <Checkbox
          checked={Boolean(leave.hrProcessedAt)}
          disabled={pending}
          onCheckedChange={(checked) =>
            run(() => admin.setHrProcessed([leave.id], checked === true))
          }
        />
        <span className="grid gap-0.5">
          <span className="font-ui text-sm font-semibold text-foreground">
            {t("admin.hr.label")}
          </span>
          <span className="text-xs text-muted-foreground">{t("admin.hr.hint")}</span>
        </span>
      </label>

      <DialogFooter className="gap-2 sm:justify-between">
        {confirmingDelete ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-foreground">{t("admin.deleteConfirm")}</span>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() => run(() => admin.deleteLeave(leave.id), onClose)}
            >
              {t("admin.deleteConfirmAction")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingDelete(false)}
            >
              {t("actions.cancel")}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 aria-hidden="true" />
            {t("admin.delete")}
          </Button>
        )}
        <Button type="button" variant="soft" size="sm" onClick={() => admin.onEdit(leave)}>
          <Pencil aria-hidden="true" />
          {t("admin.edit")}
        </Button>
      </DialogFooter>
    </>
  );
}
