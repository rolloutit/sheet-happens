"use client";

import { FolderPlus, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  FormDrawer,
  FormDrawerBody,
  FormDrawerFooter,
  useFormDrawerClose,
} from "@/src/components/sheet/FormDrawer";
import { Button } from "@/src/components/ui/Button";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { ResultBanner } from "@/src/components/ui/ResultBanner";
import { Textarea } from "@/src/components/ui/Textarea";
import type { AdminProjectGroupRow } from "@/src/server/projects";
import type { CreateProjectGroupActionInput, ProjectGroupActionState } from "./actions.types";
import { nativeCheckboxClassName } from "./formStyles";

export type ProjectGroupFormDrawerProps = {
  open: boolean;
  /** `null` while open puts the drawer in create mode. */
  group: AdminProjectGroupRow | null;
  pending: boolean;
  actionState: ProjectGroupActionState;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CreateProjectGroupActionInput) => void;
};

/**
 * Create/edit sheet for a project group. A `FormDrawer` rather than the `Dialog` this used to be
 * — the whole point of the redesign was to stop stacking surfaces, and a form this size reads
 * better with room to breathe than boxed into a `max-w-2xl` modal.
 */
export function ProjectGroupFormDrawer({
  open,
  group,
  pending,
  actionState,
  onOpenChange,
  onSubmit,
}: ProjectGroupFormDrawerProps) {
  const t = useTranslations("AdminProjects");
  const [dirty, setDirty] = useState(false);

  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) setDirty(false);
        onOpenChange(next);
      }}
      title={
        group ? t("groupsPanel.editTitle", { name: group.name }) : t("groupsPanel.createTitle")
      }
      description={group ? t("groupsPanel.editDescription") : t("groupsPanel.createDescription")}
      dirty={dirty}
      closeLabel={t("actions.close")}
      discardLabels={{
        title: t("groupsPanel.discardDialog.title"),
        description: t("groupsPanel.discardDialog.description"),
        confirm: t("groupsPanel.discardDialog.confirm"),
        cancel: t("groupsPanel.discardDialog.cancel"),
      }}
    >
      <ProjectGroupForm
        group={group}
        pending={pending}
        actionState={actionState}
        onDirtyChange={setDirty}
        onSubmit={onSubmit}
      />
    </FormDrawer>
  );
}

function ProjectGroupForm({
  group,
  pending,
  actionState,
  onDirtyChange,
  onSubmit,
}: {
  group: AdminProjectGroupRow | null;
  pending: boolean;
  actionState: ProjectGroupActionState;
  onDirtyChange: (dirty: boolean) => void;
  onSubmit: (values: CreateProjectGroupActionInput) => void;
}) {
  const t = useTranslations("AdminProjects");
  const requestClose = useFormDrawerClose();

  return (
    <form
      // Remounts between create and edit so the uncontrolled defaults reload.
      key={group?.id ?? "create"}
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        onSubmit({
          name: getGroupFormString(formData, "name"),
          slug: getGroupFormString(formData, "slug"),
          description: getGroupFormString(formData, "description"),
          active: formData.get("active") === "true",
        });
      }}
    >
      <FormDrawerBody className="grid gap-5" onChange={() => onDirtyChange(true)}>
        <Field
          label={t("groupsPanel.groupName")}
          required
          reserveMessageSpace
          error={actionState.fieldErrors?.name}
        >
          {({ id, describedBy, invalid, required }) => (
            <Input
              id={id}
              name="name"
              defaultValue={group?.name ?? ""}
              autoComplete="off"
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
            />
          )}
        </Field>
        <Field
          label={t("form.slug")}
          hint={group ? undefined : t("groupsPanel.generatedSlug")}
          reserveMessageSpace
          error={actionState.fieldErrors?.slug}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="slug"
              defaultValue={group?.slug ?? ""}
              autoComplete="off"
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
        <Field
          label={t("groupsPanel.description")}
          reserveMessageSpace
          error={actionState.fieldErrors?.description}
        >
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              name="description"
              defaultValue={group?.description ?? ""}
              placeholder={t("groupsPanel.descriptionPlaceholder")}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        {/* A native input, not the Radix `Checkbox` — this one is read back from `FormData` on
            an uncontrolled submit, and `ProjectCreateForm` uses the same native-input pattern
            for exactly that reason. */}
        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="active"
            value="true"
            defaultChecked={group?.active ?? true}
            className={nativeCheckboxClassName}
          />
          {t("states.active")}
        </label>

        {actionState.status === "error" && actionState.message ? (
          <ResultBanner tone="error">{actionState.message}</ResultBanner>
        ) : null}
      </FormDrawerBody>

      <FormDrawerFooter>
        <Button type="button" variant="ghost" onClick={requestClose} disabled={pending}>
          {t("actions.cancel")}
        </Button>
        <Button type="submit" icon={group ? Save : FolderPlus} loading={pending}>
          {group ? t("actions.saveGroup") : t("actions.createGroup")}
        </Button>
      </FormDrawerFooter>
    </form>
  );
}

function getGroupFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
