"use client";

import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Clock3,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  Users,
  WalletCards,
} from "lucide-react";
import { useState } from "react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/src/components/ui/Drawer";
import { authClient } from "@/src/lib/auth-client";
import { CommandPill } from "../CommandPill";
import { LanguageToggle } from "../LanguageToggle";
import { MobileBottomBar } from "../MobileBottomBar";
import { NotificationButton } from "../NotificationButton";
import { UserMenu } from "../UserMenu";
import type { AppShellProps } from "./AppShell.types";

const navItems = [
  { id: "dashboard", label: "Irányítópult", icon: LayoutDashboard, group: "main", href: "#" },
  { id: "time", label: "Időkövetés", icon: Clock3, group: "main", href: "#" },
  { id: "timesheets", label: "Timesheet", icon: CalendarDays, group: "main", href: "#" },
  { id: "review", label: "Jóváhagyás", icon: WalletCards, group: "admin", href: "#" },
  { id: "reports", label: "Riportok", icon: BarChart3, group: "admin", href: "#" },
  { id: "projects", label: "Projektek", icon: FolderKanban, group: "admin", href: "#" },
  { id: "people", label: "Emberek", icon: Users, group: "admin", href: "#" },
  { id: "rates", label: "Óradíjak", icon: WalletCards, group: "admin", href: "#" },
  { id: "info", label: "Információs oldal", icon: BookOpen, group: "admin", href: "#" },
] as const;

const defaultUser = {
  name: "Varga David",
  email: "david@example.com",
  role: "Admin",
  initials: "VD",
};

const defaultNotifications = [
  {
    id: "missing-hours",
    title: "Hiányzó pénteki órák",
    body: "Egy kontraktor timesheetje még nem teljes.",
    time: "2 perc",
    tone: "warning" as const,
  },
  {
    id: "invoice-review",
    title: "Új számla jóváhagyásra",
    body: "Apollo Migration számla vár ellenőrzésre.",
    time: "1 óra",
    tone: "info" as const,
    read: true,
  },
];

export function AppShell({
  children,
  current = "dashboard",
  role = "admin",
  collapsed = false,
  mobileNavigationMode = "auto",
  language,
  user = defaultUser,
  userActions,
  notifications = defaultNotifications,
  onNavigate,
  onCommand,
  onLanguageChange,
  onNotificationSelect,
  onMarkAllRead,
  onViewNotifications,
  onUserAction,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [localLanguage, setLocalLanguage] = useState(language ?? "hu");
  const selectedLanguage = language ?? localLanguage;

  function handleLanguageChange(nextLanguage: string) {
    if (language === undefined) setLocalLanguage(nextLanguage);
    onLanguageChange?.(nextLanguage);
  }

  function handleNavigate(itemId: string) {
    onNavigate?.(itemId);
  }

  async function handleUserAction(actionId: string) {
    if (onUserAction) {
      onUserAction(actionId);
      return;
    }

    if (actionId === "sign-out") {
      await authClient.signOut();
      window.location.href = "/";
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="hidden min-h-screen border-r border-border bg-[#0a1917] lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="grid size-10 place-items-center rounded-[var(--radius-md)] bg-accent text-sm font-bold text-accent-foreground shadow-soft">
            SH
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-base font-semibold leading-tight">Sheet Happens</p>
              <p className="font-ui text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Rollout IT · belső
              </p>
            </div>
          ) : null}
        </div>
        <nav className="flex-1 overflow-y-auto px-[18px] py-2" aria-label="Primary navigation">
          <NavGroup group="main" current={current} onNavigate={handleNavigate} />
          {role === "admin" ? (
            <>
              <p className="mx-3 mb-2 mt-5 font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Admin
              </p>
              <NavGroup group="admin" current={current} onNavigate={handleNavigate} />
            </>
          ) : null}
        </nav>
        <div className="grid gap-1 border-t border-border px-[18px] py-3">
          <a
            href="#"
            className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <HelpCircle className="size-[18px]" aria-hidden="true" />
            Súgó
          </a>
          <button
            type="button"
            className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <PanelLeftClose className="size-[18px]" aria-hidden="true" />
            Oldalsáv összecsukása
          </button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
                <DrawerTrigger asChild>
                  <button
                    type="button"
                    className={`grid size-9 place-items-center rounded-[var(--radius-md)] border border-border bg-card text-accent ${
                      mobileNavigationMode === "auto" ? "lg:hidden" : ""
                    }`}
                    aria-label="Navigáció megnyitása"
                  >
                    <Menu className="size-4" aria-hidden="true" />
                  </button>
                </DrawerTrigger>
                <DrawerContent
                  side="left"
                  className="w-[min(20rem,100vw)] border-border bg-[#0a1917] p-0"
                >
                  <DrawerHeader className="border-b border-border p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-[var(--radius-md)] bg-accent text-sm font-bold text-accent-foreground shadow-soft">
                        SH
                      </div>
                      <div className="min-w-0">
                        <DrawerTitle className="truncate text-base font-semibold leading-tight">
                          Sheet Happens
                        </DrawerTitle>
                        <DrawerDescription className="font-ui text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                          Rollout IT · belső
                        </DrawerDescription>
                      </div>
                    </div>
                  </DrawerHeader>
                  <nav
                    className="grid gap-1 overflow-y-auto px-[18px] py-4"
                    aria-label="Mobile navigation"
                  >
                    <NavGroup
                      group="main"
                      current={current}
                      onNavigate={(itemId) => {
                        handleNavigate(itemId);
                        setMobileOpen(false);
                      }}
                    />
                    {role === "admin" ? (
                      <>
                        <p className="mx-3 mb-2 mt-5 font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Admin
                        </p>
                        <NavGroup
                          group="admin"
                          current={current}
                          onNavigate={(itemId) => {
                            handleNavigate(itemId);
                            setMobileOpen(false);
                          }}
                        />
                      </>
                    ) : null}
                  </nav>
                </DrawerContent>
              </Drawer>
              <div>
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                  {role === "admin" ? "Mindenki" : "Kontraktor"}
                </p>
                <p className="text-lg font-semibold leading-tight">{pageTitle(current)}</p>
              </div>
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <CommandPill
                label="Ugrás bárhová..."
                shortcut="Cmd+K"
                status={onCommand ? undefined : "Hamarosan"}
                disabled={!onCommand}
                onClick={onCommand}
              />
              <LanguageToggle value={selectedLanguage} onValueChange={handleLanguageChange} />
              <NotificationButton
                notifications={notifications}
                onNotificationSelect={onNotificationSelect}
                onMarkAllRead={onMarkAllRead}
                onViewAll={onViewNotifications}
              />
              <UserMenu user={user} actions={userActions} onAction={handleUserAction} />
            </div>
          </div>
        </header>
        <main className="pb-20 lg:pb-0">{children}</main>
      </div>
      <MobileBottomBar
        current={current}
        items={bottomNavItems(role)}
        onNavigate={handleNavigate}
        className={mobileNavigationMode === "auto" ? "lg:hidden" : ""}
      />
    </div>
  );
}

function NavGroup({
  group,
  current,
  onNavigate,
}: {
  group: "main" | "admin";
  current: string;
  onNavigate?: (itemId: string) => void;
}) {
  return (
    <div className="grid gap-1">
      {navItems
        .filter((item) => item.group === group)
        .map((item) => {
          const active = item.id === current;
          return (
            <a
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                onNavigate?.(item.id);
              }}
              className="relative flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground aria-[current=page]:bg-accent/15 aria-[current=page]:font-semibold aria-[current=page]:text-accent"
            >
              {active ? (
                <span className="absolute -left-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded bg-accent" />
              ) : null}
              <item.icon className="size-[19px]" aria-hidden="true" />
              {item.label}
            </a>
          );
        })}
    </div>
  );
}

function pageTitle(current: string) {
  const item = navItems.find((navItem) => navItem.id === current);
  return item?.label ?? "Irányítópult";
}

function bottomNavItems(role: AppShellProps["role"]) {
  const baseItems = navItems.filter((item) => item.group === "main");
  const adminShortcut = navItems.find((item) => item.id === "reports");

  if (role === "admin" && adminShortcut) {
    return [...baseItems, adminShortcut];
  }

  return baseItems;
}
