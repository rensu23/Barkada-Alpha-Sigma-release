import { getPendingPayments, confirmPayment, rejectPayment } from "./services/payment.service.js";
import { getCurrentSession } from "./services/auth.service.js";
import { formatCurrency, formatShortDateTime } from "./utils/formatters.js";
import { openModal, showToast } from "./ui.js";

export async function initPaymentsPage() {
  const page = document.body.dataset.appPage;
  if (page !== "confirmations") return;

  const session = await getCurrentSession();
  const list = document.querySelector("[data-confirmations-list]");
  const pending = await getPendingPayments(session?.active_group_id);

  if (!pending.length) {
    list.innerHTML = `<article class="empty-card"><h3>No pending confirmations</h3><p class="helper-text">Payment claims marked by members will appear here for treasurer review.</p></article>`;
    return;
  }

  list.innerHTML = pending.map((item) => `
    <article class="card contribution-card">
      <div class="page-header">
        <div class="page-header-copy">
          <p class="eyebrow">${item.group.group_name}</p>
          <h3>${item.user.name}</h3>
          <p class="helper-text">${item.contribution.title} - ${formatCurrency(item.contribution.amount)}</p>
        </div>
        <span class="status-chip status-pending">${item.status}</span>
      </div>
      <div class="summary-row"><span>Marked at</span><strong>${formatShortDateTime(item.marked_at)}</strong></div>
      <div class="inline-actions space-top">
        <button class="button" type="button" data-confirm-payment="${item.payment_id}">Confirm</button>
        <button class="button-danger" type="button" data-reject-payment="${item.payment_id}">Reject</button>
      </div>
    </article>
  `).join("");

  list.querySelectorAll("[data-confirm-payment]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await confirmPayment(button.dataset.confirmPayment, session?.user_id);
        showToast("Payment confirmed.");
        window.setTimeout(() => window.location.reload(), 350);
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  });

  list.querySelectorAll("[data-reject-payment]").forEach((button) => {
    button.addEventListener("click", () => {
      const overlay = openModal({
        title: "Reject payment",
        body: "Reject this payment claim so the member can check and mark it again later.",
        actions: `
          <form data-rejection-form class="stack">
            <textarea name="note" rows="4" placeholder="Reason for rejection"></textarea>
            <button class="button-danger button-block" type="submit">Reject payment</button>
          </form>
        `,
      });
      overlay.querySelector("[data-rejection-form]").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          const note = new FormData(event.currentTarget).get("note");
          await rejectPayment(button.dataset.rejectPayment, session?.user_id, note);
          showToast("Payment rejected.");
          window.setTimeout(() => window.location.reload(), 350);
        } catch (error) {
          showToast(error.message, "error");
        }
      });
    });
  });
}
