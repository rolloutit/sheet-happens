import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import { SectionHead } from "@/src/components/ui/SectionHead";
import {
  mapMemberToShellProfile,
  mapMemberToShellRole,
  mapMemberToShellUser,
  requireActiveAppMember,
} from "@/src/server/auth/app-access";
import { listEmployeePayslips, type PayslipListRow } from "@/src/server/payslips";
import { EmployeePayslipList } from "./EmployeePayslipList";

export const dynamic = "force-dynamic";

type PayslipsPageProps = {
  searchParams?: Promise<{
    page?: string | string[];
  }>;
};

export default async function PayslipsPage({ searchParams }: PayslipsPageProps) {
  const { member } = await requireActiveAppMember("/payslips");

  if (member.currentProfile !== "EMPLOYEE") {
    notFound();
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const page = typeof resolvedSearchParams.page === "string" ? resolvedSearchParams.page : null;
  const [payslips, t, locale] = await Promise.all([
    listEmployeePayslips(member.id, page),
    getTranslations("Payslips"),
    getLocale(),
  ]);
  const dateFormatter = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const timestampFormatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const byteFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  return (
    <AppShell
      current="payslips"
      role={mapMemberToShellRole(member)}
      profile={mapMemberToShellProfile(member)}
      user={mapMemberToShellUser(member)}
    >
      <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow={t("employee.eyebrow")}
          title={t("employee.title")}
          subtitle={t("employee.subtitle")}
        />
        <EmployeePayslipList
          latest={
            payslips.latest
              ? mapPayslipItem(payslips.latest, dateFormatter, timestampFormatter, byteFormatter)
              : null
          }
          history={payslips.history.map((payslip) =>
            mapPayslipItem(payslip, dateFormatter, timestampFormatter, byteFormatter),
          )}
          pagination={{
            page: payslips.historyPage,
            totalPages: payslips.totalHistoryPages,
            totalItems: payslips.totalHistoryItems,
          }}
        />
      </section>
    </AppShell>
  );
}

function mapPayslipItem(
  payslip: PayslipListRow,
  dateFormatter: Intl.DateTimeFormat,
  timestampFormatter: Intl.DateTimeFormat,
  byteFormatter: Intl.NumberFormat,
) {
  return {
    id: payslip.id,
    month: dateFormatter.format(payslip.periodStart),
    filename: payslip.originalFilename,
    fileSize: formatBytes(payslip.byteSize, byteFormatter),
    publishedAt: payslip.publishedAt ? timestampFormatter.format(payslip.publishedAt) : null,
  };
}

function formatBytes(byteSize: bigint, formatter: Intl.NumberFormat) {
  const bytes = Number(byteSize);
  if (bytes < 1024 * 1024) return `${formatter.format(bytes / 1024)} KB`;
  return `${formatter.format(bytes / (1024 * 1024))} MB`;
}
