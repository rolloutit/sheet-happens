"use client";

import { ArrowRight, Fingerprint, Link2, Mail, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import {
  AuthButton,
  AuthField,
  AuthInput,
  AuthNotice,
  AuthPasswordInput,
  AuthScreenHead,
} from "@/src/components/layout/AuthForm";
import { authClient, getSecondFactorChallengeURL } from "@/src/lib/auth-client";

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

type PasswordSignInData = {
  twoFactorRedirect?: boolean;
  url?: string;
};

type AuthClientError = {
  code?: string;
  message?: string;
  status?: number;
};

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
        message: resolveAuthClientError(result.error, t, "errors.magicLinkSendFailed"),
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
        message: resolveAuthClientError(result.error, t, "errors.passkeyIncomplete"),
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
    });

    setPendingAction(null);

    if (result.error) {
      setStatus({
        tone: "error",
        message: resolvePasswordSignInError(result.error, t),
      });
      return;
    }

    const data = result.data as PasswordSignInData | null | undefined;

    if (data?.twoFactorRedirect) {
      window.location.assign(getSecondFactorChallengeURL(callbackURL));
      return;
    }

    window.location.assign(data?.url ?? callbackURL);
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
        message: resolveAuthClientError(result.error, t, "errors.passwordResetSendFailed"),
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
        message: result.error
          ? resolveAuthClientError(result.error, t, "errors.googleStartFailed")
          : t("errors.googleStartFailed"),
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
    <div>
      <AuthScreenHead title={t("title")} description={t("description")} />
      {status ? <LoginStatusMessage status={status} /> : null}

      <AuthButton
        type="button"
        variant="hero"
        loading={pendingAction === "passkey"}
        disabled={busy}
        icon={<Fingerprint className="size-[19px]" aria-hidden="true" />}
        trailing={
          <span className="rounded-md bg-white/20 px-2 py-1 font-ui text-[9.5px] font-bold uppercase tracking-[0.06em]">
            {t("recommended")}
          </span>
        }
        onClick={() => void signInWithPasskey()}
      >
        <span className="flex flex-col items-start leading-[1.15]">
          {t("actions.passkey")}
          <span className="text-[11.5px] font-medium opacity-85">{t("actions.passkeyHint")}</span>
        </span>
      </AuthButton>

      <div className="my-5 flex items-center gap-3.5 font-ui text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
        {t("or")}
      </div>

      <div className="grid gap-3.5">
        <AuthField label={t("fields.email")} htmlFor="login-email">
          <AuthInput
            id="login-email"
            icon={Mail}
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
        </AuthField>

        <AuthField
          label={t("fields.password")}
          htmlFor="login-password"
          right={
            <button
              type="button"
              className="font-ui text-[13px] font-medium text-accent underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
              disabled={busy}
              onClick={() => void requestPasswordReset()}
            >
              {t("actions.forgotPassword")}
            </button>
          }
        >
          <AuthPasswordInput
            id="login-password"
            autoComplete="current-password"
            placeholder={t("fields.passwordPlaceholder")}
            value={password}
            labels={{
              hide: t("actions.hidePassword"),
              show: t("actions.showPassword"),
            }}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void signInWithPassword();
              }
            }}
          />
        </AuthField>

        <AuthButton
          type="button"
          variant="outline"
          loading={pendingAction === "password"}
          disabled={busy}
          onClick={() => void signInWithPassword()}
        >
          {t("actions.passwordSignIn")}
          <ArrowRight className="size-[17px]" aria-hidden="true" />
        </AuthButton>

        {googleEnabled ? (
          <AuthButton
            type="button"
            variant="outline"
            loading={pendingAction === "google"}
            disabled={busy}
            icon={<GoogleIcon />}
            onClick={() => void signInWithGoogle()}
          >
            {t("actions.google")}
          </AuthButton>
        ) : null}

        <AuthButton
          type="button"
          variant="ghost"
          loading={pendingAction === "magic-link"}
          disabled={busy}
          icon={<Link2 className="size-4" aria-hidden="true" />}
          onClick={() => void sendMagicLink()}
        >
          {t("actions.emailLink")}
        </AuthButton>
      </div>

      <div className="mt-[22px] flex items-start gap-2 border-t border-border pt-[18px] text-[12.5px] leading-6 text-muted-foreground">
        <ShieldCheck
          className="mt-0.5 size-[15px] shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span>{t("inviteActivationHint")}</span>
      </div>
    </div>
  );
}

function getNormalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function resolvePasswordSignInError(error: AuthClientError, t: ReturnType<typeof useTranslations>) {
  if (error.status === 429 || error.code === "PASSWORD_SIGN_IN_LOCKED") {
    return t("errors.passwordSignInRateLimited");
  }

  return error.message ?? t("errors.emailPasswordIncorrect");
}

function resolveAuthClientError(
  error: AuthClientError,
  t: ReturnType<typeof useTranslations>,
  fallback:
    | "errors.magicLinkSendFailed"
    | "errors.passkeyIncomplete"
    | "errors.passwordResetSendFailed"
    | "errors.googleStartFailed",
) {
  if (error.status === 429) {
    return t("errors.rateLimited");
  }

  return error.message ?? t(fallback);
}

function LoginStatusMessage({ status }: { status: LoginStatus }) {
  return (
    <AuthNotice tone={status.tone} className="mb-4">
      {status.message}
    </AuthNotice>
  );
}

function getLoginErrorMessage(error: string, t: ReturnType<typeof useTranslations>) {
  if (error === "invalid_magic_link" || error === "invalid_token") {
    return t("errors.invalidLink");
  }

  return t("errors.genericSignIn");
}

function GoogleIcon() {
  return (
    <svg className="size-[18px] shrink-0" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#ffc107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#ff3d00"
        d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4caf50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976d2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.4 36.2 44 30.6 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
