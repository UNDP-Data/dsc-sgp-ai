import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ValidationReport } from "../../app/src/lib/data/schema";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT_PATH = path.join(ROOT, "data", "processed", "validation-report.json");

if (!fs.existsSync(REPORT_PATH)) {
  throw new Error("Missing validation-report.json. Run npm run ingest first.");
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8")) as ValidationReport;
const failures = report.checks.filter((check) => !check.passed);

for (const check of report.checks) {
  console.log(`${check.passed ? "PASS" : "FAIL"} ${check.label}: expected ${check.expected}, actual ${check.actual}`);
}

if (failures.length) {
  throw new Error(`${failures.length} validation checks failed.`);
}

console.log("Data validation passed.");
