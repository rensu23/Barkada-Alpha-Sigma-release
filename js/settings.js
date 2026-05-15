import { getCurrentSession, logoutUser } from "./services/auth.service.js";
import { getUserProfile, updateUserProfile } from "./services/user.service.js";
import { bindPaletteControls, renderPaletteSelector } from "./theme.js";
import { showToast } from "./ui.js";

export async function initSettingsPage() {
  if (document.body.dataset.appPage !== "settings") return;

  const session = await getCurrentSession();
  const profile = await getUserProfile(session?.user_id);
  const activeGroup = (session?.groups || []).find((group) => Number(group.group_id) === Number(session?.active_group_id));
  const form = document.querySelector("[data-settings-profile-form]");

  if (form) {
    form.name.value = profile?.name || session?.name || "";
    form.email.value = profile?.email || session?.email || "";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(form).entries());
      try {
        await updateUserProfile(session?.user_id, payload);
        showToast("Profile details updated.");
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  }

  const roleTarget = document.querySelector("[data-settings-role]");
  const groupTarget = document.querySelector("[data-settings-group]");
  if (roleTarget) roleTarget.textContent = activeGroup?.member_role || session?.role || "Member";
  if (groupTarget) groupTarget.textContent = activeGroup?.group_name || "No active group";
  renderPaletteSelector(document.querySelector("[data-palette-options]"));
  bindPaletteControls();

  document.querySelector("[data-logout]")?.addEventListener("click", async () => {
    await logoutUser();
    window.location.href = "../pages/login.html";
  });
}
