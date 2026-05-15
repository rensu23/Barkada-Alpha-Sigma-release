import { apiUrl, fetchJson, postJson } from "./api.service.js";

export async function getContributions(filterGroupId = "", query = {}) {
  const params = new URLSearchParams();
  if (filterGroupId) params.set("group_id", filterGroupId);
  Object.entries(query).forEach(([key, value]) => {
    if (value && value !== "All") params.set(key, value);
  });
  const suffix = params.toString() ? `?${params}` : "";
  const data = await fetchJson(`${apiUrl("contributions/list.php")}${suffix}`);
  return data.contributions || [];
}

export async function createContribution(payload) {
  return postJson("contributions/create.php", payload);
}

export async function getContributionHistory(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value && value !== "All") params.set(key, value);
  });
  const suffix = params.toString() ? `?${params}` : "";
  const data = await fetchJson(`${apiUrl("payments/history.php")}${suffix}`);
  return data.history || [];
}

export async function getRecurringCycles(userId) {
  const data = await fetchJson(apiUrl("contributions/recurring.php"));
  return data.cycles || [];
}
