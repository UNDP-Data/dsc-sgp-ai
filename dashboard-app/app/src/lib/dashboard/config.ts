import type { MetricKey } from "../data/schema";
import type { DashboardView } from "../filters/filterStore";

export const metricLabels: Record<MetricKey, string> = {
  projectRecords: "Grants",
  uniqueProjectNumbers: "Unique project numbers",
  countries: "Countries",
  grantAmount: "Grant amount",
  cofinancingCash: "Cash cofinancing",
  cofinancingKind: "In-kind cofinancing",
  cofinancingTotal: "Total cofinancing",
  totalInvestment: "Total investment",
  cofinancingLeverage: "Cofinancing leverage",
  averageGrant: "Average grant",
  medianGrant: "Median grant",
  activeProjects: "Active projects",
  completedProjects: "Completed projects",
  terminatedProjects: "Terminated projects",
  cofinancingRows: "Cofinancing rows",
  cofinancingPartnerCount: "Cofinancing partners"
};

export const moneyMetrics = new Set<MetricKey>([
  "grantAmount",
  "cofinancingCash",
  "cofinancingKind",
  "cofinancingTotal",
  "totalInvestment",
  "averageGrant",
  "medianGrant"
]);

export const mapMetricOptions: MetricKey[] = [
  "projectRecords",
  "grantAmount",
  "cofinancingCash",
  "cofinancingKind",
  "cofinancingTotal",
  "averageGrant",
  "activeProjects"
];

export const sgpRegionOptions: Array<{ key: string; label: string; className: string; group: string }> = [
  { key: "global", label: "Global", className: "atlas-region-tab--global", group: "UNDP regions" },
  { key: "RBA", label: "Africa", className: "atlas-region-tab--africa", group: "UNDP regions" },
  { key: "RBAP", label: "Asia Pacific", className: "atlas-region-tab--asia", group: "UNDP regions" },
  { key: "RBAS", label: "Arab States", className: "atlas-region-tab--arab-states", group: "UNDP regions" },
  { key: "RBEC", label: "Europe & CIS", className: "atlas-region-tab--europe-cis", group: "UNDP regions" },
  { key: "RBLAC", label: "Latin America", className: "atlas-region-tab--latin_america", group: "UNDP regions" }
];

export const sgpViewTabs: Array<{ key: DashboardView; label: string; caption: string }> = [
  { key: "profile", label: "Profile", caption: "SGP site content" },
  { key: "trends", label: "Time", caption: "Years and themes" },
  { key: "themes", label: "Themes", caption: "Focal mix" },
  { key: "finance", label: "Finance", caption: "Grants and partners" },
  { key: "networks", label: "Partners", caption: "Cofinancer graph" },
  { key: "table", label: "Records", caption: "Project rows" }
];
