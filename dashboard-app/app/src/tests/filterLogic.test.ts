import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeProjectMetrics } from "../lib/aggregation/metrics";
import { countryGroupContains } from "../lib/data/countryGroups";
import type { CofinancingRecord, ProjectRecord } from "../lib/data/schema";
import { applyFilters } from "../lib/filters/applyFilters";
import { DEFAULT_FILTERS } from "../lib/filters/filterTypes";

const dataDir = path.resolve(process.cwd(), "public", "data");
const projects = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.normalized.json"), "utf8")) as ProjectRecord[];
const cofinancing = JSON.parse(fs.readFileSync(path.join(dataDir, "cofinancing.normalized.json"), "utf8")) as CofinancingRecord[];

describe("dashboard filtering", () => {
  it("combines country, focal area, year, and grant filters", () => {
    const filtered = applyFilters(projects, cofinancing, {
      ...DEFAULT_FILTERS,
      countries: ["MEX"],
      focalAreas: ["Biodiversity"],
      startYearRange: [2015, 2020],
      grantAmountRange: [50_000, null]
    });
    expect(filtered.projects.length).toBeGreaterThan(0);
    expect(filtered.projects.every((project) => project.countryIso3 === "MEX")).toBe(true);
    expect(filtered.projects.every((project) => project.focalArea === "Biodiversity")).toBe(true);
    expect(filtered.projects.every((project) => (project.startYear ?? 0) >= 2015 && (project.startYear ?? 0) <= 2020)).toBe(true);
    expect(filtered.projects.every((project) => project.grantAmount >= 50_000)).toBe(true);
  });

  it("uses cofinancer filters without duplicating project metrics", () => {
    const filtered = applyFilters(projects, cofinancing, {
      ...DEFAULT_FILTERS,
      cofinancerTypes: ["Private Sector"],
      countries: ["IND"]
    });
    expect(filtered.projects.length).toBeGreaterThan(0);
    expect(filtered.cofinancing.every((row) => row.companyType === "Private Sector")).toBe(true);
    expect(new Set(filtered.projects.map((project) => project.rowId)).size).toBe(filtered.projects.length);
    const metrics = computeProjectMetrics(filtered.projects, filtered.cofinancing);
    expect(metrics.grantAmount).toBeLessThan(872_211_519.02);
  });

  it("filters virtual country groups from the region selector", () => {
    const filtered = applyFilters(projects, cofinancing, {
      ...DEFAULT_FILTERS,
      regions: ["group-sids"]
    });
    expect(filtered.projects.length).toBeGreaterThan(0);
    expect(filtered.projects.every((project) => countryGroupContains("group-sids", project.countryIso3))).toBe(true);
  });
});
