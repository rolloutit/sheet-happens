"use client";

import { CheckCircle2, Mail, Send, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Route } from "next";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/src/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/Card";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { authClient } from "@/src/lib/auth-client";
import { cn } from "@/src/lib/utils";
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
        tone="success"
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
          tone="success"
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
    <Card density="lg" className="w-full max-w-xl">
      <CardHeader className="block">
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {name ? t("descriptionNamed", { name, email }) : t("description", { email })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sessionUser ? (
          <form action={activationAction} className="grid gap-4">
            <input type="hidden" name="token" value={token} />
            <div className="rounded-[var(--radius-md)] border border-border bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
              {t.rich("signedInAs", {
                email: sessionUser.email,
                strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
              })}
            </div>
            {!signedInWithInvitedEmail ? (
              <p className="rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                {t("wrongEmail", { email })}
              </p>
            ) : null}
            {activationState.message ? <StatusMessage state={activationState} /> : null}
            <div className="flex justify-end">
              <ActivateButton disabled={!signedInWithInvitedEmail} />
            </div>
          </form>
        ) : (
          <div className="grid gap-4">
            <Field label={t("fields.invitedEmail")} hint={t("fields.invitedEmailHint")}>
              {({ id, describedBy }) => (
                <Input id={id} value={email} aria-describedby={describedBy} readOnly />
              )}
            </Field>
            {magicLinkState.message ? <StatusMessage state={magicLinkState} /> : null}
          </div>
        )}
      </CardContent>
      {!sessionUser ? (
        <CardFooter>
          <Button
            type="button"
            icon={Mail}
            loading={sendingMagicLink}
            onClick={handleSendMagicLink}
          >
            {t("actions.emailLink")}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function InvitationResult({
  icon: Icon,
  title,
  message,
  tone,
}: {
  icon: typeof CheckCircle2;
  title: string;
  message: string;
  tone: "success";
}) {
  const t = useTranslations("AcceptInvite");

  return (
    <Card density="lg" className="w-full max-w-xl">
      <CardHeader className="block">
        <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-success/16 text-success">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button asChild variant={tone === "success" ? "primary" : "soft"}>
          <Link href={"/dashboard" as Route}>{t("actions.continue")}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function ActivateButton({ disabled }: { disabled?: boolean }) {
  const t = useTranslations("AcceptInvite");
  const { pending } = useFormStatus();

  return (
    <Button type="submit" icon={Send} loading={pending} disabled={disabled}>
      {t("actions.activate")}
    </Button>
  );
}

function StatusMessage({ state }: { state: ActivateInvitationActionState }) {
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[var(--radius-md)] border px-3 py-2 text-sm",
        state.status === "error"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-success/40 bg-success/10 text-success",
      )}
    >
      {state.message}
    </p>
  );
}
