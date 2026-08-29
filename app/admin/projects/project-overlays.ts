/**
 * The search param values that open the two create sheets on this page.
 *
 * Keeping the open state in the URL lets a trigger in the page header open a drawer mounted
 * deep inside the directory table, and makes `/admin/projects?new=project` a link you can send.
 */
export const PROJECT_OVERLAY_PARAM = "new";
export const PROJECT_OVERLAY_VALUE = "project";
export const PROJECT_GROUP_OVERLAY_VALUE = "group";
/** Bulk assignment creates records too, so it shares the param — only one overlay at a time. */
export const PROJECT_BULK_ASSIGN_OVERLAY_VALUE = "assignments";
