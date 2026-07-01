# GitHub Pages Deployment

`SGP-KLP-Frontend/` is the active GitHub Pages repository. It deploys the
landing page, AI page, dashboard build, and archive browser route.

## Routes

```text
/                  index.html and shared assets
/ai/               static AI interface
/dashboard/        built dashboard app from dashboard-app/app/dist
/archive-browser/  committed static archive browser payload
```

## AI RAG Selector

The `/ai/` page includes a three-position dataset selector:

```text
all                  default; searches every configured RAG source
innovation_library   SGP Innovation Library publications and reports
project_database     prepared SGP project database records and attachments
```

The static frontend sends the selected value as `dataset` and `corpus` query
parameters on `POST /model`. The deployed backend must apply the matching
`source_id` filter during retrieval; otherwise the selector will only change
the UI label and request metadata.

## Workflow

Deployment is handled by `.github/workflows/deploy-pages.yml`.

On push to `main`, the workflow:

1. Installs dashboard dependencies in `dashboard-app/app`.
2. Runs dashboard unit tests.
3. Builds the dashboard with relative asset paths.
4. Stages the repository root routes and dashboard build into the Pages
   artifact.
5. Deploys through GitHub Pages.

## Local Preflight

Run before pushing frontend changes:

```bash
cd dashboard-app/app
npm test
npm run build:pages
```

For a local static preview:

```bash
npm run preview
```

## What Must Stay Out of Git

- `dashboard/` build output.
- `dashboard-app/app/dist/`.
- `dashboard-app/app/node_modules/`.
- Raw XLS inputs and normalized processing outputs.
- Assistant corpus manifests, evaluation files, and scraper exports.
- Pipeline caches and notebook exports.

The frontend should only commit deployable source, small runtime files required
by the static app, and page-scoped media assets.
