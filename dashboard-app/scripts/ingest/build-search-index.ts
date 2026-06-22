import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CofinancingByProject, ProjectRecord } from "../../app/src/lib/data/schema";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROCESSED_DIR = path.join(ROOT, "data", "processed");
const OUTPUTS_DIR = path.join(ROOT, "outputs", "data");
const PUBLIC_DATA_DIR = path.join(ROOT, "app", "public", "data");

function readJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(PROCESSED_DIR, name), "utf8")) as T;
}

function writeAll(name: string, value: unknown) {
  for (const dir of [PROCESSED_DIR, OUTPUTS_DIR, PUBLIC_DATA_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), `${JSON.stringify(value, null, 2)}\n`);
  }
}

const projects = readJson<ProjectRecord[]>("projects.normalized.json");
const cofinancingByProject = readJson<CofinancingByProject>("cofinancing.byProject.json");
const index = projects.map((project) => {
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

writeAll("search-index.json", index);
console.log(`Built search index with ${index.length} project documents.`);
