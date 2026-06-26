"use client";

import { useId, useMemo, useRef, useState } from "react";

import { cn } from "@/src/lib/utils";
import type { CodeInputProps } from "./CodeInput.types";

function normalizeCode(value: string, length: number) {
  return value.replace(/\D/g, "").slice(0, length);
}

export function CodeInput({
  label,
  length = 6,
  value,
  defaultValue = "",
  onValueChange,
  disabled,
  invalid,
  id,
  className,
  "aria-describedby": ariaDescribedBy,
  ...props
}: CodeInputProps) {
  const generatedId = useId();
  const groupId = id ?? `code-input-${generatedId}`;
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [localValue, setLocalValue] = useState(() => normalizeCode(defaultValue, length));
  const resolvedValue = normalizeCode(value ?? localValue, length);
  const digits = useMemo(
    () => Array.from({ length }, (_, index) => resolvedValue[index] ?? ""),
    [length, resolvedValue],
  );

  function focusIndex(index: number) {
    const nextIndex = Math.max(0, Math.min(length - 1, index));
    window.requestAnimationFrame(() => inputRefs.current[nextIndex]?.focus());
  }

  function updateValue(nextDigits: string[], focusTarget?: number) {
    const nextValue = normalizeCode(nextDigits.join(""), length);
    if (value === undefined) setLocalValue(nextValue);
    onValueChange?.(nextValue);
    if (focusTarget !== undefined) focusIndex(focusTarget);
  }

  function updateDigit(index: number, nextDigit: string) {
    const normalized = normalizeCode(nextDigit, length);

    if (normalized.length > 1) {
      const nextDigits = [...digits];
      normalized.split("").forEach((digit, offset) => {
        const targetIndex = index + offset;
        if (targetIndex < length) nextDigits[targetIndex] = digit;
      });
      updateValue(nextDigits, Math.min(index + normalized.length, length) - 1);
      return;
    }

    const nextDigits = [...digits];
    nextDigits[index] = normalized;
    updateValue(nextDigits, nextDigit ? index + 1 : index);
  }

  return (
    <div
      id={groupId}
      role="group"
      aria-label={label}
      aria-describedby={ariaDescribedBy}
      data-invalid={invalid || undefined}
      className={cn("grid grid-cols-6 gap-2", className)}
      {...props}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            inputRefs.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          value={digit}
          disabled={disabled}
          aria-label={`${label} digit ${index + 1}`}
          aria-invalid={invalid || undefined}
          maxLength={1}
          onChange={(event) => updateDigit(index, event.target.value)}
          onPaste={(event) => {
            event.preventDefault();
            const pasted = normalizeCode(event.clipboardData.getData("text"), length);
            if (!pasted) return;
            const nextDigits = Array.from({ length }, (_, digitIndex) => pasted[digitIndex] ?? "");
            updateValue(nextDigits, Math.min(pasted.length, length) - 1);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              focusIndex(index - 1);
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              focusIndex(index + 1);
            }
            if (event.key === "Backspace" && !digits[index]) {
              event.preventDefault();
              const nextDigits = [...digits];
              nextDigits[Math.max(0, index - 1)] = "";
              updateValue(nextDigits, index - 1);
            }
          }}
          className="flex aspect-square min-h-10 w-full rounded-[var(--radius-md)] border border-input bg-background/50 text-center font-ui text-lg font-semibold text-foreground shadow-sm transition focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/30"
        />
      ))}
    </div>
  );
}
