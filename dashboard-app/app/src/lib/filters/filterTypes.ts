export type FilterMode = "include" | "exclude";
export type FacetOperator = "any" | "all";

export type DashboardFilters = {
  text: string;
  countries: string[];
  regions: string[];
  focalAreas: string[];
  statuses: string[];
  statusGroups: string[];
  operationalPhases: string[];
  startYearRange: [number | null, number | null];
  grantAmountRange: [number | null, number | null];
  cofinancingTotalRange: [number | null, number | null];
  cofinancingLeverageRange: [number | null, number | null];
  fundingSources: string[];
  institutionalTypes: string[];
  projectCategories: string[];
  fullGrant: boolean | null;
  granteeNames: string[];
  cofinancerTypes: string[];
  cofinancerCountries: string[];
  cofinancerNames: string[];
  facetMode: Record<string, FilterMode>;
  facetOperator: Record<string, FacetOperator>;
  compareMode: boolean;
  comparisonA?: Partial<DashboardFilters>;
  comparisonB?: Partial<DashboardFilters>;
};

export const DEFAULT_FILTERS: DashboardFilters = {
  text: "",
  countries: [],
  regions: [],
  focalAreas: [],
  statuses: [],
  statusGroups: [],
  operationalPhases: [],
  startYearRange: [null, null],
  grantAmountRange: [null, null],
  cofinancingTotalRange: [null, null],
  cofinancingLeverageRange: [null, null],
  fundingSources: [],
  institutionalTypes: [],
  projectCategories: [],
  fullGrant: null,
  granteeNames: [],
  cofinancerTypes: [],
  cofinancerCountries: [],
  cofinancerNames: [],
  facetMode: {},
  facetOperator: {},
  compareMode: false
};

export type FilteredResult = {
  projects: import("../data/schema").ProjectRecord[];
  cofinancing: import("../data/schema").CofinancingRecord[];
  projectNumberSet: Set<string>;
};
