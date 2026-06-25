import { z } from "zod";

export type RegionId = "RBA" | "RBAP" | "RBAS" | "RBEC" | "RBLAC" | string;
export type StatusGroup = "completed" | "active" | "pipeline" | "terminated" | "pending" | "other";
export type CountryMapStatus = "matched" | "alias" | "unmapped";

export const ProjectRecordSchema = z.object({
  rowId: z.string(),
  sourceRowNumber: z.number(),
  projectNumber: z.string(),
  projectNumberNormalized: z.string(),
  duplicateProjectNumber: z.boolean(),
  duplicateGroupSize: z.number(),
  operationalPhaseText: z.string().nullable(),
  operationalPhaseNumber: z.number().nullable(),
  operationalPhaseYear: z.number().nullable(),
  fullGrant: z.boolean(),
  projectCategory: z.string().nullable(),
  projectTitle: z.string(),
  regionId: z.string(),
  countryName: z.string(),
  countryNameNormalized: z.string(),
  countryIso3: z.string().nullable(),
  countryMapStatus: z.enum(["matched", "alias", "unmapped"]),
  institutionalType: z.string().nullable(),
  granteeName: z.string().nullable(),
  focalArea: z.string().nullable(),
  status: z.string(),
  statusGroup: z.enum(["completed", "active", "pipeline", "terminated", "pending", "other"]),
  startMonth: z.number().nullable(),
  startYear: z.number().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  nscApprovalDate: z.string().nullable(),
  moaSignedDate: z.string().nullable(),
  durationMonths: z.number().nullable(),
  fundingSource: z.string().nullable(),
  grantAmount: z.number(),
  cofinancingCash: z.number(),
  cofinancingKind: z.number(),
  cofinancingTotal: z.number(),
  totalInvestment: z.number(),
  cofinancingLeverage: z.number().nullable(),
  cashShareOfCofinancing: z.number().nullable(),
  inKindShareOfCofinancing: z.number().nullable(),
  cofinancingRowCount: z.number(),
  cofinancingPartnerCount: z.number(),
  hasDetailedCofinancing: z.boolean()
});

export const CofinancingRecordSchema = z.object({
  rowId: z.string(),
  sourceRowNumber: z.number(),
  projectNumber: z.string(),
  projectNumberNormalized: z.string(),
  linkedProjectRowIds: z.array(z.string()).optional(),
  operationalPhaseText: z.string().nullable().optional(),
  projectTitle: z.string().optional(),
  regionId: z.string(),
  grantAmountFromCofinancingFile: z.number().optional(),
  countryName: z.string(),
  countryIso3: z.string().nullable(),
  focalArea: z.string().nullable(),
  startMonth: z.number().nullable(),
  startYear: z.number().nullable(),
  companyTitle: z.string().nullable(),
  companyTitleNormalized: z.string().nullable(),
  companyType: z.string().nullable(),
  companyCountryId: z.string().nullable().optional(),
  companyCountryName: z.string().nullable(),
  companyCountryIso3: z.string().nullable(),
  amountCash: z.number(),
  amountKind: z.number(),
  amountTotal: z.number()
});

export type ProjectRecord = z.infer<typeof ProjectRecordSchema>;
export type CofinancingRecord = z.infer<typeof CofinancingRecordSchema>;

export type MetricKey =
  | "projectRecords"
  | "uniqueProjectNumbers"
  | "countries"
  | "grantAmount"
  | "cofinancingCash"
  | "cofinancingKind"
  | "cofinancingTotal"
  | "totalInvestment"
  | "cofinancingLeverage"
  | "averageGrant"
  | "medianGrant"
  | "activeProjects"
  | "completedProjects"
  | "terminatedProjects"
  | "cofinancingRows"
  | "cofinancingPartnerCount";

export type PortfolioMetrics = Record<MetricKey, number | null>;

export type AggregateRow = {
  key: string;
  label: string;
  projectRecords: number;
  uniqueProjectNumbers: number;
  countries: number;
  grantAmount: number;
  cofinancingCash: number;
  cofinancingKind: number;
  cofinancingTotal: number;
  totalInvestment: number;
  averageGrant: number | null;
  medianGrant: number | null;
  cofinancingLeverage: number | null;
  activeProjects: number;
  completedProjects: number;
  terminatedProjects: number;
  cofinancingRows?: number;
  cofinancingPartnerCount?: number;
  cashShareOfCofinancing?: number | null;
  inKindShareOfCofinancing?: number | null;
};

export type Aggregates = Record<string, AggregateRow[]>;

export type ValidationCheck = {
  label: string;
  expected: number;
  actual: number;
  passed: boolean;
  tolerance?: number;
};

export type ValidationReport = {
  generatedAt: string;
  sourceFiles: Record<string, string>;
  counts: Record<string, number>;
  totals: Record<string, number>;
  checks: ValidationCheck[];
  missingness: Record<string, Record<string, number>>;
  duplicateProjectNumberGroups: Array<{
    projectNumberNormalized: string;
    count: number;
    rowIds: string[];
    countries: string[];
    grantAmount: number;
    cofinancingTotal: number;
  }>;
  cofinancingMismatches: Array<{
    rowId: string;
    projectNumberNormalized: string;
    projectCash: number;
    projectKind: number;
    detailCash: number;
    detailKind: number;
    countryName: string;
    reason: string;
  }>;
  unmappedCountries: Array<{
    countryName: string;
    records: number;
    grantAmount: number;
    cofinancingTotal: number;
  }>;
  cofinancingProjectNumbersMissingFromProjects: string[];
  projectNumbersWithoutDetailedCofinancing: number;
  notes: string[];
};

export type CofinancingByProjectEntry = {
  projectNumberNormalized: string;
  rowCount: number;
  partnerCount: number;
  companyTypes: string[];
  companyTitles: string[];
  companyCountries: string[];
  amountCash: number;
  amountKind: number;
  amountTotal: number;
  rowIds: string[];
};

export type CofinancingByProject = Record<string, CofinancingByProjectEntry>;

export type ContentProfileLink = {
  title: string;
  url: string;
  kind?: string | null;
  summary?: string | null;
  imageUrl?: string | null;
};

export type ContentProfileMetric = {
  label: string;
  value: string;
};

export type ContentProfileCollection = {
  key: string;
  label: string;
  count: number;
  url?: string | null;
};

export type ContentProfileContact = {
  name?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type ContentProfile = {
  type: "country" | "area";
  key: string;
  aliases?: string[];
  title: string;
  sourceUrl?: string | null;
  summary?: string | null;
  metrics: ContentProfileMetric[];
  collections: ContentProfileCollection[];
  contacts?: ContentProfileContact[];
  publications: ContentProfileLink[];
  stories: ContentProfileLink[];
  caseStudies: ContentProfileLink[];
  voices: ContentProfileLink[];
  featured?: ContentProfileLink | null;
};

export type ContentProfiles = {
  generatedAt?: string;
  source?: string;
  countries: Record<string, ContentProfile>;
  areas: Record<string, ContentProfile>;
};

export type DataBundle = {
  projects: ProjectRecord[];
  cofinancing: CofinancingRecord[];
  cofinancingByProject: CofinancingByProject;
  aggregates: Aggregates;
  profiles: ContentProfiles;
};
