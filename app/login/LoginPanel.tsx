"use client";

import { Building2, KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
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
  googleEnabled?: boolean;
};

type LoginStatus = {
  tone: "success" | "error" | "info";
  message: string;
};

type PendingAction = "google" | "magic-link" | "passkey" | "password" | "password-reset";

export function LoginPanel({
  callbackURL,
  initialEmail = "",
  initialError,
  googleEnabled = false,
}: LoginPanelProps) {
  const t = useTranslations("Login");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [status, setStatus] = useState<LoginStatus | null>(() =>
    initialError
      ? {
          tone: "error",
          message: getLoginErrorMessage(initialError, t),
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
    const normalizedEmail = getNormalizedEmail(email);

    if (!validateEmail(normalizedEmail)) {
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
        message: result.error.message ?? t("errors.magicLinkSendFailed"),
      });
      return;
    }

    setStatus({
      tone: "success",
      message: t("status.magicLinkSent", { email: normalizedEmail }),
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
        message: result.error.message ?? t("errors.passkeyIncomplete"),
      });
      return;
    }

    window.location.assign(callbackURL);
  }

  async function signInWithPassword() {
    const normalizedEmail = getNormalizedEmail(email);

    if (!validateEmail(normalizedEmail)) {
      return;
    }

    if (!password) {
      setStatus({
        tone: "error",
        message: t("errors.passwordRequired"),
      });
      return;
    }

    setPendingAction("password");
    setStatus(null);

    const result = await authClient.signIn.email({
      email: normalizedEmail,
      password,
      callbackURL,
    });

    setPendingAction(null);

    if (result.error) {
      setStatus({
        tone: "error",
        message: result.error.message ?? t("errors.emailPasswordIncorrect"),
      });
      return;
    }

    window.location.assign(result.data?.url ?? callbackURL);
  }

  async function requestPasswordReset() {
    const normalizedEmail = getNormalizedEmail(email);

    if (!validateEmail(normalizedEmail)) {
      return;
    }

    setPendingAction("password-reset");
    setStatus(null);

    const result = await authClient.requestPasswordReset({
      email: normalizedEmail,
      redirectTo: "/reset-password",
    });

    setPendingAction(null);

    if (result.error) {
      setStatus({
        tone: "error",
        message: result.error.message ?? t("errors.passwordResetSendFailed"),
      });
      return;
    }

    setStatus({
      tone: "success",
      message: t("status.passwordSetupSent", { email: normalizedEmail }),
    });
  }

  async function signInWithGoogle() {
    setPendingAction("google");
    setStatus(null);

    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL,
      errorCallbackURL: loginErrorURL,
      disableRedirect: true,
    });

    setPendingAction(null);

    if (result.error || !result.data?.url) {
      setStatus({
        tone: "error",
        message: result.error?.message ?? t("errors.googleStartFailed"),
      });
      return;
    }

    window.location.assign(result.data.url);
  }

  function validateEmail(normalizedEmail: string) {
    if (!normalizedEmail) {
      setStatus({
        tone: "error",
        message: t("errors.emailRequired"),
      });
      return false;
    }

    return true;
  }

  const busy = pendingAction !== null;

  return (
    <div className="grid w-full max-w-5xl overflow-hidden rounded-[var(--radius-xl)] border border-border bg-background shadow-panel lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="relative hidden overflow-hidden border-r border-border bg-[#0a1917] p-6 lg:block">
        <div className="relative z-10 grid h-full min-h-[27rem] content-between gap-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[var(--radius-md)] bg-accent text-sm font-bold text-accent-foreground shadow-soft">
              SH
            </span>
            <div>
              <p className="font-ui text-sm font-semibold text-[#eafbfa]">Sheet Happens</p>
              <p className="font-ui text-[10px] font-medium uppercase tracking-[0.12em] text-[#9fbfbb]">
                {t("brandSubtitle")}
              </p>
            </div>
          </div>
          <div className="grid gap-3">
            {[t("side.timeTracking"), t("side.timesheets"), t("side.invoices")].map((label) => (
              <div
                key={label}
                className="rounded-[var(--radius-lg)] border border-white/10 bg-white/8 p-3 backdrop-blur"
              >
                <p className="font-ui text-sm font-semibold text-[#eafbfa]">{label}</p>
                <p className="mt-1 text-xs text-[#9fbfbb]">{t("side.protected")}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <section className="grid place-items-center p-4 sm:p-6">
        <Card variant="elevated" className="w-full max-w-md p-4 sm:p-5">
          <CardHeader className="mb-3 block">
            <Badge tone="info">{t("badge")}</Badge>
            <CardTitle className="mt-3 text-xl">{t("title")}</CardTitle>
            <CardDescription className="leading-5">{t("description")}</CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            {status ? <LoginStatusMessage status={status} /> : null}

            <div className="grid gap-2">
              <Button
                type="button"
                variant="cta"
                icon={KeyRound}
                loading={pendingAction === "passkey"}
                disabled={busy}
                onClick={() => void signInWithPasskey()}
              >
                {t("actions.passkey")}
              </Button>
              {googleEnabled ? (
                <Button
                  type="button"
                  variant="soft"
                  icon={Building2}
                  loading={pendingAction === "google"}
                  disabled={busy}
                  onClick={() => void signInWithGoogle()}
                >
                  {t("actions.google")}
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3">
              <Field label={t("fields.email")}>
                {({ id }) => (
                  <Input
                    id={id}
                    type="email"
                    autoComplete="email"
                    placeholder={t("fields.emailPlaceholder")}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void signInWithPassword();
                      }
                    }}
                  />
                )}
              </Field>
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <label
                    className="font-ui text-sm font-semibold text-foreground"
                    htmlFor="login-password"
                  >
                    {t("fields.password")}
                  </label>
                  <button
                    type="button"
                    className="font-ui text-sm font-semibold text-accent underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void requestPasswordReset()}
                  >
                    {t("actions.forgotPassword")}
                  </button>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void signInWithPassword();
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                icon={LockKeyhole}
                loading={pendingAction === "password"}
                disabled={busy}
                onClick={() => void signInWithPassword()}
              >
                {t("actions.passwordSignIn")}
              </Button>
            </div>

            <div className="grid gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">{t("passwordlessHint")}</p>
              <Button
                type="button"
                variant="soft"
                icon={Mail}
                loading={pendingAction === "magic-link"}
                disabled={busy}
                onClick={() => void sendMagicLink()}
              >
                {t("actions.emailLink")}
              </Button>
            </div>
          </CardContent>
          <CardFooter className="mt-4 justify-start">
            <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              {t("inviteActivationHint")}
            </p>
          </CardFooter>
        </Card>
      </section>
    </div>
  );
}

function getNormalizedEmail(value: string) {
  return value.trim().toLowerCase();
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

function getLoginErrorMessage(error: string, t: ReturnType<typeof useTranslations>) {
  if (error === "invalid_magic_link" || error === "invalid_token") {
    return t("errors.invalidLink");
  }

  return t("errors.genericSignIn");
}
