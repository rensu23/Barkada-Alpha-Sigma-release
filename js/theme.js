import { STORAGE_KEYS } from "./utils/constants.js";

export function applySavedTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || "light";
  document.documentElement.dataset.theme = savedTheme;
  syncThemeButtons(savedTheme);
}

export function toggleTheme() {
  const current = document.documentElement.dataset.theme || "light";
  const next = current === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem(STORAGE_KEYS.theme, next);
  syncThemeButtons(next);
}

export function syncThemeButtons(theme) {
  document.querySelectorAll("[data-theme-label]").forEach((label) => {
    label.textContent = theme === "light" ? "Dark mode" : "Light mode";
  });
}

export function bindThemeButtons() {
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", toggleTheme);
  });
}
