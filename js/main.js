import { initAuthPages, initRouteGuards } from "./auth.js";
import { getCurrentSession } from "./services/auth.service.js";
import { initDashboardPage } from "./dashboard.js";
import { initGroupsPage } from "./groups.js";
import { initContributionsPage } from "./contributions.js";
import { initPaymentsPage } from "./payments.js";
import { initProfilePage } from "./profile.js";
import { initSettingsPage } from "./settings.js";
import { applySavedPalette, bindPaletteControls } from "./theme.js";
import { bindOfflineBanner } from "./ui.js";
import { initAppNavigation, initLandingLinks, initPublicNavigation, initRoleSwitcher } from "./navigation.js";

function showAppLoadError(error) {
  const target = document.querySelector(".page-content") || document.body;
  target.innerHTML = `
    <main class="page-content">
      <article class="empty-card">
        <h1>Something went wrong while loading this page.</h1>
        <p class="helper-text">${error.message || "Please refresh the page or try again in a moment."}</p>
        <a class="button" href="./login.html">Back to login</a>
      </article>
    </main>
  `;
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    applySavedPalette();
    const canContinue = initRouteGuards();
    if (!canContinue) return;
    initPublicNavigation();
    if (document.body.dataset.appPage) {
      const session = await getCurrentSession();
      if (!session?.user_id) return;
    }
    initAppNavigation();
    initLandingLinks();
    initRoleSwitcher();
    bindPaletteControls();
    bindOfflineBanner();
    initAuthPages();
    await initDashboardPage();
    await initGroupsPage();
    await initContributionsPage();
    await initPaymentsPage();
    await initProfilePage();
    await initSettingsPage();
  } catch (error) {
    showAppLoadError(error);
  }
});
