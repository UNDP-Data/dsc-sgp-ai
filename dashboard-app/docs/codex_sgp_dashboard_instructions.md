# Codex implementation brief: SGP portfolio and cofinancing intelligence dashboard

Build a complete, polished, production-ready dashboard for the SGP projects and cofinancing datasets. The dashboard should help users explore the grant portfolio by country, region, focal area, operational phase, funding source, status, institutional type, cofinancing type, cofinancing geography, and time. It should support D3 visualizations, choropleth maps, rich filter systems, AI-assisted search and filter creation, data quality transparency, and exports for analysis and briefing products.

## 1. Dataset inventory from the uploaded files

Use the two uploaded Excel files as the source data:

- `sgp_projects.xls`: main project-level table.
- `sgp_cofinancing.xls`: one-to-many cofinancing detail table linked through `PROJECTNUMBER`.

### Main project table: `sgp_projects.xls`

Source row count: **30,753 project records**.
Unique `PROJECTNUMBER` values: **30,696**.
Duplicate `PROJECTNUMBER` groups: **50**, with up to **8** rows for one project number.
Countries: **136**.
Regions: **5**.
Focal areas: **8**.
Start years: **35**, ranging from **1992 to 2026**.
Statuses: **5**.
Funding sources: **108**.
Operational phases: **29**.

Columns:

```text
PROJECTNUMBER
OPERATIONALPHASETXT
FULLGRANT
PROJECTCATEGORYTXT
PROJECTTITLE
REGIONID
GRANTAMOUNT
COUNTRYNAME
INSTITUTIONALTYPETXT
COMPANYTITLE
FOCALAREA
PROJECTSTATUSTXT
STARTMONTH
STARTYEAR
COFINANCINGAMOUNTCASH
COFINANCINGAMOUNTKIND
NSCAPPROVALDATE
FUNDINGSOURCE
STARTDATE
ENDDATE
MOASIGNEDDATE
```

Important totals from the project table:

```text
Project records:              30,753
Unique project numbers:       30,696
Grant amount:                 USD 872,211,519.02
Cash cofinancing:             USD 440,797,301.77
In-kind cofinancing:          USD 579,775,852.78
Total cofinancing:            USD 1,020,573,154.55
Total investment:             USD 1,892,784,673.57
```

Top project dimensions:

```text
Regions by project count:
RBA      9,001
RBLAC    8,829
RBAP     7,757
RBEC     3,406
RBAS     1,760

Focal areas by project count:
Biodiversity                  14,008
Climate Change                 6,127
Land Degradation               4,696
Multifocal Area                1,603
Capacity Development           1,209
International Waters           1,164
Chemicals and Waste            1,062
Climate Change Adaptation        835
Missing                           49

Statuses by project count:
Satisfactorily Completed                                 26,900
Project Terminated Before Completion                      2,403
Currently under execution                                   978
Project Activities Completed, Final Report Pending          388
Not active yet                                               84

Institutional types by project count:
Non-government Organization     19,307
Community Based Organization    10,719
Other                              643
Missing                            84

Project categories:
Regular     30,251
Strategic      502
```

Region-level financial totals:

```text
RBA:   9,001 projects | USD 265.42m grant | USD 259.15m cofinancing | USD 524.57m total investment
RBLAC: 8,829 projects | USD 252.47m grant | USD 320.09m cofinancing | USD 572.55m total investment
RBAP:  7,757 projects | USD 213.99m grant | USD 245.86m cofinancing | USD 459.85m total investment
RBEC:  3,406 projects | USD 85.09m grant  | USD 127.80m cofinancing | USD 212.89m total investment
RBAS:  1,760 projects | USD 55.24m grant  | USD 67.67m cofinancing  | USD 122.91m total investment
```

Focal-area financial totals:

```text
Biodiversity:               14,008 projects | USD 389.52m grant | USD 465.87m cofinancing | USD 855.40m total investment
Climate Change:              6,127 projects | USD 183.21m grant | USD 230.52m cofinancing | USD 413.73m total investment
Land Degradation:            4,696 projects | USD 133.47m grant | USD 151.11m cofinancing | USD 284.58m total investment
Capacity Development:        1,209 projects | USD 37.76m grant  | USD 27.22m cofinancing  | USD 64.98m total investment
Multifocal Area:             1,603 projects | USD 35.51m grant  | USD 36.05m cofinancing  | USD 71.56m total investment
Chemicals and Waste:         1,062 projects | USD 33.52m grant  | USD 40.15m cofinancing  | USD 73.67m total investment
International Waters:        1,164 projects | USD 31.36m grant  | USD 43.52m cofinancing  | USD 74.88m total investment
Climate Change Adaptation:     835 projects | USD 25.90m grant  | USD 25.43m cofinancing  | USD 51.33m total investment
```

Top countries by grant amount:

```text
Brazil                  495 projects | USD 22.59m grant | USD 38.06m investment
Mexico                  855 projects | USD 22.47m grant | USD 50.15m investment
Kenya                   484 projects | USD 15.65m grant | USD 27.47m investment
Indonesia               722 projects | USD 15.53m grant | USD 33.66m investment
India                   514 projects | USD 15.21m grant | USD 42.24m investment
Costa Rica              705 projects | USD 15.13m grant | USD 43.87m investment
Tanzania                458 projects | USD 14.03m grant | USD 20.38m investment
Bolivia                 484 projects | USD 13.80m grant | USD 27.12m investment
Philippines             358 projects | USD 13.69m grant | USD 22.85m investment
Peru                    386 projects | USD 13.65m grant | USD 24.38m investment
Senegal                 409 projects | USD 13.57m grant | USD 22.38m investment
Dominican Republic      534 projects | USD 12.96m grant | USD 52.08m investment
Ecuador                 399 projects | USD 12.65m grant | USD 29.19m investment
Mali                    470 projects | USD 12.62m grant | USD 29.13m investment
Sri Lanka               497 projects | USD 12.39m grant | USD 19.22m investment
```

### Cofinancing table: `sgp_cofinancing.xls`

Source row count: **56,808 cofinancing rows**.
Unique linked `PROJECTNUMBER` values: **29,240**.
Every cofinancing project number exists in the project table.
There are **1,456 unique project numbers** in the project table with no detailed cofinancing rows.
The detailed cofinancing table totals match the project table totals globally.
There are **60 row-level mismatch cases** when comparing project-level cofinancing values with cofinancing rows aggregated by `PROJECTNUMBER`; most are caused by duplicate project numbers or row-level source-data differences. Surface this in the data quality panel.

Columns:

```text
PROJECTNUMBER
OPERATIONALPHASETXT
PROJECTTITLE
REGIONID
GRANTAMOUNT
COUNTRYNAME
FOCALAREA
STARTMONTH
STARTYEAR
COMPANYTITLE
COMPANYTYPETXT
COMPANYCOUNTRYID
COMPANYCOUNTRYNAME
AMOUNTCASH
AMOUNTKIND
```

Cofinancing by company type:

```text
Grantee                              24,013 rows | 21,858 projects | USD 392.95m total
National NGO                          8,317 rows |  7,150 projects | USD 135.09m total
National Government                   4,893 rows |  3,634 projects | USD 114.04m total
Multilateral Organization             3,995 rows |  3,381 projects | USD 104.71m total
Local Government                      6,446 rows |  5,176 projects | USD 88.82m total
Private Sector                        4,649 rows |  3,372 projects | USD 75.31m total
International NGO                     1,737 rows |  1,497 projects | USD 38.01m total
Bilateral (government) Donor            861 rows |    744 projects | USD 26.51m total
Foundation                              848 rows |    751 projects | USD 17.67m total
National Environmental Fund             443 rows |    391 projects | USD 16.02m total
International Charitable Organization   355 rows |    305 projects | USD 8.11m total
UNDP TRAC                                70 rows |     69 projects | USD 1.31m total
Transnational Corporation                94 rows |     84 projects | USD 1.31m total
Missing                                  87 rows |     77 projects | USD 0.72m total
```

## 2. Build goal

Create an interactive dashboard that makes the dataset feel like a grant portfolio intelligence system rather than a static spreadsheet. It should allow a user to:

1. Filter by geography, time, focal area, funding source, status, grant type, institution, cofinancer type, cofinancer country, amount ranges, and free text.
2. Use map, chart, table, and AI search interactions as filter inputs.
3. View portfolio totals, distributions, relationships, outliers, and country profiles.
4. Compare regions, countries, focal areas, operational phases, years, and cofinancer types.
5. Export filtered data, charts, maps, country profiles, and briefing-ready summaries.
6. Understand source data quality, duplicate project numbers, missing values, and join limitations.

## 3. Recommended stack

Use this stack unless the existing repository already has equivalent choices:

```text
Frontend:        React + TypeScript + Vite
Visualization:   D3 for custom SVG, scales, layouts, transitions, geo projections, Sankey/force/treemap patterns
Mapping:         D3 geo + topojson-client or local Natural Earth GeoJSON
State:           Zustand or React reducer/context with typed selectors
Tables:          @tanstack/react-virtual for large virtualized data tables
Search:          MiniSearch or Fuse.js for local text search
Validation:      Zod for typed data validation
Parsing:         xlsx package for .xls import in the ingestion script
Exports:         d3-dsv, FileSaver, JSZip, html-to-image, jsPDF, SVG serialization
Styling:         Tailwind CSS or CSS modules with design tokens
Testing:         Vitest for data/filter logic and Playwright for dashboard smoke tests
Optional AI API: Server route or Azure Function, never a client-exposed key
```

The dashboard must run fully without an AI API key. Local search, deterministic natural-language parsing, and computed summary generation should work by default. The optional AI endpoint should improve query interpretation and narrative generation when backend credentials are available.

## 4. Repository structure

Create or adapt the repo to this structure:

```text
/data
  /raw
    sgp_projects.xls
    sgp_cofinancing.xls
  /processed
    projects.normalized.json
    cofinancing.normalized.json
    cofinancing.byProject.json
    aggregates.json
    validation-report.json
    search-index.json
    country-aliases.json
/public
  /data
    projects.normalized.json
    cofinancing.normalized.json
    cofinancing.byProject.json
    aggregates.json
    validation-report.json
    search-index.json
  /geo
    countries.geojson or world-atlas topojson asset
/scripts
  ingest.ts
  validate-data.ts
  build-search-index.ts
  build-aggregates.ts
/src
  App.tsx
  main.tsx
  index.css
  /components
    /layout
      DashboardShell.tsx
      HeaderBar.tsx
      Sidebar.tsx
      ViewTabs.tsx
      DataQualityDrawer.tsx
      ExportMenu.tsx
    /filters
      FilterStudio.tsx
      FilterChip.tsx
      FacetCombobox.tsx
      HierarchicalFacet.tsx
      RangeHistogramFilter.tsx
      YearBrush.tsx
      CommandPalette.tsx
      SavedViews.tsx
    /kpis
      KpiRibbon.tsx
      MetricCard.tsx
      MiniDelta.tsx
    /charts
      TimeSeriesChart.tsx
      FocalAreaTreemap.tsx
      SankeyFlows.tsx
      ScatterGalaxy.tsx
      GrantDistribution.tsx
      RegionCountrySunburst.tsx
      CofinancerNetwork.tsx
      RankingBars.tsx
    /map
      WorldChoropleth.tsx
      MapTooltip.tsx
      CountryProfileDrawer.tsx
      MapLegend.tsx
    /table
      ProjectTable.tsx
      ProjectDetailDrawer.tsx
      CofinancingTable.tsx
    /ai
      AiSearchBox.tsx
      AiInsightPanel.tsx
      QueryPlanPreview.tsx
  /lib
    /data
      schema.ts
      loaders.ts
      normalize.ts
      countryMapping.ts
    /filters
      filterTypes.ts
      filterStore.ts
      applyFilters.ts
      parseNaturalLanguageQuery.ts
      savedViews.ts
    /aggregation
      aggregateProjects.ts
      aggregateCofinancing.ts
      metrics.ts
      crossTabs.ts
    /viz
      scales.ts
      color.ts
      formatters.ts
      d3Transitions.ts
    /download
      exportCsv.ts
      exportJson.ts
      exportSvg.ts
      exportPng.ts
      exportPdf.ts
      exportDataPackage.ts
    /ai
      localQueryPlanner.ts
      aiClient.ts
      executeQueryPlan.ts
      insightGenerator.ts
  /workers
    filterWorker.ts
  /tests
    dataValidation.test.ts
    filterLogic.test.ts
    aggregation.test.ts
    aiParser.test.ts
```

## 5. Data model

Create strict TypeScript types and Zod schemas. Use source-faithful fields and derived fields.

```ts
export type RegionId = 'RBA' | 'RBAP' | 'RBAS' | 'RBEC' | 'RBLAC' | string;

export type ProjectRecord = {
  rowId: string;                     // stable source-row id, e.g. p_000001
  projectNumber: string;             // raw PROJECTNUMBER
  projectNumberNormalized: string;   // trimmed, normalized whitespace
  duplicateProjectNumber: boolean;
  duplicateGroupSize: number;

  operationalPhaseText: string;
  operationalPhaseNumber: number | null;
  operationalPhaseYear: number | null;
  fullGrant: boolean;
  projectCategory: string;
  projectTitle: string;

  regionId: RegionId;
  countryName: string;
  countryNameNormalized: string;
  countryIso3: string | null;
  countryMapStatus: 'matched' | 'alias' | 'unmapped';

  institutionalType: string | null;
  granteeName: string | null;         // source COMPANYTITLE in project table
  focalArea: string | null;
  status: string;
  statusGroup: 'completed' | 'active' | 'pipeline' | 'terminated' | 'pending' | 'other';

  startMonth: number | null;
  startYear: number | null;
  startDate: string | null;
  endDate: string | null;
  nscApprovalDate: string | null;
  moaSignedDate: string | null;
  durationMonths: number | null;

  fundingSource: string | null;

  grantAmount: number;
  cofinancingCash: number;
  cofinancingKind: number;
  cofinancingTotal: number;
  totalInvestment: number;
  cofinancingLeverage: number | null; // cofinancingTotal / grantAmount
  cashShareOfCofinancing: number | null;
  inKindShareOfCofinancing: number | null;

  cofinancingRowCount: number;
  cofinancingPartnerCount: number;
  hasDetailedCofinancing: boolean;
};

export type CofinancingRecord = {
  rowId: string;                    // stable source-row id, e.g. c_000001
  projectNumber: string;
  projectNumberNormalized: string;
  linkedProjectRowIds: string[];    // multiple when duplicate project numbers exist

  operationalPhaseText: string;
  projectTitle: string;
  regionId: RegionId;
  grantAmountFromCofinancingFile: number;
  countryName: string;
  countryIso3: string | null;
  focalArea: string | null;
  startMonth: number | null;
  startYear: number | null;

  companyTitle: string | null;
  companyTitleNormalized: string | null;
  companyType: string | null;
  companyCountryId: string | null;
  companyCountryName: string | null;
  companyCountryIso3: string | null;

  amountCash: number;
  amountKind: number;
  amountTotal: number;
};
```

### Derived metric helpers

Implement these in `src/lib/aggregation/metrics.ts`:

```ts
export type MetricKey =
  | 'projectRecords'
  | 'uniqueProjectNumbers'
  | 'countries'
  | 'grantAmount'
  | 'cofinancingCash'
  | 'cofinancingKind'
  | 'cofinancingTotal'
  | 'totalInvestment'
  | 'cofinancingLeverage'
  | 'averageGrant'
  | 'medianGrant'
  | 'activeProjects'
  | 'completedProjects'
  | 'terminatedProjects'
  | 'cofinancingRows'
  | 'cofinancingPartnerCount';
```

Important metric rules:

1. Use the project table for project counts, grant amounts, and project-level cofinancing totals.
2. Use the cofinancing table for cofinancer type, company title, and cofinancer country analytics.
3. When a cofinancer filter is active, compute project metrics on unique project rows whose `PROJECTNUMBER` has matching cofinancing rows. Compute cofinancer metrics on the matching cofinancing rows.
4. Preserve source-row totals by default. Add a toggle for `Project records` versus `Unique project numbers` where relevant.
5. Guard against divide-by-zero for `cofinancingLeverage` when `grantAmount` is zero.
6. Display a small data-quality badge when a filter touches duplicate project numbers or row-level cofinancing mismatches.

## 6. Ingestion and validation instructions

Create `scripts/ingest.ts` that:

1. Reads `data/raw/sgp_projects.xls` and `data/raw/sgp_cofinancing.xls` with the `xlsx` package.
2. Extracts the first worksheet from each file.
3. Converts blank strings to `null` for text fields and `0` for financial amount fields where the source implies zero.
4. Trims whitespace and normalizes repeated spaces.
5. Preserves original string values where display fidelity matters.
6. Parses numbers safely from `GRANTAMOUNT`, `COFINANCINGAMOUNTCASH`, `COFINANCINGAMOUNTKIND`, `AMOUNTCASH`, `AMOUNTKIND`, `STARTMONTH`, and `STARTYEAR`.
7. Parses date-like fields from both `YYYY/M/D` and `YYYY-MM-DD` into ISO strings where possible.
8. Adds derived financial fields.
9. Adds duplicate project-number metadata.
10. Builds `cofinancing.byProject.json` as a dictionary keyed by normalized `PROJECTNUMBER`.
11. Writes processed files to `data/processed` and mirrors them to `public/data`.
12. Writes a validation report with counts, totals, missingness, duplicate project-number groups, unmapped countries, and cofinancing mismatch cases.

The validation report must check these source totals:

```ts
expect(projects.length).toBe(30753);
expect(uniqueProjectNumbers).toBe(30696);
expect(cofinancing.length).toBe(56808);
expect(cofinancingUniqueProjectNumbers).toBe(29240);
expect(round2(sum(projects, 'grantAmount'))).toBe(872211519.02);
expect(round2(sum(projects, 'cofinancingCash'))).toBe(440797301.77);
expect(round2(sum(projects, 'cofinancingKind'))).toBe(579775852.78);
expect(round2(sum(cofinancing, 'amountCash'))).toBe(440797301.77);
expect(round2(sum(cofinancing, 'amountKind'))).toBe(579775852.78);
```

Create `scripts/build-aggregates.ts` that precomputes:

```text
byCountry
byRegion
byFocalArea
byYear
byOperationalPhase
byStatus
byFundingSource
byInstitutionalType
byProjectCategory
byFullGrant
byCofinancerType
byCofinancerCountry
countryByFocalArea
countryByYear
countryByStatus
regionByFocalArea
regionByYear
focalAreaByYear
focalAreaByStatus
fundingSourceByYear
cofinancerTypeByFocalArea
cofinancerTypeByRegion
cofinancerCountryByProjectCountry
```

Each aggregate row should include:

```ts
{
  key: string;
  label: string;
  projectRecords: number;
  uniqueProjectNumbers: number;
  countries: number;
  grantAmount: number;
  cofinancingCash: number;
  cofinancingKind: number;
  cofinancingTotal: number;
  totalInvestment: number;
  averageGrant: number | null;
  medianGrant: number | null;
  cofinancingLeverage: number | null;
  activeProjects: number;
  completedProjects: number;
  terminatedProjects: number;
  cofinancingRows?: number;
  cofinancingPartnerCount?: number;
}
```

## 7. Country mapping for choropleths

Implement `src/lib/data/countryMapping.ts` with a robust normalizer:

1. Uppercase.
2. Trim and normalize whitespace.
3. Remove diacritics using Unicode normalization.
4. Remove punctuation that differs across sources.
5. Apply manual aliases before matching to the GeoJSON properties.

Include at least these aliases:

```ts
const COUNTRY_ALIASES: Record<string, string> = {
  'BOLIVIA (PLURINATIONAL STATE OF)': 'BOL',
  'CONGO (DEMOCRATIC REPUBLIC OF THE)': 'COD',
  'CONGO (THE DEMOCRATIC REPUBLIC OF THE)': 'COD',
  'IRAN (ISLAMIC REPUBLIC OF)': 'IRN',
  'TANZANIA (UNITED REPUBLIC OF)': 'TZA',
  'VIET NAM': 'VNM',
  'TURKIYE': 'TUR',
  'TÜRKIYE': 'TUR',
  "COTE D'IVOIRE": 'CIV',
  "CÔTE D'IVOIRE": 'CIV',
  'LAO PEOPLE\'S DEMOCRATIC REPUBLIC': 'LAO',
  'MOLDOVA (REPUBLIC OF)': 'MDA',
  'SYRIAN ARAB REPUBLIC': 'SYR',
  'VENEZUELA (BOLIVARIAN REPUBLIC OF)': 'VEN',
  'PALESTINE, STATE OF': 'PSE',
  'MICRONESIA (FEDERATED STATES OF)': 'FSM',
  'KOREA (DEMOCRATIC PEOPLE\'S REPUBLIC OF)': 'PRK',
  'KOREA (REPUBLIC OF)': 'KOR',
  'CABO VERDE': 'CPV',
  'ESWATINI': 'SWZ',
  'SAINT KITTS AND NEVIS': 'KNA',
  'SAINT LUCIA': 'LCA',
  'SAINT VINCENT AND THE GRENADINES': 'VCT',
  'SAO TOME AND PRINCIPE': 'STP'
};
```

Generate `validation-report.json.unmappedCountries` and expose it in the data quality drawer. The choropleth should still work when some countries remain unmapped, and the UI should list any missing countries with project counts and totals.

## 8. Filter state model

Create a typed global filter model:

```ts
export type FilterMode = 'include' | 'exclude';
export type FacetOperator = 'any' | 'all';

export type DashboardFilters = {
  text: string;
  countries: string[];
  regions: string[];
  focalAreas: string[];
  statuses: string[];
  statusGroups: string[];
  operationalPhases: string[];
  startYearRange: [number | null, number | null];
  grantAmountRange: [number | null, number | null];
  cofinancingTotalRange: [number | null, number | null];
  cofinancingLeverageRange: [number | null, number | null];
  fundingSources: string[];
  institutionalTypes: string[];
  projectCategories: string[];
  fullGrant: boolean | null;
  granteeNames: string[];

  cofinancerTypes: string[];
  cofinancerCountries: string[];
  cofinancerNames: string[];

  facetMode: Record<string, FilterMode>;
  facetOperator: Record<string, FacetOperator>;
  compareMode: boolean;
  comparisonA?: Partial<DashboardFilters>;
  comparisonB?: Partial<DashboardFilters>;
};
```

Filtering requirements:

1. Every chart and map must read from the same filtered result object.
2. Chart clicks should add or remove filters.
3. Brush selections on time and amount charts should update range filters.
4. The filter state should serialize to URL parameters.
5. The user should be able to copy a shareable link.
6. The user should be able to save named local views in localStorage.
7. Active filters should appear as removable chips in a top ribbon.
8. Add `Reset`, `Undo`, `Redo`, and `Compare current selection` controls.
9. Add a command palette shortcut, such as `/` or `Ctrl/Cmd+K`, to search filters, countries, projects, and actions.

## 9. Filter UI design

Create a visually strong filter system called **Filter Studio**. It should feel like a portfolio control panel rather than a set of form controls.

Layout:

```text
Top header:     title, global search/AI box, export menu, data quality badge, theme toggle
KPI ribbon:     project records, countries, grant, cofinancing, total investment, leverage
Left panel:     Filter Studio with grouped facets and range controls
Main canvas:    tabs/views for Atlas, Trends, Finance, Networks, Table, Data Quality
Right drawer:   Country profile, project detail, AI insight, or chart explanation
Bottom ribbon:  active filter chips and current filtered population summary
```

Filter Studio groups:

```text
Where
- Region
- Country
- Cofinancer country

What
- Focal area
- Project status
- Status group
- Funding source
- Operational phase
- Project category
- Full grant

Who
- Institutional type
- Grantee / company title
- Cofinancer type
- Cofinancer name

When
- Start year brush
- Start month
- Start date / end date where usable

Finance
- Grant amount range with histogram
- Cofinancing total range with histogram
- Cash / in-kind toggle
- Cofinancing leverage range
```

Aesthetic techniques to implement:

1. Facets show live counts and filtered totals.
2. Each selected chip carries its color category, metric count, and a remove button.
3. Large facets use searchable grouped comboboxes with pinned top values and a “show all” drawer.
4. Numeric filters use D3 mini-histograms behind range sliders.
5. Focal areas can use a compact radial dial or colored segmented selector.
6. Years use a brushable mini timeline with stacked focal-area bars.
7. The left panel has compact and expanded modes.
8. Add a “filter recipe” panel that summarizes the current selection in plain English.
9. Add compare slots A and B so users can compare two saved filter states.

## 10. Core views and D3 visualizations

### A. Atlas view

Components:

1. `WorldChoropleth`
2. `KpiRibbon`
3. `RankingBars`
4. `CountryProfileDrawer`

Map requirements:

- Use D3 geo projection and SVG paths.
- Support at least these map metrics:
  - project records
  - unique project numbers
  - grant amount
  - cash cofinancing
  - in-kind cofinancing
  - total cofinancing
  - total investment
  - cofinancing leverage
  - average grant
  - active projects
- Include a metric selector in the map legend.
- Use quantize/threshold/log scales as appropriate, with a toggle between linear, log, and quantile.
- Tooltip should show country name, region, project count, grant, cash cofinancing, in-kind cofinancing, total investment, top focal areas, and top statuses.
- Clicking a country toggles it as a filter.
- Shift-click adds country to current selection.
- Double click or a button zooms to country bounds.
- Add a “Reset map” button.
- Add optional bubbles for project count or investment over the choropleth.
- Add a “small multiples by focal area” option for regional choropleth mini-maps if performance allows.
- Show unmapped countries in a small warning panel with their totals.

Ranking bars:

- Show top countries, regions, and focal areas by selected metric.
- Bars should be clickable filters.
- Add compact toggles for `Top`, `Bottom`, and `Outliers`.

### B. Trends view

Components:

1. `TimeSeriesChart`
2. `YearBrush`
3. `FocalAreaTreemap`
4. `GrantDistribution`

Time series requirements:

- Default chart: stacked area or stacked bars by focal area over `STARTYEAR`.
- Metric selector: project count, grant amount, total cofinancing, total investment.
- Brush on the x-axis updates `startYearRange`.
- Legend toggles focal areas.
- Add a mode for region split, with small multiples by region.
- Add hover vertical ruler with year totals.

Distribution requirements:

- Grant amount distribution by focal area or region.
- Use log scale toggle.
- Add boxplot or violin option if feasible.
- Brushing a grant range updates the filter.

### C. Finance view

Components:

1. `SankeyFlows`
2. `CofinancingTypeBars`
3. `ScatterGalaxy`
4. `LeverageExplorer`

Sankey requirements:

- Show flows such as:
  - Region → Focal Area → Funding Source
  - Focal Area → Cofinancer Type
  - Project Country → Cofinancer Country
  - Funding Source → Status Group
- Let user select metric: grant, cash cofinancing, in-kind cofinancing, total investment.
- Nodes and links should be hoverable and clickable filters.
- Display exact values and percentages in tooltips.

Scatter requirements:

- X-axis: grant amount.
- Y-axis: total cofinancing or cofinancing leverage.
- Color: focal area.
- Size: total investment.
- Shape or stroke: status group.
- Tooltips show project title, country, grant, cofinancing, grantee, status, and year.
- Add lasso selection or rectangular brush to create a filter.
- Add outlier labels for largest projects and highest leverage projects.

Leverage explorer:

- Rank countries or focal areas by cofinancing leverage.
- Show cash versus in-kind shares.
- Flag zero-grant or extreme-leverage cases.

### D. Networks view

Components:

1. `CofinancerNetwork`
2. `RegionCountrySunburst`
3. `FundingSourceTreemap`

Network requirements:

- Build an aggregated graph from cofinancing rows.
- Nodes can be project countries, cofinancer countries, cofinancer types, focal areas, or funding sources.
- Edges represent cofinancing totals or project counts.
- Add controls for node mode and edge metric.
- Add threshold slider to reduce clutter.
- Clicking a node applies a filter.
- Hover shows total amount, number of projects, and top connected entities.

Sunburst/treemap requirements:

- Hierarchy options:
  - Region → Country → Focal Area
  - Region → Focal Area → Status
  - Funding Source → Focal Area → Country
- Use D3 hierarchy and D3 partition/treemap.
- Clicking zooms into hierarchy and updates filters only when the user uses an explicit “Apply as filter” action.

### E. Table view

Components:

1. `ProjectTable`
2. `ProjectDetailDrawer`
3. `CofinancingTable`

Table requirements:

- Use virtualized rows.
- Columns should be sortable, resizable, and hideable.
- Add global search and column filters.
- Support row selection and bulk export.
- Use project detail drawer with:
  - title
  - project number
  - country/region/focal area/status/year
  - grant and cofinancing breakdown
  - grantee/institutional type
  - funding source
  - start/end/MOA/NSC dates
  - cofinancing partner list from the detail table
  - duplicate project-number warning when relevant
  - similar projects based on country, focal area, year, and text similarity

### F. Data Quality view

Components:

1. `DataQualityDashboard`
2. `ValidationReportPanel`
3. `MissingnessMatrix`
4. `DuplicateProjectNumberTable`
5. `CountryMappingReport`

Data Quality requirements:

- Show source row counts and total checks.
- Show missing counts by field.
- Show duplicate project-number groups.
- Show cofinancing mismatch cases.
- Show countries that failed geospatial mapping.
- Add download button for the validation report.
- Explain metric rules in plain language.

## 11. AI-assisted search and filtering

Implement a local-first AI layer with an optional server-side LLM endpoint.

### Local search

Create a text index over:

```text
projectTitle
projectNumber
countryName
regionId
focalArea
projectStatus
fundingSource
grantAmount buckets
granteeName
cofinancer company title
cofinancer type
cofinancer country
operational phase
```

The search box should support:

- Exact project number search.
- Free-text project title search.
- Entity search for countries, focal areas, funding sources, company names.
- Natural-language filter extraction.

Examples that should work locally:

```text
active biodiversity projects in RBA after 2020
climate change projects in Mexico and Costa Rica with cofinancing above 50000
private sector cofinancing in India
terminated projects with grant above 100000
land degradation in Africa from 2015 to 2020
highest cofinancing leverage in Dominican Republic
projects funded by GEF STAR in RBAP
```

### Query plan schema

Every AI/local parser result should produce this JSON structure before execution:

```ts
export type AiQueryPlan = {
  interpretedQuestion: string;
  confidence: number;
  filterPatch: Partial<DashboardFilters>;
  aggregation?: {
    metric: MetricKey;
    groupBy: 'country' | 'region' | 'focalArea' | 'year' | 'status' | 'fundingSource' | 'cofinancerType' | 'cofinancerCountry';
    sort: 'asc' | 'desc';
    limit?: number;
  };
  visualizationHint?: 'map' | 'bar' | 'time' | 'scatter' | 'sankey' | 'table';
  explanation: string;
  warnings: string[];
};
```

The UI should show `QueryPlanPreview` before applying complex plans, with buttons:

```text
Apply filters
Apply and open suggested view
Edit plan
Cancel
```

### Optional AI endpoint

Add an optional backend route, such as `/api/ai/query-plan`, using environment variables on the server side. The frontend should call this endpoint only when configured. The endpoint should:

1. Receive the raw user question, current filter state, schema summary, and allowed values.
2. Return an `AiQueryPlan` matching the schema.
3. Avoid returning raw code or arbitrary SQL.
4. Use strict JSON validation with Zod.
5. Fall back to the local parser on failure.

Add another optional endpoint `/api/ai/summary` for a narrative summary of the current filtered result. It should receive computed metrics and top aggregate rows, then generate a short briefing-ready summary. The deterministic local version should work without the endpoint.

### AI insight panel

Create insight cards based on computed data:

```text
Largest country portfolio
Fastest-rising focal area by project count
Highest cofinancing leverage countries
Highest cash cofinancing share
Highest in-kind cofinancing share
Countries with many projects and low cofinancing leverage
Focal areas with high termination share
Projects with missing detailed cofinancing
Duplicate project-number groups in current filter
```

Each insight card must include:

```text
Metric
Value
Why it matters
Source basis: filtered project records, filtered cofinancing rows, or validation report
Button to apply related filter or open the relevant view
```

## 12. Downloads, sharing, and reporting

Implement an `ExportMenu` with:

1. Download filtered project records as CSV.
2. Download filtered cofinancing rows as CSV.
3. Download combined project + cofinancing data package as ZIP.
4. Download current aggregate table as CSV.
5. Download validation report as JSON.
6. Download current map as SVG and PNG.
7. Download current D3 chart as SVG and PNG.
8. Export current dashboard view as PDF.
9. Generate a briefing note in Markdown from the current filtered state.
10. Copy shareable URL with filters encoded.
11. Save current view locally.
12. Export and import filter recipes as JSON.

Briefing note template:

```md
# SGP portfolio snapshot: {filterSummary}

## Key figures
- {projectRecords} project records across {countries} countries.
- USD {grantAmount} in grants.
- USD {cofinancingTotal} in cofinancing, including USD {cofinancingCash} cash and USD {cofinancingKind} in-kind.
- USD {totalInvestment} total investment.
- Cofinancing leverage: {cofinancingLeverage}.

## Main patterns
{autoGeneratedBulletsFromTopAggregates}

## Leading countries
{topCountriesTable}

## Focal area distribution
{focalAreaTable}

## Data notes
{dataQualityNotes}
```

## 13. Visual design system

Create a professional, modern SGP dashboard aesthetic:

- Overall feel: data atlas, knowledge platform, portfolio intelligence.
- Use a clean dark or light theme with a UNDP-compatible blue accent and focal-area color tokens.
- Provide a theme toggle: `Light`, `Dark`, and `Presentation`.
- Use high contrast text and colorblind-safe chart palettes.
- Use soft panels, subtle gradients, thin outlines, and animated transitions that respect `prefers-reduced-motion`.
- Use large KPI typography and compact dense tables.
- Use sticky filter and KPI areas so users keep context while exploring.
- Add tasteful loading skeletons and empty states.
- Use responsive layout for desktop and tablet.

Suggested tokens:

```ts
export const tokens = {
  colors: {
    undpBlue: '#006EB5',
    deepBlue: '#071A2F',
    ocean: '#0E7490',
    forest: '#2F855A',
    amber: '#D97706',
    rose: '#BE123C',
    violet: '#6D28D9',
    slate: '#334155',
    panel: 'var(--panel)',
    border: 'var(--border)',
    text: 'var(--text)',
    muted: 'var(--muted)'
  },
  focalAreas: {
    Biodiversity: '#2F855A',
    'Climate Change': '#006EB5',
    'Land Degradation': '#B7791F',
    'Multifocal Area': '#6D28D9',
    'Capacity Development': '#0E7490',
    'International Waters': '#0284C7',
    'Chemicals and Waste': '#BE123C',
    'Climate Change Adaptation': '#16A34A',
    Missing: '#64748B'
  }
};
```

## 14. Performance requirements

The data size is moderate: 30,753 project rows and 56,808 cofinancing rows. The app should still feel instant.

Implement:

1. Data loading with compressed JSON assets.
2. Filtering in a Web Worker.
3. Memoized aggregate functions.
4. Precomputed aggregates for initial global views.
5. Virtualized project and cofinancing tables.
6. Debounced text search.
7. Progressive rendering for force/network layouts.
8. SVG charts sized to the visible panel.
9. Avoid rerendering all chart components on every keystroke; only update after debounced filter state changes.

Target behavior:

```text
Initial dashboard usable after data loads.
Facet count refresh within roughly 100–250 ms on normal laptops.
Table scrolling remains smooth.
Map hover remains responsive.
Network layout remains readable through thresholds and aggregation.
```

## 15. Implementation sequence for Codex

Follow this sequence. Keep each step committed or logically separated.

### Step 1: Project setup

- Create or update a Vite React TypeScript app.
- Add dependencies for D3, xlsx, zod, Zustand, virtualized tables, search, and export tools.
- Add linting and formatting if missing.
- Add basic scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "ingest": "tsx scripts/ingest.ts",
    "validate:data": "tsx scripts/validate-data.ts",
    "build:aggregates": "tsx scripts/build-aggregates.ts",
    "build:search": "tsx scripts/build-search-index.ts",
    "test": "vitest run"
  }
}
```

### Step 2: Data ingestion

- Implement `scripts/ingest.ts`.
- Ensure it can read `.xls` files from `data/raw`.
- Generate normalized JSON files.
- Generate validation report.
- Print the key source checks at the end of the script.
- Add helpful errors when files are missing.

### Step 3: Data loaders and schemas

- Implement `src/lib/data/schema.ts` with Zod schemas.
- Implement `src/lib/data/loaders.ts` to fetch processed JSON from `/data`.
- Add TypeScript types derived from the schemas.
- Ensure the app shows a clear loading state and a clear data-load failure state.

### Step 4: Filter engine

- Implement filter types, Zustand store, URL serialization, undo/redo, and saved views.
- Implement `applyFilters.ts` with full project and cofinancing logic.
- Implement Web Worker filtering.
- Add tests for core filters.

### Step 5: Aggregation engine

- Implement aggregate functions for project metrics and cofinancer metrics.
- Add tests that match the source totals listed above.
- Add top-N and cross-tab functions.

### Step 6: Dashboard shell and KPI ribbon

- Build the main layout.
- Add the header, Filter Studio, KPI ribbon, active chips, view tabs, and data quality badge.
- Make the layout responsive.

### Step 7: Atlas view

- Implement the D3 choropleth map.
- Add metric selector, legend, tooltips, zoom, click filters, and country profile drawer.
- Add ranking bars.
- Validate country mapping and expose unmapped countries.

### Step 8: Trends and finance views

- Implement time series, year brush, grant distribution, treemap, Sankey, and scatter.
- Wire all chart clicks and brushes to filters.

### Step 9: Table and detail drawers

- Implement virtualized project table.
- Implement project detail drawer with cofinancing rows.
- Add cofinancing table and row-level export.

### Step 10: AI search and insight layer

- Implement MiniSearch/Fuse index.
- Implement local natural language parser.
- Implement query plan preview.
- Implement deterministic insight generator.
- Add optional API client hooks for server-side AI query planning and summaries, guarded by environment configuration.

### Step 11: Export features

- Implement CSV, JSON, ZIP, SVG, PNG, PDF, Markdown briefing note, validation report download, and shareable URL.
- Add tests for CSV generation and filter recipe serialization.

### Step 12: Data Quality view and final polish

- Implement validation panels, missingness matrix, duplicate table, mismatch table, country mapping report.
- Add empty states and polished tooltips.
- Add accessibility labels and keyboard navigation.
- Run build and tests.

## 16. Component contracts

### `KpiRibbon`

Props:

```ts
type KpiRibbonProps = {
  metrics: PortfolioMetrics;
  previousMetrics?: PortfolioMetrics;
  loading?: boolean;
  onMetricClick?: (metric: MetricKey) => void;
};
```

Cards:

```text
Project records
Countries
Grant amount
Cash cofinancing
In-kind cofinancing
Total cofinancing
Total investment
Cofinancing leverage
Active projects
Terminated projects
```

### `WorldChoropleth`

Props:

```ts
type WorldChoroplethProps = {
  geojson: GeoJSON.FeatureCollection;
  countryAggregates: CountryAggregate[];
  selectedCountries: string[];
  metric: MetricKey;
  scaleMode: 'linear' | 'log' | 'quantile';
  onCountryToggle: (iso3: string, mode?: 'replace' | 'add' | 'remove') => void;
  onCountryProfileOpen: (iso3: string) => void;
};
```

Interactions:

```text
hover -> tooltip
click -> toggle country filter
double click -> zoom to country
legend click -> change scale bin focus where useful
export button -> SVG/PNG
```

### `FilterStudio`

Props:

```ts
type FilterStudioProps = {
  filters: DashboardFilters;
  facetCounts: FacetCountBundle;
  amountHistograms: AmountHistogramBundle;
  onChange: (patch: Partial<DashboardFilters>) => void;
  onReset: () => void;
};
```

### `ProjectDetailDrawer`

Props:

```ts
type ProjectDetailDrawerProps = {
  project: ProjectRecord | null;
  cofinancingRows: CofinancingRecord[];
  similarProjects: ProjectRecord[];
  onClose: () => void;
  onFilterApply: (patch: Partial<DashboardFilters>) => void;
};
```

### `AiSearchBox`

Props:

```ts
type AiSearchBoxProps = {
  currentFilters: DashboardFilters;
  allowedValues: AllowedFilterValues;
  onPlanGenerated: (plan: AiQueryPlan) => void;
  onApplyPlan: (plan: AiQueryPlan) => void;
};
```

## 17. Tests and acceptance criteria

Implement unit tests for:

1. Ingestion parses all rows.
2. Totals match source values.
3. Duplicate project-number detection returns 50 groups.
4. Cofinancing links all project numbers to project records or reports missing project rows; expected missing from project table is zero.
5. 1,456 unique project numbers have no detailed cofinancing rows.
6. Country mapping returns ISO3 codes for the top 30 countries by project count.
7. Filters combine correctly across country, focal area, year, grant range, and cofinancer type.
8. Cofinancer filters avoid double-counting project grant amounts.
9. CSV export includes only filtered rows.
10. Natural-language parser handles at least the example queries listed in this brief.

Implement Playwright smoke tests for:

```text
Dashboard loads.
KPI totals appear.
Map renders.
Clicking Mexico filters the dashboard.
Year brush updates active filter chips.
AI search “active biodiversity projects in RBA after 2020” creates the expected filters.
Project table opens a detail drawer.
CSV export button produces a file.
Data quality drawer shows validation counts.
```

Final acceptance criteria:

```text
npm run ingest passes and writes processed files.
npm run validate:data passes.
npm test passes.
npm run build passes.
Dashboard displays the correct global KPIs.
All major charts respond to filters.
The choropleth shows country-level values and clickable tooltips.
The table can inspect individual projects and cofinancing rows.
Export menu works for CSV, JSON, SVG, PNG, PDF, Markdown, and ZIP.
AI/local search can create structured filter plans.
Data quality issues are visible and understandable.
The interface is polished, responsive, and accessible.
```

## 18. Example dashboard presets

Create these saved preset views:

```text
Global portfolio overview
Active and pipeline projects
Biodiversity portfolio
Climate change portfolio
High cofinancing leverage
Private sector cofinancing
Government cofinancing
Projects started since 2020
Terminated projects
Strategic projects
Africa regional overview
Asia-Pacific regional overview
Latin America and Caribbean regional overview
```

Each preset should be a named filter recipe and view preference.

## 19. Example AI/local query mappings

```text
“active biodiversity projects in RBA after 2020”
-> filters: statusGroup active, focalArea Biodiversity, region RBA, startYearRange [2021, null]
-> suggested view: Table or Atlas

“highest cofinancing leverage in Dominican Republic”
-> filters: country Dominican Republic
-> aggregation: metric cofinancingLeverage, groupBy country or project, desc
-> suggested view: Finance

“private sector cofinancing in India”
-> filters: country India, cofinancerTypes Private Sector
-> suggested view: Finance or Table

“compare climate change and biodiversity in RBAP since 2015”
-> filters: region RBAP, focalAreas Climate Change and Biodiversity, startYearRange [2015, null]
-> suggested view: Trends

“GEF STAR projects in land degradation”
-> filters: fundingSources containing GEF STAR, focalArea Land Degradation
-> suggested view: Atlas or Table
```

## 20. Coding standards

- Use TypeScript everywhere.
- Keep data transformation logic outside React components.
- Keep D3 chart logic in isolated components with clear props.
- Use React for rendering structure and D3 for scales, layouts, path generation, axes, and transitions.
- Keep all financial formatting centralized in `formatters.ts`.
- Use `Intl.NumberFormat` for USD values.
- Keep map and chart colors centralized in `color.ts`.
- Add accessible labels to controls and SVG charts.
- Respect reduced-motion preferences.
- Handle empty filtered states gracefully.
- Show data-quality caveats where relevant.
- Keep optional AI features behind clear configuration and never expose server-side API keys in the client bundle.

## 21. Final deliverable

The final repo should contain a working dashboard with:

```text
Processed SGP datasets
Validated source totals
Interactive D3 choropleth atlas
Filter Studio with live facets, chips, brushes, and saved views
KPI ribbon
Trends, Finance, Networks, Table, and Data Quality views
AI/local search and query-plan preview
Export menu for data, visuals, reports, and filter recipes
Responsive, polished visual design
Passing tests and successful production build
```
