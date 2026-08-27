import { runNotificationDispatcher } from "./dispatcher";

export const NOTIFICATION_SCHEDULER_INTERVAL_MS = 15_000;

type SchedulerLogger = Pick<Console, "error" | "info">;

export type NotificationScheduler = {
  start: () => void;
  stop: () => void;
};

export function createNotificationScheduler(input: {
  run?: () => Promise<unknown>;
  intervalMs?: number;
  logger?: SchedulerLogger;
} = {}): NotificationScheduler {
  const run = input.run ?? runNotificationDispatcher;
  const intervalMs = input.intervalMs ?? NOTIFICATION_SCHEDULER_INTERVAL_MS;
  const logger = input.logger ?? console;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = true;

  const schedule = (delay: number) => {
    timer = setTimeout(() => void tick(), delay);
  };

  const tick = async () => {
    try {
      await run();
    } catch (error) {
      logger.error("[notifications] In-service scheduler run failed.", error);
    } finally {
      if (!stopped) schedule(intervalMs);
    }
  };

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      schedule(0);
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

const globalForScheduler = globalThis as typeof globalThis & {
  sheetHappensNotificationScheduler?: NotificationScheduler;
};

export function startNotificationScheduler() {
  if (process.env.NOTIFICATION_SCHEDULER_DISABLED === "true") {
    return;
  }

  if (globalForScheduler.sheetHappensNotificationScheduler) {
    if (process.env.NODE_ENV !== "development") return;
    globalForScheduler.sheetHappensNotificationScheduler.stop();
  }

  const scheduler = createNotificationScheduler();
  globalForScheduler.sheetHappensNotificationScheduler = scheduler;
  scheduler.start();
  console.info(
    `[notifications] In-service scheduler started with a ${NOTIFICATION_SCHEDULER_INTERVAL_MS / 1_000}-second interval.`,
  );
}
