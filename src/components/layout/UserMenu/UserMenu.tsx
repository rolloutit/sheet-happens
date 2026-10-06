"use client";

import { BadgeDollarSign, ChevronDown, LogOut, Settings } from "lucide-react";
import { Fragment, useState } from "react";

import { Avatar } from "@/src/components/ui/Avatar";
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
  { id: "my-rates", label: "My rates", icon: BadgeDollarSign },
  { id: "settings", label: "Profile and settings", icon: Settings },
  {
    id: "sign-out",
    label: "Sign out",
    icon: LogOut,
    tone: "danger",
    separated: true,
    confirm: {
      title: "Sign out?",
      description:
        "You will be signed out on this device and sent back to the login screen. Anything already saved stays where it is.",
      confirmLabel: "Sign out",
      cancelLabel: "Stay signed in",
      closeLabel: "Close",
    },
  },
];

export function UserMenu({
  user,
  actions = defaultActions,
  label = "User menu",
  align = "end",
  className,
  onAction,
}: UserMenuProps) {
  /*
    The dialog lives outside the dropdown: Radix closes the menu on select, so a confirmation
    nested in it would unmount with the menu. Holding the whole action rather than its id keeps
    the dialog's copy and icon derivable without a second lookup.
  */
  const [pendingAction, setPendingAction] = useState<UserMenuAction | null>(null);
  const pendingConfirm = pendingAction?.confirm;
  const PendingIcon = pendingAction?.icon;

  function selectAction(action: UserMenuAction) {
    if (action.confirm) {
      setPendingAction(action);
      return;
    }

    onAction?.(action.id);
  }

  return (
    <>
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
          {actions.map((action, index) => {
            const Icon = action.icon;

            return (
              <Fragment key={action.id}>
                {action.separated && index > 0 ? <DropdownSeparator className="my-2" /> : null}
                <DropdownItem
                  disabled={action.disabled}
                  tone={action.tone === "danger" ? "danger" : "default"}
                  onSelect={() => selectAction(action)}
                >
                  {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
                  {action.label}
                </DropdownItem>
              </Fragment>
            );
          })}
        </DropdownContent>
      </Dropdown>
      {pendingAction && pendingConfirm ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setPendingAction(null);
          }}
        >
          <DialogContent className="max-w-md" closeLabel={pendingConfirm.closeLabel}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                {PendingIcon ? (
                  <PendingIcon
                    className={cn(
                      "size-4",
                      pendingAction.tone === "danger" ? "text-destructive" : "text-accent",
                    )}
                    aria-hidden="true"
                  />
                ) : null}
                <DialogTitle>{pendingConfirm.title}</DialogTitle>
              </div>
              <DialogDescription>{pendingConfirm.description}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  {pendingConfirm.cancelLabel}
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant={pendingAction.tone === "danger" ? "danger" : "primary"}
                  icon={PendingIcon}
                  onClick={() => onAction?.(pendingAction.id)}
                >
                  {pendingConfirm.confirmLabel}
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
