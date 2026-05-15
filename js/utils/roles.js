import { getGroupsForUserFromState } from "./calculations.js";

/*
  Frontend role helper for display-only UX hiding.
  PHP must repeat these checks server-side with group_members.role before any
  create, confirm, reject, edit, or member-management operation is allowed.
*/
export function getActiveMembership(state, session) {
  if (!session?.user_id || !session?.active_group_id) return null;
  return getGroupsForUserFromState(state, session.user_id).find(
    (group) => Number(group.group_id) === Number(session.active_group_id),
  ) || null;
}

export function getMembershipForGroup(state, session, groupId) {
  if (!session?.user_id || !groupId) return null;
  return getGroupsForUserFromState(state, session.user_id).find(
    (group) => Number(group.group_id) === Number(groupId),
  ) || null;
}

export function getActiveRoleKey(state, session) {
  const membership = getActiveMembership(state, session);
  return membership?.member_role === "Treasurer" ? "treasurer" : "member";
}

export function canManageActiveGroup(state, session) {
  return getActiveRoleKey(state, session) === "treasurer";
}

export function canManageGroup(state, session, groupId) {
  return getMembershipForGroup(state, session, groupId)?.member_role === "Treasurer";
}
