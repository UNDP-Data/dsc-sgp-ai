import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  Download,
  FileArchive,
  FileJson,
  FileText,
  Filter,
  Globe2,
  RefreshCcw,
  Search,
  Share2,
  X,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import * as d3 from "d3";
import { memo, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WorldChoropleth, type WorldGeo } from "./components/WorldChoropleth";
import { computeProjectMetrics, metricValue } from "./lib/aggregation/metrics";
import { buildRuntimeAggregates } from "./lib/aggregation/aggregateData";
import { planLocalQuery, type AiQueryPlan, type AllowedFilterValues } from "./lib/ai/localQueryPlanner";
import { metricLabels, moneyMetrics, sgpRegionOptions, sgpViewTabs } from "./lib/dashboard/config";
import { COUNTRY_GROUP_LABELS, COUNTRY_GROUP_OPTIONS, countryGroupContains } from "./lib/data/countryGroups";
import { loadDataBundle, loadWorldGeo } from "./lib/data/loaders";
import type {
  AggregateRow,
  CofinancingRecord,
  ContentProfile,
  DataBundle,
  MetricKey,
  PortfolioMetrics,
  ProjectRecord
} from "./lib/data/schema";
import { downloadText, toCsv } from "./lib/download/exportCsv";
import { applyFilters, warmProjectFilterCaches } from "./lib/filters/applyFilters";
import { type DashboardFilters } from "./lib/filters/filterTypes";
import { useDashboardStore, type DashboardView, type ThemeMode } from "./lib/filters/filterStore";
import { filtersFromSearch, filtersToSearch } from "./lib/filters/urlState";
import { categoricalPaletteForScheme, focalAreaColor } from "./lib/viz/color";
import { getColorScheme } from "./lib/viz/colorSchemes";
import { formatMoney, formatNumber } from "./lib/viz/formatters";

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3;
}

function isDefaultFilters(filters: DashboardFilters) {
  return filtersToSearch(filters) === "";
}

function hasVisibleFocalArea(value: string | null | undefined): value is string {
  const normalized = (value ?? "").trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]+/g, "");
  return compact.length > 0 && !["missing", "na", "null", "undefined"].includes(compact);
}

function visibleFocalRows(rows: AggregateRow[]) {
  return rows.filter((row) => hasVisibleFocalArea(row.label) && hasVisibleFocalArea(row.key));
}

function isSingleValueSelection(values: string[], value: string) {
  return values.length === 1 && values[0] === value;
}

function topValues<T>(items: T[], getter: (item: T) => string | null | undefined, limit = 40) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = getter(item) || "Missing";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function projectYearDomain(projects: ProjectRecord[]): [number, number] {
  const years = projects
    .map((project) => project.startYear)
    .filter((year): year is number => Number.isFinite(year));
  if (!years.length) return [1992, 2026];
  return [Math.min(...years), Math.max(...years)];
}

function GlobalTooltip() {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const nextTooltipRef = useRef<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const show = (text: string, x: number, y: number) => {
      nextTooltipRef.current = {
        text,
        x: clampNumber(x, 96, Math.max(96, window.innerWidth - 96)),
        y: clampNumber(y, 72, Math.max(72, window.innerHeight - 24))
      };
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        setTooltip(nextTooltipRef.current);
      });
    };
    const readTooltip = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null;
      const element = target.closest("[data-tooltip], button[aria-label], [role='button'][aria-label], input[aria-label], select[aria-label], summary[aria-label]");
      if (!element) return null;
      const text =
        element.getAttribute("data-tooltip")?.trim() ||
        element.getAttribute("aria-label")?.trim();
      return text ? { element, text } : null;
    };
    const positionFromElement = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top
      };
    };
    const showFromPointer = (event: PointerEvent) => {
      const match = readTooltip(event.target);
      if (!match) return;
      show(match.text, event.clientX, event.clientY);
    };
    const showFromFocus = (event: FocusEvent) => {
      const match = readTooltip(event.target);
      if (!match) return;
      const position = positionFromElement(match.element);
      show(match.text, position.x, position.y);
    };
    const move = (event: PointerEvent) => {
      const match = readTooltip(event.target);
      if (!match) return;
      show(match.text, event.clientX, event.clientY);
    };
    const hide = () => {
      nextTooltipRef.current = null;
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setTooltip(null);
    };

    document.addEventListener("pointerover", showFromPointer, true);
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerout", hide, true);
    document.addEventListener("focusin", showFromFocus, true);
    document.addEventListener("focusout", hide, true);
    return () => {
      document.removeEventListener("pointerover", showFromPointer, true);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerout", hide, true);
      document.removeEventListener("focusin", showFromFocus, true);
      document.removeEventListener("focusout", hide, true);
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  if (!tooltip || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="global-tooltip"
      role="tooltip"
      style={{
        left: tooltip.x,
        top: tooltip.y
      }}
    >
      {tooltip.text}
    </div>,
    document.body
  );
}

function metricRowFromProjects(key: string, label: string, projects: ProjectRecord[], cofinancing: CofinancingRecord[]): AggregateRow {
  const metrics = computeProjectMetrics(projects, cofinancing, { includeMedianGrant: false });
  const cofinancingTotal = metrics.cofinancingTotal ?? 0;
  return {
    key,
    label,
    projectRecords: metrics.projectRecords ?? 0,
    uniqueProjectNumbers: metrics.uniqueProjectNumbers ?? 0,
    countries: metrics.countries ?? 0,
    grantAmount: metrics.grantAmount ?? 0,
    cofinancingCash: metrics.cofinancingCash ?? 0,
    cofinancingKind: metrics.cofinancingKind ?? 0,
    cofinancingTotal,
    totalInvestment: metrics.totalInvestment ?? 0,
    averageGrant: metrics.averageGrant,
    medianGrant: metrics.medianGrant,
    cofinancingLeverage: metrics.cofinancingLeverage,
    activeProjects: metrics.activeProjects ?? 0,
    completedProjects: metrics.completedProjects ?? 0,
    terminatedProjects: metrics.terminatedProjects ?? 0,
    cofinancingRows: metrics.cofinancingRows ?? 0,
    cofinancingPartnerCount: metrics.cofinancingPartnerCount ?? 0,
    cashShareOfCofinancing: cofinancingTotal > 0 ? (metrics.cofinancingCash ?? 0) / cofinancingTotal : null,
    inKindShareOfCofinancing: cofinancingTotal > 0 ? (metrics.cofinancingKind ?? 0) / cofinancingTotal : null
  };
}

function buildCountryGroupRows(projects: ProjectRecord[], cofinancing: CofinancingRecord[]) {
  const projectsByGroup = new Map<string, ProjectRecord[]>();
  const cofinancingByGroup = new Map<string, CofinancingRecord[]>();
  const groupsByProjectNumber = new Map<string, Set<string>>();

  for (const option of COUNTRY_GROUP_OPTIONS) {
    projectsByGroup.set(option.key, []);
    cofinancingByGroup.set(option.key, []);
  }

  for (const project of projects) {
    for (const option of COUNTRY_GROUP_OPTIONS) {
      if (!countryGroupContains(option.key, project.countryIso3)) continue;
      projectsByGroup.get(option.key)!.push(project);
      let groups = groupsByProjectNumber.get(project.projectNumberNormalized);
      if (!groups) {
        groups = new Set<string>();
        groupsByProjectNumber.set(project.projectNumberNormalized, groups);
      }
      groups.add(option.key);
    }
  }

  for (const row of cofinancing) {
    const groups = groupsByProjectNumber.get(row.projectNumberNormalized);
    if (!groups) continue;
    for (const group of groups) {
      cofinancingByGroup.get(group)!.push(row);
    }
  }

  return COUNTRY_GROUP_OPTIONS.map((option) =>
    metricRowFromProjects(option.key, option.label, projectsByGroup.get(option.key) ?? [], cofinancingByGroup.get(option.key) ?? [])
  ).filter((row) => row.projectRecords > 0);
}

function useData() {
  const [bundle, setBundle] = useState<DataBundle | null>(null);
  const [geo, setGeo] = useState<WorldGeo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadDataBundle(), loadWorldGeo()])
      .then(([data, worldGeo]) => {
        if (!alive) return;
        setBundle(data);
        setGeo(worldGeo as WorldGeo);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, []);

  return { bundle, geo, error };
}

function MultiFacet({
  title,
  values,
  selected,
  onChange,
  searchable = false,
  limit = 18
}: {
  title: string;
  values: Array<{ value: string; count: number; label?: string; group?: string }>;
  selected: string[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
  limit?: number;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const normalizedQuery = query.toLowerCase();
    return values
      .filter((item) => (item.label ?? item.value).toLowerCase().includes(normalizedQuery))
      .slice(0, limit);
  }, [limit, query, values]);
  const groupedShown = useMemo(() => {
    const groups = new Map<string, typeof shown>();
    for (const item of shown) {
      const group = item.group ?? "";
      const groupItems = groups.get(group);
      if (groupItems) {
        groupItems.push(item);
      } else {
        groups.set(group, [item]);
      }
    }
    return [...groups.entries()];
  }, [shown]);
  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };
  return (
    <div className="facet-block">
      <div className="facet-title">{title}</div>
      {searchable && (
        <label className="mini-search" data-tooltip={`${title} options are generated from the current data scope; visible counts reflect matching rows.`}>
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Find ${title.toLowerCase()}`} data-tooltip={`${title} option labels can be searched locally within the current option list.`} />
        </label>
      )}
      <div className="facet-list">
        {groupedShown.map(([group, groupItems]) => (
          <div className="facet-option-group" key={group || "ungrouped"}>
            {group && <span className="facet-option-group__label">{group}</span>}
            {groupItems.map((item) => (
              <label
                className="facet-option"
                key={item.value}
                data-tooltip={`${title}: ${item.label ?? item.value}. ${formatNumber(item.count)} matching rows in the current option universe.${selected.includes(item.value) ? " Currently active." : ""}`}
              >
                <input type="checkbox" checked={selected.includes(item.value)} onChange={() => toggle(item.value)} />
                <span>{item.label ?? item.value}</span>
                <em>{formatNumber(item.count)}</em>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function RangeInput({
  title,
  value,
  onChange,
  minPlaceholder,
  maxPlaceholder
}: {
  title: string;
  value: [number | null, number | null];
  onChange: (value: [number | null, number | null]) => void;
  minPlaceholder?: string;
  maxPlaceholder?: string;
}) {
  return (
    <div className="facet-block">
      <div className="facet-title">{title}</div>
      <div className="range-row">
        <input
          aria-label={`${title} minimum`}
          data-tooltip={`Minimum ${title.toLowerCase()} boundary. Empty means no lower bound for this numeric dimension.`}
          placeholder={minPlaceholder ?? "Min"}
          value={value[0] ?? ""}
          type="number"
          onChange={(event) => onChange([event.target.value ? Number(event.target.value) : null, value[1]])}
        />
        <input
          aria-label={`${title} maximum`}
          data-tooltip={`Maximum ${title.toLowerCase()} boundary. Empty means no upper bound for this numeric dimension.`}
          placeholder={maxPlaceholder ?? "Max"}
          value={value[1] ?? ""}
          type="number"
          onChange={(event) => onChange([value[0], event.target.value ? Number(event.target.value) : null])}
        />
      </div>
    </div>
  );
}

function FilterStudio({
  projects,
  cofinancing,
  filters,
  onChange,
  onReset,
  showYearRange = true,
  showFocalArea = true,
  variant = "default",
  sectionsOpen = false,
  showResetButton = true
}: {
  projects: ProjectRecord[];
  cofinancing: CofinancingRecord[];
  filters: DashboardFilters;
  onChange: (patch: Partial<DashboardFilters>) => void;
  onReset: () => void;
  showYearRange?: boolean;
  showFocalArea?: boolean;
  variant?: "default" | "advanced-menu";
  sectionsOpen?: boolean;
  showResetButton?: boolean;
}) {
  const countryValues = useMemo(() => {
    const labels = new Map<string, string>();
    for (const project of projects) {
      const key = project.countryIso3 ?? project.countryName;
      if (key && !labels.has(key)) labels.set(key, project.countryName);
    }
    return topValues(projects, (project) => project.countryIso3 ?? project.countryName, 200).map((item) => ({
      ...item,
      label: labels.get(item.value) ?? item.value
    }));
  }, [projects]);
  const regionValues = useMemo(() => {
    const bureauValues = topValues(projects, (project) => project.regionId).map((item) => ({ ...item, group: "UNDP regions" }));
    const groupValues = COUNTRY_GROUP_OPTIONS.map((option) => ({
      value: option.key,
      label: option.label,
      group: option.group,
      count: projects.filter((project) => countryGroupContains(option.key, project.countryIso3)).length
    })).filter((item) => item.count > 0);
    return [...bureauValues, ...groupValues];
  }, [projects]);
  const cofinancerCountryValues = useMemo(() => topValues(cofinancing, (row) => row.companyCountryIso3 ?? row.companyCountryName, 80), [cofinancing]);
  const focalAreaValues = useMemo(() => topValues(projects, (project) => project.focalArea).filter((item) => hasVisibleFocalArea(item.value)), [projects]);
  const statusGroupValues = useMemo(() => topValues(projects, (project) => project.statusGroup), [projects]);
  const fundingSourceValues = useMemo(() => topValues(projects, (project) => project.fundingSource || "Missing"), [projects]);
  const projectCategoryValues = useMemo(() => topValues(projects, (project) => project.projectCategory || "Missing"), [projects]);
  const institutionalTypeValues = useMemo(() => topValues(projects, (project) => project.institutionalType || "Missing"), [projects]);
  const cofinancerTypeValues = useMemo(() => topValues(cofinancing, (row) => row.companyType || "Missing"), [cofinancing]);

  const isAdvancedMenu = variant === "advanced-menu";
  const sectionProps = sectionsOpen ? { open: true } : {};

  return (
    <section className={["filter-studio", isAdvancedMenu ? "filter-studio--advanced-menu" : ""].filter(Boolean).join(" ")} aria-label="Filter Studio">
      <div className="control-heading">
        <div>
          <span className="eyebrow">{isAdvancedMenu ? "Refine" : "Controls"}</span>
          <h2>{isAdvancedMenu ? "Advanced filters" : "Filter the portfolio"}</h2>
          {isAdvancedMenu && <p>Use these secondary dimensions when the region, theme, and grant-year controls are not specific enough.</p>}
        </div>
        {showResetButton && (
          <button className="icon-button" onClick={onReset} data-tooltip="The global portfolio baseline has no active dashboard filters." aria-label="Reset filters">
            <RefreshCcw size={17} />
          </button>
        )}
      </div>

      <details className="filter-section" {...sectionProps}>
        <summary data-tooltip="Geography filters scope project country, SGP region, and cofinancer country dimensions.">Geography</summary>
        <MultiFacet title="Region" values={regionValues} selected={filters.regions} onChange={(regions) => onChange({ regions })} limit={80} />
        <MultiFacet title="Country" values={countryValues} selected={filters.countries} onChange={(countries) => onChange({ countries })} searchable />
        <MultiFacet
          title="Cofinancer country"
          values={cofinancerCountryValues}
          selected={filters.cofinancerCountries}
          onChange={(cofinancerCountries) => onChange({ cofinancerCountries })}
          searchable
        />
      </details>

      <details className="filter-section" {...sectionProps}>
        <summary data-tooltip="Portfolio dimensions describe project-level categories from the authoritative project table.">Portfolio dimensions</summary>
        {showFocalArea && <MultiFacet title="Focal area" values={focalAreaValues} selected={filters.focalAreas} onChange={(focalAreas) => onChange({ focalAreas })} />}
        <MultiFacet title="Status group" values={statusGroupValues} selected={filters.statusGroups} onChange={(statusGroups) => onChange({ statusGroups })} />
        <MultiFacet title="Funding source" values={fundingSourceValues} selected={filters.fundingSources} onChange={(fundingSources) => onChange({ fundingSources })} searchable />
        <MultiFacet title="Project category" values={projectCategoryValues} selected={filters.projectCategories} onChange={(projectCategories) => onChange({ projectCategories })} />
      </details>

      <details className="filter-section" {...sectionProps}>
        <summary data-tooltip="Organization filters describe grantee institutions and cofinancing partner classifications.">Organizations</summary>
        <MultiFacet title="Institutional type" values={institutionalTypeValues} selected={filters.institutionalTypes} onChange={(institutionalTypes) => onChange({ institutionalTypes })} />
        <MultiFacet title="Cofinancer type" values={cofinancerTypeValues} selected={filters.cofinancerTypes} onChange={(cofinancerTypes) => onChange({ cofinancerTypes })} />
      </details>

      <details className="filter-section" {...sectionProps}>
        <summary data-tooltip="Time and finance filters bound grant years, grant size, cofinancing totals, and grant type.">Time and finance</summary>
        {showYearRange && <RangeInput title="Start year" value={filters.startYearRange} onChange={(startYearRange) => onChange({ startYearRange })} minPlaceholder="1992" maxPlaceholder="2026" />}
        <RangeInput title="Grant amount" value={filters.grantAmountRange} onChange={(grantAmountRange) => onChange({ grantAmountRange })} />
        <RangeInput title="Cofinancing total" value={filters.cofinancingTotalRange} onChange={(cofinancingTotalRange) => onChange({ cofinancingTotalRange })} />
        <div className="segmented-control" role="group" aria-label="Full grant filter">
          <button className={filters.fullGrant == null ? "active" : ""} onClick={() => onChange({ fullGrant: null })} data-tooltip="Includes both full grants and planning grant records.">All</button>
          <button className={filters.fullGrant === true ? "active" : ""} onClick={() => onChange({ fullGrant: true })} data-tooltip="Full grants are implementation grant records in the project table.">Full</button>
          <button className={filters.fullGrant === false ? "active" : ""} onClick={() => onChange({ fullGrant: false })} data-tooltip="Planning grants are preparatory grant records in the project table.">Planning</button>
        </div>
      </details>
    </section>
  );
}

function ActiveChips({
  filters,
  onChange,
  className = "",
  emptyLabel = "No active filters",
  yearDomain
}: {
  filters: DashboardFilters;
  onChange: (patch: Partial<DashboardFilters>) => void;
  className?: string;
  emptyLabel?: string | null;
  yearDomain?: [number, number];
}) {
  const chips: Array<{ label: string; remove: () => void }> = [];
  const addArray = (key: keyof DashboardFilters, label: string, formatValue: (value: string) => string = (value) => value) => {
    const values = filters[key] as string[];
    values.forEach((value) => chips.push({ label: `${label}: ${formatValue(value)}`, remove: () => onChange({ [key]: values.filter((item) => item !== value) } as Partial<DashboardFilters>) }));
  };
  addArray("countries", "Country");
  addArray("regions", "Region", (value) => COUNTRY_GROUP_LABELS.get(value) ?? value);
  addArray("focalAreas", "Focal area");
  addArray("statusGroups", "Status");
  addArray("cofinancerTypes", "Cofinancer");
  if (filters.text) chips.push({ label: `Search: ${filters.text}`, remove: () => onChange({ text: "" }) });
  if (filters.startYearRange[0] || filters.startYearRange[1]) {
    const [domainStart, domainEnd] = yearDomain ?? [1992, 2026];
    chips.push({
      label: `Years: ${filters.startYearRange[0] ?? domainStart}-${filters.startYearRange[1] ?? domainEnd}`,
      remove: () => onChange({ startYearRange: [null, null] })
    });
  }
  const classes = ["chip-ribbon", className].filter(Boolean).join(" ");
  if (!chips.length) return emptyLabel ? <div className={`${classes} muted`}>{emptyLabel}</div> : null;
  return (
    <div className={classes}>
      {chips.map((chip) => (
        <button className="filter-chip" key={chip.label} onClick={chip.remove} data-tooltip={`Active filter: ${chip.label}. This criterion is currently narrowing the portfolio.`}>
          {chip.label} <span aria-hidden="true">x</span>
        </button>
      ))}
    </div>
  );
}

function ExportMenu({ onExport }: { onExport: (kind: string) => void }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const items = [
    ["projects", "Filtered projects CSV", FileText],
    ["cofinancing", "Filtered cofinancing CSV", FileText],
    ["aggregate", "Current aggregates CSV", BarChart3],
    ["zip", "Filtered data ZIP", FileArchive],
    ["brief", "Briefing note Markdown", FileText],
    ["svg", "Current chart SVG", Download],
    ["png", "Dashboard PNG", Download],
    ["pdf", "Dashboard PDF", Download],
    ["share", "Copy share link", Share2],
    ["recipe", "Filter recipe JSON", FileJson]
  ] as const;
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLButtonElement>(".export-modal__item")?.focus();
    }, 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const exportDialog = open && typeof document !== "undefined"
    ? createPortal(
      <div className="export-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
        <div className="export-modal" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="export-modal-title">
          <div className="export-modal__head">
            <div>
              <span className="eyebrow">Download center</span>
              <h2 id="export-modal-title">Export dashboard</h2>
              <p>Save the current filtered view as data, image, document, or share recipe.</p>
            </div>
            <button className="icon-button export-modal__close" onClick={() => setOpen(false)} aria-label="Close export menu" data-tooltip="Export center overlay for the current filtered dashboard state.">
              <X size={16} />
            </button>
          </div>
          <div className="export-modal__grid">
            {items.map(([kind, label, Icon]) => (
              <button className="export-modal__item" key={kind} onClick={() => { onExport(kind); setOpen(false); }} data-tooltip={`${label} reflects the filters, active view, and processed dashboard data available in this session.`}>
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>,
      document.body
    )
    : null;

  return (
    <div className="export-menu">
      <button className="primary-button" onClick={() => setOpen(true)} aria-expanded={open} aria-haspopup="dialog" data-tooltip="Export outputs are generated from the current filtered portfolio and visible dashboard state.">
        <Download size={16} /> Export
      </button>
      {exportDialog}
    </div>
  );
}

function SgpKpiStrip({ metrics }: { metrics: PortfolioMetrics }) {
  const rows = [
    { id: "grants-count", label: "Grants", value: formatNumber(metrics.projectRecords ?? 0) },
    { id: "countries", label: "Countries", value: formatNumber(metrics.countries ?? 0) },
    { id: "grant-funding", label: "Grant funding", value: formatMoney(metrics.grantAmount ?? 0) },
    { id: "cofinancing", label: "Cofinancing", value: formatMoney(metrics.cofinancingTotal ?? 0) }
  ];
  return (
    <section className="kpi-strip" aria-label="Key performance indicators">
      {rows.map((row) => (
        <article className="kpi-card" key={row.id} data-tooltip={`${row.label}: ${row.value} in the current filtered view`}>
          <div className="kpi-label">{row.label}</div>
          <div className="kpi-value">{row.value}</div>
        </article>
      ))}
    </section>
  );
}

function SgpRegionTabs({
  selectedRegions,
  rows,
  onSelect
}: {
  selectedRegions: string[];
  rows: AggregateRow[];
  onSelect: (region: string) => void;
}) {
  const regionByKey = new Map(rows.map((row) => [row.key, row]));
  const bureauRegionKeys = new Set(sgpRegionOptions.filter((option) => option.group === "UNDP regions" && option.key !== "global").map((option) => option.key));
  const globalGrantValue = d3.sum(rows.filter((row) => bureauRegionKeys.has(row.key)), (item) => item.grantAmount);
  return (
    <div className="atlas-region-tabs atlas-region-tabs--intro" role="group" aria-label="Region filter">
      {sgpRegionOptions.map((option) => {
        const row = regionByKey.get(option.key);
        const isGlobal = option.key === "global";
        const active = isGlobal ? selectedRegions.length === 0 : selectedRegions.includes(option.key);
        const value = isGlobal ? globalGrantValue : row?.grantAmount ?? 0;
        const displayValue = isGlobal ? "All" : value ? formatMoney(value) : "0";
        return (
          <button
            key={option.key}
            type="button"
            className={["atlas-region-tab", option.className, active ? "is-active" : ""].filter(Boolean).join(" ")}
            onClick={() => onSelect(option.key)}
            data-tooltip={`${option.label}: ${value ? `${formatMoney(value)} grant funding in the selector baseline.` : "No grant funding in this selector baseline."}${active ? " Current regional scope." : ""}`}
          >
            <span className="atlas-region-tab__label">{option.label}</span>
            <span className="atlas-region-tab__meta">
              <span
                className="atlas-region-tab__bubble"
                aria-hidden="true"
                style={{ "--bubble-size": `${Math.max(9, Math.min(26, Math.sqrt(Math.max(value, 1)) / 1100))}px` } as CSSProperties}
              />
              <span className="atlas-region-tab__value">{displayValue}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SgpThemeRibbon({
  rows,
  availableRows,
  selectedFocalAreas,
  onSelect,
  colorSchemeId
}: {
  rows: AggregateRow[];
  availableRows: AggregateRow[];
  selectedFocalAreas: string[];
  onSelect: (focalArea: string) => void;
  colorSchemeId: ThemeMode;
}) {
  const availableByLabel = useMemo(() => new Map(visibleFocalRows(availableRows).map((row) => [row.label, row])), [availableRows]);
  const shown = useMemo(() => {
    const byLabel = new Map<string, AggregateRow>();
    for (const row of visibleFocalRows(rows)) {
      byLabel.set(row.label, row);
    }
    for (const row of visibleFocalRows(availableRows)) {
      if (!byLabel.has(row.label)) {
        byLabel.set(row.label, row);
      }
    }
    return [...byLabel.values()];
  }, [availableRows, rows]);
  return (
    <div className="atlas-theme-grid sgp-theme-grid" role="group" aria-label="Focal area filters">
      {shown.map((row) => {
        const active = selectedFocalAreas.includes(row.label);
        const availableRow = availableByLabel.get(row.label);
        const availableProjects = availableRow?.projectRecords ?? 0;
        const availableGrantAmount = availableRow?.grantAmount ?? 0;
        const available = availableProjects > 0;
        return (
          <button
            key={row.key}
            type="button"
            className={[
              active ? "is-active" : "",
              available ? "is-available is-highlighted" : "is-unavailable"
            ].filter(Boolean).join(" ")}
            onClick={() => onSelect(row.label)}
            style={{ "--theme-accent": focalAreaColor(row.label, colorSchemeId) } as CSSProperties}
            data-tooltip={available
              ? `${row.label}: ${formatNumber(availableProjects)} matching grants in the current view, ${formatMoney(availableGrantAmount)} grant funding.${active ? " Current thematic scope." : ""}`
              : `${row.label}: no matching grants in the current view.`}
          >
            <span className="atlas-theme-label">{row.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function selectedAdvancedFilterCount(filters: DashboardFilters) {
  const arrays: Array<keyof DashboardFilters> = [
    "countries",
    "regions",
    "statuses",
    "statusGroups",
    "operationalPhases",
    "fundingSources",
    "institutionalTypes",
    "projectCategories",
    "granteeNames",
    "cofinancerTypes",
    "cofinancerCountries",
    "cofinancerNames"
  ];
  const arrayCount = arrays.reduce((total, key) => total + ((filters[key] as string[]).length ?? 0), 0);
  const financeRangeCount = [filters.grantAmountRange, filters.cofinancingTotalRange].filter(
    ([min, max]) => min != null || max != null
  ).length;
  return arrayCount + financeRangeCount + (filters.fullGrant == null ? 0 : 1);
}

function SgpGrantYearControl({
  projects,
  value,
  onChange
}: {
  projects: ProjectRecord[];
  value: [number | null, number | null];
  onChange: (value: [number | null, number | null]) => void;
}) {
  const [domainMin, domainMax] = useMemo(() => {
    const years = projects.map((project) => project.startYear).filter((year): year is number => Number.isFinite(year));
    return [Math.min(...years, 1992), Math.max(...years, 2026)] as [number, number];
  }, [projects]);
  const normalizedValue = useMemo(() => {
    const nextLower = clampNumber(value[0] ?? domainMin, domainMin, domainMax);
    const nextUpper = clampNumber(value[1] ?? domainMax, domainMin, domainMax);
    return [Math.min(nextLower, nextUpper), Math.max(nextLower, nextUpper)] as [number, number];
  }, [domainMax, domainMin, value]);
  const [draftRange, setDraftRange] = useState<[number, number]>(normalizedValue);

  useEffect(() => {
    setDraftRange(normalizedValue);
  }, [normalizedValue]);

  const [lower, upper] = draftRange;
  const rangeSize = Math.max(1, domainMax - domainMin);
  const startPercent = ((Math.min(lower, upper) - domainMin) / rangeSize) * 100;
  const endPercent = ((Math.max(lower, upper) - domainMin) / rangeSize) * 100;
  const commitRange = (range = draftRange) => {
    const [nextLower, nextUpper] = range;
    const normalizedLower = clampNumber(Math.min(nextLower, nextUpper), domainMin, domainMax);
    const normalizedUpper = clampNumber(Math.max(nextLower, nextUpper), domainMin, domainMax);
    const nextValue: [number | null, number | null] = [
      normalizedLower === domainMin ? null : normalizedLower,
      normalizedUpper === domainMax ? null : normalizedUpper
    ];
    setDraftRange([normalizedLower, normalizedUpper]);
    if (nextValue[0] !== value[0] || nextValue[1] !== value[1]) {
      onChange(nextValue);
    }
  };
  const updateLowerDraft = (nextLower: number) => {
    setDraftRange((current) => [clampNumber(Math.min(nextLower, current[1]), domainMin, domainMax), current[1]]);
  };
  const updateUpperDraft = (nextUpper: number) => {
    setDraftRange((current) => [current[0], clampNumber(Math.max(nextUpper, current[0]), domainMin, domainMax)]);
  };

  return (
    <section className="sgp-year-control" aria-label="Grant year range">
      <div className="sgp-year-control__head">
        <span>Grant years</span>
        <strong>{lower} - {upper}</strong>
      </div>
      <div
        className="sgp-dual-slider"
        style={{
          "--range-start": `${startPercent}%`,
          "--range-end": `${100 - endPercent}%`
        } as CSSProperties}
      >
        <div className="sgp-dual-slider__track" aria-hidden="true">
          <span />
        </div>
        <input
          type="range"
          min={domainMin}
          max={domainMax}
          step={1}
          value={lower}
          aria-label="Minimum grant year"
          data-tooltip={`Lower grant-start-year boundary: ${lower}. The full available year domain starts at ${domainMin}.`}
          onChange={(event) => updateLowerDraft(Number(event.target.value))}
          onPointerUp={() => commitRange()}
          onPointerCancel={() => commitRange()}
          onKeyUp={() => commitRange()}
          onBlur={() => commitRange()}
        />
        <input
          type="range"
          min={domainMin}
          max={domainMax}
          step={1}
          value={upper}
          aria-label="Maximum grant year"
          data-tooltip={`Upper grant-start-year boundary: ${upper}. The full available year domain ends at ${domainMax}.`}
          onChange={(event) => updateUpperDraft(Number(event.target.value))}
          onPointerUp={() => commitRange()}
          onPointerCancel={() => commitRange()}
          onKeyUp={() => commitRange()}
          onBlur={() => commitRange()}
        />
      </div>
      <div className="sgp-year-control__foot">
        <span>{domainMin}</span>
        <span>{domainMax}</span>
      </div>
    </section>
  );
}

function SgpAdvancedFiltersPanel({
  projects,
  cofinancing,
  filters,
  onChange,
  onReset
}: {
  projects: ProjectRecord[];
  cofinancing: CofinancingRecord[];
  filters: DashboardFilters;
  onChange: (patch: Partial<DashboardFilters>) => void;
  onReset: () => void;
}) {
  const activeCount = selectedAdvancedFilterCount(filters);
  return (
    <details className="sgp-filter-popover sgp-filter-popover--advanced">
      <summary data-tooltip={`Advanced filters include geography groups, organization attributes, status, funding source, category, and finance ranges.${activeCount ? ` ${activeCount} advanced criteria active.` : ""}`}>
        <Filter size={14} />
        <span>Advanced Filters</span>
        {activeCount > 0 && <em>{activeCount}</em>}
      </summary>
      <FilterStudio
        projects={projects}
        cofinancing={cofinancing}
        filters={filters}
        onChange={onChange}
        onReset={onReset}
        showFocalArea={false}
        showYearRange={false}
        variant="advanced-menu"
        sectionsOpen
        showResetButton={false}
      />
    </details>
  );
}

function SgpFilterBand({
  projects,
  cofinancing,
  filters,
  onChange,
  onReset
}: {
  projects: ProjectRecord[];
  cofinancing: CofinancingRecord[];
  filters: DashboardFilters;
  onChange: (patch: Partial<DashboardFilters>) => void;
  onReset: () => void;
}) {
  return (
    <div className="atlas-filter-band" aria-label="Year and advanced filters">
      <SgpGrantYearControl projects={projects} value={filters.startYearRange} onChange={(startYearRange) => onChange({ startYearRange })} />
      <SgpAdvancedFiltersPanel projects={projects} cofinancing={cofinancing} filters={filters} onChange={onChange} onReset={onReset} />
    </div>
  );
}

function SgpFilterConsole({
  assistantControls,
  regionRows,
  selectedRegions,
  onRegionSelect,
  focalRows,
  availableFocalRows,
  selectedFocalAreas,
  onThemeSelect,
  projects,
  cofinancing,
  filters,
  onChange,
  onReset,
  colorSchemeId
}: {
  assistantControls?: ReactNode;
  regionRows: AggregateRow[];
  selectedRegions: string[];
  onRegionSelect: (region: string) => void;
  focalRows: AggregateRow[];
  availableFocalRows: AggregateRow[];
  selectedFocalAreas: string[];
  onThemeSelect: (focalArea: string | null) => void;
  projects: ProjectRecord[];
  cofinancing: CofinancingRecord[];
  filters: DashboardFilters;
  onChange: (patch: Partial<DashboardFilters>) => void;
  onReset: () => void;
  colorSchemeId: ThemeMode;
}) {
  return (
    <section className="atlas-filter-console" aria-label="Portfolio filters">
      <article className="atlas-filter-console__intro">
        <p className="atlas-figure-intro__kicker">UNDP GEF Small Grants Programme</p>
        <h1>SGP Grant Portfolio</h1>
        <p>Explore SGP projects through region, thematic, financial, partner, and record-level lenses.</p>
      </article>
      {assistantControls && <div className="atlas-filter-console__assistant">{assistantControls}</div>}
      <div className="atlas-filter-console__head">
        <div className="atlas-filter-console__title">
          <strong>Portfolio filters</strong>
        </div>
        <button className="atlas-filter-console__reset" type="button" onClick={onReset} data-tooltip="Global portfolio baseline: all records before dashboard filters are applied.">
          <RefreshCcw size={14} />
          Reset
        </button>
      </div>
      <div className="atlas-filter-console__body">
        <div className="atlas-filter-console__group atlas-filter-console__group--regions">
          <span className="atlas-filter-console__group-label">Regions</span>
          <SgpRegionTabs selectedRegions={selectedRegions} rows={regionRows} onSelect={onRegionSelect} />
        </div>
        <div className="atlas-filter-console__group atlas-filter-console__group--themes">
          <span className="atlas-filter-console__group-label">Thematics</span>
          <div className="atlas-theme-ribbon">
            <SgpThemeRibbon
              rows={focalRows}
              availableRows={availableFocalRows}
              selectedFocalAreas={selectedFocalAreas}
              onSelect={onThemeSelect}
              colorSchemeId={colorSchemeId}
            />
          </div>
          <SgpFilterBand projects={projects} cofinancing={cofinancing} filters={filters} onChange={onChange} onReset={onReset} />
        </div>
      </div>
    </section>
  );
}

function SgpViewTabs({ active, onChange }: { active: DashboardView; onChange: (view: DashboardView) => void }) {
  return (
    <div className="sgp-view-tabs" role="tablist" aria-label="Visualization views">
      {sgpViewTabs.map((tab) => (
        <button key={tab.key} type="button" className={active === tab.key ? "is-active" : ""} onClick={() => onChange(tab.key)} data-tooltip={`${tab.label} analysis: ${tab.caption}.${active === tab.key ? " Current context view." : ""}`}>
          <strong>{tab.label}</strong>
          <span>{tab.caption}</span>
        </button>
      ))}
    </div>
  );
}

function ProfileLinkList({ title, links, emptyLabel }: { title: string; links: ContentProfile["stories"]; emptyLabel: string }) {
  return (
    <section className="sgp-profile-section">
      <div className="sgp-profile-section__head">
        <h3>{title}</h3>
        <span>{formatNumber(links.length)}</span>
      </div>
      <div className="sgp-profile-links">
        {links.slice(0, 6).map((link) => (
          <a
            key={`${link.title}-${link.url}`}
            href={link.url || undefined}
            target="_blank"
            rel="noreferrer"
            className="sgp-profile-link"
            data-tooltip={`${link.title}${link.kind ? ` · ${link.kind}` : ""}${link.summary ? `. ${link.summary}` : ""}`}
          >
            {link.imageUrl && <img src={link.imageUrl} alt="" loading="lazy" />}
            <span>{link.title}</span>
          </a>
        ))}
        {!links.length && <p className="sgp-profile-empty">{emptyLabel}</p>}
      </div>
    </section>
  );
}

function SgpContentProfilePanel({
  profile,
  fallbackTitle,
  metrics
}: {
  profile: ContentProfile | null;
  fallbackTitle: string;
  metrics: PortfolioMetrics;
}) {
  if (!profile) {
    return (
      <section className="sgp-content-profile sgp-content-profile--empty" data-tooltip="Select one country or one thematic area to show the corresponding SGP website profile when scraper content is available.">
        <span className="eyebrow">Profile</span>
        <h2>{fallbackTitle}</h2>
        <p>Select a country on the map or choose a single thematic area to see the matching SGP website profile, publications, stories, voices, and snapshot metrics.</p>
        <div className="sgp-profile-metric-grid">
          <span><em>Grants</em><strong>{formatNumber(metrics.projectRecords ?? 0)}</strong></span>
          <span><em>Countries</em><strong>{formatNumber(metrics.countries ?? 0)}</strong></span>
          <span><em>Grant funding</em><strong>{formatMoney(metrics.grantAmount ?? 0)}</strong></span>
          <span><em>Cofinancing</em><strong>{formatMoney(metrics.cofinancingTotal ?? 0)}</strong></span>
        </div>
      </section>
    );
  }

  const sourceLabel = profile.type === "country" ? "Country programme" : "Area of work";
  const collections = profile.collections.filter((item) => item.count > 0 || item.url);
  const hasContacts = Boolean(profile.contacts?.some((contact) => contact.name || contact.email || contact.phone));
  return (
    <section className="sgp-content-profile" data-tooltip={`${sourceLabel} profile from the SGP scraper archive content, joined to the selected dashboard scope.`}>
      <div className="sgp-content-profile__hero">
        <span className="eyebrow">{sourceLabel}</span>
        <h2>{profile.title}</h2>
        {profile.summary && <p>{profile.summary}</p>}
        {profile.sourceUrl && (
          <a className="sgp-profile-source" href={profile.sourceUrl} target="_blank" rel="noreferrer" data-tooltip="Source SGP website page captured by the scraper archive.">
            Open SGP source
          </a>
        )}
      </div>

      {!!profile.metrics.length && (
        <section className="sgp-profile-metric-grid" aria-label="Scraped profile metrics">
          {profile.metrics.slice(0, 8).map((metric) => (
            <span key={`${metric.label}-${metric.value}`} data-tooltip={`${metric.label}: ${metric.value} from the SGP website profile snapshot.`}>
              <em>{metric.label}</em>
              <strong>{metric.value}</strong>
            </span>
          ))}
        </section>
      )}

      {!!collections.length && (
        <section className="sgp-profile-collections" aria-label="Profile content collections">
          {collections.map((collection) => (
            <a
              key={collection.key}
              href={collection.url || undefined}
              target="_blank"
              rel="noreferrer"
              data-tooltip={`${collection.label}: ${formatNumber(collection.count)} items observed in the scraper output.`}
            >
              <span>{collection.label}</span>
              <strong>{formatNumber(collection.count)}</strong>
            </a>
          ))}
        </section>
      )}

      {profile.featured && (
        <a className="sgp-profile-featured" href={profile.featured.url || undefined} target="_blank" rel="noreferrer" data-tooltip={profile.featured.summary || profile.featured.title}>
          <span>Featured</span>
          <strong>{profile.featured.title}</strong>
        </a>
      )}

      {hasContacts && (
        <section className="sgp-profile-section">
          <div className="sgp-profile-section__head">
            <h3>Contacts</h3>
            <span>{formatNumber(profile.contacts?.length ?? 0)}</span>
          </div>
          <div className="sgp-profile-contact-list">
            {profile.contacts?.map((contact, index) => (
              <span key={`${contact.name ?? "contact"}-${index}`} data-tooltip={[contact.role, contact.email, contact.phone].filter(Boolean).join(" · ")}>
                <strong>{contact.name || contact.role || "Programme contact"}</strong>
                <em>{contact.email || contact.phone || contact.role}</em>
              </span>
            ))}
          </div>
        </section>
      )}

      <ProfileLinkList title="Stories" links={profile.stories} emptyLabel="No story cards were present for this profile in the scraper output." />
      <ProfileLinkList title={profile.type === "area" ? "Case studies" : "Publications"} links={profile.type === "area" ? profile.caseStudies : profile.publications} emptyLabel="No publication or case-study links were present in the scraper output." />
      <ProfileLinkList title="Voices" links={profile.voices} emptyLabel="No voice/video items were present for this profile in the scraper output." />
    </section>
  );
}

function SgpAtlasContextCard({
  row,
  metrics,
  mode,
  profile,
  activeView,
  onViewChange,
  filteredProjects,
  aggregates,
  colorSchemeId,
  selectedFocalAreas,
  selectedYearRange,
  selectedCofinancerTypes,
  onThemeSelect,
  onYearThemeSelect,
  onCofinancerTypeSelect,
  onProject
}: {
  row: AggregateRow | null;
  metrics: PortfolioMetrics;
  mode: string;
  profile: ContentProfile | null;
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  filteredProjects: ProjectRecord[];
  aggregates: DataBundle["aggregates"];
  colorSchemeId: ThemeMode;
  selectedFocalAreas: string[];
  selectedYearRange: [number | null, number | null];
  selectedCofinancerTypes: string[];
  onThemeSelect: (focalArea: string | null) => void;
  onYearThemeSelect: (year: number, focalArea: string) => void;
  onCofinancerTypeSelect: (cofinancerType: string) => void;
  onProject: (rowId: string) => void;
}) {
  const viewMeta = sgpViewTabs.find((tab) => tab.key === activeView) ?? sgpViewTabs[0];
  const topCofinancerType = aggregates.byCofinancerType[0];
  const topCofinancerCountry = aggregates.byCofinancerCountry[0];
  return (
    <aside
      className={`atlas-context-card atlas-context-card--workspace atlas-context-card--${activeView} ${mode === "Hover preview" ? "atlas-context-card--preview" : ""}`}
      aria-label="Atlas context"
      data-tooltip="Atlas context panel summarizing the current geographic and filter scope across time, themes, finance, partners, and records."
    >
      <div className="sgp-mobile-sheet-head" aria-hidden="true">
        <span className="sgp-mobile-sheet-grip" />
        <div>
          <strong>{viewMeta.label}</strong>
          <span>{row?.label ?? "Global portfolio"}</span>
        </div>
      </div>

      <div className="sgp-context-head" data-tooltip={`${mode}: ${row?.label ?? "Global portfolio"}. Metrics and charts reflect the current active filters.`}>
        <div>
          <p className="atlas-figure-intro__kicker">SGP atlas context</p>
          <h2>{row?.label ?? "Global portfolio"}</h2>
        </div>
      </div>

      <SgpViewTabs active={activeView} onChange={onViewChange} />

      <div className={`sgp-context-tab-body sgp-context-tab-body--${activeView}`} aria-label={`${viewMeta.label} panel`} data-tooltip={`${viewMeta.label} view: ${viewMeta.caption}`}>
        {activeView === "profile" && (
          <SgpContentProfilePanel profile={profile} fallbackTitle={row?.label ?? "Global portfolio"} metrics={metrics} />
        )}

        {activeView === "trends" && (
          <div className="sgp-context-chart-stack">
            <TimeSeriesChart
              projects={filteredProjects}
              metric="projectRecords"
              colorSchemeId={colorSchemeId}
              selectedYearRange={selectedYearRange}
              selectedFocalAreas={selectedFocalAreas}
              onYearThemeSelect={onYearThemeSelect}
            />
          </div>
        )}

        {activeView === "themes" && (
          <div className="sgp-context-chart-stack">
            <ThemeDonutChart rows={aggregates.byFocalArea} selectedFocalAreas={selectedFocalAreas} onThemeSelect={onThemeSelect} colorSchemeId={colorSchemeId} />
          </div>
        )}

        {activeView === "finance" && (
          <div className="sgp-context-chart-stack">
            <ScatterChart projects={filteredProjects} onProject={onProject} colorSchemeId={colorSchemeId} />
            <section className="sgp-context-mini-grid" aria-label="Finance summary">
              <span data-tooltip="Average grant amount across the current filtered project rows">Average grant<strong>{formatMoney(metrics.averageGrant ?? 0)}</strong></span>
              <span data-tooltip="Cash cofinancing total from matching cofinancing records">Cash<strong>{formatMoney(metrics.cofinancingCash ?? 0)}</strong></span>
              <span data-tooltip="In-kind cofinancing total from matching cofinancing records">In-kind<strong>{formatMoney(metrics.cofinancingKind ?? 0)}</strong></span>
              <span data-tooltip="Total project-level cofinancing in the current filtered view">Cofinancing<strong>{formatMoney(metrics.cofinancingTotal ?? 0)}</strong></span>
            </section>
          </div>
        )}

        {activeView === "networks" && (
          <div className="sgp-context-chart-stack">
            <NetworkView
              rows={aggregates.byCofinancerType}
              selectedCofinancerTypes={selectedCofinancerTypes}
              onCofinancerTypeSelect={onCofinancerTypeSelect}
              colorSchemeId={colorSchemeId}
            />
            <section className="sgp-context-mini-grid" aria-label="Partner summary">
              <span data-tooltip="Number of cofinancing detail records matching the current filters">Partner rows<strong>{formatNumber(metrics.cofinancingRows ?? 0)}</strong></span>
              <span data-tooltip="Number of cofinancer type categories represented in the filtered view">Partner types<strong>{formatNumber(aggregates.byCofinancerType.length)}</strong></span>
              <span data-tooltip="Largest cofinancer type by total cofinancing in the filtered view">Top type<strong>{topCofinancerType?.label ?? "n/a"}</strong></span>
              <span data-tooltip="Largest cofinancer country by total cofinancing in the filtered view">Top country<strong>{topCofinancerCountry?.label ?? "n/a"}</strong></span>
            </section>
          </div>
        )}

        {activeView === "table" && (
          <div className="sgp-context-records">
            <ProjectTable projects={filteredProjects} onOpen={onProject} />
          </div>
        )}
      </div>
    </aside>
  );
}

const TimeSeriesChart = memo(function TimeSeriesChart({
  projects,
  metric,
  colorSchemeId,
  selectedYearRange,
  selectedFocalAreas,
  onYearThemeSelect
}: {
  projects: ProjectRecord[];
  metric: MetricKey;
  colorSchemeId: ThemeMode;
  selectedYearRange: [number | null, number | null];
  selectedFocalAreas: string[];
  onYearThemeSelect: (year: number, focalArea: string) => void;
}) {
  const width = 360;
  const height = 230;
  const margin = { top: 12, right: 8, bottom: 28, left: 34 };
  const chart = useMemo(() => {
    let minYear: number | undefined;
    let maxYear: number | undefined;
    for (const project of projects) {
      const year = project.startYear;
      if (year == null || !Number.isFinite(year)) continue;
      minYear = minYear == null ? year : Math.min(minYear, year);
      maxYear = maxYear == null ? year : Math.max(maxYear, year);
    }
    const years = minYear == null || maxYear == null ? [] : d3.range(minYear, maxYear + 1);
    const yearSet = new Set(years);
    const focalCounts = new Map<string, number>();
    for (const project of projects) {
      if (!hasVisibleFocalArea(project.focalArea)) continue;
      const focalArea = project.focalArea!;
      focalCounts.set(focalArea, (focalCounts.get(focalArea) ?? 0) + 1);
    }
    const focalAreas = [...focalCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([focalArea]) => focalArea);
    const focalSet = new Set(focalAreas);
    const dataByYear = new Map<number, Record<string, number>>();
    for (const year of years) {
      dataByYear.set(year, { year });
    }
    for (const project of projects) {
      const year = project.startYear;
      if (year == null || !dataByYear.has(year)) continue;
      if (!hasVisibleFocalArea(project.focalArea)) continue;
      const focalArea = project.focalArea!;
      if (!focalSet.has(focalArea)) continue;
      const row = dataByYear.get(year)!;
      row[focalArea] = (row[focalArea] ?? 0) + (metric === "projectRecords" ? 1 : Number((project as unknown as Record<string, number>)[metric]) || 0);
    }
    const data = years.map((year) => dataByYear.get(year)!);
    const stack = d3.stack<Record<string, number>>().keys(focalAreas)(data);
    const maxY = d3.max(stack, (layer) => d3.max(layer, (d) => d[1])) || 1;
    const tickCandidates = years.length <= 8 ? years : d3.ticks(minYear ?? 0, maxYear ?? 0, 5).map((year) => Math.round(year));
    const xTickYears = [...new Set([minYear, ...tickCandidates, maxYear].filter((year): year is number => year != null && yearSet.has(year)))].sort((a, b) => a - b);
    return { years, focalAreas, stack, maxY, xTickYears };
  }, [metric, projects]);
  const maxY = chart.maxY;
  const x = d3.scaleBand(chart.years.map(String), [margin.left, width - margin.right]).padding(0.12);
  const y = d3.scaleLinear([0, maxY], [height - margin.bottom, margin.top]).nice(4);
  const yTicks = y.ticks(4);
  const hasData = chart.years.length > 0 && chart.stack.some((layer) => layer.some((segment) => segment[1] > segment[0]));
  const activeSingleYear = selectedYearRange[0] != null && selectedYearRange[0] === selectedYearRange[1] ? selectedYearRange[0] : null;
  const selectedFocalSet = useMemo(() => new Set(selectedFocalAreas), [selectedFocalAreas]);
  return (
    <section className="visual-module" data-tooltip="Stacked yearly grant counts by focal area for the current filtered portfolio.">
      <div className="panel-heading" data-tooltip="Filtered grant records by start year, stacked by the leading focal areas in the current view."><h2>Portfolio trend</h2><small>Stacked by focal area</small></div>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Time series chart">
        <rect className="chart-plot-bg" x={margin.left} y={margin.top} width={width - margin.left - margin.right} height={height - margin.top - margin.bottom} rx={7} />
        {yTicks.map((tick) => (
          <g className="chart-axis-tick chart-axis-tick-y" key={tick} style={{ transform: `translate(0px, ${y(tick)}px)` }}>
            <line className="chart-gridline" x1={margin.left} x2={width - margin.right} y1={0} y2={0} />
            <text className="chart-tick chart-tick-y" x={margin.left - 6} y={3} textAnchor="end">{formatNumber(tick)}</text>
          </g>
        ))}
        {chart.stack.map((layer) => (
          <g key={layer.key} fill={focalAreaColor(layer.key, colorSchemeId)}>
            {layer.map((d) => {
              const xPosition = x(String(d.data.year)) ?? margin.left;
              const yPosition = y(d[1]);
              const segmentHeight = Math.max(0, y(d[0]) - y(d[1]));
              const value = d[1] - d[0];
              const isActive = activeSingleYear === d.data.year && selectedFocalSet.has(layer.key);
              const tooltip = `${layer.key} grants starting in ${d.data.year}: ${formatNumber(value)} grants in this segment.${isActive ? " Current time-thematic scope." : ""}`;
              return (
                <g
                  className={`chart-bar-segment ${isActive ? "is-active" : ""}`}
                  key={`${layer.key}-${d.data.year}`}
                  style={{ transform: `translate(${xPosition}px, ${yPosition}px)` }}
                >
                  <rect
                    width={x.bandwidth()}
                    height={segmentHeight}
                    role="button"
                    tabIndex={value > 0 ? 0 : -1}
                    aria-label={tooltip}
                    data-tooltip={tooltip}
                    onClick={() => value > 0 && onYearThemeSelect(d.data.year, layer.key)}
                    onKeyDown={(event) => {
                      if (value <= 0 || (event.key !== "Enter" && event.key !== " ")) return;
                      event.preventDefault();
                      onYearThemeSelect(d.data.year, layer.key);
                    }}
                  >
                  </rect>
                </g>
              );
            })}
          </g>
        ))}
        <line className="chart-axis-line" x1={margin.left} x2={width - margin.right} y1={height - margin.bottom} y2={height - margin.bottom} />
        <line className="chart-axis-line" x1={margin.left} x2={margin.left} y1={margin.top} y2={height - margin.bottom} />
        {chart.xTickYears.map((year) => (
          <g className="chart-axis-tick chart-axis-tick-x" key={year} style={{ transform: `translate(${(x(String(year)) ?? margin.left) + x.bandwidth() / 2}px, 0px)` }}>
            <text className="chart-tick" x={0} y={height - 10} textAnchor="middle">{year}</text>
          </g>
        ))}
        {!hasData && <text className="chart-empty-state" x={width / 2} y={(height + margin.top - margin.bottom) / 2} textAnchor="middle">No dated projects in this view</text>}
        <text className="chart-axis-title" x={width / 2} y={height - 1} textAnchor="middle">Start year</text>
      </svg>
    </section>
  );
});

type ThemeDonutDatum = {
  key: string;
  label: string;
  value: number;
  grantAmount: number;
  share: number;
  filterKey: string | null;
};

type ThemeDonutSegment = d3.PieArcDatum<ThemeDonutDatum>;

function collapsedDonutSegment(segment: ThemeDonutSegment, angle = (segment.startAngle + segment.endAngle) / 2): ThemeDonutSegment {
  return {
    ...segment,
    startAngle: angle,
    endAngle: angle,
    value: 0
  };
}

function interpolateDonutSegment(from: ThemeDonutSegment, to: ThemeDonutSegment, progress: number): ThemeDonutSegment {
  return {
    ...to,
    startAngle: from.startAngle + (to.startAngle - from.startAngle) * progress,
    endAngle: from.endAngle + (to.endAngle - from.endAngle) * progress,
    padAngle: from.padAngle + (to.padAngle - from.padAngle) * progress,
    value: from.value + (to.value - from.value) * progress
  };
}

function interpolateDonutSegments(previous: ThemeDonutSegment[], next: ThemeDonutSegment[], progress: number): ThemeDonutSegment[] {
  const previousByKey = new Map(previous.map((segment) => [segment.data.key, segment]));
  const nextByKey = new Map(next.map((segment) => [segment.data.key, segment]));
  const orderedKeys = [
    ...next.map((segment) => segment.data.key),
    ...previous.map((segment) => segment.data.key).filter((key) => !nextByKey.has(key))
  ];

  return orderedKeys.flatMap((key) => {
    const from = previousByKey.get(key);
    const to = nextByKey.get(key);
    if (from && to) return [interpolateDonutSegment(from, to, progress)];
    if (to) return [interpolateDonutSegment(collapsedDonutSegment(to, to.startAngle), to, progress)];
    if (from) return [interpolateDonutSegment(from, collapsedDonutSegment(from), progress)];
    return [];
  });
}

function compactDonutLabel(value: string, maxLength = 14) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(1, maxLength - 3)).trim()}...`;
}

const ThemeDonutChart = memo(function ThemeDonutChart({
  rows,
  selectedFocalAreas,
  onThemeSelect,
  colorSchemeId
}: {
  rows: AggregateRow[];
  selectedFocalAreas: string[];
  onThemeSelect: (focalArea: string | null) => void;
  colorSchemeId: ThemeMode;
}) {
  const width = 360;
  const height = 246;
  const centerX = 180;
  const centerY = 123;
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const selectedSet = useMemo(() => new Set(selectedFocalAreas), [selectedFocalAreas]);
  const chart = useMemo(() => {
    const sortedRows = visibleFocalRows(rows)
      .filter((row) => row.projectRecords > 0)
      .sort((a, b) => b.projectRecords - a.projectRecords);
    const visibleRows = sortedRows.slice(0, 7);
    const otherRows = sortedRows.slice(7);
    const total = d3.sum(sortedRows, (row) => row.projectRecords);
    const otherValue = d3.sum(otherRows, (row) => row.projectRecords);
    const otherGrantAmount = d3.sum(otherRows, (row) => row.grantAmount);
    const data: ThemeDonutDatum[] = visibleRows.map((row) => ({
      key: row.key,
      label: row.label,
      value: row.projectRecords,
      grantAmount: row.grantAmount,
      share: total ? row.projectRecords / total : 0,
      filterKey: row.label
    }));
    if (otherValue > 0) {
      data.push({
        key: "__other__",
        label: "Other focal areas",
        value: otherValue,
        grantAmount: otherGrantAmount,
        share: total ? otherValue / total : 0,
        filterKey: null
      });
    }
    const pie = d3.pie<ThemeDonutDatum>().sort(null).value((datum) => datum.value)(data);
    return {
      data,
      pie,
      total,
      grantTotal: d3.sum(sortedRows, (row) => row.grantAmount),
      leading: data[0] ?? null
    };
  }, [rows]);
  const [animatedPie, setAnimatedPie] = useState<ThemeDonutSegment[]>(chart.pie);
  const [isAnimatingPie, setIsAnimatingPie] = useState(false);
  const previousPieRef = useRef<ThemeDonutSegment[]>(chart.pie);
  const arc = d3.arc<ThemeDonutSegment>().innerRadius(52).outerRadius(88).cornerRadius(4).padAngle(0.012);
  const hoverDatum = chart.data.find((datum) => datum.key === hoveredKey) ?? null;
  const centerDatum = hoverDatum ?? chart.leading;
  const palette = categoricalPaletteForScheme(colorSchemeId);
  const hasActiveThemeFilter = selectedSet.size > 0;
  const handleThemeToggle = (datum: ThemeDonutDatum) => {
    if (!datum.filterKey) return;
    onThemeSelect(selectedSet.has(datum.filterKey) ? null : datum.filterKey);
  };

  useEffect(() => {
    const previousPie = previousPieRef.current;
    const nextPie = chart.pie;
    if (previousPie === nextPie) {
      setAnimatedPie(nextPie);
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !previousPie.length || !nextPie.length) {
      previousPieRef.current = nextPie;
      setAnimatedPie(nextPie);
      setIsAnimatingPie(false);
      return;
    }

    let frame = 0;
    let start = 0;
    const duration = 680;
    setIsAnimatingPie(true);

    const tick = (time: number) => {
      if (!start) start = time;
      const progress = clampNumber((time - start) / duration, 0, 1);
      setAnimatedPie(interpolateDonutSegments(previousPie, nextPie, easeOutCubic(progress)));

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      } else {
        previousPieRef.current = nextPie;
        setAnimatedPie(nextPie);
        setIsAnimatingPie(false);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [chart.pie]);

  return (
    <section className="visual-module theme-donut-panel" data-tooltip="Donut chart showing focal-area composition for the current filtered grant portfolio.">
      <div className="panel-heading" data-tooltip="Filtered grant distribution across focal areas, with segment share and grant funding in each hover state.">
        <h2>Thematic mix</h2>
        <small>Focal area share of filtered grants</small>
      </div>
      <div className="theme-donut-layout">
        <svg viewBox={`0 0 ${width} ${height}`} className={`chart-svg theme-donut-svg ${isAnimatingPie ? "is-animating" : ""}`} role="img" aria-label="Focal area donut chart">
          <rect className="chart-plot-bg" x={8} y={10} width={width - 16} height={height - 20} rx={9} />
          <g transform={`translate(${centerX} ${centerY})`}>
            {animatedPie.map((segment, index) => {
              const color = segment.data.key === "__other__" ? palette[(index + 2) % palette.length] : focalAreaColor(segment.data.label, colorSchemeId);
              const isSelected = segment.data.filterKey ? selectedSet.has(segment.data.filterKey) : false;
              const isDimmed = hasActiveThemeFilter && !isSelected;
              const tooltip = segment.data.filterKey
                ? `${segment.data.label}: ${formatNumber(segment.data.value)} of ${formatNumber(chart.total)} grants (${Math.round(segment.data.share * 100)}%), ${formatMoney(segment.data.grantAmount)} of ${formatMoney(chart.grantTotal)} grant funding.${isSelected ? " Current thematic scope." : ""}`
                : `${segment.data.label}: grouped smaller focal areas. ${formatNumber(segment.data.value)} of ${formatNumber(chart.total)} grants, ${formatMoney(segment.data.grantAmount)} of ${formatMoney(chart.grantTotal)} grant funding.`;
              return (
                <path
                  className={`theme-donut-slice ${isSelected ? "is-active" : ""}`}
                  key={segment.data.key}
                  d={arc(segment) ?? undefined}
                  fill={color}
                  opacity={isDimmed ? 0.36 : hoveredKey === segment.data.key ? 1 : 0.9}
                  tabIndex={segment.data.filterKey ? 0 : -1}
                  role={segment.data.filterKey ? "button" : "presentation"}
                  aria-label={segment.data.filterKey ? `Filter ${segment.data.label}` : undefined}
                  data-tooltip={tooltip}
                  onClick={() => handleThemeToggle(segment.data)}
                  onMouseEnter={() => setHoveredKey(segment.data.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onFocus={() => setHoveredKey(segment.data.key)}
                  onBlur={() => setHoveredKey(null)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    handleThemeToggle(segment.data);
                  }}
                />
              );
            })}
            {animatedPie.map((segment, index) => {
              if (!segment.data.value) return null;
              const middleAngle = (segment.startAngle + segment.endAngle) / 2 - Math.PI / 2;
              const outerX = Math.cos(middleAngle) * 90;
              const outerY = Math.sin(middleAngle) * 90;
              const labelRadius = 106;
              const labelX = Math.cos(middleAngle) * labelRadius;
              const labelY = Math.sin(middleAngle) * labelRadius;
              const labelAnchor = labelX >= 0 ? "start" : "end";
              const elbowX = Math.cos(middleAngle) * 98;
              const elbowY = Math.sin(middleAngle) * 98;
              const labelText = compactDonutLabel(segment.data.label);
              const isSelected = segment.data.filterKey ? selectedSet.has(segment.data.filterKey) : false;
              const isDimmed = hasActiveThemeFilter && !isSelected;
              const tooltip = segment.data.filterKey
                ? `${segment.data.label}: ${formatNumber(segment.data.value)} of ${formatNumber(chart.total)} grants (${Math.round(segment.data.share * 100)}%), ${formatMoney(segment.data.grantAmount)} of ${formatMoney(chart.grantTotal)} grant funding.${isSelected ? " Current thematic scope." : ""}`
                : `${segment.data.label}: grouped smaller focal areas. ${formatNumber(segment.data.value)} of ${formatNumber(chart.total)} grants, ${formatMoney(segment.data.grantAmount)} of ${formatMoney(chart.grantTotal)} grant funding.`;
              return (
                <g
                  className={`theme-donut-label ${isSelected ? "is-active" : ""}`}
                  key={`label-${segment.data.key}-${index}`}
                  opacity={isDimmed ? 0.44 : hoveredKey === segment.data.key ? 1 : 0.86}
                  data-tooltip={tooltip}
                  role="presentation"
                  tabIndex={-1}
                  aria-hidden="true"
                  onClick={() => handleThemeToggle(segment.data)}
                  onMouseEnter={() => setHoveredKey(segment.data.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                >
                  <polyline points={`${outerX},${outerY} ${elbowX},${elbowY} ${labelX + (labelX >= 0 ? -4 : 4)},${labelY}`} />
                  <text x={labelX} y={labelY - 1} textAnchor={labelAnchor}>
                    <tspan>{labelText}</tspan>
                    <tspan x={labelX} dy="10">{formatNumber(segment.data.value)} · {Math.round(segment.data.share * 100)}%</tspan>
                  </text>
                </g>
              );
            })}
            <circle className="theme-donut-core" r={42} />
            <text className="theme-donut-total" y={-4} textAnchor="middle">{formatNumber(centerDatum?.value ?? chart.total)}</text>
            <text className="theme-donut-caption" y={13} textAnchor="middle">{centerDatum?.label ?? "Grants"}</text>
          </g>
          {!chart.total && <text className="chart-empty-state" x={width / 2} y={height / 2} textAnchor="middle">No thematic data in this view</text>}
        </svg>
      </div>
    </section>
  );
});

const ScatterChart = memo(function ScatterChart({ projects, onProject, colorSchemeId }: { projects: ProjectRecord[]; onProject: (rowId: string) => void; colorSchemeId: ThemeMode }) {
  const width = 360;
  const height = 245;
  const margin = { top: 12, right: 12, bottom: 38, left: 42 };
  const chart = useMemo(() => {
    const maxPoints = 650;
    let eligibleCount = 0;
    for (const project of projects) {
      if (project.grantAmount > 0 || project.cofinancingTotal > 0) eligibleCount += 1;
    }
    const stride = Math.max(1, Math.ceil(eligibleCount / maxPoints));
    const sample: ProjectRecord[] = [];
    let eligibleIndex = 0;
    let maxGrant = 1;
    let maxCofinancing = 1;
    let maxInvestment = 1;
    for (const project of projects) {
      if (project.grantAmount <= 0 && project.cofinancingTotal <= 0) continue;
      if (eligibleIndex % stride === 0 && sample.length < maxPoints) {
        sample.push(project);
        maxGrant = Math.max(maxGrant, project.grantAmount || 1);
        maxCofinancing = Math.max(maxCofinancing, project.cofinancingTotal || 1);
        maxInvestment = Math.max(maxInvestment, project.totalInvestment || 1);
      }
      eligibleIndex += 1;
    }
    const moneyTickCandidates = [1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000];
    const xTicks = moneyTickCandidates.filter((tick) => tick <= maxGrant);
    const yTicks = moneyTickCandidates.filter((tick) => tick <= maxCofinancing);
    return {
      sample,
      maxGrant,
      maxCofinancing,
      maxInvestment,
      shownXTicks: xTicks.length ? xTicks : [maxGrant],
      shownYTicks: yTicks.length ? yTicks : [maxCofinancing]
    };
  }, [projects]);
  const x = d3.scaleLog([1, chart.maxGrant], [margin.left, width - margin.right]);
  const y = d3.scaleLog([1, chart.maxCofinancing], [height - margin.bottom, margin.top]);
  const size = d3.scaleSqrt([0, chart.maxInvestment], [2, 6.2]);
  const handlePointClick = (event: ReactMouseEvent<SVGGElement>) => {
    const target = event.target instanceof Element ? event.target.closest<SVGCircleElement>("[data-row-id]") : null;
    const rowId = target?.dataset.rowId;
    if (rowId) onProject(rowId);
  };
  return (
    <section className="visual-module" data-tooltip="Each point is one sampled project record, positioned by grant amount and project-level cofinancing.">
      <div className="panel-heading" data-tooltip="Compares project grant amount and project-level cofinancing on log scales"><h2>Grant/cofinancing scatter</h2><small>Log scale, sampled for responsiveness</small></div>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Grant and cofinancing scatterplot">
        <rect className="chart-plot-bg" x={margin.left} y={margin.top} width={width - margin.left - margin.right} height={height - margin.top - margin.bottom} rx={7} />
        {chart.shownYTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line className="chart-gridline" x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} />
            <text className="chart-tick chart-tick-y" x={margin.left - 6} y={y(tick) + 3} textAnchor="end">{formatMoney(tick, { compact: true })}</text>
          </g>
        ))}
        {chart.shownXTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line className="chart-gridline chart-gridline-vertical" x1={x(tick)} x2={x(tick)} y1={margin.top} y2={height - margin.bottom} />
            <text className="chart-tick" x={x(tick)} y={height - 21} textAnchor="middle">{formatMoney(tick, { compact: true })}</text>
          </g>
        ))}
        <line className="chart-axis-line" x1={margin.left} x2={width - margin.right} y1={height - margin.bottom} y2={height - margin.bottom} />
        <line className="chart-axis-line" x1={margin.left} x2={margin.left} y1={margin.top} y2={height - margin.bottom} />
        <g className="scatter-points" onClick={handlePointClick}>
          {chart.sample.map((project) => (
            <circle
              className="scatter-point"
              key={project.rowId}
              data-row-id={project.rowId}
              data-tooltip={`${project.projectTitle}. ${project.countryName}, ${project.focalArea || "No focal area"}, ${formatMoney(project.grantAmount)} grant and ${formatMoney(project.cofinancingTotal)} cofinancing.`}
              cx={x(Math.max(project.grantAmount, 1))}
              cy={y(Math.max(project.cofinancingTotal, 1))}
              r={size(project.totalInvestment)}
              fill={focalAreaColor(project.focalArea, colorSchemeId)}
              opacity={0.88}
              stroke="rgba(255, 249, 234, 0.72)"
              strokeWidth={0.55}
              role="button"
              tabIndex={0}
              aria-label={`Open project details for ${project.projectTitle}`}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onProject(project.rowId);
              }}
            />
          ))}
        </g>
        <text className="chart-axis-title" x={width / 2} y={height - 4} textAnchor="middle">Grant amount</text>
        <text className="chart-axis-title" x={11} y={(height - margin.bottom + margin.top) / 2} transform={`rotate(-90 11 ${(height - margin.bottom + margin.top) / 2})`} textAnchor="middle">Cofinancing</text>
      </svg>
    </section>
  );
});

function NetworkView({
  rows,
  selectedCofinancerTypes,
  onCofinancerTypeSelect,
  colorSchemeId
}: {
  rows: AggregateRow[];
  selectedCofinancerTypes: string[];
  onCofinancerTypeSelect: (cofinancerType: string) => void;
  colorSchemeId: ThemeMode;
}) {
  const nodes = rows.slice(0, 16).map((row, index) => ({
    id: row.key,
    label: row.label,
    value: row.cofinancingTotal || row.totalInvestment,
    angle: (index / Math.max(rows.slice(0, 16).length, 1)) * Math.PI * 2
  }));
  const width = 360;
  const height = 260;
  const max = d3.max(nodes, (node) => node.value) || 1;
  const palette = categoricalPaletteForScheme(colorSchemeId);
  const selectedSet = useMemo(() => new Set(selectedCofinancerTypes), [selectedCofinancerTypes]);
  return (
    <section className="visual-module" data-tooltip="Cofinancer type nodes are sized by total matching cofinancing detail amounts.">
      <div className="panel-heading" data-tooltip="Cofinancing totals grouped by cofinancer type from matching cofinancing detail rows."><h2>Cofinancer network</h2><small>Aggregated partner-type nodes</small></div>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg network-svg" role="img" aria-label="Cofinancer network">
        <rect className="chart-plot-bg" x={14} y={12} width={width - 28} height={height - 24} rx={8} />
        {[52, 92, 132].map((radius) => (
          <circle className="chart-gridline chart-network-ring" key={radius} cx={width / 2} cy={height / 2} r={radius} fill="none" />
        ))}
        <circle cx={width / 2} cy={height / 2} r={28} fill="#102f2a" stroke="rgba(255, 224, 108, 0.82)" strokeWidth={1.2} />
        <text x={width / 2} y={height / 2 + 4} textAnchor="middle">Projects</text>
        {nodes.map((node, index) => {
          const x = width / 2 + Math.cos(node.angle) * 112;
          const y = height / 2 + Math.sin(node.angle) * 76;
          const r = 6 + Math.sqrt(node.value / max) * 18;
          const isSelected = selectedSet.has(node.label) || selectedSet.has(node.id);
          const tooltip = `Cofinancer type ${node.label}: ${formatMoney(node.value)} cofinancing.${isSelected ? " Current partner-type scope." : ""}`;
          return (
            <g
              className={`network-node ${isSelected ? "is-active" : ""}`}
              key={node.id}
              role="button"
              tabIndex={0}
              aria-label={tooltip}
              data-tooltip={tooltip}
              onClick={() => onCofinancerTypeSelect(node.label)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onCofinancerTypeSelect(node.label);
              }}
            >
              <line x1={width / 2} y1={height / 2} x2={x} y2={y} stroke="rgba(246, 236, 216, 0.64)" strokeWidth={Math.max(1, r / 8)} opacity={0.78} />
              <circle className="network-node-hit" cx={x} cy={y} r={Math.max(18, r + 8)} aria-hidden="true" />
              <circle cx={x} cy={y} r={r} fill={palette[index % palette.length]} opacity={0.96} stroke="rgba(255, 249, 234, 0.74)" strokeWidth={0.8} />
              <text x={x} y={y + r + 10} textAnchor="middle">{node.label.slice(0, 16)}</text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function ProjectTable({
  projects,
  onOpen
}: {
  projects: ProjectRecord[];
  onOpen: (rowId: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const headerHeight = 34;
  const rowVirtualizer = useVirtualizer({
    count: projects.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 46,
    overscan: 12
  });
  return (
    <section className="visual-module table-panel" data-tooltip="Project table rows represent the current filtered portfolio, virtualized for large result sets.">
      <div className="panel-heading" data-tooltip="Project rows after all active filters are applied"><h2>Filtered project records</h2><small>{formatNumber(projects.length)} rows</small></div>
      <div className="table-viewport" ref={parentRef}>
        <div className="project-table-canvas" style={{ height: rowVirtualizer.getTotalSize() + headerHeight, position: "relative" }}>
          <div className="project-table-header" data-tooltip="Table columns: project number, title, country, focal area, and grant amount">
            <span data-tooltip="Source project number used as the dataset join key">Project</span>
            <strong data-tooltip="Project title from the authoritative project table">Title</strong>
            <em data-tooltip="Mapped project country">Country</em>
            <em data-tooltip="Project focal area used for thematic filtering">Focal area</em>
            <em data-tooltip="Project grant amount from the project table">Grant</em>
          </div>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const project = projects[virtualRow.index];
            return (
              <button
              className="project-row"
              key={project.rowId}
              style={{ transform: `translateY(${virtualRow.start + headerHeight}px)` }}
              onClick={() => onOpen(project.rowId)}
              data-tooltip={`${project.projectTitle}. ${project.countryName}, ${project.focalArea || "Missing"}, ${formatMoney(project.grantAmount)} grant.`}
            >
                <span>{project.projectNumber}</span>
                <strong>{project.projectTitle}</strong>
                <em>{project.countryName}</em>
                <em>{project.focalArea || "Missing"}</em>
                <em>{formatMoney(project.grantAmount)}</em>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProjectDetailDrawer({
  project,
  detailRows,
  onClose,
  onFilter
}: {
  project: ProjectRecord | null;
  detailRows: CofinancingRecord[];
  onClose: () => void;
  onFilter: (patch: Partial<DashboardFilters>) => void;
}) {
  if (!project) return null;
  const canFilterFocalArea = hasVisibleFocalArea(project.focalArea);
  return (
    <aside className="detail-drawer" aria-label="Project detail drawer" data-tooltip="Project detail drawer with authoritative project fields and matching cofinancing partner rows.">
      <button className="drawer-close" onClick={onClose} data-tooltip="Project detail overlay for the selected record.">Close</button>
      <span className="eyebrow">{project.projectNumber}</span>
      <h2>{project.projectTitle}</h2>
      <div className="detail-grid">
        <span data-tooltip="Project country from the authoritative project table.">Country<strong>{project.countryName}</strong></span>
        <span data-tooltip="SGP region assigned to this project">Region<strong>{project.regionId}</strong></span>
        <span data-tooltip="Project focal area used for thematic grouping.">Focal area<strong>{project.focalArea || "Missing"}</strong></span>
        <span data-tooltip="Project implementation status from the project table">Status<strong>{project.status}</strong></span>
        <span data-tooltip="Grant amount from the authoritative project table">Grant<strong>{formatMoney(project.grantAmount)}</strong></span>
        <span data-tooltip="Project-level cofinancing total from the authoritative project table">Cofinancing<strong>{formatMoney(project.cofinancingTotal)}</strong></span>
      </div>
      <div className="drawer-actions">
        <button onClick={() => onFilter({ countries: project.countryIso3 ? [project.countryIso3] : [project.countryName] })} data-tooltip={`${project.countryName}: project country associated with this record.`}>Filter country</button>
        {canFilterFocalArea && <button onClick={() => onFilter({ focalAreas: [project.focalArea!] })} data-tooltip={`${project.focalArea}: thematic focal area associated with this record.`}>Filter focal area</button>}
      </div>
      <h3>Cofinancing partners</h3>
      <div className="mini-table">
        {detailRows.slice(0, 30).map((row) => (
          <div key={row.rowId} data-tooltip={`${row.companyTitle || "Missing partner"} contributed ${formatMoney(row.amountTotal)} as ${row.companyType || "an unspecified cofinancer type"}`}>
            <span>{row.companyTitle || "Missing"}</span>
            <em>{row.companyType || "Missing"}</em>
            <strong>{formatMoney(row.amountTotal)}</strong>
          </div>
        ))}
        {!detailRows.length && <p>No detailed cofinancing rows for this project number.</p>}
      </div>
    </aside>
  );
}

function CountryProfileDrawer({
  iso3,
  rows,
  projects,
  onClose
}: {
  iso3: string | null;
  rows: AggregateRow[];
  projects: ProjectRecord[];
  onClose: () => void;
}) {
  if (!iso3) return null;
  const aggregate = rows.find((row) => row.key === iso3);
  const countryProjects = projects.filter((project) => (project.countryIso3 ?? project.countryName) === iso3).slice(0, 10);
  if (!aggregate) return null;
  return (
    <aside className="detail-drawer country-drawer" aria-label="Country profile" data-tooltip="Country profile summarizing the filtered portfolio for a single mapped country.">
      <button className="drawer-close" onClick={onClose} data-tooltip="Country profile overlay for the selected country.">Close</button>
      <span className="eyebrow">Country profile</span>
      <h2>{aggregate.label}</h2>
      <div className="detail-grid">
        <span data-tooltip="Filtered project rows in this country">Records<strong>{formatNumber(aggregate.projectRecords)}</strong></span>
        <span data-tooltip="Grant funding in this country under the current filters">Grant<strong>{formatMoney(aggregate.grantAmount)}</strong></span>
        <span data-tooltip="Project-level cofinancing in this country under the current filters">Cofinancing<strong>{formatMoney(aggregate.cofinancingTotal)}</strong></span>
        <span data-tooltip="Unique cofinancing partners represented in matching detail rows">Partners<strong>{formatNumber(aggregate.cofinancingPartnerCount ?? 0)}</strong></span>
      </div>
      <h3>Recent matching projects</h3>
      <div className="mini-table">
        {countryProjects.map((project) => (
          <div key={project.rowId} data-tooltip={`${project.projectTitle}. Started ${project.startYear ?? "with no year"} with ${formatMoney(project.grantAmount)} grant funding.`}>
            <span>{project.projectTitle}</span>
            <em>{project.startYear ?? "n/a"}</em>
            <strong>{formatMoney(project.grantAmount)}</strong>
          </div>
        ))}
      </div>
    </aside>
  );
}

function BriefingNote({ metrics, countryRows, focalRows }: { metrics: PortfolioMetrics; countryRows: AggregateRow[]; focalRows: AggregateRow[] }) {
  const themeRows = visibleFocalRows(focalRows);
  return `# SGP Grant Portfolio snapshot

## Key figures
- ${formatNumber(metrics.projectRecords ?? 0)} project records across ${formatNumber(metrics.countries ?? 0)} countries.
- ${formatMoney(metrics.grantAmount ?? 0)} in grants.
- ${formatMoney(metrics.cofinancingTotal ?? 0)} in cofinancing, including ${formatMoney(metrics.cofinancingCash ?? 0)} cash and ${formatMoney(metrics.cofinancingKind ?? 0)} in-kind.

## Main patterns
- Largest country portfolio: ${countryRows[0]?.label ?? "n/a"}.
- Leading focal area by grants: ${themeRows[0]?.label ?? "n/a"}.

## Leading countries
${countryRows.slice(0, 10).map((row) => `- ${row.label}: ${formatNumber(row.projectRecords)} records, ${formatMoney(row.grantAmount)} grants`).join("\n")}

## Focal area distribution
${themeRows.slice(0, 8).map((row) => `- ${row.label}: ${formatNumber(row.projectRecords)} records, ${formatMoney(row.grantAmount)} grants`).join("\n")}
`;
}

function LoadingDashboard() {
  return (
    <div className="boot-state">
      <section className="loading-panel" aria-label="Loading dashboard">
        <Globe2 size={30} />
        <h1>Loading SGP Grant Portfolio</h1>
        <p>Reading normalized projects, cofinancing details, aggregates, and local world geometry.</p>
        <div className="loading-bar" aria-hidden="true"><i /></div>
        <div className="loading-map-skeleton" aria-hidden="true" />
      </section>
    </div>
  );
}

function AppContent({ bundle, geo }: { bundle: DataBundle; geo: WorldGeo }) {
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const filters = useDashboardStore((state) => state.filters);
  const setFilters = useDashboardStore((state) => state.setFilters);
  const resetFilters = useDashboardStore((state) => state.resetFilters);
  const activeView = useDashboardStore((state) => state.activeView);
  const setActiveView = useDashboardStore((state) => state.setActiveView);
  const theme = useDashboardStore((state) => state.theme);
  const mapMetric = useDashboardStore((state) => state.mapMetric);
  const setMapMetric = useDashboardStore((state) => state.setMapMetric);
  const selectedProjectRowId = useDashboardStore((state) => state.selectedProjectRowId);
  const setSelectedProject = useDashboardStore((state) => state.setSelectedProject);
  const selectedCountryIso3 = useDashboardStore((state) => state.selectedCountryIso3);
  const setSelectedCountry = useDashboardStore((state) => state.setSelectedCountry);
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState<AiQueryPlan | null>(null);
  const [hoveredCountryIso3, setHoveredCountryIso3] = useState<string | null>(null);
  const colorScheme = useMemo(() => getColorScheme(theme), [theme]);
  const colorSchemeStyle = useMemo(
    () => ({ ...colorScheme.cssVars, colorScheme: colorScheme.mode }) as CSSProperties,
    [colorScheme]
  );

  useEffect(() => {
    const parsed = filtersFromSearch(window.location.search);
    if (filtersToSearch(parsed)) {
      setFilters(parsed, true);
    }
  }, [setFilters]);

  useEffect(() => {
    const timeout = window.setTimeout(() => warmProjectFilterCaches(bundle.projects), 350);
    return () => window.clearTimeout(timeout);
  }, [bundle.projects]);

  useEffect(() => {
    const search = filtersToSearch(filters);
    const next = search ? `${window.location.pathname}?${search}` : window.location.pathname;
    window.history.replaceState(null, "", next);
  }, [filters]);

  useEffect(() => {
    const visibleFocalAreas = filters.focalAreas.filter(hasVisibleFocalArea);
    if (visibleFocalAreas.length !== filters.focalAreas.length) {
      setFilters({ focalAreas: visibleFocalAreas });
    }
  }, [filters.focalAreas, setFilters]);

  useEffect(() => {
    if (!sgpViewTabs.some((tab) => tab.key === activeView)) {
      setActiveView("trends");
    }
  }, [activeView, setActiveView]);

  const filtered = useMemo(() => applyFilters(bundle.projects, bundle.cofinancing, filters), [bundle.projects, bundle.cofinancing, filters]);
  const metrics = useMemo(
    () => computeProjectMetrics(filtered.projects, filtered.cofinancing, { includeMedianGrant: false }),
    [filtered.projects, filtered.cofinancing]
  );
  const aggregates = useMemo(
    () => (isDefaultFilters(filters) ? bundle.aggregates : buildRuntimeAggregates(filtered.projects, filtered.cofinancing)),
    [bundle.aggregates, filtered.projects, filtered.cofinancing, filters]
  );
  const countryGroupRows = useMemo(() => buildCountryGroupRows(bundle.projects, bundle.cofinancing), [bundle.projects, bundle.cofinancing]);
  const regionSelectorRows = useMemo(() => [...bundle.aggregates.byRegion, ...countryGroupRows], [bundle.aggregates.byRegion, countryGroupRows]);
  const projectByRowId = useMemo(() => new Map(bundle.projects.map((project) => [project.rowId, project])), [bundle.projects]);
  const cofinancingByProjectNumber = useMemo(() => {
    const rowsByProjectNumber = new Map<string, CofinancingRecord[]>();
    for (const row of bundle.cofinancing) {
      const rows = rowsByProjectNumber.get(row.projectNumberNormalized);
      if (rows) {
        rows.push(row);
      } else {
        rowsByProjectNumber.set(row.projectNumberNormalized, [row]);
      }
    }
    return rowsByProjectNumber;
  }, [bundle.cofinancing]);
  const selectedProject = useMemo(() => (selectedProjectRowId ? projectByRowId.get(selectedProjectRowId) ?? null : null), [projectByRowId, selectedProjectRowId]);
  const selectedProjectCofinancing = useMemo(
    () => selectedProject ? cofinancingByProjectNumber.get(selectedProject.projectNumberNormalized) ?? [] : [],
    [cofinancingByProjectNumber, selectedProject]
  );
  const portfolioYearDomain = useMemo(() => projectYearDomain(bundle.projects), [bundle.projects]);
  const allowedValues = useMemo<AllowedFilterValues>(() => ({
    countries: bundle.aggregates.byCountry.map((row) => ({ iso3: row.key, name: row.label })),
    regions: regionSelectorRows.map((row) => row.key),
    regionAliases: [...sgpRegionOptions, ...COUNTRY_GROUP_OPTIONS].map((option) => ({
      key: option.key,
      labels: [option.label, option.key]
    })),
    focalAreas: visibleFocalRows(bundle.aggregates.byFocalArea).map((row) => row.label),
    statuses: bundle.aggregates.byStatus.map((row) => row.label),
    fundingSources: bundle.aggregates.byFundingSource.map((row) => row.label),
    cofinancerTypes: bundle.aggregates.byCofinancerType.map((row) => row.label)
  }), [bundle.aggregates, regionSelectorRows]);
  const countryRegionByIso = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of bundle.projects) {
      if (project.countryIso3 && project.regionId && !map.has(project.countryIso3)) {
        map.set(project.countryIso3, project.regionId);
      }
    }
    return map;
  }, [bundle.projects]);
  const atlasContextRow = useMemo(() => {
    return (
      aggregates.byCountry.find((row) => row.key === hoveredCountryIso3) ??
      aggregates.byCountry.find((row) => filters.countries.includes(row.key)) ??
      null
    );
  }, [aggregates.byCountry, filters.countries, hoveredCountryIso3]);
  const atlasContextMode = hoveredCountryIso3 ? "Hover preview" : filters.countries.length ? "Selected country" : "Portfolio";
  const selectedProfile = useMemo(() => {
    const countryKey = filters.countries.length === 1 ? filters.countries[0] : null;
    if (countryKey) {
      return bundle.profiles.countries[countryKey] ?? null;
    }
    const focalArea = filters.focalAreas.length === 1 ? filters.focalAreas[0] : null;
    if (focalArea && hasVisibleFocalArea(focalArea)) {
      return bundle.profiles.areas[focalArea] ?? null;
    }
    return null;
  }, [bundle.profiles.areas, bundle.profiles.countries, filters.countries, filters.focalAreas]);

  const applyPlan = (nextPlan: AiQueryPlan) => {
    setFilters(nextPlan.filterPatch);
    if (nextPlan.visualizationHint === "time") setActiveView("trends");
    if (nextPlan.visualizationHint === "sankey" || nextPlan.visualizationHint === "scatter") setActiveView("finance");
    if (nextPlan.visualizationHint === "table") setActiveView("table");
    setPlan(null);
  };

  const exportKind = async (kind: string) => {
    if (kind === "projects") {
      downloadText("sgp-filtered-projects.csv", toCsv(filtered.projects as unknown as Record<string, unknown>[]), "text/csv;charset=utf-8");
    } else if (kind === "cofinancing") {
      downloadText("sgp-filtered-cofinancing.csv", toCsv(filtered.cofinancing as unknown as Record<string, unknown>[]), "text/csv;charset=utf-8");
    } else if (kind === "aggregate") {
      downloadText("sgp-current-country-aggregates.csv", toCsv(aggregates.byCountry as unknown as Record<string, unknown>[]), "text/csv;charset=utf-8");
    } else if (kind === "brief") {
      downloadText("sgp-briefing-note.md", BriefingNote({ metrics, countryRows: aggregates.byCountry, focalRows: aggregates.byFocalArea }), "text/markdown;charset=utf-8");
    } else if (kind === "recipe") {
      downloadText("sgp-filter-recipe.json", JSON.stringify({ filters, view: activeView }, null, 2), "application/json;charset=utf-8");
    } else if (kind === "share") {
      await navigator.clipboard.writeText(window.location.href);
    } else if (kind === "zip") {
      const [{ default: JSZip }, { saveAs }] = await Promise.all([import("jszip"), import("file-saver")]);
      const zip = new JSZip();
      zip.file("projects.csv", toCsv(filtered.projects as unknown as Record<string, unknown>[]));
      zip.file("cofinancing.csv", toCsv(filtered.cofinancing as unknown as Record<string, unknown>[]));
      zip.file("aggregates.json", JSON.stringify(aggregates, null, 2));
      saveAs(await zip.generateAsync({ type: "blob" }), "sgp-filtered-data-package.zip");
    } else if (kind === "svg") {
      const svg = dashboardRef.current?.querySelector("svg");
      if (svg) {
        const serialized = new XMLSerializer().serializeToString(svg);
        downloadText("sgp-current-visual.svg", serialized, "image/svg+xml;charset=utf-8");
      }
    } else if (kind === "png") {
      const node = dashboardRef.current;
      if (node) {
        const [{ toPng }, { saveAs }] = await Promise.all([import("html-to-image"), import("file-saver")]);
        saveAs(await toPng(node, { pixelRatio: 1.5 }), "sgp-dashboard-view.png");
      }
    } else if (kind === "pdf") {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      pdf.text("SGP Grant Portfolio", 42, 44);
      pdf.text(`Project records: ${formatNumber(metrics.projectRecords ?? 0)}`, 42, 72);
      pdf.text(`Grant amount: ${formatMoney(metrics.grantAmount ?? 0)}`, 42, 94);
      pdf.text(`Cofinancing: ${formatMoney(metrics.cofinancingTotal ?? 0)}`, 42, 116);
      pdf.save("sgp-dashboard-summary.pdf");
    }
  };

  const handleCountryToggle = useCallback((iso3: string) => {
    const nextCountries = filters.countries.includes(iso3)
      ? filters.countries.filter((country) => country !== iso3)
      : [...filters.countries, iso3];
    const countryRegion = countryRegionByIso.get(iso3);
    const selectedGeographyContainsCountry = filters.regions.some((region) => region === countryRegion || countryGroupContains(region, iso3));
    const nextRegions =
      filters.regions.length > 0 && !selectedGeographyContainsCountry
        ? []
        : filters.regions;
    setFilters({
      countries: nextCountries,
      regions: nextRegions
    });
    setActiveView("profile");
  }, [countryRegionByIso, filters.countries, filters.regions, setActiveView, setFilters]);
  const handleRegionSelect = useCallback((region: string) => {
    if (region === "global") {
      setFilters({ regions: [], countries: [] });
    } else {
      setFilters({ regions: [region], countries: [] });
    }
    setHoveredCountryIso3(null);
  }, [setFilters]);
  const handleThemeSelect = useCallback((focalArea: string | null) => {
    if (!hasVisibleFocalArea(focalArea)) {
      setFilters({ focalAreas: [] });
      return;
    }
    setFilters({ focalAreas: isSingleValueSelection(filters.focalAreas, focalArea) ? [] : [focalArea] });
    setActiveView("profile");
  }, [filters.focalAreas, setActiveView, setFilters]);
  const handleYearThemeSelect = useCallback((year: number, focalArea: string) => {
    const sameYear = filters.startYearRange[0] === year && filters.startYearRange[1] === year;
    const sameTheme = isSingleValueSelection(filters.focalAreas, focalArea);
    setFilters(sameYear && sameTheme
      ? { startYearRange: [null, null], focalAreas: [] }
      : { startYearRange: [year, year], focalAreas: [focalArea] });
  }, [filters.focalAreas, filters.startYearRange, setFilters]);
  const handleCofinancerTypeSelect = useCallback((cofinancerType: string) => {
    setFilters({ cofinancerTypes: isSingleValueSelection(filters.cofinancerTypes, cofinancerType) ? [] : [cofinancerType] });
  }, [filters.cofinancerTypes, setFilters]);
  const handleMapReset = useCallback(() => setFilters({ countries: [], regions: [] }), [setFilters]);
  const handleCountryReset = useCallback(() => {
    if (filters.countries.length > 0) {
      setFilters({ countries: [] });
    }
  }, [filters.countries.length, setFilters]);

  return (
    <div className={`impact-atlas-shell sgp-impact-atlas theme-${colorScheme.mode} scheme-${theme}`} style={colorSchemeStyle} ref={dashboardRef}>
      <main className={`impact-atlas-stage sgp-atlas-stage sgp-atlas-stage--${activeView}`} aria-label="SGP portfolio atlas dashboard">
        <WorldChoropleth
          geo={geo}
          countryRows={aggregates.byCountry}
          projectRows={filtered.projects}
          selectableCountryRows={bundle.aggregates.byCountry}
          selectedCountries={filters.countries}
          selectedRegions={filters.regions}
          metric={mapMetric}
          onMetricChange={setMapMetric}
          colorSchemeId={theme}
          onCountryToggle={handleCountryToggle}
          onCountryProfileOpen={setSelectedCountry}
          onCountryHover={setHoveredCountryIso3}
          onMapReset={handleMapReset}
          onCountryReset={handleCountryReset}
        />

        <div className="atlas-overlay-layer sgp-atlas-overlay">
          <section className="atlas-top-deck" aria-label="Atlas controls">
            <SgpFilterConsole
              assistantControls={
                <>
                  <div className="sgp-nl-search" role="search">
                    <Bot size={16} />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && query.trim()) {
                          setPlan(planLocalQuery(query, allowedValues));
                        }
                      }}
                      placeholder="Ask AI to filter, e.g. biodiversity after 2015"
                      aria-label="Natural-language filter query"
                      data-tooltip="Natural-language query text is parsed locally into dashboard filter dimensions such as theme, geography, year, status, and finance."
                    />
                    <button
                      className="sgp-compact-button sgp-compact-button--icon"
                      onClick={() => query.trim() && setPlan(planLocalQuery(query, allowedValues))}
                      aria-label="Enter"
                      data-tooltip="Local parser output summarizes inferred filter dimensions before they affect the portfolio."
                    >
                      <ArrowRight size={15} strokeWidth={2.6} />
                    </button>
                  </div>
                  <div className="sgp-ai-active-filters" aria-label="Active filters">
                    <ActiveChips filters={filters} onChange={setFilters} className="sgp-ai-chip-ribbon" emptyLabel={null} yearDomain={portfolioYearDomain} />
                  </div>

                  {plan && (
                    <div className="sgp-query-plan" role="dialog" aria-label="Query plan preview">
                      <div>
                        <strong>Query plan</strong>
                        <p>{plan.explanation}</p>
                        {!!plan.warnings.length && <small>{plan.warnings.join(" ")}</small>}
                      </div>
                      <button onClick={() => applyPlan(plan)} data-tooltip="The proposed plan contains structured filters inferred from the natural-language query.">Apply</button>
                      <button onClick={() => setPlan(null)} data-tooltip="The current dashboard filter state remains unchanged while this preview is pending.">Cancel</button>
                    </div>
                  )}
                </>
              }
              regionRows={regionSelectorRows}
              selectedRegions={filters.regions}
              onRegionSelect={handleRegionSelect}
              focalRows={visibleFocalRows(bundle.aggregates.byFocalArea)}
              availableFocalRows={visibleFocalRows(aggregates.byFocalArea)}
              selectedFocalAreas={filters.focalAreas}
              onThemeSelect={handleThemeSelect}
              projects={bundle.projects}
              cofinancing={bundle.cofinancing}
              filters={filters}
              onChange={setFilters}
              onReset={resetFilters}
              colorSchemeId={theme}
            />
          </section>

          <div className="sgp-bottom-toolbar" aria-label="Exports">
            <div className="sgp-toolbar-inline">
              <ExportMenu onExport={exportKind} />
            </div>
          </div>

          <div className="sgp-context-rail" aria-label="Portfolio context">
            <section className="atlas-kpi-ribbon atlas-kpi-ribbon--context" aria-label="Key performance indicators">
              <SgpKpiStrip metrics={metrics} />
            </section>
            <SgpAtlasContextCard
              row={atlasContextRow}
              metrics={metrics}
              mode={atlasContextMode}
              profile={selectedProfile}
              activeView={activeView}
              onViewChange={setActiveView}
              filteredProjects={filtered.projects}
              aggregates={aggregates}
              colorSchemeId={theme}
              selectedFocalAreas={filters.focalAreas}
              selectedYearRange={filters.startYearRange}
              selectedCofinancerTypes={filters.cofinancerTypes}
              onThemeSelect={handleThemeSelect}
              onYearThemeSelect={handleYearThemeSelect}
              onCofinancerTypeSelect={handleCofinancerTypeSelect}
              onProject={setSelectedProject}
            />
          </div>
        </div>
      </main>
      <ProjectDetailDrawer project={selectedProject} detailRows={selectedProjectCofinancing} onClose={() => setSelectedProject(null)} onFilter={setFilters} />
      <CountryProfileDrawer iso3={selectedCountryIso3} rows={aggregates.byCountry} projects={filtered.projects} onClose={() => setSelectedCountry(null)} />
      <GlobalTooltip />
    </div>
  );
}

export function App() {
  const { bundle, geo, error } = useData();
  if (error) {
    return (
      <div className="boot-state">
        <Activity size={32} />
        <h1>Dashboard data failed to load</h1>
        <p>{error}</p>
      </div>
    );
  }
  if (!bundle || !geo) {
    return <LoadingDashboard />;
  }
  return <AppContent bundle={bundle} geo={geo} />;
}
