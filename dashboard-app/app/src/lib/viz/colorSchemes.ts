export type ColorSchemeId =
  | "sgp"
  | "stripe"
  | "claude"
  | "ibm"
  | "raycast"
  | "airbnb"
  | "notion"
  | "vercel"
  | "framer"
  | "clickhouse";

type ColorScheme = {
  id: ColorSchemeId;
  name: string;
  category: string;
  mode: "light" | "dark";
  summary: string;
  colors: {
    accent: string;
    accent2: string;
    accent3: string;
    bg: string;
    bg2: string;
    surface: string;
    panel: string;
    ink: string;
    muted: string;
    line: string;
    deep: string;
    mapEmpty: string;
    map: [string, string, string];
    charts: string[];
  };
  cssVars: Record<string, string>;
};

function varsFrom({
  accent,
  accent2,
  accent3,
  bg,
  bg2,
  surface,
  panel,
  ink,
  muted,
  line,
  deep,
  mapEmpty,
  map,
  charts,
  mode
}: ColorScheme["colors"] & { mode: ColorScheme["mode"] }): Record<string, string> {
  const dark = mode === "dark";
  return {
    "--bg": bg,
    "--panel": panel,
    "--panel-2": surface,
    "--text": ink,
    "--muted": muted,
    "--border": line,
    "--blue": accent,
    "--deep": deep,
    "--focus-ring": `0 0 0 3px color-mix(in srgb, ${accent}, transparent 72%)`,
    "--scheme-accent": accent,
    "--scheme-accent-2": accent2,
    "--scheme-accent-3": accent3,
    "--scheme-map-empty": mapEmpty,
    "--scheme-map-1": map[0],
    "--scheme-map-3": map[1],
    "--scheme-map-5": map[2],
    "--scheme-chart-1": charts[0],
    "--scheme-chart-2": charts[1],
    "--scheme-chart-3": charts[2],
    "--scheme-chart-4": charts[3],
    "--scheme-chart-5": charts[4],
    "--scheme-chart-6": charts[5],
    "--impact-intro-bg-start": dark ? deep : accent,
    "--impact-intro-bg-end": dark ? bg2 : deep,
    "--impact-intro-border": dark ? accent : accent3,
    "--impact-intro-kicker": accent2,
    "--impact-intro-text": dark ? "#f8fafc" : "#fffdf8",
    "--impact-kpi-bg-start": dark ? "color-mix(in srgb, var(--scheme-accent) 18%, var(--panel))" : "#fffefb",
    "--impact-kpi-bg-end": dark ? "color-mix(in srgb, var(--scheme-accent-3) 18%, var(--panel))" : bg2,
    "--impact-kpi-text": dark ? "#f8fafc" : deep,
    "--impact-filter-bg": dark ? "color-mix(in srgb, var(--scheme-accent) 12%, var(--panel))" : deep,
    "--impact-filter-border": dark ? "color-mix(in srgb, var(--scheme-accent) 58%, transparent)" : "rgba(228, 213, 189, 0.9)",
    "--impact-filter-text": dark ? "#f8fafc" : "#f6ecd8",
    "--impact-filter-active-bg": dark ? "color-mix(in srgb, var(--scheme-accent) 44%, var(--panel))" : "#f3e6cd",
    "--impact-filter-active-border": dark ? accent : "#f9efd6",
    "--impact-input-bg": dark ? "color-mix(in srgb, var(--scheme-accent) 10%, var(--panel))" : deep,
    "--impact-input-border": dark ? "color-mix(in srgb, var(--scheme-accent) 54%, transparent)" : "#e4d5bd",
    "--impact-input-text": dark ? "#f8fafc" : "#f7edd8",
    "--impact-context-bg": dark ? "color-mix(in srgb, var(--scheme-accent) 10%, var(--panel))" : deep,
    "--impact-context-border": dark ? "color-mix(in srgb, var(--scheme-accent) 58%, transparent)" : "#e4d5bd",
    "--impact-context-preview-bg": dark ? "color-mix(in srgb, var(--scheme-accent-2) 12%, var(--panel))" : "color-mix(in srgb, var(--scheme-accent) 18%, var(--impact-context-bg))",
    "--impact-context-title": dark ? "#ffffff" : "#ffffff",
    "--impact-context-body": dark ? "#f8fafc" : "#ffffff",
    "--impact-region-bg": deep,
    "--impact-region-border": accent3,
    "--impact-region-text": dark ? "#f8fafc" : "#f5f7fb",
    "--impact-region-active-bg": accent,
    "--impact-region-active-border": accent3,
    "--impact-region-hover-bg": accent2,
    "--impact-region-hover-border": accent3,
    "--impact-region-meta": dark ? "#d7dee9" : "#dde7f6"
  };
}

function scheme(input: Omit<ColorScheme, "cssVars">): ColorScheme {
  return {
    ...input,
    cssVars: varsFrom({ ...input.colors, mode: input.mode })
  };
}

export const colorSchemes = [
  scheme({
    id: "sgp",
    name: "SGP Atlas",
    category: "SGP",
    mode: "light",
    summary: "The original SGP atlas palette with UNDP blue, forest green, and warm sand controls.",
    colors: {
      accent: "#006eb5",
      accent2: "#2f855a",
      accent3: "#9cc6d4",
      bg: "#eef3f8",
      bg2: "#d9e7ec",
      surface: "#f8fafc",
      panel: "#ffffff",
      ink: "#102033",
      muted: "#617085",
      line: "rgba(15, 23, 42, 0.12)",
      deep: "#14362f",
      mapEmpty: "#e8edf3",
      map: ["#edf8fb", "#2b8cbe", "#084081"],
      charts: ["#006eb5", "#2f855a", "#b7791f", "#6d28d9", "#0e7490", "#be123c"]
    }
  }),
  scheme({
    id: "stripe",
    name: "Stripe",
    category: "Infrastructure & Cloud",
    mode: "light",
    summary: "Payment infrastructure palette: polished white surfaces, violet primary, and magenta energy.",
    colors: {
      accent: "#533afd",
      accent2: "#ea2261",
      accent3: "#f96bee",
      bg: "#ffffff",
      bg2: "#f5f3ff",
      surface: "#f8f7ff",
      panel: "#ffffff",
      ink: "#061b31",
      muted: "#68707a",
      line: "rgba(54, 43, 170, 0.14)",
      deep: "#1c174a",
      mapEmpty: "#f1efff",
      map: ["#eae7ff", "#beb4fe", "#533afd"],
      charts: ["#533afd", "#ea2261", "#f96bee", "#7c6cff", "#d97706", "#b45368"]
    }
  }),
  scheme({
    id: "claude",
    name: "Claude",
    category: "AI & Machine Learning",
    mode: "light",
    summary: "Warm editorial colors with terracotta accents and calm neutral surfaces.",
    colors: {
      accent: "#c96442",
      accent2: "#a75b40",
      accent3: "#de9f8a",
      bg: "#f7f3ee",
      bg2: "#eee7de",
      surface: "#fbf7f1",
      panel: "#ffffff",
      ink: "#3d3d3a",
      muted: "#756f68",
      line: "rgba(61, 61, 58, 0.14)",
      deep: "#44312a",
      mapEmpty: "#f8eee9",
      map: ["#f9ece8", "#eac4b7", "#c96442"],
      charts: ["#c96442", "#b05d41", "#d88f77", "#51423b", "#a2a2a0", "#dfa28e"]
    }
  }),
  scheme({
    id: "ibm",
    name: "IBM",
    category: "Enterprise & Consumer",
    mode: "dark",
    summary: "Carbon-inspired dark structure with sharp blues and technical contrast.",
    colors: {
      accent: "#0f62fe",
      accent2: "#6197fe",
      accent3: "#cbdaf6",
      bg: "#161616",
      bg2: "#202020",
      surface: "#262626",
      panel: "#1b1b1b",
      ink: "#f4f4f4",
      muted: "#c6c6c6",
      line: "rgba(224, 224, 224, 0.2)",
      deep: "#101820",
      mapEmpty: "#2a2a2a",
      map: ["#151c29", "#142b57", "#0f62fe"],
      charts: ["#0f62fe", "#4b89fe", "#1148af", "#cbdaf6", "#8d8d8d", "#78a9ff"]
    }
  }),
  scheme({
    id: "raycast",
    name: "Raycast",
    category: "Developer Tools & Platforms",
    mode: "dark",
    summary: "Sleek launcher chrome with vibrant red, cyan, and smoky dark panels.",
    colors: {
      accent: "#ff6363",
      accent2: "#52c7ff",
      accent3: "#ab92b1",
      bg: "#07080a",
      bg2: "#111217",
      surface: "#15161d",
      panel: "rgba(7, 8, 10, 0.9)",
      ink: "#f9f9f9",
      muted: "#b8b8ba",
      line: "rgba(255, 255, 255, 0.16)",
      deep: "#161019",
      mapEmpty: "#1b1c22",
      map: ["#1b0f11", "#4c2123", "#ff6363"],
      charts: ["#ff6363", "#52c7ff", "#ab92b1", "#89a5d0", "#3c82ac", "#9c3f3f"]
    }
  }),
  scheme({
    id: "airbnb",
    name: "Airbnb",
    category: "Enterprise & Consumer",
    mode: "light",
    summary: "Coral-led travel marketplace palette with warm rounded surfaces.",
    colors: {
      accent: "#ff385c",
      accent2: "#ca334e",
      accent3: "#ff849a",
      bg: "#f7f5f3",
      bg2: "#eee9e4",
      surface: "#fffaf8",
      panel: "#ffffff",
      ink: "#222222",
      muted: "#6a6a6a",
      line: "rgba(34, 34, 34, 0.14)",
      deep: "#41252a",
      mapEmpty: "#fff0f3",
      map: ["#ffe7eb", "#ffb3c1", "#ff385c"],
      charts: ["#ff385c", "#d73452", "#ff708a", "#41252a", "#959595", "#ff889d"]
    }
  }),
  scheme({
    id: "notion",
    name: "Notion",
    category: "Design & Productivity",
    mode: "light",
    summary: "Warm minimal workspace neutrals with a clear blue analytical accent.",
    colors: {
      accent: "#0075de",
      accent2: "#0059a9",
      accent3: "#61a9eb",
      bg: "#ffffff",
      bg2: "#f6f5f4",
      surface: "#fbfaf8",
      panel: "#ffffff",
      ink: "#171717",
      muted: "#6f6f6f",
      line: "rgba(0, 0, 0, 0.1)",
      deep: "#122d45",
      mapEmpty: "#ecf4fb",
      map: ["#e0eefb", "#9ecbf2", "#0075de"],
      charts: ["#0075de", "#0060b6", "#479ce7", "#66aceb", "#404040", "#858585"]
    }
  }),
  scheme({
    id: "vercel",
    name: "Vercel",
    category: "Developer Tools & Platforms",
    mode: "light",
    summary: "High-precision black and white base with a vivid red-magenta spectrum.",
    colors: {
      accent: "#ff5b4f",
      accent2: "#de1d8d",
      accent3: "#7928ca",
      bg: "#ffffff",
      bg2: "#f7f7f7",
      surface: "#fbfbfb",
      panel: "#ffffff",
      ink: "#000000",
      muted: "#4d4d4d",
      line: "rgba(0, 0, 0, 0.08)",
      deep: "#171717",
      mapEmpty: "#fff0ef",
      map: ["#ffebea", "#ffc1bc", "#ff5b4f"],
      charts: ["#ff5b4f", "#de1d8d", "#7928ca", "#ee3c6e", "#ac22ac", "#7a7a7a"]
    }
  }),
  scheme({
    id: "framer",
    name: "Framer",
    category: "Design & Productivity",
    mode: "dark",
    summary: "Motion-first black workspace with electric blue visualization accents.",
    colors: {
      accent: "#0099ff",
      accent2: "#a6a6a6",
      accent3: "#53a0d2",
      bg: "#000000",
      bg2: "#0c1014",
      surface: "#111820",
      panel: "rgba(0, 0, 0, 0.9)",
      ink: "#ffffff",
      muted: "#b8c0c8",
      line: "rgba(0, 153, 255, 0.28)",
      deep: "#061523",
      mapEmpty: "#151a20",
      map: ["#000c14", "#002b47", "#0099ff"],
      charts: ["#0099ff", "#a6a6a6", "#53a0d2", "#74a2c1", "#6e6e6e", "#005c99"]
    }
  }),
  scheme({
    id: "clickhouse",
    name: "ClickHouse",
    category: "Infrastructure & Cloud",
    mode: "dark",
    summary: "Technical black canvas with bright analytical yellow and green support.",
    colors: {
      accent: "#faff69",
      accent2: "#166534",
      accent3: "#f4f692",
      bg: "#000000",
      bg2: "#121309",
      surface: "#17180c",
      panel: "rgba(0, 0, 0, 0.9)",
      ink: "#f5f5d8",
      muted: "#b7b783",
      line: "rgba(250, 255, 105, 0.28)",
      deep: "#171809",
      mapEmpty: "#202114",
      map: ["#141408", "#46471d", "#faff69"],
      charts: ["#faff69", "#166534", "#f4f692", "#9ca840", "#d6de5b", "#6f7b20"]
    }
  })
] as const satisfies readonly ColorScheme[];

export const defaultColorSchemeId: ColorSchemeId = "sgp";

export function getColorScheme(id: ColorSchemeId | string): ColorScheme {
  return colorSchemes.find((scheme) => scheme.id === id) ?? colorSchemes[0];
}

export function interpolateSchemeMap(id: ColorSchemeId | string, t: number) {
  const scheme = getColorScheme(id);
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped <= 0.5) {
    return interpolateHex(scheme.colors.map[0], scheme.colors.map[1], clamped * 2);
  }
  return interpolateHex(scheme.colors.map[1], scheme.colors.map[2], (clamped - 0.5) * 2);
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3 ? normalized.split("").map((part) => `${part}${part}`).join("") : normalized;
  const numeric = Number.parseInt(value, 16);
  return [(numeric >> 16) & 255, (numeric >> 8) & 255, numeric & 255];
}

function interpolateHex(a: string, b: string, t: number) {
  const start = hexToRgb(a);
  const end = hexToRgb(b);
  const rgb = start.map((value, index) => Math.round(value + (end[index] - value) * t));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}
