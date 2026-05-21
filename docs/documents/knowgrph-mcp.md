# Knowgrph MCP — From 0 to 1

This document describes how to **launch Knowgrph via MCP** so an external user can choose:

- **Canvas** (graph visualization)
- **Workspace Editor** (editor-first workspace mode)
- **Geospatial** (map overlay mode)

It also covers the **work flow** (operational steps) and **data flow** (artifacts + transformations) across:

- **Dev → Prod repo mirror → Cloudflare Pages** (`airvio.co/knowgrph`)

> Scope: MVP / free-tier / FOSS-friendly defaults.

---

## 1) What is “Knowgrph MCP”?

**Knowgrph MCP Server** is a small MCP server that exposes a curated set of Knowgrph capabilities as **MCP tools**.

An MCP client (Claude Desktop / Cursor / Claude Code / etc.) can then:

1. Start the UI (Canvas dev server) in the desired mode (Canvas / Workspace Editor / Geospatial)
2. Run pipeline commands (GraphData → A0 CSV/JSON-LD, codebase indexing, etc.)
3. Return results + artifact paths back to the user (in chat)

---

## 2) Key Concepts / Components

### 2.1 UI (Canvas app)

The UI is a Vite + React app under:

- `canvas/`

The UI supports multiple “modes”:

- **Canvas mode**: default interactive graph
- **Workspace Editor mode**: opens editor-first workflow (internally triggered via query param)
- **Geospatial mode**: enables the map overlay runtime (internally triggered via query param)

### 2.2 Pipelines (Python)

Pipeline CLIs live under:

- `knowgrph_parser/`

They transform content into canonical graph artifacts and/or downstream exports.

### 2.3 MCP Server (Node)

MCP server lives under:

- `mcp/`

It acts as the **integration hub** for MCP clients:

- UI launch/stop tools (start Vite server, return URL)
- Pipeline tools (invoke `python -m knowgrph_parser ...`)

---

## 3) “From 0 to 1” (External User Setup)

### 3.1 Preconditions

- Node.js 18+
- Python 3.11+
- Git

### 3.2 Install (repo-local, free-tier friendly)

From repo root:

```bash
# Python deps
python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -r requirements.txt

# MCP server deps
npm --prefix mcp install

# UI deps (Canvas)
npm --prefix canvas install
```

### 3.3 Configure MCP Client (stdio)

Add an MCP server entry similar to:

```json
{
  "mcpServers": {
    "knowgrph": {
      "command": "node",
      "args": ["/ABS/PATH/TO/knowgrph/mcp/server.js"],
      "env": {
        "KNOWGRPH_ROOT": "/ABS/PATH/TO/knowgrph",
        "KNOWGRPH_PYTHON": "/ABS/PATH/TO/knowgrph/.venv/bin/python",
        "KNOWGRPH_UI_HOST": "127.0.0.1",
        "KNOWGRPH_UI_PORT": "5173"
      }
    }
  }
}
```

---

## 4) User Flow (what the user experiences)

### 4.1 Launch UI + choose mode

In MCP client:

1. User asks: “Launch Knowgrph Canvas”
   - Tool: `knowgrph.ui.launch` with `{ "target": "canvas" }`
2. User asks: “Launch Workspace Editor”
   - Tool: `knowgrph.ui.launch` with `{ "target": "workspaceEditor" }`
3. User asks: “Launch Geospatial”
   - Tool: `knowgrph.ui.launch` with `{ "target": "geospatial" }`

Result returned by tool:

- A URL (e.g. `http://127.0.0.1:5173/?openEditorWorkspace=1`)
- Status (ready / starting)

### 4.2 Run pipeline and view outputs

Typical user request: “Convert this GraphData to A0 outputs”

- Tool: `knowgrph.pipeline`
  - `mode=pipeline`
  - `inputPath=...`
  - `outputDir=...`

User then opens the output files (CSV/JSON-LD/TTL) or imports into Canvas.

---

## 5) Work Flow (what the system does operationally)

### 5.1 UI Launch workflow

**Trigger**: MCP tool `knowgrph.ui.launch`

1. Start Vite dev server via `npm --prefix canvas run dev ...`
2. Wait briefly for TCP port to accept connections
3. Return URL using the selected target

**Stop**: MCP tool `knowgrph.ui.stop`

1. Sends SIGTERM to the tracked dev server process group

### 5.2 Pipeline workflow (GraphData → exports)

**Trigger**: MCP tool `knowgrph.pipeline` (mode=`pipeline`)

1. Read GraphData JSON from `inputPath`
2. Emit A0 artifacts into `outputDir`:
   - `a0.csv`
   - `a0.jsonld`
3. Run codebase indexing pipeline (if configured in pipeline)
4. Return exit status + detected artifacts list

---

## 6) Data Flow (artifacts and transformations)

### 6.1 Canonical data model

**GraphData (canonical)** is the SSOT between ingest and export:

```
Source → Loader/Parser → Validator → GraphData (canonical) → Exporters / UI / Indexers
```

### 6.2 Typical artifact set

From a pipeline run, you typically get:

- **GraphData** (input and/or intermediate): `graph.json`
- **A0 CSV**: `a0.csv` (universal CSV schema pattern)
- **A0 JSON-LD**: `a0.jsonld`
- **Runtime events**: `runtime-events.jsonl` (for debugging + audit)

### 6.3 How UI consumes data

UI “Load Data” typically imports one of:

- GraphData JSON
- JSON-LD
- CSV (via parser / conversion tooling)

Then the UI renders:

- 2D / 3D Canvas
- Workspace Editor views (table/editor)
- Geospatial overlay (map + graph overlay)

---

## 7) Dev → Prod → Cloudflare (release flow)

### 7.1 Dev repo

- Primary development happens in the dev workspace repo.

### 7.2 Prod mirror

- Prod mirror repo is a curated copy for deployment stability (fewer dev-only artifacts).

### 7.3 Cloudflare Pages (UI hosting)

- Deploy the built Canvas static bundle to Cloudflare Pages:
  - Public URL: `airvio.co/knowgrph`

**Note**: MCP stdio server is typically **not** hosted on Pages (Pages is static hosting).

---

## 8) Recommended “Integration Hub” boundaries (MVP)

To stay Lean + SSOT:

### 8.1 MCP server responsibilities

- Start/stop UI locally for the user
- Run *curated* pipeline commands safely
- Return:
  - URLs (for UI)
  - artifact paths (for outputs)
  - short logs (stdout/stderr truncated)

### 8.2 UI responsibilities

- Pure client-side interaction and visualization
- Import/export and workspace operations (within browser constraints)

### 8.3 Optional: Geospatial “service” vs “mode”

Clarify which you mean:

- **Geospatial mode** (client-only overlay) — current direction
- **Geospatial service** (backend APIs like geocoding/routing/tiles) — separate component if needed

---

## 9) Minimal API surface (recommended tool list)

MVP tools:

- `knowgrph.ui.launch` (target=canvas/workspaceEditor/geospatial)
- `knowgrph.ui.stop`
- `knowgrph.pipeline`
- `knowgrph.graphrag_pipeline`

Next tools (if needed, but keep Lean):

- `knowgrph.markdown` (wrap `knowgrph_parser markdown`)
- `knowgrph.webpage_to_markdown` (wrap `knowgrph_parser webpage`)
- `knowgrph.youtube_to_markdown` (wrap `knowgrph_parser youtube`)

---

## 10) Ops checklist (free-tier / FOSS)

- [ ] Cloudflare Pages deploy is only for the static UI (Canvas)
- [ ] MCP server remains stdio (local) unless you explicitly add remote transport
- [ ] No secrets committed (`credentials.json` remains ignored)
- [ ] Keep “launch modes” query params documented and stable
