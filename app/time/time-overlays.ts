/**
 * One param per page, one value per overlay — the same shape as
 * `app/admin/projects/project-overlays.ts`. Sharing the param name is what makes "only one overlay
 * open at a time" structural rather than something each component has to remember.
 *
 * Plain `.ts` with no directive so the server page and the client components can both import it.
 */
export const TIME_OVERLAY_PARAM = "new";
export const TIMER_OVERLAY_VALUE = "timer";
