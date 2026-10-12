"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { FormDrawer } from "@/src/components/sheet/FormDrawer";
import { LeaveForm, type LeaveFormProps } from "./LeaveForm";

export type LeaveFormDrawerProps = Omit<LeaveFormProps, "onDirtyChange" | "onDone"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
};

/** The leave form in a side sheet, guarded against losing typed input like every other drawer. */
export function LeaveFormDrawer({
  open,
  onOpenChange,
  onDone,
  ...formProps
}: LeaveFormDrawerProps) {
  const t = useTranslations("Leave");
  const [dirty, setDirty] = useState(false);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setDirty(false);
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const handleDone = useCallback(
    (message: string) => {
      handleOpenChange(false);
      onDone(message);
    },
    [handleOpenChange, onDone],
  );

  const create = formProps.mode === "create";
  // An admin recording for someone else picks the employee; the employee's own copy would be wrong.
  const adminCreate = create && Boolean(formProps.memberOptions);

  return (
    <FormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={adminCreate ? t("form.adminTitle") : create ? t("form.title") : t("form.editTitle")}
      description={
        adminCreate
          ? t("form.adminDescription")
          : create
            ? t("form.description")
            : t("form.editDescription")
      }
      dirty={dirty}
      closeLabel={t("actions.close")}
      discardLabels={{
        title: t("discardDialog.title"),
        description: t("discardDialog.description"),
        confirm: t("discardDialog.confirm"),
        cancel: t("discardDialog.cancel"),
      }}
    >
      {open ? (
        <LeaveForm
          // A fresh form per leave, so editing a second leave never shows the first one's values.
          key={formProps.initial?.leaveId ?? "new"}
          {...formProps}
          onDirtyChange={setDirty}
          onDone={handleDone}
        />
      ) : null}
    </FormDrawer>
  );
}
