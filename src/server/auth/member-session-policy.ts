export type SessionEligibleMember = {
  deletedAt: Date | null;
  status: "INVITED" | "ACTIVE" | "INACTIVE" | "DELETED";
};

export function canCreateMemberSession(member: SessionEligibleMember | null) {
  if (!member || member.deletedAt) return false;

  // INVITED is limited by application access guards to invitation activation.
  return member.status === "ACTIVE" || member.status === "INVITED";
}
