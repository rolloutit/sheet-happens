"use client";

import { ChevronDown, LogOut, Settings, User } from "lucide-react";

import { Avatar } from "@/src/components/ui/Avatar";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/src/components/ui/Dropdown";
import { cn } from "@/src/lib/utils";
import type { UserMenuAction, UserMenuProps } from "./UserMenu.types";

const defaultActions: UserMenuAction[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "sign-out", label: "Sign out", icon: LogOut, tone: "danger" },
];

export function UserMenu({
  user,
  actions = defaultActions,
  label = "User menu",
  align = "end",
  className,
  onAction,
}: UserMenuProps) {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex items-center gap-3 rounded-[var(--radius-pill)] p-1 pr-2 transition hover:bg-secondary",
            className,
          )}
        >
          <Avatar name={user.name} initials={user.initials} src={user.avatarSrc} size="sm" />
          <span className="hidden min-w-0 text-left lg:block">
            <span className="block truncate text-sm font-semibold">{user.name}</span>
            {user.role ? (
              <span className="block truncate text-xs text-muted-foreground">{user.role}</span>
            ) : null}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownTrigger>
      <DropdownContent align={align} className="w-64">
        <DropdownLabel>
          <span className="block normal-case text-foreground">{user.name}</span>
          {user.email ? (
            <span className="block truncate normal-case text-muted-foreground">{user.email}</span>
          ) : null}
        </DropdownLabel>
        <DropdownSeparator />
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <DropdownItem
              key={action.id}
              disabled={action.disabled}
              tone={action.tone === "danger" ? "danger" : "default"}
              onSelect={() => onAction?.(action.id)}
            >
              {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
              {action.label}
            </DropdownItem>
          );
        })}
      </DropdownContent>
    </Dropdown>
  );
}
