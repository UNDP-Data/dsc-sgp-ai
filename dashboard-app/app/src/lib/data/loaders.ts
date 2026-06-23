import {
  type CofinancingByProject,
  type CofinancingRecord,
  type DataBundle,
  type ProjectRecord
} from "./schema";
import { buildAggregates } from "../aggregation/aggregateData";

type RuntimeTable<T> = {
  fields: Array<keyof T>;
  rows: unknown[][];
};

function publicAssetPath(path: string) {
  const cleanPath = path.replace(/^\/+/, "");
  const configuredBase = import.meta.env.BASE_URL || "/";
  if (configuredBase === "./" || configuredBase === "") {
    const pageBase = typeof window !== "undefined" ? new URL("./", window.location.href) : new URL("./", "http://localhost/");
    return new URL(cleanPath, pageBase).toString();
  }
  const base = configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`;
  return `${base}${cleanPath}`;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function inflateRuntimeTable<T extends Record<string, unknown>>(table: RuntimeTable<T>): T[] {
  return table.rows.map((row) => {
    const item: Record<string, unknown> = {};
    for (let index = 0; index < table.fields.length; index += 1) {
      item[String(table.fields[index])] = row[index] ?? null;
    }
    return item as T;
  });
}

async function fetchRuntimeTable<T extends Record<string, unknown>>(path: string): Promise<T[]> {
  const table = await fetchJson<RuntimeTable<T>>(path);
  return inflateRuntimeTable(table);
}

export async function loadDataBundle(): Promise<DataBundle> {
  const [projects, cofinancing] = await Promise.all([
    fetchRuntimeTable<ProjectRecord>(publicAssetPath("data/projects.runtime.json")),
    fetchRuntimeTable<CofinancingRecord>(publicAssetPath("data/cofinancing.runtime.json"))
  ]);
  const aggregates = buildAggregates(projects, cofinancing, { includeCrosstabs: false });

  return {
    projects,
    cofinancing,
    cofinancingByProject: {} as CofinancingByProject,
    aggregates
  };
}

export async function loadWorldGeo() {
  return fetchJson<GeoJSON.FeatureCollection>(publicAssetPath("geo/world-countries.geojson"));
}
