import { createContribution, getContributionHistory, getContributions, getRecurringCycles } from "./services/contribution.service.js";
import { getCurrentSession } from "./services/auth.service.js";
import { markPaymentAsDone } from "./services/payment.service.js";
import { PAYMENT_STATUS } from "./utils/constants.js";
import { formatCurrency, formatDate, formatShortDateTime } from "./utils/formatters.js";
import { showToast } from "./ui.js";

function paymentClass(status) {
  if (status === PAYMENT_STATUS.PAID) return "status-paid";
  if (status === PAYMENT_STATUS.PENDING) return "status-pending";
  if (status === PAYMENT_STATUS.REJECTED) return "status-rejected";
  return "status-unpaid";
}

function renderEmpty(target, title, message) {
  if (!target) return;
  target.innerHTML = `<article class="empty-card"><h3>${title}</h3><p class="helper-text">${message}</p></article>`;
}

function historyListItemTemplate(item) {
  return `
    <article class="history-list-item">
      <div class="history-list-main">
        <strong>${item.contribution.title}</strong>
        <p class="helper-text">${item.group.group_name} - ${formatCurrency(item.contribution.amount)}</p>
      </div>
      <div class="history-list-meta">
        <span class="status-chip ${paymentClass(item.status)}">${item.status}</span>
        <span class="muted">${formatShortDateTime(item.latest_update)}</span>
      </div>
    </article>
  `;
}

function currentQueryFromControls() {
  return {
    search: document.querySelector("[data-contributions-search]")?.value || "",
    type: document.querySelector("[data-contributions-type]")?.value || "",
    group_id: document.querySelector("[data-contributions-group]")?.value || "",
    status: document.querySelector("[data-contributions-status]")?.value || "",
    sort: document.querySelector("[data-contributions-sort]")?.value || "due-soon",
  };
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
    const filters = document.querySelectorAll("[data-contributions-search], [data-contributions-type], [data-contributions-group], [data-contributions-status], [data-contributions-sort]");
    const treasurerGroups = (session?.groups || []).filter((group) => group.member_role === "Treasurer");
    const submitButton = form?.querySelector("button[type='submit']");
    const createPanel = document.querySelector("[data-contribution-create-panel]");

    if (groupFilter) {
      groupFilter.innerHTML = `<option value="">All groups</option>${(session?.groups || []).map((group) => `<option value="${group.group_id}">${group.group_name}</option>`).join("")}`;
    }

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
              <p class="eyebrow">${item.type}</p>
              <h3>${item.title}</h3>
              <p class="helper-text">${item.group?.group_name || "Group"} - ${formatCurrency(item.amount)}</p>
            </div>
            <span class="status-chip ${paymentClass(item.status)}">${item.status || "Not Paid"}</span>
          </div>
          <div class="detail-list">
            <div class="summary-row"><span>Frequency</span><strong>${item.frequency}</strong></div>
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
      renderEmpty(list, "No recurring contributions", "Recurring rows come from contributions.type and contributions.frequency.");
      return;
    }
    list.innerHTML = cycles.map((item) => `
      <article class="card">
        <p class="eyebrow">${item.frequency}</p>
        <h3>${item.title}</h3>
        <p class="helper-text">${item.group_name} - ${formatCurrency(item.amount)} - Due ${formatDate(item.due_date)}</p>
        ${item.notes ? `<p class="helper-text">${item.notes}</p>` : ""}
      </article>
    `).join("");
  }

  if (page === "history") {
    const sortControl = document.querySelector("[data-history-sort]");
    const loadHistory = async () => {
      const history = await getContributionHistory({ sort: sortControl?.value || "newest" });
      const table = document.querySelector("[data-history-table]");
      const mobileList = document.querySelector("[data-history-list]");
      if (!history.length) {
        if (table) table.innerHTML = `<tr><td colspan="5">No payment history yet.</td></tr>`;
        renderEmpty(mobileList, "No payment history yet", "Payment records will appear here after dues are created.");
        return;
      }

      const rows = history.map((item) => `
        <tr>
          <td>${item.contribution.title}</td>
          <td>${item.group.group_name}</td>
          <td>${formatCurrency(item.contribution.amount)}</td>
          <td><span class="status-chip ${paymentClass(item.status)}">${item.status}</span></td>
          <td>${formatShortDateTime(item.latest_update)}</td>
        </tr>
      `).join("");
      if (table) table.innerHTML = rows;
      if (mobileList) mobileList.innerHTML = history.map(historyListItemTemplate).join("");
    };

    sortControl?.addEventListener("change", loadHistory);
    await loadHistory();
  }
}
