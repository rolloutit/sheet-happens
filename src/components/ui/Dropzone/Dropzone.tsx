"use client";

import { FileUp, UploadCloud } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/src/lib/utils";
import type { DropzoneProps } from "./Dropzone.types";

export function Dropzone({
  label,
  description,
  accept,
  multiple,
  disabled,
  files = [],
  error,
  onFilesSelected,
  className,
  ...props
}: DropzoneProps) {
  const id = useId();
  const [dragging, setDragging] = useState(false);

  return (
    <div className={cn("grid gap-3", className)} {...props}>
      <label
        htmlFor={id}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) onFilesSelected?.(Array.from(event.dataTransfer.files));
        }}
        className={cn(
          "grid min-h-36 cursor-pointer place-items-center rounded-[var(--radius-lg)] border border-dashed border-primary/35 bg-primary/8 p-6 text-center transition hover:bg-primary/12",
          dragging && "border-cta bg-cta/10",
          disabled && "cursor-not-allowed border-border bg-secondary opacity-60",
        )}
      >
        <input
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => onFilesSelected?.(Array.from(event.target.files ?? []))}
        />
        <span className="grid justify-items-center gap-2">
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-primary/18 text-accent">
            <UploadCloud className="size-5" aria-hidden="true" />
          </span>
          <span className="font-ui text-sm font-semibold text-foreground">{label}</span>
          {description ? (
            <span className="max-w-sm text-sm text-muted-foreground">{description}</span>
          ) : null}
        </span>
      </label>
      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {files.length > 0 ? (
        <div className="grid gap-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-card p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileUp className="size-4 shrink-0 text-accent" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{file.sizeLabel}</p>
                </div>
              </div>
              <span className="font-ui text-xs font-semibold text-muted-foreground">
                {file.status ?? "ready"}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
