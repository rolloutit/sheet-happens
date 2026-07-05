"use client";

import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/Card";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { authClient } from "@/src/lib/auth-client";
import { cn } from "@/src/lib/utils";

export type LoginPanelProps = {
  callbackURL: string;
  initialEmail?: string;
  initialError?: string;
};

type LoginStatus = {
  tone: "success" | "error" | "info";
  message: string;
};

type PendingAction = "magic-link" | "passkey";

export function LoginPanel({ callbackURL, initialEmail = "", initialError }: LoginPanelProps) {
  const [email, setEmail] = useState(initialEmail);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [status, setStatus] = useState<LoginStatus | null>(() =>
    initialError
      ? {
          tone: "error",
          message: getLoginErrorMessage(initialError),
        }
      : null,
  );
  const loginErrorURL = useMemo(
    () =>
      `/login?callbackURL=${encodeURIComponent(callbackURL)}${
        email ? `&email=${encodeURIComponent(email)}` : ""
      }`,
    [callbackURL, email],
  );

  async function sendMagicLink() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setStatus({
        tone: "error",
        message: "Email is required.",
      });
      return;
    }

    setPendingAction("magic-link");
    setStatus(null);

    const result = await authClient.signIn.magicLink({
      email: normalizedEmail,
      callbackURL,
      newUserCallbackURL: callbackURL,
      errorCallbackURL: loginErrorURL,
    });

    setPendingAction(null);

    if (result.error) {
      setStatus({
        tone: "error",
        message: result.error.message ?? "Could not send the sign-in email.",
      });
      return;
    }

    setStatus({
      tone: "success",
      message: `If ${normalizedEmail} belongs to an active Sheet Happens member, a sign-in link is on its way.`,
    });
  }

  async function signInWithPasskey() {
    setPendingAction("passkey");
    setStatus(null);

    const result = await authClient.signIn.passkey();

    setPendingAction(null);

    if (result.error) {
      setStatus({
        tone: "error",
        message: result.error.message ?? "Passkey sign-in was not completed.",
      });
      return;
    }

    window.location.href = callbackURL;
  }

  const busy = pendingAction !== null;

  return (
    <div className="grid w-full max-w-5xl overflow-hidden rounded-[var(--radius-xl)] border border-border bg-background shadow-panel lg:grid-cols-[0.95fr_1.05fr]">
      <aside className="relative hidden overflow-hidden border-r border-border bg-[#0a1917] p-8 lg:block">
        <div className="relative z-10 grid h-full min-h-[32rem] content-between">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[var(--radius-md)] bg-accent text-sm font-bold text-accent-foreground shadow-soft">
              SH
            </span>
            <div>
              <p className="font-ui text-sm font-semibold text-foreground">Sheet Happens</p>
              <p className="font-ui text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Rollout IT · belső
              </p>
            </div>
          </div>
          <div className="grid gap-4">
            {["Time tracking", "Timesheets", "Invoices"].map((label) => (
              <div
                key={label}
                className="rounded-[var(--radius-lg)] border border-white/10 bg-white/8 p-4 backdrop-blur"
              >
                <p className="font-ui text-sm font-semibold text-foreground">{label}</p>
                <p className="mt-1 text-xs text-muted-foreground">Protected workflow access</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <section className="grid place-items-center p-5 sm:p-8">
        <Card variant="elevated" className="w-full max-w-md">
          <CardHeader className="block">
            <Badge tone="info">Welcome back</Badge>
            <CardTitle className="mt-4 text-2xl">Sign in to Sheet Happens</CardTitle>
            <CardDescription>
              Use an email magic link or a registered passkey to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-5">
            {status ? <LoginStatusMessage status={status} /> : null}

            <Button
              type="button"
              variant="cta"
              icon={KeyRound}
              loading={pendingAction === "passkey"}
              disabled={busy}
              onClick={() => void signInWithPasskey()}
            >
              Continue with passkey
            </Button>

            <div className="grid gap-3">
              <Field label="Email">
                {({ id }) => (
                  <Input
                    id={id}
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void sendMagicLink();
                      }
                    }}
                  />
                )}
              </Field>
              <Button
                type="button"
                icon={Mail}
                loading={pendingAction === "magic-link"}
                disabled={busy}
                onClick={() => void sendMagicLink()}
              >
                Email sign-in link
              </Button>
            </div>
          </CardContent>
          <CardFooter className="justify-start">
            <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              Invited users must activate their invitation link once before normal sign-in works.
            </p>
          </CardFooter>
        </Card>
      </section>
    </div>
  );
}

function LoginStatusMessage({ status }: { status: LoginStatus }) {
  return (
    <p
      role={status.tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[var(--radius-md)] border px-3 py-2 text-sm",
        status.tone === "success" && "border-success/40 bg-success/10 text-success",
        status.tone === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
        status.tone === "info" && "border-accent/40 bg-accent/10 text-accent",
      )}
    >
      {status.message}
    </p>
  );
}

function getLoginErrorMessage(error: string) {
  if (error === "invalid_magic_link" || error === "invalid_token") {
    return "This sign-in link is invalid or expired. Request a new one.";
  }

  return "Sign-in could not be completed. Request a new sign-in link.";
}
