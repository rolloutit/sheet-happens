import { getAppAccessState } from "@/src/server/auth/app-access";

import { getRunningTimerForMember, type RunningTimerView } from "./time-entries";

/**
 * The running timer for whoever is making the current request, for the app shell's header pill.
 *
 * Lives here rather than inline in the root layout because the layout wraps the auth screens too:
 * anyone without an active membership has no timer, and that has to be a `null` rather than a
 * redirect. `getAppAccessState` is request-cached, so on an authenticated route this shares the
 * session and member lookup the page is already doing.
 */
export async function getShellRunningTimer(): Promise<RunningTimerView | null> {
  const access = await getAppAccessState();

  if (access.status !== "active") return null;

  return getRunningTimerForMember(access.member.id);
}
