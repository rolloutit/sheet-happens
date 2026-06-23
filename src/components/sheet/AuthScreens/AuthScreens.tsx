import { CheckCircle2, KeyRound, Mail, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { cn } from "@/src/lib/utils";
import type { AuthScreenMode, AuthScreensProps } from "./AuthScreens.types";

const headings: Record<AuthScreenMode, { eyebrow: string; title: string; subtitle: string }> = {
  "sign-in": {
    eyebrow: "Welcome back",
    title: "Sign in to Sheet Happens",
    subtitle: "Use passkey, Google, or email credentials to continue.",
  },
  "two-factor": {
    eyebrow: "Verification",
    title: "Enter your 6 digit code",
    subtitle: "Use your authenticator app or request an email code.",
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
          {mode === "sign-in" ? <SignInForm /> : null}
          {mode === "two-factor" ? <TwoFactor email={email} /> : null}
          {mode === "invite" ? <InviteIdentity /> : null}
          {mode === "password-setup" ? <PasswordSetup /> : null}
          {mode === "passkey" ? <PasskeyUpsell /> : null}
          {mode === "reset-sent" ? <ResetSent email={email} /> : null}
          {mode === "done" ? <DoneState /> : null}
        </Card>
      </main>
    </div>
  );
}

function SignInForm() {
  return (
    <div className="grid gap-4">
      <Button variant="cta" icon={KeyRound}>
        Continue with passkey
      </Button>
      <Field label="Email" htmlFor="auth-email">
        <Input
          id="auth-email"
          type="email"
          placeholder="you@company.com"
          defaultValue="lena@example.com"
        />
      </Field>
      <Field label="Password" htmlFor="auth-password">
        <Input id="auth-password" type="password" placeholder="Password" />
      </Field>
      <Button>Sign in</Button>
      <div className="flex justify-between text-sm">
        <button type="button" className="text-accent hover:underline">
          Send magic link
        </button>
        <button type="button" className="text-muted-foreground hover:text-foreground">
          Reset password
        </button>
      </div>
    </div>
  );
}

function TwoFactor({ email }: { email: string }) {
  return (
    <div className="grid gap-4">
      <SegmentedControl
        label="Verification mode"
        value="totp"
        items={[
          { value: "totp", label: "TOTP" },
          { value: "email", label: "Email" },
        ]}
      />
      <div className="grid grid-cols-6 gap-2">
        {["", "", "", "", "", ""].map((_, index) => (
          <div
            key={index}
            className="grid aspect-square place-items-center rounded-[var(--radius-md)] border border-input bg-card font-ui text-lg font-semibold"
          >
            {index < 3 ? index + 2 : ""}
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Email fallback available for {email} in 28 seconds.
      </p>
      <Button disabled>Verify code</Button>
    </div>
  );
}

function InviteIdentity() {
  return (
    <div className="grid gap-4">
      <div className="rounded-[var(--radius-lg)] border border-border bg-secondary p-4">
        <p className="font-ui text-sm font-semibold">Lena Kovacs</p>
        <p className="text-sm text-muted-foreground">Contractor · Apollo Migration</p>
      </div>
      <Button variant="cta">Set up password</Button>
      <Button variant="soft">Continue with Google</Button>
    </div>
  );
}

function PasswordSetup() {
  return (
    <div className="grid gap-4">
      <Field label="Password">
        <Input type="password" defaultValue="correct horse battery" />
      </Field>
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn("h-2 rounded-full", index < 3 ? "bg-primary" : "bg-secondary")}
          />
        ))}
      </div>
      <ul className="grid gap-2 text-sm text-muted-foreground">
        {["12 characters", "Number or symbol", "Not reused"].map((rule) => (
          <li key={rule} className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
            {rule}
          </li>
        ))}
      </ul>
      <Button variant="cta">Save password</Button>
    </div>
  );
}

function PasskeyUpsell() {
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
      <Button variant="cta">Set up passkey</Button>
      <Button variant="ghost">Skip for now</Button>
    </div>
  );
}

function ResetSent({ email }: { email: string }) {
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary/16 text-accent">
        <Mail className="size-6" aria-hidden="true" />
      </span>
      <p className="text-sm text-muted-foreground">We sent instructions to {email}.</p>
      <Button variant="soft">Back to sign in</Button>
    </div>
  );
}

function DoneState() {
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-full bg-success/16 text-success">
        <CheckCircle2 className="size-8" aria-hidden="true" />
      </span>
      <Button variant="cta">Continue to dashboard</Button>
    </div>
  );
}
