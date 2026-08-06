"use client";

import { FileUp, UploadCloud } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/src/lib/utils";
import type { DropzoneProps } from "./Dropzone.types";

function fileMatchesAccept(file: File, accept?: string) {
  if (!accept) return true;

  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();
  const rules = accept
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);

  if (rules.length === 0) return true;

  return rules.some((rule) => {
    if (rule.startsWith(".")) return fileName.endsWith(rule);
    if (rule.endsWith("/*")) return fileType.startsWith(rule.slice(0, -1));
    return fileType === rule;
  });
}

export function Dropzone({
  label,
  description,
  browseLabel,
  accept,
  multiple,
  disabled,
  files = [],
  error,
  statusLabels,
  onFilesSelected,
  onFilesRejected,
  className,
  ...props
}: DropzoneProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  const [dragging, setDragging] = useState(false);
  const resolvedStatusLabels = {
    ready: "Ready",
    uploading: "Uploading",
    done: "Done",
    error: "Error",
    ...statusLabels,
  };

  function handleIncomingFiles(fileList: FileList | File[]) {
    const incomingFiles = Array.from(fileList);
    const acceptedByType = incomingFiles.filter((file) => fileMatchesAccept(file, accept));
    const rejectedByType = incomingFiles.filter((file) => !fileMatchesAccept(file, accept));
    const acceptedFiles = multiple ? acceptedByType : acceptedByType.slice(0, 1);
    const rejectedFiles = multiple
      ? rejectedByType
      : [...rejectedByType, ...acceptedByType.slice(1)];

    if (acceptedFiles.length > 0) onFilesSelected?.(acceptedFiles);
    if (rejectedFiles.length > 0) onFilesRejected?.(rejectedFiles);
  }

  return (
    <div className={cn("grid gap-3", className)} {...props}>
      <label
        htmlFor={id}
        aria-disabled={disabled || undefined}
        data-dragging={dragging || undefined}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) handleIncomingFiles(event.dataTransfer.files);
        }}
        className={cn(
          "grid min-h-36 cursor-pointer place-items-center rounded-[var(--radius-lg)] border border-dashed border-primary/35 bg-accent-soft p-6 text-center transition hover:bg-accent-soft",
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
          aria-describedby={describedBy}
          aria-invalid={Boolean(error) || undefined}
          className="sr-only"
          onChange={(event) => {
            handleIncomingFiles(event.target.files ?? []);
            event.target.value = "";
          }}
        />
        <span className="grid justify-items-center gap-2">
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent">
            <UploadCloud className="size-5" aria-hidden="true" />
          </span>
          <span className="font-ui text-sm font-semibold text-foreground">{label}</span>
          {description ? (
            <span id={descriptionId} className="max-w-sm text-sm text-muted-foreground">
              {description}
            </span>
          ) : null}
          {browseLabel ? (
            <span className="font-ui text-xs font-semibold">{browseLabel}</span>
          ) : null}
        </span>
      </label>
      {error ? (
        <p id={errorId} className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {files.length > 0 ? (
        <div className="grid gap-2" role="list" aria-label={`${label} files`}>
          {files.map((file) => (
            <div
              key={file.id}
              role="listitem"
              className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-card p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileUp className="size-4 shrink-0 text-accent" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{file.sizeLabel}</p>
                </div>
              </div>
              <div className="grid justify-items-end gap-1">
                <span
                  className="font-ui text-xs font-semibold text-muted-foreground"
                  aria-live="polite"
                >
                  {resolvedStatusLabels[file.status ?? "ready"]}
                </span>
                {file.status === "uploading" && typeof file.progress === "number" ? (
                  <span
                    role="progressbar"
                    aria-label={`${file.name} upload progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={file.progress}
                    className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary"
                  >
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${file.progress}%` }}
                    />
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
