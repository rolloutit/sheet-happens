import * as React from "react";

import { cn } from "@/src/lib/utils";
import { Input } from "../Input";
import type { TimeInputProps } from "./TimeInput.types";

/**
 * A brand-styled wrapper around the native `<input type="time">`.
 *
 * **This is a styling wrapper, not a picker, and that is deliberate — please do not
 * "finish the job" by replacing it with a popover.** Time entry is the highest-frequency
 * interaction in this app, and the native control gives segmented keyboard entry (type
 * `0930` and go), 12- or 24-hour presentation chosen by the operating system, and the
 * platform time wheel on mobile. Every popover replacement is strictly slower for the
 * person filling in their week, and a time field is text-shaped rather than a dropdown or a
 * calendar, so it was never part of what the brand-aware controls set out to replace.
 *
 * What it does fix is the chrome: the user-agent clock glyph is dimmed to inherit the
 * token palette rather than sitting there as an OS-blue artefact.
 */
export const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(
  ({ className, ...props }, ref) => (
    <Input
      ref={ref}
      type="time"
      className={cn(
        "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:invert-0 dark:[&::-webkit-calendar-picker-indicator]:invert",
        "[&::-webkit-datetime-edit-fields-wrapper]:p-0 [&::-webkit-datetime-edit]:text-foreground",
        className,
      )}
      {...props}
    />
  ),
);
TimeInput.displayName = "TimeInput";
