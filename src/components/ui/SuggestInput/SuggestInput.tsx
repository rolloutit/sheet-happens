"use client";

import type * as React from "react";
import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from "react";

import { findFoldedMatch } from "@/src/lib/text-search";
import { useMediaQuery } from "@/src/lib/use-media-query";
import { cn } from "@/src/lib/utils";
import { focusChromeClassName } from "../focusRing";
import type { SuggestInputProps, SuggestOption } from "./SuggestInput.types";

/**
 * A text field that remembers: free text, with a list of the caller's suggestions under it.
 *
 * Neither existing control fits this shape. `Combobox` is select-from-a-closed-set — its value must
 * be one of the options and its trigger is a button, not a field. `Command` is a palette. What a
 * description field needs is the WAI-ARIA *editable* combobox: the typed text is the value and the
 * list is optional help, so a member can accept a past description or ignore the list entirely and
 * write something new.
 *
 * Two rules here exist to prevent bugs rather than to be nice, and both are tested:
 *
 * - **Enter with an active option accepts it and does not submit.** A description ends up on an
 *   invoice line, so half-picking a suggestion must never also log the entry. The second Enter
 *   submits, because by then the list is closed.
 * - **Escape closes the list, not the dialog around it.** Both the entry dialog's own focus trap
 *   and Radix's dismissable layers listen on `document`, and in the App Router React delegates its
 *   events from `document` too — where `stopPropagation` alone does not stop a sibling listener. So
 *   the handler stops immediate propagation on the native event while the list is open, and does
 *   nothing at all once it is closed.
 *
 * Focus never leaves the field. Arrow keys move `aria-activedescendant`, which is what keeps the
 * surrounding focus traps out of the interaction entirely.
 */
export function SuggestInput({
  as = "input",
  value,
  onValueChange,
  onAccept,
  options,
  labels,
  emptyStateLimit = 0,
  visibleLimit,
  layout = "auto",
  fieldRef,
  id,
  name,
  placeholder,
  rows = 3,
  disabled = false,
  invalid = false,
  autoFocus = false,
  className,
  fieldClassName,
  onKeyDown,
  onBlur,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: SuggestInputProps) {
  const generatedId = useId();
  const fieldId = id ?? `suggest-${generatedId}`;
  const listId = `${fieldId}-list`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [announcedCount, setAnnouncedCount] = useState<number | null>(null);

  /* Matches the `lg` breakpoint the rest of `/time` splits on, and assumes desktop before hydration
     for the same reason that page does: it is the primary form factor, and a phone corrects itself
     inside `useSyncExternalStore`'s first synchronous re-render. */
  const wide = useMediaQuery("(min-width: 64rem)", { serverSnapshot: true });
  const resolvedLayout = layout === "auto" ? (wide ? "popover" : "block") : layout;
  const rowLimit = visibleLimit ?? (resolvedLayout === "block" ? 4 : 6);

  const query = value.trim();
  const filtered = query ? rankByMatch(options, query) : options.slice(0, emptyStateLimit);
  const visible = filtered.slice(0, rowLimit);
  // Clamped on read rather than synced in an effect: the option list changes on every keystroke,
  // and an index that outlived its option simply means "nothing is active".
  const active = activeIndex >= 0 && activeIndex < visible.length ? activeIndex : -1;
  const hasEmptyState = Boolean(query) && options.length > 0 && visible.length === 0;
  const listOpen = open && !disabled && (visible.length > 0 || hasEmptyState);

  const optionId = (index: number) => `${listId}-option-${index}`;

  /* Announced on a delay, and only the count: the active option is already announced through
     `aria-activedescendant`, so reading the text here as well is the classic combobox double-speak.
     The timer is what keeps a fast typist from queuing eight announcements. */
  useEffect(() => {
    if (!listOpen) return;

    const timer = window.setTimeout(() => setAnnouncedCount(visible.length), 400);

    return () => window.clearTimeout(timer);
  }, [listOpen, visible.length]);

  /* By id rather than through a ref: `scrollIntoView` is the only thing this needs the element for,
     and looking it up here keeps a ref per option out of the render path. */
  useEffect(() => {
    if (!listOpen || active < 0) return;

    const row = document.getElementById(`${listId}-option-${active}`);

    // Guarded because jsdom has no `scrollIntoView`, and a test that renders this component should
    // not have to stub one to exercise the arrow keys.
    row?.scrollIntoView?.({ block: "nearest" });
  }, [listOpen, active, listId]);

  function accept(option: SuggestOption) {
    onValueChange(option.text);
    onAccept?.(option);
    setOpen(false);
    setActiveIndex(-1);
  }

  function move(delta: number) {
    if (!visible.length) return;

    const next = active < 0 ? (delta > 0 ? 0 : visible.length - 1) : active + delta;

    setActiveIndex(((next % visible.length) + visible.length) % visible.length);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (disabled) return;

    if (event.key === "Escape") {
      if (!listOpen) {
        onKeyDown?.(event);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      // See the note at the top: a document-level listener above us is not stopped by anything less.
      event.nativeEvent.stopImmediatePropagation();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const opensTheList =
        !listOpen &&
        // In a textarea the arrows are how a caret moves between lines, so they only open the list
        // when there is no text to move through — or on the APG's explicit Alt+Down chord.
        (event.altKey || as === "input" || !value);

      if (opensTheList) {
        if (!options.length) {
          onKeyDown?.(event);
          return;
        }

        event.preventDefault();
        setOpen(true);
        setActiveIndex(event.key === "ArrowDown" ? 0 : -1);
        return;
      }

      if (listOpen && !event.altKey) {
        event.preventDefault();
        move(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
    }

    if (event.key === "Enter" && listOpen) {
      if (active >= 0) {
        // Accepts, and deliberately does not submit: the form's own Enter handling gets the next
        // press, by which time the list is closed.
        event.preventDefault();
        accept(visible[active]);
        return;
      }

      setOpen(false);
      setActiveIndex(-1);
      // Falls through to the caller, so this same press still submits.
    }

    if (event.key === "Tab" && listOpen) {
      // Closes without accepting. Tab moves on; only Enter and a click commit a suggestion.
      setOpen(false);
      setActiveIndex(-1);
    }

    onKeyDown?.(event);
  }

  const fieldProps = {
    id: fieldId,
    name,
    value,
    placeholder,
    disabled,
    autoFocus,
    role: "combobox" as const,
    "aria-expanded": listOpen,
    "aria-controls": listOpen ? listId : undefined,
    "aria-autocomplete": "list" as const,
    "aria-activedescendant": active >= 0 ? optionId(active) : undefined,
    "aria-invalid": invalid || undefined,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    // The browser's own history dropdown over this listbox is the one overlap that would make the
    // field worse than it was before.
    autoComplete: "off",
    className: cn(
      "w-full rounded-[var(--radius-md)] border border-input bg-surface-inset px-3 py-2 text-sm text-foreground shadow-sm transition placeholder:text-subtle-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
      focusChromeClassName,
      fieldClassName,
    ),
    onChange: (event: { target: { value: string } }) => {
      onValueChange(event.target.value);
      setActiveIndex(-1);
      setOpen(true);
    },
    onFocus: () => {
      // The zero-keystroke state: focus an empty field and the top few are already there.
      if (!value.trim() && emptyStateLimit > 0 && options.length > 0) setOpen(true);
    },
    onBlur: () => {
      setOpen(false);
      setActiveIndex(-1);
      onBlur?.();
    },
    onKeyDown: handleKeyDown,
  };

  return (
    <div className={cn("relative grid gap-1", className)}>
      {as === "textarea" ? (
        <textarea
          {...fieldProps}
          /* One ref prop for two element types: the union is what a caller can hold, and the
             branch it lands in is the one this component rendered. */
          ref={fieldRef as React.Ref<HTMLTextAreaElement>}
          rows={rows}
          className={cn(fieldProps.className, "min-h-20 resize-y")}
        />
      ) : (
        <input {...fieldProps} ref={fieldRef as React.Ref<HTMLInputElement>} type="text" />
      )}

      {/* Announced only while it still describes what is on screen: the count is set on a timer, so
          a list that closed and reopened would otherwise read out the previous query's number for
          as long as the timer takes to catch up. */}
      <span role="status" aria-live="polite" className="sr-only">
        {listOpen && announcedCount === visible.length ? labels.count(announcedCount) : ""}
      </span>

      {/* Unmounted rather than hidden while closed: there is no transition to keep alive, and a
          listbox that lingers in the tree is one more thing that can be read out by mistake. */}
      {listOpen ? (
        <div
          className={cn(
            resolvedLayout === "popover"
              ? "absolute left-0 right-0 top-full z-50 mt-1"
              : "static mt-0.5",
          )}
        >
          <div className="overflow-hidden rounded-[var(--radius-md)] border border-border-strong bg-popover shadow-panel">
            {visible.length ? (
              <ul
                id={listId}
                role="listbox"
                aria-label={labels.list}
                className="max-h-[15rem] overflow-y-auto py-1"
              >
                {segmentOptions(visible, labels.groups).map((segment) =>
                  segment.heading ? (
                    /* A real `group`, not a heading row: a listbox may only contain options and
                       groups, and the group's own label is what a screen reader announces when the
                       active option moves into it. The visible caption is therefore decorative. */
                    <li key={segment.key} role="group" aria-label={segment.heading}>
                      <span
                        aria-hidden="true"
                        className="block px-3 pb-1 pt-2 font-ui text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground"
                      >
                        {segment.heading}
                      </span>
                      <ul role="presentation">
                        {segment.rows.map(({ option, index }) => (
                          <SuggestRow
                            key={option.text}
                            option={option}
                            query={query}
                            id={optionId(index)}
                            active={index === active}
                            onSelect={() => accept(option)}
                          />
                        ))}
                      </ul>
                    </li>
                  ) : (
                    segment.rows.map(({ option, index }) => (
                      <SuggestRow
                        key={option.text}
                        option={option}
                        query={query}
                        id={optionId(index)}
                        active={index === active}
                        onSelect={() => accept(option)}
                      />
                    ))
                  ),
                )}
              </ul>
            ) : (
              <p className="px-3 py-2 text-xs text-muted-foreground">{labels.empty}</p>
            )}

            {labels.hint && visible.length ? (
              <p className="border-t border-border px-3 py-1.5 font-ui text-[11px] text-subtle-foreground">
                {labels.hint}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SuggestRow({
  option,
  query,
  id,
  active,
  onSelect,
}: {
  option: SuggestOption;
  query: string;
  id: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      className={cn(
        "cursor-pointer px-3 py-2 text-sm leading-snug transition-colors duration-[var(--duration-micro)]",
        // 44px of target on a phone, where hover does not exist and the list sits in flow.
        "min-h-11 sm:min-h-0",
        active ? "bg-accent-soft text-foreground" : "text-foreground hover:bg-secondary",
      )}
      /* Keeps focus in the field, so the blur handler cannot close the list before the click
           lands — the standard combobox trick, and the reason accepting never moves focus. */
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    >
      <span className="block truncate">{highlight(option.text, query)}</span>
      {option.meta ? (
        <span className="mt-0.5 block truncate font-ui text-[11px] text-muted-foreground">
          {option.meta}
        </span>
      ) : null}
    </li>
  );
}

type SuggestSegment = {
  key: string;
  /** The group's label, or `undefined` for the ungrouped run at the top. */
  heading?: string;
  /** Each row keeps the index it has in the flat visible list — the one `activedescendant` uses. */
  rows: Array<{ option: SuggestOption; index: number }>;
};

/**
 * Consecutive runs of options that share a group, so each labelled run can be rendered as one
 * ARIA `group` while the flat index every keyboard behaviour depends on stays intact.
 */
function segmentOptions(
  options: readonly SuggestOption[],
  groups: Record<string, string> | undefined,
): SuggestSegment[] {
  const segments: SuggestSegment[] = [];

  options.forEach((option, index) => {
    const heading = option.group ? groups?.[option.group] : undefined;
    const last = segments.at(-1);

    if (last && last.heading === heading) {
      last.rows.push({ option, index });
      return;
    }

    segments.push({ key: `${heading ?? ""}-${index}`, heading, rows: [{ option, index }] });
  });

  return segments;
}

/**
 * Matches first, in the caller's order.
 *
 * A hit at the start of a word outranks one in the middle of it — `plan` should find
 * `Sprint planning` before `Deployment planning` only if the caller ranked it first, but it should
 * always find both before something that merely contains the letters. Beyond that the server's
 * ranking stands: this function never reorders two matches of the same quality.
 */
function rankByMatch(options: readonly SuggestOption[], query: string) {
  const matched: Array<{ option: SuggestOption; atWordStart: boolean; order: number }> = [];

  options.forEach((option, order) => {
    const match = findFoldedMatch(option.text, query);

    if (match) matched.push({ option, atWordStart: match.atWordStart, order });
  });

  return matched
    .sort((left, right) => {
      if (left.atWordStart !== right.atWordStart) return left.atWordStart ? -1 : 1;

      return left.order - right.order;
    })
    .map((entry) => entry.option);
}

/** The matched slice, emphasized in place — accent-folded, so an unaccented query still lands. */
function highlight(text: string, query: string): ReactNode {
  const match = query ? findFoldedMatch(text, query) : null;

  if (!match) return text;

  return (
    <>
      {text.slice(0, match.start)}
      <span className="font-semibold text-accent">{text.slice(match.start, match.end)}</span>
      {text.slice(match.end)}
    </>
  );
}
