import { describe, expect, it } from "vitest";
import { mapFeatureToWrappedParts, resolveMapCountryClickAction } from "../components/WorldChoropleth";

function makePolygonFeature(iso3: string, coordinates: GeoJSON.Position[][]): GeoJSON.Feature<GeoJSON.Polygon, { iso3: string; name: string }> {
  return {
    type: "Feature",
    properties: { iso3, name: iso3 },
    geometry: { type: "Polygon", coordinates }
  };
}

function makeMultiPolygonFeature(iso3: string, coordinates: GeoJSON.Position[][][]): GeoJSON.Feature<GeoJSON.MultiPolygon, { iso3: string; name: string }> {
  return {
    type: "Feature",
    properties: { iso3, name: iso3 },
    geometry: { type: "MultiPolygon", coordinates }
  };
}

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

describe("map antimeridian wrapping", () => {
  const westernPacificPolygon: GeoJSON.Position[][] = [[[-172, -14], [-171, -14], [-171, -13], [-172, -13], [-172, -14]]];
  const easternPacificPolygon: GeoJSON.Position[][] = [[[174, -18], [175, -18], [175, -17], [174, -17], [174, -18]]];

  it("moves western Pacific island polygons to the wrapped right-side map copy", () => {
    const parts = mapFeatureToWrappedParts(makePolygonFeature("WSM", westernPacificPolygon), 850);

    expect(parts).toHaveLength(1);
    expect(parts[0].wrapShiftX).toBe(850);
  });

  it("splits antimeridian Pacific multipolygons into normal and wrapped rendered parts", () => {
    const parts = mapFeatureToWrappedParts(makeMultiPolygonFeature("KIR", [easternPacificPolygon, westernPacificPolygon]), 850);

    expect(parts).toHaveLength(2);
    expect(parts.map((part) => part.wrapShiftX).sort((a, b) => a - b)).toEqual([0, 850]);
    expect(parts.find((part) => part.wrapShiftX === 0)?.feature.geometry.type).toBe("MultiPolygon");
    expect(parts.find((part) => part.wrapShiftX === 850)?.feature.geometry.type).toBe("MultiPolygon");
  });

  it("does not wrap non-Pacific countries or already eastern Pacific polygons", () => {
    expect(mapFeatureToWrappedParts(makePolygonFeature("PER", westernPacificPolygon), 850)[0].wrapShiftX).toBe(0);
    expect(mapFeatureToWrappedParts(makePolygonFeature("FJI", easternPacificPolygon), 850)[0].wrapShiftX).toBe(0);
  });
});
