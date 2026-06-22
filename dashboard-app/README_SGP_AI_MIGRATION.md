# SGP Dashboard in sgp-ai

This folder is an isolated source copy of the SGP portfolio dashboard. The GitHub Pages route is `/dashboard/`.

Maintain the dashboard here, then either:

- let `.github/workflows/deploy-pages.yml` build it automatically, or
- build locally with `VITE_BASE_PATH=/dashboard/ npm run build:pages` from `dashboard-app/app` and copy `dashboard-app/app/dist/` to `../../dashboard/`.

The dashboard source remains separate from the root SGP AI static interface.
