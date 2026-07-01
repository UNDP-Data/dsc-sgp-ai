# SGP Portfolio Intelligence Dashboard

Interactive React/Vite/TypeScript dashboard for the SGP project and cofinancing
datasets. The app includes D3 charts and choropleths, cross-filtering, natural
language filter assistance, exports, and project/country detail panels.

This folder now contains frontend source only. The XLS ingestion pipeline moved
to `../../SGP-Data-Pipeline/01_Code/src/sgp_pipeline/processors/dashboard`.

## Runtime Data

The app reads compact runtime data from:

```text
app/public/data/projects.runtime.json
app/public/data/cofinancing.runtime.json
app/public/data/content-profiles.json
app/public/data/country-aliases.json
app/public/data/data-dictionary.json
app/public/geo/world-countries.geojson
```

Refresh those files through the data pipeline, not with frontend npm scripts.

## Commands

Run commands from `app/`:

```bash
cd app
npm install
npm test
npm run build:pages
npm run dev
```

The legacy data scripts remain as failing placeholders so accidental frontend
ingestion attempts point maintainers to the pipeline.

## GitHub Pages Deployment

The frontend repository deploys through `.github/workflows/deploy-pages.yml`.
The workflow runs:

```bash
cd app
npm ci
npm test
npm run build:pages
```

`build:pages` uses relative asset paths so the dashboard can be staged under
`/dashboard/` in GitHub Pages.

## Data Validation Basis

Pipeline validation checks the source figures from the implementation brief,
including:

- 30,753 project records
- 30,696 unique project numbers
- 56,808 cofinancing rows
- 29,240 unique cofinancing project numbers
- 50 duplicate `PROJECTNUMBER` groups
- 1,456 project numbers without detailed cofinancing rows
- 60 row-level cofinancing mismatch cases
- Project and detail cofinancing totals matching the expected USD totals

## App Features

- Filter Studio for geography, focal area, status, year, financial ranges,
  institutional type, and cofinancer type.
- KPI ribbon with live filtered portfolio metrics.
- D3 choropleth atlas using local GeoJSON and ISO3 joins.
- Trends, finance, and table views.
- Project detail drawer with cofinancing partner rows.
- Country profile drawer.
- Local natural-language query planner.
- Shareable URL filter state and export menu.
- CSV, JSON, ZIP, PNG, PDF, Markdown briefing, and filter recipe exports.

## Notes

The project table is authoritative for project counts, grants, and
project-level cofinancing totals. The cofinancing table is authoritative for
partner, cofinancer type, and cofinancer geography analytics. Cofinancer
filters select matching project rows by normalized `PROJECTNUMBER` without
multiplying project-level financial metrics by cofinancing row count.
