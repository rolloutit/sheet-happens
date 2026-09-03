import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/en.json";

import { TimeZoomShell, type TimeZoomDay } from "./TimeZoomShell";
import { zoomStorageKey, type ZoomLevel } from "./zoom";

/**
 * The axis keeps its state in the URL and writes it with `replaceState`, so the test needs both
 * halves of what Next provides: `useSearchParams` reading `window.location`, and a re-render when
 * a History write changes it. Faking only the read would make every assertion below pass against a
 * component that never updates.
 */
const historyStore = vi.hoisted(() => {
  const listeners = new Set<() => void>();

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify() {
      for (const listener of listeners) listener();
    },
  };
});

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");

  return {
    useSearchParams: () =>
      new URLSearchParams(
        useSyncExternalStore(
          historyStore.subscribe,
          () => window.location.search,
          () => "",
        ),
      ),
  };
});

const nativeReplaceState = window.history.replaceState.bind(window.history);

window.history.replaceState = (...args: Parameters<History["replaceState"]>) => {
  nativeReplaceState(...args);
  historyStore.notify();
};

afterAll(() => {
  window.history.replaceState = nativeReplaceState;
});

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

const onPreviousPeriod = vi.fn();
const onNextPeriod = vi.fn();
const onToday = vi.fn();

function renderShell(renderLevel: (level: ZoomLevel) => React.ReactNode = showLevel) {
  return render(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
      <TimeZoomShell
        days={days}
        todayIso="2026-09-02"
        dayTotalMinutes={480}
        formatMinutes={(minutes) => `${minutes / 60} h`}
        onPreviousPeriod={onPreviousPeriod}
        onNextPeriod={onNextPeriod}
        onToday={onToday}
        renderLevel={renderLevel}
      />
    </NextIntlClientProvider>,
  );
}

function showLevel(level: ZoomLevel) {
  return <span data-testid="level">{level}</span>;
}

function currentLevel() {
  return screen.getByTestId("level").textContent;
}

beforeEach(() => {
  nativeReplaceState(null, "", "/time");
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("TimeZoomShell", () => {
  it("opens on the week and marks today", () => {
    renderShell();

    expect(currentLevel()).toBe("week");
    expect(screen.getByRole("button", { name: "Select Wednesday" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("opens on the level and day named by the URL", () => {
    nativeReplaceState(null, "", "/time?zoom=grid&day=2026-09-04");
    renderShell();

    expect(currentLevel()).toBe("grid");
    expect(screen.getByRole("button", { name: "Select Friday" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("opens on the remembered level when the URL names none", async () => {
    window.localStorage.setItem(zoomStorageKey, "day");
    renderShell();

    await waitFor(() => expect(currentLevel()).toBe("day"));
  });

  it("lets an explicit level in the URL outrank the remembered one", () => {
    window.localStorage.setItem(zoomStorageKey, "day");
    nativeReplaceState(null, "", "/time?zoom=grid");
    renderShell();

    expect(currentLevel()).toBe("grid");
  });

  it("writes the level to the URL and remembers it", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.keyboard("3");

    expect(currentLevel()).toBe("grid");
    expect(new URLSearchParams(window.location.search).get("zoom")).toBe("grid");
    expect(window.localStorage.getItem(zoomStorageKey)).toBe("grid");
  });

  it("keeps the selected day across a level change, in both directions", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Select Friday" }));
    await user.keyboard("1");
    expect(currentLevel()).toBe("day");

    await user.keyboard("3");
    expect(currentLevel()).toBe("grid");
    expect(screen.getByRole("button", { name: "Select Friday" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps the day strip mounted across a level change", async () => {
    const user = userEvent.setup();
    renderShell();

    const wednesday = screen.getByRole("button", { name: "Select Wednesday" });
    await user.keyboard("3");

    expect(currentLevel()).toBe("grid");
    expect(screen.getByRole("button", { name: "Select Wednesday" })).toBe(wednesday);
  });

  it("zooms out when the day you are already on is pressed at the day level", async () => {
    const user = userEvent.setup();
    nativeReplaceState(null, "", "/time?zoom=day");
    renderShell();

    await user.click(screen.getByRole("button", { name: "Back out to the week" }));

    expect(currentLevel()).toBe("week");
  });

  it("moves focus to the day chip when the level change takes the focused element with it", async () => {
    const user = userEvent.setup();
    renderShell((level) => (
      <div>
        <span data-testid="level">{level}</span>
        {level === "week" ? <button type="button">Wednesday column</button> : null}
      </div>
    ));

    screen.getByRole("button", { name: "Wednesday column" }).focus();
    await user.keyboard("1");

    expect(currentLevel()).toBe("day");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Back out to the week" }),
    );
  });

  it("leaves focus alone when it survived the level change", async () => {
    const user = userEvent.setup();
    renderShell((level) => (
      <div>
        <span data-testid="level">{level}</span>
        <button type="button">Add entry</button>
      </div>
    ));

    const addEntry = screen.getByRole("button", { name: "Add entry" });
    addEntry.focus();
    await user.keyboard("3");

    expect(currentLevel()).toBe("grid");
    expect(document.activeElement).toBe(addEntry);
  });

  describe("motion and capacity", () => {
    it("announces the level, its span and its total on a level change", async () => {
      const user = userEvent.setup();
      const { container } = renderShell();

      const live = container.querySelector('[aria-live="polite"]');

      // 240 + 480 + 600 across the week; the selected day is Wednesday's 600.
      expect(live).toHaveTextContent("Week · 7 days · 22 h");

      await user.keyboard("1");
      expect(live).toHaveTextContent("Day · 1 day · 8 h");

      await user.keyboard("3");
      expect(live).toHaveTextContent("Grid · 7 days · 22 h");
    });

    it("keeps the live region out of the accessible name of the day strip", () => {
      const { container } = renderShell();

      expect(container.querySelector('[aria-live="polite"]')).toHaveClass("sr-only");
      expect(screen.getByRole("button", { name: "Select Wednesday" })).toBeInTheDocument();
    });

    it("measures each day chip against the 8h soft target", () => {
      renderShell();

      // The bar is decoration; the figures reach the user through the chip's own description.
      expect(screen.getByRole("button", { name: "Select Monday" })).toHaveAttribute(
        "title",
        "4 h of 8 h",
      );
      expect(screen.getByRole("button", { name: "Select Thursday" })).toHaveAttribute(
        "title",
        "0 h of 8 h",
      );
    });

    it("caps a bar at the target rather than overflowing its track", () => {
      renderShell();

      const overTarget = screen
        .getByRole("button", { name: "Select Wednesday" })
        .querySelector("span > span");
      const underTarget = screen
        .getByRole("button", { name: "Select Monday" })
        .querySelector("span > span");

      // Wednesday logs 10h against an 8h target: full, and turned, but not 125% wide.
      expect(overTarget).toHaveClass("bg-warning");
      expect(underTarget).toHaveClass("bg-accent");
    });
  });

  describe("keyboard", () => {
    it("jumps and steps between levels", async () => {
      const user = userEvent.setup();
      renderShell();

      await user.keyboard("1");
      expect(currentLevel()).toBe("day");

      await user.keyboard("-");
      expect(currentLevel()).toBe("week");

      await user.keyboard("3");
      expect(currentLevel()).toBe("grid");

      await user.keyboard("+");
      expect(currentLevel()).toBe("week");
    });

    it("moves the period and goes to today", async () => {
      const user = userEvent.setup();
      renderShell();

      // `[` opens a key-code descriptor in userEvent's keyboard syntax; doubling escapes it.
      await user.keyboard("[[");
      await user.keyboard("]");
      await user.keyboard("t");

      expect(onPreviousPeriod).toHaveBeenCalledTimes(1);
      expect(onNextPeriod).toHaveBeenCalledTimes(1);
      expect(onToday).toHaveBeenCalledTimes(1);
    });

    it("stays out of the way while a field has the keystroke", async () => {
      const user = userEvent.setup();
      renderShell((level) => (
        <div>
          <span data-testid="level">{level}</span>
          <input aria-label="Hours" />
        </div>
      ));

      await user.click(screen.getByRole("textbox", { name: "Hours" }));
      await user.keyboard("3");

      expect(currentLevel()).toBe("week");
      expect(screen.getByRole("textbox", { name: "Hours" })).toHaveValue("3");
    });
  });
});
