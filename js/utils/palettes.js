export const DEFAULT_PALETTE = "midnight-teal";

export const PALETTES = [
  {
    id: "midnight-teal",
    label: "Noe's Midnight",
    description: "Dark teal",
  },
  {
    id: "witch-cherry",
    label: "Dimson's Kiss",
    description: "Gothic wine",
  },
  {
    id: "rose-dusk",
    label: "Delfin's Blush",
    description: "Soft mauve",
  },
  {
    id: "garnet-bloom",
    label: "Javellena's Bloom",
    description: "Deep berry",
  },
  {
    id: "forest-sage",
    label: "Alido's Whisper",
    description: "Calm green",
  },
  {
    id: "golden-ember",
    label: "Janeo's Ember",
    description: "Warm gold",
  },
  {
    id: "soft-mist",
    label: "Marcelino's Oat",
    description: "Light mist",
  },
];

export function normalizePalette(value) {
  return PALETTES.some((palette) => palette.id === value) ? value : DEFAULT_PALETTE;
}
