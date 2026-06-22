# SGP Portfolio Intelligence Dashboard

Interactive React/Vite/TypeScript dashboard for the SGP project and cofinancing datasets. It includes a reproducible XLS ingestion pipeline, dashboard-ready JSON outputs, D3 charts and choropleths, cross-filtering, natural-language filter assistance, exports, and project/country detail panels.

## Data Sources

- `data/raw/sgp_projects.xls`
- `data/raw/sgp_cofinancing.xls`
- `data/geo/world-countries.geojson`

The world GeoJSON was copied from `/Users/ben/Documents/chaskipitch/public/runtime/content/geo/world-countries.geojson`, with provenance in `data/geo/authoritative-provenance.json`.

## Commands

Run commands from `app/`:

```bash
cd app
npm install
npm run ingest
npm run validate:data
npm test
npm run build
npm run dev
```

Additional commands:

```bash
npm run build:aggregates
npm run build:search
npm run build:pages
npm run preview
npm run test:smoke
```

## GitHub Pages Deployment

The repository is ready to deploy through GitHub Actions to GitHub Pages. The workflow lives at `.github/workflows/deploy-pages.yml` and builds the nested Vite app from `app/`.

1. Create a GitHub repository and push this project to its `main` branch.
2. In the GitHub repository, open `Settings -> Pages`.
3. Under `Build and deployment`, set `Source` to `GitHub Actions`.
4. Push to `main`, or run `Deploy SGP Dashboard to GitHub Pages` manually from the `Actions` tab.

The workflow runs:

```bash
cd app
npm ci
npm test
npm run build
```

The deployed artifact is `app/dist`. The workflow automatically sets the Vite base path:

- `https://<owner>.github.io/` repos use `/`
- `https://<owner>.github.io/<repo>/` repos use `/<repo>/`

To test a nested static dashboard build locally before pushing:

```bash
cd app
npm run build:pages
npm run preview
```

`build:pages` uses relative asset paths so the generated files can be served from a nested route such as `/dashboard/` or `/<repo>/dashboard/` without JavaScript and CSS 404s. Open the preview URL shown by Vite and verify that the dashboard loads its data and map assets. All files in `app/public/` are copied into the static site, including the processed dashboard data in `app/public/data/`.

## Generated Outputs

`npm run ingest` writes the same dashboard-ready data to:

- `data/processed/`
- `outputs/data/`
- `app/public/data/`

Key files:

- `projects.normalized.json`
- `cofinancing.normalized.json`
- `cofinancing.byProject.json`
- `aggregates.json`
- `search-index.json`
- `country-aliases.json`
- `data-dictionary.json`

## Validation Basis

`npm run validate:data` checks the source figures from the implementation brief using `data/processed/validation-report.json`, including:

- 30,753 project records
- 30,696 unique project numbers
- 56,808 cofinancing rows
- 29,240 unique cofinancing project numbers
- 50 duplicate `PROJECTNUMBER` groups
- 1,456 project numbers without detailed cofinancing rows
- 60 row-level cofinancing mismatch cases
- Project and detail cofinancing totals matching the expected USD totals

## App Features

- Filter Studio for geography, focal area, status, year, financial ranges, institutional type, and cofinancer type
- KPI ribbon with live filtered portfolio metrics
- D3 choropleth atlas using local GeoJSON and ISO3 joins
- Trends, finance, and table views
- Project detail drawer with cofinancing partner rows
- Country profile drawer
- Local natural-language query planner
- Shareable URL filter state, undo/redo, presets, and export menu
- CSV, JSON, ZIP, PNG, PDF, Markdown briefing, and filter recipe exports

## Notes

The project table is authoritative for project counts, grants, and project-level cofinancing totals. The cofinancing table is authoritative for partner, cofinancer type, and cofinancer geography analytics. Cofinancer filters select matching project rows by normalized `PROJECTNUMBER` without multiplying project-level financial metrics by cofinancing row count.
