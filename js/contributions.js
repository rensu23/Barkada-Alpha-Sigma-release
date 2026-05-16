import { createContribution, getContributionHistory, getContributions, getRecurringCycles } from "./services/contribution.service.js";
import { getCurrentSession } from "./services/auth.service.js";
import { markPaymentAsDone } from "./services/payment.service.js";
import { PAYMENT_STATUS } from "./utils/constants.js";
import {
  CONTRIBUTION_FREQUENCIES,
  contributionTypeFromFrequency,
  formatContributionFrequency,
  isValidContributionFrequency,
} from "./utils/contribution-options.js";
import { formatCurrency, formatDate, formatShortDateTime } from "./utils/formatters.js";
import { showToast } from "./ui.js";

const HISTORY_INITIAL_LIMIT = 10;

function paymentClass(status) {
  if (status === PAYMENT_STATUS.PAID) return "status-paid";
  if (status === PAYMENT_STATUS.PENDING) return "status-pending";
  if (status === PAYMENT_STATUS.REJECTED) return "status-rejected";
  return "status-unpaid";
}

function paymentLabel(status) {
  if (status === PAYMENT_STATUS.PAID) return "Paid / Confirmed";
  if (status === PAYMENT_STATUS.PENDING) return "Pending Confirmation";
  if (status === PAYMENT_STATUS.REJECTED) return "Rejected / Needs Update";
  return "Not Paid";
}

function normalizeRole(role) {
  const value = String(role || "").toLowerCase();
  if (value === "treasurer" || value === "treasure") return "Treasurer";
  if (value === "member") return "Member";
  return "Unknown";
}

function historyMeaning(item) {
  const user = item.user?.name || "Unknown user";
  if (item.status === PAYMENT_STATUS.PAID) return `${user} paid and the payment was confirmed.`;
  if (item.status === PAYMENT_STATUS.PENDING) return `${user} marked this as paid and is waiting for review.`;
  if (item.status === PAYMENT_STATUS.REJECTED) return `${user} needs to update this rejected payment.`;
  return `${user} has not paid this contribution yet.`;
}

function historyInsightsTemplate(history) {
  const amounts = history
    .map((item) => Number(item.contribution?.amount || 0))
    .filter((amount) => Number.isFinite(amount));
  if (!amounts.length) return "";

  const highest = history.reduce((best, item) => Number(item.contribution?.amount || 0) > Number(best.contribution?.amount || 0) ? item : best, history[0]);
  const lowest = history.reduce((best, item) => Number(item.contribution?.amount || 0) < Number(best.contribution?.amount || 0) ? item : best, history[0]);
  const average = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;

  return `
    <div class="insight-grid">
      <div class="mini-stat"><span>Highest amount</span><strong>${formatCurrency(highest.contribution.amount)}</strong><small>${highest.user?.name || "Unknown user"} - ${highest.contribution.title}</small></div>
      <div class="mini-stat"><span>Lowest amount</span><strong>${formatCurrency(lowest.contribution.amount)}</strong><small>${lowest.user?.name || "Unknown user"} - ${lowest.contribution.title}</small></div>
      <div class="mini-stat"><span>Average amount</span><strong>${formatCurrency(average)}</strong><small>Across ${history.length} payment ${history.length === 1 ? "record" : "records"}</small></div>
    </div>
  `;
}

function renderEmpty(target, title, message) {
  if (!target) return;
  target.innerHTML = `<article class="empty-card"><h3>${title}</h3><p class="helper-text">${message}</p></article>`;
}

function historyListItemTemplate(item) {
  const user = item.user?.name || "Unknown user";
  const role = normalizeRole(item.user?.role);
  const statusLabel = paymentLabel(item.status);
  return `
    <article class="history-list-item">
      <div class="history-list-main history-person">
        <strong>${user}</strong>
        <span class="role-chip">${role}</span>
        <p class="helper-text">${historyMeaning(item)}</p>
      </div>
      <div class="history-list-fields">
        <div><span>Contribution</span><strong>${item.contribution.title}</strong></div>
        <div><span>Group</span><strong>${item.group.group_name}</strong></div>
        <div><span>Amount</span><strong>${formatCurrency(item.contribution.amount)}</strong></div>
        <div><span>Status</span><strong><span class="status-chip ${paymentClass(item.status)}">${statusLabel}</span></strong></div>
        <div><span>Latest Update</span><strong>${formatShortDateTime(item.latest_update)}</strong></div>
      </div>
    </article>
  `;
}

function currentQueryFromControls() {
  return {
    search: document.querySelector("[data-contributions-search]")?.value || "",
    frequency: document.querySelector("[data-contributions-frequency]")?.value || "",
    group_id: document.querySelector("[data-contributions-group]")?.value || "",
    status: document.querySelector("[data-contributions-status]")?.value || "",
    sort: document.querySelector("[data-contributions-sort]")?.value || "due-soon",
  };
}

function frequencyOptionsTemplate(includeAll = false) {
  const options = includeAll ? ["All", ...CONTRIBUTION_FREQUENCIES] : CONTRIBUTION_FREQUENCIES;
  return options.map((frequency) => `<option value="${frequency}">${frequency}</option>`).join("");
}

export async function initContributionsPage() {
  const page = document.body.dataset.appPage;
  if (!["contributions", "recurring-cycle", "history"].includes(page || "")) return;
  const session = await getCurrentSession();

  if (page === "contributions") {
    let contributions = await getContributions();
    const list = document.querySelector("[data-contributions-list]");
    const form = document.querySelector("[data-contribution-form]");
    const groupFilter = document.querySelector("[data-contributions-group]");
    const frequencyFilter = document.querySelector("[data-contributions-frequency]");
    const frequencySelect = form?.querySelector("select[name='frequency']");
    const filters = document.querySelectorAll("[data-contributions-search], [data-contributions-frequency], [data-contributions-group], [data-contributions-status], [data-contributions-sort]");
    const treasurerGroups = (session?.groups || []).filter((group) => group.member_role === "Treasurer");
    const submitButton = form?.querySelector("button[type='submit']");
    const createPanel = document.querySelector("[data-contribution-create-panel]");

    if (groupFilter) {
      groupFilter.innerHTML = `<option value="">All groups</option>${(session?.groups || []).map((group) => `<option value="${group.group_id}">${group.group_name}</option>`).join("")}`;
    }
    if (frequencyFilter) frequencyFilter.innerHTML = frequencyOptionsTemplate(true);
    if (frequencySelect) frequencySelect.innerHTML = frequencyOptionsTemplate();

    const groupSelect = form?.querySelector("select[name='group_id']");
    if (groupSelect) {
      groupSelect.innerHTML = treasurerGroups.length
        ? treasurerGroups.map((group) => `<option value="${group.group_id}">${group.group_name}</option>`).join("")
        : `<option value="">You need to be a group treasurer</option>`;
      groupSelect.disabled = treasurerGroups.length === 0;
    }
    if (submitButton && treasurerGroups.length === 0) {
      submitButton.disabled = true;
      submitButton.textContent = "Treasurer group required";
    }
    if (createPanel && treasurerGroups.length === 0) {
      createPanel.innerHTML = `
        <summary>Create contribution</summary>
        <article class="empty-card">
          <h3>You need to be a group treasurer to create contributions.</h3>
          <p class="helper-text">Members can still view dues and mark their own payments.</p>
        </article>
      `;
    }

    const renderContributions = async () => {
      if (!contributions.length) {
        renderEmpty(list, "No contributions yet", "Create a contribution if you are the group treasurer, or wait for your treasurer to add one.");
        return;
      }

      list.innerHTML = contributions.map((item) => `
        <article class="card contribution-card">
          <div class="page-header">
            <div class="page-header-copy">
              <p class="eyebrow">${formatContributionFrequency(item.frequency)}</p>
              <h3>${item.title}</h3>
              <p class="helper-text">${item.group?.group_name || "Group"} - ${formatCurrency(item.amount)}</p>
            </div>
            <span class="status-chip ${paymentClass(item.status)}">${item.status || "Not Paid"}</span>
          </div>
          <div class="detail-list">
            <div class="summary-row"><span>Due date</span><strong>${formatDate(item.due_date)}</strong></div>
            <div class="summary-row"><span>Your role</span><strong>${item.member_role}</strong></div>
          </div>
          ${item.notes ? `<p class="helper-text space-top">${item.notes}</p>` : ""}
          ${item.member_role !== "Treasurer" && item.status !== "Paid"
            ? `<button class="button space-top" type="button" data-mark-paid="${item.payment_id || ""}" data-contribution-id="${item.contribution_id}">Mark as paid</button>`
            : ""}
        </article>
      `).join("");

      list.querySelectorAll("[data-mark-paid]").forEach((button) => {
        button.addEventListener("click", async () => {
          try {
            await markPaymentAsDone(button.dataset.markPaid, button.dataset.contributionId);
            showToast("Payment marked for treasurer review.");
            contributions = await getContributions("", currentQueryFromControls());
            await renderContributions();
          } catch (error) {
            showToast(error.message, "error");
          }
        });
      });
    };

    await renderContributions();
    const refreshList = async () => {
      contributions = await getContributions("", currentQueryFromControls());
      await renderContributions();
    };
    filters.forEach((control) => control.addEventListener("input", refreshList));
    filters.forEach((control) => control.addEventListener("change", refreshList));

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(form).entries());
      try {
        if (!payload.group_id) {
          throw new Error("Please select a group where you are the treasurer before creating a contribution.");
        }
        if (!isValidContributionFrequency(payload.frequency)) {
          throw new Error("Choose a valid contribution frequency.");
        }
        payload.type = contributionTypeFromFrequency(payload.frequency);
        await createContribution(payload);
        showToast("Contribution created.");
        contributions = await getContributions("", currentQueryFromControls());
        await renderContributions();
        form.reset();
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  }

  if (page === "recurring-cycle") {
    const cycles = await getRecurringCycles(session?.user_id);
    const list = document.querySelector("[data-cycle-list]");
    if (!cycles.length) {
      renderEmpty(list, "No recurring contributions", "Daily, weekly, and monthly contributions will appear here.");
      return;
    }
    list.innerHTML = cycles.map((item) => `
      <article class="card">
        <p class="eyebrow">${formatContributionFrequency(item.frequency)}</p>
        <h3>${item.title}</h3>
        <p class="helper-text">${item.group_name} - ${formatCurrency(item.amount)} - Due ${formatDate(item.due_date)}</p>
        ${item.notes ? `<p class="helper-text">${item.notes}</p>` : ""}
      </article>
    `).join("");
  }

  if (page === "history") {
    const sortControl = document.querySelector("[data-history-sort]");
    const controls = document.querySelector("[data-history-controls]");
    const insights = document.querySelector("[data-history-insights]");
    let visibleCount = HISTORY_INITIAL_LIMIT;

    const loadHistory = async () => {
      const history = await getContributionHistory({ sort: sortControl?.value || "newest" });
      const table = document.querySelector("[data-history-table]");
      const mobileList = document.querySelector("[data-history-list]");
      if (!history.length) {
        if (table) table.innerHTML = `<tr><td colspan="7">No payment history yet.</td></tr>`;
        renderEmpty(mobileList, "No payment history yet", "Payment records will appear here after dues are created.");
        if (controls) controls.innerHTML = "";
        if (insights) insights.innerHTML = "";
        return;
      }

      const visibleHistory = history.slice(0, visibleCount);
      if (insights) insights.innerHTML = historyInsightsTemplate(history);
      const rows = visibleHistory.map((item) => {
        const user = item.user?.name || "Unknown user";
        const role = normalizeRole(item.user?.role);
        const statusLabel = paymentLabel(item.status);
        return `
        <tr>
          <td><strong>${user}</strong><span class="history-row-note">${historyMeaning(item)}</span></td>
          <td><span class="role-chip">${role}</span></td>
          <td>${item.contribution.title}</td>
          <td>${item.group.group_name}</td>
          <td>${formatCurrency(item.contribution.amount)}</td>
          <td><span class="status-chip ${paymentClass(item.status)}">${statusLabel}</span></td>
          <td>${formatShortDateTime(item.latest_update)}</td>
        </tr>
      `;
      }).join("");
      if (table) table.innerHTML = rows;
      if (mobileList) mobileList.innerHTML = visibleHistory.map(historyListItemTemplate).join("");
      if (controls) {
        const remaining = history.length - visibleCount;
        controls.innerHTML = history.length > HISTORY_INITIAL_LIMIT
          ? `<button class="button-ghost history-more-button" type="button" data-history-more>${remaining > 0 ? `Show ${remaining} more` : "Show latest only"}</button>`
          : "";
        controls.querySelector("[data-history-more]")?.addEventListener("click", () => {
          visibleCount = remaining > 0 ? history.length : HISTORY_INITIAL_LIMIT;
          loadHistory();
        });
      }
    };

    sortControl?.addEventListener("change", () => {
      visibleCount = HISTORY_INITIAL_LIMIT;
      loadHistory();
    });
    await loadHistory();
  }
}
