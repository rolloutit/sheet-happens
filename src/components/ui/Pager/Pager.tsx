import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Button } from "../Button";
import type { PagerProps } from "./Pager.types";

export function Pager({
  page,
  totalPages,
  totalItems,
  onPageChange,
  className,
  ...props
}: PagerProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)} {...props}>
      <p className="text-sm text-muted-foreground">
        Page <span className="font-semibold text-foreground">{page}</span> of{" "}
        <span className="font-semibold text-foreground">{totalPages}</span>
        {typeof totalItems === "number" ? `, ${totalItems} items` : ""}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="soft"
          size="sm"
          icon={ChevronLeft}
          disabled={page <= 1}
          onClick={() => onPageChange?.(page - 1)}
        >
          Prev
        </Button>
        <Button
          type="button"
          variant="soft"
          size="sm"
          icon={ChevronRight}
          disabled={page >= totalPages}
          onClick={() => onPageChange?.(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
