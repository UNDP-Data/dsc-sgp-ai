import { create } from "zustand";
import { colorSchemes, defaultColorSchemeId, type ColorSchemeId } from "../viz/colorSchemes";
import { DEFAULT_FILTERS, type DashboardFilters } from "./filterTypes";

type DashboardView = "trends" | "themes" | "finance" | "networks" | "table";
type ThemeMode = ColorSchemeId;
const COLOR_SCHEME_STORAGE_KEY = "sgp.color-scheme";

type StoreState = {
  filters: DashboardFilters;
  history: DashboardFilters[];
  future: DashboardFilters[];
  activeView: DashboardView;
  theme: ThemeMode;
  selectedProjectRowId: string | null;
  selectedCountryIso3: string | null;
  mapMetric: import("../data/schema").MetricKey;
  setFilters: (patch: Partial<DashboardFilters>, replace?: boolean) => void;
  resetFilters: () => void;
  undo: () => void;
  redo: () => void;
  setActiveView: (view: DashboardView) => void;
  setTheme: (theme: ThemeMode) => void;
  setSelectedProject: (rowId: string | null) => void;
  setSelectedCountry: (iso3: string | null) => void;
  setMapMetric: (metric: import("../data/schema").MetricKey) => void;
};

function cloneFilters(filters: DashboardFilters): DashboardFilters {
  return structuredClone(filters);
}

function initialTheme(): ThemeMode {
  if (typeof window === "undefined") return defaultColorSchemeId;
  const stored = window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
  return colorSchemes.some((scheme) => scheme.id === stored) ? (stored as ThemeMode) : defaultColorSchemeId;
}

export const useDashboardStore = create<StoreState>((set) => ({
  filters: cloneFilters(DEFAULT_FILTERS),
  history: [],
  future: [],
  activeView: "trends",
  theme: initialTheme(),
  selectedProjectRowId: null,
  selectedCountryIso3: null,
  mapMetric: "grantAmount",
  setFilters: (patch, replace = false) =>
    set((state) => {
      const next = replace ? { ...cloneFilters(DEFAULT_FILTERS), ...patch } : { ...state.filters, ...patch };
      return {
        filters: next,
        history: [...state.history.slice(-30), cloneFilters(state.filters)],
        future: []
      };
    }),
  resetFilters: () =>
    set((state) => ({
      filters: cloneFilters(DEFAULT_FILTERS),
      history: [...state.history.slice(-30), cloneFilters(state.filters)],
      future: []
    })),
  undo: () =>
    set((state) => {
      const previous = state.history.at(-1);
      if (!previous) return state;
      return {
        filters: previous,
        history: state.history.slice(0, -1),
        future: [cloneFilters(state.filters), ...state.future]
      };
    }),
  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return state;
      return {
        filters: next,
        history: [...state.history, cloneFilters(state.filters)],
        future: state.future.slice(1)
      };
    }),
  setActiveView: (activeView) => set({ activeView }),
  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, theme);
    }
    set({ theme });
  },
  setSelectedProject: (selectedProjectRowId) => set({ selectedProjectRowId }),
  setSelectedCountry: (selectedCountryIso3) => set({ selectedCountryIso3 }),
  setMapMetric: (mapMetric) => set({ mapMetric })
}));

export type { DashboardView, ThemeMode };
