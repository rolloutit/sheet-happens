"use client";

import { Paperclip } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/src/lib/utils";

export const SICK_NOTE_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

/**
 * A file input whose words are ours. The native control prints "Choose file" in the browser's
 * language, not the app's, so the input is visually hidden behind a label styled as a button.
 */
export function SickNoteFileInput({
  id,
  name = "file",
  describedBy,
  invalid,
  onFileChange,
}: {
  id: string;
  name?: string;
  describedBy?: string;
  invalid?: boolean;
  onFileChange?: (filename: string | null) => void;
}) {
  const t = useTranslations("Leave");
  const [filename, setFilename] = useState<string | null>(null);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <input
        id={id}
        name={name}
        type="file"
        accept={SICK_NOTE_ACCEPT}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className="peer sr-only"
        onChange={(event) => {
          const next = event.target.files?.[0]?.name ?? null;
          setFilename(next);
          onFileChange?.(next);
        }}
      />
      <label
        htmlFor={id}
        className={cn(
          "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-[var(--radius-pill)] border border-border-strong bg-secondary px-3 font-ui text-sm font-semibold text-secondary-foreground transition hover:bg-muted peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
          invalid && "border-destructive/60",
        )}
      >
        <Paperclip className="size-4" aria-hidden="true" />
        {t("form.chooseFile")}
      </label>
      <span className="min-w-0 truncate text-sm text-muted-foreground" aria-live="polite">
        {filename ?? t("form.noFile")}
      </span>
    </div>
  );
}
