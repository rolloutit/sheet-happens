import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TimeZoomShell, type TimeZoomDay } from "./TimeZoomShell";
import { ESCAPE_ZOOM_GRACE_MS, timeScopes, type TimeScope, type WeekLens } from "./zoom";

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The design doc's own example week, which spans two months: Aug 31 - Sep 6, 2026. */
const days: TimeZoomDay[] = [
  "2026-08-31",
  "2026-09-01",
  "2026-09-02",
  "2026-09-03",
  "2026-09-04",
  "2026-09-05",
  "2026-09-06",
].map((isoDate, index) => ({
  isoDate,
  label: dayNames[index],
  shortLabel: dayNames[index].slice(0, 3),
  dayNumber: String(Number.parseInt(isoDate.slice(8), 10)),
  state: index === 2 ? "today" : index > 2 ? "future" : "normal",
  locked: false,
  // Mon-Wed logged, Wednesday over the 8h target; the rest of the week empty.
  totalMinutes: [240, 480, 600, 0, 0, 0, 0][index],
}));

const handlers = {
  onScopeChange: vi.fn(),
  onSelectDay: vi.fn(),
  onPeriod: vi.fn(),
  onToday: vi.fn(),
  onToggleLens: vi.fn(),
  onCompose: vi.fn(),
  onTimer: vi.fn(),
  onHelp: vi.fn(),
};

function renderShell(
  overrides: Partial<{
    scope: TimeScope;
    lens: WeekLens;
    stops: readonly TimeScope[];
    toolbar: React.ReactNode;
    children: React.ReactNode;
    focusFallback: React.RefObject<HTMLElement | null>;
  }> = {},
) {
  const focusFallback = overrides.focusFallback ?? createRef<HTMLElement>();

  return render(
    <TimeZoomShell
      scope={overrides.scope ?? "week"}
      lens={overrides.lens ?? "agenda"}
      stops={overrides.stops ?? timeScopes}
      days={days}
      selectedDayIso="2026-09-02"
      weekStart="2026-08-31"
      viewKey={`${overrides.scope ?? "week"}:agenda:2026-08-31`}
      move={null}
      announcement="Week · Week 36 · 22 h"
      toolbar={overrides.toolbar ?? <div data-testid="toolbar" />}
      swipeEnabled
      focusFallback={focusFallback}
      formatMinutes={(minutes) => `${minutes / 60} h`}
      ribbonLabels={{
        group: "Days of this week",
        selectDay: (day) => `Select ${day.label}`,
        capacity: (day) => `${day.totalMinutes / 60} h of 8 h`,
        over: "over 8 h",
        locked: "Locked",
        today: "Today",
      }}
      {...handlers}
    >
      {overrides.children ?? <div data-testid="content" />}
    </TimeZoomShell>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TimeZoomShell", () => {
  it("renders the ribbon in the Day scope only, with one chip pressed", () => {
    const { rerender, unmount } = renderShell({ scope: "week" });

    expect(screen.queryByRole("group", { name: "Days of this week" })).not.toBeInTheDocument();
    unmount();
    void rerender;

    renderShell({ scope: "day" });

    const ribbon = screen.getByRole("group", { name: "Days of this week" });
    expect(ribbon).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Wednesday" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
  });

  it("reports a chip press as a day selection", async () => {
    const user = userEvent.setup();
    renderShell({ scope: "day" });

    await user.click(screen.getByRole("button", { name: "Select Friday" }));

    expect(handlers.onSelectDay).toHaveBeenCalledWith("2026-09-04");
  });

  it("measures each chip against the 8h soft target and marks the day over it", () => {
    renderShell({ scope: "day" });

    // The bar is decoration; the figures reach the user through the chip's own description.
    expect(screen.getByRole("button", { name: "Select Monday" })).toHaveAttribute(
      "title",
      "4 h of 8 h",
    );
    expect(
      screen.getByRole("button", { name: "Select Wednesday" }).querySelector('[role="img"]'),
    ).toHaveAttribute("aria-label", "over 8 h");
  });

  describe("keyboard", () => {
    it("jumps and steps between scopes", async () => {
      const user = userEvent.setup();
      renderShell({ scope: "week" });

      await user.keyboard("1");
      expect(handlers.onScopeChange).toHaveBeenLastCalledWith("day");

      await user.keyboard("3");
      expect(handlers.onScopeChange).toHaveBeenLastCalledWith("month");

      await user.keyboard("-");
      expect(handlers.onScopeChange).toHaveBeenLastCalledWith("month");

      await user.keyboard("+");
      expect(handlers.onScopeChange).toHaveBeenLastCalledWith("day");
    });

    it("moves the period with J and K and the brackets, and jumps to today", async () => {
      const user = userEvent.setup();
      renderShell();

      await user.keyboard("k");
      await user.keyboard("j");
      // `[` opens a key-code descriptor in userEvent's keyboard syntax; doubling escapes it.
      await user.keyboard("[[");
      await user.keyboard("]");
      await user.keyboard("t");

      expect(handlers.onPeriod.mock.calls).toEqual([
        ["previous"],
        ["next"],
        ["previous"],
        ["next"],
      ]);
      expect(handlers.onToday).toHaveBeenCalledTimes(1);
    });

    it("hands the lens, the composer, the timer and the sheet to the screen", async () => {
      const user = userEvent.setup();
      renderShell();

      await user.keyboard("g");
      await user.keyboard("n");
      await user.keyboard("s");
      await user.keyboard("?");

      expect(handlers.onToggleLens).toHaveBeenCalledTimes(1);
      expect(handlers.onCompose).toHaveBeenCalledTimes(1);
      expect(handlers.onTimer).toHaveBeenCalledTimes(1);
      expect(handlers.onHelp).toHaveBeenCalledTimes(1);
    });

    it("zooms out one step on Escape when nothing is open, and not at the widest scope", async () => {
      const user = userEvent.setup();
      const first = renderShell({ scope: "day" });

      await user.keyboard("{Escape}");
      expect(handlers.onScopeChange).toHaveBeenLastCalledWith("week");
      first.unmount();

      vi.clearAllMocks();
      renderShell({ scope: "month" });
      await user.keyboard("{Escape}");
      expect(handlers.onScopeChange).not.toHaveBeenCalled();
    });

    it("leaves Escape to an open overlay, and ignores the reflex press right after it closes", async () => {
      let now = 1_000_000;
      const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
      const user = userEvent.setup();

      // The page's dialogs portal to `body`, beside the shell rather than inside its animated view.
      function Page({ dialogOpen }: { dialogOpen: boolean }) {
        return (
          <div>
            {dialogOpen ? <div role="dialog">open</div> : null}
            <TimeZoomShell
              scope="day"
              lens="agenda"
              stops={timeScopes}
              days={days}
              selectedDayIso="2026-09-02"
              weekStart="2026-08-31"
              viewKey="day:-:2026-09-02"
              move={null}
              announcement=""
              toolbar={null}
              swipeEnabled
              focusFallback={createRef<HTMLElement>()}
              formatMinutes={(minutes) => `${minutes / 60} h`}
              ribbonLabels={{
                group: "Days of this week",
                selectDay: (day) => `Select ${day.label}`,
                capacity: () => "",
                over: "over 8 h",
                locked: "Locked",
                today: "Today",
              }}
              {...handlers}
            >
              <div>content</div>
            </TimeZoomShell>
          </div>
        );
      }

      const { rerender } = render(<Page dialogOpen />);

      await user.keyboard("{Escape}");
      expect(handlers.onScopeChange).not.toHaveBeenCalled();

      // The overlay closes; a second Escape inside the grace window is still swallowed.
      rerender(<Page dialogOpen={false} />);
      await user.keyboard("{Escape}");
      expect(handlers.onScopeChange).not.toHaveBeenCalled();

      now += ESCAPE_ZOOM_GRACE_MS + 1;
      await user.keyboard("{Escape}");
      expect(handlers.onScopeChange).toHaveBeenLastCalledWith("week");
      clock.mockRestore();
    });

    it("cannot reach a scope the member does not have", async () => {
      const user = userEvent.setup();
      renderShell({ scope: "month", stops: ["month"] });

      await user.keyboard("2");
      await user.keyboard("+");
      expect(handlers.onScopeChange).not.toHaveBeenCalled();
    });

    it("stays out of the way while a field has the keystroke", async () => {
      const user = userEvent.setup();
      renderShell({ children: <input aria-label="Hours" /> });

      await user.click(screen.getByRole("textbox", { name: "Hours" }));
      await user.keyboard("3");

      expect(handlers.onScopeChange).not.toHaveBeenCalled();
      expect(screen.getByRole("textbox", { name: "Hours" })).toHaveValue("3");
    });
  });

  describe("continuity", () => {
    it("moves focus to the fallback when the scope change took the focused element with it", () => {
      const focusFallback = createRef<HTMLElement>();
      const { rerender } = render(
        <div>
          <button
            ref={(node) => {
              focusFallback.current = node;
            }}
            type="button"
          >
            Period
          </button>
          <TimeZoomShell
            scope="week"
            lens="agenda"
            stops={timeScopes}
            days={days}
            selectedDayIso="2026-09-02"
            weekStart="2026-08-31"
            viewKey="week:agenda:2026-08-31"
            move={null}
            announcement=""
            toolbar={null}
            swipeEnabled
            focusFallback={focusFallback}
            formatMinutes={() => ""}
            ribbonLabels={{
              group: "Days of this week",
              selectDay: (day) => `Select ${day.label}`,
              capacity: () => "",
              over: "",
              locked: "",
              today: "",
            }}
            {...handlers}
          >
            <button type="button">Wednesday column</button>
          </TimeZoomShell>
        </div>,
      );

      screen.getByRole("button", { name: "Wednesday column" }).focus();

      rerender(
        <div>
          <button
            ref={(node) => {
              focusFallback.current = node;
            }}
            type="button"
          >
            Period
          </button>
          <TimeZoomShell
            scope="day"
            lens="agenda"
            stops={timeScopes}
            days={days}
            selectedDayIso="2026-09-02"
            weekStart="2026-08-31"
            viewKey="day:-:2026-09-02"
            move={null}
            announcement=""
            toolbar={null}
            swipeEnabled
            focusFallback={focusFallback}
            formatMinutes={() => ""}
            ribbonLabels={{
              group: "Days of this week",
              selectDay: (day) => `Select ${day.label}`,
              capacity: () => "",
              over: "",
              locked: "",
              today: "",
            }}
            {...handlers}
          >
            <div>day</div>
          </TimeZoomShell>
        </div>,
      );

      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Period" }));
    });

    it("announces the view politely, outside any accessible name", () => {
      const { container } = renderShell();

      const live = container.querySelector('[aria-live="polite"]');
      expect(live).toHaveTextContent("Week · Week 36 · 22 h");
      expect(live).toHaveClass("sr-only");
    });
  });
});
