import type { AggregateRow, ProjectRecord } from "../data/schema";
import { formatMetric } from "../viz/formatters";

export type InsightCard = {
  title: string;
  metric: string;
  why: string;
  source: string;
};

export function generateInsights(
  byCountry: AggregateRow[],
  byFocalArea: AggregateRow[],
  projects: ProjectRecord[]
): InsightCard[] {
  const largestCountry = byCountry[0];
  const topFocal = byFocalArea[0];
  const terminatedShare = byFocalArea
    .map((row) => ({ row, share: row.projectRecords ? row.terminatedProjects / row.projectRecords : 0 }))
    .sort((a, b) => b.share - a.share)[0];
  const activeShare = projects.length
    ? projects.filter((project) => project.statusGroup === "active" || project.statusGroup === "pipeline").length / projects.length
    : 0;

  return [
    largestCountry && {
      title: "Largest country portfolio",
      metric: `${largestCountry.label}: ${formatMetric(largestCountry.projectRecords)} records`,
      why: "Country concentration helps identify where filters will most strongly change global totals.",
      source: "Filtered project records"
    },
    topFocal && {
      title: "Leading focal area",
      metric: `${topFocal.label}: ${formatMetric(topFocal.grantAmount, "money")}`,
      why: "This shows where grant resources are most concentrated.",
      source: "Filtered project records"
    },
    terminatedShare && {
      title: "Termination watch",
      metric: `${terminatedShare.row.label}: ${(terminatedShare.share * 100).toFixed(1)}% terminated`,
      why: "Termination share can reveal implementation risk patterns across focal areas.",
      source: "Filtered project records"
    },
    {
      title: "Active portfolio share",
      metric: `${(activeShare * 100).toFixed(1)}% active or pipeline`,
      why: "This separates currently moving work from completed project history in the selected view.",
      source: "Filtered project records"
    }
  ].filter(Boolean) as InsightCard[];
}
