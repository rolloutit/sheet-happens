"use client";

import type { Route } from "next";
import Link from "next/link";
import { BookOpen, Plug, Unplug } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { EmptyState } from "@/src/components/sheet/EmptyState";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import { ListRow } from "@/src/components/ui/ListRow";
import { ResultBanner } from "@/src/components/ui/ResultBanner";
import { formatTimestamp } from "@/src/lib/formatting";
import { disconnectConnectedAppAction } from "./actions";
import type { SecuritySettingsActionState } from "./actions.types";

export type ConnectedAppView = {
  clientId: string;
  displayName: string;
  /** ISO instant, formatted here so it lands in the reader's own zone rather than the server's. */
  connectedAt: string;
  /** `CONSENT_SCOPE_GROUPS` ids, so a row names the access in the same words `/consent` used. */
  scopeGroupIds: readonly string[];
};

export type ConnectedAppsClientProps = {
  connections: readonly ConnectedAppView[];
};

/**
 * "Which apps can act as me", and the one control that ends it.
 *
 * Connecting is not offered here on purpose: an authorization request can only start in the client
 * (Claude), which is what the empty state says and what the Help page spells out.
 */
export function ConnectedAppsClient({ connections }: ConnectedAppsClientProps) {
  const t = useTranslations("Settings.connectedApps");
  /*
   * The scope wording comes from the `Consent` namespace rather than a second set of sentences: a
   * member should recognise here, word for word, what they approved on `/consent`. `Consent.scopes`
   * is keyed by `CONSENT_SCOPE_GROUPS` id, which is what the page hands down.
   */
  const consentT = useTranslations("Consent");
  const locale = useLocale();
  const router = useRouter();
  const [result, setResult] = useState<SecuritySettingsActionState | null>(null);
  const [confirmingClientId, setConfirmingClientId] = useState<string | null>(null);
  const [pendingClientId, setPendingClientId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  /*
   * Derived from the live prop, not stored: `connections` is replaced by the `router.refresh()`
   * below, and a snapshot would leave the dialog naming a grant that is already gone.
   */
  const confirming =
    connections.find((connection) => connection.clientId === confirmingClientId) ?? null;

  function disconnect(connection: ConnectedAppView) {
    setPendingClientId(connection.clientId);
    setResult(null);

    startTransition(async () => {
      const state = await disconnectConnectedAppAction({ clientId: connection.clientId });

      setPendingClientId(null);
      setConfirmingClientId(null);
      setResult(state);

      if (state.status === "success") {
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-4">
      {result ? (
        <ResultBanner tone={result.status === "error" ? "error" : "success"}>
          {result.message}
        </ResultBanner>
      ) : null}

      {connections.length === 0 ? (
        <EmptyState
          icon={Plug}
          title={t("empty.title")}
          body={t("empty.body")}
          /*
           * The body sends the reader to the Help page, which is where the connector URL and the
           * per-surface recipe live. Naming that page without linking it left the one screen a
           * curious member lands on first as a dead end.
           */
          action={
            <Button asChild variant="soft" icon={BookOpen}>
              <Link href={"/help?tab=connector" as Route}>{t("empty.openHelp")}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ul className="grid gap-3">
            {connections.map((connection) => (
              <li key={connection.clientId}>
                <ListRow
                  title={connection.displayName}
                  meta={
                    <div className="grid gap-2">
                      <p>
                        {t("connectedOn", {
                          date: formatTimestamp(connection.connectedAt, locale),
                        })}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase text-muted-foreground">
                          {t("scopesLabel")}
                        </span>
                        {connection.scopeGroupIds.map((groupId) => (
                          <Badge key={groupId} tone="neutral">
                            {consentT(`scopes.${groupId}.title`)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  }
                  trailing={
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      icon={Unplug}
                      // One "Disconnect" per row is ambiguous to a screen reader and to an aria
                      // snapshot; the app's name is what makes each button addressable.
                      aria-label={t("disconnectApp", { app: connection.displayName })}
                      loading={pendingClientId === connection.clientId}
                      disabled={pendingClientId !== null}
                      onClick={() => setConfirmingClientId(connection.clientId)}
                    >
                      {t("disconnect")}
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">{t("keepsActingNote")}</p>
        </>
      )}

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmingClientId(null);
        }}
      >
        <DialogContent closeLabel={t("dialog.cancel")}>
          <DialogHeader>
            <DialogTitle>{t("dialog.title")}</DialogTitle>
            <DialogDescription>
              {confirming ? t("dialog.body", { app: confirming.displayName }) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={pendingClientId !== null}>
                {t("dialog.cancel")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="danger"
              icon={Unplug}
              loading={pendingClientId !== null}
              onClick={() => {
                if (confirming) disconnect(confirming);
              }}
            >
              {t("dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
