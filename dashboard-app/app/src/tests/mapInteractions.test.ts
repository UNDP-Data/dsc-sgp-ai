import { describe, expect, it } from "vitest";
import { resolveMapCountryClickAction } from "../components/WorldChoropleth";

describe("map country click interactions", () => {
  it("selects a selectable country when no country focus is active", () => {
    expect(resolveMapCountryClickAction({
      iso3: "COD",
      selectable: true,
      selected: false,
      outsideFilter: false
    }, 0)).toEqual({ type: "toggle", iso3: "COD" });
  });

  it("toggles an already selected country off", () => {
    expect(resolveMapCountryClickAction({
      iso3: "COD",
      selectable: true,
      selected: true,
      outsideFilter: false
    }, 1)).toEqual({ type: "toggle", iso3: "COD" });
  });

  it("clears country focus when clicking an outside-filter country", () => {
    expect(resolveMapCountryClickAction({
      iso3: "ETH",
      selectable: true,
      selected: false,
      outsideFilter: true
    }, 1)).toEqual({ type: "reset-country" });
  });

  it("clears country focus when clicking empty map space or a no-data country", () => {
    expect(resolveMapCountryClickAction({
      iso3: null,
      selectable: false,
      selected: false,
      outsideFilter: false
    }, 1)).toEqual({ type: "reset-country" });

    expect(resolveMapCountryClickAction({
      iso3: "ATA",
      selectable: false,
      selected: false,
      outsideFilter: false
    }, 1)).toEqual({ type: "reset-country" });
  });
});
