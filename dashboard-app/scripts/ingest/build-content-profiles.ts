import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCountryLookup, matchCountry, type GeoFeatureLike } from "../../app/src/lib/data/countryMapping";
import type { ContentProfile, ContentProfileLink, ContentProfiles } from "../../app/src/lib/data/schema";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_SCRAPER_OUTPUT = "/Users/ben/Documents/UNDP/SGP/SGP Scraper/output/sgp_full_site";
const SCRAPER_OUTPUT = process.env.SGP_SCRAPER_OUTPUT || DEFAULT_SCRAPER_OUTPUT;
const CONTENT_DIR = path.join(SCRAPER_OUTPUT, "content");
const PUBLIC_DATA_DIR = path.join(ROOT, "app", "public", "data");
const PROCESSED_DIR = path.join(ROOT, "data", "processed");
const OUTPUTS_DIR = path.join(ROOT, "outputs", "data");
const GEO_PATH = path.join(ROOT, "data", "geo", "world-countries.geojson");

const AREA_ALIASES: Record<string, string[]> = {
  "Biodiversity": ["Biodiversity"],
  "Chemicals": ["Chemicals", "Chemicals and Waste"],
  "Climate Change": ["Climate Change", "Climate Change Mitigation"],
  "Climate Change Mitigation": ["Climate Change Mitigation", "Climate Change"],
  "Community Based Adaptation": ["Community Based Adaptation", "Climate Change Adaptation"],
  "International Waters": ["International Waters"],
  "Land Degradation": ["Land Degradation"],
  "Sustainable Forest Management": ["Sustainable Forest Management"]
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function cleanText(value: unknown, limit = 720) {
  const text = String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).replace(/\s+\S*$/, "")}...`;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function youtubeIdFromUrl(value: unknown) {
  const url = firstString(value);
  if (!url) return "";
  const match = url.match(/(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return match?.[1] ?? "";
}

function normalizeProfileUrl(value: unknown) {
  const url = firstString(value);
  const youtubeId = youtubeIdFromUrl(url);
  if (youtubeId) return `https://www.youtube.com/watch?v=${youtubeId}`;
  return url;
}

function youtubeThumbnailUrl(value: unknown) {
  const youtubeId = youtubeIdFromUrl(value);
  return youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : "";
}

function imageUrl(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const maybeImage = value as Record<string, unknown>;
  return firstString(maybeImage.final_url, maybeImage.url, maybeImage.image_url, maybeImage.original_url) || null;
}

function toLink(value: unknown, fallbackKind?: string): ContentProfileLink | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const title = firstString(item.title, item.label, item.observed_title, item.caption);
  const url = normalizeProfileUrl(firstString(item.url, item.more_info_url, item.download_url, item.observed_url));
  if (!title && !url) return null;
  return {
    title: title || url,
    url,
    kind: firstString(item.entity_type, item.route_type, item.item_kind) || fallbackKind || null,
    summary: cleanText(item.summary, 180) || null,
    imageUrl: imageUrl(item.image) || firstString(item.image_url) || null
  };
}

function dedupeLinks(links: Array<ContentProfileLink | null>, limit: number) {
  const seen = new Set<string>();
  const result: ContentProfileLink[] = [];
  for (const link of links) {
    if (!link) continue;
    const key = `${link.title}::${link.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(link);
    if (result.length >= limit) break;
  }
  return result;
}

function linksFromSection(section: unknown, limit: number, fallbackKind?: string) {
  if (!section || typeof section !== "object") return [];
  const item = section as Record<string, unknown>;
  const cards = Array.isArray(item.cards) ? item.cards : [];
  const collectionItems = Array.isArray(item.collection_items) ? item.collection_items : [];
  const references = Array.isArray(item.publication_references) ? item.publication_references : [];
  return dedupeLinks([...cards, ...collectionItems, ...references].map((entry) => toLink(entry, fallbackKind)), limit);
}

function normalizedUrlKey(value: unknown) {
  const youtubeId = youtubeIdFromUrl(value);
  if (youtubeId) return `youtube:${youtubeId.toLowerCase()}`;
  return String(value ?? "")
    .trim()
    .replace(/#.*$/, "")
    .replace(/\?.*$/, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

function buildStoryImageMap(records: Array<Record<string, unknown>>) {
  const map = new Map<string, string>();
  for (const record of records) {
    const identity = (record.identity ?? {}) as Record<string, unknown>;
    const images = Array.isArray(record.images) ? record.images : [];
    const image = images.map(imageUrl).find(Boolean);
    if (!image) continue;
    for (const url of [identity.canonical_url, identity.source_url]) {
      const key = normalizedUrlKey(url);
      if (key && !map.has(key)) map.set(key, image);
    }
  }
  return map;
}

function buildVideoImageMap(records: Array<Record<string, unknown>>) {
  const map = new Map<string, string>();
  for (const record of records) {
    const identity = (record.identity ?? {}) as Record<string, unknown>;
    const urls = [identity.canonical_url, identity.source_url, record.url].map(normalizeProfileUrl).filter(Boolean);
    const image = youtubeThumbnailUrl(firstString(identity.canonical_url, identity.source_url, record.url));
    if (!image) continue;
    for (const url of urls) {
      const key = normalizedUrlKey(url);
      if (key && !map.has(key)) map.set(key, image);
    }
  }
  return map;
}

function withMappedImages(links: Array<ContentProfileLink | null>, imageMap: Map<string, string>) {
  return links.filter((link): link is ContentProfileLink => Boolean(link)).map((link) => ({
    ...link,
    url: normalizeProfileUrl(link.url),
    imageUrl: link.imageUrl || imageMap.get(normalizedUrlKey(link.url)) || imageMap.get(normalizedUrlKey(normalizeProfileUrl(link.url))) || youtubeThumbnailUrl(link.url) || null
  }));
}

function metricsFromSnapshot(profile: Record<string, unknown>) {
  const snapshot = (profile.snapshot_of_portfolio ?? {}) as Record<string, unknown>;
  const metrics = Array.isArray(snapshot.metrics) ? snapshot.metrics : [];
  return metrics
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const metric = entry as Record<string, unknown>;
      const label = firstString(metric.label);
      const value = firstString(metric.value);
      return label && value ? { label, value } : null;
    })
    .filter((entry): entry is { label: string; value: string } => Boolean(entry));
}

function collectionsFromProfile(profile: Record<string, unknown>) {
  const keys = [
    ["our_stories", "Stories"],
    ["sgp_voices", "Voices"],
    ["testimonials", "Testimonials"],
    ["gallery", "Gallery"],
    ["case_studies", "Case studies"]
  ] as const;
  return keys
    .map(([key, label]) => {
      const section = (profile[key] ?? {}) as Record<string, unknown>;
      const count = Number(section.item_count ?? 0);
      const url = firstString(section.url) || null;
      return count || url ? { key, label, count: Number.isFinite(count) ? count : 0, url } : null;
    })
    .filter((entry): entry is { key: string; label: string; count: number; url: string | null } => Boolean(entry));
}

function contactsFromProfile(profile: Record<string, unknown>) {
  const contacts = Array.isArray(profile.contacts) ? profile.contacts : [];
  return contacts.slice(0, 3).map((entry) => {
    const contact = (entry ?? {}) as Record<string, unknown>;
    const emails = Array.isArray(contact.emails) ? contact.emails : [];
    const phones = Array.isArray(contact.phones) ? contact.phones : [];
    return {
      name: firstString(contact.name) || null,
      role: firstString(contact.role) || null,
      email: firstString(...emails) || null,
      phone: firstString(...phones) || null
    };
  });
}

function sourceProfile(record: Record<string, unknown>, type: "country" | "area") {
  const metadata = (record.metadata ?? {}) as Record<string, unknown>;
  const attributes = (record.attributes ?? {}) as Record<string, unknown>;
  return (
    (metadata[type === "country" ? "country_profile" : "area_profile"] as Record<string, unknown> | undefined) ??
    (attributes[type === "country" ? "country_profile" : "area_profile"] as Record<string, unknown> | undefined) ??
    metadata
  );
}

function buildCountryProfiles(records: Array<Record<string, unknown>>, storyImages: Map<string, string>, videoImages: Map<string, string>) {
  const geo = readJson<GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>>(GEO_PATH, { type: "FeatureCollection", features: [] });
  const { lookup, isoNames } = buildCountryLookup(geo.features as GeoFeatureLike[]);
  const countries: Record<string, ContentProfile> = {};

  for (const record of records) {
    const identity = (record.identity ?? {}) as Record<string, unknown>;
    const title = firstString(identity.title);
    const matched = matchCountry(title, lookup, isoNames);
    if (!matched.iso3 || !title) continue;
    const profile = sourceProfile(record, "country");
    const metadata = (record.metadata ?? {}) as Record<string, unknown>;
    const bodyText = (record.content as Record<string, unknown> | undefined)?.body_text;
    const publications = [
      ...linksFromSection(profile.global_publications, 5, "publication"),
      ...dedupeLinks(((profile.publication_references as unknown[]) ?? []).map((entry) => toLink(entry, "publication")), 5)
    ];
    countries[matched.iso3] = {
      type: "country",
      key: matched.iso3,
      aliases: [title, matched.canonicalName].filter(Boolean),
      title,
      sourceUrl: firstString(identity.canonical_url, identity.source_url) || null,
      summary: cleanText(bodyText, 520),
      metrics: metricsFromSnapshot(profile),
      collections: collectionsFromProfile(profile),
      contacts: contactsFromProfile(profile),
      publications: dedupeLinks(publications, 6),
      stories: withMappedImages(linksFromSection(metadata.our_stories ?? profile.our_stories, 6, "story"), storyImages),
      caseStudies: linksFromSection(profile.case_studies, 5, "case study"),
      voices: withMappedImages(linksFromSection(metadata.sgp_voices ?? profile.sgp_voices, 4, "voice"), videoImages),
      featured: withMappedImages([toLink(metadata.featured_voice ?? profile.featured_voice, "voice")], videoImages)[0] ?? null
    };
  }
  return countries;
}

function areaKey(title: string) {
  return AREA_ALIASES[title]?.[0] ?? title;
}

function buildAreaProfiles(records: Array<Record<string, unknown>>, storyImages: Map<string, string>, videoImages: Map<string, string>) {
  const areas: Record<string, ContentProfile> = {};
  for (const record of records) {
    const identity = (record.identity ?? {}) as Record<string, unknown>;
    const title = firstString(identity.title);
    if (!title) continue;
    const profile = sourceProfile(record, "area");
    const metadata = (record.metadata ?? {}) as Record<string, unknown>;
    const overviewText = firstString(metadata.overview_text, (record.content as Record<string, unknown> | undefined)?.body_text);
    const key = areaKey(title);
    areas[key] = {
      type: "area",
      key,
      aliases: AREA_ALIASES[title] ?? [title],
      title,
      sourceUrl: firstString(identity.canonical_url, identity.source_url) || null,
      summary: cleanText(overviewText.replace(/\b(Snapshot|Global Publications|Case Studies)\b[\s\S]*$/i, ""), 720) || cleanText(overviewText, 720),
      metrics: metricsFromSnapshot(profile),
      collections: collectionsFromProfile(profile),
      contacts: [],
      publications: dedupeLinks([
        ...linksFromSection(profile.global_publications, 6, "publication"),
        ...linksFromSection(profile.side_rail && (profile.side_rail as Record<string, unknown>).publications, 4, "publication")
      ], 8),
      stories: withMappedImages(linksFromSection(metadata.our_stories ?? profile.our_stories, 7, "story"), storyImages),
      caseStudies: linksFromSection(metadata.case_studies ?? profile.case_studies, 7, "case study"),
      voices: withMappedImages(linksFromSection(metadata.sgp_voices ?? profile.sgp_voices, 5, "voice"), videoImages),
      featured: withMappedImages([toLink(metadata.featured_voice ?? profile.featured_voice, "voice")], videoImages)[0] ?? null
    };
  }

  return areas;
}

function writeJson(relativeName: string, value: unknown) {
  for (const dir of [PROCESSED_DIR, OUTPUTS_DIR, PUBLIC_DATA_DIR]) {
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, relativeName), `${JSON.stringify(value)}\n`);
  }
}

function main() {
  const countriesPath = path.join(CONTENT_DIR, "countries.json");
  const areasPath = path.join(CONTENT_DIR, "areas.json");
  const storiesPath = path.join(CONTENT_DIR, "stories.json");
  const videosPath = path.join(CONTENT_DIR, "videos.json");
  if (!fs.existsSync(countriesPath) || !fs.existsSync(areasPath)) {
    console.warn(`SGP scraper content not found at ${CONTENT_DIR}; writing empty content profiles.`);
    writeJson("content-profiles.json", { countries: {}, areas: {} } satisfies ContentProfiles);
    return;
  }

  const countryRecords = readJson<Array<Record<string, unknown>>>(countriesPath, []);
  const areaRecords = readJson<Array<Record<string, unknown>>>(areasPath, []);
  const storyRecords = readJson<Array<Record<string, unknown>>>(storiesPath, []);
  const videoRecords = readJson<Array<Record<string, unknown>>>(videosPath, []);
  const storyImages = buildStoryImageMap(storyRecords);
  const videoImages = buildVideoImageMap(videoRecords);
  const profiles: ContentProfiles = {
    generatedAt: new Date().toISOString(),
    source: SCRAPER_OUTPUT,
    countries: buildCountryProfiles(countryRecords, storyImages, videoImages),
    areas: buildAreaProfiles(areaRecords, storyImages, videoImages)
  };
  writeJson("content-profiles.json", profiles);
  console.log(`Wrote content profiles: ${Object.keys(profiles.countries).length} countries, ${Object.keys(profiles.areas).length} area keys`);
}

main();
