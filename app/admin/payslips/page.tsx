import { getLocale, getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import { SectionHead } from "@/src/components/ui/SectionHead";
import { getPayslipMonthOptions } from "@/src/lib/payslip-month-options";
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
import { AdminPayslipClient } from "./AdminPayslipClient";
import { PayslipFilterBar } from "./PayslipFilterBar";

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
  const months = getPayslipMonthOptions(locale);
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

        <PayslipFilterBar
          query={result.filters.query ?? ""}
          employeeMemberIds={result.filters.employeeMemberIds}
          month={result.filters.month ?? ""}
          employeeOptions={result.employeeOptions}
          monthOptions={months}
        />

        <AdminPayslipClient
          rows={result.rows.map((payslip) => ({
            id: payslip.id,
            employeeMemberId: payslip.employeeMemberId,
            employeeName: payslip.employeeName,
            employeeEmail: payslip.employeeEmail,
            employeeStatus: payslip.employeeStatus,
            month: monthFormatter.format(payslip.periodStart),
            monthValue: payslip.periodStart.toISOString().slice(0, 7),
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

function formatBytes(byteSize: bigint, formatter: Intl.NumberFormat) {
  const bytes = Number(byteSize);
  if (bytes < 1024 * 1024) return `${formatter.format(bytes / 1024)} KB`;
  return `${formatter.format(bytes / (1024 * 1024))} MB`;
}
