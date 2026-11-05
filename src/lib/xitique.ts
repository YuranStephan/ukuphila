type Member = { id: string; userId: string | null; role: string; status: string };

/** Keep the same second-person rule in the domain and in the buttons shown to a member. */
export function mayConfirmContribution(members: Member[], actorId: string, recipientMemberId: string, declaredBy: string | null) {
  const actor = members.find((member) => member.userId === actorId && member.status === "activo");
  if (!actor || actorId === declaredBy) return false;
  const anotherApprover = members.some((member) => member.status === "activo" && member.userId && member.userId !== declaredBy && (member.role === "tesoureiro" || member.id === recipientMemberId));
  return !anotherApprover || actor.role === "tesoureiro" || actor.id === recipientMemberId;
}
