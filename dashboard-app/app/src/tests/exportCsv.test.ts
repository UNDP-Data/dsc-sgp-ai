import { describe, expect, it } from "vitest";
import { toCsv } from "../lib/download/exportCsv";

describe("CSV export", () => {
  it("serializes filtered rows with headers", () => {
    const csv = toCsv([
      { rowId: "p_000001", countryName: "BENIN", grantAmount: 50000 },
      { rowId: "p_000002", countryName: "MEXICO", grantAmount: 75000 }
    ]);
    expect(csv).toContain("rowId,countryName,grantAmount");
    expect(csv.split("\n")).toHaveLength(3);
  });
});
