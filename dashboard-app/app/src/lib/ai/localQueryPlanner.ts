import type { MetricKey } from "../data/schema";
import type { DashboardFilters } from "../filters/filterTypes";

export type AiQueryPlan = {
  interpretedQuestion: string;
  confidence: number;
  filterPatch: Partial<DashboardFilters>;
  aggregation?: {
    metric: MetricKey;
    groupBy: "country" | "region" | "focalArea" | "year" | "status" | "fundingSource" | "cofinancerType" | "cofinancerCountry";
    sort: "asc" | "desc";
    limit?: number;
  };
  visualizationHint?: "map" | "bar" | "time" | "scatter" | "sankey" | "table";
  explanation: string;
  warnings: string[];
};

export type AllowedFilterValues = {
  countries: Array<{ iso3: string; name: string }>;
  regions: string[];
  regionAliases?: Array<{ key: string; labels: string[] }>;
  focalAreas: string[];
  statuses: string[];
  fundingSources: string[];
  cofinancerTypes: string[];
};

function findCountry(query: string, allowed: AllowedFilterValues) {
  const normalized = query.toLowerCase();
  return allowed.countries.filter((country) => normalized.includes(country.name.toLowerCase()));
}

function findList(query: string, values: string[]) {
  const normalized = query.toLowerCase();
  return values.filter((value) => normalized.includes(value.toLowerCase()));
}

function amountAfter(query: string, marker: RegExp) {
  const match = query.match(marker);
  if (!match) return null;
  const raw = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(raw)) return null;
  const suffix = match[2]?.toLowerCase();
  return suffix === "m" || suffix === "million" ? raw * 1_000_000 : suffix === "k" || suffix === "thousand" ? raw * 1_000 : raw;
}

export function planLocalQuery(query: string, allowed: AllowedFilterValues): AiQueryPlan {
  const lower = query.toLowerCase();
  const filterPatch: Partial<DashboardFilters> = {};
  const warnings: string[] = [];
  let confidence = 0.35;
  let visualizationHint: AiQueryPlan["visualizationHint"] = "table";

  const countries = findCountry(lower, allowed);
  if (countries.length) {
    filterPatch.countries = countries.map((country) => country.iso3);
    confidence += 0.15;
  }

  const regions = new Set(allowed.regions.filter((region) => new RegExp(`\\b${region.toLowerCase()}\\b`).test(lower)));
  for (const alias of allowed.regionAliases ?? []) {
    if (alias.labels.some((label) => lower.includes(label.toLowerCase()))) {
      regions.add(alias.key);
    }
  }
  if (regions.size) {
    filterPatch.regions = [...regions];
    confidence += 0.12;
  }

  const focalAreas = findList(lower, allowed.focalAreas);
  if (focalAreas.length) {
    filterPatch.focalAreas = focalAreas;
    confidence += 0.15;
  }

  const statuses = findList(lower, allowed.statuses);
  if (statuses.length) {
    filterPatch.statuses = statuses;
    confidence += 0.08;
  }

  if (/\bactive|under execution|pipeline\b/.test(lower)) {
    filterPatch.statusGroups = ["active", "pipeline"];
    confidence += 0.1;
  }
  if (/\bterminated|termination\b/.test(lower)) {
    filterPatch.statusGroups = ["terminated"];
    confidence += 0.1;
  }
  if (/\bcompleted|satisfactorily\b/.test(lower)) {
    filterPatch.statusGroups = ["completed"];
    confidence += 0.08;
  }

  const after = lower.match(/\bafter\s+(\d{4})\b/);
  const since = lower.match(/\bsince\s+(\d{4})\b/);
  const fromTo = lower.match(/\bfrom\s+(\d{4})\s+(?:to|-)\s+(\d{4})\b/);
  if (fromTo) {
    filterPatch.startYearRange = [Number(fromTo[1]), Number(fromTo[2])];
    confidence += 0.12;
    visualizationHint = "time";
  } else if (after || since) {
    const year = Number((after ?? since)![1]);
    filterPatch.startYearRange = [after ? year + 1 : year, null];
    confidence += 0.12;
  }

  const cofinancingAbove = amountAfter(lower, /cofinanc(?:ing|e)?\s+(?:above|over|greater than)\s+\$?([\d,]+)\s*(k|m|thousand|million)?/);
  if (cofinancingAbove != null) {
    filterPatch.cofinancingTotalRange = [cofinancingAbove, null];
    confidence += 0.12;
  }

  const grantAbove = amountAfter(lower, /grant\s+(?:above|over|greater than)\s+\$?([\d,]+)\s*(k|m|thousand|million)?/);
  if (grantAbove != null) {
    filterPatch.grantAmountRange = [grantAbove, null];
    confidence += 0.1;
  }

  const cofinancerTypes = findList(lower, allowed.cofinancerTypes);
  if (cofinancerTypes.length) {
    filterPatch.cofinancerTypes = cofinancerTypes;
    confidence += 0.12;
    visualizationHint = "sankey";
  }

  if (/\bhighest|top|largest|rank\b/.test(lower)) {
    visualizationHint = "map";
  }

  const aggregationMetric: MetricKey = lower.includes("project") || lower.includes("record")
    ? "projectRecords"
    : lower.includes("grant")
      ? "grantAmount"
      : lower.includes("cofinancing")
        ? "cofinancingTotal"
        : "grantAmount";

  if (!Object.keys(filterPatch).length) {
    filterPatch.text = query;
    warnings.push("No structured entities were detected, so the query was applied as project text search.");
  }

  return {
    interpretedQuestion: query,
    confidence: Math.min(confidence, 0.96),
    filterPatch,
    aggregation: /\bhighest|top|largest|rank\b/.test(lower)
      ? {
          metric: aggregationMetric,
          groupBy: countries.length ? "country" : regions.size ? "region" : "country",
          sort: "desc",
          limit: 15
        }
      : undefined,
    visualizationHint,
    explanation: "Local parser matched geography, thematic, date, finance, and cofinancer phrases against the loaded dashboard facets.",
    warnings
  };
}
