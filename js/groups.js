import { createGroup, getGroupById, getGroupsForUser, getMembersForGroup, joinGroupByCode, updateGroup } from "./services/group.service.js";
import { getCurrentSession } from "./services/auth.service.js";
import { getContributions } from "./services/contribution.service.js";
import { formatCurrency, formatDate } from "./utils/formatters.js";
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

    list.innerHTML = groups.map((group) => `
      <article class="card group-card">
        <div class="page-header">
          <div class="page-header-copy">
            <p class="eyebrow">${group.member_role}</p>
            <h3>${group.group_name}</h3>
            <p class="helper-text">${group.description || ""}</p>
          </div>
        </div>
        <div class="detail-list">
          <div class="summary-row"><span>Deadline</span><strong>${formatDate(group.deadline)}</strong></div>
          <div class="summary-row"><span>Target</span><strong>${formatCurrency(group.target_amount)}</strong></div>
          ${group.member_role === "Treasurer" ? `<div class="summary-row"><span>Group code</span><strong>${group.join_code}</strong></div>` : ""}
        </div>
        <div class="inline-actions">
          <a class="button" href="../pages/group-details.html?group_id=${group.group_id}">${group.member_role === "Treasurer" ? "Manage group" : "Open details"}</a>
        </div>
      </article>
    `).join("");
  }

  if (page === "group-details") {
    const groupId = getQueryGroupId();
    const group = groupId ? await getGroupById(groupId) : null;
    const contributions = groupId ? await getContributions(groupId) : [];
    const members = groupId ? await getMembersForGroup(groupId) : [];

    document.querySelector("[data-group-title]").textContent = group?.group_name || "Group not loaded";
    document.querySelector("[data-group-description]").textContent = group?.description || "No description added.";
    document.querySelector("[data-group-meta]").innerHTML = group
      ? `
        <div class="summary-row"><span>Target amount</span><strong>${formatCurrency(group.target_amount)}</strong></div>
        <div class="summary-row"><span>Deadline</span><strong>${formatDate(group.deadline)}</strong></div>
      `
      : `<div class="summary-row"><span>Status</span><strong>Group details not loaded</strong></div>`;
    document.querySelector("[data-group-tools] .detail-list").innerHTML = `
      <div class="summary-row"><span>Your role</span><strong>${group?.member_role || "Member"}</strong></div>
      <div class="summary-row"><span>Join code</span><strong>${group?.join_code || "Hidden for members"}</strong></div>
    `;
    document.querySelector("[data-group-edit-link]").href = `./edit-group.html?group_id=${groupId}`;

    const contributionTarget = document.querySelector("[data-group-contributions]");
    contributionTarget.innerHTML = contributions.length
      ? contributions.map((item) => `
          <article class="surface-item">
            <strong>${item.title}</strong>
            <span>${formatCurrency(item.amount)} - ${item.type} - Due ${formatDate(item.due_date)}</span>
            ${item.notes ? `<span>${item.notes}</span>` : ""}
          </article>
        `).join("")
      : `<article class="empty-card"><h3>No contributions yet</h3><p class="helper-text">The treasurer can add dues from the Contributions page.</p></article>`;

    const memberTarget = document.querySelector("[data-group-members]");
    memberTarget.innerHTML = members.length
      ? members.map((member) => `
          <article class="surface-item">
            <strong>${member.name}</strong>
            <span>${member.role} - ${member.email}</span>
          </article>
        `).join("")
      : `<article class="empty-card"><h3>No members found</h3><p class="helper-text">Share the group code so members can join.</p></article>`;
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
