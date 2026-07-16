"use client";

import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

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
    <Card variant="elevated" className="w-full max-w-md">
      <CardHeader className="block">
        <Badge tone="info">{t("badge")}</Badge>
        <CardTitle className="mt-4 text-2xl">{token ? t("titleSet") : t("titleRequest")}</CardTitle>
        <CardDescription>{token ? t("descriptionSet") : t("descriptionRequest")}</CardDescription>
      </CardHeader>
      <CardContent className="gap-5">
        {notice ? <NoticeMessage notice={notice} /> : null}

        {token ? (
          <div className="grid gap-3">
            <Field label={t("fields.newPassword")} hint={t("fields.newPasswordHint")}>
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  aria-describedby={describedBy}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void resetPassword();
                    }
                  }}
                />
              )}
            </Field>
            <Field label={t("fields.confirmPassword")}>
              {({ id }) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void resetPassword();
                    }
                  }}
                />
              )}
            </Field>
            <Button
              type="button"
              icon={LockKeyhole}
              loading={pendingAction === "reset"}
              disabled={busy}
              onClick={() => void resetPassword()}
            >
              {t("actions.updatePassword")}
            </Button>
          </div>
        ) : (
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
                      void requestResetLink();
                    }
                  }}
                />
              )}
            </Field>
            <Button
              type="button"
              icon={Mail}
              loading={pendingAction === "request"}
              disabled={busy}
              onClick={() => void requestResetLink()}
            >
              {t("actions.sendSetupLink")}
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-start">
        <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
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
      </CardFooter>
    </Card>
  );
}

function NoticeMessage({ notice }: { notice: Notice }) {
  return (
    <p
      role={notice.tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[var(--radius-md)] border px-3 py-2 text-sm",
        notice.tone === "success" && "border-success/40 bg-success/10 text-success",
        notice.tone === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
        notice.tone === "info" && "border-accent/40 bg-accent/10 text-accent",
      )}
    >
      {notice.message}
    </p>
  );
}

function getResetErrorMessage(error: string, t: ReturnType<typeof useTranslations>) {
  if (error === "INVALID_TOKEN" || error === "invalid_token") {
    return t("errors.invalidLink");
  }

  return t("errors.genericReset");
}
