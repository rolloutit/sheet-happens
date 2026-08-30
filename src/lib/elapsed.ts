/**
 * Formats a live elapsed duration for a running timer.
 *
 * Deliberately not part of `src/lib/duration.ts`: that module speaks in whole minutes for time
 * entries, while a running timer ticks in seconds and has to stay readable at both ends of the
 * range. The unit drops to `m:ss` under an hour so the seconds are the loudest digits early on,
 * and only widens to `h:mm:ss` once the hour is real.
 */
export function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
