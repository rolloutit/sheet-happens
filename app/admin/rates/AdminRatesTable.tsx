"use client";

import { BadgeDollarSign, ChevronRight, MinusCircle, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/src/components/ui/Badge";
import type { BadgeProps } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/src/components/ui/Drawer";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import type { SelectOption } from "@/src/lib/member-preferences";
import { cn } from "@/src/lib/utils";
import type { AdminProjectRow } from "@/src/server/projects";
import type {
  AdminAssignmentRateRow,
  AdminMemberRateRow,
  AdminRatePeriodRow,
  RateMemberProfile,
  RateMemberStatus,
} from "@/src/server/rates";
import { createAssignmentOverrideRateAction, createMemberDefaultRateAction } from "./actions";
import type {
  CreateAssignmentOverrideRateActionInput,
  CreateMemberDefaultRateActionInput,
  RateActionState,
  RateFormField,
} from "./actions.types";
import { nativeSelectClassName } from "./formStyles";

export type AdminRatesTableProps = {
  rows: AdminMemberRateRow[];
  assignmentRates: AdminAssignmentRateRow[];
  projects: AdminProjectRow[];
  currencyOptions: readonly SelectOption[];
  todayDate: string;
};

type ProfileFilter = "all" | RateMemberProfile;
type RateFilter = "all" | "has" | "none";

const profileTone: Record<RateMemberProfile, BadgeProps["tone"]> = {
  CONTRACTOR: "cta",
  EMPLOYEE: "info",
};

const initialActionState: RateActionState = {
  status: "idle",
  message: "",
};

export function AdminRatesTable({
  rows,
  assignmentRates,
  projects,
  currencyOptions,
  todayDate,
}: AdminRatesTableProps) {
  const t = useTranslations("AdminRates");
  const router = useRouter();
  const profileLabels: Record<RateMemberProfile, string> = {
    CONTRACTOR: t("profiles.contractor"),
    EMPLOYEE: t("profiles.employee"),
  };
  const statusLabels: Record<RateMemberStatus, string> = {
    INVITED: t("statuses.invited"),
    ACTIVE: t("statuses.active"),
    INACTIVE: t("statuses.inactive"),
    DELETED: t("statuses.deleted"),
  };
  const [query, setQuery] = useState("");
  const [profileFilter, setProfileFilter] = useState<ProfileFilter>("all");
  const [rateFilter, setRateFilter] = useState<RateFilter>("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [actionState, setActionState] = useState<RateActionState>(initialActionState);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const stats = useMemo(
    () => ({
      withRate: rows.filter((row) => row.currentRate).length,
      missing: rows.filter((row) => !row.currentRate).length,
      overrides: assignmentRates.filter((rate) => rate.overrideRatePeriods.length > 0).length,
    }),
    [assignmentRates, rows],
  );

  const groupOptions = useMemo(() => {
    const groupsById = new Map<string, { id: string; name: string }>();

    for (const project of projects) {
      for (const group of project.groups) {
        groupsById.set(group.id, group);
      }
    }

    return Array.from(groupsById.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [projects]);

  const projectGroupsByProjectId = useMemo(() => {
    return new Map(projects.map((project) => [project.id, project.groups]));
  }, [projects]);

  const filteredRows = rows.filter((row) => {
    const normalizedQuery = query.trim().toLowerCase();

    if (
      normalizedQuery &&
      !row.memberName.toLowerCase().includes(normalizedQuery) &&
      !row.memberEmail.toLowerCase().includes(normalizedQuery)
    ) {
      return false;
    }

    if (profileFilter !== "all" && row.memberProfile !== profileFilter) return false;
    if (rateFilter === "has" && !row.currentRate) return false;
    if (rateFilter === "none" && row.currentRate) return false;

    if (projectFilter !== "all") {
      const hasProjectAssignment = assignmentRates.some(
        (assignment) =>
          assignment.memberId === row.memberId && assignment.projectId === projectFilter,
      );

      if (!hasProjectAssignment) return false;
    }

    if (groupFilter !== "all") {
      return assignmentRates.some((assignment) => {
        if (assignment.memberId !== row.memberId) return false;
        const projectGroups = projectGroupsByProjectId.get(assignment.projectId) ?? [];

        if (groupFilter === "ungrouped") return projectGroups.length === 0;

        return projectGroups.some((group) => group.id === groupFilter);
      });
    }

    return true;
  });

  const selectedMember = selectedMemberId
    ? (rows.find((row) => row.memberId === selectedMemberId) ?? null)
    : null;
  const selectedAssignments = selectedMember
    ? assignmentRates.filter((assignment) => assignment.memberId === selectedMember.memberId)
    : [];

  function runAction(key: string, callback: () => Promise<RateActionState>) {
    setPendingKey(key);
    setActionState(initialActionState);

    startTransition(async () => {
      const result = await callback();
      setActionState(result);
      setPendingKey(null);

      if (result.status === "success") {
        router.refresh();
      }
    });
  }

  function saveCentralRate(input: CreateMemberDefaultRateActionInput) {
    runAction(`member:${input.memberId}`, () => createMemberDefaultRateAction(input));
  }

  function saveAssignmentOverride(input: CreateAssignmentOverrideRateActionInput) {
    runAction(`assignment:${input.projectAssignmentId}`, () =>
      createAssignmentOverrideRateAction(input),
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <RateStat value={stats.withRate} label={t("stats.withRate")} />
        <RateStat
          value={stats.missing}
          label={t("stats.missingRate")}
          tone={stats.missing ? "warning" : undefined}
        />
        <RateStat value={stats.overrides} label={t("stats.projectOverrides")} />
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex h-10 min-w-[min(16rem,100%)] flex-[1_1_18rem] items-center gap-2 rounded-[var(--radius-md)] border border-border bg-card px-3 shadow-soft">
            <Search className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">{t("filters.search")}</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("filters.searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="min-w-0 max-w-full overflow-x-auto">
            <SegmentedControl
              label={t("filters.profile")}
              size="sm"
              value={profileFilter}
              onValueChange={(value) => setProfileFilter(value as ProfileFilter)}
              className="whitespace-nowrap"
              items={[
                { value: "all", label: t("filters.all") },
                { value: "CONTRACTOR", label: profileLabels.CONTRACTOR },
                { value: "EMPLOYEE", label: profileLabels.EMPLOYEE },
              ]}
            />
          </div>
          <div className="min-w-0 max-w-full overflow-x-auto">
            <SegmentedControl
              label={t("filters.rate")}
              size="sm"
              value={rateFilter}
              onValueChange={(value) => setRateFilter(value as RateFilter)}
              className="whitespace-nowrap"
              items={[
                { value: "all", label: t("filters.all") },
                { value: "has", label: t("filters.hasRate") },
                { value: "none", label: t("filters.missing") },
              ]}
            />
          </div>
          <label className="grid h-10 min-w-[min(14rem,100%)] flex-[1_1_14rem] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[var(--radius-md)] border border-border bg-card px-3 shadow-soft sm:max-w-72">
            <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t("filters.project")}
            </span>
            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="min-w-0 bg-transparent text-sm font-semibold text-foreground outline-none"
            >
              <option value="all">{t("filters.all")}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid h-10 min-w-[min(14rem,100%)] flex-[1_1_14rem] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[var(--radius-md)] border border-border bg-card px-3 shadow-soft sm:max-w-72">
            <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t("filters.group")}
            </span>
            <select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              className="min-w-0 bg-transparent text-sm font-semibold text-foreground outline-none"
            >
              <option value="all">{t("filters.all")}</option>
              <option value="ungrouped">{t("filters.ungrouped")}</option>
              {groupOptions.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-soft">
        <table className="w-full border-collapse">
          <caption className="sr-only">{t("table.caption")}</caption>
          <thead>
            <tr className="border-b border-border bg-background/45">
              <RateHead>{t("table.columns.name")}</RateHead>
              <RateHead className="hidden md:table-cell">{t("table.columns.profile")}</RateHead>
              <RateHead>{t("table.columns.currentRate")}</RateHead>
              <RateHead className="hidden md:table-cell">
                {t("table.columns.projectOverrides")}
              </RateHead>
              <RateHead>
                <span className="sr-only">{t("table.open")}</span>
              </RateHead>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                  {t("table.empty")}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const overrideCount = getMemberOverrideCount(row.memberId, assignmentRates);

                return (
                  <tr
                    key={row.memberId}
                    tabIndex={0}
                    role="button"
                    aria-label={t("table.openDrawer", { name: row.memberName })}
                    onClick={() => {
                      setSelectedMemberId(row.memberId);
                      setActionState(initialActionState);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedMemberId(row.memberId);
                        setActionState(initialActionState);
                      }
                    }}
                    className="cursor-pointer border-b border-border transition hover:bg-secondary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <RateAvatar name={row.memberName} />
                        <div className="min-w-0">
                          <p className="truncate font-ui text-sm font-semibold text-foreground">
                            {row.memberName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {statusLabels[row.memberStatus]}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <Badge tone={profileTone[row.memberProfile]}>
                        {profileLabels[row.memberProfile]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {row.currentRate ? (
                        <p className="font-ui text-sm font-semibold text-foreground">
                          {formatRateValue(row.currentRate)}
                        </p>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-warning/12 px-2.5 py-1 text-xs font-semibold text-warning">
                          <MinusCircle className="size-3" aria-hidden="true" />
                          {t("labels.missing")}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {row.memberProfile === "CONTRACTOR" && overrideCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-sm text-foreground">
                          <span className="rounded-[var(--radius-pill)] bg-primary/12 px-2 py-0.5 font-ui text-xs font-semibold text-accent">
                            {overrideCount}
                          </span>
                          {t("table.overrideCount", { count: overrideCount })}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight
                        className="ml-auto size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <RateManagementDrawer
        key={selectedMember?.memberId ?? "closed"}
        member={selectedMember}
        assignments={selectedAssignments}
        currencyOptions={currencyOptions}
        todayDate={todayDate}
        actionState={actionState}
        pendingKey={pendingKey}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMemberId(null);
            setActionState(initialActionState);
          }
        }}
        onCreateCentralRate={saveCentralRate}
        onCreateAssignmentOverride={saveAssignmentOverride}
      />
    </div>
  );
}

function RateStat({ value, label, tone }: { value: number; label: string; tone?: "warning" }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card px-4 py-3 shadow-soft">
      <p
        className={cn(
          "text-2xl font-semibold text-foreground",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </p>
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function RateHead({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3 text-left font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

function RateManagementDrawer({
  member,
  assignments,
  currencyOptions,
  todayDate,
  actionState,
  pendingKey,
  onOpenChange,
  onCreateCentralRate,
  onCreateAssignmentOverride,
}: {
  member: AdminMemberRateRow | null;
  assignments: AdminAssignmentRateRow[];
  currencyOptions: readonly SelectOption[];
  todayDate: string;
  actionState: RateActionState;
  pendingKey: string | null;
  onOpenChange: (open: boolean) => void;
  onCreateCentralRate: (input: CreateMemberDefaultRateActionInput) => void;
  onCreateAssignmentOverride: (input: CreateAssignmentOverrideRateActionInput) => void;
}) {
  const t = useTranslations("AdminRates");
  const profileLabels: Record<RateMemberProfile, string> = {
    CONTRACTOR: t("profiles.contractor"),
    EMPLOYEE: t("profiles.employee"),
  };
  const statusLabels: Record<RateMemberStatus, string> = {
    INVITED: t("statuses.invited"),
    ACTIVE: t("statuses.active"),
    INACTIVE: t("statuses.inactive"),
    DELETED: t("statuses.deleted"),
  };
  const [centralFormOpen, setCentralFormOpen] = useState(false);
  const [newOverrideOpen, setNewOverrideOpen] = useState(false);
  const [newOverrideAssignmentId, setNewOverrideAssignmentId] = useState<string | null>(null);
  const [overrideFormAssignmentId, setOverrideFormAssignmentId] = useState<string | null>(null);
  const defaultCurrency = member?.currentRate?.currencyCode ?? member?.defaultCurrencyCode ?? "EUR";
  const existingOverrides = assignments.filter(
    (assignment) => assignment.overrideRatePeriods.length > 0,
  );
  const addableAssignments = assignments.filter(
    (assignment) => assignment.overrideRatePeriods.length === 0,
  );
  const pendingCentral = member ? pendingKey === `member:${member.memberId}` : false;

  return (
    <Drawer open={Boolean(member)} onOpenChange={onOpenChange}>
      {member ? (
        <DrawerContent className="w-[min(38rem,100vw)] gap-0 overflow-hidden p-0">
          <div className="flex items-start gap-3 border-b border-border px-5 py-5">
            <RateAvatar name={member.memberName} size="lg" />
            <div className="min-w-0 flex-1">
              <DrawerHeader className="gap-1 p-0 pr-0">
                <DrawerTitle className="truncate text-xl font-semibold text-foreground">
                  {member.memberName}
                </DrawerTitle>
                <DrawerDescription asChild>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={profileTone[member.memberProfile]}>
                      {profileLabels[member.memberProfile]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {statusLabels[member.memberStatus]}
                    </span>
                  </div>
                </DrawerDescription>
              </DrawerHeader>
            </div>
            <div className="pr-9 text-right">
              {member.currentRate ? (
                <>
                  <p className="font-ui text-lg font-semibold text-foreground">
                    {formatRateValue(member.currentRate)}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("labels.currentRate")}</p>
                </>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-warning/12 px-2.5 py-1 text-xs font-semibold text-warning">
                  <MinusCircle className="size-3" aria-hidden="true" />
                  {t("labels.missing")}
                </span>
              )}
            </div>
          </div>

          <div className="grid max-h-[calc(100vh-6rem)] gap-6 overflow-y-auto px-5 py-5">
            {actionState.message ? (
              <p
                role={actionState.status === "error" ? "alert" : "status"}
                className={cn(
                  "rounded-[var(--radius-md)] border px-3 py-2 text-sm",
                  actionState.status === "error"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-success/40 bg-success/10 text-success",
                )}
              >
                {actionState.message}
              </p>
            ) : null}

            <section className="grid gap-4">
              <div className="grid gap-1">
                <h2 className="font-ui text-base font-semibold text-foreground">
                  {t("drawer.centralRate")}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {t("drawer.centralRateDescription")}
                </p>
              </div>

              {member.ratePeriods.length === 0 ? (
                <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-background/45 px-4 py-6 text-center">
                  <MinusCircle
                    className="mx-auto size-7 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <p className="mt-3 font-ui text-sm font-semibold text-foreground">
                    {t("drawer.noCentralRate")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("drawer.noCentralRateDescription")}
                  </p>
                </div>
              ) : (
                <RateTimeline periods={member.ratePeriods} />
              )}

              {centralFormOpen ? (
                <RatePeriodForm
                  defaultCurrency={defaultCurrency}
                  todayDate={todayDate}
                  currencyOptions={currencyOptions}
                  actionState={actionState}
                  pending={pendingCentral}
                  submitLabel={t("actions.addPeriod")}
                  onSubmit={(period) => {
                    onCreateCentralRate({
                      memberId: member.memberId,
                      ...period,
                    });
                  }}
                />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={Plus}
                  className="w-fit border border-dashed border-border"
                  onClick={() => setCentralFormOpen(true)}
                >
                  {t("actions.addPeriod")}
                </Button>
              )}
            </section>

            {member.memberProfile === "CONTRACTOR" ? (
              <section className="grid gap-4 border-t border-border pt-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="grid gap-1">
                    <h2 className="font-ui text-base font-semibold text-foreground">
                      {t("drawer.projectOverrides")}
                    </h2>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {t("drawer.projectOverridesDescription")}
                    </p>
                  </div>
                  {addableAssignments.length > 0 && !newOverrideOpen ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Plus}
                      onClick={() => {
                        setNewOverrideAssignmentId(null);
                        setNewOverrideOpen(true);
                      }}
                    >
                      {t("actions.addOverride")}
                    </Button>
                  ) : null}
                </div>

                {newOverrideOpen && addableAssignments.length > 0 ? (
                  <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-background/45 p-4">
                    <OverrideRateForm
                      key={addableAssignments
                        .map((assignment) => assignment.assignmentId)
                        .concat(newOverrideAssignmentId ?? "auto")
                        .join(":")}
                      assignments={addableAssignments}
                      initialAssignmentId={newOverrideAssignmentId}
                      defaultCurrency={defaultCurrency}
                      todayDate={todayDate}
                      currencyOptions={currencyOptions}
                      actionState={actionState}
                      pending={pendingKey?.startsWith("assignment:") ?? false}
                      onCancel={() => setNewOverrideOpen(false)}
                      onSubmit={(input) => {
                        onCreateAssignmentOverride(input);
                      }}
                    />
                  </div>
                ) : null}

                {existingOverrides.length === 0 &&
                addableAssignments.length > 0 &&
                !newOverrideOpen ? (
                  <p className="text-sm text-muted-foreground">{t("drawer.noProjectOverride")}</p>
                ) : (
                  existingOverrides.map((assignment) => {
                    const formOpen = overrideFormAssignmentId === assignment.assignmentId;
                    const pending = pendingKey === `assignment:${assignment.assignmentId}`;

                    return (
                      <div
                        key={assignment.assignmentId}
                        className="grid gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-ui text-sm font-semibold text-foreground">
                              {assignment.projectName}
                            </p>
                            {assignment.currentOverrideRate ? (
                              <p className="text-sm text-muted-foreground">
                                {formatRateValue(assignment.currentOverrideRate)}
                              </p>
                            ) : null}
                          </div>
                          {!formOpen ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              icon={Plus}
                              onClick={() => setOverrideFormAssignmentId(assignment.assignmentId)}
                            >
                              {t("actions.addPeriod")}
                            </Button>
                          ) : null}
                        </div>
                        <RateTimeline periods={assignment.overrideRatePeriods} />
                        {formOpen ? (
                          <RatePeriodForm
                            defaultCurrency={
                              assignment.currentOverrideRate?.currencyCode ?? defaultCurrency
                            }
                            todayDate={todayDate}
                            currencyOptions={currencyOptions}
                            actionState={actionState}
                            pending={pending}
                            submitLabel={t("actions.addOverridePeriod")}
                            onSubmit={(period) => {
                              onCreateAssignmentOverride({
                                projectAssignmentId: assignment.assignmentId,
                                ...period,
                              });
                            }}
                          />
                        ) : null}
                      </div>
                    );
                  })
                )}

                {addableAssignments.length > 0 && !newOverrideOpen ? (
                  <AvailableOverrideProjects
                    assignments={addableAssignments}
                    onAddOverride={(assignmentId) => {
                      setNewOverrideAssignmentId(assignmentId);
                      setNewOverrideOpen(true);
                    }}
                  />
                ) : null}

                {addableAssignments.length === 0 && !newOverrideOpen ? (
                  <UnavailableOverrideProjects
                    hasAssignments={assignments.length > 0}
                    hasExistingOverrides={existingOverrides.length > 0}
                  />
                ) : null}
              </section>
            ) : null}
          </div>
        </DrawerContent>
      ) : null}
    </Drawer>
  );
}

function OverrideRateForm({
  assignments,
  initialAssignmentId,
  defaultCurrency,
  todayDate,
  currencyOptions,
  actionState,
  pending,
  onCancel,
  onSubmit,
}: {
  assignments: AdminAssignmentRateRow[];
  initialAssignmentId?: string | null;
  defaultCurrency: string;
  todayDate: string;
  currencyOptions: readonly SelectOption[];
  actionState: RateActionState;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (input: CreateAssignmentOverrideRateActionInput) => void;
}) {
  const t = useTranslations("AdminRates");
  const [assignmentId, setAssignmentId] = useState(
    initialAssignmentId ?? assignments[0]?.assignmentId ?? "",
  );

  return (
    <div className="grid gap-4">
      <Field label={t("fields.project")} required reserveMessageSpace>
        {({ id, describedBy, required }) => (
          <select
            id={id}
            value={assignmentId}
            onChange={(event) => setAssignmentId(event.target.value)}
            aria-describedby={describedBy}
            required={required}
            className={nativeSelectClassName}
          >
            {assignments.map((assignment) => (
              <option key={assignment.assignmentId} value={assignment.assignmentId}>
                {assignment.projectName}
              </option>
            ))}
          </select>
        )}
      </Field>
      <RatePeriodForm
        defaultCurrency={defaultCurrency}
        todayDate={todayDate}
        currencyOptions={currencyOptions}
        actionState={actionState}
        pending={pending}
        submitLabel={t("actions.addOverride")}
        onCancel={onCancel}
        onSubmit={(period) =>
          onSubmit({
            projectAssignmentId: assignmentId,
            ...period,
          })
        }
      />
    </div>
  );
}

function AvailableOverrideProjects({
  assignments,
  onAddOverride,
}: {
  assignments: AdminAssignmentRateRow[];
  onAddOverride: (assignmentId: string) => void;
}) {
  const t = useTranslations("AdminRates");

  return (
    <div className="grid gap-2 rounded-[var(--radius-lg)] border border-border bg-background/45 p-3">
      <div>
        <p className="font-ui text-sm font-semibold text-foreground">
          {t("drawer.projectsUsingCentralRate")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("drawer.projectsUsingCentralRateDescription")}
        </p>
      </div>
      <div className="grid gap-2">
        {assignments.map((assignment) => (
          <div
            key={assignment.assignmentId}
            className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-ui text-sm font-semibold text-foreground">
                {assignment.projectName}
              </p>
              <p className="text-xs text-muted-foreground">{t("drawer.followsCentralRate")}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={Plus}
              onClick={() => onAddOverride(assignment.assignmentId)}
            >
              {t("actions.addOverride")}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function UnavailableOverrideProjects({
  hasAssignments,
  hasExistingOverrides,
}: {
  hasAssignments: boolean;
  hasExistingOverrides: boolean;
}) {
  const t = useTranslations("AdminRates");
  const message = !hasAssignments
    ? t("drawer.noAssignmentsForOverride")
    : hasExistingOverrides
      ? t("drawer.allProjectsHaveOverrides")
      : t("drawer.noProjectsForOverride");

  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-background/45 px-3 py-3 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function RatePeriodForm({
  defaultCurrency,
  todayDate,
  currencyOptions,
  actionState,
  pending,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  defaultCurrency: string;
  todayDate: string;
  currencyOptions: readonly SelectOption[];
  actionState: RateActionState;
  pending: boolean;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (input: Omit<CreateMemberDefaultRateActionInput, "memberId">) => void;
}) {
  const t = useTranslations("AdminRates");

  return (
    <form
      className="grid gap-4 rounded-[var(--radius-lg)] border border-border bg-background/45 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        onSubmit({
          validFrom: getRateFormString(formData, "validFrom"),
          validTo: getRateFormString(formData, "validTo"),
          hourlyRate: getRateFormString(formData, "hourlyRate"),
          currencyCode: getRateFormString(formData, "currencyCode"),
          note: getRateFormString(formData, "note"),
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("fields.validFrom")}
          required
          reserveMessageSpace
          error={actionState.fieldErrors?.validFrom}
        >
          {({ id, describedBy, invalid, required }) => (
            <Input
              id={id}
              name="validFrom"
              type="date"
              defaultValue={todayDate}
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
            />
          )}
        </Field>
        <Field
          label={t("fields.validTo")}
          reserveMessageSpace
          error={actionState.fieldErrors?.validTo}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="validTo"
              type="date"
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("fields.hourlyRate")}
          required
          reserveMessageSpace
          error={actionState.fieldErrors?.hourlyRate}
        >
          {({ id, describedBy, invalid, required }) => (
            <Input
              id={id}
              name="hourlyRate"
              type="number"
              min="0"
              step="0.01"
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
            />
          )}
        </Field>
        <Field
          label={t("fields.currency")}
          required
          reserveMessageSpace
          error={actionState.fieldErrors?.currencyCode}
        >
          {({ id, describedBy, invalid, required }) => (
            <select
              id={id}
              name="currencyCode"
              defaultValue={defaultCurrency}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required={required}
              className={nativeSelectClassName}
            >
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Field label={t("fields.reason")} reserveMessageSpace error={actionState.fieldErrors?.note}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="note"
            placeholder={t("fields.reasonPlaceholder")}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>
      <DrawerFooter className="mt-0">
        {onCancel ? (
          <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
            {t("actions.cancel")}
          </Button>
        ) : null}
        <Button type="submit" icon={BadgeDollarSign} loading={pending}>
          {submitLabel}
        </Button>
      </DrawerFooter>
    </form>
  );
}

function RateTimeline({ periods }: { periods: AdminRatePeriodRow[] }) {
  const t = useTranslations("AdminRates");
  const sortedPeriods = [...periods].sort((left, right) =>
    left.validFrom.localeCompare(right.validFrom),
  );
  const currentPeriod = getCurrentPeriod(sortedPeriods);

  return (
    <div className="grid gap-1">
      {sortedPeriods.map((period, index) => {
        const current = currentPeriod?.id === period.id;

        return (
          <div key={period.id} className="grid grid-cols-[1.25rem_1fr] gap-3 py-2">
            <div className="relative flex justify-center">
              <span
                className={cn("mt-2 size-2 rounded-full", current ? "bg-accent" : "bg-border")}
              />
              {index < sortedPeriods.length - 1 ? (
                <span className="absolute bottom-[-0.5rem] top-5 w-px bg-border" />
              ) : null}
            </div>
            <div className="grid gap-2 rounded-[var(--radius-md)] border border-border bg-card px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-ui text-sm font-semibold text-foreground">
                    {formatRateValue(period)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {period.validTo
                      ? t("timeline.range", { from: period.validFrom, to: period.validTo })
                      : t("timeline.openEnded", { from: period.validFrom })}
                  </p>
                </div>
                {current ? <Badge tone="success">{t("labels.current")}</Badge> : null}
              </div>
              <div className="grid gap-1 text-xs text-muted-foreground">
                <span>
                  {t("timeline.addedBy", {
                    name: period.createdByName,
                    date: formatTimestamp(period.createdAt),
                  })}
                </span>
                <span>
                  {period.note
                    ? t("timeline.reason", { reason: period.note })
                    : t("timeline.noReason")}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RateAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-ui font-semibold text-primary-foreground",
        size === "lg" ? "size-11 text-sm" : "size-8 text-xs",
      )}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  );
}

function getMemberOverrideCount(memberId: string, assignmentRates: AdminAssignmentRateRow[]) {
  return assignmentRates.filter(
    (assignment) => assignment.memberId === memberId && assignment.overrideRatePeriods.length > 0,
  ).length;
}

function getCurrentPeriod(periods: AdminRatePeriodRow[]) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    periods.find(
      (period) => period.validFrom <= today && (!period.validTo || period.validTo > today),
    ) ?? null
  );
}

function formatRateValue(rate: AdminRatePeriodRow) {
  const amount = Number(rate.hourlyRate);
  const formattedAmount = Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", {
        maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
      }).format(amount)
    : rate.hourlyRate;

  return `${formattedAmount} ${rate.currencyCode}/h`;
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toISOString().slice(0, 16).replace("T", " ");
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${second}`.toUpperCase();
}

function getRateFormString(formData: FormData, name: RateFormField) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
