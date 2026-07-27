"use client";

import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import {
  AuthButton,
  AuthField,
  AuthInput,
  AuthNotice,
  AuthPasswordInput,
  AuthScreenHead,
} from "@/src/components/layout/AuthForm";
import { authClient } from "@/src/lib/auth-client";

export type ResetPasswordPanelProps = {
  callbackURL: string;
  initialError?: string;
  token: string;
};

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
};

type PendingAction = "request" | "reset";

export function ResetPasswordPanel({ callbackURL, initialError, token }: ResetPasswordPanelProps) {
  const t = useTranslations("ResetPassword");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [notice, setNotice] = useState<Notice | null>(() =>
    initialError
      ? {
          tone: "error",
          message: getResetErrorMessage(initialError, t),
        }
      : null,
  );

  const busy = pendingAction !== null;

  async function requestResetLink() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setNotice({
        tone: "error",
        message: t("errors.emailRequired"),
      });
      return;
    }

    setPendingAction("request");
    setNotice(null);

    const result = await authClient.requestPasswordReset({
      email: normalizedEmail,
      redirectTo: `/reset-password?callbackURL=${encodeURIComponent(callbackURL)}`,
    });

    setPendingAction(null);

    if (result.error) {
      setNotice({
        tone: "error",
        message: result.error.message ?? t("errors.sendFailed"),
      });
      return;
    }

    setNotice({
      tone: "success",
      message: t("status.setupSent", { email: normalizedEmail }),
    });
  }

  async function resetPassword() {
    if (newPassword.length < 12) {
      setNotice({
        tone: "error",
        message: t("errors.passwordTooShort"),
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setNotice({
        tone: "error",
        message: t("errors.passwordMismatch"),
      });
      return;
    }

    setPendingAction("reset");
    setNotice(null);

    const result = await authClient.resetPassword({
      token,
      newPassword,
    });

    setPendingAction(null);

    if (result.error) {
      setNotice({
        tone: "error",
        message: result.error.message ?? t("errors.resetFailed"),
      });
      return;
    }

    setNotice({
      tone: "success",
      message: t("status.passwordUpdated"),
    });
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div>
      <AuthScreenHead
        eyebrow={t("badge")}
        title={token ? t("titleSet") : t("titleRequest")}
        description={token ? t("descriptionSet") : t("descriptionRequest")}
      />
      {notice ? <NoticeMessage notice={notice} /> : null}

      {token ? (
        <div className="grid gap-3.5">
          <AuthField label={t("fields.newPassword")} htmlFor="reset-new-password">
            <AuthPasswordInput
              id="reset-new-password"
              autoComplete="new-password"
              value={newPassword}
              labels={{
                hide: t("actions.hidePassword"),
                show: t("actions.showPassword"),
              }}
              onChange={(event) => setNewPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void resetPassword();
                }
              }}
            />
            <span className="text-xs leading-5 text-muted-foreground">
              {t("fields.newPasswordHint")}
            </span>
          </AuthField>
          <AuthField label={t("fields.confirmPassword")} htmlFor="reset-confirm-password">
            <AuthPasswordInput
              id="reset-confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              labels={{
                hide: t("actions.hidePassword"),
                show: t("actions.showPassword"),
              }}
              onChange={(event) => setConfirmPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void resetPassword();
                }
              }}
            />
          </AuthField>
          <AuthButton
            type="button"
            variant="hero"
            icon={<LockKeyhole className="size-4" aria-hidden="true" />}
            loading={pendingAction === "reset"}
            disabled={busy}
            onClick={() => void resetPassword()}
          >
            {t("actions.updatePassword")}
          </AuthButton>
        </div>
      ) : (
        <div className="grid gap-3.5">
          <AuthField label={t("fields.email")} htmlFor="reset-email">
            <AuthInput
              id="reset-email"
              icon={Mail}
              type="email"
              autoComplete="email"
              placeholder={t("fields.emailPlaceholder")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void requestResetLink();
                }
              }}
            />
          </AuthField>
          <AuthButton
            type="button"
            variant="hero"
            icon={<Mail className="size-4" aria-hidden="true" />}
            loading={pendingAction === "request"}
            disabled={busy}
            onClick={() => void requestResetLink()}
          >
            {t("actions.sendSetupLink")}
          </AuthButton>
        </div>
      )}

      <p className="mt-[22px] flex items-start gap-2 border-t border-border pt-[18px] text-[12.5px] leading-6 text-muted-foreground">
        <ShieldCheck
          className="mt-0.5 size-[15px] shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span>
          {t("footer.activationSeparate")}{" "}
          <Link
            href="/login"
            className="font-semibold text-accent underline-offset-4 hover:underline"
          >
            {t("actions.returnToSignIn")}
          </Link>
          .
        </span>
      </p>
    </div>
  );
}

function NoticeMessage({ notice }: { notice: Notice }) {
  return (
    <AuthNotice tone={notice.tone} className="mb-4">
      {notice.message}
    </AuthNotice>
  );
}

function getResetErrorMessage(error: string, t: ReturnType<typeof useTranslations>) {
  if (error === "INVALID_TOKEN" || error === "invalid_token") {
    return t("errors.invalidLink");
  }

  return t("errors.genericReset");
}
