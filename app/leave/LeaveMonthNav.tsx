"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/src/components/ui/Button";
import { formatMonthLabel } from "@/src/lib/formatting";
import { useLeaveText } from "./use-leave-labels";

function shiftMonth(month: string, amount: number) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}

/**
 * Previous / this month / next, as links so every month of the calendar has its own URL and the
 * browser's Back button walks back through them.
 */
export function LeaveMonthNav({
  pathname,
  month,
  currentMonth,
}: {
  pathname: "/leave" | "/admin/leave";
  /** `YYYY-MM`. */
  month: string;
  currentMonth: string;
}) {
  const { t, locale } = useLeaveText();
  const searchParams = useSearchParams();

  const hrefFor = (target: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", target);
    params.delete("page");
    return `${pathname}?${params.toString()}` as Route;
  };

  return (
    <nav aria-label={t("calendar.monthNav")} className="flex items-center gap-1">
      <Button asChild variant="ghost" size="icon" aria-label={t("calendar.previousMonth")}>
        <Link href={hrefFor(shiftMonth(month, -1))} scroll={false}>
          <ChevronLeft aria-hidden="true" />
        </Link>
      </Button>
      <h2
        aria-live="polite"
        className="min-w-40 text-center font-ui text-lg font-semibold text-foreground capitalize tabular-nums"
      >
        {formatMonthLabel(`${month}-01`, locale)}
      </h2>
      <Button asChild variant="ghost" size="icon" aria-label={t("calendar.nextMonth")}>
        <Link href={hrefFor(shiftMonth(month, 1))} scroll={false}>
          <ChevronRight aria-hidden="true" />
        </Link>
      </Button>
      {month !== currentMonth ? (
        <Button asChild variant="soft" size="sm" className="ml-1">
          <Link href={hrefFor(currentMonth)} scroll={false}>
            {t("calendar.thisMonth")}
          </Link>
        </Button>
      ) : null}
    </nav>
  );
}
