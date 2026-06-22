import * as d3 from "d3";
import { ZoomIn, ZoomOut } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent, WheelEvent } from "react";
import { metricValue } from "../lib/aggregation/metrics";
import { mapMetricOptions, metricLabels, moneyMetrics } from "../lib/dashboard/config";
import type { AggregateRow, MetricKey, ProjectRecord } from "../lib/data/schema";
import type { ThemeMode } from "../lib/filters/filterStore";
import { getColorScheme, interpolateSchemeMap } from "../lib/viz/colorSchemes";
import { formatMetric } from "../lib/viz/formatters";

export type WorldGeo = GeoJSON.FeatureCollection<GeoJSON.Geometry, { iso3?: string; name?: string; [key: string]: unknown }>;

type MapViewTransform = { scale: number; tx: number; ty: number };
type MapFocusRect = { x0: number; y0: number; x1: number; y1: number };
type MapFeatureBounds = { minX: number; minY: number; maxX: number; maxY: number };
type WorldFeature = GeoJSON.Feature<GeoJSON.Geometry, { iso3?: string; name?: string; [key: string]: unknown }>;
type SgpGeoPath = { bounds: (feature: WorldFeature) => [[number, number], [number, number]] };
type SelectionKind = "global" | "region" | "country";
type MapCountryClickTarget = {
  iso3: string | null;
  selectable: boolean;
  selected: boolean;
  outsideFilter: boolean;
};
type MapCountryClickAction = { type: "toggle"; iso3: string } | { type: "reset-country" } | { type: "none" };
type MapLegendBin = {
  index: number;
  count: number;
  startValue: number;
  endValue: number;
  color: string;
  height: number;
  label: string;
};

const SGP_MAP_WIDTH = 960;
const SGP_MAP_HEIGHT = 460;
const SGP_MAP_MIN_SCALE = 0.52;
const SGP_MAP_MAX_SCALE = 42;
const SGP_MAP_IDENTITY: MapViewTransform = { scale: 1, tx: 0, ty: 0 };
const SGP_MAP_FULL_FOCUS: MapFocusRect = { x0: 0, y0: 0, x1: SGP_MAP_WIDTH, y1: SGP_MAP_HEIGHT };
const SGP_MAP_DRAG_THRESHOLD = 6;
const SGP_MAP_FOCUS_PADDING = 10;
const SGP_MAP_LEGEND_BIN_COUNT = 14;
const SGP_MAP_LEGEND_TICK_COUNT = 5;
const SGP_MAP_ZOOM_STEP = 1.16;
const SGP_MAP_WHEEL_SENSITIVITY = 0.001;
const SGP_MAP_BUTTON_ZOOM_MS = 480;
const SGP_MAP_RESET_MS = 680;
const SGP_MAP_COUNTRY_FIT_MS = 980;
const SGP_MAP_REGION_FIT_MS = 900;
const SGP_MAP_GLOBAL_FIT_MS = 760;

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function easeMapInOut(t: number) {
  const clamped = clampNumber(t, 0, 1);
  return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
}

function interpolateMapTransform(from: MapViewTransform, to: MapViewTransform, t: number): MapViewTransform {
  return {
    scale: from.scale + (to.scale - from.scale) * t,
    tx: from.tx + (to.tx - from.tx) * t,
    ty: from.ty + (to.ty - from.ty) * t
  };
}

function mapTransformString(view: MapViewTransform) {
  return `translate(${view.tx} ${view.ty}) scale(${view.scale})`;
}

function clampMapFocusRect(rect: MapFocusRect | null | undefined): MapFocusRect {
  const normalized = rect ?? SGP_MAP_FULL_FOCUS;
  const x0 = clampNumber(Number(normalized.x0), 0, SGP_MAP_WIDTH - 2);
  const y0 = clampNumber(Number(normalized.y0), 0, SGP_MAP_HEIGHT - 2);
  const x1 = clampNumber(Number(normalized.x1), x0 + 2, SGP_MAP_WIDTH);
  const y1 = clampNumber(Number(normalized.y1), y0 + 2, SGP_MAP_HEIGHT);
  return { x0, y0, x1, y1 };
}

function mapRectCenter(rect: MapFocusRect) {
  return {
    x: (rect.x0 + rect.x1) / 2,
    y: (rect.y0 + rect.y1) / 2
  };
}

function clampMapTransform(view: MapViewTransform): MapViewTransform {
  const scale = clampNumber(view.scale, SGP_MAP_MIN_SCALE, SGP_MAP_MAX_SCALE);
  const scaledWidth = SGP_MAP_WIDTH * scale;
  const scaledHeight = SGP_MAP_HEIGHT * scale;
  const centerTx = (SGP_MAP_WIDTH - scaledWidth) / 2;
  const centerTy = (SGP_MAP_HEIGHT - scaledHeight) / 2;
  const minTx = scale >= 1 ? SGP_MAP_WIDTH - scaledWidth - 110 : centerTx - 110;
  const maxTx = scale >= 1 ? 170 : centerTx + 170;
  const minTy = scale >= 1 ? SGP_MAP_HEIGHT - scaledHeight - 24 : centerTy - 72;
  const maxTy = scale >= 1 ? 72 : centerTy + 72;
  return {
    scale,
    tx: clampNumber(view.tx, minTx, maxTx),
    ty: clampNumber(view.ty, minTy, maxTy)
  };
}

function scaleMapAroundPoint(view: MapViewTransform, factor: number, anchorX: number, anchorY: number): MapViewTransform {
  const nextScale = clampNumber(view.scale * factor, SGP_MAP_MIN_SCALE, SGP_MAP_MAX_SCALE);
  const worldX = (anchorX - view.tx) / view.scale;
  const worldY = (anchorY - view.ty) / view.scale;
  return clampMapTransform({
    scale: nextScale,
    tx: anchorX - worldX * nextScale,
    ty: anchorY - worldY * nextScale
  });
}

function collectMapFeatureBounds(features: WorldFeature[], path: SgpGeoPath): MapFeatureBounds | null {
  if (!features.length) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const feature of features) {
    const [[x0, y0], [x1, y1]] = path.bounds(feature);
    if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) {
      continue;
    }
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}

function fitMapTransformForFeatures(
  features: WorldFeature[],
  path: SgpGeoPath,
  focusRect: MapFocusRect,
  fitCoverage: number
): MapViewTransform {
  const bounds = collectMapFeatureBounds(features, path);
  if (!bounds) return SGP_MAP_IDENTITY;
  const targetRect = clampMapFocusRect(focusRect);
  const targetWidth = Math.max(1, targetRect.x1 - targetRect.x0);
  const targetHeight = Math.max(1, targetRect.y1 - targetRect.y0);
  const center = mapRectCenter(targetRect);
  const dx = Math.max(1, bounds.maxX - bounds.minX);
  const dy = Math.max(1, bounds.maxY - bounds.minY);
  const scale = clampNumber(fitCoverage / Math.max(dx / targetWidth, dy / targetHeight), SGP_MAP_MIN_SCALE, SGP_MAP_MAX_SCALE);

  return clampMapTransform({
    scale,
    tx: center.x - scale * ((bounds.minX + bounds.maxX) / 2),
    ty: center.y - scale * ((bounds.minY + bounds.maxY) / 2)
  });
}

function alignMapBoundsInFocusRect(view: MapViewTransform, bounds: MapFeatureBounds | null, focusRect: MapFocusRect, xBias = 0, yBias = 0): MapViewTransform {
  if (!bounds) return view;
  const targetRect = clampMapFocusRect(focusRect);
  const minX = bounds.minX * view.scale + view.tx;
  const maxX = bounds.maxX * view.scale + view.tx;
  const minY = bounds.minY * view.scale + view.ty;
  const maxY = bounds.maxY * view.scale + view.ty;
  const focusWidth = Math.max(1, targetRect.x1 - targetRect.x0);
  const focusHeight = Math.max(1, targetRect.y1 - targetRect.y0);
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const desiredCenterX = targetRect.x0 + focusWidth * clampNumber(0.5 + xBias, 0.1, 0.9);
  const desiredCenterY = targetRect.y0 + focusHeight * clampNumber(0.5 + yBias, 0.1, 0.9);

  let nextTx = view.tx + (desiredCenterX - (minX + maxX) / 2);
  let nextTy = view.ty + (desiredCenterY - (minY + maxY) / 2);

  if (contentWidth <= focusWidth) {
    const minAllowedTx = targetRect.x0 - bounds.minX * view.scale;
    const maxAllowedTx = targetRect.x1 - bounds.maxX * view.scale;
    nextTx = clampNumber(nextTx, Math.min(minAllowedTx, maxAllowedTx), Math.max(minAllowedTx, maxAllowedTx));
  }

  if (contentHeight <= focusHeight) {
    const minAllowedTy = targetRect.y0 - bounds.minY * view.scale;
    const maxAllowedTy = targetRect.y1 - bounds.maxY * view.scale;
    nextTy = clampNumber(nextTy, Math.min(minAllowedTy, maxAllowedTy), Math.max(minAllowedTy, maxAllowedTy));
  }

  return { ...view, tx: nextTx, ty: nextTy };
}

function metricFormat(metric: MetricKey, value: number | null | undefined) {
  return formatMetric(value, moneyMetrics.has(metric) ? "money" : metric === "cofinancingLeverage" ? "ratio" : "number");
}

function grantFormat(value: number | null | undefined) {
  return formatMetric(value, "money");
}

export function resolveMapCountryClickAction(target: MapCountryClickTarget, selectedCountryCount: number): MapCountryClickAction {
  if (target.iso3 && target.selectable && (selectedCountryCount === 0 || target.selected || !target.outsideFilter)) {
    return { type: "toggle", iso3: target.iso3 };
  }
  if (selectedCountryCount > 0) {
    return { type: "reset-country" };
  }
  return { type: "none" };
}

function WorldChoroplethComponent({
  geo,
  countryRows,
  projectRows,
  selectableCountryRows,
  selectedCountries,
  selectedRegions,
  metric,
  onMetricChange,
  colorSchemeId,
  onCountryToggle,
  onCountryProfileOpen,
  onCountryHover,
  onMapReset,
  onCountryReset
}: {
  geo: WorldGeo;
  countryRows: AggregateRow[];
  projectRows: ProjectRecord[];
  selectableCountryRows?: AggregateRow[];
  selectedCountries: string[];
  selectedRegions: string[];
  metric: MetricKey;
  onMetricChange: (metric: MetricKey) => void;
  colorSchemeId: ThemeMode;
  onCountryToggle: (iso3: string) => void;
  onCountryProfileOpen: (iso3: string) => void;
  onCountryHover?: (iso3: string | null) => void;
  onMapReset?: () => void;
  onCountryReset?: () => void;
}) {
  const width = SGP_MAP_WIDTH;
  const height = SGP_MAP_HEIGHT;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mapGroupRef = useRef<SVGGElement | null>(null);
  const animationRef = useRef<number>(0);
  const viewTransformRef = useRef<MapViewTransform>(SGP_MAP_IDENTITY);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    width: number;
    height: number;
    startTransform: MapViewTransform;
    targetIso3: string | null;
    targetSelectable: boolean;
    targetSelected: boolean;
    targetOutsideFilter: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [resizeRevision, setResizeRevision] = useState(0);
  const dataByIso = useMemo(() => new Map(countryRows.map((row) => [row.key, row])), [countryRows]);
  const selectableDataByIso = useMemo(
    () => new Map((selectableCountryRows ?? countryRows).map((row) => [row.key, row])),
    [countryRows, selectableCountryRows]
  );
  const featuresByIso = useMemo(() => new Map(geo.features.map((feature) => [String(feature.properties?.iso3 ?? ""), feature as WorldFeature])), [geo.features]);
  const portfolioFeatures = useMemo(() => countryRows.map((row) => featuresByIso.get(row.key)).filter((feature): feature is WorldFeature => Boolean(feature)), [countryRows, featuresByIso]);
  const selectedCountryFeatures = useMemo(
    () => selectedCountries.map((iso3) => featuresByIso.get(iso3)).filter((feature): feature is WorldFeature => Boolean(feature)),
    [featuresByIso, selectedCountries]
  );
  const values = useMemo(() => countryRows.map((row) => metricValue(row, metric)).filter((value) => value > 0), [countryRows, metric]);
  const colorScheme = getColorScheme(colorSchemeId);
  const legendRange = useMemo(() => {
    if (!values.length) return null;
    const minValue = Math.max(1, d3.min(values) ?? 1);
    const maxValue = Math.max(minValue, d3.max(values) ?? minValue);
    return { minValue, maxValue };
  }, [values]);
  const colorForValue = useMemo(() => {
    if (!values.length) return () => colorScheme.colors.mapEmpty;
    const colorScale = d3
      .scaleSequentialLog((t) => interpolateSchemeMap(colorSchemeId, t))
      .domain([Math.max(1, d3.min(values) ?? 1), d3.max(values) ?? 1]);
    return (value: number) => colorScale(value);
  }, [colorScheme.colors.mapEmpty, colorSchemeId, values]);
  const countryLegendHistogram = useMemo<MapLegendBin[]>(() => {
    if (!legendRange || !values.length) return [];
    const minLog = Math.log10(Math.max(1, legendRange.minValue));
    const maxLog = Math.log10(Math.max(legendRange.minValue, legendRange.maxValue));
    const logSpan = Math.max(0.0001, maxLog - minLog);
    const bins = Array.from({ length: SGP_MAP_LEGEND_BIN_COUNT }, (_, index) => {
      const startLog = minLog + (index / SGP_MAP_LEGEND_BIN_COUNT) * logSpan;
      const endLog = minLog + ((index + 1) / SGP_MAP_LEGEND_BIN_COUNT) * logSpan;
      return {
        index,
        count: 0,
        startValue: 10 ** startLog,
        endValue: 10 ** endLog,
        colorValue: 10 ** ((startLog + endLog) / 2)
      };
    });

    for (const value of values) {
      const position = ((Math.log10(Math.max(1, value)) - minLog) / logSpan) * SGP_MAP_LEGEND_BIN_COUNT;
      const index = clampNumber(Math.floor(position), 0, SGP_MAP_LEGEND_BIN_COUNT - 1);
      bins[index].count += 1;
    }

    const maxCount = Math.max(1, ...bins.map((bin) => bin.count));
    return bins.map((bin) => ({
      ...bin,
      color: colorForValue(Math.max(1, bin.colorValue)),
      height: bin.count ? Math.max(12, (bin.count / maxCount) * 100) : 7,
      label: `${bin.count} countries from ${metricFormat(metric, bin.startValue)} to ${metricFormat(metric, bin.endValue)}`
    }));
  }, [colorForValue, legendRange, metric, values]);
  const countryLegendTicks = useMemo(() => {
    if (!legendRange) return [];
    const minValue = Math.max(1, legendRange.minValue);
    const maxValue = Math.max(minValue, legendRange.maxValue);
    if (maxValue === minValue) {
      return [metricFormat(metric, minValue)];
    }
    const minLog = Math.log10(minValue);
    const maxLog = Math.log10(maxValue);
    return Array.from({ length: SGP_MAP_LEGEND_TICK_COUNT }, (_, index) => {
      const ratio = index / (SGP_MAP_LEGEND_TICK_COUNT - 1);
      return metricFormat(metric, 10 ** (minLog + ratio * (maxLog - minLog)));
    });
  }, [legendRange, metric]);
  const grantValues = useMemo(
    () => projectRows.map((project) => project.grantAmount).filter((value) => Number.isFinite(value) && value > 0),
    [projectRows]
  );
  const grantLegendRange = useMemo(() => {
    if (!grantValues.length) return null;
    const minValue = Math.max(1, d3.min(grantValues) ?? 1);
    const maxValue = Math.max(minValue, d3.max(grantValues) ?? minValue);
    return { minValue, maxValue };
  }, [grantValues]);
  const grantLegendHistogram = useMemo<MapLegendBin[]>(() => {
    if (!grantLegendRange || !grantValues.length) return [];
    const minLog = Math.log10(Math.max(1, grantLegendRange.minValue));
    const maxLog = Math.log10(Math.max(grantLegendRange.minValue, grantLegendRange.maxValue));
    const logSpan = Math.max(0.0001, maxLog - minLog);
    const bins = Array.from({ length: SGP_MAP_LEGEND_BIN_COUNT }, (_, index) => {
      const startLog = minLog + (index / SGP_MAP_LEGEND_BIN_COUNT) * logSpan;
      const endLog = minLog + ((index + 1) / SGP_MAP_LEGEND_BIN_COUNT) * logSpan;
      return {
        index,
        count: 0,
        startValue: 10 ** startLog,
        endValue: 10 ** endLog
      };
    });

    for (const value of grantValues) {
      const position = ((Math.log10(Math.max(1, value)) - minLog) / logSpan) * SGP_MAP_LEGEND_BIN_COUNT;
      const index = clampNumber(Math.floor(position), 0, SGP_MAP_LEGEND_BIN_COUNT - 1);
      bins[index].count += 1;
    }

    const maxCount = Math.max(1, ...bins.map((bin) => bin.count));
    return bins.map((bin) => ({
      ...bin,
      color: bin.count ? colorScheme.colors.accent : colorScheme.colors.mapEmpty,
      height: bin.count ? Math.max(12, (bin.count / maxCount) * 100) : 7,
      label: `${bin.count} grants from ${grantFormat(bin.startValue)} to ${grantFormat(bin.endValue)}`
    }));
  }, [colorScheme.colors.accent, colorScheme.colors.mapEmpty, grantLegendRange, grantValues]);
  const grantLegendTicks = useMemo(() => {
    if (!grantLegendRange) return [];
    const minValue = Math.max(1, grantLegendRange.minValue);
    const maxValue = Math.max(minValue, grantLegendRange.maxValue);
    if (maxValue === minValue) {
      return [grantFormat(minValue)];
    }
    const minLog = Math.log10(minValue);
    const maxLog = Math.log10(maxValue);
    return Array.from({ length: SGP_MAP_LEGEND_TICK_COUNT }, (_, index) => {
      const ratio = index / (SGP_MAP_LEGEND_TICK_COUNT - 1);
      return grantFormat(10 ** (minLog + ratio * (maxLog - minLog)));
    });
  }, [grantLegendRange]);
  const showGrantDistribution = selectedCountries.length > 0;
  const legendHistogram = showGrantDistribution ? grantLegendHistogram : countryLegendHistogram;
  const legendTicks = showGrantDistribution ? grantLegendTicks : countryLegendTicks;
  const legendTitle = showGrantDistribution ? "Grant distribution" : "Indicator";
  const legendScaleLabel = showGrantDistribution
    ? `Individual grant amount distribution for ${projectRows.length} matching project records`
    : `Country distribution and scale for ${metricLabels[metric]}`;
  const projection = useMemo(() => d3.geoNaturalEarth1().fitExtent([[12, 10], [width - 12, height - 10]], geo), [geo, width, height]);
  const pathGen = useMemo(() => d3.geoPath(projection), [projection]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const tooltipFrameRef = useRef<number | null>(null);
  const nextTooltipRef = useRef<{ x: number; y: number; text: string } | null>(null);
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const applyTransform = useCallback((nextView: MapViewTransform) => {
    const clamped = clampMapTransform(nextView);
    viewTransformRef.current = clamped;
    if (mapGroupRef.current) {
      mapGroupRef.current.setAttribute("transform", mapTransformString(clamped));
      mapGroupRef.current.style.setProperty("--map-scale-inverse", `${clamped.scale >= 1 ? 1 / clamped.scale : 1}`);
    }
  }, []);

  const cancelAnimation = useCallback(() => {
    if (animationRef.current) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
    }
  }, []);

  const showTooltip = useCallback((nextTooltip: { x: number; y: number; text: string }) => {
    nextTooltipRef.current = nextTooltip;
    if (tooltipFrameRef.current !== null) return;
    tooltipFrameRef.current = window.requestAnimationFrame(() => {
      tooltipFrameRef.current = null;
      setTooltip(nextTooltipRef.current);
    });
  }, []);

  const clearTooltip = useCallback(() => {
    nextTooltipRef.current = null;
    if (tooltipFrameRef.current !== null) {
      window.cancelAnimationFrame(tooltipFrameRef.current);
      tooltipFrameRef.current = null;
    }
    setTooltip(null);
  }, []);

  const animateToTransform = useCallback(
    (targetView: MapViewTransform, duration = SGP_MAP_GLOBAL_FIT_MS) => {
      cancelAnimation();
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reducedMotion) {
        applyTransform(targetView);
        return;
      }
      const from = viewTransformRef.current;
      const to = clampMapTransform(targetView);
      let start = 0;

      const tick = (time: number) => {
        if (!start) start = time;
        const progress = Math.min(1, (time - start) / duration);
        applyTransform(interpolateMapTransform(from, to, easeMapInOut(progress)));
        if (progress < 1) {
          animationRef.current = window.requestAnimationFrame(tick);
        } else {
          animationRef.current = 0;
        }
      };

      animationRef.current = window.requestAnimationFrame(tick);
    },
    [applyTransform, cancelAnimation]
  );

  const getFocusRect = useCallback((selectionKind: SelectionKind): MapFocusRect => {
    const svg = svgRef.current;
    if (!svg) return SGP_MAP_FULL_FOCUS;
    const svgRect = svg.getBoundingClientRect();
    if (!Number.isFinite(svgRect.width) || !Number.isFinite(svgRect.height) || svgRect.width <= 0 || svgRect.height <= 0) {
      return SGP_MAP_FULL_FOCUS;
    }

    let x0 = svgRect.left + SGP_MAP_FOCUS_PADDING;
    let y0 = svgRect.top + SGP_MAP_FOCUS_PADDING;
    let x1 = svgRect.right - SGP_MAP_FOCUS_PADDING;
    let y1 = svgRect.bottom - SGP_MAP_FOCUS_PADDING;
    const toolsRect = svg.closest(".map-frame")?.querySelector(".map-nav-tools")?.getBoundingClientRect();
    if (toolsRect) {
      const overlapX = Math.max(0, Math.min(svgRect.right, toolsRect.right) - Math.max(svgRect.left, toolsRect.left));
      const overlapY = Math.max(0, Math.min(svgRect.bottom, toolsRect.bottom) - Math.max(svgRect.top, toolsRect.top));
      if (overlapX > 0 && overlapY > 0) {
        y0 = Math.max(y0, toolsRect.bottom + 8);
        if (toolsRect.left > svgRect.left + svgRect.width * 0.55) {
          x1 = Math.min(x1, toolsRect.left - 8);
        }
      }
    }

    if (selectionKind !== "global") {
      const stage = svg.closest(".sgp-atlas-stage");
      const topDeckRect = stage?.querySelector(".atlas-top-deck")?.getBoundingClientRect();
      const contextRect = stage?.querySelector(".atlas-context-card--workspace")?.getBoundingClientRect();
      if (topDeckRect) {
        const overlapX = Math.max(0, Math.min(svgRect.right, topDeckRect.right) - Math.max(svgRect.left, topDeckRect.left));
        const overlapY = Math.max(0, Math.min(svgRect.bottom, topDeckRect.bottom) - Math.max(svgRect.top, topDeckRect.top));
        if (overlapX > svgRect.width * 0.2 && overlapY > 0) {
          y0 = Math.max(y0, topDeckRect.bottom + 12);
        }
      }
      if (contextRect) {
        const overlapX = Math.max(0, Math.min(svgRect.right, contextRect.right) - Math.max(svgRect.left, contextRect.left));
        const overlapY = Math.max(0, Math.min(svgRect.bottom, contextRect.bottom) - Math.max(svgRect.top, contextRect.top));
        if (overlapX > 0 && overlapY > svgRect.height * 0.25) {
          x1 = Math.min(x1, contextRect.left - 12);
        }
      }
    }

    if (selectionKind === "country") {
      x0 += 4;
      y0 += 4;
      x1 -= 4;
      y1 -= 4;
    }

    if (x1 - x0 < 180 || y1 - y0 < 140) {
      return SGP_MAP_FULL_FOCUS;
    }

    const scaleX = SGP_MAP_WIDTH / svgRect.width;
    const scaleY = SGP_MAP_HEIGHT / svgRect.height;
    return clampMapFocusRect({
      x0: (x0 - svgRect.left) * scaleX,
      y0: (y0 - svgRect.top) * scaleY,
      x1: (x1 - svgRect.left) * scaleX,
      y1: (y1 - svgRect.top) * scaleY
    });
  }, []);

  const fitCoverageFor = useCallback((selectionKind: SelectionKind) => {
    if (selectionKind === "country") return 0.9;
    if (selectionKind === "region") return 0.96;
    return 0.98;
  }, []);

  const resolveTransformForFeatures = useCallback(
    (features: WorldFeature[], selectionKind: SelectionKind) => {
      const focusRect = getFocusRect(selectionKind);
      const targetFeatures = features.length ? features : geo.features as WorldFeature[];
      const fitted = fitMapTransformForFeatures(targetFeatures, pathGen as SgpGeoPath, focusRect, fitCoverageFor(selectionKind));
      const bounds = collectMapFeatureBounds(targetFeatures, pathGen as SgpGeoPath);
      const xBias = selectionKind === "region" ? 0.02 : selectionKind === "country" ? 0 : 0.01;
      const yBias = selectionKind === "region" ? 0.26 : selectionKind === "country" ? 0.08 : 0;
      return clampMapTransform(alignMapBoundsInFocusRect(fitted, bounds, focusRect, xBias, yBias));
    },
    [fitCoverageFor, geo.features, getFocusRect, pathGen]
  );

  const zoomBy = useCallback(
    (factor: number, anchorX = SGP_MAP_WIDTH / 2, anchorY = SGP_MAP_HEIGHT / 2, animate = false) => {
      const next = scaleMapAroundPoint(viewTransformRef.current, factor, anchorX, anchorY);
      if (animate) {
        animateToTransform(next, SGP_MAP_BUTTON_ZOOM_MS);
      } else {
        applyTransform(next);
      }
    },
    [animateToTransform, applyTransform]
  );

  const resetView = useCallback(() => {
    onMapReset?.();
    animateToTransform(resolveTransformForFeatures(portfolioFeatures, "global"), SGP_MAP_RESET_MS);
  }, [animateToTransform, onMapReset, portfolioFeatures, resolveTransformForFeatures]);

  useEffect(() => {
    const target =
      selectedCountryFeatures.length > 0
        ? resolveTransformForFeatures(selectedCountryFeatures, "country")
        : selectedRegions.length > 0
          ? resolveTransformForFeatures(portfolioFeatures, "region")
          : resolveTransformForFeatures(portfolioFeatures, "global");
    animateToTransform(target, selectedCountryFeatures.length > 0 ? SGP_MAP_COUNTRY_FIT_MS : selectedRegions.length > 0 ? SGP_MAP_REGION_FIT_MS : SGP_MAP_GLOBAL_FIT_MS);
  }, [animateToTransform, portfolioFeatures, resizeRevision, resolveTransformForFeatures, selectedCountryFeatures, selectedRegions.length]);

  useEffect(() => {
    applyTransform(viewTransformRef.current);
  }, [applyTransform, geo.features, pathGen]);

  useEffect(() => {
    const onResize = () => {
      window.setTimeout(() => setResizeRevision((current) => current + 1), 120);
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimation();
    };
  }, [cancelAnimation]);

  useEffect(() => {
    return () => {
      if (tooltipFrameRef.current !== null) {
        window.cancelAnimationFrame(tooltipFrameRef.current);
      }
    };
  }, []);

  const handleWheel = useCallback(
    (event: WheelEvent<SVGSVGElement>) => {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * SGP_MAP_WIDTH;
      const y = ((event.clientY - rect.top) / rect.height) * SGP_MAP_HEIGHT;
      zoomBy(Math.exp(-event.deltaY * SGP_MAP_WHEEL_SENSITIVITY), x, y, false);
    },
    [zoomBy]
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (event.pointerType === "touch" || event.button !== 0) return;
      event.preventDefault();
      cancelAnimation();
      const rect = event.currentTarget.getBoundingClientRect();
      const target = event.target instanceof Element ? event.target.closest("path.country") : null;
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        width: rect.width,
        height: rect.height,
        startTransform: { ...viewTransformRef.current },
        targetIso3: target instanceof SVGPathElement ? target.dataset.iso3 ?? null : null,
        targetSelectable: target instanceof SVGPathElement && target.classList.contains("selectable"),
        targetSelected: target instanceof SVGPathElement && target.classList.contains("selected"),
        targetOutsideFilter: target instanceof SVGPathElement && target.classList.contains("outside-filter")
      };
      suppressClickRef.current = false;
      setIsDraggingMap(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [cancelAnimation]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dxPx = event.clientX - drag.startX;
      const dyPx = event.clientY - drag.startY;
      if (Math.hypot(dxPx, dyPx) > SGP_MAP_DRAG_THRESHOLD) {
        suppressClickRef.current = true;
      }
      applyTransform({
        scale: drag.startTransform.scale,
        tx: drag.startTransform.tx + (dxPx / drag.width) * SGP_MAP_WIDTH,
        ty: drag.startTransform.ty + (dyPx / drag.height) * SGP_MAP_HEIGHT
      });
    },
    [applyTransform]
  );

  const handlePointerEnd = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const clickedIso3 = !suppressClickRef.current ? drag.targetIso3 : null;
      dragStateRef.current = null;
      setIsDraggingMap(false);
      if (suppressClickRef.current) {
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
        return;
      }
      const clickAction = resolveMapCountryClickAction(
        {
          iso3: clickedIso3,
          selectable: drag.targetSelectable,
          selected: drag.targetSelected,
          outsideFilter: drag.targetOutsideFilter
        },
        selectedCountries.length
      );
      if (clickAction.type === "toggle") {
        onCountryToggle(clickAction.iso3);
      } else if (clickAction.type === "reset-country") {
        onCountryReset?.();
      }
    },
    [onCountryReset, onCountryToggle, selectedCountries.length]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomBy(SGP_MAP_ZOOM_STEP, SGP_MAP_WIDTH / 2, SGP_MAP_HEIGHT / 2, true);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomBy(1 / SGP_MAP_ZOOM_STEP, SGP_MAP_WIDTH / 2, SGP_MAP_HEIGHT / 2, true);
      } else if (event.key === "0" || event.key === "Escape") {
        event.preventDefault();
        resetView();
      }
    },
    [resetView, zoomBy]
  );

  return (
    <section className="visual-module map-panel">
      <div className="panel-heading">
        <div>
          <h2>World map</h2>
          <small>Zoom fits selected countries first, regions second, and the current portfolio globally.</small>
        </div>
      </div>
      <div className={["map-frame", isDraggingMap ? "is-dragging" : ""].filter(Boolean).join(" ")} tabIndex={0} onKeyDown={handleKeyDown} aria-label="Interactive map viewport">
        <div className="map-nav-tools" aria-label="Map tools">
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(SGP_MAP_ZOOM_STEP, SGP_MAP_WIDTH / 2, SGP_MAP_HEIGHT / 2, true)} data-tooltip="Zoom in to inspect smaller country geometries and clustered regions.">
            <ZoomIn size={16} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / SGP_MAP_ZOOM_STEP, SGP_MAP_WIDTH / 2, SGP_MAP_HEIGHT / 2, true)} data-tooltip="Zoom out to restore wider geographic context around the current portfolio.">
            <ZoomOut size={16} aria-hidden="true" />
          </button>
        </div>
        <svg
          ref={svgRef}
          className="map-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="application"
          aria-label={`Interactive world map by ${metricLabels[metric]}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onPointerLeave={() => onCountryHover?.(null)}
        >
          <path d={pathGen({ type: "Sphere" }) ?? undefined} fill="none" />
          <g ref={mapGroupRef} className="map-transform-group" transform={mapTransformString(SGP_MAP_IDENTITY)}>
            {geo.features.map((feature) => {
              const iso3 = String(feature.properties?.iso3 ?? "");
              const row = dataByIso.get(iso3);
              const selectableRow = selectableDataByIso.get(iso3);
              const displayRow = row ?? selectableRow;
              const value = row ? metricValue(row, metric) : 0;
              const selected = selectedCountries.includes(iso3);
              const selectable = Boolean(selectableRow);
              const hasActiveValue = value > 0;
              const isOutsideActiveFilter = !row && selectable;
              const countryFill = hasActiveValue ? colorForValue(Math.max(value, 1)) : "#F1EFE8";
              return (
                <path
                  key={iso3}
                  data-iso3={iso3}
                  d={pathGen(feature) ?? undefined}
                  className={[
                    "country",
                    selectable ? "selectable" : "",
                    hasActiveValue ? "has-data" : "",
                    isOutsideActiveFilter ? "outside-filter" : "",
                    !selectable ? "no-data" : "",
                    selected ? "selected" : ""
                  ].filter(Boolean).join(" ")}
                  fill={countryFill}
                  onMouseEnter={() => selectable && onCountryHover?.(iso3)}
                  onMouseMove={(event) => {
                    if (!selectable) return;
                    const topFocal = displayRow?.label ?? String(feature.properties?.name ?? iso3);
                    showTooltip({
                      x: event.clientX,
                      y: event.clientY,
                      text: row
                        ? `${topFocal}: ${metricFormat(metric, value)} | ${row.projectRecords} records | ${metricFormat("grantAmount", row.grantAmount)} grants`
                        : `${topFocal}: has SGP records, but no records match the active geography filter.`
                    });
                  }}
                  onMouseLeave={() => {
                    clearTooltip();
                    onCountryHover?.(null);
                  }}
                  onDoubleClick={() => selectable && onCountryProfileOpen(iso3)}
                  onFocus={() => selectable && onCountryHover?.(iso3)}
                  onBlur={() => onCountryHover?.(null)}
                  onKeyDown={(event) => {
                    if (!selectable || (event.key !== "Enter" && event.key !== " ")) return;
                    event.preventDefault();
                    onCountryToggle(iso3);
                  }}
                  tabIndex={selectable ? 0 : -1}
                  aria-label={selectable ? `Select ${displayRow?.label ?? iso3}` : undefined}
                />
              );
            })}
          </g>
        </svg>
        <section className="map-legend-card map-legend-card--choropleth" aria-label={legendTitle}>
          <div className="map-legend-card__head">
            <span>{legendTitle}</span>
            <label className="map-legend-indicator">
              <select value={metric} onChange={(event) => onMetricChange(event.target.value as MetricKey)} aria-label="Map indicator" data-tooltip={`${metricLabels[metric]} is the country-level metric used for the choropleth color scale.`}>
                {mapMetricOptions.map((item) => (
                  <option value={item} key={item}>{metricLabels[item]}</option>
                ))}
              </select>
            </label>
          </div>
          {legendHistogram.length > 0 && (
            <div className={`map-legend-scale ${showGrantDistribution ? "map-legend-scale--grants" : ""}`} aria-label={legendScaleLabel}>
              <div className="map-legend-histogram">
                {legendHistogram.map((bin) => (
                  <span
                    key={bin.index}
                    aria-label={bin.label}
                    data-tooltip={bin.label}
                    style={
                      {
                        "--bar-color": bin.color,
                        "--bar-height": `${bin.height}%`,
                        "--bar-opacity": bin.count ? 1 : 0.34
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
              <div className="map-legend-ticks" aria-hidden="true">
                {legendTicks.map((tick, index) => (
                  <span key={`${tick}-${index}`}>{tick}</span>
                ))}
              </div>
            </div>
          )}
        </section>
        {tooltip && (
          <div className="floating-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}>
            {tooltip.text}
          </div>
        )}
      </div>
      <details className="map-legend-card" open>
        <summary data-tooltip="Indicator notes describe the current choropleth scale and map interaction model.">Indicator and interaction</summary>
        <div className="map-legend">
          <span>Low</span>
          <i />
          <span>High</span>
        </div>
        <p>Country color reflects the selected indicator. Missing-data countries are intentionally muted; outside-filter countries remain visible for geographic context.</p>
      </details>
    </section>
  );
}

export const WorldChoropleth = memo(WorldChoroplethComponent);
