import { apiUrl, fetchJson, postJson } from "./api.service.js";

export async function getPendingPayments(groupId = null) {
  const suffix = groupId ? `?group_id=${encodeURIComponent(groupId)}` : "";
  const data = await fetchJson(`${apiUrl("payments/pending.php")}${suffix}`);
  return data.payments || [];
}

export async function markPaymentAsDone(paymentId, contributionId = null) {
  return postJson("payments/mark-paid.php", {
    payment_id: Number(paymentId || 0),
    contribution_id: Number(contributionId || 0),
  });
}

export async function confirmPayment(paymentId, confirmedBy) {
  return postJson("payments/confirm.php", { payment_id: Number(paymentId) });
}

export async function rejectPayment(paymentId, confirmedBy, note) {
  return postJson("payments/reject.php", { payment_id: Number(paymentId), note });
}
