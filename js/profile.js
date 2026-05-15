import { getCurrentSession } from "./services/auth.service.js";
import { getUserProfile, updateUserProfile } from "./services/user.service.js";
import { showToast } from "./ui.js";

export async function initProfilePage() {
  const page = document.body.dataset.appPage;
  if (page !== "profile") return;

  const session = await getCurrentSession();
  const profile = await getUserProfile(session?.user_id);
  const displayProfile = profile || session || { name: "Profile not loaded", email: "PHP session required" };
  document.querySelector("[data-profile-name]").textContent = displayProfile.name;
  document.querySelector("[data-profile-email]").textContent = displayProfile.email;
  const activeGroup = (session?.groups || []).find((group) => Number(group.group_id) === Number(session?.active_group_id));
  document.querySelector("[data-profile-role]").textContent = activeGroup?.member_role || session?.role || "Member";
  document.querySelector("[data-profile-group]").textContent = activeGroup?.group_name || "No active group";

  const form = document.querySelector("[data-profile-form]");
  form.name.value = profile?.name || "";
  form.email.value = profile?.email || "";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      await updateUserProfile(session?.user_id, payload);
      document.querySelector("[data-profile-name]").textContent = payload.name;
      document.querySelector("[data-profile-email]").textContent = payload.email;
      showToast("Profile details updated.");
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}
