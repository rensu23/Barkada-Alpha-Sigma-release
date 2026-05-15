import { PAYMENT_STATUS } from "./constants.js";

export function getMembershipsForUser(state, userId) {
  if (!userId) return [];
  return (state.group_members || []).filter((member) => Number(member.user_id) === Number(userId));
}

export function getGroupsForUserFromState(state, userId) {
  return getMembershipsForUser(state, userId).map((membership) => {
    const group = (state.groups || []).find((item) => item.group_id === membership.group_id);
    return { ...group, member_role: membership.role };
  }).filter((group) => group.group_id);
}

export function getEffectiveRole(groups) {
  const hasTreasurerRole = groups.some((group) => group.member_role === "Treasurer");
  const hasMemberRole = groups.some((group) => group.member_role === "Member");

  if (hasTreasurerRole && hasMemberRole) return "hybrid";
  if (hasTreasurerRole) return "treasurer";
  return "member";
}

export function resolveActiveGroupId(groups, session) {
  if (!groups.length) return null;
  const exists = groups.some((group) => Number(group.group_id) === Number(session.active_group_id));
  return exists ? Number(session.active_group_id) : Number(groups[0].group_id);
}

export function getScopedPayments(state, groupIds) {
  const contributions = (state.contributions || []).filter((item) => groupIds.includes(item.group_id));
  const contributionIds = contributions.map((item) => item.contribution_id);
  const payments = (state.payment_records || []).filter((item) => contributionIds.includes(item.contribution_id));
  return { contributions, payments };
}

export function buildDashboardMetrics(state, userId, activeGroupId = null) {
  const groups = getGroupsForUserFromState(state, userId);
  const scopedGroups = activeGroupId ? groups.filter((group) => Number(group.group_id) === Number(activeGroupId)) : groups;
  const groupIds = scopedGroups.map((group) => group.group_id);
  const { contributions, payments } = getScopedPayments(state, groupIds);
  const totalTarget = scopedGroups.reduce((sum, group) => sum + Number(group.target_amount || 0), 0);
  const totalCollected = payments.reduce((sum, payment) => {
    if (payment.status !== PAYMENT_STATUS.PAID) return sum;
    const contribution = contributions.find((item) => item.contribution_id === payment.contribution_id);
    return sum + Number(contribution?.amount || 0);
  }, 0);
  const totalPendingAmount = payments.reduce((sum, payment) => {
    if (payment.status !== PAYMENT_STATUS.PENDING) return sum;
    const contribution = contributions.find((item) => item.contribution_id === payment.contribution_id);
    return sum + Number(contribution?.amount || 0);
  }, 0);

  const paidCount = payments.filter((payment) => payment.status === PAYMENT_STATUS.PAID).length;
  const pendingCount = payments.filter((payment) => payment.status === PAYMENT_STATUS.PENDING).length;
  const unpaidCount = payments.filter((payment) => payment.status === PAYMENT_STATUS.NOT_PAID).length;
  const rejectedCount = payments.filter((payment) => payment.status === PAYMENT_STATUS.REJECTED).length;
  const completion = totalTarget ? Math.round((totalCollected / totalTarget) * 100) : 0;
  const myPayments = payments.filter((payment) => Number(payment.user_id) === Number(userId));
  const myPendingAmount = myPayments.reduce((sum, payment) => {
    if (![PAYMENT_STATUS.PENDING, PAYMENT_STATUS.NOT_PAID, PAYMENT_STATUS.REJECTED].includes(payment.status)) return sum;
    const contribution = contributions.find((item) => item.contribution_id === payment.contribution_id);
    return sum + Number(contribution?.amount || 0);
  }, 0);
  const myConfirmedTotal = myPayments.reduce((sum, payment) => {
    if (payment.status !== PAYMENT_STATUS.PAID) return sum;
    const contribution = contributions.find((item) => item.contribution_id === payment.contribution_id);
    return sum + Number(contribution?.amount || 0);
  }, 0);
  const myPendingCount = myPayments.filter((payment) => payment.status === PAYMENT_STATUS.PENDING).length;

  const groupProgress = scopedGroups.map((group) => {
    const groupContributions = contributions.filter((item) => item.group_id === group.group_id);
    const ids = groupContributions.map((item) => item.contribution_id);
    const groupPayments = payments.filter((item) => ids.includes(item.contribution_id));
    const groupCollected = groupPayments.reduce((sum, payment) => {
      if (payment.status !== PAYMENT_STATUS.PAID) return sum;
      const contribution = groupContributions.find((item) => item.contribution_id === payment.contribution_id);
      return sum + Number(contribution?.amount || 0);
    }, 0);
    return {
      ...group,
      completion: group.target_amount ? Math.min(100, Math.round((groupCollected / Number(group.target_amount)) * 100)) : 0,
      collected: groupCollected,
    };
  });

  return {
    groups,
    scopedGroups,
    contributions,
    payments,
    totalTarget,
    totalCollected,
    totalPendingAmount,
    myPendingAmount,
    myConfirmedTotal,
    myPendingCount,
    paidCount,
    pendingCount,
    unpaidCount,
    rejectedCount,
    completion,
    groupProgress,
  };
}

export function getUserVisibleActivity(state, userId, activeGroupId = null) {
  const groups = getGroupsForUserFromState(state, userId);
  const visibleGroupIds = activeGroupId
    ? [Number(activeGroupId)]
    : groups.map((group) => group.group_id);

  return (state.activity_logs || []).filter((item) => !item.group_id || visibleGroupIds.includes(Number(item.group_id)));
}
