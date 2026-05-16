import { APP_PAGES, NAV_ITEMS, QUICK_LINKS } from "./utils/constants.js";
import { setActiveGroup } from "./services/auth.service.js";
import { getSession } from "./utils/storage.js";

const LANE_ORDER = ["Overview", "Groups", "Contributions", "Payments", "Members", "Reports"];
const APP_LOGO_SRC = "../assets/icons/Logo.png";
const SETTINGS_ICON = `<span class="settings-cog-icon" aria-hidden="true"></span>`;
const ICONS = {
  Home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z"/></svg>`,
  Grid: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h7v6H4V5Zm9 0h7v6h-7V5ZM4 13h7v6H4v-6Zm9 0h7v6h-7v-6Z"/></svg>`,
  List: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10a2 2 0 0 1 2 2v14l-3-1.5-3 1.5-3-1.5L7 20V4Zm3 5h6M10 13h6"/></svg>`,
  Check: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 2.8 8.4 7 10 4.2-1.6 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4"/></svg>`,
  Users: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6.5-1.5a3 3 0 1 0 0-6M3 21v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2m2-7c2.3.3 4 2.2 4 4.6V21"/></svg>`,
  Clock: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a8 8 0 1 0 8 8 8 8 0 0 0-8-8Zm0 4v5l3 2"/></svg>`,
  Join: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 9a7 7 0 0 1 14 0M17 9h4m-2-2v4"/></svg>`,
  Menu: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>`,
  User: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 9a7 7 0 0 1 14 0"/></svg>`,
};

function logoTemplate(src = APP_LOGO_SRC) {
  return `<span class="brand-mark"><img src="${src}" alt="Barkada logo"></span>`;
}

function isActivePage(item, currentPage) {
  if (item.page === currentPage) return true;
  return item.page === "groups" && ["group-details", "create-group", "edit-group"].includes(currentPage);
}

function groupedLinks(links) {
  return LANE_ORDER.map((lane) => ({
    lane,
    links: links.filter((item) => item.lane === lane),
  })).filter((group) => group.links.length);
}

function navLinkTemplate(item, currentPage, options = {}) {
  const withMeta = typeof options === "boolean" ? options : options.withMeta ?? true;
  const iconOnly = typeof options === "object" && options.iconOnly;
  const active = isActivePage(item, currentPage);
  return `
    <a class="nav-link ${iconOnly ? "nav-link-icon-only" : ""} ${active ? "is-active" : ""}" href="${item.href}" ${active ? 'aria-current="page"' : ""} title="${item.label}" aria-label="${item.label}">
      <span class="nav-icon" aria-hidden="true">${ICONS[item.icon] || ""}</span>
      <span class="${iconOnly ? "sr-only" : ""}">${item.label}${withMeta && item.meta ? `<small>${item.meta}</small>` : ""}</span>
    </a>
  `;
}

function publicHeaderTemplate() {
  const isPageFolder = window.location.pathname.includes("/pages/");
  const homeHref = isPageFolder ? "../index.html" : "./index.html";
  const loginHref = isPageFolder ? "./login.html" : "./pages/login.html";
  const signupHref = isPageFolder ? "./signup.html" : "./pages/signup.html";
  const joinHref = isPageFolder ? "./join-group.html" : "./pages/join-group.html";

  return `
    <div class="brand">
      ${logoTemplate(isPageFolder ? "../assets/icons/Logo.png" : "./assets/icons/Logo.png")}
      <span>Barkada</span>
    </div>
    <nav class="public-nav">
      <a href="${homeHref}">Home</a>
      <a href="${loginHref}">Login</a>
      <a href="${signupHref}">Sign up</a>
      <a href="${joinHref}">Join group</a>
    </nav>
  `;
}

function appSidebarTemplate(role, currentPage, session, groups, activeGroupId) {
  const links = NAV_ITEMS[role] || NAV_ITEMS.member;
  return `
    <a class="brand sidebar-brand" href="../pages/dashboard.html" title="Barkada dashboard" aria-label="Barkada dashboard">
      ${logoTemplate()}
    </a>
    <nav class="surface-list sidebar-nav" aria-label="Main navigation">
      ${groupedLinks(links)
        .map(
          (group) => `
          <div class="nav-group">
            ${group.links.map((item) => navLinkTemplate(item, currentPage, { iconOnly: true })).join("")}
          </div>
        `,
        )
        .join("")}
    </nav>
    <a class="icon-button sidebar-join" href="../pages/join-group.html" title="Join with code" aria-label="Join with code">
      ${ICONS.Join}
    </a>
  `;
}

function appTopbarTemplate(currentPage, session, groups, activeGroupId, role) {
  const displayName = session?.name || "Loading user";
  const options = groups
    .map(
      (group) => `<option value="${group.group_id}" ${Number(group.group_id) === Number(activeGroupId) ? "selected" : ""}>${group.group_name} - ${group.member_role}</option>`,
    )
    .join("");
  return `
    <div class="topbar-title">
      <p class="app-kicker">${role === "treasurer" ? "Treasurer view" : "Member view"}</p>
      <h2>${APP_PAGES[currentPage] || "Barkada"}</h2>
    </div>
    <div class="topbar-actions">
      ${groups.length ? `<div class="context-picker"><select data-group-switch aria-label="Switch active group">${options}</select></div>` : ""}
      <a class="icon-button" href="../pages/settings.html" aria-label="Open settings">
        ${SETTINGS_ICON}
      </a>
    </div>
  `;
}

function bottomNavTemplate(currentPage) {
  const links = [
    { page: "dashboard", label: "Home", href: "../pages/dashboard.html", icon: "Home" },
    { page: "groups", label: "Groups", href: "../pages/groups.html", icon: "Grid" },
    { page: "contributions", label: "Dues", href: "../pages/contributions.html", icon: "List" },
    { page: "join-group", label: "Join", href: "../pages/join-group.html", icon: "Join" },
  ];
  return `${links
    .map((item) => {
      const active = isActivePage(item, currentPage);
      return `
        <a class="bottom-nav-link ${active ? "is-active" : ""}" href="${item.href}" ${active ? 'aria-current="page"' : ""}>
          <span class="nav-icon" aria-hidden="true">${ICONS[item.icon]}</span>
          <span>${item.label}</span>
        </a>
      `;
    })
    .join("")}
    <button class="bottom-nav-button bottom-nav-menu" type="button" data-mobile-menu-open aria-label="Open menu">
      <span class="nav-icon" aria-hidden="true">${ICONS.Menu}</span>
    </button>`;
}

function mobileMenuTemplate(role, currentPage, session, groups, activeGroupId) {
  const links = NAV_ITEMS[role] || NAV_ITEMS.member;
  const activeGroup = groups.find((group) => Number(group.group_id) === Number(activeGroupId));
  const displayName = session?.name || "Loading user";
  return `
    <div class="mobile-menu-backdrop" data-mobile-menu aria-hidden="true">
      <aside class="mobile-menu-panel" aria-label="Mobile menu">
        <div class="page-header">
          <div class="page-header-copy">
            <p class="eyebrow">${role === "treasurer" ? "Treasurer menu" : "Member menu"}</p>
            <h2>${displayName}</h2>
            <p class="helper-text">${activeGroup ? `${activeGroup.group_name} - ${activeGroup.member_role}` : "Choose or join a group to begin."}</p>
          </div>
          <button class="button-ghost" type="button" data-mobile-menu-close aria-label="Close menu">Close</button>
        </div>
        <nav class="surface-list mobile-menu-scroll" aria-label="Secondary mobile navigation">
          ${groupedLinks(links)
            .map(
              (group) => `
              <div class="nav-group">
                <p class="nav-section-label">${group.lane}</p>
                ${group.links.map((item) => navLinkTemplate(item, currentPage, false)).join("")}
              </div>
            `,
            )
            .join("")}
          <a class="button-secondary button-block" href="../pages/join-group.html">Join with code</a>
          <a class="button-ghost button-block" href="../pages/settings.html">${SETTINGS_ICON}<span>Settings</span></a>
        </nav>
      </aside>
    </div>
  `;
}

export function initPublicNavigation() {
  const header = document.querySelector("[data-public-header]");
  if (header) {
    header.classList.add("public-header", "container");
    header.innerHTML = publicHeaderTemplate();
  }
}

export function initAppNavigation() {
  const shell = document.body.dataset.appPage;
  if (!shell) return;

  const session = getSession();
  const groups = session?.groups || [];
  const activeGroupId = session?.active_group_id || groups[0]?.group_id || null;
  const activeGroup = groups.find((group) => Number(group.group_id) === Number(activeGroupId));
  const role = activeGroup?.member_role === "Treasurer" ? "treasurer" : "member";
  const sidebar = document.querySelector("[data-sidebar]");
  const topbar = document.querySelector("[data-topbar]");
  const bottomNav = document.querySelector("[data-bottom-nav]");

  if (sidebar) sidebar.innerHTML = appSidebarTemplate(role, shell, session, groups, activeGroupId);
  if (topbar) topbar.innerHTML = appTopbarTemplate(shell, session, groups, activeGroupId, role);
  if (bottomNav) bottomNav.innerHTML = bottomNavTemplate(shell);

  document.querySelector("[data-mobile-menu]")?.remove();
  document.body.insertAdjacentHTML("beforeend", mobileMenuTemplate(role, shell, session, groups, activeGroupId));

  document.querySelector("[data-group-switch]")?.addEventListener("change", async (event) => {
    await setActiveGroup(event.currentTarget.value);
    window.location.reload();
  });

  const closeMobileMenu = () => {
    const menu = document.querySelector("[data-mobile-menu]");
    menu?.classList.remove("is-open");
    menu?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("has-mobile-menu");
  };

  document.querySelector("[data-mobile-menu-open]")?.addEventListener("click", () => {
    const menu = document.querySelector("[data-mobile-menu]");
    menu?.classList.add("is-open");
    menu?.setAttribute("aria-hidden", "false");
    document.body.classList.add("has-mobile-menu");
    menu?.querySelector("[data-mobile-menu-close]")?.focus();
  });

  document.querySelector("[data-mobile-menu-close]")?.addEventListener("click", closeMobileMenu);
  document.querySelector("[data-mobile-menu]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeMobileMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMobileMenu();
  });
}

export function initRoleSwitcher() {
  const field = document.querySelector("[data-role-switch]");
  if (!field) return;
  const session = getSession();
  const activeGroup = (session?.groups || []).find((group) => Number(group.group_id) === Number(session?.active_group_id));
  field.value = activeGroup?.member_role === "Treasurer" ? "treasurer" : "member";
  field.disabled = true;
}

export function initLandingLinks() {
  const target = document.querySelector("[data-quick-links]");
  if (!target) return;
  target.innerHTML = QUICK_LINKS.map((link) => `<a class="button-secondary" href="${link.href}">${link.label}</a>`).join("");
}
