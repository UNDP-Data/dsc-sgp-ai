import { describe, expect, it } from "vitest";
import { formatMetric, formatMoney, formatNumber } from "../lib/viz/formatters";

describe("dashboard formatters", () => {
  it("uses compact suffixes for large numbers and money values", () => {
    expect(formatNumber(950)).toBe("950");
    expect(formatNumber(9_001)).toBe("9K");
    expect(formatNumber(30_753)).toBe("30.8K");
    expect(formatMoney(524_571_921)).toBe("$524.6M");
    expect(formatMoney(1_892_784_674)).toBe("$1.9B");
  });

  it("routes metric formatting through compact display helpers", () => {
    expect(formatMetric(1_250_000, "money")).toBe("$1.3M");
    expect(formatMetric(12_300, "number")).toBe("12.3K");
    expect(formatMetric(0.98, "ratio")).toBe("0.98x");
  });
});
