const COMPACT_THRESHOLD = 1_000;

function activeLocale() {
  if (typeof document === "undefined") return "en";
  return document.documentElement.lang || "en";
}

export function formatMoney(value: number | null | undefined, options: { compact?: boolean } = {}) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }
  const shouldCompact = options.compact ?? Math.abs(value) >= COMPACT_THRESHOLD;
  return new Intl.NumberFormat(activeLocale(), {
    style: "currency",
    currency: "USD",
    notation: shouldCompact ? "compact" : "standard",
    maximumFractionDigits: shouldCompact ? 1 : 0
  }).format(value);
}

export function formatNumber(value: number | null | undefined, options: { compact?: boolean } = {}) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }
  const shouldCompact = options.compact ?? Math.abs(value) >= COMPACT_THRESHOLD;
  return new Intl.NumberFormat(activeLocale(), {
    notation: shouldCompact ? "compact" : "standard",
    maximumFractionDigits: shouldCompact ? 1 : 3
  }).format(value);
}

export function formatMetric(value: number | null | undefined, type: "money" | "number" | "ratio" = "number") {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }
  if (type === "money") {
    return formatMoney(value);
  }
  if (type === "ratio") {
    return `${value.toFixed(2)}x`;
  }
  return formatNumber(value);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
