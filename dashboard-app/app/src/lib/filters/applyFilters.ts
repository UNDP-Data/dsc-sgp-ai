import type { CofinancingRecord, ProjectRecord } from "../data/schema";
import { matchesRegionOrCountryGroup } from "../data/countryGroups";
import type { DashboardFilters, FilteredResult } from "./filterTypes";

function inRange(value: number | null | undefined, range: [number | null, number | null]) {
  if (value == null || !Number.isFinite(value)) {
    return range[0] == null && range[1] == null;
  }
  return (range[0] == null || value >= range[0]) && (range[1] == null || value <= range[1]);
}

function rangeIsOpen(range: [number | null, number | null]) {
  return range[0] == null && range[1] == null;
}

const projectSearchTextCache = new WeakMap<ProjectRecord, string>();
const allProjectNumberSetCache = new WeakMap<ProjectRecord[], Set<string>>();

function getProjectSearchText(project: ProjectRecord) {
  const cached = projectSearchTextCache.get(project);
  if (cached != null) return cached;
  const text = [
    project.projectNumber,
    project.projectTitle,
    project.countryName,
    project.regionId,
    project.focalArea,
    project.status,
    project.fundingSource,
    project.granteeName,
    project.institutionalType
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  projectSearchTextCache.set(project, text);
  return text;
}

function getAllProjectNumberSet(projects: ProjectRecord[]) {
  const cached = allProjectNumberSetCache.get(projects);
  if (cached) return cached;
  const projectNumbers = new Set<string>();
  for (const project of projects) {
    projectNumbers.add(project.projectNumberNormalized);
  }
  allProjectNumberSetCache.set(projects, projectNumbers);
  return projectNumbers;
}

export function warmProjectFilterCaches(projects: ProjectRecord[]) {
  getAllProjectNumberSet(projects);
  for (const project of projects) {
    getProjectSearchText(project);
  }
}

function textMatches(project: ProjectRecord, tokens: string[]) {
  if (!tokens.length) {
    return true;
  }
  const haystack = getProjectSearchText(project);
  return tokens.every((token) => haystack.includes(token));
}

export function applyFilters(
  projects: ProjectRecord[],
  cofinancingRows: CofinancingRecord[],
  filters: DashboardFilters
): FilteredResult {
  const hasProjectFilters =
    Boolean(filters.text.trim()) ||
    filters.countries.length > 0 ||
    filters.regions.length > 0 ||
    filters.focalAreas.length > 0 ||
    filters.statuses.length > 0 ||
    filters.statusGroups.length > 0 ||
    filters.operationalPhases.length > 0 ||
    filters.fundingSources.length > 0 ||
    filters.institutionalTypes.length > 0 ||
    filters.projectCategories.length > 0 ||
    filters.granteeNames.length > 0 ||
    filters.fullGrant != null ||
    !rangeIsOpen(filters.startYearRange) ||
    !rangeIsOpen(filters.grantAmountRange) ||
    !rangeIsOpen(filters.cofinancingTotalRange) ||
    !rangeIsOpen(filters.cofinancingLeverageRange);

  let matchingCofinancing = cofinancingRows;
  const hasCofinancerFilters =
    filters.cofinancerTypes.length > 0 || filters.cofinancerCountries.length > 0 || filters.cofinancerNames.length > 0;

  if (!hasProjectFilters && !hasCofinancerFilters) {
    return {
      projects,
      cofinancing: cofinancingRows,
      projectNumberSet: getAllProjectNumberSet(projects)
    };
  }

  const countrySet = new Set(filters.countries);
  const regionSet = new Set(filters.regions);
  const focalAreaSet = new Set(filters.focalAreas);
  const statusSet = new Set(filters.statuses);
  const statusGroupSet = new Set(filters.statusGroups);
  const operationalPhaseSet = new Set(filters.operationalPhases);
  const fundingSourceSet = new Set(filters.fundingSources);
  const institutionalTypeSet = new Set(filters.institutionalTypes);
  const projectCategorySet = new Set(filters.projectCategories);
  const granteeNameSet = new Set(filters.granteeNames);
  const cofinancerTypeSet = new Set(filters.cofinancerTypes);
  const cofinancerCountrySet = new Set(filters.cofinancerCountries);
  const cofinancerNameSet = new Set(filters.cofinancerNames);
  const textTokens = filters.text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hasTextFilter = textTokens.length > 0;
  const hasCountryFilter = countrySet.size > 0;
  const hasRegionFilter = regionSet.size > 0;
  const hasFocalAreaFilter = focalAreaSet.size > 0;
  const hasStatusFilter = statusSet.size > 0;
  const hasStatusGroupFilter = statusGroupSet.size > 0;
  const hasOperationalPhaseFilter = operationalPhaseSet.size > 0;
  const hasFundingSourceFilter = fundingSourceSet.size > 0;
  const hasInstitutionalTypeFilter = institutionalTypeSet.size > 0;
  const hasProjectCategoryFilter = projectCategorySet.size > 0;
  const hasGranteeNameFilter = granteeNameSet.size > 0;
  const hasStartYearRange = !rangeIsOpen(filters.startYearRange);
  const hasGrantAmountRange = !rangeIsOpen(filters.grantAmountRange);
  const hasCofinancingTotalRange = !rangeIsOpen(filters.cofinancingTotalRange);
  const hasCofinancingLeverageRange = !rangeIsOpen(filters.cofinancingLeverageRange);
  const hasCofinancerTypeFilter = cofinancerTypeSet.size > 0;
  const hasCofinancerCountryFilter = cofinancerCountrySet.size > 0;
  const hasCofinancerNameFilter = cofinancerNameSet.size > 0;
  let cofinancerProjectNumbers: Set<string> | null = null;

  if (hasCofinancerFilters) {
    const rows: CofinancingRecord[] = [];
    cofinancerProjectNumbers = new Set<string>();
    for (const row of cofinancingRows) {
      if (hasCofinancerTypeFilter && !cofinancerTypeSet.has(row.companyType || "Missing")) continue;
      if (hasCofinancerCountryFilter && !cofinancerCountrySet.has(row.companyCountryIso3 ?? row.companyCountryName ?? "Missing")) continue;
      if (hasCofinancerNameFilter && !cofinancerNameSet.has(row.companyTitleNormalized ?? row.companyTitle ?? "Missing")) continue;
      rows.push(row);
      cofinancerProjectNumbers.add(row.projectNumberNormalized);
    }
    matchingCofinancing = rows;
  }

  const filteredProjects: ProjectRecord[] = [];
  for (const project of projects) {
    if (cofinancerProjectNumbers && !cofinancerProjectNumbers.has(project.projectNumberNormalized)) continue;
    if (hasTextFilter && !textMatches(project, textTokens)) continue;
    if (hasCountryFilter && !countrySet.has(project.countryIso3 ?? project.countryName)) continue;
    if (hasRegionFilter && !matchesRegionOrCountryGroup(regionSet, project.regionId, project.countryIso3)) continue;
    if (hasFocalAreaFilter && !focalAreaSet.has(project.focalArea || "Missing")) continue;
    if (hasStatusFilter && !statusSet.has(project.status)) continue;
    if (hasStatusGroupFilter && !statusGroupSet.has(project.statusGroup)) continue;
    if (hasOperationalPhaseFilter && !operationalPhaseSet.has(project.operationalPhaseText || "Missing")) continue;
    if (hasFundingSourceFilter && !fundingSourceSet.has(project.fundingSource || "Missing")) continue;
    if (hasInstitutionalTypeFilter && !institutionalTypeSet.has(project.institutionalType || "Missing")) continue;
    if (hasProjectCategoryFilter && !projectCategorySet.has(project.projectCategory || "Missing")) continue;
    if (hasGranteeNameFilter && !granteeNameSet.has(project.granteeName || "Missing")) continue;
    if (filters.fullGrant != null && project.fullGrant !== filters.fullGrant) continue;
    if (hasStartYearRange && !inRange(project.startYear, filters.startYearRange)) continue;
    if (hasGrantAmountRange && !inRange(project.grantAmount, filters.grantAmountRange)) continue;
    if (hasCofinancingTotalRange && !inRange(project.cofinancingTotal, filters.cofinancingTotalRange)) continue;
    if (hasCofinancingLeverageRange && !inRange(project.cofinancingLeverage, filters.cofinancingLeverageRange)) continue;
    filteredProjects.push(project);
  }

  const projectNumberSet = new Set<string>();
  for (const project of filteredProjects) {
    projectNumberSet.add(project.projectNumberNormalized);
  }
  const filteredCofinancing = filteredProjects.length === projects.length && matchingCofinancing === cofinancingRows
    ? cofinancingRows
    : matchingCofinancing.filter((row) => projectNumberSet.has(row.projectNumberNormalized));

  return {
    projects: filteredProjects,
    cofinancing: filteredCofinancing,
    projectNumberSet
  };
}
