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
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toDataURL } from "qrcode";
import { useLocale, useTranslations } from "next-intl";

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

export function SecuritySettingsClient({ user, passkeys, twoFactor }: SecuritySettingsClientProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Settings");
  const defaultPasskeyName = t("passkeys.defaultName");
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
  const totpSetupPanelRef = useRef<HTMLDivElement | null>(null);

  const methods = useMemo<SecurityMethod[]>(
    () => [
      {
        id: "magic-link",
        label: t("methods.magicLink.label"),
        description: t("methods.magicLink.description", { email: user.email }),
        state: "connected",
        stateLabel: t("states.connected"),
        icon: MailCheck,
      },
      {
        id: "password",
        label: t("methods.password.label"),
        description: user.passwordEnabled
          ? t("methods.password.enabledDescription")
          : t("methods.password.setupDescription"),
        state: user.passwordEnabled ? "connected" : "recommended",
        stateLabel: user.passwordEnabled ? t("states.enabled") : t("states.available"),
        icon: LockKeyhole,
        actionLabel: user.passwordEnabled ? t("actions.reset") : t("actions.setUp"),
      },
      ...(user.googleAvailable
        ? [
            {
              id: "google",
              label: t("methods.google.label"),
              description: user.googleLinked
                ? t("methods.google.linkedDescription")
                : t("methods.google.availableDescription"),
              state: user.googleLinked ? "connected" : "not_enabled",
              stateLabel: user.googleLinked ? t("states.linked") : t("states.available"),
              icon: Building2,
            } satisfies SecurityMethod,
          ]
        : []),
      {
        id: "passkeys",
        label: t("methods.passkeys.label"),
        description:
          passkeys.length > 0
            ? t("methods.passkeys.registeredDescription", { count: passkeys.length })
            : t("methods.passkeys.emptyDescription"),
        state: passkeys.length > 0 ? "connected" : "recommended",
        stateLabel:
          passkeys.length > 0
            ? t("methods.passkeys.countSet", { count: passkeys.length })
            : t("states.recommended"),
        icon: KeyRound,
        actionLabel: t("actions.add"),
      },
      {
        id: "totp",
        label: t("methods.totp.label"),
        description: twoFactor.enabled
          ? t("methods.totp.enabledDescription")
          : t("methods.totp.setupDescription"),
        state: twoFactor.enabled ? "connected" : "recommended",
        stateLabel: twoFactor.enabled ? t("states.enabled") : t("states.recommended"),
        icon: Smartphone,
        actionLabel: twoFactor.enabled ? t("actions.disable") : t("actions.setUp"),
      },
    ],
    [
      passkeys.length,
      t,
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

    const frame = window.requestAnimationFrame(() => {
      const panel = totpSetupPanelRef.current;
      if (!panel) return;

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      panel.focus({ preventScroll: true });
      panel.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [totpUri]);

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
        message: getAuthErrorMessage(result.error, t("errors.addPasskeyFailed"), t),
      });
      return;
    }

    setNotice({
      tone: "success",
      message: t("notices.passkeyAdded"),
    });
    router.refresh();
  }

  function renamePasskey(passkey: PasskeyView) {
    const nextName = getEditedPasskeyName(passkeyNameEdits, passkey, t).trim();

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
    if (!window.confirm(t("confirm.removePasskey", { name: getPasskeyLabel(passkey, t) }))) {
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
        message: getAuthErrorMessage(result.error, t("errors.passwordEmailFailed"), t),
      });
      return;
    }

    setNotice({
      tone: "success",
      message: t("notices.passwordLinkSent"),
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
        message: getAuthErrorMessage(result.error, t("errors.totpSetupFailed"), t),
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
      message: t("notices.totpSecretGenerated"),
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
      message: t("notices.totpEnabled"),
    });
    router.refresh();
  }

  async function disableTotp() {
    if (!validateTwoFactorPassword()) {
      return;
    }

    if (!window.confirm(t("confirm.disableTotp"))) {
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
        message: getAuthErrorMessage(result.error, t("errors.totpDisableFailed"), t),
      });
      return;
    }

    setTwoFactorPassword("");
    setTotpSetup({ status: "idle" });
    setBackupCodes([]);
    const auditResult = await auditTotpDisabledAction();
    setNotice({
      tone: auditResult.status === "success" ? "success" : "error",
      message: auditResult.status === "success" ? t("notices.totpDisabled") : auditResult.message,
    });
    router.refresh();
  }

  async function regenerateBackupCodes() {
    if (!validateTwoFactorPassword()) {
      return;
    }

    if (!window.confirm(t("confirm.regenerateBackupCodes"))) {
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
        message: getAuthErrorMessage(result.error, t("errors.backupCodesFailed"), t),
      });
      return;
    }

    setTwoFactorPassword("");
    setBackupCodes(result.data.backupCodes);
    const auditResult = await auditBackupCodesRegeneratedAction();
    setNotice({
      tone: auditResult.status === "success" ? "success" : "error",
      message:
        auditResult.status === "success" ? t("notices.backupCodesGenerated") : auditResult.message,
    });
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice({
        tone: "success",
        message: t("notices.copied", { label }),
      });
    } catch {
      setNotice({
        tone: "error",
        message: t("errors.copyFailed", { label }),
      });
    }
  }

  function validateTwoFactorPassword() {
    if (!user.passwordEnabled || twoFactorPassword) {
      return true;
    }

    setNotice({
      tone: "error",
      message: t("errors.currentPasswordRequired"),
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
            <CardTitle>{t("posture.title")}</CardTitle>
            <CardDescription>{t("posture.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <PostureRow
                icon={ShieldCheck}
                label={t("posture.primarySignIn")}
                value={t("posture.magicLink")}
                tone="success"
              />
              <PostureRow
                icon={LockKeyhole}
                label={t("posture.passwordSignIn")}
                value={user.passwordEnabled ? t("states.enabled") : t("states.notSet")}
                tone={user.passwordEnabled ? "success" : "warning"}
              />
              {user.googleAvailable ? (
                <PostureRow
                  icon={Building2}
                  label={t("methods.google.label")}
                  value={user.googleLinked ? t("states.linked") : t("states.available")}
                  tone={user.googleLinked ? "success" : "warning"}
                />
              ) : null}
              <PostureRow
                icon={KeyRound}
                label={t("posture.passkeyCoverage")}
                value={
                  passkeys.length > 0
                    ? t("posture.passkeysRegistered", { count: passkeys.length })
                    : t("states.notSet")
                }
                tone={passkeys.length > 0 ? "success" : "warning"}
              />
              <PostureRow
                icon={Smartphone}
                label={t("methods.totp.label")}
                value={twoFactor.enabled ? t("states.enabled") : t("states.notEnabled")}
                tone={twoFactor.enabled ? "success" : "warning"}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card id="password-management" density="lg">
        <CardHeader className="block">
          <CardTitle>{t("password.title")}</CardTitle>
          <CardDescription>{t("password.description")}</CardDescription>
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
                  {user.passwordEnabled ? t("password.enabledTitle") : t("password.notSetTitle")}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {user.passwordEnabled
                    ? t("password.enabledDescription")
                    : t("password.notSetDescription")}
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
              {user.passwordEnabled ? t("password.sendResetLink") : t("password.sendSetupLink")}
            </Button>
          </div>
          {user.googleAvailable ? (
            <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
              <Building2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              <p>{t("password.googleHint")}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card id="passkey-management" density="lg">
        <CardHeader className="block">
          <CardTitle>{t("passkeys.title")}</CardTitle>
          <CardDescription>{t("passkeys.description")}</CardDescription>
        </CardHeader>
        <CardContent className="gap-6">
          <FormSection title={t("passkeys.addTitle")} description={t("passkeys.addDescription")}>
            <div className="grid gap-4 lg:grid-cols-[minmax(16rem,24rem)_auto] lg:items-end">
              <Field label={t("passkeys.nameField")} reserveMessageSpace>
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
                  {t("passkeys.addDevice")}
                </Button>
                <Button
                  type="button"
                  variant="soft"
                  icon={KeyRound}
                  loading={pendingAction === "add-roaming-passkey"}
                  disabled={busy}
                  onClick={() => void addPasskey("cross-platform")}
                >
                  {t("passkeys.addSecurityKey")}
                </Button>
              </div>
            </div>
          </FormSection>

          <FormSection
            title={t("passkeys.registeredTitle")}
            description={t("passkeys.registeredDescription")}
          >
            {passkeys.length === 0 ? (
              <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-secondary/50 p-5 text-sm text-muted-foreground">
                {t("passkeys.emptyRegistered")}
              </div>
            ) : (
              <div className="grid gap-3">
                {passkeys.map((passkey) => {
                  const currentName = getEditedPasskeyName(passkeyNameEdits, passkey, t);
                  const changed = currentName.trim() !== getPasskeyLabel(passkey, t);

                  return (
                    <div
                      key={passkey.id}
                      className="grid gap-4 rounded-[var(--radius-lg)] border border-border bg-secondary/50 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                    >
                      <div className="grid gap-3 sm:grid-cols-[minmax(14rem,1fr)_auto] sm:items-center">
                        <Field label={t("passkeys.nameColumn")} reserveMessageSpace>
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
                          <PasskeyBadge label={formatDeviceType(passkey.deviceType, t)} />
                          {passkey.backedUp ? (
                            <PasskeyBadge label={t("passkeys.synced")} tone="success" />
                          ) : null}
                          {passkey.createdAt ? (
                            <PasskeyBadge label={formatDate(passkey.createdAt, locale)} />
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
                          {t("actions.save")}
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
                          {t("actions.remove")}
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
          <CardTitle>{t("totp.title")}</CardTitle>
          <CardDescription>{t("totp.description")}</CardDescription>
        </CardHeader>
        <CardContent className="gap-6">
          {twoFactor.lockedUntil ? (
            <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                {t("totp.lockedUntil", {
                  time: formatDateTime(twoFactor.lockedUntil, locale),
                })}
              </p>
            </div>
          ) : null}

          {twoFactor.failedVerificationCount > 0 && !twoFactor.lockedUntil ? (
            <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>{t("totp.failedAttempts", { count: twoFactor.failedVerificationCount })}</p>
            </div>
          ) : null}

          {user.passwordEnabled ? (
            <div className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-secondary/50 p-4">
              <Field label={t("totp.currentPassword")} hint={t("totp.currentPasswordHint")}>
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
                      {t("totp.enabledTitle")}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {t("totp.enabledDescription")}
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
                    {t("totp.newBackupCodes")}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    loading={pendingAction === "disable-totp"}
                    disabled={busy}
                    onClick={() => void disableTotp()}
                  >
                    {t("actions.disable")}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-secondary/50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-ui text-sm font-semibold text-foreground">
                  {t("totp.notEnabledTitle")}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t("totp.notEnabledDescription")}
                </p>
              </div>
              <Button
                type="button"
                icon={ShieldPlus}
                loading={pendingAction === "enable-totp"}
                disabled={busy}
                onClick={() => void beginTotpSetup()}
              >
                {t("totp.setUp")}
              </Button>
            </div>
          )}

          {totpSetup.status === "ready" ? (
            <div
              ref={totpSetupPanelRef}
              tabIndex={-1}
              className="grid scroll-mt-24 gap-5 rounded-[var(--radius-lg)] border border-border bg-secondary/50 p-4 outline-none"
            >
              <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
                <div className="grid content-start gap-2">
                  <div className="grid aspect-square place-items-center rounded-[var(--radius-md)] border border-border bg-white p-3 text-center shadow-sm">
                    {totpQrCodeDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- QR code is a generated data URL, not an optimizable remote/static image.
                      <img src={totpQrCodeDataUrl} alt={t("totp.qrAlt")} className="size-full" />
                    ) : (
                      <div className="grid justify-items-center gap-3 text-slate-700">
                        <QrCode className="size-10" aria-hidden="true" />
                        <p className="px-4 text-xs font-semibold">
                          {totpQrCodeError ? t("totp.qrUnavailable") : t("totp.generatingQr")}
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-center font-ui text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t("totp.scanQr")}
                  </p>
                </div>
                <div className="grid content-start gap-3">
                  <div>
                    <p className="font-ui text-sm font-semibold text-foreground">
                      {t("totp.scanTitle")}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {t("totp.scanDescription", { email: user.email })}
                    </p>
                  </div>
                  <div>
                    <p className="font-ui text-sm font-semibold text-foreground">
                      {t("totp.manualKeyTitle")}
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
                      onClick={() => void copyText(totpSecret, t("totp.manualKeyLabel"))}
                    >
                      {t("totp.copyKey")}
                    </Button>
                    <Button asChild type="button" variant="soft" size="sm" icon={ExternalLink}>
                      <a href={totpSetup.totpURI}>{t("totp.openInAuthenticator")}</a>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(16rem,22rem)_auto] lg:items-end">
                <Field label={t("totp.codeField")} hint={t("totp.codeHint")}>
                  {({ describedBy }) => (
                    <CodeInput
                      label={t("totp.codeInputLabel")}
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
                  {t("totp.verifyAndEnable")}
                </Button>
              </div>
            </div>
          ) : null}

          {backupCodes.length > 0 ? (
            <BackupCodesPanel
              codes={backupCodes}
              onCopy={(value) => copyText(value, t("backupCodes.copyLabel"))}
            />
          ) : null}
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">{t("totp.footer")}</p>
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
  const t = useTranslations("Settings");
  const allCodes = codes.join("\n");

  return (
    <div className="grid gap-3 rounded-[var(--radius-lg)] border border-warning/40 bg-warning/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-ui text-sm font-semibold text-foreground">{t("backupCodes.title")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t("backupCodes.description")}
          </p>
        </div>
        <Button
          type="button"
          variant="soft"
          size="sm"
          icon={Copy}
          onClick={() => void onCopy(allCodes)}
        >
          {t("backupCodes.copyAll")}
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

function getPasskeyLabel(passkey: PasskeyView, t: ReturnType<typeof useTranslations>) {
  return passkey.name?.trim() || formatDeviceType(passkey.deviceType, t);
}

function getEditedPasskeyName(
  edits: Record<string, string>,
  passkey: PasskeyView,
  t: ReturnType<typeof useTranslations>,
) {
  return edits[passkey.id] ?? getPasskeyLabel(passkey, t);
}

function formatDeviceType(deviceType: string, t: ReturnType<typeof useTranslations>) {
  if (!deviceType) return t("passkeys.deviceType.passkey");
  if (deviceType === "platform") return t("passkeys.deviceType.platform");
  if (deviceType === "cross-platform") return t("passkeys.deviceType.crossPlatform");

  return deviceType
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
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

function getAuthErrorMessage(
  error: { message?: string; code?: string } | null,
  fallback: string,
  t: ReturnType<typeof useTranslations>,
) {
  if (!error) return fallback;
  if (error.code === "INVALID_PASSWORD" || error.message === "Invalid password") {
    return t("errors.invalidPassword");
  }

  return error.message || error.code || fallback;
}
