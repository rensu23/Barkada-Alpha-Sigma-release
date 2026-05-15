import { getCurrentSession } from "./services/auth.service.js";
import { getPendingPayments } from "./services/payment.service.js";
import { getState } from "./utils/storage.js";
import { PAYMENT_STATUS } from "./utils/constants.js";
import { formatCurrency, formatDate, formatShortDateTime } from "./utils/formatters.js";
import { buildDashboardMetrics, getUserVisibleActivity } from "./utils/calculations.js";
import { getActiveRoleKey } from "./utils/roles.js";

function getUrgency(deadline) {
  if (!deadline) return { label: "Flexible", className: "status-unpaid" };
  const today = new Date();
  const due = new Date(`${deadline}T00:00:00`);
  const daysLeft = Math.ceil((due - today) / 86400000);
  if (daysLeft < 0) return { label: "Overdue", className: "status-rejected" };
  if (daysLeft <= 7) return { label: "Due soon", className: "status-pending" };
  return { label: "On track", className: "status-paid" };
}

function buildStatusSegments(metricsState) {
  // PHP can replace this with a SQL aggregate grouped by payment_records.status and due date.
  const today = new Date();
  const summary = {
    paid: { key: "paid", label: "Paid / confirmed", count: 0, amount: 0, color: "var(--color-success)" },
    pending: { key: "pending", label: "Pending confirmation", count: 0, amount: 0, color: "var(--color-warning)" },
    overdue: { key: "overdue", label: "Overdue", count: 0, amount: 0, color: "var(--color-danger)" },
    unpaid: { key: "unpaid", label: "Not paid", count: 0, amount: 0, color: "color-mix(in srgb, var(--color-text-muted) 58%, var(--color-surface))" },
    rejected: { key: "rejected", label: "Rejected / needs update", count: 0, amount: 0, color: "color-mix(in srgb, var(--color-danger) 74%, var(--color-warning))" },
  };

  metricsState.payments.forEach((payment) => {
    const contribution = metricsState.contributions.find((item) => item.contribution_id === payment.contribution_id);
    const amount = Number(contribution?.amount || 0);
    const due = contribution?.due_date ? new Date(`${contribution.due_date}T00:00:00`) : null;
    const key = payment.status === PAYMENT_STATUS.PAID
      ? "paid"
      : payment.status === PAYMENT_STATUS.PENDING
        ? "pending"
        : payment.status === PAYMENT_STATUS.REJECTED
          ? "rejected"
          : due && due < today
            ? "overdue"
            : "unpaid";
    summary[key].count += 1;
    summary[key].amount += amount;
  });

  return Object.values(summary);
}

function activityText(item) {
  const actor = item.user_name || "A member";
  const group = item.group_name || "a group";
  const contribution = item.contribution_title ? ` for ${item.contribution_title}` : "";
  const labels = {
    group_created: `${actor} created ${group}`,
    contribution_created: `${actor} added a contribution${contribution}`,
    contribution_updated: `${actor} updated a contribution${contribution}`,
    payment_marked_paid: `${actor} marked paid${contribution}`,
    payment_confirmed: `${actor} confirmed a payment${contribution}`,
    payment_rejected: `${actor} rejected a payment${contribution}`,
  };

  return {
    title: labels[item.action] || `${actor} updated ${group}`,
    meta: `${group}${item.payment_status ? ` - ${item.payment_status}` : ""}`,
  };
}

function groupPaymentSummary(metricsState, groupId) {
  const contributionIds = metricsState.contributions
    .filter((item) => Number(item.group_id) === Number(groupId))
    .map((item) => item.contribution_id);
  const payments = metricsState.payments.filter((item) => contributionIds.includes(item.contribution_id));
  return {
    members: new Set(payments.map((item) => item.user_id)).size,
    paid: payments.filter((item) => item.status === PAYMENT_STATUS.PAID).length,
    pending: payments.filter((item) => item.status === PAYMENT_STATUS.PENDING).length,
    unpaid: payments.filter((item) => item.status === PAYMENT_STATUS.NOT_PAID).length,
    rejected: payments.filter((item) => item.status === PAYMENT_STATUS.REJECTED).length,
  };
}

function activeGroupTemplate(group, metricsState, role) {
  const urgency = getUrgency(group.deadline);
  const summary = groupPaymentSummary(metricsState, group.group_id);
  const nextHref = role === "treasurer" ? "./confirmations.html" : "./contributions.html";
  const nextLabel = role === "treasurer" ? "Review confirmations" : "View my dues";
  const secondaryHref = role === "treasurer" ? `./group-details.html?group_id=${group.group_id}` : "./groups.html";
  const secondaryLabel = role === "treasurer" ? "Manage group" : "Group details";
  return `
    <article class="card active-group-card is-wide">
      <div class="page-header-copy">
        <p class="eyebrow">${group.member_role}</p>
        <h3>${group.group_name}</h3>
        <p class="helper-text">${group.description}</p>
        <span class="status-chip ${urgency.className}">${urgency.label} - ${formatDate(group.deadline)}</span>
      </div>
      <div class="progress-summary">
        <div class="page-header">
          <div>
            <p class="compact-note">Collected</p>
            <h3>${formatCurrency(group.collected)} / ${formatCurrency(group.target_amount)}</h3>
          </div>
          <strong>${group.completion}%</strong>
        </div>
        <div class="progress-track" aria-label="${group.completion}% collected"><div class="progress-fill" style="--value:${group.completion}%"></div></div>
        <div class="detail-list">
          <div class="summary-row"><span>Members with records</span><strong>${summary.members}</strong></div>
          <div class="summary-row"><span>Payment status</span><strong>${summary.paid} paid, ${summary.pending} pending, ${summary.unpaid + summary.rejected} open</strong></div>
        </div>
      </div>
      <div class="inline-actions">
        <a class="button" href="${nextHref}">${nextLabel}</a>
        <a class="button-ghost" href="${secondaryHref}">${secondaryLabel}</a>
      </div>
    </article>
  `;
}

function donutChartTemplate(segments, metricsState) {
  const total = segments.reduce((sum, item) => sum + item.count, 0);
  if (!total) {
    return `
      <div class="empty-card">
        <h3>No payment records yet</h3>
        <p class="helper-text">Create a contribution or wait for member payment rows before the chart appears.</p>
      </div>
    `;
  }

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const activeSegment = segments.find((item) => item.count > 0) || segments[0];
  const circles = segments
    .filter((item) => item.count > 0)
    .map((item) => {
      const length = (item.count / total) * circumference;
      const percent = Math.round((item.count / total) * 100);
      const circle = `
        <circle
          class="donut-segment ${item.key === activeSegment.key ? "is-active" : ""}"
          tabindex="0"
          role="button"
          aria-label="${item.label}: ${item.count} records, ${percent}%, ${formatCurrency(item.amount)}"
          data-chart-segment="${item.key}"
          cx="50"
          cy="50"
          r="${radius}"
          stroke="${item.color}"
          stroke-dasharray="${length} ${circumference - length}"
          stroke-dashoffset="${-offset}"
        ></circle>
      `;
      offset += length;
      return circle;
    })
    .join("");

  return `
    <div class="donut-layout">
      <div class="donut-wrap">
        <svg class="donut-chart" viewBox="0 0 100 100" role="img" aria-label="Payment status donut chart">
          <circle cx="50" cy="50" r="${radius}" fill="none" stroke="color-mix(in srgb, var(--color-text-muted) 14%, var(--color-surface))" stroke-width="12"></circle>
          ${circles}
        </svg>
        <div class="donut-center" aria-hidden="true">
          <div>
            <strong>${metricsState.completion}%</strong>
            <span>collected</span>
          </div>
        </div>
      </div>
      <div class="status-legend" data-chart-legend>
        ${segments.map((item) => {
          const percent = total ? Math.round((item.count / total) * 100) : 0;
          return `
            <button class="legend-button ${item.key === activeSegment.key ? "is-active" : ""}" type="button" data-chart-segment="${item.key}">
              <span class="legend-swatch" style="--swatch:${item.color}"></span>
              <span class="legend-label"><strong>${item.label}</strong><span>${item.count} records - ${formatCurrency(item.amount)}</span></span>
              <strong>${percent}%</strong>
            </button>
          `;
        }).join("")}
        <div class="donut-detail" data-chart-detail>
          <strong>${activeSegment.label}</strong>
          <p class="helper-text">${activeSegment.count} records worth ${formatCurrency(activeSegment.amount)}.</p>
        </div>
      </div>
    </div>
  `;
}

function bindDonutChart(segments) {
  const chart = document.querySelector("[data-chart-legend]");
  const detail = document.querySelector("[data-chart-detail]");
  if (!chart || !detail) return;

  const activate = (key) => {
    const segment = segments.find((item) => item.key === key);
    if (!segment) return;
    document.querySelectorAll("[data-chart-segment]").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.chartSegment === key);
    });
    detail.innerHTML = `<strong>${segment.label}</strong><p class="helper-text">${segment.count} records worth ${formatCurrency(segment.amount)}.</p>`;
  };

  document.querySelectorAll("[data-chart-segment]").forEach((item) => {
    item.addEventListener("mouseenter", () => activate(item.dataset.chartSegment));
    item.addEventListener("focus", () => activate(item.dataset.chartSegment));
    item.addEventListener("click", () => activate(item.dataset.chartSegment));
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate(item.dataset.chartSegment);
      }
    });
  });
}

export async function initDashboardPage() {
  if (document.body.dataset.appPage !== "dashboard") return;

  const session = await getCurrentSession() || { user_id: null, active_group_id: null, role: "member" };
  const state = getState();
  const role = getActiveRoleKey(state, session);
  const metricsState = buildDashboardMetrics(state, session.user_id, session.active_group_id);
  const pending = role === "treasurer" ? await getPendingPayments(session.active_group_id) : [];
  const metrics = document.querySelector("[data-dashboard-stats]");
  const charts = document.querySelector("[data-dashboard-charts]");
  const activity = document.querySelector("[data-dashboard-activity]");
  const activitySort = document.querySelector("[data-activity-sort]");
  const overview = document.querySelector("[data-dashboard-overview]");
  const actions = document.querySelector("[data-dashboard-actions]");
  const segments = buildStatusSegments(metricsState);

  metrics.innerHTML = `
    <article class="stat-card"><span class="muted">${role === "treasurer" ? "Managed groups" : "Joined groups"}</span><strong>${metricsState.groups.length}</strong><span class="helper-text">From your group_members rows.</span></article>
    <article class="stat-card"><span class="muted">${role === "member" ? "Current due amount" : "Target amount"}</span><strong>${formatCurrency(role === "member" ? metricsState.myPendingAmount : metricsState.totalTarget)}</strong><span class="helper-text">${role === "member" ? "Unpaid, overdue, rejected, and pending dues in this group." : "Target for the active group context."}</span></article>
    <article class="stat-card"><span class="muted">${role === "member" ? "Confirmed total" : "Collected total"}</span><strong>${formatCurrency(role === "member" ? metricsState.myConfirmedTotal : metricsState.totalCollected)}</strong><span class="helper-text">Recalculated from payment_records.</span></article>
    <article class="stat-card"><span class="muted">${role === "member" ? "Waiting for review" : "Pending confirmations"}</span><strong>${role === "member" ? metricsState.myPendingCount : pending.length}</strong><span class="helper-text">${role === "member" ? "Marked paid and waiting for treasurer confirmation." : "Claims ready for action."}</span></article>
  `;

  if (actions) {
    actions.innerHTML = role === "member"
      ? `<a class="button" href="./contributions.html">Review my dues</a><a class="button-secondary" href="./join-group.html">Join with code</a>`
      : `<a class="button" href="./confirmations.html">Review pending claims</a><a class="button-secondary" href="./create-group.html">Create group</a>`;
  }

  charts.innerHTML = `
    <article class="chart-card chart-stack">
      <div class="page-header">
        <div>
          <p class="eyebrow">Collected vs target</p>
          <h3>${metricsState.completion}% complete</h3>
          <p class="helper-text">Confirmed payments count toward the collected total.</p>
        </div>
        <span class="status-chip status-paid">${formatCurrency(metricsState.totalCollected)}</span>
      </div>
      <div class="progress-track" aria-label="${metricsState.completion}% collected"><div class="progress-fill" style="--value:${metricsState.completion}%"></div></div>
      <div class="chart-legend">
        <div class="legend-item"><span>Target</span><strong>${formatCurrency(metricsState.totalTarget)}</strong></div>
        <div class="legend-item"><span>Pending review value</span><strong>${formatCurrency(metricsState.totalPendingAmount)}</strong></div>
      </div>
    </article>
    <article class="chart-card chart-stack">
      <div class="page-header">
        <div>
          <p class="eyebrow">Payment status mix</p>
          <h3>${metricsState.payments.length} payment records</h3>
          <p class="helper-text">Hover, focus, or tap a slice to inspect status totals.</p>
        </div>
      </div>
      ${donutChartTemplate(segments, metricsState)}
    </article>
  `;
  bindDonutChart(segments);

  const groupsToShow = metricsState.groupProgress.length ? metricsState.groupProgress : metricsState.groups;
  overview.classList.toggle("is-single", groupsToShow.length === 1);
  overview.classList.toggle("is-multiple", groupsToShow.length > 1);
  overview.innerHTML = groupsToShow.length
    ? groupsToShow.map((group) => activeGroupTemplate(group, metricsState, group.member_role === "Treasurer" ? "treasurer" : "member")).join("")
    : `<article class="empty-card"><h3>No active group yet</h3><p class="helper-text">Join with a group code or create a group to start tracking contributions.</p></article>`;

  const renderActivity = () => {
    const direction = activitySort?.value || "newest";
    const recentActivity = getUserVisibleActivity(state, session.user_id, session.active_group_id)
      .sort((a, b) => {
        const left = new Date(a.created_at).getTime();
        const right = new Date(b.created_at).getTime();
        return direction === "oldest" ? left - right : right - left;
      });

    activity.innerHTML = recentActivity.length ? recentActivity
      .slice(0, 8)
      .map((item) => {
        const text = activityText(item);
        return `
          <article class="timeline-item">
            <div>
              <strong>${text.title}</strong>
              <p class="helper-text">${text.meta}</p>
            </div>
            <span class="muted">${formatShortDateTime(item.created_at)}</span>
          </article>
        `;
      })
      .join("") : `<article class="empty-card"><h3>No activity yet</h3><p class="helper-text">Create a group, add a contribution, or mark a payment to start the feed.</p></article>`;
  };

  activitySort?.addEventListener("change", renderActivity);
  renderActivity();
}
