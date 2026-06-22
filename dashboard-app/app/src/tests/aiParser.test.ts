import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { planLocalQuery } from "../lib/ai/localQueryPlanner";
import { sgpRegionOptions } from "../lib/dashboard/config";
import { COUNTRY_GROUP_OPTIONS } from "../lib/data/countryGroups";
import type { Aggregates } from "../lib/data/schema";

const aggregates = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "public", "data", "aggregates.json"), "utf8")) as Aggregates;
const allowed = {
  countries: aggregates.byCountry.map((row) => ({ iso3: row.key, name: row.label })),
  regions: [...aggregates.byRegion.map((row) => row.key), ...COUNTRY_GROUP_OPTIONS.map((option) => option.key)],
  regionAliases: [...sgpRegionOptions, ...COUNTRY_GROUP_OPTIONS].map((option) => ({ key: option.key, labels: [option.label, option.key] })),
  focalAreas: aggregates.byFocalArea.map((row) => row.label),
  statuses: aggregates.byStatus.map((row) => row.label),
  fundingSources: aggregates.byFundingSource.map((row) => row.label),
  cofinancerTypes: aggregates.byCofinancerType.map((row) => row.label)
};

describe("local natural-language query planner", () => {
  it("parses active biodiversity projects in RBA after 2020", () => {
    const plan = planLocalQuery("active biodiversity projects in RBA after 2020", allowed);
    expect(plan.filterPatch.focalAreas).toContain("Biodiversity");
    expect(plan.filterPatch.regions).toContain("RBA");
    expect(plan.filterPatch.statusGroups).toEqual(["active", "pipeline"]);
    expect(plan.filterPatch.startYearRange).toEqual([2021, null]);
  });

  it("parses private sector cofinancing in India", () => {
    const plan = planLocalQuery("private sector cofinancing in India", allowed);
    expect(plan.filterPatch.countries).toContain("IND");
    expect(plan.filterPatch.cofinancerTypes).toContain("Private Sector");
  });

  it("parses terminated projects with grant above 100000", () => {
    const plan = planLocalQuery("terminated projects with grant above 100000", allowed);
    expect(plan.filterPatch.statusGroups).toEqual(["terminated"]);
    expect(plan.filterPatch.grantAmountRange).toEqual([100_000, null]);
  });

  it("parses virtual geography group labels", () => {
    const plan = planLocalQuery("show SIDS biodiversity projects", allowed);
    expect(plan.filterPatch.regions).toContain("group-sids");
    expect(plan.filterPatch.focalAreas).toContain("Biodiversity");
  });
});
