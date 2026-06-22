import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { buildAggregates } from "../../app/src/lib/aggregation/aggregateData";
import { round2 } from "../../app/src/lib/aggregation/metrics";
import {
  buildCountryLookup,
  matchCountry,
  normalizeCountryName,
  normalizeText
} from "../../app/src/lib/data/countryMapping";
import type {
  CofinancingByProject,
  CofinancingByProjectEntry,
  CofinancingRecord,
  ProjectRecord,
  ValidationCheck,
  ValidationReport
} from "../../app/src/lib/data/schema";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const GEO_DIR = path.join(ROOT, "data", "geo");
const PROCESSED_DIR = path.join(ROOT, "data", "processed");
const OUTPUTS_DIR = path.join(ROOT, "outputs", "data");
const PUBLIC_DATA_DIR = path.join(ROOT, "app", "public", "data");
const PUBLIC_GEO_DIR = path.join(ROOT, "app", "public", "geo");

const PROJECT_FILE = path.join(RAW_DIR, "sgp_projects.xls");
const COFINANCING_FILE = path.join(RAW_DIR, "sgp_cofinancing.xls");
const GEO_FILE = path.join(GEO_DIR, "world-countries.geojson");

const FINANCIAL_PROJECT_FIELDS = ["GRANTAMOUNT", "COFINANCINGAMOUNTCASH", "COFINANCINGAMOUNTKIND"];
const FINANCIAL_COFINANCING_FIELDS = ["GRANTAMOUNT", "AMOUNTCASH", "AMOUNTKIND"];

type RawRow = Record<string, unknown>;

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function readRows(file: string): RawRow[] {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing required source file: ${file}`);
  }
  const workbook = XLSX.readFile(file, { cellDates: false });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    throw new Error(`No worksheet found in ${file}`);
  }
  return XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheet], {
    defval: null,
    raw: true
  });
}

function writeJson(relativeName: string, value: unknown) {
  for (const dir of [PROCESSED_DIR, OUTPUTS_DIR, PUBLIC_DATA_DIR]) {
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, relativeName), `${JSON.stringify(value, null, 2)}\n`);
  }
}

function writeInternalJson(relativeName: string, value: unknown) {
  for (const dir of [PROCESSED_DIR, OUTPUTS_DIR]) {
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, relativeName), `${JSON.stringify(value, null, 2)}\n`);
  }
}

function writeDataDictionary(projectRows: RawRow[], cofinancingRows: RawRow[]) {
  const summarize = (rows: RawRow[]) => {
    const fields = Object.keys(rows[0] ?? {});
    return fields.map((field) => {
      const values = rows.map((row) => row[field]).filter((value) => value != null && normalizeText(value));
      const numeric = values.filter((value) => Number.isFinite(Number(value))).length;
      return {
        field,
        nonNull: values.length,
        missing: rows.length - values.length,
        inferredType: numeric > values.length * 0.9 ? "number" : "text",
        examples: [...new Set(values.slice(0, 5).map((value) => normalizeText(value)))]
      };
    });
  };
  writeJson("data-dictionary.json", {
    generatedAt: new Date().toISOString(),
    projects: summarize(projectRows),
    cofinancing: summarize(cofinancingRows)
  });
}

function nullableText(value: unknown) {
  const cleaned = normalizeText(value);
  return cleaned ? cleaned : null;
}

function requiredText(value: unknown, fallback = "Missing") {
  return nullableText(value) ?? fallback;
}

function parseNumber(value: unknown, fallback = 0) {
  if (value == null || value === "") {
    return fallback;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  const cleaned = String(value).replace(/[$,\s]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseInteger(value: unknown) {
  const parsed = parseNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function excelDateToIso(value: number) {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) return null;
  return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
}

function parseDate(value: unknown) {
  if (value == null || value === "") {
    return null;
  }
  if (value instanceof Date && Number.isFinite(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    return excelDateToIso(value);
  }
  const text = normalizeText(value);
  if (!text) return null;
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthsBetween(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) return null;
  const [startYear, startMonth] = startIso.split("-").map(Number);
  const [endYear, endMonth] = endIso.split("-").map(Number);
  if (![startYear, startMonth, endYear, endMonth].every(Number.isFinite)) return null;
  return (endYear - startYear) * 12 + (endMonth - startMonth);
}

function phaseInfo(value: unknown) {
  const text = nullableText(value);
  const phase = text?.match(/OP\s*(\d+)/i);
  const year = text?.match(/Y\s*(\d+)/i);
  return {
    text,
    number: phase ? Number(phase[1]) : null,
    year: year ? Number(year[1]) : null
  };
}

function statusGroup(value: string): ProjectRecord["statusGroup"] {
  const text = value.toLowerCase();
  if (text.includes("satisfactorily completed")) return "completed";
  if (text.includes("terminated")) return "terminated";
  if (text.includes("under execution")) return "active";
  if (text.includes("not active")) return "pipeline";
  if (text.includes("final report pending")) return "pending";
  return "other";
}

function share(part: number, total: number) {
  return total > 0 ? part / total : null;
}

function missingness(rows: RawRow[], fields: string[], financialFields: string[]) {
  const result: Record<string, number> = {};
  for (const field of fields) {
    result[field] = rows.filter((row) => {
      if (financialFields.includes(field)) {
        return row[field] == null || !Number.isFinite(parseNumber(row[field], Number.NaN));
      }
      return !nullableText(row[field]);
    }).length;
  }
  return result;
}

function makeCheck(label: string, actual: number, expected: number, tolerance = 0): ValidationCheck {
  const passed = Math.abs(actual - expected) <= tolerance;
  return { label, expected, actual, passed, tolerance };
}

function sumRows<T>(rows: T[], getter: (row: T) => number) {
  return round2(rows.reduce((total, row) => total + getter(row), 0));
}

function buildSearchIndex(projects: ProjectRecord[], cofinancingByProject: CofinancingByProject) {
  return projects.map((project) => {
    const detail = cofinancingByProject[project.projectNumberNormalized];
    return {
      id: project.rowId,
      projectNumber: project.projectNumber,
      title: project.projectTitle,
      countryName: project.countryName,
      countryIso3: project.countryIso3,
      regionId: project.regionId,
      focalArea: project.focalArea,
      status: project.status,
      statusGroup: project.statusGroup,
      startYear: project.startYear,
      fundingSource: project.fundingSource,
      granteeName: project.granteeName,
      cofinancerTypes: detail?.companyTypes ?? [],
      cofinancerNames: detail?.companyTitles ?? [],
      cofinancerCountries: detail?.companyCountries ?? [],
      text: [
        project.projectNumber,
        project.projectTitle,
        project.countryName,
        project.regionId,
        project.focalArea,
        project.status,
        project.fundingSource,
        project.granteeName,
        detail?.companyTypes.join(" "),
        detail?.companyTitles.join(" "),
        detail?.companyCountries.join(" ")
      ]
        .filter(Boolean)
        .join(" ")
    };
  });
}

function copyGeoIfNeeded() {
  ensureDir(PUBLIC_GEO_DIR);
  if (!fs.existsSync(GEO_FILE)) {
    throw new Error(`No local GeoJSON found at ${GEO_FILE}. Copy a world-countries.geojson into data/geo first.`);
  }
  fs.copyFileSync(GEO_FILE, path.join(PUBLIC_GEO_DIR, "world-countries.geojson"));
  const provenance = path.join(GEO_DIR, "authoritative-provenance.json");
  if (fs.existsSync(provenance)) {
    fs.copyFileSync(provenance, path.join(PUBLIC_GEO_DIR, "authoritative-provenance.json"));
  }
}

function main() {
  copyGeoIfNeeded();
  const projectRows = readRows(PROJECT_FILE);
  const cofinancingRowsRaw = readRows(COFINANCING_FILE);
  writeDataDictionary(projectRows, cofinancingRowsRaw);

  const geo = JSON.parse(fs.readFileSync(GEO_FILE, "utf8")) as GeoJSON.FeatureCollection;
  const { lookup, isoNames } = buildCountryLookup(geo.features);

  const projectKeyCounts = new Map<string, number>();
  for (const row of projectRows) {
    const key = normalizeText(row.PROJECTNUMBER);
    projectKeyCounts.set(key, (projectKeyCounts.get(key) ?? 0) + 1);
  }

  const projectRowsByNumber = new Map<string, string[]>();
  const projects: ProjectRecord[] = projectRows.map((row, index) => {
    const rowId = `p_${String(index + 1).padStart(6, "0")}`;
    const projectNumberNormalized = requiredText(row.PROJECTNUMBER);
    const duplicateGroupSize = projectKeyCounts.get(projectNumberNormalized) ?? 1;
    const countryName = requiredText(row.COUNTRYNAME);
    const countryMatch = matchCountry(countryName, lookup, isoNames);
    const phase = phaseInfo(row.OPERATIONALPHASETXT);
    const startDate = parseDate(row.STARTDATE);
    const endDate = parseDate(row.ENDDATE);
    const grantAmount = round2(parseNumber(row.GRANTAMOUNT));
    const cofinancingCash = round2(parseNumber(row.COFINANCINGAMOUNTCASH));
    const cofinancingKind = round2(parseNumber(row.COFINANCINGAMOUNTKIND));
    const cofinancingTotal = round2(cofinancingCash + cofinancingKind);
    const project: ProjectRecord = {
      rowId,
      sourceRowNumber: index + 2,
      projectNumber: projectNumberNormalized,
      projectNumberNormalized,
      duplicateProjectNumber: duplicateGroupSize > 1,
      duplicateGroupSize,
      operationalPhaseText: phase.text,
      operationalPhaseNumber: phase.number,
      operationalPhaseYear: phase.year,
      fullGrant: Boolean(parseNumber(row.FULLGRANT)),
      projectCategory: nullableText(row.PROJECTCATEGORYTXT),
      projectTitle: requiredText(row.PROJECTTITLE, "Untitled project"),
      regionId: requiredText(row.REGIONID),
      countryName,
      countryNameNormalized: normalizeCountryName(countryName),
      countryIso3: countryMatch.iso3,
      countryMapStatus: countryMatch.status,
      institutionalType: nullableText(row.INSTITUTIONALTYPETXT),
      granteeName: nullableText(row.COMPANYTITLE),
      focalArea: nullableText(row.FOCALAREA),
      status: requiredText(row.PROJECTSTATUSTXT),
      statusGroup: statusGroup(requiredText(row.PROJECTSTATUSTXT)),
      startMonth: parseInteger(row.STARTMONTH),
      startYear: parseInteger(row.STARTYEAR),
      startDate,
      endDate,
      nscApprovalDate: parseDate(row.NSCAPPROVALDATE),
      moaSignedDate: parseDate(row.MOASIGNEDDATE),
      durationMonths: monthsBetween(startDate, endDate),
      fundingSource: nullableText(row.FUNDINGSOURCE),
      grantAmount,
      cofinancingCash,
      cofinancingKind,
      cofinancingTotal,
      totalInvestment: round2(grantAmount + cofinancingTotal),
      cofinancingLeverage: grantAmount > 0 ? cofinancingTotal / grantAmount : null,
      cashShareOfCofinancing: share(cofinancingCash, cofinancingTotal),
      inKindShareOfCofinancing: share(cofinancingKind, cofinancingTotal),
      cofinancingRowCount: 0,
      cofinancingPartnerCount: 0,
      hasDetailedCofinancing: false
    };
    const ids = projectRowsByNumber.get(projectNumberNormalized) ?? [];
    ids.push(rowId);
    projectRowsByNumber.set(projectNumberNormalized, ids);
    return project;
  });

  const cofinancingRecords: CofinancingRecord[] = cofinancingRowsRaw.map((row, index) => {
    const projectNumberNormalized = requiredText(row.PROJECTNUMBER);
    const countryName = requiredText(row.COUNTRYNAME);
    const projectCountry = matchCountry(countryName, lookup, isoNames);
    const companyCountryName = nullableText(row.COMPANYCOUNTRYNAME);
    const companyCountry = companyCountryName
      ? matchCountry(companyCountryName, lookup, isoNames)
      : { iso3: nullableText(row.COMPANYCOUNTRYID), status: "matched" as const, canonicalName: "" };
    const cash = round2(parseNumber(row.AMOUNTCASH));
    const kind = round2(parseNumber(row.AMOUNTKIND));
    return {
      rowId: `c_${String(index + 1).padStart(6, "0")}`,
      sourceRowNumber: index + 2,
      projectNumber: projectNumberNormalized,
      projectNumberNormalized,
      regionId: requiredText(row.REGIONID),
      countryName,
      countryIso3: projectCountry.iso3,
      focalArea: nullableText(row.FOCALAREA),
      startMonth: parseInteger(row.STARTMONTH),
      startYear: parseInteger(row.STARTYEAR),
      companyTitle: nullableText(row.COMPANYTITLE),
      companyTitleNormalized: nullableText(row.COMPANYTITLE)?.toUpperCase() ?? null,
      companyType: nullableText(row.COMPANYTYPETXT),
      companyCountryName,
      companyCountryIso3: companyCountry.iso3,
      amountCash: cash,
      amountKind: kind,
      amountTotal: round2(cash + kind)
    };
  });

  const cofinancingByProject: CofinancingByProject = {};
  for (const row of cofinancingRecords) {
    const entry: CofinancingByProjectEntry =
      cofinancingByProject[row.projectNumberNormalized] ??
      {
        projectNumberNormalized: row.projectNumberNormalized,
        rowCount: 0,
        partnerCount: 0,
        companyTypes: [],
        companyTitles: [],
        companyCountries: [],
        amountCash: 0,
        amountKind: 0,
        amountTotal: 0,
        rowIds: []
      };
    entry.rowCount += 1;
    entry.amountCash = round2(entry.amountCash + row.amountCash);
    entry.amountKind = round2(entry.amountKind + row.amountKind);
    entry.amountTotal = round2(entry.amountCash + entry.amountKind);
    entry.rowIds.push(row.rowId);
    if (row.companyType && !entry.companyTypes.includes(row.companyType)) entry.companyTypes.push(row.companyType);
    if (row.companyTitleNormalized && !entry.companyTitles.includes(row.companyTitleNormalized)) entry.companyTitles.push(row.companyTitleNormalized);
    const country = row.companyCountryIso3 ?? row.companyCountryName;
    if (country && !entry.companyCountries.includes(country)) entry.companyCountries.push(country);
    entry.partnerCount = entry.companyTitles.length;
    cofinancingByProject[row.projectNumberNormalized] = entry;
  }

  const mismatchCases: ValidationReport["cofinancingMismatches"] = [];
  for (const project of projects) {
    const detail = cofinancingByProject[project.projectNumberNormalized];
    project.hasDetailedCofinancing = Boolean(detail);
    project.cofinancingRowCount = detail?.rowCount ?? 0;
    project.cofinancingPartnerCount = detail?.partnerCount ?? 0;
    const detailCash = detail?.amountCash ?? 0;
    const detailKind = detail?.amountKind ?? 0;
    if (round2(project.cofinancingCash) !== round2(detailCash) || round2(project.cofinancingKind) !== round2(detailKind)) {
      mismatchCases.push({
        rowId: project.rowId,
        projectNumberNormalized: project.projectNumberNormalized,
        projectCash: project.cofinancingCash,
        projectKind: project.cofinancingKind,
        detailCash,
        detailKind,
        countryName: project.countryName,
        reason: project.duplicateProjectNumber
          ? "Duplicate PROJECTNUMBER; detail rows aggregate to the project number rather than an individual source row."
          : "Project row and detailed cofinancing rows differ for this PROJECTNUMBER."
      });
    }
  }

  const cofinancingProjectNumbers = new Set(cofinancingRecords.map((row) => row.projectNumberNormalized));
  const projectNumbers = new Set(projects.map((project) => project.projectNumberNormalized));
  const missingProjectNumbers = [...cofinancingProjectNumbers].filter((key) => !projectNumbers.has(key)).sort();
  const noDetailProjectNumbers = [...projectNumbers].filter((key) => !cofinancingProjectNumbers.has(key)).length;

  const duplicateGroups = [...projectKeyCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([projectNumberNormalized, count]) => {
      const rows = projects.filter((project) => project.projectNumberNormalized === projectNumberNormalized);
      return {
        projectNumberNormalized,
        count,
        rowIds: rows.map((project) => project.rowId),
        countries: [...new Set(rows.map((project) => project.countryName))],
        grantAmount: sumRows(rows, (project) => project.grantAmount),
        cofinancingTotal: sumRows(rows, (project) => project.cofinancingTotal)
      };
    })
    .sort((a, b) => b.count - a.count || a.projectNumberNormalized.localeCompare(b.projectNumberNormalized));

  const unmappedCountries = [...new Set(projects.filter((project) => !project.countryIso3).map((project) => project.countryName))]
    .map((countryName) => {
      const rows = projects.filter((project) => project.countryName === countryName);
      return {
        countryName,
        records: rows.length,
        grantAmount: sumRows(rows, (project) => project.grantAmount),
        cofinancingTotal: sumRows(rows, (project) => project.cofinancingTotal)
      };
    })
    .sort((a, b) => b.records - a.records);

  const checks = [
    makeCheck("Project records", projects.length, 30_753),
    makeCheck("Unique project numbers", projectNumbers.size, 30_696),
    makeCheck("Cofinancing rows", cofinancingRecords.length, 56_808),
    makeCheck("Unique cofinancing project numbers", cofinancingProjectNumbers.size, 29_240),
    makeCheck("Duplicate PROJECTNUMBER groups", duplicateGroups.length, 50),
    makeCheck("Project numbers without detailed cofinancing", noDetailProjectNumbers, 1_456),
    makeCheck("Cofinancing project numbers missing from projects", missingProjectNumbers.length, 0),
    makeCheck("Row-level cofinancing mismatch cases", mismatchCases.length, 60),
    makeCheck("Project grant total", sumRows(projects, (project) => project.grantAmount), 872_211_519.02, 0.01),
    makeCheck("Project cash cofinancing total", sumRows(projects, (project) => project.cofinancingCash), 440_797_301.77, 0.01),
    makeCheck("Project in-kind cofinancing total", sumRows(projects, (project) => project.cofinancingKind), 579_775_852.78, 0.01),
    makeCheck("Detail cash cofinancing total", sumRows(cofinancingRecords, (row) => row.amountCash), 440_797_301.77, 0.01),
    makeCheck("Detail in-kind cofinancing total", sumRows(cofinancingRecords, (row) => row.amountKind), 579_775_852.78, 0.01)
  ];

  const report: ValidationReport = {
    generatedAt: new Date().toISOString(),
    sourceFiles: {
      projects: path.relative(ROOT, PROJECT_FILE),
      cofinancing: path.relative(ROOT, COFINANCING_FILE),
      geojson: path.relative(ROOT, GEO_FILE)
    },
    counts: {
      projectRecords: projects.length,
      uniqueProjectNumbers: projectNumbers.size,
      cofinancingRows: cofinancingRecords.length,
      uniqueCofinancingProjectNumbers: cofinancingProjectNumbers.size,
      countries: new Set(projects.map((project) => project.countryName)).size,
      mappedCountries: new Set(projects.map((project) => project.countryIso3).filter(Boolean)).size
    },
    totals: {
      grantAmount: sumRows(projects, (project) => project.grantAmount),
      cofinancingCash: sumRows(projects, (project) => project.cofinancingCash),
      cofinancingKind: sumRows(projects, (project) => project.cofinancingKind),
      cofinancingTotal: sumRows(projects, (project) => project.cofinancingTotal),
      totalInvestment: sumRows(projects, (project) => project.totalInvestment),
      detailCash: sumRows(cofinancingRecords, (row) => row.amountCash),
      detailKind: sumRows(cofinancingRecords, (row) => row.amountKind)
    },
    checks,
    missingness: {
      projects: missingness(projectRows, Object.keys(projectRows[0] ?? {}), FINANCIAL_PROJECT_FIELDS),
      cofinancing: missingness(cofinancingRowsRaw, Object.keys(cofinancingRowsRaw[0] ?? {}), FINANCIAL_COFINANCING_FIELDS)
    },
    duplicateProjectNumberGroups: duplicateGroups,
    cofinancingMismatches: mismatchCases,
    unmappedCountries,
    cofinancingProjectNumbersMissingFromProjects: missingProjectNumbers,
    projectNumbersWithoutDetailedCofinancing: noDetailProjectNumbers,
    notes: [
      "Project table is authoritative for project counts, grant totals, and project-level cofinancing totals.",
      "Cofinancing detail table is authoritative for partner, cofinancer type, and cofinancer geography analytics.",
      "Row-level mismatch cases compare each project source row to detailed rows aggregated by normalized PROJECTNUMBER."
    ]
  };

  const aggregates = buildAggregates(projects, cofinancingRecords);
  const searchIndex = buildSearchIndex(projects, cofinancingByProject);
  const countryAliases = {
    generatedAt: new Date().toISOString(),
    aliases: Object.fromEntries([...lookup.entries()].sort())
  };

  writeJson("projects.normalized.json", projects);
  writeJson("cofinancing.normalized.json", cofinancingRecords);
  writeJson("cofinancing.byProject.json", cofinancingByProject);
  writeJson("aggregates.json", aggregates);
  writeInternalJson("validation-report.json", report);
  writeJson("search-index.json", searchIndex);
  writeJson("country-aliases.json", countryAliases);

  console.log("SGP ingestion complete.");
  for (const check of checks) {
    console.log(`${check.passed ? "PASS" : "FAIL"} ${check.label}: ${check.actual}`);
  }
}

main();
