import type {
  AggregateRow,
  CofinancingRecord,
  MetricKey,
  PortfolioMetrics,
  ProjectRecord
} from "../data/schema";

export const MONEY_METRICS: MetricKey[] = [
  "grantAmount",
  "cofinancingCash",
  "cofinancingKind",
  "cofinancingTotal",
  "totalInvestment"
];

export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sum<T>(items: T[], getter: (item: T) => number | null | undefined) {
  return items.reduce((total, item) => total + (Number(getter(item)) || 0), 0);
}

export function median(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) {
    return null;
  }
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function computeProjectMetrics(
  projects: ProjectRecord[],
  cofinancingRows: CofinancingRecord[] = [],
  options: { includeMedianGrant?: boolean } = {}
): PortfolioMetrics {
  const includeMedianGrant = options.includeMedianGrant ?? true;
  const projectNumbers = new Set<string>();
  const countries = new Set<string>();
  const grantValues: number[] | null = includeMedianGrant ? [] : null;
  let grantAmount = 0;
  let cofinancingCash = 0;
  let cofinancingKind = 0;
  let activeProjects = 0;
  let completedProjects = 0;
  let terminatedProjects = 0;

  for (const project of projects) {
    projectNumbers.add(project.projectNumberNormalized);
    const country = project.countryIso3 ?? project.countryName;
    if (country) countries.add(country);
    const grant = Number(project.grantAmount) || 0;
    grantValues?.push(grant);
    grantAmount += grant;
    cofinancingCash += Number(project.cofinancingCash) || 0;
    cofinancingKind += Number(project.cofinancingKind) || 0;
    if (project.statusGroup === "active" || project.statusGroup === "pipeline") activeProjects += 1;
    if (project.statusGroup === "completed") completedProjects += 1;
    if (project.statusGroup === "terminated") terminatedProjects += 1;
  }

  const cofinancingTotal = cofinancingCash + cofinancingKind;
  const totalInvestment = grantAmount + cofinancingTotal;
  const uniquePartners = new Set<string>();
  for (const row of cofinancingRows) {
    const partner = row.companyTitleNormalized || row.companyTitle || "";
    if (partner) uniquePartners.add(partner);
  }

  return {
    projectRecords: projects.length,
    uniqueProjectNumbers: projectNumbers.size,
    countries: countries.size,
    grantAmount: round2(grantAmount),
    cofinancingCash: round2(cofinancingCash),
    cofinancingKind: round2(cofinancingKind),
    cofinancingTotal: round2(cofinancingTotal),
    totalInvestment: round2(totalInvestment),
    cofinancingLeverage: grantAmount > 0 ? cofinancingTotal / grantAmount : null,
    averageGrant: projects.length ? grantAmount / projects.length : null,
    medianGrant: grantValues ? median(grantValues) : null,
    activeProjects,
    completedProjects,
    terminatedProjects,
    cofinancingRows: cofinancingRows.length,
    cofinancingPartnerCount: uniquePartners.size
  };
}

type ProjectAggregateAccumulator = {
  key: string;
  label: string;
  projectRecords: number;
  projectNumbers: Set<string>;
  countries: Set<string>;
  grantAmount: number;
  cofinancingCash: number;
  cofinancingKind: number;
  grantValues: number[] | null;
  activeProjects: number;
  completedProjects: number;
  terminatedProjects: number;
  cofinancingRows: number;
  partners: Set<string>;
};

function emptyProjectAccumulator(key: string, label: string, includeMedianGrant = true): ProjectAggregateAccumulator {
  return {
    key,
    label,
    projectRecords: 0,
    projectNumbers: new Set<string>(),
    countries: new Set<string>(),
    grantAmount: 0,
    cofinancingCash: 0,
    cofinancingKind: 0,
    grantValues: includeMedianGrant ? [] : null,
    activeProjects: 0,
    completedProjects: 0,
    terminatedProjects: 0,
    cofinancingRows: 0,
    partners: new Set<string>()
  };
}

function accumulatorToAggregate(accumulator: ProjectAggregateAccumulator): AggregateRow {
  const cofinancingTotal = accumulator.cofinancingCash + accumulator.cofinancingKind;
  const totalInvestment = accumulator.grantAmount + cofinancingTotal;
  return {
    key: accumulator.key,
    label: accumulator.label,
    projectRecords: accumulator.projectRecords,
    uniqueProjectNumbers: accumulator.projectNumbers.size,
    countries: accumulator.countries.size,
    grantAmount: round2(accumulator.grantAmount),
    cofinancingCash: round2(accumulator.cofinancingCash),
    cofinancingKind: round2(accumulator.cofinancingKind),
    cofinancingTotal: round2(cofinancingTotal),
    totalInvestment: round2(totalInvestment),
    averageGrant: accumulator.projectRecords ? accumulator.grantAmount / accumulator.projectRecords : null,
    medianGrant: accumulator.grantValues ? median(accumulator.grantValues) : null,
    cofinancingLeverage: accumulator.grantAmount > 0 ? cofinancingTotal / accumulator.grantAmount : null,
    activeProjects: accumulator.activeProjects,
    completedProjects: accumulator.completedProjects,
    terminatedProjects: accumulator.terminatedProjects,
    cofinancingRows: accumulator.cofinancingRows,
    cofinancingPartnerCount: accumulator.partners.size,
    cashShareOfCofinancing: cofinancingTotal > 0 ? accumulator.cofinancingCash / cofinancingTotal : null,
    inKindShareOfCofinancing: cofinancingTotal > 0 ? accumulator.cofinancingKind / cofinancingTotal : null
  };
}

function addProjectToAccumulator(accumulator: ProjectAggregateAccumulator, project: ProjectRecord) {
  accumulator.projectRecords += 1;
  accumulator.projectNumbers.add(project.projectNumberNormalized);
  const country = project.countryIso3 ?? project.countryName;
  if (country) accumulator.countries.add(country);
  const grant = Number(project.grantAmount) || 0;
  accumulator.grantValues?.push(grant);
  accumulator.grantAmount += grant;
  accumulator.cofinancingCash += Number(project.cofinancingCash) || 0;
  accumulator.cofinancingKind += Number(project.cofinancingKind) || 0;
  if (project.statusGroup === "active" || project.statusGroup === "pipeline") accumulator.activeProjects += 1;
  if (project.statusGroup === "completed") accumulator.completedProjects += 1;
  if (project.statusGroup === "terminated") accumulator.terminatedProjects += 1;
}

export type ProjectAggregateSpec = {
  name: string;
  keyGetter: (project: ProjectRecord) => string | null | undefined;
  labelGetter?: (key: string, project: ProjectRecord) => string;
};

export function aggregateProjectDimensions(
  projects: ProjectRecord[],
  specs: ProjectAggregateSpec[],
  cofinancingRows: CofinancingRecord[] = [],
  options: { includeMedianGrant?: boolean } = {}
): Record<string, AggregateRow[]> {
  const includeMedianGrant = options.includeMedianGrant ?? true;
  const groupMaps = specs.map(() => new Map<string, ProjectAggregateAccumulator>());
  const projectNumberToAccumulators = new Map<string, Set<ProjectAggregateAccumulator>>();

  for (const project of projects) {
    let projectAccumulators = projectNumberToAccumulators.get(project.projectNumberNormalized);
    if (!projectAccumulators) {
      projectAccumulators = new Set<ProjectAggregateAccumulator>();
      projectNumberToAccumulators.set(project.projectNumberNormalized, projectAccumulators);
    }

    specs.forEach((spec, index) => {
      const key = spec.keyGetter(project) || "Missing";
      const groups = groupMaps[index];
      let accumulator = groups.get(key);
      if (!accumulator) {
        accumulator = emptyProjectAccumulator(key, spec.labelGetter?.(key, project) ?? key, includeMedianGrant);
        groups.set(key, accumulator);
      }
      addProjectToAccumulator(accumulator, project);
      projectAccumulators.add(accumulator);
    });
  }

  for (const row of cofinancingRows) {
    const accumulators = projectNumberToAccumulators.get(row.projectNumberNormalized);
    if (!accumulators) continue;
    const partner = row.companyTitleNormalized || row.companyTitle || "";
    for (const accumulator of accumulators) {
      accumulator.cofinancingRows += 1;
      if (partner) accumulator.partners.add(partner);
    }
  }

  return Object.fromEntries(
    specs.map((spec, index) => [
      spec.name,
      [...groupMaps[index].values()]
        .map(accumulatorToAggregate)
        .sort((a, b) => b.totalInvestment - a.totalInvestment || b.projectRecords - a.projectRecords)
    ])
  );
}

export function aggregateProjects(
  projects: ProjectRecord[],
  keyGetter: (project: ProjectRecord) => string | null | undefined,
  labelGetter: (key: string, project: ProjectRecord) => string = (key) => key,
  cofinancingRows: CofinancingRecord[] = []
): AggregateRow[] {
  return aggregateProjectDimensions(projects, [{ name: "value", keyGetter, labelGetter }], cofinancingRows).value;
}

type CofinancingAggregateAccumulator = {
  key: string;
  label: string;
  projectNumbers: Set<string>;
  countries: Set<string>;
  partners: Set<string>;
  cash: number;
  kind: number;
  rows: number;
};

export function aggregateCofinancing(
  rows: CofinancingRecord[],
  keyGetter: (row: CofinancingRecord) => string | null | undefined,
  labelGetter: (key: string, row: CofinancingRecord) => string = (key) => key
): AggregateRow[] {
  const groups = new Map<string, CofinancingAggregateAccumulator>();
  for (const row of rows) {
    const key = keyGetter(row) || "Missing";
    let accumulator = groups.get(key);
    if (!accumulator) {
      accumulator = {
        key,
        label: labelGetter(key, row),
        projectNumbers: new Set<string>(),
        countries: new Set<string>(),
        partners: new Set<string>(),
        cash: 0,
        kind: 0,
        rows: 0
      };
      groups.set(key, accumulator);
    }
    accumulator.rows += 1;
    accumulator.projectNumbers.add(row.projectNumberNormalized);
    const country = row.countryIso3 ?? row.countryName;
    if (country) accumulator.countries.add(country);
    const partner = row.companyTitleNormalized || row.companyTitle || "";
    if (partner) accumulator.partners.add(partner);
    accumulator.cash += Number(row.amountCash) || 0;
    accumulator.kind += Number(row.amountKind) || 0;
  }

  return [...groups.values()]
    .map((accumulator) => {
      const cash = round2(accumulator.cash);
      const kind = round2(accumulator.kind);
      const total = round2(cash + kind);
      return {
        key: accumulator.key,
        label: accumulator.label,
        projectRecords: accumulator.projectNumbers.size,
        uniqueProjectNumbers: accumulator.projectNumbers.size,
        countries: accumulator.countries.size,
        grantAmount: 0,
        cofinancingCash: cash,
        cofinancingKind: kind,
        cofinancingTotal: total,
        totalInvestment: total,
        averageGrant: null,
        medianGrant: null,
        cofinancingLeverage: null,
        activeProjects: 0,
        completedProjects: 0,
        terminatedProjects: 0,
        cofinancingRows: accumulator.rows,
        cofinancingPartnerCount: accumulator.partners.size,
        cashShareOfCofinancing: total > 0 ? cash / total : null,
        inKindShareOfCofinancing: total > 0 ? kind / total : null
      };
    })
    .sort((a, b) => b.cofinancingTotal - a.cofinancingTotal || b.cofinancingRows! - a.cofinancingRows!);
}

export function metricValue(row: AggregateRow | PortfolioMetrics, metric: MetricKey) {
  return Number(row[metric] ?? 0);
}
