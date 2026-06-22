export const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

export const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1
});

export const number = new Intl.NumberFormat("en-US");

export const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1
});

export const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1
});

const COMPACT_THRESHOLD = 1_000;

export function formatMoney(value: number | null | undefined, options: { compact?: boolean } = {}) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }
  const shouldCompact = options.compact ?? Math.abs(value) >= COMPACT_THRESHOLD;
  return shouldCompact ? usdCompact.format(value) : usd.format(value);
}

export function formatNumber(value: number | null | undefined, options: { compact?: boolean } = {}) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }
  const shouldCompact = options.compact ?? Math.abs(value) >= COMPACT_THRESHOLD;
  return shouldCompact ? compactNumber.format(value) : number.format(value);
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
