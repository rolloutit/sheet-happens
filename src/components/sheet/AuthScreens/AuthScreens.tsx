"use client";

import { CheckCircle2, KeyRound, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { CodeInput } from "@/src/components/ui/CodeInput";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { PasswordInput } from "@/src/components/ui/PasswordInput";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { StrengthMeter, evaluatePasswordStrength } from "@/src/components/ui/StrengthMeter";
import { cn } from "@/src/lib/utils";
import type {
  AuthPasswordSetupPayload,
  AuthScreenMode,
  AuthScreensProps,
  AuthSignInPayload,
  AuthVerificationMode,
} from "./AuthScreens.types";

const headings: Record<AuthScreenMode, { eyebrow: string; title: string; subtitle: string }> = {
  "sign-in": {
    eyebrow: "Welcome back",
    title: "Sign in to Sheet Happens",
    subtitle: "Use passkey, Google, or email credentials to continue.",
  },
  "two-factor": {
    eyebrow: "Verification",
    title: "Enter your 6 digit code",
    subtitle: "Use your authenticator app or one of your saved backup codes.",
  },
  invite: {
    eyebrow: "Invite accepted",
    title: "Confirm your identity",
    subtitle: "Choose the sign-in method for this contractor account.",
  },
  "password-setup": {
    eyebrow: "Security",
    title: "Set a strong password",
    subtitle: "Use at least 12 characters with a mix of symbols and numbers.",
  },
  passkey: {
    eyebrow: "Recommended",
    title: "Add a passkey",
    subtitle: "Passkeys are faster and safer than passwords for daily use.",
  },
  "reset-sent": {
    eyebrow: "Check your inbox",
    title: "Reset link sent",
    subtitle: "If the address exists, a password reset link is on its way.",
  },
  done: {
    eyebrow: "Complete",
    title: "You are ready",
    subtitle: "Your account is configured and can be used for time tracking.",
  },
};

export function AuthScreens({
  mode = "sign-in",
  email = "lena@example.com",
  className,
  onSignIn,
  onMagicLink,
  onResetPassword,
  onVerifyCode,
  onVerificationModeChange,
  onInvitePasswordSetup,
  onInviteGoogle,
  onPasswordSave,
  onPasskeySetup,
  onPasskeySkip,
  onBackToSignIn,
  onContinue,
}: AuthScreensProps) {
  const head = headings[mode];

  return (
    <div
      className={cn(
        "grid min-h-[36rem] overflow-hidden rounded-[var(--radius-xl)] border border-border bg-background md:grid-cols-[0.9fr_1.1fr]",
        className,
      )}
    >
      <aside className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_25%_20%,rgb(55_227_222_/_0.26),transparent_16rem),linear-gradient(145deg,rgb(18_55_50),rgb(8_24_23))] p-8 md:block">
        <div className="relative z-10 grid h-full content-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-ui text-sm font-semibold">Sheet Happens</p>
              <p className="text-xs text-muted-foreground">Internal time tracking</p>
            </div>
          </div>
          <div className="grid gap-4">
            {["Timesheets", "Invoices", "Reports"].map((label) => (
              <div
                key={label}
                className="rounded-[var(--radius-lg)] border border-white/10 bg-white/8 p-4 backdrop-blur"
              >
                <p className="font-ui text-sm font-semibold">{label}</p>
                <p className="mt-1 text-xs text-muted-foreground">Protected workflow access</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
      <main className="grid place-items-center p-5 md:p-8">
        <Card variant="elevated" className="w-full max-w-md">
          <div className="mb-6 grid gap-2">
            <Badge tone="info">{head.eyebrow}</Badge>
            <h2 className="text-2xl font-semibold">{head.title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{head.subtitle}</p>
          </div>
          {mode === "sign-in" ? (
            <SignInForm
              email={email}
              onSignIn={onSignIn}
              onMagicLink={onMagicLink}
              onResetPassword={onResetPassword}
            />
          ) : null}
          {mode === "two-factor" ? (
            <TwoFactor
              onVerifyCode={onVerifyCode}
              onVerificationModeChange={onVerificationModeChange}
            />
          ) : null}
          {mode === "invite" ? (
            <InviteIdentity
              onInvitePasswordSetup={onInvitePasswordSetup}
              onInviteGoogle={onInviteGoogle}
            />
          ) : null}
          {mode === "password-setup" ? <PasswordSetup onPasswordSave={onPasswordSave} /> : null}
          {mode === "passkey" ? (
            <PasskeyUpsell onPasskeySetup={onPasskeySetup} onPasskeySkip={onPasskeySkip} />
          ) : null}
          {mode === "reset-sent" ? (
            <ResetSent email={email} onBackToSignIn={onBackToSignIn} />
          ) : null}
          {mode === "done" ? <DoneState onContinue={onContinue} /> : null}
        </Card>
      </main>
    </div>
  );
}

function SignInForm({
  email,
  onSignIn,
  onMagicLink,
  onResetPassword,
}: {
  email: string;
  onSignIn?: (payload: AuthSignInPayload) => void;
  onMagicLink?: (email: string) => void;
  onResetPassword?: (email: string) => void;
}) {
  const [emailValue, setEmailValue] = useState(email);
  const [password, setPassword] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSignIn?.({ email: emailValue, password });
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <Button type="button" variant="cta" icon={KeyRound}>
        Continue with passkey
      </Button>
      <Field label="Email" htmlFor="auth-email">
        <Input
          id="auth-email"
          type="email"
          placeholder="you@company.com"
          value={emailValue}
          onChange={(event) => setEmailValue(event.target.value)}
        />
      </Field>
      <Field label="Password" htmlFor="auth-password">
        <PasswordInput
          id="auth-password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>
      <Button type="submit">Sign in</Button>
      <div className="flex justify-between text-sm">
        <button
          type="button"
          className="text-accent hover:underline"
          onClick={() => onMagicLink?.(emailValue)}
        >
          Send magic link
        </button>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => onResetPassword?.(emailValue)}
        >
          Reset password
        </button>
      </div>
    </form>
  );
}

function TwoFactor({
  onVerifyCode,
  onVerificationModeChange,
}: {
  onVerifyCode?: (code: string, mode: AuthVerificationMode) => void;
  onVerificationModeChange?: (mode: AuthVerificationMode) => void;
}) {
  const [verificationMode, setVerificationMode] = useState<AuthVerificationMode>("totp");
  const [code, setCode] = useState("222");

  function changeMode(value: string) {
    const nextMode = value as AuthVerificationMode;
    setVerificationMode(nextMode);
    onVerificationModeChange?.(nextMode);
  }

  return (
    <div className="grid gap-4">
      <SegmentedControl
        label="Verification mode"
        value={verificationMode}
        onValueChange={changeMode}
        items={[
          { value: "totp", label: "TOTP" },
          { value: "backup_code", label: "Backup code" },
        ]}
      />
      <CodeInput label="Verification code" value={code} onValueChange={setCode} />
      <p className="text-sm text-muted-foreground">
        Backup codes are the fallback when the authenticator app is unavailable. Email magic links
        are used for sign-in, not for bypassing 2FA.
      </p>
      <Button
        type="button"
        disabled={verificationMode === "totp" ? code.length < 6 : code.trim().length === 0}
        onClick={() => onVerifyCode?.(code, verificationMode)}
      >
        Verify code
      </Button>
    </div>
  );
}

function InviteIdentity({
  onInvitePasswordSetup,
  onInviteGoogle,
}: {
  onInvitePasswordSetup?: () => void;
  onInviteGoogle?: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="rounded-[var(--radius-lg)] border border-border bg-secondary p-4">
        <p className="font-ui text-sm font-semibold">Lena Kovacs</p>
        <p className="text-sm text-muted-foreground">Contractor · Apollo Migration</p>
      </div>
      <Button type="button" variant="cta" onClick={onInvitePasswordSetup}>
        Set up password
      </Button>
      <Button type="button" variant="soft" onClick={onInviteGoogle}>
        Continue with Google
      </Button>
    </div>
  );
}

function PasswordSetup({
  onPasswordSave,
}: {
  onPasswordSave?: (payload: AuthPasswordSetupPayload) => void;
}) {
  const [password, setPassword] = useState("CorrectHorse7!");
  const strength = evaluatePasswordStrength(password);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onPasswordSave?.({ password });
      }}
    >
      <Field label="Password" htmlFor="new-password">
        <PasswordInput
          id="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>
      <StrengthMeter score={strength.score} requirements={strength.requirements} />
      <Button type="submit" variant="cta">
        Save password
      </Button>
    </form>
  );
}

function PasskeyUpsell({
  onPasskeySetup,
  onPasskeySkip,
}: {
  onPasskeySetup?: () => void;
  onPasskeySkip?: () => void;
}) {
  return (
    <div className="grid gap-4">
      {["No password typing", "Works with device biometrics", "Phishing resistant"].map(
        (benefit) => (
          <div
            key={benefit}
            className="flex items-center gap-3 rounded-[var(--radius-md)] bg-secondary p-3"
          >
            <ShieldCheck className="size-4 text-accent" aria-hidden="true" />
            <span className="text-sm">{benefit}</span>
          </div>
        ),
      )}
      <Button type="button" variant="cta" onClick={onPasskeySetup}>
        Set up passkey
      </Button>
      <Button type="button" variant="ghost" onClick={onPasskeySkip}>
        Skip for now
      </Button>
    </div>
  );
}

function ResetSent({ email, onBackToSignIn }: { email: string; onBackToSignIn?: () => void }) {
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary/16 text-accent">
        <Mail className="size-6" aria-hidden="true" />
      </span>
      <p className="text-sm text-muted-foreground">We sent instructions to {email}.</p>
      <Button type="button" variant="soft" onClick={onBackToSignIn}>
        Back to sign in
      </Button>
    </div>
  );
}

function DoneState({ onContinue }: { onContinue?: () => void }) {
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-full bg-success/16 text-success">
        <CheckCircle2 className="size-8" aria-hidden="true" />
      </span>
      <Button type="button" variant="cta" onClick={onContinue}>
        Continue to dashboard
      </Button>
    </div>
  );
}
