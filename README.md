# SGP KLP Frontend

This repository is the GitHub Pages frontend for the SGP Knowledge and Learning Platform prototype.

It intentionally contains only deployable frontend content and the minimal runtime JSON needed by the static interfaces:

- `index.html`, `assets/`, and `ai/` for the landing page and Innovation Library AI interface
- `assets/media/ai/`, `assets/media/dashboard/`, and `assets/media/archive-browser/` for page-scoped screenshots and visual assets
- `dashboard-app/app/` for the maintainable React/Vite dashboard frontend
- `archive-browser/` for the committed static archive browser served at `/archive-browser/`
- `.github/workflows/deploy-pages.yml` for GitHub Pages deployment

Scrapers, processors, raw inputs, generated exports, assistant-kit corpus files, and API/static-data publishing now live in the sibling `SGP-Data-Pipeline/` folder. Non-runtime notes and reference documents live in `SGP-Documents/`.

## Deploy

GitHub Pages deploys from GitHub Actions. The workflow installs the dashboard frontend dependencies, runs frontend tests, builds the dashboard with relative asset paths, and stages:

```text
/
/ai/
/dashboard/
/archive-browser/
```

The `/dashboard/` route is generated during the Pages workflow from `dashboard-app/app/dist`; the built `dashboard/` folder is intentionally not committed.

## Folder Structure

```text
.
├── index.html                 # landing page
├── ai/                        # static Innovation Library AI page
├── assets/
│   ├── site.css               # shared landing/AI styles
│   ├── site.js                # shared AI page runtime
│   └── media/
│       ├── ai/                # AI page screenshots and visual assets
│       ├── dashboard/         # dashboard screenshots and visual assets
│       └── archive-browser/   # archive browser screenshots and visual assets
├── dashboard-app/app/         # React/Vite dashboard source
└── archive-browser/           # committed static archive browser served at /archive-browser/
```

## Dashboard Maintenance

Edit frontend code in:

```bash
cd dashboard-app/app
npm ci
npm test
npm run build:pages
```

Dashboard data preparation has moved to `../SGP-Data-Pipeline/01_Code/src/sgp_pipeline/processors/dashboard`. Publish refreshed runtime JSON back into this frontend through the pipeline API publishing step.
