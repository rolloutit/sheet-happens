"use client";

import {
  Activity,
  BarChart3,
  BadgeDollarSign,
  BookOpen,
  CalendarClock,
  CalendarDays,
  Clock3,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  ScrollText,
  Settings,
  Users,
  WalletCards,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
import { orgBranding } from "@/src/lib/branding";
import { useElapsedLabel } from "@/src/lib/use-elapsed-label";
import { cn } from "@/src/lib/utils";
import { setLocaleAction } from "@/src/i18n/actions";
import { Atmosphere } from "../Atmosphere";
import { BrandMark } from "../BrandMark";
import { CommandPill } from "../CommandPill";
import { LanguageToggle } from "../LanguageToggle";
import { MobileBottomBar } from "../MobileBottomBar";
import { NotificationButton } from "../NotificationButton";
import { RunningTimerPill } from "../RunningTimerPill";
import { useRunningTimer } from "../RunningTimerProvider";
import { ThemeToggle } from "../ThemeToggle";
import { UserMenu } from "../UserMenu";
import type { AppShellProps } from "./AppShell.types";

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
    id: "payslips",
    labelKey: "nav.payslips",
    icon: ReceiptText,
    group: "main",
    href: "/payslips",
    profiles: ["employee"],
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
  {
    id: "declared-hours",
    labelKey: "nav.declaredHours",
    icon: CalendarClock,
    group: "admin",
    href: "/admin/declared-hours",
  },
  {
    id: "payslips-admin",
    labelKey: "nav.payslips",
    icon: ReceiptText,
    group: "admin",
    href: "/admin/payslips",
  },
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
  const resolvedProfile = profile ?? inferProfileFromLegacyRole(role);
  const selectedLanguage = language ?? localLanguage;
  const [, startLanguageTransition] = useTransition();
  const [isStoppingLocalTimer, startStoppingTimerTransition] = useTransition();
  const [localTimerError, setLocalTimerError] = useState<string | null>(null);
  const shellTimer = useRunningTimer();

  /*
    The props win over the provider, not the other way round. The app leaves them undefined and the
    header sources the timer from the root layout on every route; stories and tests pass them
    directly to draw a specific state without standing up a provider. `null` is a deliberate
    "nothing running", so only `undefined` falls through to the context.
  */
  const resolvedTimer = timer !== undefined ? timer : shellTimer.timer;
  const usingLocalStop = Boolean(onStopTimer);
  const resolvedStopTimer = usingLocalStop ? handleStopTimer : shellTimer.stopTimer;
  const timerError = usingLocalStop ? localTimerError : shellTimer.error;
  const isStoppingTimer = usingLocalStop ? isStoppingLocalTimer : shellTimer.isStopping;
  const elapsedLabel = useElapsedLabel(resolvedTimer?.startedAt ?? null);

  function handleStopTimer() {
    if (!onStopTimer) return;

    startStoppingTimerTransition(async () => {
      const result = await onStopTimer();

      setLocalTimerError(result.status === "error" ? result.message : null);
      // Refreshed on the error path too — see RunningTimerProvider for why the daily-limit
      // discard makes that necessary rather than merely tidy.
      router.refresh();
    });
  }

  function dismissTimerError() {
    if (usingLocalStop) {
      setLocalTimerError(null);
      return;
    }

    shellTimer.dismissError();
  }

  const translatedUser = {
    ...user,
    role: translateUserRole(t, user.role),
  };
  const translatedUserActions =
    userActions ??
    ([
      { id: "my-rates", label: t("userMenu.myRates"), icon: BadgeDollarSign },
      { id: "settings", label: t("userMenu.profileAndSettings"), icon: Settings },
      {
        id: "sign-out",
        label: t("userMenu.signOut"),
        icon: LogOut,
        tone: "danger" as const,
        separated: true,
        confirm: {
          title: t("userMenu.signOutConfirm.title"),
          description: t("userMenu.signOutConfirm.description"),
          confirmLabel: t("userMenu.signOutConfirm.confirm"),
          cancelLabel: t("userMenu.signOutConfirm.cancel"),
          closeLabel: t("userMenu.signOutConfirm.close"),
        },
      },
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

    if (actionId === "settings") {
      window.location.href = "/settings";
      return;
    }

    if (actionId === "my-rates") {
      window.location.href = "/rates";
    }
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
                {orgBranding.name ?? t("brand.subtitle")}
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
              // Same active treatment as the main rail above, minus the rail itself — this row
              // sits in the footer group and has no gutter to hang one in.
              "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-subtle-foreground transition hover:bg-secondary hover:text-foreground aria-[current=page]:bg-accent-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent aria-[current=page]:shadow-[inset_0_0_0_1px_var(--accent-line)]",
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
              "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-medium text-subtle-foreground transition hover:bg-secondary hover:text-foreground",
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
          <div className="flex h-16 items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
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
                          {orgBranding.name ?? t("brand.subtitle")}
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
              <div className="min-w-0">
                <p
                  className="truncate font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-accent"
                  data-testid="app-shell-page-scope"
                >
                  {pageScope(current, role, t)}
                </p>
                {/* The shell owns the page's only `h1`: every route renders through here, so a
                    heading in the page body would either duplicate it or skip a level. Tailwind's
                    preflight strips heading margins and font sizing, so this is a semantic change
                    with no visual one. */}
                <h1 className="truncate text-lg font-semibold leading-tight">
                  {pageTitle(current, t)}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Outside the desktop-only cluster below: a running timer has to be visible and
                  stoppable at every width, not only where there is room for the command pill. */}
              <RunningTimerPill
                timer={resolvedTimer ?? null}
                elapsedLabel={elapsedLabel}
                error={timerError}
                disabled={isStoppingTimer}
                labels={{
                  open: t("timer.open"),
                  stop: t("timer.stop"),
                  running: t("timer.running"),
                  dismissError: t("timer.dismissError"),
                }}
                onOpen={() => router.push((resolvedTimer?.href ?? "/time") as Route)}
                onStop={resolvedStopTimer}
                onDismissError={dismissTimerError}
              />
              <div className="hidden items-center gap-3 md:flex">
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
              </div>
              <NotificationButton
                notifications={notifications}
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
                className="shrink-0"
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
                // The active row is the one piece of permanent mint on the screen, so it is worth
                // lighting properly: the tint carries a hairline of its own hue and the label
                // takes a soft glow, which is what separates "selected" from "hovered" at a
                // glance in a list where every row is the same shape.
                //
                // The label glow is dark-only. It is a blur of `--accent` behind text of
                // `--accent`, which on a near-black ground is light spilling off a bright glyph —
                // and on a pale cyan tint is a dark smudge behind a dark glyph. Light does not
                // need a substitute: the tint sits ΔE 0.057 off the sidebar, the hairline reads at
                // 1.86, and the rail is 4.95:1 against its ground, so "selected" is already
                // unmistakable there.
                "relative flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium text-subtle-foreground transition hover:bg-secondary hover:text-foreground aria-[current=page]:bg-accent-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent aria-[current=page]:shadow-[inset_0_0_0_1px_var(--accent-line)] dark:aria-[current=page]:[text-shadow:0_0_18px_color-mix(in_srgb,var(--accent)_55%,transparent)]",
                collapsed && "justify-center px-0",
              )}
              aria-label={collapsed ? t(item.labelKey) : undefined}
              title={collapsed ? t(item.labelKey) : undefined}
            >
              {active ? (
                // 2px wide rather than 0.5, and lit — at w-0.5 with no glow the rail was a hairline
                // the eye never found, so the tint was doing all the work on its own. The bloom is
                // dark-only for the same reason as the label glow above; in light the rail is a
                // dark stroke on a pale surface and already carries itself at 4.95:1.
                <span className="absolute -left-2 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-[linear-gradient(180deg,var(--accent),var(--primary))] dark:shadow-[0_0_12px_0_color-mix(in_srgb,var(--accent)_70%,transparent)]" />
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
  if (current === "my-rates") return t("userMenu.myRates");

  const item = navItems.find((navItem) => navItem.id === current);
  return item ? t(item.labelKey) : t("nav.dashboard");
}

function pageScope(current: string, role: AppShellRole, t: AppShellTranslator) {
  if (current === "my-rates") return t("scope.profile");

  const item = navItems.find((navItem) => navItem.id === current);

  if (item?.group === "admin") return t("roles.admin");

  if (item && "profiles" in item && item.profiles.length === 1) {
    return t(`roles.${item.profiles[0]}`);
  }

  if (item?.group === "main" || current === "help" || current === "settings") {
    return t("scope.all");
  }

  return t(`roles.${role}`);
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
