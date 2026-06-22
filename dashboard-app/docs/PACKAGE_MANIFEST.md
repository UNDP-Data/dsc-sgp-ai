# Package Manifest

This package contains the source materials and instructions needed for Codex to build the SGP dashboard.

## Included

- `docs/codex_sgp_dashboard_instructions.md` — full implementation specification and analytical findings.
- `data/raw/sgp_projects.xls` — uploaded project dataset.
- `data/raw/sgp_cofinancing.xls` — uploaded cofinancing dataset.
- `AGENTS.md` — root-level persistent instructions for Codex.
- `CODEX_TASK_PROMPT.md` — exact prompt to paste into Codex.
- `data/geo/README.md` — instructions for supplying GeoJSON.
- `data/geo/country_aliases_seed.csv` — starter aliases for country-name normalization.

## Missing from uploaded source materials

- Country/world GeoJSON files were not uploaded into this chat. Add them to `data/geo/` before running Codex, or allow Codex to create a documented fallback from a public country geometry package/source.
