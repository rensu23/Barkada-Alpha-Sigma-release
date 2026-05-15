import { apiUrl, fetchJson, postJson } from "./api.service.js";
import { clearSession, getSession, updateSession } from "../utils/storage.js";

export async function loginUser(payload) {
  const data = await postJson("auth/login.php", payload);
  if (data.user) updateSession(data.user);
  if (data.state) window.BARKADA_STATE = data.state;
  return data;
}

export async function registerUser(payload) {
  return postJson("auth/register.php", payload);
}

export async function requestPasswordReset(formData) {
  return postJson("auth/forgot-password.php", formData);
}

export async function resetPassword(formData) {
  return postJson("auth/reset-password.php", formData);
}

export async function getCurrentSession() {
  try {
    const data = await fetchJson(apiUrl("auth/session.php"));
    if (data.state) window.BARKADA_STATE = data.state;
    return updateSession(data.user);
  } catch (error) {
    clearSession();
    const isAppPage = Boolean(document.body.dataset.appPage);
    if (isAppPage) {
      const here = encodeURIComponent(window.location.href);
      window.location.href = `./login.html?redirect=${here}`;
    }
    return getSession();
  }
}

export async function logoutUser() {
  try {
    await postJson("auth/logout.php");
  } finally {
    clearSession();
  }
  return { ok: true };
}

export async function setActiveGroup(groupId) {
  let session = updateSession({ active_group_id: Number(groupId) });
  const data = await postJson("groups/set_active.php", { group_id: Number(groupId) });
  if (data.user) session = updateSession(data.user);

  return session;
}
