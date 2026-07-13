import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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
const DOCS_ROOT = process.env.KNOWGRPH_AGENTIC_CANVAS_OS_DOCS_ROOT
  ? path.resolve(process.env.KNOWGRPH_AGENTIC_CANVAS_OS_DOCS_ROOT)
  : path.resolve(KNOWGRPH_ROOT, "..", "agentic-canvas-os", "docs");
const DOCS_ENV = process.env.KNOWGRPH_AGENTIC_CANVAS_OS_DOCS_ROOT
  ? { KNOWGRPH_AGENTIC_CANVAS_OS_DOCS_ROOT: DOCS_ROOT }
  : {};
const DOCS_AVAILABLE = existsSync(path.join(DOCS_ROOT, "FACTS.md"));

test("Agentic Canvas OS docs root resolves from explicit configuration or the sibling default", () => {
  assert.equal(resolveAgenticCanvasOsDocsRoot({ rootDir: KNOWGRPH_ROOT, env: DOCS_ENV }), DOCS_ROOT);
});

test("local MCP descriptor exposes Agentic Canvas OS docs invocation as read-only", () => {
  const definitions = buildKnowgrphLocalMcpToolDefinitions();
  const descriptor = definitions.find((tool) => tool.name === AGENTIC_CANVAS_OS_DOCS_MCP_TOOL_NAME);

  assert.ok(descriptor, "docs invocation descriptor must exist");
  assert.equal(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.agenticCanvasOsDocsInvoke, AGENTIC_CANVAS_OS_DOCS_MCP_TOOL_NAME);
  assert.equal(descriptor.annotations.readOnlyHint, true);
  assert.equal(descriptor.inputSchema.properties.token.type, "string");
});

test("local MCP docs invocation catalogs /, #, and @ entries from source docs", { skip: !DOCS_AVAILABLE }, async () => {
  const result = await runAgenticCanvasOsDocsInvokeTool({ limit: 500 }, {
    rootDir: KNOWGRPH_ROOT,
    env: DOCS_ENV,
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
  assert.ok(result.catalog.some((entry) => entry.token === "/sandbox.policy.validate"));
  assert.ok(result.catalog.some((entry) => entry.token === "#agent-sandbox-policy"));
  assert.ok(result.catalog.some((entry) => entry.token === "@sandbox-policy"));
});

test("local MCP docs invocation resolves specific /, #, and @ tokens with source content", { skip: !DOCS_AVAILABLE }, async () => {
  for (const token of ["/query", "#runtime-ready", "@mcp-gateway"]) {
    const result = await runAgenticCanvasOsDocsInvokeTool({ token, includeContent: true }, {
      rootDir: KNOWGRPH_ROOT,
      env: DOCS_ENV,
    });

    assert.equal(result.ok, true);
    assert.equal(result.invocation.token, token);
    assert.match(result.invocation.sourcePath, /^DICTIONARY-/);
    assert.ok(result.invocation.sourceUrl.includes("/agentic-canvas-os/blob/main/docs/"));
    assert.ok(result.invocation.content.includes(token));
  }
});

test("local MCP docs invocation resolves native sandbox policy routes from source dictionaries", { skip: !DOCS_AVAILABLE }, async () => {
  for (const token of ["/sandbox.policy.validate", "/sandbox.policy.authorize", "#agent-sandbox-policy", "@sandbox-policy"]) {
    const result = await runAgenticCanvasOsDocsInvokeTool({ token, includeContent: true }, {
      rootDir: KNOWGRPH_ROOT,
      env: DOCS_ENV,
    });
    assert.equal(result.ok, true);
    assert.equal(result.invocation.token, token);
    assert.ok(result.invocation.content.includes(token));
  }
});
