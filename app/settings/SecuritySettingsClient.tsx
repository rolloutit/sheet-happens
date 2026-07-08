"use client";

import {
  BadgeCheck,
  Building2,
  Copy,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  MailCheck,
  Pencil,
  QrCode,
  RefreshCw,
  ShieldCheck,
  ShieldPlus,
  Smartphone,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toDataURL } from "qrcode";

import { SecurityMethodList } from "@/src/components/sheet/SecurityMethodList";
import type { SecurityMethod } from "@/src/components/sheet/SecurityMethodList";
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
import { CodeInput } from "@/src/components/ui/CodeInput";
import { Field } from "@/src/components/ui/Field";
import { FormSection } from "@/src/components/ui/FormSection";
import { Input } from "@/src/components/ui/Input";
import { authClient } from "@/src/lib/auth-client";
import { cn } from "@/src/lib/utils";
import { verifySecondFactorAction } from "../two-factor/actions";
import {
  auditBackupCodesRegeneratedAction,
  auditTotpDisabledAction,
  deletePasskeyAction,
  renamePasskeyAction,
} from "./actions";
import type { SecuritySettingsActionState } from "./actions.types";

export type SecuritySettingsClientProps = {
  user: {
    id: string;
    email: string;
    name: string;
    twoFactorEnabled: boolean;
    passwordEnabled: boolean;
    googleLinked: boolean;
    googleAvailable: boolean;
  };
  passkeys: PasskeyView[];
  twoFactor: {
    enabled: boolean;
    verified: boolean;
    lockedUntil: string | null;
    failedVerificationCount: number;
  };
};

export type PasskeyView = {
  id: string;
  name: string | null;
  deviceType: string;
  backedUp: boolean;
  transports: string | null;
  createdAt: string | null;
};

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
};

type TotpSetupState =
  | {
      status: "idle";
      totpURI?: undefined;
      backupCodes?: undefined;
    }
  | {
      status: "ready";
      totpURI: string;
      backupCodes: string[];
    };

type PendingAction =
  | "add-platform-passkey"
  | "add-roaming-passkey"
  | "enable-totp"
  | "password-reset"
  | "verify-totp"
  | "disable-totp"
  | "regenerate-backup-codes"
  | `rename-${string}`
  | `delete-${string}`;

const defaultPasskeyName = "Sheet Happens passkey";

export function SecuritySettingsClient({ user, passkeys, twoFactor }: SecuritySettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [passkeyName, setPasskeyName] = useState(defaultPasskeyName);
  const [passkeyNameEdits, setPasskeyNameEdits] = useState<Record<string, string>>({});
  const [totpSetup, setTotpSetup] = useState<TotpSetupState>({ status: "idle" });
  const [totpCode, setTotpCode] = useState("");
  const [twoFactorPassword, setTwoFactorPassword] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [totpQrCode, setTotpQrCode] = useState<{ uri: string; dataUrl: string } | null>(null);
  const [totpQrCodeErrorUri, setTotpQrCodeErrorUri] = useState<string | null>(null);

  const methods = useMemo<SecurityMethod[]>(
    () => [
      {
        id: "magic-link",
        label: "Email magic link",
        description: `Primary passwordless sign-in for ${user.email}.`,
        state: "connected",
        stateLabel: "Connected",
        icon: MailCheck,
      },
      {
        id: "password",
        label: "Email password",
        description: user.passwordEnabled
          ? "Password sign-in is enabled for this account."
          : "Set a password through an emailed setup link.",
        state: user.passwordEnabled ? "connected" : "recommended",
        stateLabel: user.passwordEnabled ? "Enabled" : "Available",
        icon: LockKeyhole,
        actionLabel: user.passwordEnabled ? "Reset" : "Set up",
      },
      ...(user.googleAvailable
        ? [
            {
              id: "google",
              label: "Company Google",
              description: user.googleLinked
                ? "A company Google account is linked."
                : "Available for configured Google Workspace domains after activation.",
              state: user.googleLinked ? "connected" : "not_enabled",
              stateLabel: user.googleLinked ? "Linked" : "Available",
              icon: Building2,
            } satisfies SecurityMethod,
          ]
        : []),
      {
        id: "passkeys",
        label: "Passkeys",
        description:
          passkeys.length > 0
            ? `${passkeys.length} passkey${passkeys.length === 1 ? "" : "s"} registered.`
            : "Use Touch ID, Face ID, Windows Hello, or a hardware security key.",
        state: passkeys.length > 0 ? "connected" : "recommended",
        stateLabel: passkeys.length > 0 ? `${passkeys.length} set` : "Recommended",
        icon: KeyRound,
        actionLabel: "Add",
      },
      {
        id: "totp",
        label: "Authenticator app",
        description: twoFactor.enabled
          ? "A time-based one-time code is required during supported sign-in challenges."
          : "Add app-based one-time codes as a second factor.",
        state: twoFactor.enabled ? "connected" : "recommended",
        stateLabel: twoFactor.enabled ? "Enabled" : "Recommended",
        icon: Smartphone,
        actionLabel: twoFactor.enabled ? "Disable" : "Set up",
      },
    ],
    [
      passkeys.length,
      twoFactor.enabled,
      user.email,
      user.googleAvailable,
      user.googleLinked,
      user.passwordEnabled,
    ],
  );

  const totpUri = totpSetup.status === "ready" ? totpSetup.totpURI : "";
  const totpQrCodeDataUrl = totpQrCode?.uri === totpUri ? totpQrCode.dataUrl : null;
  const totpQrCodeError = totpQrCodeErrorUri === totpUri;

  useEffect(() => {
    if (!totpUri) return;
    let cancelled = false;

    void toDataURL(totpUri, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      color: {
        dark: "#0a1917",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (!cancelled) {
          setTotpQrCode({
            uri: totpUri,
            dataUrl,
          });
          setTotpQrCodeErrorUri(null);
        }
      })
      .catch(() => {
        if (!cancelled) setTotpQrCodeErrorUri(totpUri);
      });

    return () => {
      cancelled = true;
    };
  }, [totpUri]);

  async function addPasskey(authenticatorAttachment: "platform" | "cross-platform") {
    const action: PendingAction =
      authenticatorAttachment === "platform" ? "add-platform-passkey" : "add-roaming-passkey";
    setPendingAction(action);
    setNotice(null);

    const result = await authClient.passkey.addPasskey({
      name: passkeyName.trim() || defaultPasskeyName,
      authenticatorAttachment,
    });

    setPendingAction(null);

    if (result.error) {
      setNotice({
        tone: "error",
        message: getAuthErrorMessage(result.error, "Could not add the passkey."),
      });
      return;
    }

    setNotice({
      tone: "success",
      message: "Passkey added.",
    });
    router.refresh();
  }

  function renamePasskey(passkey: PasskeyView) {
    const nextName = getEditedPasskeyName(passkeyNameEdits, passkey).trim();

    setPendingAction(`rename-${passkey.id}`);
    setNotice(null);

    startTransition(async () => {
      const result = await renamePasskeyAction({
        passkeyId: passkey.id,
        name: nextName,
      });
      finishServerAction(result);
    });
  }

  function deletePasskey(passkey: PasskeyView) {
    if (!window.confirm(`Remove ${getPasskeyLabel(passkey)}?`)) {
      return;
    }

    setPendingAction(`delete-${passkey.id}`);
    setNotice(null);

    startTransition(async () => {
      const result = await deletePasskeyAction({
        passkeyId: passkey.id,
      });
      finishServerAction(result);
    });
  }

  function finishServerAction(result: SecuritySettingsActionState) {
    setPendingAction(null);
    setNotice({
      tone: result.status === "success" ? "success" : "error",
      message: result.message,
    });

    if (result.status === "success") {
      router.refresh();
    }
  }

  async function requestPasswordReset() {
    setPendingAction("password-reset");
    setNotice(null);

    const result = await authClient.requestPasswordReset({
      email: user.email,
      redirectTo: "/reset-password?callbackURL=/settings",
    });

    setPendingAction(null);

    if (result.error) {
      setNotice({
        tone: "error",
        message: getAuthErrorMessage(result.error, "Could not send the password setup email."),
      });
      return;
    }

    setNotice({
      tone: "success",
      message: "Password setup link sent if this account is eligible.",
    });
  }

  async function beginTotpSetup() {
    if (!validateTwoFactorPassword()) {
      return;
    }

    setPendingAction("enable-totp");
    setNotice(null);
    setTotpCode("");
    setBackupCodes([]);

    const result = await authClient.twoFactor.enable({
      issuer: "Sheet Happens",
      ...(user.passwordEnabled ? { password: twoFactorPassword } : {}),
    });

    setPendingAction(null);

    if (result.error || !result.data) {
      setNotice({
        tone: "error",
        message: getAuthErrorMessage(result.error, "Could not start authenticator setup."),
      });
      return;
    }

    setTwoFactorPassword("");
    setTotpSetup({
      status: "ready",
      totpURI: result.data.totpURI,
      backupCodes: result.data.backupCodes,
    });
    setBackupCodes(result.data.backupCodes);
    setNotice({
      tone: "info",
      message: "Authenticator secret generated. Verify a code to finish setup.",
    });
  }

  async function verifyTotpSetup() {
    setPendingAction("verify-totp");
    setNotice(null);

    const result = await verifySecondFactorAction({
      method: "totp",
      code: totpCode,
    });

    setPendingAction(null);

    if (result.status === "error") {
      setNotice({
        tone: "error",
        message: result.message,
      });
      return;
    }

    setTotpSetup({ status: "idle" });
    setTotpCode("");
    setNotice({
      tone: "success",
      message: "Authenticator app enabled.",
    });
    router.refresh();
  }

  async function disableTotp() {
    if (!validateTwoFactorPassword()) {
      return;
    }

    if (!window.confirm("Disable authenticator-app verification for this account?")) {
      return;
    }

    setPendingAction("disable-totp");
    setNotice(null);

    const result = await authClient.twoFactor.disable({
      ...(user.passwordEnabled ? { password: twoFactorPassword } : {}),
    });

    setPendingAction(null);

    if (result.error) {
      setNotice({
        tone: "error",
        message: getAuthErrorMessage(result.error, "Could not disable authenticator app."),
      });
      return;
    }

    setTwoFactorPassword("");
    setTotpSetup({ status: "idle" });
    setBackupCodes([]);
    const auditResult = await auditTotpDisabledAction();
    setNotice({
      tone: auditResult.status === "success" ? "success" : "error",
      message:
        auditResult.status === "success" ? "Authenticator app disabled." : auditResult.message,
    });
    router.refresh();
  }

  async function regenerateBackupCodes() {
    if (!validateTwoFactorPassword()) {
      return;
    }

    if (!window.confirm("Generate new backup codes? Existing backup codes will stop working.")) {
      return;
    }

    setPendingAction("regenerate-backup-codes");
    setNotice(null);

    const result = await authClient.twoFactor.generateBackupCodes({
      ...(user.passwordEnabled ? { password: twoFactorPassword } : {}),
    });

    setPendingAction(null);

    if (result.error || !result.data) {
      setNotice({
        tone: "error",
        message: getAuthErrorMessage(result.error, "Could not generate backup codes."),
      });
      return;
    }

    setTwoFactorPassword("");
    setBackupCodes(result.data.backupCodes);
    const auditResult = await auditBackupCodesRegeneratedAction();
    setNotice({
      tone: auditResult.status === "success" ? "success" : "error",
      message:
        auditResult.status === "success"
          ? "New backup codes generated. Store them now."
          : auditResult.message,
    });
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice({
        tone: "success",
        message: `${label} copied.`,
      });
    } catch {
      setNotice({
        tone: "error",
        message: `Could not copy ${label.toLowerCase()}.`,
      });
    }
  }

  function validateTwoFactorPassword() {
    if (!user.passwordEnabled || twoFactorPassword) {
      return true;
    }

    setNotice({
      tone: "error",
      message: "Enter your current password to manage authenticator-app verification.",
    });
    return false;
  }

  const totpSecret = getTotpSecret(totpSetup.status === "ready" ? totpSetup.totpURI : "");
  const busy = pendingAction !== null || isPending;

  return (
    <div className="grid gap-6">
      {notice ? <NoticeMessage notice={notice} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.55fr)]">
        <SecurityMethodList
          methods={methods}
          onMethodAction={(method) => {
            if (method.id === "password") {
              document.getElementById("password-management")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }

            if (method.id === "passkeys") {
              document.getElementById("passkey-management")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }

            if (method.id === "totp") {
              if (twoFactor.enabled) {
                void disableTotp();
              } else {
                void beginTotpSetup();
              }
            }
          }}
        />

        <Card variant="elevated">
          <CardHeader className="block">
            <CardTitle>Security posture</CardTitle>
            <CardDescription>
              Account-level controls backed by Better Auth. Magic links stay available as the
              recovery path.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <PostureRow
                icon={ShieldCheck}
                label="Primary sign-in"
                value="Magic link"
                tone="success"
              />
              <PostureRow
                icon={LockKeyhole}
                label="Password sign-in"
                value={user.passwordEnabled ? "Enabled" : "Not set"}
                tone={user.passwordEnabled ? "success" : "warning"}
              />
              {user.googleAvailable ? (
                <PostureRow
                  icon={Building2}
                  label="Company Google"
                  value={user.googleLinked ? "Linked" : "Available"}
                  tone={user.googleLinked ? "success" : "warning"}
                />
              ) : null}
              <PostureRow
                icon={KeyRound}
                label="Passkey coverage"
                value={passkeys.length > 0 ? `${passkeys.length} registered` : "Not set"}
                tone={passkeys.length > 0 ? "success" : "warning"}
              />
              <PostureRow
                icon={Smartphone}
                label="Authenticator app"
                value={twoFactor.enabled ? "Enabled" : "Not enabled"}
                tone={twoFactor.enabled ? "success" : "warning"}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card id="password-management" density="lg">
        <CardHeader className="block">
          <CardTitle>Email password</CardTitle>
          <CardDescription>
            Password sign-in is optional and remains bound to the invited member email address.
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-4">
          <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-secondary/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full",
                  user.passwordEnabled
                    ? "bg-success/16 text-success"
                    : "bg-warning/16 text-warning",
                )}
              >
                <LockKeyhole className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-ui text-sm font-semibold text-foreground">
                  {user.passwordEnabled ? "Password sign-in is enabled" : "No password is set"}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {user.passwordEnabled
                    ? "Send a reset link if you need to rotate or recover the password."
                    : "Send a setup link to create a password for this account."}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant={user.passwordEnabled ? "soft" : "primary"}
              icon={MailCheck}
              loading={pendingAction === "password-reset"}
              disabled={busy}
              onClick={() => void requestPasswordReset()}
            >
              {user.passwordEnabled ? "Send reset link" : "Send setup link"}
            </Button>
          </div>
          {user.googleAvailable ? (
            <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
              <Building2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              <p>
                Company Google sign-in is enabled for the configured Workspace domain. It links
                automatically on first successful Google sign-in when the email matches this
                activated account.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card id="passkey-management" density="lg">
        <CardHeader className="block">
          <CardTitle>Passkeys</CardTitle>
          <CardDescription>
            Register device biometrics or hardware security keys for phishing-resistant sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-6">
          <FormSection
            title="Add a passkey"
            description="Use a clear name so you can identify the device later."
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(16rem,24rem)_auto] lg:items-end">
              <Field label="Passkey name" reserveMessageSpace>
                {({ id }) => (
                  <Input
                    id={id}
                    value={passkeyName}
                    maxLength={80}
                    onChange={(event) => setPasskeyName(event.target.value)}
                  />
                )}
              </Field>
              <div className="flex flex-wrap gap-2 pb-0 lg:pb-6">
                <Button
                  type="button"
                  icon={ShieldPlus}
                  loading={pendingAction === "add-platform-passkey"}
                  disabled={busy}
                  onClick={() => void addPasskey("platform")}
                >
                  Add device passkey
                </Button>
                <Button
                  type="button"
                  variant="soft"
                  icon={KeyRound}
                  loading={pendingAction === "add-roaming-passkey"}
                  disabled={busy}
                  onClick={() => void addPasskey("cross-platform")}
                >
                  Add security key
                </Button>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Registered passkeys"
            description="Remove passkeys you no longer recognize. Magic-link sign-in remains available."
          >
            {passkeys.length === 0 ? (
              <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-secondary/50 p-5 text-sm text-muted-foreground">
                No passkeys have been registered for this account yet.
              </div>
            ) : (
              <div className="grid gap-3">
                {passkeys.map((passkey) => {
                  const currentName = getEditedPasskeyName(passkeyNameEdits, passkey);
                  const changed = currentName.trim() !== getPasskeyLabel(passkey);

                  return (
                    <div
                      key={passkey.id}
                      className="grid gap-4 rounded-[var(--radius-lg)] border border-border bg-secondary/50 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                    >
                      <div className="grid gap-3 sm:grid-cols-[minmax(14rem,1fr)_auto] sm:items-center">
                        <Field label="Name" reserveMessageSpace>
                          {({ id }) => (
                            <Input
                              id={id}
                              value={currentName}
                              maxLength={80}
                              onChange={(event) =>
                                setPasskeyNameEdits((names) => ({
                                  ...names,
                                  [passkey.id]: event.target.value,
                                }))
                              }
                            />
                          )}
                        </Field>
                        <div className="flex flex-wrap gap-2 pb-0 sm:pb-6">
                          <PasskeyBadge label={formatDeviceType(passkey.deviceType)} />
                          {passkey.backedUp ? <PasskeyBadge label="Synced" tone="success" /> : null}
                          {passkey.createdAt ? (
                            <PasskeyBadge label={formatDate(passkey.createdAt)} />
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="soft"
                          size="sm"
                          icon={Pencil}
                          loading={pendingAction === `rename-${passkey.id}`}
                          disabled={busy || !changed}
                          onClick={() => renamePasskey(passkey)}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          loading={pendingAction === `delete-${passkey.id}`}
                          disabled={busy}
                          onClick={() => deletePasskey(passkey)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </FormSection>
        </CardContent>
      </Card>

      <Card density="lg">
        <CardHeader className="block">
          <CardTitle>Authenticator app</CardTitle>
          <CardDescription>
            Set up TOTP with an authenticator app and keep backup codes somewhere safe.
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-6">
          {twoFactor.lockedUntil ? (
            <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                TOTP verification is temporarily locked until{" "}
                {formatDateTime(twoFactor.lockedUntil)}.
              </p>
            </div>
          ) : null}

          {twoFactor.failedVerificationCount > 0 && !twoFactor.lockedUntil ? (
            <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>{twoFactor.failedVerificationCount} failed TOTP attempt(s) are recorded.</p>
            </div>
          ) : null}

          {user.passwordEnabled ? (
            <div className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-secondary/50 p-4">
              <Field
                label="Current password"
                hint="Required because password sign-in is enabled for this account."
              >
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    type="password"
                    autoComplete="current-password"
                    aria-describedby={describedBy}
                    value={twoFactorPassword}
                    disabled={busy}
                    onChange={(event) => setTwoFactorPassword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !twoFactor.enabled) {
                        event.preventDefault();
                        void beginTotpSetup();
                      }
                    }}
                  />
                )}
              </Field>
            </div>
          ) : null}

          {twoFactor.enabled ? (
            <div className="grid gap-4 rounded-[var(--radius-lg)] border border-success/35 bg-success/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success/16 text-success">
                    <BadgeCheck className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-ui text-sm font-semibold text-foreground">
                      Authenticator app is enabled
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Sign-in challenges can require a 6 digit code from your authenticator app.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="soft"
                    icon={RefreshCw}
                    loading={pendingAction === "regenerate-backup-codes"}
                    disabled={busy}
                    onClick={() => void regenerateBackupCodes()}
                  >
                    New backup codes
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    loading={pendingAction === "disable-totp"}
                    disabled={busy}
                    onClick={() => void disableTotp()}
                  >
                    Disable
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-secondary/50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-ui text-sm font-semibold text-foreground">
                  Authenticator app is not enabled
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Generate a secret, add it to your authenticator app, and verify the first code.
                </p>
              </div>
              <Button
                type="button"
                icon={ShieldPlus}
                loading={pendingAction === "enable-totp"}
                disabled={busy}
                onClick={() => void beginTotpSetup()}
              >
                Set up authenticator
              </Button>
            </div>
          )}

          {totpSetup.status === "ready" ? (
            <div className="grid gap-5 rounded-[var(--radius-lg)] border border-border bg-secondary/50 p-4">
              <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
                <div className="grid content-start gap-2">
                  <div className="grid aspect-square place-items-center rounded-[var(--radius-md)] border border-border bg-white p-3 text-center shadow-sm">
                    {totpQrCodeDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- QR code is a generated data URL, not an optimizable remote/static image.
                      <img
                        src={totpQrCodeDataUrl}
                        alt="Authenticator app setup QR code"
                        className="size-full"
                      />
                    ) : (
                      <div className="grid justify-items-center gap-3 text-slate-700">
                        <QrCode className="size-10" aria-hidden="true" />
                        <p className="px-4 text-xs font-semibold">
                          {totpQrCodeError ? "QR unavailable" : "Generating QR"}
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-center font-ui text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Scan QR code
                  </p>
                </div>
                <div className="grid content-start gap-3">
                  <div>
                    <p className="font-ui text-sm font-semibold text-foreground">
                      Scan with your authenticator app
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Open {user.email} in your authenticator app, scan the QR code, then enter the
                      current 6-digit code below.
                    </p>
                  </div>
                  <div>
                    <p className="font-ui text-sm font-semibold text-foreground">
                      Manual key fallback
                    </p>
                    <p className="mt-1 break-all rounded-[var(--radius-md)] border border-border bg-background/60 px-3 py-2 font-mono text-sm text-muted-foreground">
                      {totpSecret}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="soft"
                      size="sm"
                      icon={Copy}
                      onClick={() => void copyText(totpSecret, "Manual key")}
                    >
                      Copy key
                    </Button>
                    <Button asChild type="button" variant="soft" size="sm" icon={ExternalLink}>
                      <a href={totpSetup.totpURI}>Open in authenticator</a>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(16rem,22rem)_auto] lg:items-end">
                <Field
                  label="6-digit code"
                  hint="Enter the current code from your authenticator app."
                >
                  {({ describedBy }) => (
                    <CodeInput
                      label="Authenticator code"
                      value={totpCode}
                      onValueChange={setTotpCode}
                      aria-describedby={describedBy}
                      invalid={notice?.tone === "error" && pendingAction !== "enable-totp"}
                    />
                  )}
                </Field>
                <Button
                  type="button"
                  icon={ShieldCheck}
                  loading={pendingAction === "verify-totp"}
                  disabled={busy || totpCode.length !== 6}
                  onClick={() => void verifyTotpSetup()}
                  className="lg:mb-6"
                >
                  Verify and enable
                </Button>
              </div>
            </div>
          ) : null}

          {backupCodes.length > 0 ? (
            <BackupCodesPanel
              codes={backupCodes}
              onCopy={(value) => copyText(value, "Backup codes")}
            />
          ) : null}
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            TOTP is the v1 admin second factor. Email passwords and passkeys remain sign-in methods,
            not admin 2FA replacements.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

function NoticeMessage({ notice }: { notice: Notice }) {
  return (
    <p
      role={notice.tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[var(--radius-lg)] border px-4 py-3 text-sm",
        notice.tone === "success" && "border-success/40 bg-success/10 text-success",
        notice.tone === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
        notice.tone === "info" && "border-accent/40 bg-accent/10 text-accent",
      )}
    >
      {notice.message}
    </p>
  );
}

function PostureRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  tone: "success" | "warning";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-secondary/60 p-3">
      <div className="flex items-center gap-3">
        <Icon className="size-4 text-accent" aria-hidden="true" />
        <span className="font-ui text-sm font-semibold text-foreground">{label}</span>
      </div>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}

function PasskeyBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success";
}) {
  return <Badge tone={tone}>{label}</Badge>;
}

function BackupCodesPanel({
  codes,
  onCopy,
}: {
  codes: string[];
  onCopy: (value: string) => void | Promise<void>;
}) {
  const allCodes = codes.join("\n");

  return (
    <div className="grid gap-3 rounded-[var(--radius-lg)] border border-warning/40 bg-warning/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-ui text-sm font-semibold text-foreground">Backup codes</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Store these now. Each code can be used once if your authenticator app is unavailable.
          </p>
        </div>
        <Button
          type="button"
          variant="soft"
          size="sm"
          icon={Copy}
          onClick={() => void onCopy(allCodes)}
        >
          Copy all
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {codes.map((code) => (
          <code
            key={code}
            className="rounded-[var(--radius-md)] border border-border bg-background/70 px-3 py-2 font-mono text-sm text-foreground"
          >
            {code}
          </code>
        ))}
      </div>
    </div>
  );
}

function getPasskeyLabel(passkey: PasskeyView) {
  return passkey.name?.trim() || formatDeviceType(passkey.deviceType);
}

function getEditedPasskeyName(edits: Record<string, string>, passkey: PasskeyView) {
  return edits[passkey.id] ?? getPasskeyLabel(passkey);
}

function formatDeviceType(deviceType: string) {
  if (!deviceType) return "Passkey";
  return deviceType
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getTotpSecret(totpURI: string) {
  if (!totpURI) return "";

  try {
    return new URL(totpURI).searchParams.get("secret") ?? totpURI;
  } catch {
    return totpURI;
  }
}

function getAuthErrorMessage(error: { message?: string; code?: string } | null, fallback: string) {
  if (!error) return fallback;
  if (error.code === "INVALID_PASSWORD" || error.message === "Invalid password") {
    return "Current password is required or incorrect.";
  }

  return error.message || error.code || fallback;
}
