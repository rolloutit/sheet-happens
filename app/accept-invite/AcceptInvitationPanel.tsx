"use client";

import { CheckCircle2, Mail, Send, ShieldAlert } from "lucide-react";
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
        message: result.error.message ?? "Could not send the sign-in email.",
      });
      return;
    }

    setMagicLinkState({
      status: "success",
      message: `Sign-in email sent to ${email}.`,
    });
  }

  if (activationState.status === "success") {
    return (
      <InvitationResult
        icon={CheckCircle2}
        title="Account activated"
        message="Your Sheet Happens account is active. You can continue to the app."
        tone="success"
      />
    );
  }

  if (!available) {
    if (status === "ACCEPTED") {
      return (
        <InvitationResult
          icon={CheckCircle2}
          title="Invitation already accepted"
          message="This invitation has already been used. Continue to the app if you are signed in with this account."
          tone="success"
        />
      );
    }

    return (
      <ErrorState
        icon={expired ? ShieldAlert : CheckCircle2}
        title={expired ? "Invitation expired" : "Invitation unavailable"}
        message={
          expired
            ? "Ask an admin to send a new invitation."
            : `This invitation is currently ${status.toLowerCase()}.`
        }
        tone={expired ? "error" : "warning"}
      />
    );
  }

  return (
    <Card density="lg" className="w-full max-w-xl">
      <CardHeader className="block">
        <CardTitle>Accept invitation</CardTitle>
        <CardDescription>
          {name ? `${name}, you have` : "You have"} been invited to Sheet Happens as {email}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sessionUser ? (
          <form action={activationAction} className="grid gap-4">
            <input type="hidden" name="token" value={token} />
            <div className="rounded-[var(--radius-md)] border border-border bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{sessionUser.email}</span>
            </div>
            {!signedInWithInvitedEmail ? (
              <p className="rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                This invitation belongs to {email}. Sign in with that email before activating it.
              </p>
            ) : null}
            {activationState.message ? <StatusMessage state={activationState} /> : null}
            <div className="flex justify-end">
              <ActivateButton disabled={!signedInWithInvitedEmail} />
            </div>
          </form>
        ) : (
          <div className="grid gap-4">
            <Field label="Invited email" hint="A magic sign-in link will be sent here.">
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
            Email sign-in link
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
          <Link href="/">Continue</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function ActivateButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" icon={Send} loading={pending} disabled={disabled}>
      Activate account
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
