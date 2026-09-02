import { afterEach, describe, expect, it, vi } from "vitest";

import { createNotificationScheduler, NOTIFICATION_SCHEDULER_INTERVAL_MS } from "./scheduler";

describe("notification scheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts immediately and waits fifteen seconds after completion", async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockResolvedValue(undefined);
    const scheduler = createNotificationScheduler({ run, logger: silentLogger });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(NOTIFICATION_SCHEDULER_INTERVAL_MS - 1);
    expect(run).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it("never overlaps a slow run", async () => {
    vi.useFakeTimers();
    let finishRun: (() => void) | undefined;
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRun = resolve;
        }),
    );
    const scheduler = createNotificationScheduler({ run, logger: silentLogger });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(NOTIFICATION_SCHEDULER_INTERVAL_MS * 3);
    expect(run).toHaveBeenCalledTimes(1);

    finishRun?.();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(NOTIFICATION_SCHEDULER_INTERVAL_MS);
    expect(run).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it("continues after a failed run", async () => {
    vi.useFakeTimers();
    const run = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValue(undefined);
    const logger = { error: vi.fn(), info: vi.fn() };
    const scheduler = createNotificationScheduler({ run, logger });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(NOTIFICATION_SCHEDULER_INTERVAL_MS);

    expect(run).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledOnce();
    scheduler.stop();
  });
});

const silentLogger = { error: vi.fn(), info: vi.fn() };
