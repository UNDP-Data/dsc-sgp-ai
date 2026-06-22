import type { Aggregates, CofinancingRecord, ProjectRecord } from "../data/schema";
import { aggregateCofinancing, aggregateProjectDimensions, aggregateProjects } from "./metrics";

function crosstabProjects(
  projects: ProjectRecord[],
  first: (project: ProjectRecord) => string | null | undefined,
  second: (project: ProjectRecord) => string | null | undefined,
  cofinancingRows: CofinancingRecord[]
) {
  return aggregateProjects(
    projects,
    (project) => `${first(project) || "Missing"}||${second(project) || "Missing"}`,
    (key) => key.replace("||", " / "),
    cofinancingRows
  );
}

function crosstabCofinancing(
  rows: CofinancingRecord[],
  first: (row: CofinancingRecord) => string | null | undefined,
  second: (row: CofinancingRecord) => string | null | undefined
) {
  return aggregateCofinancing(
    rows,
    (row) => `${first(row) || "Missing"}||${second(row) || "Missing"}`,
    (key) => key.replace("||", " / ")
  );
}

export function buildAggregates(
  projects: ProjectRecord[],
  cofinancingRows: CofinancingRecord[],
  options: { includeCrosstabs?: boolean } = {}
): Aggregates {
  const projectDimensions = aggregateProjectDimensions(
    projects,
    [
      { name: "byCountry", keyGetter: (project) => project.countryIso3 ?? project.countryName, labelGetter: (_, project) => project.countryName },
      { name: "byRegion", keyGetter: (project) => project.regionId },
      { name: "byFocalArea", keyGetter: (project) => project.focalArea || "Missing" },
      { name: "byYear", keyGetter: (project) => project.startYear?.toString() ?? "Missing" },
      { name: "byOperationalPhase", keyGetter: (project) => project.operationalPhaseText || "Missing" },
      { name: "byStatus", keyGetter: (project) => project.status },
      { name: "byFundingSource", keyGetter: (project) => project.fundingSource || "Missing" },
      { name: "byInstitutionalType", keyGetter: (project) => project.institutionalType || "Missing" },
      { name: "byProjectCategory", keyGetter: (project) => project.projectCategory || "Missing" },
      { name: "byFullGrant", keyGetter: (project) => (project.fullGrant ? "Full grant" : "Planning grant") }
    ],
    cofinancingRows
  );

  const base: Aggregates = {
    byCountry: projectDimensions.byCountry,
    byRegion: projectDimensions.byRegion,
    byFocalArea: projectDimensions.byFocalArea,
    byYear: projectDimensions.byYear,
    byOperationalPhase: projectDimensions.byOperationalPhase,
    byStatus: projectDimensions.byStatus,
    byFundingSource: projectDimensions.byFundingSource,
    byInstitutionalType: projectDimensions.byInstitutionalType,
    byProjectCategory: projectDimensions.byProjectCategory,
    byFullGrant: projectDimensions.byFullGrant,
    byCofinancerType: aggregateCofinancing(cofinancingRows, (row) => row.companyType || "Missing"),
    byCofinancerCountry: aggregateCofinancing(cofinancingRows, (row) => row.companyCountryIso3 ?? row.companyCountryName ?? "Missing", (_, row) => row.companyCountryName || row.companyCountryIso3 || "Missing")
  };

  if (options.includeCrosstabs === false) {
    return base;
  }

  return {
    ...base,
    countryByFocalArea: crosstabProjects(projects, (project) => project.countryIso3 ?? project.countryName, (project) => project.focalArea || "Missing", cofinancingRows),
    countryByYear: crosstabProjects(projects, (project) => project.countryIso3 ?? project.countryName, (project) => project.startYear?.toString() ?? "Missing", cofinancingRows),
    countryByStatus: crosstabProjects(projects, (project) => project.countryIso3 ?? project.countryName, (project) => project.status, cofinancingRows),
    regionByFocalArea: crosstabProjects(projects, (project) => project.regionId, (project) => project.focalArea || "Missing", cofinancingRows),
    regionByYear: crosstabProjects(projects, (project) => project.regionId, (project) => project.startYear?.toString() ?? "Missing", cofinancingRows),
    focalAreaByYear: crosstabProjects(projects, (project) => project.focalArea || "Missing", (project) => project.startYear?.toString() ?? "Missing", cofinancingRows),
    focalAreaByStatus: crosstabProjects(projects, (project) => project.focalArea || "Missing", (project) => project.status, cofinancingRows),
    fundingSourceByYear: crosstabProjects(projects, (project) => project.fundingSource || "Missing", (project) => project.startYear?.toString() ?? "Missing", cofinancingRows),
    cofinancerTypeByFocalArea: crosstabCofinancing(cofinancingRows, (row) => row.companyType || "Missing", (row) => row.focalArea || "Missing"),
    cofinancerTypeByRegion: crosstabCofinancing(cofinancingRows, (row) => row.companyType || "Missing", (row) => row.regionId),
    cofinancerCountryByProjectCountry: crosstabCofinancing(cofinancingRows, (row) => row.companyCountryIso3 ?? row.companyCountryName ?? "Missing", (row) => row.countryIso3 ?? row.countryName)
  };
}

export function buildRuntimeAggregates(
  projects: ProjectRecord[],
  cofinancingRows: CofinancingRecord[]
): Aggregates {
  const projectDimensions = aggregateProjectDimensions(
    projects,
    [
      { name: "byCountry", keyGetter: (project) => project.countryIso3 ?? project.countryName, labelGetter: (_, project) => project.countryName },
      { name: "byFocalArea", keyGetter: (project) => project.focalArea || "Missing" }
    ],
    cofinancingRows,
    { includeMedianGrant: false }
  );

  return {
    byCountry: projectDimensions.byCountry,
    byFocalArea: projectDimensions.byFocalArea,
    byCofinancerType: aggregateCofinancing(cofinancingRows, (row) => row.companyType || "Missing"),
    byCofinancerCountry: aggregateCofinancing(
      cofinancingRows,
      (row) => row.companyCountryIso3 ?? row.companyCountryName ?? "Missing",
      (_, row) => row.companyCountryName || row.companyCountryIso3 || "Missing"
    )
  };
}
