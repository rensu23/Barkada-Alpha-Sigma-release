import { STORAGE_KEYS } from "./utils/constants.js";
import { DEFAULT_PALETTE, PALETTES, normalizePalette } from "./utils/palettes.js";

let paletteEventsBound = false;

function legacyThemeFallback() {
  return localStorage.getItem(STORAGE_KEYS.theme) === "light" ? "soft-mist" : DEFAULT_PALETTE;
}

export function getSavedPalette() {
  return normalizePalette(localStorage.getItem(STORAGE_KEYS.palette) || legacyThemeFallback());
}

export function setPalette(paletteId) {
  const palette = normalizePalette(paletteId);
  document.documentElement.dataset.palette = palette;
  document.documentElement.dataset.theme = palette === "soft-mist" ? "light" : "dark";
  localStorage.setItem(STORAGE_KEYS.palette, palette);
  syncPaletteControls(palette);
  return palette;
}

export function applySavedPalette() {
  setPalette(getSavedPalette());
}

export function syncPaletteControls(activePalette = getSavedPalette()) {
  const selected = normalizePalette(activePalette);
  document.querySelectorAll("[data-palette-option]").forEach((button) => {
    const isSelected = button.dataset.paletteOption === selected;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  document.querySelectorAll("[data-current-palette]").forEach((target) => {
    target.textContent = PALETTES.find((palette) => palette.id === selected)?.label || "Midnight Teal";
  });
}

export function renderPaletteSelector(target) {
  if (!target) return;
  target.innerHTML = PALETTES.map(
    (palette) => `
      <button class="palette-card" type="button" data-palette-option="${palette.id}" aria-pressed="false">
        <span class="palette-card-copy">
          <strong>${palette.label}</strong>
          <small>${palette.description}</small>
        </span>
        <span class="palette-swatches" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span><span></span>
        </span>
      </button>
    `,
  ).join("");
  syncPaletteControls();
}

export function bindPaletteControls() {
  if (paletteEventsBound) return;
  paletteEventsBound = true;
  document.addEventListener("click", (event) => {
    const option = event.target.closest("[data-palette-option]");
    if (!option) return;
    setPalette(option.dataset.paletteOption);
  });
}
