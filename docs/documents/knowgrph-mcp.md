# Knowgrph MCP — Legacy Setup Index

This document is a legacy setup/index note for the local Knowgrph MCP surface.

It does **not** own the current MCP contract. Canonical ownership lives in:

- `mcp/local-tool-contract.js` for local stdio tool names, descriptions, and `inputSchema`
- `mcp/server.js` for local stdio transport and tool execution
- `mcp/README.md` for local stdio usage
- `docs/documents/knowgrph-superagent-harness.md` for local SuperAgent harness scope, no-copy DeerFlow inspiration boundary, and research/code/create artifact contract
- `docs/documents/knowgrph-mcp/knowgrph-mcp.md` for the short topology/index
- `docs/documents/knowgrph-mcp/knowgrph-mcp-service-prd-tad.md` for the canonical product and architecture contract
- `docs/documents/knowgrph-mcp/knowgrph-mcp-service-prd-tad.companion.md` for file-level owners and invariants

Do not update this file with a parallel tool inventory or a second MCP architecture narrative.

---

## Scope

Use this file only for:

- repo-local setup reminders for external stdio MCP users
- deployment-boundary reminders across Dev -> Prod mirror -> Cloudflare
- quick links into the canonical MCP docs

Do not use this file as the source of truth for:

- the shipped local stdio tool inventory
- the local SuperAgent harness contract
- Pages HTTP MCP or browser WebMCP contracts
- MainPanel `mcp` / `integrations` ownership
- the FloatingPanel Chat -> KGC -> Canvas pipeline

---

## Local Setup

### Preconditions

- Node.js 18+
- Python 3.11+
- Git

### Install

From repo root:

```bash
# Python deps
python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -r requirements.txt

# MCP server deps
npm --prefix mcp install

# UI deps
npm --prefix canvas install
```

### MCP Client Config

Add a local stdio MCP entry similar to:

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

For the current local stdio tool inventory, examples, and configuration notes, read `mcp/README.md`.

---

## Deployment Boundary

- Dev source of truth: `knowgrph`
- Prod mirror: `huijoohwee/content/knowgrph`
- Cloudflare Pages route: `airvio.co/knowgrph`

Guardrails:

- Cloudflare Pages hosts the static UI surface; the local stdio MCP server is not deployed there.
- Local `knowgrph.superagent.run` is a stdio/CLI harness tool; it is not a deployed public Pages/WebMCP mutation surface.
- Production mirrors must receive synced artifacts from Dev; do not patch MCP behavior in downstream publish surfaces.
- Pages/browser MCP and browser WebMCP are separate shipped surfaces with their own canonical owners; do not conflate them with the local stdio server.

---

## Current Reading Order

1. `mcp/README.md`
2. `docs/documents/knowgrph-mcp/knowgrph-mcp.md`
3. `docs/documents/knowgrph-mcp/knowgrph-mcp-service-prd-tad.md`
4. `docs/documents/knowgrph-mcp/knowgrph-mcp-service-prd-tad.companion.md`

---

## Policy

- keep one SSOT per MCP surface
- keep local stdio tool truth in `mcp/local-tool-contract.js`
- keep local SuperAgent harness truth in `knowgrph-superagent-harness.md` and `knowgrph_parser/*`
- keep transport and execution truth in `mcp/server.js`
- remove stale/conflicting duplicate narratives instead of preserving them
