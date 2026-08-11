"use client";

import { KeyRound, LifeBuoy, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { AuthButton, AuthNotice, AuthScreenHead } from "@/src/components/layout/AuthForm";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { CodeInput } from "@/src/components/ui/CodeInput";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/Tabs";
import { verifySecondFactorAction } from "./actions";
import type { VerifySecondFactorActionState } from "./actions.types";

export type TwoFactorChallengePanelProps = {
  callbackURL: string;
};

type SecondFactorMethod = "totp" | "backup_code";

export function TwoFactorChallengePanel({ callbackURL }: TwoFactorChallengePanelProps) {
  const t = useTranslations("TwoFactor");
  const [method, setMethod] = useState<SecondFactorMethod>("totp");
  const [totpCode, setTotpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [state, setState] = useState<VerifySecondFactorActionState | null>(null);
  const [isPending, startTransition] = useTransition();
  const loginHref = useMemo(
    () => `/login?callbackURL=${encodeURIComponent(callbackURL)}`,
    [callbackURL],
  );

  function submitSecondFactor() {
    setState(null);

    startTransition(async () => {
      const result = await verifySecondFactorAction({
        method,
        code: method === "totp" ? totpCode : backupCode,
        trustDevice,
      });

      if (result.status === "success") {
        window.location.href = callbackURL;
        return;
      }

      setState(result);
    });
  }

  const canSubmit = method === "totp" ? totpCode.length === 6 : backupCode.trim().length > 0;

  return (
    <div>
      <AuthScreenHead eyebrow={t("badge")} title={t("title")} description={t("description")} />
      {state ? <SecondFactorStatus state={state} /> : null}

      <div className="grid gap-5">
        <Tabs value={method} onValueChange={(value) => setMethod(value as SecondFactorMethod)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="totp">{t("tabs.authenticator")}</TabsTrigger>
            <TabsTrigger value="backup_code">{t("tabs.backupCode")}</TabsTrigger>
          </TabsList>
          <TabsContent value="totp">
            <Field label={t("fields.totp")} hint={t("fields.totpHint")}>
              {({ describedBy }) => (
                <CodeInput
                  label={t("fields.totpInputLabel")}
                  value={totpCode}
                  onValueChange={setTotpCode}
                  disabled={isPending}
                  invalid={state?.status === "error"}
                  aria-describedby={describedBy}
                />
              )}
            </Field>
          </TabsContent>
          <TabsContent value="backup_code">
            <Field label={t("fields.backupCode")} hint={t("fields.backupCodeHint")}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  value={backupCode}
                  autoComplete="one-time-code"
                  disabled={isPending}
                  invalid={invalid || state?.status === "error"}
                  aria-describedby={describedBy}
                  onChange={(event) => setBackupCode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && canSubmit && !isPending) {
                      event.preventDefault();
                      submitSecondFactor();
                    }
                  }}
                />
              )}
            </Field>
          </TabsContent>
        </Tabs>

        <label className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border bg-secondary/60 p-3 text-sm text-muted-foreground">
          <Checkbox
            checked={trustDevice}
            disabled={isPending}
            onCheckedChange={(checked) => setTrustDevice(checked === true)}
            aria-label={t("trust.ariaLabel")}
          />
          <span>
            <span className="font-ui font-semibold text-foreground">{t("trust.title")}</span>
            <span className="block leading-6">{t("trust.description")}</span>
          </span>
        </label>

        <AuthButton
          type="button"
          variant="hero"
          icon={
            method === "totp" ? (
              <ShieldCheck className="size-4" aria-hidden="true" />
            ) : (
              <KeyRound className="size-4" aria-hidden="true" />
            )
          }
          loading={isPending}
          disabled={!canSubmit}
          onClick={submitSecondFactor}
        >
          {t("actions.verify")}
        </AuthButton>

        <Link
          href={loginHref as Route}
          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <LifeBuoy className="size-4" aria-hidden="true" />
          {t("actions.useAnotherSignIn")}
        </Link>
      </div>
    </div>
  );
}

function SecondFactorStatus({ state }: { state: VerifySecondFactorActionState }) {
  return (
    <AuthNotice tone={state.status} className="mb-4">
      {state.message}
    </AuthNotice>
  );
}
