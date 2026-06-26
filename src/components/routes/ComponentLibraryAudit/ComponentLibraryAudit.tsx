"use client";

import {
  BarChart3,
  CalendarDays,
  Clock3,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { AppShell, CommandPalette } from "@/src/components/layout";
import type { CommandPaletteItem } from "@/src/components/layout";
import {
  AdminReview,
  DashboardCards,
  DayDetailPanel,
  InfoPageEditor,
  ManagementViews,
  Payslips,
  PdfViewer,
  Reports,
  SettingsPanels,
  TimeBreakdownDialog,
  TimeEntryForm,
  TimesheetComponents,
  TweaksPanel,
  WeeklyTimeGrid,
} from "@/src/components/sheet";
import type {
  AdminReviewProps,
  DashboardCardsProps,
  DayDetailEntry,
  InfoPageEditorValue,
  ManagementView,
  ManagementViewsProps,
  PayslipsProps,
  ReportsProps,
  ReviewQueueRow,
  SettingsSection,
  TimeBreakdownRow,
  TimeEntryFormValue,
  TimeGridDay,
  TimeGridProject,
  TimesheetComponentsProps,
} from "@/src/components/sheet";
import { Button, Card, CardContent } from "@/src/components/ui";
import { cn } from "@/src/lib/utils";
import type {
  ComponentLibraryAuditSurface,
  ComponentLibraryAuditSurfaceOption,
} from "./ComponentLibraryAudit.types";

const surfaces = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Hero actions, stats, checklist, status, and flagged-user APIs.",
  },
  {
    id: "time",
    label: "Time grid",
    description: "Weekly grid, single-entry form, day detail, timer, and breakdown shell.",
  },
  {
    id: "timesheets",
    label: "Timesheets",
    description: "Summary, workflow stepper, invoice upload, and breakdown data.",
  },
  {
    id: "review",
    label: "Admin review",
    description: "Queue, bulk action, diff, reject dialog, and document preview contracts.",
  },
  {
    id: "management",
    label: "Management",
    description: "People, projects, rates, drawer callbacks, and admin table contracts.",
  },
  {
    id: "reports",
    label: "Reports",
    description: "Filters, KPI tiles, chart, export dialog, document preview, and rows.",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Profile, security, TOTP, preferences, notifications, and tweaks panel.",
  },
  {
    id: "payslips",
    label: "Payslips",
    description: "Employee and admin payslip summary, upload, table, and viewer APIs.",
  },
  {
    id: "info",
    label: "Info page",
    description: "Markdown-backed internal info page editor contract.",
  },
] satisfies ComponentLibraryAuditSurfaceOption[];

const commandItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Open the dashboard component contract.",
    group: "Product surfaces",
    keywords: ["home", "stats", "status"],
    icon: LayoutDashboard,
  },
  {
    id: "time",
    label: "Time grid",
    description: "Open the weekly grid and time-entry contract.",
    group: "Product surfaces",
    keywords: ["weekly", "timer", "entry"],
    icon: Clock3,
  },
  {
    id: "timesheets",
    label: "Timesheets",
    description: "Open the timesheet workflow contract.",
    group: "Product surfaces",
    keywords: ["invoice", "stepper", "submit"],
    icon: CalendarDays,
  },
  {
    id: "review",
    label: "Admin review",
    description: "Open the approval and invoice diff contract.",
    group: "Product surfaces",
    keywords: ["approve", "reject", "queue"],
    icon: ShieldCheck,
  },
  {
    id: "management",
    label: "Management",
    description: "Open people, project, and rate management contracts.",
    group: "Product surfaces",
    keywords: ["people", "projects", "rates"],
    icon: Users,
  },
  {
    id: "reports",
    label: "Reports",
    description: "Open reporting, charting, export, and preview contracts.",
    group: "Product surfaces",
    keywords: ["chart", "export", "preview"],
    icon: BarChart3,
  },
  {
    id: "settings",
    label: "Settings",
    description: "Open account settings and tweak controls.",
    group: "Product surfaces",
    keywords: ["profile", "security", "notifications", "tweaks"],
    icon: Settings,
  },
  {
    id: "payslips",
    label: "Payslips",
    description: "Open employee and admin payroll document contracts.",
    group: "Product surfaces",
    keywords: ["payroll", "salary", "upload"],
    icon: WalletCards,
  },
  {
    id: "info",
    label: "Info page",
    description: "Open the markdown info-page editor contract.",
    group: "Product surfaces",
    keywords: ["markdown", "content", "editor"],
    icon: FileText,
  },
] satisfies CommandPaletteItem[];

const navToSurface: Partial<Record<string, ComponentLibraryAuditSurface>> = {
  dashboard: "dashboard",
  time: "time",
  timesheets: "timesheets",
  review: "review",
  reports: "reports",
  projects: "management",
  people: "management",
  rates: "management",
  info: "info",
};

const surfaceToNav = {
  dashboard: "dashboard",
  time: "time",
  timesheets: "timesheets",
  review: "review",
  management: "people",
  reports: "reports",
  settings: "info",
  payslips: "reports",
  info: "info",
} satisfies Record<ComponentLibraryAuditSurface, string>;

const dashboardFixtures = {
  name: "Noemi",
  role: "admin",
  summary: "Route-level fixture data exercises dashboard stats, status, and reminder callbacks.",
  stats: [
    {
      label: "Logged hours",
      value: "946h",
      icon: Clock3,
      trend: { label: "+4%", direction: "up" },
      sparkline: [42, 48, 51, 56, 61, 68, 72],
    },
    {
      label: "Rejected rows",
      value: "8",
      tone: "danger",
      helperText: "Needs review",
      sparkline: [2, 4, 3, 7, 5, 8, 8],
    },
    {
      label: "Invoices due",
      value: "5",
      tone: "warning",
      helperText: "Before payroll lock",
    },
  ],
  flaggedUsers: [
    { id: "balazs", name: "Balazs Varga", detail: "Missing 3 days", severity: "danger" },
    { id: "reka", name: "Reka Szabo", detail: "Invoice missing", severity: "warning" },
  ],
  statusSegments: [
    { id: "approved", label: "Approved", value: 18, tone: "success" },
    { id: "waiting", label: "Waiting", value: 6, tone: "warning" },
    { id: "blocked", label: "Blocked", value: 2, tone: "danger" },
  ],
} satisfies DashboardCardsProps;

const weekDays = [
  { id: "mon", label: "Monday", date: "22" },
  { id: "tue", label: "Tuesday", date: "23" },
  { id: "wed", label: "Wednesday", date: "24", state: "today" },
  { id: "thu", label: "Thursday", date: "25", state: "future" },
  { id: "fri", label: "Friday", date: "26", state: "future" },
] satisfies TimeGridDay[];

const weekProjects = [
  {
    id: "apollo",
    name: "Apollo Migration",
    color: "#37e3de",
    cells: {
      mon: { hours: 8, state: "filled" },
      tue: { hours: 6.5, state: "filled" },
      wed: { hours: 4, warning: "Description missing" },
      thu: { hours: 0, state: "future" },
      fri: { hours: 0, state: "future" },
    },
  },
  {
    id: "helix",
    name: "Helix Support",
    color: "#ffc68b",
    cells: {
      mon: { hours: 1 },
      tue: { hours: 2 },
      wed: { hours: 1.5 },
      thu: { hours: 0, state: "future" },
      fri: { hours: 0, state: "future" },
    },
  },
] satisfies TimeGridProject[];

const dayEntries = [
  {
    id: "apollo",
    projectName: "Apollo Migration",
    projectColor: "#37e3de",
    hours: 4,
    note: "Invoice diff review",
    billable: true,
    status: "submitted",
  },
  {
    id: "helix",
    projectName: "Helix Support",
    projectColor: "#ffc68b",
    hours: 1.5,
    note: "SLA triage",
    billable: true,
    status: "approved",
  },
] satisfies DayDetailEntry[];

const breakdownRows = [
  {
    id: "apollo",
    label: "Apollo Migration",
    description: "Billable delivery",
    hours: 112,
    amount: "EUR 7,280",
    tone: "success",
  },
  {
    id: "helix",
    label: "Helix Support",
    description: "Support retainer",
    hours: 20.5,
    amount: "EUR 1,665",
  },
  {
    id: "internal",
    label: "Internal admin",
    description: "Not billable",
    hours: 4,
    tone: "warning",
  },
] satisfies TimeBreakdownRow[];

const timesheetFixtures = {
  status: "approved",
  title: "June 2026 timesheet",
  meta: "136.5 hours - EUR 8,945 estimated amount",
  breakdownRows: [
    { id: "apollo", project: "Apollo Migration", hours: 112, rate: "EUR 65", amount: "EUR 7,280" },
    { id: "helix", project: "Helix Support", hours: 20.5, rate: "EUR 75", amount: "EUR 1,665" },
  ],
  invoiceFiles: [{ id: "invoice", name: "invoice-june.pdf", sizeLabel: "248 KB", status: "done" }],
} satisfies TimesheetComponentsProps;

const reviewRows = [
  {
    id: "lena",
    person: "Lena Kovacs",
    period: "June 2026",
    project: "Apollo",
    status: "submitted",
    amount: "EUR 8,945",
  },
  {
    id: "mark",
    person: "Mark Chen",
    period: "June 2026",
    project: "Helix",
    status: "missing",
    amount: "EUR 0",
    disabled: true,
  },
] satisfies ReviewQueueRow[];

const adminReviewFixtures = {
  rows: reviewRows,
  diffItems: [
    { id: "hours", state: "match", label: "Hours", delta: "0.0h" },
    { id: "invoice", state: "mismatch", label: "Invoice total", delta: "+EUR 125" },
  ],
  diffTotals: [
    { id: "timesheet", label: "Timesheet total", value: "EUR 8,945", tone: "success" },
    { id: "invoice", label: "Invoice total", value: "EUR 9,070", tone: "warning" },
  ],
} satisfies AdminReviewProps;

const managementFixtures = {
  people: [
    {
      id: "lena",
      name: "Lena Kovacs",
      email: "lena@example.com",
      profile: "Contractor",
      state: "active",
      currency: "EUR",
    },
    {
      id: "mark",
      name: "Mark Chen",
      email: "mark@example.com",
      profile: "Employee",
      state: "inactive",
      currency: "HUF",
    },
  ],
  projects: [
    {
      id: "apollo",
      name: "Apollo Migration",
      description: "Client delivery - Active",
      active: true,
      dateRange: "Jan 2026 to Dec 2026",
      tags: ["Frontend", "Backend"],
      members: [
        { id: "lena", name: "Lena Kovacs" },
        { id: "mark", name: "Mark Chen" },
      ],
      notes: "Migration squad with project override rates.",
      rateSource: "Project override",
    },
  ],
  rates: [
    {
      id: "central",
      label: "Central rate",
      scope: "Default contractor rate",
      amount: 65,
      currency: "EUR",
      unit: "hour",
      effectiveFrom: "2026-01-01",
      status: "current",
    },
  ],
} satisfies Pick<ManagementViewsProps, "people" | "projects" | "rates">;

const reportFixtures = {
  mode: "internal",
  periodValue: "week",
  projectValue: "apollo",
  view: "user",
  stats: [
    { label: "Hours", value: "160", helperText: "Selected week", tone: "info" },
    { label: "Billable", value: "EUR 10,400", helperText: "Approved rows", tone: "success" },
    { label: "Edited rows", value: "2", helperText: "Needs review", tone: "warning" },
  ],
  chartData: [
    { label: "Mon", value: 8 },
    { label: "Tue", value: 9 },
    { label: "Wed", value: 7.5 },
    { label: "Thu", value: 10 },
    { label: "Fri", value: 8 },
  ],
  distribution: [
    { id: "delivery", label: "Delivery", value: 62 },
    { id: "support", label: "Support", value: 38 },
  ],
  documentRows: [
    { id: "delivery", label: "Delivery", value: "99h" },
    { id: "support", label: "Support", value: "61h" },
    { id: "internal-cost", label: "Internal cost", value: "EUR 10,400", internalOnly: true },
  ],
  rows: [
    { id: "lena", project: "Apollo", user: "Lena Kovacs", hours: 99, amount: "EUR 6,435" },
    { id: "mark", project: "Apollo", user: "Mark Chen", hours: 61, amount: "EUR 3,965" },
  ],
} satisfies ReportsProps;

const payslipFixtures = {
  role: "admin",
  viewer: {
    state: "ready",
    title: "Selected payslip",
    fileName: "lena-june.pdf",
    meta: "Ready for payroll validation.",
  },
  adminRows: [
    {
      id: "lena",
      person: "Lena Kovacs",
      email: "lena@example.com",
      month: "June 2026",
      status: "available",
      fileName: "lena-june.pdf",
    },
    {
      id: "mark",
      person: "Mark Chen",
      email: "mark@example.com",
      month: "June 2026",
      status: "missing",
    },
  ],
} satisfies PayslipsProps;

const infoPageValue = {
  title: "Contractor handbook",
  slug: "contractor-handbook",
  body: "## Timesheet rules\n\nSubmit every Friday before 16:00 and attach invoices after approval.",
  status: "draft",
  updatedAt: "2026-06-24 09:30",
} satisfies InfoPageEditorValue;

const projectOptions = [
  { value: "apollo", label: "Apollo Migration", meta: "Client delivery" },
  { value: "helix", label: "Helix Support", meta: "Support retainer" },
  { value: "internal", label: "Internal admin" },
];

function isAuditSurface(value: string): value is ComponentLibraryAuditSurface {
  return surfaces.some((surface) => surface.id === value);
}

export function ComponentLibraryAudit() {
  const [activeSurface, setActiveSurface] = useState<ComponentLibraryAuditSurface>("dashboard");
  const [commandOpen, setCommandOpen] = useState(false);
  const [selectedFlaggedUsers, setSelectedFlaggedUsers] = useState<string[]>(["balazs"]);
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>(["lena"]);
  const [managementView, setManagementView] = useState<ManagementView>("people");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("security");
  const [timeEntry, setTimeEntry] = useState<Partial<TimeEntryFormValue>>({
    projectId: "apollo",
    date: new Date(2026, 5, 24),
    hours: 4,
    description: "Invoice diff review",
    billable: true,
  });
  const [infoValue, setInfoValue] = useState<InfoPageEditorValue>(infoPageValue);
  const [lastAction, setLastAction] = useState("Audit route ready");

  function activateSurface(surface: ComponentLibraryAuditSurface) {
    setActiveSurface(surface);
    setLastAction(`Active audit surface: ${getSurface(surface).label}`);
  }

  function handleCommandSelect(item: CommandPaletteItem) {
    if (!isAuditSurface(item.id)) return;
    activateSurface(item.id);
  }

  function handleNavigate(itemId: string) {
    const nextSurface = navToSurface[itemId];
    if (nextSurface) activateSurface(nextSurface);
  }

  return (
    <AppShell
      current={surfaceToNav[activeSurface]}
      onCommand={() => setCommandOpen(true)}
      onNavigate={handleNavigate}
      user={{
        name: "Noemi Audit",
        email: "audit@example.com",
        role: "Admin",
        initials: "NA",
      }}
    >
      <CommandPalette
        items={commandItems}
        open={commandOpen}
        labels={{
          title: "Component audit command palette",
          description: "Switch between composed product surfaces.",
          search: "Search audit surfaces",
        }}
        trigger={
          <button type="button" className="sr-only">
            Open audit command palette
          </button>
        }
        onOpenChange={setCommandOpen}
        onSelect={handleCommandSelect}
      />

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-5">
          <div className="max-w-4xl">
            <p className="font-ui text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              Internal component proof
            </p>
            <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">
              Component API audit route
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              This route composes the larger product components with typed fixture contracts inside
              the Next app shell. It checks that Storybook-only surfaces still behave when wired as
              app screens.
            </p>
          </div>

          <Card variant="flat">
            <CardContent className="gap-4">
              <div className="flex flex-wrap gap-2" aria-label="Audit surfaces">
                {surfaces.map((surface) => (
                  <Button
                    key={surface.id}
                    type="button"
                    size="sm"
                    variant={surface.id === activeSurface ? "cta" : "soft"}
                    onClick={() => activateSurface(surface.id)}
                  >
                    {surface.label}
                  </Button>
                ))}
              </div>
              <div className="grid gap-3 rounded-[var(--radius-md)] border border-border bg-background p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="font-ui text-sm font-semibold">
                    {getSurface(activeSurface).description}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    9 product route contracts, 35 UI primitive folders, 50 product folders, and 8
                    layout folders are represented by the current audit baseline.
                  </p>
                </div>
                <p className="rounded-[var(--radius-md)] bg-secondary px-3 py-2 font-ui text-xs font-semibold text-accent">
                  {getSurface(activeSurface).label}
                </p>
              </div>
            </CardContent>
          </Card>

          <div
            className="rounded-[var(--radius-md)] border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {lastAction}
          </div>
        </div>

        <AuditSurface title={`${getSurface(activeSurface).label} contract`}>
          {activeSurface === "dashboard" ? (
            <DashboardCards
              {...dashboardFixtures}
              selectedFlaggedUserIds={selectedFlaggedUsers}
              primaryAction={{
                label: "Open approval queue",
                icon: ShieldCheck,
                variant: "cta",
                onClick: () => activateSurface("review"),
              }}
              secondaryAction={{
                label: "Open utilization report",
                icon: BarChart3,
                variant: "soft",
                onClick: () => activateSurface("reports"),
              }}
              onFlaggedUserSelectionChange={(ids) => {
                setSelectedFlaggedUsers(ids);
                setLastAction(`Selected flagged users: ${ids.length}`);
              }}
              onRemindFlaggedUsers={(ids) =>
                setLastAction(`Reminder callback received ${ids.length} users`)
              }
            />
          ) : null}

          {activeSurface === "time" ? (
            <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
              <WeeklyTimeGrid
                projects={weekProjects}
                days={weekDays}
                weekLabel="Jun 22-26"
                monthLabel="June 2026"
                selectedProjectId="apollo"
                showTimer
                timer={{
                  projectId: "apollo",
                  description: "Invoice diff review",
                  elapsedLabel: "01:24:12",
                  running: true,
                }}
                labels={{
                  eyebrow: "Time tracking",
                  title: "Weekly entry",
                  description: "Editable route fixture with warning, future, and filled cells.",
                  previousWeek: "Previous week",
                  nextWeek: "Next week",
                  today: "This week",
                  save: "Save",
                  addProject: "Add project",
                  copyPreviousDay: "Copy previous day",
                  projectColumn: "Project",
                  totalColumn: "Total",
                  dailyTotal: "Daily total",
                  gridTitle: "Weekly time grid",
                }}
                onCellEditStart={(context) =>
                  setLastAction(`Editing ${context.project.name} on ${context.day.label}`)
                }
                onCellChange={(context, hours) =>
                  setLastAction(`${context.project.name} ${context.day.label}: ${hours}h`)
                }
                onSave={() => setLastAction("Weekly grid save callback")}
              />
              <div className="grid h-fit gap-4">
                <TimeEntryForm
                  projects={projectOptions}
                  value={timeEntry}
                  labels={{ title: "Single entry", submit: "Save entry" }}
                  onValueChange={(value) => setTimeEntry(value)}
                  onSubmit={(value) => setLastAction(`Saved ${value.hours}h time entry`)}
                  onCancel={() => setLastAction("Time entry cancel callback")}
                />
                <DayDetailPanel
                  dateLabel="Wednesday, June 24"
                  entries={dayEntries}
                  capacityHours={8}
                  onAddEntry={() => setLastAction("Add day entry callback")}
                  onEditEntry={(entry) => setLastAction(`Edit ${entry.projectName}`)}
                  onDeleteEntry={(entry) => setLastAction(`Delete ${entry.projectName}`)}
                />
                <TimeBreakdownDialog
                  rows={breakdownRows}
                  totalHours={136.5}
                  totalAmount="EUR 8,945"
                  labels={{ trigger: "View breakdown" }}
                  onExport={() => setLastAction("Breakdown export callback")}
                />
              </div>
            </div>
          ) : null}

          {activeSurface === "timesheets" ? (
            <TimesheetComponents
              {...timesheetFixtures}
              onInvoiceFilesSelected={(files) =>
                setLastAction(`Invoice files selected: ${files.length}`)
              }
            />
          ) : null}

          {activeSurface === "review" ? (
            <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
              <AdminReview
                {...adminReviewFixtures}
                selectedIds={selectedReviewIds}
                selectedCount={selectedReviewIds.length}
                onSelectedIdsChange={(ids) => {
                  setSelectedReviewIds(ids);
                  setLastAction(`Selected review rows: ${ids.length}`);
                }}
                onApproveSelected={() => setLastAction("Approve selected callback")}
                onRejectSelected={(reason) => setLastAction(`Reject selected: ${reason}`)}
                onRejectInvoice={(reason) => setLastAction(`Reject invoice: ${reason}`)}
              />
              <PdfViewer
                title="Invoice INV-2026-06"
                src="about:blank"
                page={1}
                totalPages={4}
                onNextPage={() => setLastAction("PDF next page callback")}
                onDownload={() => setLastAction("PDF download callback")}
              />
            </div>
          ) : null}

          {activeSurface === "management" ? (
            <ManagementViews
              {...managementFixtures}
              view={managementView}
              onViewChange={(view) => {
                setManagementView(view);
                setLastAction(`Management view: ${view}`);
              }}
              onInvite={() => setLastAction("Invite callback")}
              onPersonEdit={(person) => setLastAction(`Edit person: ${person.name}`)}
              onPersonDelete={(person) => setLastAction(`Delete person: ${person.name}`)}
              onProjectSave={(project) => setLastAction(`Save project: ${project.name}`)}
              onRateSave={(rate) => setLastAction(`Save rate: ${rate.label}`)}
            />
          ) : null}

          {activeSurface === "reports" ? (
            <Reports
              {...reportFixtures}
              onViewChange={(view) => setLastAction(`Report view: ${view}`)}
              onExport={(format) => setLastAction(`Report export: ${format}`)}
            />
          ) : null}

          {activeSurface === "settings" ? (
            <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
              <SettingsPanels
                section={settingsSection}
                onSectionChange={(section) => {
                  setSettingsSection(section);
                  setLastAction(`Settings section: ${section}`);
                }}
                onSecurityMethodAction={(method) =>
                  setLastAction(`Security method action: ${method.label}`)
                }
                totp={{
                  onConfirm: (code) => setLastAction(`TOTP confirm: ${code}`),
                }}
              />
              <TweaksPanel
                open
                value={{
                  radius: 8,
                  denseTables: true,
                  density: "comfortable",
                  font: "lexend",
                  accent: "#37e3de",
                  panelWidth: 360,
                }}
                onApply={(value) => setLastAction(`Applied tweaks with ${value.radius}px radius`)}
                onReset={(value) => setLastAction(`Reset tweaks to ${value.radius}px radius`)}
              />
            </div>
          ) : null}

          {activeSurface === "payslips" ? (
            <Payslips
              {...payslipFixtures}
              onUpload={() => setLastAction("Payslip upload callback")}
              onAdminPreview={(row) => setLastAction(`Preview payslip: ${row.person}`)}
              onAdminUpload={(row) => setLastAction(`Upload payslip: ${row.person}`)}
              onAdminDownload={(row) => setLastAction(`Download payslip: ${row.person}`)}
            />
          ) : null}

          {activeSurface === "info" ? (
            <InfoPageEditor
              value={infoValue}
              onValueChange={setInfoValue}
              onSave={(value) => setLastAction(`Saved info page: ${value.slug}`)}
              onPublish={(value) => setLastAction(`Published info page: ${value.slug}`)}
            />
          ) : null}
        </AuditSurface>
      </section>
    </AppShell>
  );
}

function getSurface(surfaceId: ComponentLibraryAuditSurface) {
  return surfaces.find((surface) => surface.id === surfaceId) ?? surfaces[0];
}

function AuditSurface({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby="audit-surface-title"
      className={cn("grid gap-4 rounded-[var(--radius-xl)] border border-border bg-card/70 p-4")}
    >
      <div>
        <p className="font-ui text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          Route-level proof
        </p>
        <h2 id="audit-surface-title" className="mt-1 text-2xl font-semibold">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
