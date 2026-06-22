# SGP Dashboard Implementation Instructions

You are implementing a complete interactive dashboard for the SGP project and cofinancing datasets.

Before writing code, read these files in order:

1. `docs/codex_sgp_dashboard_instructions.md`
2. `data/raw/sgp_projects.xls`
3. `data/raw/sgp_cofinancing.xls`
4. all files in `data/geo/`

Use the implementation brief as the main product specification. Preserve the analytical findings, data model, validation requirements, visualization requirements, export features, AI-assisted search/filtering, and choropleth requirements described there.

## Product goal

Build a polished, production-quality dashboard that allows users to explore, filter, visualize, compare, download, and search SGP project and cofinancing data.

The dashboard should include:

- React + TypeScript + Vite frontend
- D3 visualizations
- Choropleth maps using the supplied GeoJSON, or a documented public world-country geometry fallback if `data/geo/` contains no usable GeoJSON
- Cross-filtering between charts, map, tables, and filter panels
- Global, regional, country, focal area, year, status, partner, and cofinancing filters
- Search and natural-language filter assistance
- Project-level detail drawers
- Country and regional profiles
- Downloadable filtered datasets, charts, map views, and metadata
- Data quality and reconciliation panels
- Responsive, refined UI suitable for a UNDP/GEF knowledge platform

## Implementation approach

Create the project from scratch unless an existing app structure is already present.

Prefer this clean architecture:

- `app/src/components`
- `app/src/features`
- `app/src/data`
- `app/src/lib`
- `app/src/hooks`
- `app/src/styles`
- `scripts/ingest`
- `scripts/validate`
- `outputs/data`

Create a reproducible ingestion pipeline that converts the raw XLS files into normalized dashboard-ready files.

Do not hard-code analytical totals in the UI. Compute them from processed data and validate them against the expected figures in the implementation brief.

## Expected workflow

1. Inspect the raw XLS and GeoJSON files.
2. Create a data dictionary and inferred schema.
3. Build ingestion scripts.
4. Normalize country names and create GeoJSON joins.
5. Generate dashboard-ready data files.
6. Implement the frontend.
7. Implement all filters, visualizations, maps, table views, exports, and AI-style search tools.
8. Add data validation tests.
9. Run build, lint, typecheck, and tests.
10. Provide a final summary of implemented features, commands, and remaining limitations.

## Quality bar

The final app should feel like a real product. Use refined spacing, strong information hierarchy, compact but readable controls, smooth interactions, and clear empty/loading/error states.

Use accessible components and keyboard-friendly controls. Make visualizations attractive, readable, and exportable.

## Commands

After creating the app, document the exact commands in `README.md`, including:

- install
- ingest data
- run development server
- build production app
- run tests
- run validation checks

Run the available checks and fix errors before finishing.
