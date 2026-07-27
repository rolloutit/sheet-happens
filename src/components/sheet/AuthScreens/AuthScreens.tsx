"use client";

import { CheckCircle2, Fingerprint, Link2, Mail, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  AuthButton,
  AuthField,
  AuthInput,
  AuthPasswordInput,
  AuthScreenHead,
  AuthShell,
} from "@/src/components/layout";
import { CodeInput } from "@/src/components/ui/CodeInput";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { StrengthMeter, evaluatePasswordStrength } from "@/src/components/ui/StrengthMeter";
import type { AuthShellMood } from "@/src/components/layout";
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
    title: "Welcome back",
    subtitle: "Sign in to Sheet Happens.",
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

function authMoodForMode(mode: AuthScreenMode): AuthShellMood {
  if (mode === "invite" || mode === "password-setup" || mode === "passkey") {
    return "aboard";
  }

  if (mode === "reset-sent") {
    return "fresh";
  }

  if (mode === "two-factor") {
    return "secure";
  }

  return "back";
}

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
  const mood = authMoodForMode(mode);

  return (
    <AuthShell mood={mood} className={className}>
      <AuthScreenHead
        eyebrow={mode === "sign-in" ? undefined : head.eyebrow}
        title={head.title}
        description={head.subtitle}
      />
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
      {mode === "reset-sent" ? <ResetSent email={email} onBackToSignIn={onBackToSignIn} /> : null}
      {mode === "done" ? <DoneState onContinue={onContinue} /> : null}
    </AuthShell>
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
    <form className="grid gap-3.5" onSubmit={submit}>
      <AuthButton
        type="button"
        variant="hero"
        icon={<Fingerprint className="size-[19px]" aria-hidden="true" />}
        trailing={
          <span className="rounded-md bg-white/20 px-2 py-1 font-ui text-[9.5px] font-bold uppercase tracking-[0.06em]">
            Recommended
          </span>
        }
      >
        <span className="flex flex-col items-start leading-[1.15]">
          Sign in with passkey
          <span className="text-[11.5px] font-medium opacity-85">
            Passwordless, with your device
          </span>
        </span>
      </AuthButton>
      <div className="my-1 flex items-center gap-3.5 font-ui text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
        or
      </div>
      <AuthField label="Email" htmlFor="auth-email">
        <AuthInput
          id="auth-email"
          icon={Mail}
          type="email"
          placeholder="you@company.com"
          value={emailValue}
          onChange={(event) => setEmailValue(event.target.value)}
        />
      </AuthField>
      <AuthField
        label="Password"
        htmlFor="auth-password"
        right={
          <button
            type="button"
            className="font-ui text-[13px] font-medium text-accent underline-offset-4 hover:underline"
            onClick={() => onResetPassword?.(emailValue)}
          >
            Forgot?
          </button>
        }
      >
        <AuthPasswordInput
          id="auth-password"
          placeholder="••••••••••••"
          value={password}
          labels={{
            hide: "Hide password",
            show: "Show password",
          }}
          onChange={(event) => setPassword(event.target.value)}
        />
      </AuthField>
      <AuthButton type="submit" variant="outline">
        Sign in
      </AuthButton>
      <AuthButton
        type="button"
        variant="ghost"
        icon={<Link2 className="size-4" aria-hidden="true" />}
        onClick={() => onMagicLink?.(emailValue)}
      >
        Email me a sign-in link instead
      </AuthButton>
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
      <AuthButton
        type="button"
        variant="hero"
        disabled={verificationMode === "totp" ? code.length < 6 : code.trim().length === 0}
        onClick={() => onVerifyCode?.(code, verificationMode)}
      >
        Verify code
      </AuthButton>
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
      <AuthButton type="button" variant="hero" onClick={onInvitePasswordSetup}>
        Set up password
      </AuthButton>
      <AuthButton type="button" variant="outline" onClick={onInviteGoogle}>
        Continue with Google
      </AuthButton>
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
      <AuthField label="Password" htmlFor="new-password">
        <AuthPasswordInput
          id="new-password"
          value={password}
          labels={{
            hide: "Hide password",
            show: "Show password",
          }}
          onChange={(event) => setPassword(event.target.value)}
        />
      </AuthField>
      <StrengthMeter score={strength.score} requirements={strength.requirements} />
      <AuthButton type="submit" variant="hero">
        Save password
      </AuthButton>
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
      <AuthButton type="button" variant="hero" onClick={onPasskeySetup}>
        Set up passkey
      </AuthButton>
      <AuthButton type="button" variant="ghost" onClick={onPasskeySkip}>
        Skip for now
      </AuthButton>
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
      <AuthButton type="button" variant="outline" onClick={onBackToSignIn}>
        Back to sign in
      </AuthButton>
    </div>
  );
}

function DoneState({ onContinue }: { onContinue?: () => void }) {
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-full bg-success/16 text-success">
        <CheckCircle2 className="size-8" aria-hidden="true" />
      </span>
      <AuthButton type="button" variant="hero" onClick={onContinue}>
        Continue to dashboard
      </AuthButton>
    </div>
  );
}
