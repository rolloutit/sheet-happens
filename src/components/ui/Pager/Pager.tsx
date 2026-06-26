import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Button } from "../Button";
import type { PagerProps } from "./Pager.types";

type PageRangeItem = number | "ellipsis-start" | "ellipsis-end";

function getPageRange(page: number, totalPages: number, siblingCount: number): PageRangeItem[] {
  if (totalPages <= 1) return [1];

  const safePage = Math.min(Math.max(page, 1), totalPages);
  const safeSiblingCount = Math.max(0, siblingCount);
  const maxVisible = safeSiblingCount * 2 + 5;

  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const left = Math.max(2, safePage - safeSiblingCount);
  const right = Math.min(totalPages - 1, safePage + safeSiblingCount);
  const pages: PageRangeItem[] = [1];

  if (left > 2) pages.push("ellipsis-start");

  for (let pageNumber = left; pageNumber <= right; pageNumber += 1) {
    pages.push(pageNumber);
  }

  if (right < totalPages - 1) pages.push("ellipsis-end");

  pages.push(totalPages);
  return pages;
}

export function Pager({
  page,
  totalPages,
  totalItems,
  onPageChange,
  labels,
  showPageNumbers,
  siblingCount = 1,
  className,
  ...props
}: PagerProps) {
  const previousPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;
  const pageRange = getPageRange(page, totalPages, siblingCount);

  return (
    <nav
      aria-label={labels?.navigation ?? "Pagination"}
      className={cn("flex items-center justify-between gap-3", className)}
      {...props}
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {labels?.summary ? (
          labels.summary(page, totalPages, totalItems)
        ) : (
          <>
            Page <span className="font-semibold text-foreground">{page}</span> of{" "}
            <span className="font-semibold text-foreground">{totalPages}</span>
            {typeof totalItems === "number" ? `, ${totalItems} items` : ""}
          </>
        )}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="soft"
          size="sm"
          icon={ChevronLeft}
          aria-label={labels?.previousPage?.(previousPage) ?? `Go to page ${previousPage}`}
          disabled={!canGoPrevious}
          onClick={() => {
            if (canGoPrevious) onPageChange?.(previousPage);
          }}
        >
          {labels?.previous ?? "Prev"}
        </Button>
        {showPageNumbers ? (
          <div className="hidden items-center gap-1 sm:flex">
            {pageRange.map((item) => {
              if (typeof item !== "number") {
                return (
                  <span
                    key={item}
                    className="grid size-8 place-items-center text-sm text-muted-foreground"
                    aria-hidden="true"
                  >
                    ...
                  </span>
                );
              }

              const current = item === page;

              return (
                <button
                  key={item}
                  type="button"
                  aria-current={current ? "page" : undefined}
                  aria-label={
                    current
                      ? (labels?.currentPage?.(item) ?? `Current page, page ${item}`)
                      : (labels?.page?.(item) ?? `Go to page ${item}`)
                  }
                  className={cn(
                    "grid size-8 place-items-center rounded-[var(--radius-md)] font-ui text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    current
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                  onClick={() => {
                    if (!current) onPageChange?.(item);
                  }}
                >
                  {item}
                </button>
              );
            })}
          </div>
        ) : null}
        <Button
          type="button"
          variant="soft"
          size="sm"
          icon={ChevronRight}
          aria-label={labels?.nextPage?.(nextPage) ?? `Go to page ${nextPage}`}
          disabled={!canGoNext}
          onClick={() => {
            if (canGoNext) onPageChange?.(nextPage);
          }}
        >
          {labels?.next ?? "Next"}
        </Button>
      </div>
    </nav>
  );
}
