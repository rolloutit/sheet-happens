"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/src/components/ui/Button";

export type ConnectorUrlClientProps = {
  url: string;
};

/**
 * The connector URL plus the one control the whole recipe depends on: this address has to end up in
 * another app's input field, and a `break-all` monospace URL is not something to select by hand on a
 * phone. Client-side because `navigator.clipboard` is — the URL itself still comes from
 * `authUrls.mcpResource` on the server (see `ConnectorPanel`).
 *
 * The button's label stays put while the icon and a `role="status"` line carry the outcome: a button
 * whose accessible name flips to "Copied" stops being addressable by the name it is documented and
 * snapshotted under.
 */
export function ConnectorUrlClient({ url }: ConnectorUrlClientProps) {
  const t = useTranslations("Help.mcp");
  const [outcome, setOutcome] = useState<"idle" | "copied" | "failed">("idle");
  /** Cleared before each attempt so a second click is not reset by the first one's timer. */
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copyUrl() {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }

    try {
      await navigator.clipboard.writeText(url);
      setOutcome("copied");
      resetTimer.current = setTimeout(() => setOutcome("idle"), 4000);
    } catch {
      // Sticky on purpose: the message asks the reader to copy by hand, so it must not vanish.
      setOutcome("failed");
    }
  }

  return (
    <div className="grid gap-2">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <p className="break-all rounded-[var(--radius-md)] border border-border bg-background/55 px-3 py-2 font-mono text-sm text-foreground">
          {url}
        </p>
        <Button
          type="button"
          variant="soft"
          size="sm"
          icon={outcome === "copied" ? Check : Copy}
          className="justify-self-start"
          onClick={() => void copyUrl()}
        >
          {t("copyUrl")}
        </Button>
      </div>
      {/* Sized even when empty: the outcome must not shove the hint below it down the page. */}
      <p role="status" className="min-h-5 text-sm leading-5 text-muted-foreground">
        {outcome === "copied" ? t("urlCopied") : outcome === "failed" ? t("copyFailed") : null}
      </p>
    </div>
  );
}
