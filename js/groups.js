import { createGroup, getGroupById, getGroupsForUser, getMembersForGroup, joinGroupByCode, updateGroup } from "./services/group.service.js";
import { getCurrentSession } from "./services/auth.service.js";
import { getContributions } from "./services/contribution.service.js";
import { confirmPayment, getGroupPaymentRecords, rejectPayment, updatePaymentStatus } from "./services/payment.service.js";
import { formatContributionFrequency } from "./utils/contribution-options.js";
import { PAYMENT_STATUS } from "./utils/constants.js";
import { formatCurrency, formatDate, formatShortDateTime } from "./utils/formatters.js";
import { showToast } from "./ui.js";

function getQueryGroupId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("group_id") || "";
}

function renderEmpty(target, title, message) {
  if (!target) return;
  target.innerHTML = `<article class="empty-card"><h3>${title}</h3><p class="helper-text">${message}</p></article>`;
}

function currentMemberFilters() {
  return {
    search: document.querySelector("[data-members-search]")?.value.trim() || "",
    role: document.querySelector("[data-members-role-filter]")?.value || "",
    status: document.querySelector("[data-members-status-filter]")?.value || "",
  };
}

function memberStatusLabel(member) {
  const paid = Number(member.paid_count || 0);
  const pending = Number(member.pending_count || 0);
  const rejected = Number(member.rejected_count || 0);
  const unpaid = Number(member.unpaid_count || 0);

  if (pending > 0) return { text: "Pending", className: "status-pending" };
  if (rejected > 0) return { text: "Rejected", className: "status-rejected" };
  if (unpaid > 0) return { text: "Not Paid", className: "status-unpaid" };
  if (paid > 0) return { text: "Paid", className: "status-paid" };
  return { text: "No dues", className: "status-unpaid" };
}

function paymentClass(status) {
  if (status === PAYMENT_STATUS.PAID) return "status-paid";
  if (status === PAYMENT_STATUS.PENDING) return "status-pending";
  if (status === PAYMENT_STATUS.REJECTED) return "status-rejected";
  return "status-unpaid";
}

function paymentLabel(status) {
  if (status === PAYMENT_STATUS.PAID) return "Paid";
  if (status === PAYMENT_STATUS.PENDING) return "Pending confirmation";
  if (status === PAYMENT_STATUS.REJECTED) return "Rejected / needs update";
  return "Not paid";
}

function roleBadge(role) {
  return `<span class="role-chip">${role || "Member"}</span>`;
}

function summarizeRecords(records) {
  return records.reduce((summary, record) => {
    const amount = Number(record.contribution?.amount || 0);
    summary.total += 1;
    summary.target += amount;
    if (record.status === PAYMENT_STATUS.PAID) {
      summary.paid += 1;
      summary.collected += amount;
    } else if (record.status === PAYMENT_STATUS.PENDING) {
      summary.pending += 1;
      summary.pendingValue += amount;
    } else if (record.status === PAYMENT_STATUS.REJECTED) {
      summary.rejected += 1;
    } else {
      summary.unpaid += 1;
    }
    return summary;
  }, { total: 0, paid: 0, pending: 0, unpaid: 0, rejected: 0, collected: 0, pendingValue: 0, target: 0 });
}

function contributionSummaries(contributions, records) {
  const byContribution = new Map();
  records.forEach((record) => {
    const id = Number(record.contribution_id);
    if (!byContribution.has(id)) byContribution.set(id, []);
    byContribution.get(id).push(record);
  });

  return contributions.map((contribution) => {
    const rows = byContribution.get(Number(contribution.contribution_id)) || [];
    const counts = summarizeRecords(rows);
    return { contribution, rows, counts };
  });
}

function renderMetric(label, value, detail = "") {
  return `<div class="mini-stat"><span>${label}</span><strong>${value}</strong>${detail ? `<small>${detail}</small>` : ""}</div>`;
}

function contributionRowTemplate(item) {
  const { contribution, counts } = item;
  const openCount = counts.unpaid + counts.rejected;
  return `
    <article class="structured-row contribution-detail-row">
      <div class="structured-row-main">
        <strong>${contribution.title}</strong>
        <span>${contribution.notes || "No description added."}</span>
      </div>
      <div class="structured-row-fields">
        <div><span>Amount</span><strong>${formatCurrency(contribution.amount)}</strong></div>
        <div><span>Frequency</span><strong>${formatContributionFrequency(contribution.frequency)}</strong></div>
        <div><span>Due</span><strong>${formatDate(contribution.due_date)}</strong></div>
        <div><span>Records</span><strong>${counts.paid} paid, ${counts.pending} pending, ${openCount} open</strong></div>
      </div>
    </article>
  `;
}

function memberRowTemplate(member) {
  const status = memberStatusLabel(member);
  return `
    <article class="structured-row member-detail-row">
      <div class="structured-row-main">
        <strong>${member.name}</strong>
        <span>${member.email}</span>
      </div>
      <div class="structured-row-fields member-row-fields">
        <div><span>Role</span><strong>${roleBadge(member.role)}</strong></div>
        <div><span>Status</span><strong><span class="status-chip ${status.className}">${status.text}</span></strong></div>
        <div><span>Paid</span><strong>${Number(member.paid_count || 0)}</strong></div>
        <div><span>Open</span><strong>${Number(member.unpaid_count || 0) + Number(member.rejected_count || 0)}</strong></div>
      </div>
    </article>
  `;
}

function paymentActionsTemplate(record, canManage) {
  if (!canManage) return "";

  if (record.is_self) {
    return `
      <div class="payment-row-actions">
        ${record.status !== PAYMENT_STATUS.PAID ? `<button class="button" type="button" data-status-payment="${record.payment_id}" data-next-status="${PAYMENT_STATUS.PAID}">Mark myself paid</button>` : ""}
        ${record.status !== PAYMENT_STATUS.NOT_PAID ? `<button class="button-secondary" type="button" data-status-payment="${record.payment_id}" data-next-status="${PAYMENT_STATUS.NOT_PAID}">Mark myself not paid</button>` : ""}
      </div>
    `;
  }

  if (record.status === PAYMENT_STATUS.PENDING) {
    return `
      <div class="payment-row-actions">
        <button class="button" type="button" data-confirm-payment="${record.payment_id}">Accept confirmation</button>
        <button class="button-danger" type="button" data-reject-payment="${record.payment_id}">Needs update</button>
      </div>
    `;
  }

  return `
    <div class="payment-row-actions">
      ${record.status !== PAYMENT_STATUS.PAID ? `<button class="button" type="button" data-status-payment="${record.payment_id}" data-next-status="${PAYMENT_STATUS.PAID}">Mark paid</button>` : ""}
      ${record.status !== PAYMENT_STATUS.NOT_PAID ? `<button class="button-secondary" type="button" data-status-payment="${record.payment_id}" data-next-status="${PAYMENT_STATUS.NOT_PAID}">Mark not paid</button>` : ""}
      ${record.status !== PAYMENT_STATUS.REJECTED ? `<button class="button-danger" type="button" data-status-payment="${record.payment_id}" data-next-status="${PAYMENT_STATUS.REJECTED}">Needs update</button>` : ""}
    </div>
  `;
}

function paymentRecordTemplate(record, canManage) {
  return `
    <article class="payment-row payment-management-row">
      <div class="payment-record-copy">
        <div class="payment-record-title">
          <strong>${record.user?.name || "Unknown member"}</strong>
          ${roleBadge(record.user?.role)}
          <span class="status-chip ${paymentClass(record.status)}">${paymentLabel(record.status)}</span>
        </div>
        <span>${record.contribution?.title || "Contribution"} - ${formatCurrency(record.contribution?.amount)} - ${formatContributionFrequency(record.contribution?.frequency)}</span>
        <small>${record.is_self ? "Your treasurer payment status" : record.user?.email || ""} - Updated ${formatShortDateTime(record.confirmed_at || record.marked_at)}</small>
      </div>
      ${paymentActionsTemplate(record, canManage)}
    </article>
  `;
}

function renderPaymentRecords(target, records, canManage) {
  if (!records.length) {
    target.innerHTML = `<article class="empty-card"><h3>No payment records yet</h3><p class="helper-text">Create a contribution to generate member payment rows.</p></article>`;
    return;
  }

  const visibleRecords = records.slice(0, 12);
  const extraRecords = records.slice(12);
  target.innerHTML = `
    ${visibleRecords.map((record) => paymentRecordTemplate(record, canManage)).join("")}
    ${extraRecords.length ? `
      <details class="disclosure">
        <summary>Show ${extraRecords.length} older record${extraRecords.length === 1 ? "" : "s"}</summary>
        <div class="surface-list">${extraRecords.map((record) => paymentRecordTemplate(record, canManage)).join("")}</div>
      </details>
    ` : ""}
  `;
}

function groupCardTemplate(group) {
  const isTreasurer = group.member_role === "Treasurer";
  return `
    <article class="card group-card">
      <div class="group-card-copy">
        <p class="eyebrow group-card-role">${group.member_role}</p>
        <h3 class="group-card-title">${group.group_name}</h3>
        <p class="helper-text group-card-description">${group.description || "No description added."}</p>
      </div>
      <div class="detail-list group-card-details">
        <div class="summary-row"><span>Deadline</span><strong>${formatDate(group.deadline)}</strong></div>
        <div class="summary-row"><span>Target</span><strong>${formatCurrency(group.target_amount)}</strong></div>
        ${isTreasurer ? `<div class="summary-row"><span>Group code</span><strong>${group.join_code}</strong></div>` : `<div class="summary-row group-card-placeholder" aria-hidden="true"><span>Group code</span><strong>&nbsp;</strong></div>`}
      </div>
      <div class="inline-actions group-card-actions">
        <a class="button" href="../pages/group-details.html?group_id=${group.group_id}">${isTreasurer ? "Manage group" : "Open details"}</a>
      </div>
    </article>
  `;
}

function renderMembersList(list, members) {
  list.innerHTML = members.map((member) => {
    const status = memberStatusLabel(member);
    return `
      <article class="card member-card">
        <div class="page-header">
          <div class="page-header-copy">
            <p class="eyebrow">${member.role}</p>
            <h3>${member.name}</h3>
            <p class="helper-text">${member.email}</p>
          </div>
          <span class="status-chip ${status.className}">${status.text}</span>
        </div>
        <div class="detail-list">
          <div class="summary-row"><span>Paid</span><strong>${Number(member.paid_count || 0)}</strong></div>
          <div class="summary-row"><span>Pending</span><strong>${Number(member.pending_count || 0)}</strong></div>
          <div class="summary-row"><span>Not paid</span><strong>${Number(member.unpaid_count || 0)}</strong></div>
          <div class="summary-row"><span>Rejected</span><strong>${Number(member.rejected_count || 0)}</strong></div>
        </div>
      </article>
    `;
  }).join("");
}

export async function initGroupsPage() {
  const page = document.body.dataset.appPage;
  if (!["groups", "group-details", "create-group", "edit-group", "members", "join-group"].includes(page || "")) return;

  const session = await getCurrentSession();

  if (page === "groups") {
    const groups = await getGroupsForUser(session?.user_id);
    const list = document.querySelector("[data-groups-list]");
    const empty = document.querySelector("[data-groups-empty]");

    empty?.classList.toggle("hidden", groups.length > 0);
    if (!groups.length) {
      renderEmpty(list, "No groups yet", "Create your first group or join one with a code.");
      return;
    }

    list.innerHTML = groups.map(groupCardTemplate).join("");
  }

  if (page === "group-details") {
    const groupId = getQueryGroupId();
    const group = groupId ? await getGroupById(groupId) : null;
    const contributions = groupId ? await getContributions(groupId) : [];
    const members = groupId ? await getMembersForGroup(groupId) : [];
    const paymentData = groupId ? await getGroupPaymentRecords(groupId) : { records: [], canManage: false, viewerRole: "Member" };
    const records = paymentData.records || [];
    const canManage = Boolean(paymentData.canManage);
    const summary = summarizeRecords(records);
    const completion = summary.target > 0 ? Math.round((summary.collected / summary.target) * 100) : 0;

    document.querySelector("[data-group-title]").textContent = group?.group_name || "Group not loaded";
    document.querySelector("[data-group-description]").textContent = group?.description || "No description added.";
    document.querySelector("[data-group-completion]").textContent = `${completion}%`;
    document.querySelector("[data-group-completion]").className = `status-chip ${completion >= 100 ? "status-paid" : completion > 0 ? "status-pending" : "status-unpaid"}`;
    document.querySelector("[data-group-progress]").style.setProperty("--value", `${completion}%`);
    document.querySelector("[data-group-meta]").innerHTML = group
      ? `
        ${renderMetric("Target", formatCurrency(group.target_amount))}
        ${renderMetric("Deadline", formatDate(group.deadline))}
        ${renderMetric("Collected", formatCurrency(summary.collected), `${summary.paid} paid record${summary.paid === 1 ? "" : "s"}`)}
        ${renderMetric("Pending review", formatCurrency(summary.pendingValue), `${summary.pending} waiting`)}
        ${renderMetric("Payment status", `${summary.paid}/${summary.total}`, `${summary.unpaid + summary.rejected} open`)}
        ${renderMetric("Completion", `${completion}%`, "Confirmed payments")}
      `
      : `<div class="summary-row"><span>Status</span><strong>Group details not loaded</strong></div>`;
    document.querySelector("[data-group-tools] .detail-list").innerHTML = `
      <div class="summary-row"><span>Your role</span><strong>${roleBadge(group?.member_role || "Member")}</strong></div>
      <div class="summary-row"><span>Group code</span><strong>${group?.join_code || "Hidden for members"}</strong></div>
    `;
    const editLink = document.querySelector("[data-group-edit-link]");
    const copyButton = document.querySelector("[data-copy-group-code]");
    if (editLink) {
      editLink.href = `./edit-group.html?group_id=${groupId}`;
      editLink.hidden = !canManage;
    }
    if (copyButton) {
      copyButton.hidden = !canManage || !group?.join_code;
      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(group.join_code);
          showToast("Group code copied.");
        } catch (error) {
          showToast("Could not copy the group code.", "error");
        }
      });
    }

    const contributionTarget = document.querySelector("[data-group-contributions]");
    const contributionRows = contributionSummaries(contributions, records);
    contributionTarget.innerHTML = contributionRows.length
      ? contributionRows.map(contributionRowTemplate).join("")
      : `<article class="empty-card"><h3>No contributions yet</h3><p class="helper-text">The treasurer can add dues from the Contributions page.</p></article>`;

    const memberTarget = document.querySelector("[data-group-members]");
    memberTarget.innerHTML = members.length
      ? members.map(memberRowTemplate).join("")
      : `<article class="empty-card"><h3>No members found</h3><p class="helper-text">Share the group code so members can join.</p></article>`;

    const paymentTarget = document.querySelector("[data-group-payment-records]");
    renderPaymentRecords(paymentTarget, records, canManage);

    paymentTarget?.querySelectorAll("[data-confirm-payment]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await confirmPayment(button.dataset.confirmPayment);
          showToast("Member confirmation accepted.");
          window.setTimeout(() => window.location.reload(), 350);
        } catch (error) {
          showToast(error.message, "error");
        }
      });
    });

    paymentTarget?.querySelectorAll("[data-reject-payment]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await rejectPayment(button.dataset.rejectPayment);
          showToast("Member payment marked as needing an update.");
          window.setTimeout(() => window.location.reload(), 350);
        } catch (error) {
          showToast(error.message, "error");
        }
      });
    });

    paymentTarget?.querySelectorAll("[data-status-payment]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await updatePaymentStatus(button.dataset.statusPayment, button.dataset.nextStatus);
          showToast("Payment status updated.");
          window.setTimeout(() => window.location.reload(), 350);
        } catch (error) {
          showToast(error.message, "error");
        }
      });
    });
  }

  if (page === "create-group" || page === "edit-group") {
    const form = document.querySelector("[data-group-form]");
    if (!form) return;

    if (page === "edit-group") {
      const group = getQueryGroupId() ? await getGroupById(getQueryGroupId()) : null;
      if (group) {
        form.group_name.value = group.group_name || "";
        form.description.value = group.description || "";
        form.target_amount.value = group.target_amount || "";
        form.deadline.value = group.deadline || "";
        form.join_code.value = group.join_code || "";
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(form).entries());
      try {
        if (page === "create-group") {
          await createGroup(payload, session?.user_id);
        } else {
          await updateGroup(getQueryGroupId(), payload);
        }
        showToast("Group saved.");
        window.setTimeout(() => { window.location.href = "./groups.html"; }, 350);
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  }

  if (page === "members") {
    const list = document.querySelector("[data-members-list]");
    const count = document.querySelector("[data-members-count]");
    const controls = document.querySelectorAll("[data-members-search], [data-members-role-filter], [data-members-status-filter]");
    const clearButton = document.querySelector("[data-members-clear]");
    const groupId = session?.active_group_id;

    const loadMembers = async () => {
      if (!groupId) {
        renderEmpty(list, "No active group", "Join or create a group first.");
        if (count) count.textContent = "";
        return;
      }

      list.innerHTML = `<article class="empty-card"><h3>Loading members...</h3><p class="helper-text">Checking the latest roster and payment status.</p></article>`;
      try {
        const members = await getMembersForGroup(groupId, currentMemberFilters());
        if (count) count.textContent = `${members.length} member${members.length === 1 ? "" : "s"} shown`;
        if (!members.length) {
          renderEmpty(list, "No members match your filters", "Try a different search, role, or payment status.");
          return;
        }
        renderMembersList(list, members);
      } catch (error) {
        if (count) count.textContent = "";
        renderEmpty(list, "Could not load members", error.message);
      }
    };

    let searchTimer = null;
    controls.forEach((control) => {
      const eventName = control.matches("[data-members-search]") ? "input" : "change";
      control.addEventListener(eventName, () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(loadMembers, 250);
      });
    });

    clearButton?.addEventListener("click", () => {
      document.querySelector("[data-members-search]").value = "";
      document.querySelector("[data-members-role-filter]").value = "All";
      document.querySelector("[data-members-status-filter]").value = "All";
      loadMembers();
    });

    await loadMembers();
  }

  if (page === "join-group") {
    const form = document.querySelector("[data-join-form]");
    const success = document.querySelector("[data-join-success]");
    const invalid = document.querySelector("[data-join-invalid]");

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      success?.classList.add("hidden");
      invalid?.classList.add("hidden");
      if (!session?.user_id) {
        const redirect = encodeURIComponent(window.location.href);
        window.location.href = `./login.html?redirect=${redirect}`;
        return;
      }
      const payload = Object.fromEntries(new FormData(form).entries());

      try {
        await joinGroupByCode(payload.join_code, session?.user_id);
        await getCurrentSession();
        success?.classList.remove("hidden");
        window.setTimeout(() => {
          window.location.href = "./groups.html";
        }, 500);
      } catch (error) {
        invalid?.classList.remove("hidden");
        invalid.querySelector("strong").textContent = error.message;
      }
    });
  }
}
