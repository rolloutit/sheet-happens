import { CalendarDays, Clock3, LayoutDashboard, Settings } from "lucide-react";

import type { AppShellProps } from "./AppShell.types";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Time", icon: Clock3, active: false },
  { label: "Timesheets", icon: CalendarDays, active: false },
  { label: "Settings", icon: Settings, active: false },
];

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/84 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div
              className="grid size-9 place-items-center rounded-[var(--radius-md)] bg-accent text-accent-foreground"
              aria-hidden="true"
            >
              SH
            </div>
            <div>
              <p className="font-ui text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Rollout IT
              </p>
              <p className="text-sm font-semibold">Sheet Happens</p>
            </div>
          </div>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {navItems.map((item) => (
              <a
                key={item.label}
                href="#"
                aria-current={item.active ? "page" : undefined}
                className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:text-accent"
              >
                <item.icon className="size-4" aria-hidden="true" />
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
