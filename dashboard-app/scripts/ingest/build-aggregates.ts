import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAggregates } from "../../app/src/lib/aggregation/aggregateData";
import type { CofinancingRecord, ProjectRecord } from "../../app/src/lib/data/schema";

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
const cofinancing = readJson<CofinancingRecord[]>("cofinancing.normalized.json");
const aggregates = buildAggregates(projects, cofinancing);
writeAll("aggregates.json", aggregates);
console.log(`Built aggregates for ${projects.length} project records and ${cofinancing.length} cofinancing rows.`);
