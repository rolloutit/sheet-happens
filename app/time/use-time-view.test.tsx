import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useTimeView } from "./use-time-view";
import {
  declaredOnlyScopes,
  lensStorageKey,
  scopeStorageKey,
  timeScopes,
  type TimeScope,
} from "./zoom";

/**
 * The view keeps its state in the URL and writes it with `replaceState`, so the test needs both
 * halves of what Next provides: `useSearchParams` reading `window.location`, and a re-render when
 * a History write changes it. Faking only the read would make every assertion below pass against a
 * hook that never updates.
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

/** The design doc's own example week, which spans two months: Aug 31 - Sep 6, 2026. */
const week = {
  days: [
    "2026-08-31",
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
    "2026-09-04",
    "2026-09-05",
    "2026-09-06",
  ].map((isoDate) => ({ isoDate })),
  todayIso: "2026-09-02",
};

function Harness({ stops = timeScopes }: { stops?: readonly TimeScope[] }) {
  const view = useTimeView(week, stops);

  return (
    <div>
      <span data-testid="scope">{view.scope}</span>
      <span data-testid="lens">{view.lens}</span>
      <span data-testid="day">{view.selectedDayIso}</span>
      <button type="button" onClick={() => view.setScope("month")}>
        month
      </button>
      <button type="button" onClick={() => view.setLens("grid")}>
        grid
      </button>
      <button type="button" onClick={() => view.zoomToDay("2026-09-04")}>
        open friday
      </button>
      <button type="button" onClick={() => view.openWeek("grid")}>
        week grid
      </button>
      <button type="button" onClick={() => view.setSelectedDayIso("2026-09-05")}>
        saturday
      </button>
    </div>
  );
}

const read = (id: string) => screen.getByTestId(id).textContent;
const param = (name: string) => new URLSearchParams(window.location.search).get(name);

beforeEach(() => {
  nativeReplaceState(null, "", "/time");
  window.localStorage.clear();
});

describe("useTimeView", () => {
  it("opens on the week's agenda and today with nothing in the URL", () => {
    render(<Harness />);

    expect(read("scope")).toBe("week");
    expect(read("lens")).toBe("agenda");
    expect(read("day")).toBe("2026-09-02");
  });

  it("reads the scope, lens and day the URL names", () => {
    nativeReplaceState(null, "", "/time?scope=day&lens=grid&day=2026-09-04");
    render(<Harness />);

    expect(read("scope")).toBe("day");
    expect(read("lens")).toBe("grid");
    expect(read("day")).toBe("2026-09-04");
  });

  it("maps an old ?zoom= link onto the new model and drops it on the first write", async () => {
    const user = userEvent.setup();
    nativeReplaceState(null, "", "/time?zoom=grid");
    render(<Harness />);

    expect(read("scope")).toBe("week");
    expect(read("lens")).toBe("grid");

    await user.click(screen.getByRole("button", { name: "month" }));

    expect(read("scope")).toBe("month");
    expect(param("zoom")).toBeNull();
    expect(param("scope")).toBe("month");
  });

  it("opens on the remembered scope and lens when the URL names none", async () => {
    window.localStorage.setItem(scopeStorageKey, "day");
    window.localStorage.setItem(lensStorageKey, "grid");
    render(<Harness />);

    await waitFor(() => expect(read("scope")).toBe("day"));
    expect(read("lens")).toBe("grid");
  });

  it("lets an explicit URL outrank the remembered preference", () => {
    window.localStorage.setItem(scopeStorageKey, "day");
    nativeReplaceState(null, "", "/time?scope=month");
    render(<Harness />);

    expect(read("scope")).toBe("month");
  });

  it("writes the scope and the lens to the URL and remembers both", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "month" }));
    expect(param("scope")).toBe("month");
    expect(window.localStorage.getItem(scopeStorageKey)).toBe("month");

    await user.click(screen.getByRole("button", { name: "grid" }));
    expect(param("lens")).toBe("grid");
    expect(window.localStorage.getItem(lensStorageKey)).toBe("grid");
  });

  it("zooms into a day with one write and keeps that day when zooming back out", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "open friday" }));
    expect(read("scope")).toBe("day");
    expect(read("day")).toBe("2026-09-04");

    await user.click(screen.getByRole("button", { name: "month" }));
    expect(read("day")).toBe("2026-09-04");
  });

  it("opens the week in a lens from any scope with one write", async () => {
    const user = userEvent.setup();
    nativeReplaceState(null, "", "/time?scope=month");
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "week grid" }));
    expect(read("scope")).toBe("week");
    expect(read("lens")).toBe("grid");
  });

  it("keeps the selected day in the URL as a plain selection", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "saturday" }));
    expect(param("day")).toBe("2026-09-05");
    expect(read("scope")).toBe("week");
  });

  it("forces a declared-only member onto the month without remembering it", async () => {
    const user = userEvent.setup();
    nativeReplaceState(null, "", "/time?scope=day");
    render(<Harness stops={declaredOnlyScopes} />);

    expect(read("scope")).toBe("month");

    await user.click(screen.getByRole("button", { name: "open friday" }));
    // The clamp is on the read, so the write lands and the scope stays the month.
    expect(read("scope")).toBe("month");
    expect(read("day")).toBe("2026-09-04");
  });
});
