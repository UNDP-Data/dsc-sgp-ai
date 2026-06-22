import { getColorScheme, type ColorSchemeId } from "./colorSchemes";

export const tokens = {
  colors: {
    undpBlue: "#006EB5",
    deepBlue: "#071A2F",
    ocean: "#0E7490",
    forest: "#2F855A",
    amber: "#D97706",
    rose: "#BE123C",
    violet: "#6D28D9",
    slate: "#334155"
  },
  focalAreas: {
    Biodiversity: "#2F855A",
    "Climate Change": "#006EB5",
    "Land Degradation": "#B7791F",
    "Multifocal Area": "#6D28D9",
    "Capacity Development": "#0E7490",
    "International Waters": "#0284C7",
    "Chemicals and Waste": "#BE123C",
    "Climate Change Adaptation": "#16A34A",
    Missing: "#64748B"
  } as Record<string, string>
};

export const categoricalPalette = [
  "#006EB5",
  "#2F855A",
  "#B7791F",
  "#6D28D9",
  "#0E7490",
  "#BE123C",
  "#64748B",
  "#DB2777",
  "#0891B2",
  "#4D7C0F"
];

const focalAreaOrder = [
  "Biodiversity",
  "Climate Change",
  "Land Degradation",
  "Multifocal Area",
  "Capacity Development",
  "International Waters",
  "Chemicals and Waste",
  "Climate Change Adaptation",
  "Missing"
];

export function categoricalPaletteForScheme(schemeId?: ColorSchemeId | string) {
  return schemeId ? getColorScheme(schemeId).colors.charts : categoricalPalette;
}

export function focalAreaColor(label: string | null | undefined, schemeId?: ColorSchemeId | string) {
  if (!schemeId || schemeId === "sgp") {
    return tokens.focalAreas[label || "Missing"] ?? tokens.focalAreas.Missing;
  }
  const scheme = getColorScheme(schemeId);
  const index = Math.max(0, focalAreaOrder.indexOf(label || "Missing"));
  return scheme.colors.charts[index % scheme.colors.charts.length];
}
