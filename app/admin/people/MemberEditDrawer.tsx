"use client";

import { CalendarClock, Save } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState, useTransition } from "react";

import { Button } from "@/src/components/ui/Button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/src/components/ui/Drawer";
import { DatePicker } from "@/src/components/ui/DatePicker";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { Select } from "@/src/components/ui/Select";
import { Textarea } from "@/src/components/ui/Textarea";
import { usePickerLabels } from "@/src/i18n/picker-labels";
import type { MemberPreferenceOptions } from "@/src/lib/member-preferences";
import type { AdminPersonRow } from "@/src/server/users";
import type { TrackingMode } from "@/src/server/time-tracking";
import { scheduleProfileTransitionAction, updateMemberDetailsAction } from "./actions";
import type {
  AdminPeopleActionState,
  ScheduleProfileTransitionActionInput,
  ScheduleProfileTransitionActionState,
  UpdateMemberDetailsActionInput,
  UpdateMemberDetailsActionState,
} from "./actions.types";

export type MemberEditDrawerProps = {
  member: AdminPersonRow | null;
  open: boolean;
  preferenceOptions: MemberPreferenceOptions;
  todayDate: string;
  onOpenChange: (open: boolean) => void;
  onResult: (result: AdminPeopleActionState) => void;
  onSaved: () => void;
};

type EditableValues = Omit<UpdateMemberDetailsActionInput, "memberId">;
type ProfileTransitionValues = Omit<ScheduleProfileTransitionActionInput, "memberId">;

export function MemberEditDrawer({
  member,
  open,
  preferenceOptions,
  todayDate,
  onOpenChange,
  onResult,
  onSaved,
}: MemberEditDrawerProps) {
  const t = useTranslations("AdminPeople");

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="w-[min(42rem,100vw)] overflow-y-auto">
        <DrawerHeader>
          <DrawerTitle className="text-2xl font-semibold text-foreground">
            {t("editDrawer.title")}
          </DrawerTitle>
          <DrawerDescription className="text-sm leading-6 text-muted-foreground">
            {t("editDrawer.description")}
          </DrawerDescription>
        </DrawerHeader>

        {member ? (
          <MemberEditForm
            key={member.id}
            member={member}
            preferenceOptions={preferenceOptions}
            todayDate={todayDate}
            onCancel={() => onOpenChange(false)}
            onResult={onResult}
            onSaved={() => {
              onOpenChange(false);
              onSaved();
            }}
          />
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function MemberEditForm({
  member,
  preferenceOptions,
  todayDate,
  onCancel,
  onResult,
  onSaved,
}: {
  member: AdminPersonRow;
  preferenceOptions: MemberPreferenceOptions;
  todayDate: string;
  onCancel: () => void;
  onResult: (result: AdminPeopleActionState) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("AdminPeople");
  const pickerLabels = usePickerLabels();
  const [values, setValues] = useState<EditableValues>(() => getEditableValues(member));
  const [fieldErrors, setFieldErrors] =
    useState<UpdateMemberDetailsActionState["fieldErrors"]>(undefined);
  const [status, setStatus] = useState<UpdateMemberDetailsActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateField(field: keyof EditableValues, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const trackingModeOptions: Array<{ value: TrackingMode; label: string }> = [
    { value: "TRACKED", label: t("trackingMode.tracked") },
    { value: "DECLARED", label: t("trackingMode.declared") },
  ];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setFieldErrors(undefined);

    startTransition(async () => {
      const result = await updateMemberDetailsAction({
        memberId: member.id,
        ...values,
      });

      setStatus(result);
      setFieldErrors(result.fieldErrors);
      onResult(result);

      if (result.status === "success") {
        onSaved();
      }
    });
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-[var(--radius-lg)] border border-border bg-secondary/50 p-4">
        <p className="font-ui text-sm font-semibold text-foreground">{member.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">{member.email}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {t.rich("editDrawer.currentProfile", {
            profile: member.profileValue
              ? t(`profiles.${member.profileValue === "CONTRACTOR" ? "contractor" : "employee"}`)
              : member.profile,
            strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
          })}
          {member.scheduledProfile && member.scheduledProfileValidFrom ? (
            <>
              {", "}
              {t("editDrawer.scheduledProfile", {
                profile: member.scheduledProfileValue
                  ? t(
                      `profiles.${
                        member.scheduledProfileValue === "CONTRACTOR" ? "contractor" : "employee"
                      }`,
                    )
                  : member.scheduledProfile,
                validFrom: member.scheduledProfileValidFrom,
              })}
            </>
          ) : null}
        </p>
      </div>

      <form className="grid gap-5" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("form.firstName")}
            required
            reserveMessageSpace
            error={fieldErrors?.firstName}
          >
            {({ id, describedBy, invalid, required }) => (
              <Input
                id={id}
                value={values.firstName}
                autoComplete="given-name"
                aria-describedby={describedBy}
                invalid={invalid}
                required={required}
                onChange={(event) => updateField("firstName", event.target.value)}
              />
            )}
          </Field>
          <Field
            label={t("form.lastName")}
            required
            reserveMessageSpace
            error={fieldErrors?.lastName}
          >
            {({ id, describedBy, invalid, required }) => (
              <Input
                id={id}
                value={values.lastName}
                autoComplete="family-name"
                aria-describedby={describedBy}
                invalid={invalid}
                required={required}
                onChange={(event) => updateField("lastName", event.target.value)}
              />
            )}
          </Field>
        </div>

        <Field
          label={t("form.displayName")}
          reserveMessageSpace
          hint={t("form.displayNameHint")}
          error={fieldErrors?.displayName}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              value={values.displayName}
              autoComplete="name"
              maxLength={120}
              aria-describedby={describedBy}
              invalid={invalid}
              onChange={(event) => updateField("displayName", event.target.value)}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-[minmax(7rem,0.75fr)_minmax(12rem,1.25fr)_minmax(7rem,0.75fr)]">
          <Field
            label={t("form.currency")}
            required
            reserveMessageSpace
            error={fieldErrors?.defaultCurrencyCode}
          >
            {({ id, describedBy, invalid, required }) => (
              <Select
                id={id}
                label={t("form.currency")}
                value={values.defaultCurrencyCode}
                aria-describedby={describedBy}
                invalid={invalid}
                required={required}
                labels={pickerLabels.combobox}
                options={preferenceOptions.currencies}
                onValueChange={(value) => updateField("defaultCurrencyCode", value)}
              />
            )}
          </Field>
          <Field
            label={t("form.timezone")}
            required
            reserveMessageSpace
            error={fieldErrors?.timezone}
          >
            {({ id, describedBy, invalid, required }) => (
              <Select
                id={id}
                label={t("form.timezone")}
                value={values.timezone}
                aria-describedby={describedBy}
                invalid={invalid}
                required={required}
                labels={pickerLabels.combobox}
                options={preferenceOptions.timezones}
                onValueChange={(value) => updateField("timezone", value)}
              />
            )}
          </Field>
          <Field label={t("form.locale")} required reserveMessageSpace error={fieldErrors?.locale}>
            {({ id, describedBy, invalid, required }) => (
              <Select
                id={id}
                label={t("form.locale")}
                value={values.locale}
                aria-describedby={describedBy}
                invalid={invalid}
                required={required}
                labels={pickerLabels.combobox}
                options={preferenceOptions.locales}
                onValueChange={(value) => updateField("locale", value)}
              />
            )}
          </Field>
        </div>

        {/* The default lives here, with the member's other timeline-free attributes, because it
            applies across every project — setting it from inside one project's assignment table
            would let an admin change one project and silently change the rest. The per-assignment
            override is in Projects, beside the rate override. */}
        <Field
          label={t("form.defaultTrackingMode")}
          required
          reserveMessageSpace
          hint={t("form.defaultTrackingModeHint")}
          error={fieldErrors?.defaultTrackingMode}
        >
          {({ id, describedBy, invalid, required }) => (
            <Select
              id={id}
              label={t("form.defaultTrackingMode")}
              value={values.defaultTrackingMode}
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
              searchable={false}
              options={trackingModeOptions}
              onValueChange={(value) => updateField("defaultTrackingMode", value)}
            />
          )}
        </Field>

        {status && status.status === "error" ? (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] border border-destructive/40 bg-destructive-soft px-3 py-2 text-sm text-destructive"
          >
            {status.message}
          </p>
        ) : null}

        <DrawerFooter>
          <Button type="button" variant="ghost" disabled={isPending} onClick={onCancel}>
            {t("actions.cancel")}
          </Button>
          <Button type="submit" icon={Save} loading={isPending}>
            {t("actions.saveChanges")}
          </Button>
        </DrawerFooter>
      </form>

      <ProfileTransitionForm
        member={member}
        todayDate={todayDate}
        onResult={onResult}
        onSaved={onSaved}
      />
    </div>
  );
}

function ProfileTransitionForm({
  member,
  todayDate,
  onResult,
  onSaved,
}: {
  member: AdminPersonRow;
  todayDate: string;
  onResult: (result: AdminPeopleActionState) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("AdminPeople");
  const locale = useLocale();
  const pickerLabels = usePickerLabels();
  const [values, setValues] = useState<ProfileTransitionValues>(() => ({
    profile: getOppositeProfile(member.profileValue),
    validFrom: todayDate,
    reason: "",
  }));
  const [fieldErrors, setFieldErrors] =
    useState<ScheduleProfileTransitionActionState["fieldErrors"]>(undefined);
  const [status, setStatus] = useState<ScheduleProfileTransitionActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateField(field: keyof ProfileTransitionValues, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setFieldErrors(undefined);

    startTransition(async () => {
      const result = await scheduleProfileTransitionAction({
        memberId: member.id,
        ...values,
      });

      setStatus(result);
      setFieldErrors(result.fieldErrors);
      onResult(result);

      if (result.status === "success") {
        onSaved();
      }
    });
  }

  return (
    <form
      className="grid gap-4 rounded-[var(--radius-lg)] border border-border bg-secondary/30 p-4"
      onSubmit={submit}
    >
      <div>
        <p className="font-ui text-sm font-semibold text-foreground">
          {t("profileTransition.title")}
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t("profileTransition.description")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)]">
        <Field
          label={t("profileTransition.newProfile")}
          required
          reserveMessageSpace
          error={fieldErrors?.profile}
        >
          {({ id, describedBy, invalid, required }) => (
            <Select
              id={id}
              label={t("profileTransition.newProfile")}
              value={values.profile}
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
              labels={pickerLabels.combobox}
              options={[
                { value: "CONTRACTOR", label: t("profiles.contractor") },
                { value: "EMPLOYEE", label: t("profiles.employee") },
              ]}
              onValueChange={(value) =>
                updateField("profile", value as ProfileTransitionValues["profile"])
              }
            />
          )}
        </Field>

        <Field
          label={t("profileTransition.effectiveDate")}
          required
          reserveMessageSpace
          error={fieldErrors?.validFrom}
        >
          {({ id, describedBy, invalid, required }) => (
            <DatePicker
              id={id}
              label={t("profileTransition.effectiveDate")}
              locale={locale}
              value={values.validFrom}
              min={todayDate}
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
              labels={pickerLabels.date}
              onValueChange={(value) => updateField("validFrom", value ?? "")}
            />
          )}
        </Field>
      </div>

      <Field
        label={t("profileTransition.reason")}
        reserveMessageSpace
        hint={t("profileTransition.reasonHint")}
        error={fieldErrors?.reason}
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            value={values.reason}
            maxLength={500}
            aria-describedby={describedBy}
            invalid={invalid}
            onChange={(event) => updateField("reason", event.target.value)}
          />
        )}
      </Field>

      {status && status.status === "error" ? (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-destructive/40 bg-destructive-soft px-3 py-2 text-sm text-destructive"
        >
          {status.message}
        </p>
      ) : null}

      <DrawerFooter>
        <Button type="submit" icon={CalendarClock} loading={isPending}>
          {t("actions.scheduleTransition")}
        </Button>
      </DrawerFooter>
    </form>
  );
}

function getEditableValues(member: AdminPersonRow | null): EditableValues {
  return {
    firstName: member?.firstName ?? "",
    lastName: member?.lastName ?? "",
    displayName: member?.displayName ?? "",
    defaultCurrencyCode: member?.defaultCurrencyCode ?? "EUR",
    timezone: member?.timezone ?? "Europe/Budapest",
    locale: member?.locale ?? "en",
    defaultTrackingMode: member?.defaultTrackingMode ?? "TRACKED",
  };
}

function getOppositeProfile(
  profile: AdminPersonRow["profileValue"],
): ProfileTransitionValues["profile"] {
  return profile === "EMPLOYEE" ? "CONTRACTOR" : "EMPLOYEE";
}
