import { logoutUser } from "./services/auth.service.js";

export function initSettingsPage() {
  if (document.body.dataset.appPage !== "settings") return;

  document.querySelector("[data-logout]")?.addEventListener("click", async () => {
    await logoutUser();
    window.location.href = "../pages/login.html";
  });
}
