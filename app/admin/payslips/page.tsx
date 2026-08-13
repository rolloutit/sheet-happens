import { getLocale, getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import { Button } from "@/src/components/ui/Button";
import { Field } from "@/src/components/ui/Field";
import { SectionHead } from "@/src/components/ui/SectionHead";
import {
  mapMemberToShellProfile,
  mapMemberToShellUser,
  requireAdminAppMember,
} from "@/src/server/auth/app-access";
import {
  getPayslipMonthOverview,
  listPayslipsForAdmin,
  type PayslipListFilters,
} from "@/src/server/payslips";
import { AdminPayslipClient, type AdminPayslipMonthOption } from "./AdminPayslipClient";

export const dynamic = "force-dynamic";

type AdminPayslipsPageProps = {
  searchParams?: Promise<PayslipListFilters>;
};

export default async function AdminPayslipsPage({ searchParams }: AdminPayslipsPageProps) {
  const { member: admin } = await requireAdminAppMember("/admin/payslips");
  const [t, locale, filters] = await Promise.all([
    getTranslations("Payslips"),
    getLocale(),
    searchParams ?? Promise.resolve({}),
  ]);
  const months = getMonthOptions(locale);
  const result = await listPayslipsForAdmin(filters);
  const overviewMonth = result.filters.month ?? months[0].value;
  const overview = await getPayslipMonthOverview(new Date(`${overviewMonth}-01T00:00:00.000Z`));
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const timestampFormatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const byteFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  return (
    <AppShell
      current="payslips-admin"
      role="admin"
      profile={mapMemberToShellProfile(admin)}
      user={mapMemberToShellUser(admin)}
    >
      <section className="mx-auto grid w-full max-w-[92rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow={t("admin.eyebrow")}
          title={t("admin.title")}
          subtitle={t("admin.subtitle")}
        />

        <form className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_14rem_12rem_auto_auto] lg:items-end">
          <Field label={t("admin.filters.search")}>
            <input
              name="query"
              type="search"
              defaultValue={result.filters.query}
              placeholder={t("admin.filters.search")}
              className="h-10 w-full rounded-[var(--radius-sm)] border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </Field>
          <Field label={t("admin.filters.employee")}>
            <select
              name="employeeMemberId"
              defaultValue={result.filters.employeeMemberId ?? ""}
              className="h-10 w-full rounded-[var(--radius-sm)] border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="">{t("admin.filters.allEmployees")}</option>
              {result.employeeOptions.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} ({employee.email})
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("admin.filters.month")}>
            <select
              name="month"
              defaultValue={result.filters.month ?? ""}
              className="h-10 w-full rounded-[var(--radius-sm)] border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="">{t("admin.filters.allMonths")}</option>
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </Field>
          <input type="hidden" name="page" value="1" />
          <Button type="submit" className="h-10">
            {t("admin.filters.apply")}
          </Button>
          <Button asChild type="button" variant="ghost" className="h-10">
            <a href="/admin/payslips">{t("actions.clear")}</a>
          </Button>
        </form>

        <AdminPayslipClient
          rows={result.rows.map((payslip) => ({
            id: payslip.id,
            employeeMemberId: payslip.employeeMemberId,
            employeeName: payslip.employeeName,
            employeeEmail: payslip.employeeEmail,
            employeeStatus: payslip.employeeStatus,
            month: monthFormatter.format(payslip.periodStart),
            filename: payslip.originalFilename,
            fileSize: formatBytes(payslip.byteSize, byteFormatter),
            publishedAt: payslip.publishedAt
              ? timestampFormatter.format(payslip.publishedAt)
              : null,
            publishedByName: payslip.publishedByName,
          }))}
          employees={result.employeeOptions}
          months={months}
          selectedMonth={overviewMonth}
          overview={overview}
          pagination={{
            page: result.page,
            totalPages: result.totalPages,
            totalItems: result.totalItems,
          }}
        />
      </section>
    </AppShell>
  );
}

function getMonthOptions(locale: string): AdminPayslipMonthOption[] {
  const formatter = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const shortFormatter = new Intl.DateTimeFormat(locale, { month: "short" });
  const current = new Date();
  const currentMonth = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1));

  return Array.from({ length: 24 }, (_, index) => {
    const month = new Date(currentMonth);
    month.setUTCMonth(month.getUTCMonth() - index);
    const value = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;

    return {
      value,
      label: formatter.format(month),
      shortLabel: shortFormatter.format(month),
    };
  });
}

function formatBytes(byteSize: bigint, formatter: Intl.NumberFormat) {
  const bytes = Number(byteSize);
  if (bytes < 1024 * 1024) return `${formatter.format(bytes / 1024)} KB`;
  return `${formatter.format(bytes / (1024 * 1024))} MB`;
}
