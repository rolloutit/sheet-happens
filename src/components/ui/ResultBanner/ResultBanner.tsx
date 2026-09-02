import { X } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { resultBannerVariants } from "./ResultBanner.variants";
import type { ResultBannerProps } from "./ResultBanner.types";

/** An inline strip reporting the outcome of the last action — a save, a link, an archive. */
export function ResultBanner({
  tone,
  children,
  onDismiss,
  dismissLabel = "Dismiss",
  className,
}: ResultBannerProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        resultBannerVariants({ tone }),
        onDismiss && "flex items-start justify-between gap-3",
        className,
      )}
    >
      <span>{children}</span>
      {onDismiss ? (
        <button
          type="button"
          aria-label={dismissLabel}
          onClick={onDismiss}
          className="shrink-0 rounded-full text-current/70 transition hover:text-current"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
