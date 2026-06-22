import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeProjectMetrics, round2 } from "../lib/aggregation/metrics";
import type { CofinancingRecord, ProjectRecord, ValidationReport } from "../lib/data/schema";

const dataDir = path.resolve(process.cwd(), "public", "data");
const processedDataDir = path.resolve(process.cwd(), "..", "data", "processed");
const projects = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.normalized.json"), "utf8")) as ProjectRecord[];
const cofinancing = JSON.parse(fs.readFileSync(path.join(dataDir, "cofinancing.normalized.json"), "utf8")) as CofinancingRecord[];
const report = JSON.parse(fs.readFileSync(path.join(processedDataDir, "validation-report.json"), "utf8")) as ValidationReport;

describe("ingested SGP data", () => {
  it("preserves required source row counts and totals", () => {
    expect(projects).toHaveLength(30_753);
    expect(new Set(projects.map((project) => project.projectNumberNormalized)).size).toBe(30_696);
    expect(cofinancing).toHaveLength(56_808);
    expect(new Set(cofinancing.map((row) => row.projectNumberNormalized)).size).toBe(29_240);

    const metrics = computeProjectMetrics(projects, cofinancing);
    expect(round2(metrics.grantAmount ?? 0)).toBe(872_211_519.02);
    expect(round2(metrics.cofinancingCash ?? 0)).toBe(440_797_301.77);
    expect(round2(metrics.cofinancingKind ?? 0)).toBe(579_775_852.78);
  });

  it("reports duplicate project numbers, no-detail projects, and row mismatches", () => {
    expect(report.duplicateProjectNumberGroups).toHaveLength(50);
    expect(report.projectNumbersWithoutDetailedCofinancing).toBe(1_456);
    expect(report.cofinancingMismatches).toHaveLength(60);
    expect(report.cofinancingProjectNumbersMissingFromProjects).toHaveLength(0);
  });

  it("maps the top project countries to ISO3 codes", () => {
    const topCountries = [...new Map(projects.map((project) => [project.countryName, 0]))].map(([country]) => ({
      country,
      count: projects.filter((project) => project.countryName === country).length
    })).sort((a, b) => b.count - a.count).slice(0, 30);

    for (const row of topCountries) {
      const sample = projects.find((project) => project.countryName === row.country);
      expect(sample?.countryIso3, row.country).toMatch(/^[A-Z]{3}$/);
    }
  });
});
