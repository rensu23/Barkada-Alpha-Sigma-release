import { apiUrl, fetchJson, postJson } from "./api.service.js";

export async function getUserProfile(userId) {
  const data = await fetchJson(apiUrl("users/profile.php"));
  return data.profile || null;
}

export async function updateUserProfile(userId, payload) {
  const data = await postJson("users/update-profile.php", payload);
  return data.profile || null;
}

export async function getUsers() {
  // Avoid listing all users unless an authorized member-management endpoint needs it.
  return [];
}
