# KnowGrph Dashboard

React + TypeScript + Vite application for visualizing and editing the README Example Flow.

## Live URL
- `https://huijoohwee.github.io/knowgrph/`

## Features
- Interactive flow diagram (D3) with zoom, pan, and tooltips
- Toggle editing, drag nodes, edit labels, select nodes
- Upload CSV (A0 schema) to regenerate pipeline client-side
- Save JSON‑LD back to `data/outputs/a0.jsonld` or download if permissions restricted

## Development
- `pnpm install`
- `pnpm dev` then open `http://localhost:3000/knowgrph/`

## Data Pipeline
- From repo root: `python scripts/pipeline.py`
- Copies `data/outputs/a0.jsonld` during build to `dashboard/public/data/outputs/a0.jsonld`

## Deployment
- GitHub Actions builds and deploys to GitHub Pages on `main` push
- Vite `base` is set to `/knowgrph/` for Pages compatibility
