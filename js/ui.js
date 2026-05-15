import { qs } from "./utils/helpers.js";

export function ensureToastRoot() {
  let root = qs("[data-toast-root]");
  if (!root) {
    root = document.createElement("div");
    root.className = "toast-stack";
    root.setAttribute("data-toast-root", "");
    document.body.append(root);
  }
  return root;
}

export function showToast(message, variant = "success") {
  const root = ensureToastRoot();
  const toast = document.createElement("div");
  toast.className = `toast ${variant}`;
  toast.innerHTML = `<strong>${variant === "error" ? "Please check" : "Done"}</strong><p class="helper-text">${message}</p>`;
  root.append(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

export function closeOverlay(overlay) {
  overlay?.classList.remove("is-open");
}

export function openModal({ title, body, actions = "" }) {
  let overlay = qs("[data-modal-backdrop]");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.setAttribute("data-modal-backdrop", "");
    document.body.append(overlay);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeOverlay(overlay);
    });
  }

  overlay.innerHTML = `
    <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="page-header">
        <div class="page-header-copy">
          <h3 id="modal-title">${title}</h3>
          <p class="helper-text">${body}</p>
        </div>
        <button class="button-ghost" type="button" data-close-modal>Close</button>
      </div>
      <div class="space-top">${actions}</div>
    </div>
  `;
  overlay.classList.add("is-open");
  overlay.querySelector("[data-close-modal]")?.addEventListener("click", () => closeOverlay(overlay));
  return overlay;
}

export function openDrawer(content) {
  let overlay = qs("[data-drawer-backdrop]");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "drawer-backdrop";
    overlay.setAttribute("data-drawer-backdrop", "");
    document.body.append(overlay);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeOverlay(overlay);
    });
  }

  overlay.innerHTML = `<aside class="drawer-panel">${content}</aside>`;
  overlay.classList.add("is-open");
  return overlay;
}

export function bindOfflineBanner() {
  const banner = qs("[data-offline-banner]");
  if (!banner) return;

  function updateBanner() {
    banner.classList.toggle("is-visible", !navigator.onLine);
  }

  updateBanner();
  window.addEventListener("online", updateBanner);
  window.addEventListener("offline", updateBanner);
}
