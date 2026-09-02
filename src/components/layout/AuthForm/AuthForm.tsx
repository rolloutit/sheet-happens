"use client";

import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { useState } from "react";

import { cn } from "@/src/lib/utils";
import type {
  AuthButtonProps,
  AuthFieldProps,
  AuthInputProps,
  AuthNoticeProps,
  AuthPasswordInputProps,
  AuthScreenHeadProps,
} from "./AuthForm.types";

export function AuthScreenHead({ description, eyebrow, title }: AuthScreenHeadProps) {
  return (
    <div className="mb-[22px]">
      {eyebrow ? (
        <p className="mb-2.5 font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="m-0 font-ui text-[28px] font-semibold leading-[1.1] text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-[15px] leading-[1.5] text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function AuthField({ children, htmlFor, label, right }: AuthFieldProps) {
  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-center justify-between gap-3">
        <label
          className="font-ui text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
          htmlFor={htmlFor}
        >
          {label}
        </label>
        {right}
      </div>
      {children}
    </div>
  );
}

export function AuthInput({ icon: Icon, trailing, className, ...props }: AuthInputProps) {
  return (
    <span className="flex items-center gap-2 rounded-[var(--radius-md)] border border-input bg-card px-3.5 transition focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <input
        data-auth-input
        className={cn(
          "min-h-12 flex-1 border-0 bg-transparent py-3 text-[14.5px] text-foreground outline-none placeholder:text-subtle-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </span>
  );
}

export function AuthPasswordInput({ labels, ...props }: AuthPasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <AuthInput
      {...props}
      icon={Lock}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          className="text-muted-foreground transition hover:text-foreground"
          aria-label={visible ? labels.hide : labels.show}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? (
            <EyeOff className="size-[17px]" aria-hidden="true" />
          ) : (
            <Eye className="size-[17px]" aria-hidden="true" />
          )}
        </button>
      }
    />
  );
}

export function AuthButton({
  children,
  className,
  disabled,
  icon,
  loading,
  trailing,
  variant,
  ...props
}: AuthButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex w-full items-center justify-center gap-2.5 rounded-[var(--radius-md)] px-[18px] py-[13px] text-[14.5px] font-semibold transition active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45",
        variant === "hero" &&
          "bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-accent-foreground shadow-accent-glow hover:shadow-[0_14px_32px_-10px_var(--accent-line)]",
        variant === "outline" && "border border-input bg-card text-foreground hover:bg-secondary",
        variant === "ghost" && "bg-transparent text-muted-foreground hover:text-foreground",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
      {trailing ? <span className="ml-auto">{trailing}</span> : null}
    </button>
  );
}

export function AuthNotice({ children, className, tone }: AuthNoticeProps) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[var(--radius-md)] border px-3 py-2 text-sm",
        tone === "success" && "border-success/40 bg-success-soft text-success",
        tone === "error" && "border-destructive/45 bg-destructive-soft text-destructive-bright",
        tone === "info" && "border-accent/40 bg-accent-soft text-accent",
        tone === "warning" && "border-warning/40 bg-warning-soft text-warning",
        className,
      )}
    >
      {children}
    </p>
  );
}
