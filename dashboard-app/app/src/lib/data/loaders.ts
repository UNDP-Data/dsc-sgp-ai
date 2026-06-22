import {
  type CofinancingByProject,
  type CofinancingRecord,
  type DataBundle,
  type ProjectRecord
} from "./schema";
import { buildAggregates } from "../aggregation/aggregateData";

function publicAssetPath(path: string) {
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}${path.replace(/^\/+/, "")}`;
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
