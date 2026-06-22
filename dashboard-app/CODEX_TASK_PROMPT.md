Implement the full SGP dashboard described in `docs/codex_sgp_dashboard_instructions.md`.

Use the raw datasets in:

- `data/raw/sgp_projects.xls`
- `data/raw/sgp_cofinancing.xls`

Use any supplied GeoJSON files in `data/geo/` for choropleth maps. If `data/geo/` contains no usable country GeoJSON, implement a documented fallback using a reliable public world-country geometry source or package, then make the dashboard work with a locally stored generated GeoJSON file. Preserve the ability to replace that fallback later with official project GeoJSON.

Follow `AGENTS.md` exactly.

Start by inspecting the files and creating the ingestion and validation pipeline. Then build the React/Vite/TypeScript dashboard with D3 visualizations, choropleths, cross-filtering, downloads, detail panels, data quality panels, and natural-language search/filter tools.

Create all required code, configs, scripts, tests, and README instructions.

Implementation requirements:

1. Create a reproducible data pipeline that reads the XLS files, normalizes the project and cofinancing tables, creates row IDs, joins/aggregates cofinancing, checks duplicates and mismatches, prepares country and region summaries, prepares cofinancer summaries, and outputs dashboard-ready files.
2. Preserve `PROJECTNUMBER` as the join key while using a stable row-level ID for project records.
3. Treat the project table as authoritative for project counts, grants, and project-level cofinancing totals. Use the cofinancing table for partner, cofinancer type, and cofinancer geography analytics.
4. Validate computed totals against the expected figures and caveats in `docs/codex_sgp_dashboard_instructions.md`.
5. Build a polished dashboard with a strong visual hierarchy, compact controls, responsive layout, accessible UI, and refined interaction design.
6. Implement filters for region, country, focal area, status, year range, grant amount, cofinancing amount, total investment, cofinancer type, cofinancer name, project text search, and data quality flags.
7. Implement natural-language filter assistance. It can be local/rule-based first, with an optional provider abstraction for future AI API calls. It should translate queries such as “show biodiversity projects in Latin America after 2015 with cash cofinancing above 100k” into active filters.
8. Implement D3 visualizations, including KPI cards, time-series charts, focal-area distributions, region/country rankings, cofinancing composition, grant/cofinancing scatterplots, partner/cofinancer analytics, and choropleth maps.
9. Implement country detail panels, project detail drawers, filtered project tables, data quality panels, download/export tools, and shareable filter state through URL parameters.
10. Add tests for ingestion, totals, filtering, country joins, and build stability.
11. Run the available checks, fix errors, and document every command needed to install, ingest data, run the app, build the app, and validate the data.

Work in phases and commit to a complete working product rather than a partial scaffold. If the implementation becomes too large for one pass, finish the ingestion pipeline, app shell, core filters, core charts, choropleth map, project table, and exports first, then continue with the advanced panels and polish.
