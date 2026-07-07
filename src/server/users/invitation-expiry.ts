export const INVITATION_VALIDITY_HOURS = 72;

export function getDefaultInvitationExpiresAt(date: Date) {
  return addHours(date, INVITATION_VALIDITY_HOURS);
}

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setUTCHours(next.getUTCHours() + hours);
  return next;
}
