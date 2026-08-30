/**
 * The search param that opens the invite sheet.
 *
 * It lives in the URL so the header button, the empty-state call to action, and the drawer
 * itself do not have to know about each other — and so `/admin/people?new=member` is a link
 * you can send someone.
 */
export const INVITE_OVERLAY_PARAM = "new";
export const INVITE_OVERLAY_VALUE = "member";
