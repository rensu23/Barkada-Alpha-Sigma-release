export const DEFAULT_PALETTE = "midnight-teal";

export const PALETTES = [
  {
    id: "midnight-teal",
    label: "Midnight Teal",
    description: "Dark teal",
  },
  {
    id: "witch-cherry",
    label: "Witch Cherry",
    description: "Gothic wine",
  },
  {
    id: "rose-dusk",
    label: "Rose Dusk",
    description: "Soft mauve",
  },
  {
    id: "garnet-bloom",
    label: "Garnet Bloom",
    description: "Deep berry",
  },
  {
    id: "forest-sage",
    label: "Forest Sage",
    description: "Calm green",
  },
  {
    id: "golden-ember",
    label: "Golden Ember",
    description: "Warm gold",
  },
  {
    id: "soft-mist",
    label: "Soft Mist",
    description: "Light mist",
  },
];

export function normalizePalette(value) {
  return PALETTES.some((palette) => palette.id === value) ? value : DEFAULT_PALETTE;
}
