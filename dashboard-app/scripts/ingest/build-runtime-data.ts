import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CofinancingRecord, ProjectRecord } from "../../app/src/lib/data/schema";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PUBLIC_DATA_DIR = path.join(ROOT, "app", "public", "data");
const PROCESSED_DIR = path.join(ROOT, "data", "processed");
const OUTPUTS_DIR = path.join(ROOT, "outputs", "data");
const PUBLIC_DEPLOY_PRUNE = [
  "projects.normalized.json",
  "cofinancing.normalized.json",
  "cofinancing.byProject.json",
  "aggregates.json",
  "search-index.json"
];

const PROJECT_RUNTIME_FIELDS = [
  "rowId",
  "projectNumber",
  "projectNumberNormalized",
  "operationalPhaseText",
  "fullGrant",
  "projectCategory",
  "projectTitle",
  "regionId",
  "countryName",
  "countryIso3",
  "institutionalType",
  "granteeName",
  "focalArea",
  "status",
  "statusGroup",
  "startYear",
  "fundingSource",
  "grantAmount",
  "cofinancingCash",
  "cofinancingKind",
  "cofinancingTotal",
  "totalInvestment",
  "cofinancingLeverage"
] satisfies Array<keyof ProjectRecord>;

const COFINANCING_RUNTIME_FIELDS = [
  "rowId",
  "projectNumber",
  "projectNumberNormalized",
  "regionId",
  "countryName",
  "countryIso3",
  "focalArea",
  "startYear",
  "companyTitle",
  "companyTitleNormalized",
  "companyType",
  "companyCountryName",
  "companyCountryIso3",
  "amountCash",
  "amountKind",
  "amountTotal"
] satisfies Array<keyof CofinancingRecord>;

type RuntimeTable<T> = {
  fields: Array<keyof T>;
  rows: unknown[][];
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function runtimeTable<T extends Record<string, unknown>>(rows: T[], fields: Array<keyof T>): RuntimeTable<T> {
  return {
    fields,
    rows: rows.map((row) => fields.map((field) => row[field as string] ?? null))
  };
}

function writeRuntimeJson(relativeName: string, value: unknown) {
  for (const dir of [PROCESSED_DIR, OUTPUTS_DIR, PUBLIC_DATA_DIR]) {
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, relativeName), `${JSON.stringify(value)}\n`);
  }
}

function prunePublicDeployData() {
  for (const fileName of PUBLIC_DEPLOY_PRUNE) {
    const filePath = path.join(PUBLIC_DATA_DIR, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

function main() {
  const projects = readJson<ProjectRecord[]>(path.join(PROCESSED_DIR, "projects.normalized.json"));
  const cofinancing = readJson<CofinancingRecord[]>(path.join(PROCESSED_DIR, "cofinancing.normalized.json"));

  writeRuntimeJson("projects.runtime.json", runtimeTable(projects, PROJECT_RUNTIME_FIELDS));
  writeRuntimeJson("cofinancing.runtime.json", runtimeTable(cofinancing, COFINANCING_RUNTIME_FIELDS));
  prunePublicDeployData();

  const projectSize = fs.statSync(path.join(PUBLIC_DATA_DIR, "projects.runtime.json")).size;
  const cofinancingSize = fs.statSync(path.join(PUBLIC_DATA_DIR, "cofinancing.runtime.json")).size;
  console.log(`Wrote runtime data: projects ${(projectSize / 1024 / 1024).toFixed(1)} MB, cofinancing ${(cofinancingSize / 1024 / 1024).toFixed(1)} MB`);
}

main();
