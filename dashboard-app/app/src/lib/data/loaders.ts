import {
  type CofinancingByProject,
  type CofinancingRecord,
  type ContentProfiles,
  type DataBundle,
  type ProjectRecord
} from "./schema";
import { buildAggregates } from "../aggregation/aggregateData";

type RuntimeTable<T> = {
  fields: Array<keyof T>;
  rows: unknown[][];
};

/**
 * Resolve assets correctly for both Vite dev paths and GitHub Pages nested
 * builds. `build:pages` uses `base=./`, so runtime JSON must resolve relative
 * to the current dashboard route instead of the domain root.
 */
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
  // Pipeline runtime JSON uses a compact columnar shape to reduce Pages payload
  // size; the dashboard expands it back into typed records at load time.
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

async function fetchOptionalJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return await fetchJson<T>(path);
  } catch (error) {
    console.warn(error);
    return fallback;
  }
}

const EMPTY_PROFILES: ContentProfiles = {
  countries: {},
  areas: {}
};

export async function loadDataBundle(): Promise<DataBundle> {
  /** Load the minimum runtime bundle required for the interactive dashboard. */
  const [projects, cofinancing, profiles] = await Promise.all([
    fetchRuntimeTable<ProjectRecord>(publicAssetPath("data/projects.runtime.json")),
    fetchRuntimeTable<CofinancingRecord>(publicAssetPath("data/cofinancing.runtime.json")),
    fetchOptionalJson<ContentProfiles>(publicAssetPath("data/content-profiles.json"), EMPTY_PROFILES)
  ]);
  const aggregates = buildAggregates(projects, cofinancing, { includeCrosstabs: false });

  return {
    projects,
    cofinancing,
    cofinancingByProject: {} as CofinancingByProject,
    aggregates,
    profiles
  };
}

export async function loadWorldGeo() {
  return fetchJson<GeoJSON.FeatureCollection>(publicAssetPath("geo/world-countries.geojson"));
}
