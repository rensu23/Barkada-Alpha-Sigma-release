import { apiUrl, fetchJson, postJson } from "./api.service.js";
import { updateSession } from "../utils/storage.js";

export async function getGroupsForUser(userId) {
  const data = await fetchJson(apiUrl("groups/list.php"));
  return data.groups || [];
}

export async function getGroupById(groupId) {
  const data = await fetchJson(`${apiUrl("groups/detail.php")}?group_id=${encodeURIComponent(groupId)}`);
  return data.group || null;
}

export async function createGroup(payload, currentUserId) {
  return postJson("groups/create.php", payload);
}

export async function updateGroup(groupId, payload) {
  return postJson("groups/update.php", { ...payload, group_id: Number(groupId) });
}

export async function joinGroupByCode(joinCode, userId) {
  const data = await postJson("groups/join.php", { join_code: joinCode });
  if (data.user) updateSession(data.user);
  return data;
}

export async function getMembersForGroup(groupId, filters = {}) {
  const params = new URLSearchParams();
  if (groupId) params.set("group_id", groupId);
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== "All") params.set(key, value);
  });
  const suffix = params.toString() ? `?${params}` : "";
  const url = `${apiUrl("groups/members.php")}${suffix}`;
  const data = await fetchJson(url);
  return data.members || [];
}
