"use client";

import { CheckCircle2, Mail, Send, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Route } from "next";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  AuthButton,
  AuthField,
  AuthInput,
  AuthNotice,
  AuthScreenHead,
} from "@/src/components/layout/AuthForm";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { authClient } from "@/src/lib/auth-client";
import { activateInvitationAction } from "./actions";
import type { ActivateInvitationActionState } from "./actions.types";

export type AcceptInvitationPanelProps = {
  token: string;
  email: string;
  name: string;
  available: boolean;
  expired: boolean;
  status: string;
  sessionUser?: {
    email: string;
  } | null;
};

const initialActivationState: ActivateInvitationActionState = {
  status: "idle",
};

export function AcceptInvitationPanel({
  token,
  email,
  name,
  available,
  expired,
  status,
  sessionUser,
}: AcceptInvitationPanelProps) {
  const t = useTranslations("AcceptInvite");
  const [activationState, activationAction] = useActionState(
    activateInvitationAction,
    initialActivationState,
  );
  const [magicLinkState, setMagicLinkState] = useState<ActivateInvitationActionState>({
    status: "idle",
  });
  const [sendingMagicLink, setSendingMagicLink] = useState(false);

  const callbackURL = useMemo(() => `/accept-invite?token=${encodeURIComponent(token)}`, [token]);
  const signedInEmail = sessionUser?.email.trim().toLowerCase();
  const invitedEmail = email.trim().toLowerCase();
  const signedInWithInvitedEmail = Boolean(signedInEmail && signedInEmail === invitedEmail);

  async function handleSendMagicLink() {
    setSendingMagicLink(true);
    setMagicLinkState({ status: "idle" });

    const result = await authClient.signIn.magicLink({
      email,
      callbackURL,
      newUserCallbackURL: callbackURL,
      errorCallbackURL: callbackURL,
    });

    setSendingMagicLink(false);

    if (result.error) {
      setMagicLinkState({
        status: "error",
        message: result.error.message ?? t("errors.magicLinkSendFailed"),
      });
      return;
    }

    setMagicLinkState({
      status: "success",
      message: t("status.magicLinkSent", { email }),
    });
  }

  if (activationState.status === "success") {
    return (
      <InvitationResult
        icon={CheckCircle2}
        title={t("result.activatedTitle")}
        message={t("result.activatedMessage")}
      />
    );
  }

  if (!available) {
    if (status === "ACCEPTED") {
      return (
        <InvitationResult
          icon={CheckCircle2}
          title={t("result.acceptedTitle")}
          message={t("result.acceptedMessage")}
        />
      );
    }

    return (
      <ErrorState
        icon={expired ? ShieldAlert : CheckCircle2}
        title={expired ? t("error.expiredTitle") : t("error.unavailableTitle")}
        message={
          expired
            ? t("error.expiredMessage")
            : t("error.unavailableMessage", { status: status.toLowerCase() })
        }
        tone={expired ? "error" : "warning"}
      />
    );
  }

  return (
    <div>
      <AuthScreenHead
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={name ? t("descriptionNamed", { name, email }) : t("description", { email })}
      />
      <InviteIdentity name={name} email={email} />

      {sessionUser ? (
        <form action={activationAction} className="mt-5 grid gap-4">
          <input type="hidden" name="token" value={token} />
          <div className="rounded-[var(--radius-md)] border border-border bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
            {t.rich("signedInAs", {
              email: sessionUser.email,
              strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
            })}
          </div>
          {!signedInWithInvitedEmail ? (
            <AuthNotice tone="warning">{t("wrongEmail", { email })}</AuthNotice>
          ) : null}
          {activationState.message ? <StatusMessage state={activationState} /> : null}
          <ActivateButton disabled={!signedInWithInvitedEmail} />
        </form>
      ) : (
        <div className="mt-5 grid gap-4">
          <AuthField label={t("fields.invitedEmail")} htmlFor="accept-invite-email">
            <AuthInput id="accept-invite-email" icon={Mail} value={email} readOnly />
            <span className="text-xs leading-5 text-muted-foreground">
              {t("fields.invitedEmailHint")}
            </span>
          </AuthField>
          {magicLinkState.message ? <StatusMessage state={magicLinkState} /> : null}
          <AuthButton
            type="button"
            variant="hero"
            icon={<Mail className="size-4" aria-hidden="true" />}
            loading={sendingMagicLink}
            onClick={handleSendMagicLink}
          >
            {t("actions.emailLink")}
          </AuthButton>
        </div>
      )}
    </div>
  );
}

function InvitationResult({
  icon: Icon,
  title,
  message,
}: {
  icon: typeof CheckCircle2;
  title: string;
  message: string;
}) {
  const t = useTranslations("AcceptInvite");

  return (
    <div className="text-center">
      <span className="mb-5 inline-flex size-[74px] items-center justify-center rounded-full bg-success-soft text-success">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="font-ui text-[30px] font-semibold leading-tight text-foreground">{title}</h2>
      <p className="mx-auto mt-3 max-w-xs text-[15px] leading-6 text-muted-foreground">{message}</p>
      <Link
        href={"/dashboard" as Route}
        className="mt-6 inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[linear-gradient(135deg,var(--primary),var(--accent))] px-[18px] py-[13px] text-[14.5px] font-semibold text-accent-foreground shadow-[0_10px_26px_-10px_var(--ring)] transition hover:shadow-[0_14px_32px_-10px_var(--ring)]"
      >
        {t("actions.continue")}
      </Link>
    </div>
  );
}

function ActivateButton({ disabled }: { disabled?: boolean }) {
  const t = useTranslations("AcceptInvite");
  const { pending } = useFormStatus();

  return (
    <AuthButton
      type="submit"
      variant="hero"
      icon={<Send className="size-4" aria-hidden="true" />}
      loading={pending}
      disabled={disabled}
    >
      {t("actions.activate")}
    </AuthButton>
  );
}

function StatusMessage({ state }: { state: ActivateInvitationActionState }) {
  return (
    <AuthNotice tone={state.status === "error" ? "error" : "success"}>{state.message}</AuthNotice>
  );
}

function InviteIdentity({ email, name }: { email: string; name: string }) {
  const initials = getInitials(name || email);

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-secondary/70 p-3.5">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[linear-gradient(150deg,var(--primary),var(--accent))] font-ui text-sm font-semibold text-accent-foreground">
        {initials}
      </span>
      <div className="min-w-0">
        <p className="truncate font-ui text-[15px] font-semibold text-foreground">
          {name || email}
        </p>
        <p className="truncate text-[12.5px] text-muted-foreground">{email}</p>
      </div>
    </div>
  );
}

function getInitials(value: string) {
  return value
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
