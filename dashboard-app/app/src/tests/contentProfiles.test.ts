import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ContentProfiles } from "../lib/data/schema";

const processedDataDir = path.resolve(process.cwd(), "..", "data", "processed");
const profiles = JSON.parse(fs.readFileSync(path.join(processedDataDir, "content-profiles.json"), "utf8")) as ContentProfiles;

describe("content profiles", () => {
  it("normalizes YouTube profile voice links and adds deterministic thumbnails", () => {
    const voices = [...Object.values(profiles.countries), ...Object.values(profiles.areas)].flatMap((profile) => [
      ...(profile.voices ?? []),
      ...(profile.featured ? [profile.featured] : [])
    ]);
    const youtubeVoices = voices.filter((voice) => voice.url.includes("youtube.com/"));

    expect(youtubeVoices.length).toBeGreaterThan(200);
    expect(youtubeVoices.every((voice) => voice.url.includes("youtube.com/watch?v="))).toBe(true);
    expect(youtubeVoices.every((voice) => !voice.url.includes("youtube.com/embed/"))).toBe(true);
    expect(youtubeVoices.every((voice) => Boolean(voice.imageUrl))).toBe(true);
    expect(youtubeVoices.some((voice) => voice.imageUrl?.startsWith("https://img.youtube.com/vi/"))).toBe(true);
  });
});
