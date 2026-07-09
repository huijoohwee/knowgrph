import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AGENTIC_CANVAS_OS_DOCS_MCP_TOOL_NAME,
  AGENTIC_CANVAS_OS_DOCS_WORKSPACE_ROOT,
} from "../agentic-canvas-os-docs-contract.mjs";
import {
  resolveAgenticCanvasOsDocsRoot,
  runAgenticCanvasOsDocsInvokeTool,
} from "../agentic-canvas-os-docs-runtime.js";
import { buildKnowgrphLocalMcpToolDefinitions, KNOWGRPH_LOCAL_MCP_TOOL_NAMES } from "../local-tool-contract.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWGRPH_ROOT = path.resolve(__dirname, "..", "..");
const DOCS_ROOT = path.resolve(KNOWGRPH_ROOT, "..", "agentic-canvas-os", "docs");

test("Agentic Canvas OS docs root resolves to sibling agentic-canvas-os/docs", () => {
  assert.equal(resolveAgenticCanvasOsDocsRoot({ rootDir: KNOWGRPH_ROOT, env: {} }), DOCS_ROOT);
});

test("local MCP descriptor exposes Agentic Canvas OS docs invocation as read-only", () => {
  const definitions = buildKnowgrphLocalMcpToolDefinitions();
  const descriptor = definitions.find((tool) => tool.name === AGENTIC_CANVAS_OS_DOCS_MCP_TOOL_NAME);

  assert.ok(descriptor, "docs invocation descriptor must exist");
  assert.equal(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.agenticCanvasOsDocsInvoke, AGENTIC_CANVAS_OS_DOCS_MCP_TOOL_NAME);
  assert.equal(descriptor.annotations.readOnlyHint, true);
  assert.equal(descriptor.inputSchema.properties.token.type, "string");
});

test("local MCP docs invocation catalogs /, #, and @ entries from source docs", async () => {
  const result = await runAgenticCanvasOsDocsInvokeTool({ limit: 500 }, {
    rootDir: KNOWGRPH_ROOT,
    env: {},
  });

  assert.equal(result.ok, true);
  assert.equal(result.docsRoot, AGENTIC_CANVAS_OS_DOCS_WORKSPACE_ROOT);
  assert.equal(result.absoluteDocsRoot, DOCS_ROOT);
  assert.ok(result.counts.command > 0, "slash command entries must be present");
  assert.ok(result.counts.semantic > 0, "hash semantic entries must be present");
  assert.ok(result.counts.binding > 0, "at binding entries must be present");
  assert.ok(result.catalog.some((entry) => entry.token === "/query"));
  assert.ok(result.catalog.some((entry) => entry.token === "#runtime-ready"));
  assert.ok(result.catalog.some((entry) => entry.token === "@mcp-gateway"));
});

test("local MCP docs invocation resolves specific /, #, and @ tokens with source content", async () => {
  for (const token of ["/query", "#runtime-ready", "@mcp-gateway"]) {
    const result = await runAgenticCanvasOsDocsInvokeTool({ token, includeContent: true }, {
      rootDir: KNOWGRPH_ROOT,
      env: {},
    });

    assert.equal(result.ok, true);
    assert.equal(result.invocation.token, token);
    assert.match(result.invocation.sourcePath, /^DICTIONARY-/);
    assert.ok(result.invocation.sourceUrl.includes("/agentic-canvas-os/blob/main/docs/"));
    assert.ok(result.invocation.content.includes(token));
  }
});
