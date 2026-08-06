"use client";

import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarDays,
  Clock3,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  Square,
  User,
  Users,
  WalletCards,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/src/components/ui/Drawer";
import { authClient } from "@/src/lib/auth-client";
import { cn } from "@/src/lib/utils";
import { setLocaleAction } from "@/src/i18n/actions";
import { Atmosphere } from "../Atmosphere";
import { BrandMark } from "../BrandMark";
import { CommandPill } from "../CommandPill";
import { LanguageToggle } from "../LanguageToggle";
import { MobileBottomBar } from "../MobileBottomBar";
import { NotificationButton } from "../NotificationButton";
import { ThemeToggle } from "../ThemeToggle";
import { UserMenu } from "../UserMenu";
import type { AppShellProps, AppShellTimer } from "./AppShell.types";

type AppShellTranslator = ReturnType<typeof useTranslations>;
type AppShellRole = NonNullable<AppShellProps["role"]>;
type AppShellProfile = NonNullable<AppShellProps["profile"]>;

const navItems = [
  {
    id: "dashboard",
    labelKey: "nav.dashboard",
    icon: LayoutDashboard,
    group: "main",
    href: "/dashboard",
  },
  { id: "time", labelKey: "nav.time", icon: Clock3, group: "main", href: "/time" },
  {
    id: "timesheets",
    labelKey: "nav.timesheets",
    icon: CalendarDays,
    group: "main",
    href: "/timesheets",
    profiles: ["contractor"],
  },
  {
    id: "review",
    labelKey: "nav.review",
    icon: WalletCards,
    group: "admin",
    href: "/admin/timesheets",
  },
  {
    id: "reports",
    labelKey: "nav.reports",
    icon: BarChart3,
    group: "admin",
    href: "/admin/reports",
  },
  {
    id: "projects",
    labelKey: "nav.projects",
    icon: FolderKanban,
    group: "admin",
    href: "/admin/projects",
  },
  { id: "people", labelKey: "nav.people", icon: Users, group: "admin", href: "/admin/people" },
  { id: "rates", labelKey: "nav.rates", icon: WalletCards, group: "admin", href: "/admin/rates" },
  { id: "audit", labelKey: "nav.audit", icon: ScrollText, group: "admin", href: "/admin/audit" },
  { id: "system", labelKey: "nav.system", icon: Activity, group: "admin", href: "/admin/system" },
  { id: "info", labelKey: "nav.info", icon: BookOpen, group: "admin", href: "/admin/info" },
] as const;

const defaultUser = {
  name: "Varga David",
  email: "david@example.com",
  role: "Admin",
  initials: "VD",
};

export function AppShell({
  children,
  current = "dashboard",
  role = "admin",
  profile,
  collapsed: initiallyCollapsed = false,
  mobileNavigationMode = "auto",
  language,
  user = defaultUser,
  userActions,
  notifications,
  timer,
  onStopTimer,
  onNavigate,
  onCommand,
  onLanguageChange,
  onNotificationSelect,
  onMarkAllRead,
  onViewNotifications,
  onUserAction,
}: AppShellProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("AppShell");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(initiallyCollapsed);
  const [localLanguage, setLocalLanguage] = useState(language ?? locale);
  const [timerNotice, setTimerNotice] = useState<string | null>(null);
  const resolvedProfile = profile ?? inferProfileFromLegacyRole(role);
  const selectedLanguage = language ?? localLanguage;
  const [isStoppingTimer, startStoppingTimerTransition] = useTransition();
  const [, startLanguageTransition] = useTransition();

  const resolvedNotifications = notifications ?? [
    {
      id: "missing-hours",
      title: t("notifications.missingHours.title"),
      body: t("notifications.missingHours.body"),
      time: t("notifications.missingHours.time"),
      tone: "warning" as const,
    },
    {
      id: "invoice-review",
      title: t("notifications.invoiceReview.title"),
      body: t("notifications.invoiceReview.body"),
      time: t("notifications.invoiceReview.time"),
      tone: "info" as const,
      read: true,
    },
  ];
  const translatedUser = {
    ...user,
    role: translateUserRole(t, user.role),
  };
  const translatedUserActions =
    userActions ??
    ([
      { id: "profile", label: t("userMenu.profile"), icon: User },
      { id: "settings", label: t("userMenu.settings"), icon: Settings },
      { id: "sign-out", label: t("userMenu.signOut"), icon: LogOut, tone: "danger" as const },
    ] satisfies NonNullable<AppShellProps["userActions"]>);

  function handleLanguageChange(nextLanguage: string) {
    if (language === undefined) setLocalLanguage(nextLanguage);
    onLanguageChange?.(nextLanguage);

    startLanguageTransition(async () => {
      const result = await setLocaleAction(nextLanguage);
      if (result.status === "success") {
        router.refresh();
      }
    });
  }

  function handleNavigate(itemId: string) {
    if (onNavigate) {
      onNavigate(itemId);
      return;
    }

    const item = navItems.find((navItem) => navItem.id === itemId);

    if (item) {
      window.location.href = item.href;
    }
  }

  async function handleUserAction(actionId: string) {
    if (onUserAction) {
      onUserAction(actionId);
      return;
    }

    if (actionId === "sign-out") {
      await authClient.signOut();
      window.location.href = "/login";
      return;
    }

    if (actionId === "settings" || actionId === "profile") {
      window.location.href = "/settings";
    }
  }

  function handleStopTimer() {
    if (!onStopTimer) return;

    startStoppingTimerTransition(async () => {
      const result = await onStopTimer();

      if (result.status === "error") {
        setTimerNotice(result.message);
        return;
      }

      setTimerNotice(null);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "sheet-canvas relative min-h-screen text-foreground lg:grid lg:h-screen lg:overflow-hidden",
        isCollapsed
          ? "lg:grid-cols-[var(--sidebar-w-collapsed)_1fr]"
          : "lg:grid-cols-[var(--sidebar-w)_1fr]",
      )}
    >
      <Atmosphere />
      <aside className="relative z-[2] hidden min-h-screen border-r border-sidebar-border bg-sidebar lg:flex lg:h-screen lg:flex-col lg:overflow-hidden">
        <div
          className={cn("flex h-16 items-center gap-3 px-4", isCollapsed && "justify-center px-3")}
        >
          <BrandMark />
          {!isCollapsed ? (
            <div className="min-w-0">
              <p className="truncate text-base font-semibold leading-tight">Sheet Happens</p>
              <p className="font-ui text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {t("brand.subtitle")}
              </p>
            </div>
          ) : null}
        </div>
        <nav
          className={cn("flex-1 overflow-y-auto py-2", isCollapsed ? "px-3" : "px-[18px]")}
          aria-label={t("primaryNavigation")}
        >
          <NavGroup
            group="main"
            role={role}
            profile={resolvedProfile}
            current={current}
            collapsed={isCollapsed}
            onNavigate={handleNavigate}
            t={t}
          />
          {role === "admin" ? (
            <>
              {!isCollapsed ? (
                <p className="mx-3 mb-2 mt-5 font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Admin
                </p>
              ) : null}
              <NavGroup
                group="admin"
                role={role}
                profile={resolvedProfile}
                current={current}
                collapsed={isCollapsed}
                onNavigate={handleNavigate}
                t={t}
              />
            </>
          ) : null}
        </nav>
        <div
          className={cn(
            "grid gap-1 border-t border-border py-3",
            isCollapsed ? "px-3" : "px-[18px]",
          )}
        >
          <a
            href="/help"
            className={cn(
              "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground aria-[current=page]:bg-accent-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent",
              isCollapsed && "justify-center px-0",
            )}
            aria-current={current === "help" ? "page" : undefined}
            aria-label={isCollapsed ? t("help") : undefined}
            title={isCollapsed ? t("help") : undefined}
          >
            <HelpCircle className="size-[18px]" aria-hidden="true" />
            {!isCollapsed ? t("help") : null}
          </a>
          <button
            type="button"
            className={cn(
              "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground",
              isCollapsed && "justify-center px-0",
            )}
            aria-label={isCollapsed ? t("expandSidebar") : t("collapseSidebar")}
            title={isCollapsed ? t("expandSidebar") : undefined}
            onClick={() => setIsCollapsed((currentCollapsed) => !currentCollapsed)}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="size-[18px]" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-[18px]" aria-hidden="true" />
            )}
            {!isCollapsed ? t("collapseSidebar") : null}
          </button>
        </div>
      </aside>
      <div className="relative z-[2] min-w-0 lg:h-screen lg:overflow-y-auto">
        <header className="sticky top-0 z-20 border-b border-border bg-header backdrop-blur-[14px]">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
                <DrawerTrigger asChild>
                  <button
                    type="button"
                    className={`grid size-9 place-items-center rounded-[var(--radius-md)] border border-border bg-card text-accent ${
                      mobileNavigationMode === "auto" ? "lg:hidden" : ""
                    }`}
                    aria-label={t("openNavigation")}
                  >
                    <Menu className="size-4" aria-hidden="true" />
                  </button>
                </DrawerTrigger>
                <DrawerContent
                  side="left"
                  className="flex w-[min(20rem,100vw)] flex-col border-border bg-sidebar p-0"
                >
                  <DrawerHeader className="border-b border-border p-4">
                    <div className="flex items-center gap-3">
                      <BrandMark />
                      <div className="min-w-0">
                        <DrawerTitle className="truncate text-base font-semibold leading-tight">
                          Sheet Happens
                        </DrawerTitle>
                        <DrawerDescription className="font-ui text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                          {t("brand.subtitle")}
                        </DrawerDescription>
                      </div>
                    </div>
                  </DrawerHeader>
                  <nav
                    className="grid flex-1 auto-rows-min gap-1 overflow-y-auto px-[18px] py-4"
                    aria-label={t("mobileNavigation")}
                  >
                    <NavGroup
                      group="main"
                      role={role}
                      profile={resolvedProfile}
                      current={current}
                      t={t}
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
                          role={role}
                          profile={resolvedProfile}
                          current={current}
                          t={t}
                          onNavigate={(itemId) => {
                            handleNavigate(itemId);
                            setMobileOpen(false);
                          }}
                        />
                      </>
                    ) : null}
                  </nav>
                  {/* The header control cluster is desktop-only, so the drawer is where mobile
                      reaches language and theme. */}
                  <DrawerFooter className="items-center justify-between border-t border-border p-4">
                    <LanguageToggle
                      value={selectedLanguage}
                      label={t("language")}
                      onValueChange={handleLanguageChange}
                    />
                    <ThemeToggle />
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
              <div>
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                  {role === "admin" ? t("scope.all") : t(`roles.${role}`)}
                </p>
                <p className="text-lg font-semibold leading-tight">{pageTitle(current, t)}</p>
              </div>
            </div>
            <div className="hidden items-center gap-3 md:flex">
              {timer ? (
                <HeaderTimerPill
                  timer={timer}
                  disabled={!onStopTimer || isStoppingTimer}
                  error={timerNotice}
                  stopLabel={t("timer.stop")}
                  onOpen={() => {
                    window.location.href = timer.href ?? "/time";
                  }}
                  onStop={handleStopTimer}
                />
              ) : null}
              <CommandPill
                label={t("command.label")}
                shortcut="Cmd+K"
                status={onCommand ? undefined : t("soon")}
                disabled={!onCommand}
                onClick={onCommand}
              />
              <LanguageToggle
                value={selectedLanguage}
                label={t("language")}
                onValueChange={handleLanguageChange}
              />
              <ThemeToggle />
              <NotificationButton
                notifications={resolvedNotifications}
                labels={{
                  trigger: t("notifications.trigger"),
                  menu: t("notifications.menu"),
                  markAllRead: t("notifications.markAllRead"),
                  empty: t("notifications.empty"),
                  viewAll: t("notifications.viewAll"),
                }}
                onNotificationSelect={onNotificationSelect}
                onMarkAllRead={onMarkAllRead}
                onViewAll={onViewNotifications}
              />
              <UserMenu
                user={translatedUser}
                actions={translatedUserActions}
                label={t("userMenu.label")}
                onAction={handleUserAction}
              />
            </div>
          </div>
        </header>
        <main className="pb-20 lg:pb-0">{children}</main>
      </div>
      <MobileBottomBar
        current={current}
        items={bottomNavItems(role, resolvedProfile).map((item) => ({
          ...item,
          label: t(item.labelKey),
        }))}
        label={t("mobileNavigation")}
        onNavigate={handleNavigate}
        className={mobileNavigationMode === "auto" ? "lg:hidden" : ""}
      />
    </div>
  );
}

function HeaderTimerPill({
  timer,
  disabled,
  error,
  stopLabel,
  onOpen,
  onStop,
}: {
  timer: AppShellTimer;
  disabled: boolean;
  error: string | null;
  stopLabel: string;
  onOpen: () => void;
  onStop: () => void;
}) {
  const elapsed = useElapsedLabel(timer.startedAt);

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex max-w-[15rem] items-center gap-2 rounded-[var(--radius-pill)] border border-accent-line bg-accent-soft px-3 py-1.5 text-sm text-foreground shadow-soft transition hover:bg-accent/25"
        title={timer.description || timer.projectName}
        onClick={onOpen}
      >
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-45" />
          <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
        </span>
        <span className="font-ui text-[12px] font-bold text-accent">{elapsed}</span>
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: timer.projectColor }}
          aria-hidden="true"
        />
        <span className="truncate text-xs font-medium">{timer.projectName}</span>
      </button>
      <button
        type="button"
        className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border border-destructive/40 bg-card text-destructive shadow-soft transition hover:bg-destructive-soft disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={stopLabel}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onStop();
        }}
      >
        <Square className="size-2.5 fill-current" aria-hidden="true" />
      </button>
      {error ? (
        <span className="absolute right-0 top-[calc(100%+0.35rem)] w-56 rounded-[var(--radius-sm)] border border-destructive/35 bg-card px-2 py-1 text-xs font-medium text-destructive shadow-panel">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function useElapsedLabel(startedAt: string) {
  const nowSeconds = useClientClock();

  if (nowSeconds === null) return "0:00";

  return formatElapsed(Math.max(0, nowSeconds * 1000 - Date.parse(startedAt)));
}

function useClientClock() {
  return useSyncExternalStore(subscribeToClock, getClockSnapshot, getServerClockSnapshot);
}

function subscribeToClock(onStoreChange: () => void) {
  const timerId = window.setInterval(onStoreChange, 1000);
  return () => window.clearInterval(timerId);
}

function getClockSnapshot() {
  return Math.floor(Date.now() / 1000);
}

function getServerClockSnapshot() {
  return null;
}

function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function NavGroup({
  group,
  role,
  profile,
  current,
  collapsed,
  onNavigate,
  t,
}: {
  group: "main" | "admin";
  role: AppShellProps["role"];
  profile: AppShellProfile;
  current: string;
  collapsed?: boolean;
  onNavigate?: (itemId: string) => void;
  t: AppShellTranslator;
}) {
  return (
    <div className="grid gap-1">
      {navItems
        .filter((item) => item.group === group)
        .filter((item) =>
          isNavItemVisibleForAccess(item, {
            role: role ?? "employee",
            profile,
          }),
        )
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
              className={cn(
                "relative flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground aria-[current=page]:bg-accent-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent",
                collapsed && "justify-center px-0",
              )}
              aria-label={collapsed ? t(item.labelKey) : undefined}
              title={collapsed ? t(item.labelKey) : undefined}
            >
              {active ? (
                <span className="absolute -left-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded bg-accent" />
              ) : null}
              <item.icon className="size-[19px]" aria-hidden="true" />
              {!collapsed ? t(item.labelKey) : null}
            </a>
          );
        })}
    </div>
  );
}

function pageTitle(current: string, t: AppShellTranslator) {
  if (current === "help") return t("help");
  if (current === "settings") return t("nav.settings");

  const item = navItems.find((navItem) => navItem.id === current);
  return item ? t(item.labelKey) : t("nav.dashboard");
}

function bottomNavItems(role: AppShellProps["role"], profile: AppShellProfile) {
  const resolvedRole = role ?? "employee";
  const baseItems = navItems
    .filter((item) => item.group === "main")
    .filter((item) =>
      isNavItemVisibleForAccess(item, {
        role: resolvedRole,
        profile,
      }),
    );
  const adminShortcut = navItems.find((item) => item.id === "reports");

  if (role === "admin" && adminShortcut) {
    return [...baseItems, adminShortcut];
  }

  return baseItems;
}

function isNavItemVisibleForAccess(
  item: (typeof navItems)[number],
  access: {
    role: AppShellRole;
    profile: AppShellProfile;
  },
) {
  const roleAllowed =
    !("roles" in item) || (item.roles as readonly AppShellRole[]).includes(access.role);
  const profileAllowed =
    !("profiles" in item) || (item.profiles as readonly AppShellProfile[]).includes(access.profile);

  return roleAllowed && profileAllowed;
}

function inferProfileFromLegacyRole(role: AppShellProps["role"]): AppShellProfile {
  return role === "contractor" ? "contractor" : "employee";
}

function translateUserRole(t: AppShellTranslator, role: string | undefined) {
  if (!role) return role;
  if (role === "Admin") return t("userRoles.admin");
  if (role === "Member") return t("userRoles.member");
  return role;
}
