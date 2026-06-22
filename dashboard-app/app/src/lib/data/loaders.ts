import {
  type CofinancingByProject,
  type CofinancingRecord,
  type DataBundle,
  type ProjectRecord
} from "./schema";
import { buildAggregates } from "../aggregation/aggregateData";

function publicAssetPath(path: string) {
  const cleanPath = path.replace(/^\/+/, "");
  const configuredBase = import.meta.env.BASE_URL || "/";
  if (configuredBase === "./" || configuredBase === "") {
    return new URL(`../${cleanPath}`, import.meta.url).toString();
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

export async function loadDataBundle(): Promise<DataBundle> {
  const [projects, cofinancing] = await Promise.all([
    fetchJson<ProjectRecord[]>(publicAssetPath("data/projects.normalized.json")),
    fetchJson<CofinancingRecord[]>(publicAssetPath("data/cofinancing.normalized.json"))
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
