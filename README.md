# SGP AI Assistant Kit

This is a local prototype assistant kit for the GEF Small Grants Programme
(SGP). It was copied from the source backend template and keeps the required
assistant-kit structure so it can later be installed back into the backend
without changing shared runtime code.

## Assistant identity

- Assistant ID: `sgp_ai`
- Display name: `SGP AI`
- Route prefix after backend installation: `/assistants/sgp_ai/...`
- LanceDB tables after corpus import:
  - `sgp_ai_chunks`
  - `sgp_ai_documents`
  - `sgp_ai_sources`

## Required files

Do not rename or move these files:

```text
assistant.yaml
corpus/manifest.yaml
eval/questions.yaml
README.md
CODEX_HANDOFF.md
tests/
```

## Prototype corpus

The current manifest contains the prepared SGP Innovation Library corpus for
RAG import. It uses SGP-owned publication/resource pages as authoritative
anchors and stores publication metadata plus prepared chunks in
`corpus/manifest.yaml`.

The manifest uses prepared chunks instead of raw PDF extraction at runtime. When
expanding or regenerating the corpus, update publication metadata, summaries,
and chunks in the manifest while keeping `assistant_id: sgp_ai` consistent
across files.

## Runtime assumptions

This kit does not contain backend runtime code. The original backend owns:

- FastAPI routes
- API-key authentication
- Azure OpenAI model and embedding clients
- LanceDB storage access
- streaming response encoding
- retrieval and ranking behavior
- deployment to Azure

## GitHub Pages site

This repo includes a buildless static SGP AI query interface for GitHub Pages:

```text
index.html
assets/site.css
assets/site.js
.nojekyll
```

The site calls the backend's public, origin-limited SGP AI Pages proxy:

```text
GET  /pages/sgp-ai/status
POST /pages/sgp-ai/model
GET  /pages/sgp-ai/debug/retrieve
```

It does not embed API keys or call the authenticated assistant API directly.
The backend must allow the GitHub Pages origin with
`SGP_AI_PAGES_ALLOWED_ORIGINS`, defaulting to `https://undp-data.github.io`.

To publish it, configure GitHub Pages as:

```text
Source: Deploy from a branch
Branch: main
Folder: / (root)
```

Then push `main`. The site is served directly from the repository root.

After installation in the backend, expected routes are:

```text
POST /assistants/sgp_ai/model
GET  /assistants/sgp_ai/documents
GET  /assistants/sgp_ai/sources
GET  /assistants/sgp_ai/debug/retrieve
```

## Validate from the source backend

Run the authoritative validator from the original backend repo:

```bash
python3 scripts/validate_assistant_kit.py \
  --kit "/Users/ben/Documents/UNDP/SGP/SGP AI/sgp_ai"
```

Expected table namespace:

```json
{
  "chunks": "sgp_ai_chunks",
  "documents": "sgp_ai_documents",
  "sources": "sgp_ai_sources"
}
```

## Install back into the backend

From `/Users/ben/Documents/UNDP/SEH/dsc-energy-ai-backend`:

```bash
python3 scripts/install_assistant_kit.py \
  --kit "/Users/ben/Documents/UNDP/SGP/SGP AI/sgp_ai" \
  --overwrite
```

To also write the prepared manifest into assistant-specific LanceDB tables:

```bash
python3 scripts/install_assistant_kit.py \
  --kit "/Users/ben/Documents/UNDP/SGP/SGP AI/sgp_ai" \
  --overwrite \
  --import-corpus \
  --include-chunks
```

For production/Azure data finalization, force the assistant-specific Azure
LanceDB namespace so a local `LANCEDB_URI` override cannot capture the import:

```bash
LANCEDB_URI=az://lancedb/sgp_ai .venv/bin/python scripts/install_assistant_kit.py \
  --kit "/Users/ben/Documents/UNDP/SGP/SGP AI/sgp_ai" \
  --overwrite \
  --import-corpus \
  --include-chunks
```

Expected Azure table counts after import:

```text
sgp_ai_sources: 1
sgp_ai_documents: 1433
sgp_ai_chunks: 63737
```

Production deployment remains the original backend deployment path: install the
kit, run backend tests, commit `config/rag_profiles/sgp_ai.yaml` and
`assistant_kits/sgp_ai/`, then merge through the existing Azure Web App workflow.
