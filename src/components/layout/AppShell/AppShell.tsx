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
  Settings,
  Users,
  WalletCards,
} from "lucide-react";

import type { AppShellProps } from "./AppShell.types";

const navItems = [
  { id: "dashboard", label: "Irányítópult", icon: LayoutDashboard, group: "main" },
  { id: "time", label: "Időkövetés", icon: Clock3, group: "main" },
  { id: "timesheets", label: "Timesheet", icon: CalendarDays, group: "main" },
  { id: "review", label: "Jóváhagyás", icon: WalletCards, group: "admin" },
  { id: "reports", label: "Riportok", icon: BarChart3, group: "admin" },
  { id: "projects", label: "Projektek", icon: FolderKanban, group: "admin" },
  { id: "people", label: "Emberek", icon: Users, group: "admin" },
  { id: "rates", label: "Óradíjak", icon: WalletCards, group: "admin" },
  { id: "info", label: "Információs oldal", icon: BookOpen, group: "admin" },
];

export function AppShell({
  children,
  current = "dashboard",
  role = "admin",
  collapsed = false,
}: AppShellProps) {
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
          <NavGroup group="main" current={current} />
          {role === "admin" ? (
            <>
              <p className="mx-3 mb-2 mt-5 font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Admin
              </p>
              <NavGroup group="admin" current={current} />
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
              <button
                type="button"
                className="grid size-9 place-items-center rounded-[var(--radius-md)] border border-border bg-card text-accent lg:hidden"
                aria-label="Navigáció megnyitása"
              >
                <Menu className="size-4" aria-hidden="true" />
              </button>
              <div>
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                  {role === "admin" ? "Mindenki" : "Kontraktor"}
                </p>
                <p className="text-lg font-semibold leading-tight">{pageTitle(current)}</p>
              </div>
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <button
                type="button"
                className="inline-flex h-9 min-w-72 items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 text-left text-sm text-muted-foreground shadow-soft"
              >
                <span className="size-3.5 rounded-full border border-current" aria-hidden="true" />
                Ugrás bárhová...
                <span className="ml-auto rounded bg-accent/15 px-1.5 py-0.5 font-ui text-[9px] font-bold uppercase text-accent">
                  Hamarosan
                </span>
                <span className="rounded bg-secondary px-1.5 py-0.5 font-ui text-[10px] font-semibold">
                  ⌘K
                </span>
              </button>
              <div className="inline-flex rounded-[var(--radius-pill)] border border-border bg-secondary p-1">
                <span className="rounded-[var(--radius-pill)] bg-accent px-3 py-1 font-ui text-xs font-semibold text-accent-foreground">
                  HU
                </span>
                <span className="px-3 py-1 font-ui text-xs font-semibold text-muted-foreground">
                  EN
                </span>
              </div>
              <Settings className="size-5 text-muted-foreground" aria-hidden="true" />
              <div className="grid size-9 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                VD
              </div>
              <div>
                <p className="text-sm font-semibold">Varga Dávid</p>
                <p className="text-xs text-muted-foreground">Admin</p>
              </div>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

function NavGroup({ group, current }: { group: "main" | "admin"; current: string }) {
  return (
    <div className="grid gap-1">
      {navItems
        .filter((item) => item.group === group)
        .map((item) => {
          const active = item.id === current;
          return (
            <a
              key={item.id}
              href="#"
              aria-current={active ? "page" : undefined}
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
