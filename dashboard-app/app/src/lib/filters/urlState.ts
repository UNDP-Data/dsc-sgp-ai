import { DEFAULT_FILTERS, type DashboardFilters } from "./filterTypes";

const ARRAY_KEYS: Array<keyof DashboardFilters> = [
  "countries",
  "regions",
  "focalAreas",
  "statuses",
  "statusGroups",
  "operationalPhases",
  "fundingSources",
  "institutionalTypes",
  "projectCategories",
  "granteeNames",
  "cofinancerTypes",
  "cofinancerCountries",
  "cofinancerNames"
];

function parseRange(value: string | null): [number | null, number | null] {
  if (!value) return [null, null];
  const [min, max] = value.split(":");
  return [min ? Number(min) : null, max ? Number(max) : null];
}

function serializeRange(range: [number | null, number | null]) {
  return range[0] == null && range[1] == null ? "" : `${range[0] ?? ""}:${range[1] ?? ""}`;
}

export function filtersFromSearch(search: string): DashboardFilters {
  const params = new URLSearchParams(search);
  const filters: DashboardFilters = structuredClone(DEFAULT_FILTERS);
  filters.text = params.get("q") ?? "";
  for (const key of ARRAY_KEYS) {
    const raw = params.get(key);
    if (raw) {
      (filters[key] as string[]) = raw.split("|").filter(Boolean);
    }
  }
  filters.startYearRange = parseRange(params.get("years"));
  filters.grantAmountRange = parseRange(params.get("grant"));
  filters.cofinancingTotalRange = parseRange(params.get("cofinancing"));
  filters.cofinancingLeverageRange = parseRange(params.get("leverage"));
  const fullGrant = params.get("fullGrant");
  filters.fullGrant = fullGrant === "true" ? true : fullGrant === "false" ? false : null;
  return filters;
}

export function filtersToSearch(filters: DashboardFilters) {
  const params = new URLSearchParams();
  if (filters.text) params.set("q", filters.text);
  for (const key of ARRAY_KEYS) {
    const values = filters[key] as string[];
    if (values.length) params.set(key, values.join("|"));
  }
  const ranges: Array<[string, [number | null, number | null]]> = [
    ["years", filters.startYearRange],
    ["grant", filters.grantAmountRange],
    ["cofinancing", filters.cofinancingTotalRange],
    ["leverage", filters.cofinancingLeverageRange]
  ];
  for (const [key, range] of ranges) {
    const value = serializeRange(range);
    if (value) params.set(key, value);
  }
  if (filters.fullGrant != null) params.set("fullGrant", String(filters.fullGrant));
  return params.toString();
}
