import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { handleAgenticOsGrammarDevRpc } from "../../canvas/agenticOsGrammarDevServer.mjs";
import { AGENTIC_CANVAS_OS_DOCS_MCP_TOOL_NAME } from "../agentic-canvas-os-docs-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("local grammar forwarder projects all three source-backed invocation dictionaries", async () => {
  const initialized = await handleAgenticOsGrammarDevRpc({ jsonrpc: "2.0", id: 1, method: "initialize" }, { rootDir: repoRoot });
  assert.equal(initialized.statusCode, 200);
  assert.ok(initialized.headers["mcp-session-id"]);

  const expectedTokens = {
    "/": "/superagent.run",
    "#": "#long-horizon-harness",
    "@": "@message-gateway",
  };
  for (const [query, expectedToken] of Object.entries(expectedTokens)) {
    const response = await handleAgenticOsGrammarDevRpc({
      jsonrpc: "2.0",
      id: query,
      method: "tools/call",
      params: {
        name: AGENTIC_CANVAS_OS_DOCS_MCP_TOOL_NAME,
        arguments: { query, limit: 500 },
      },
    }, {
      rootDir: repoRoot,
      sessionId: initialized.headers["mcp-session-id"],
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.result.structuredContent.absoluteDocsRoot, undefined);
    assert.ok(response.body.result.structuredContent.catalog.some(entry => entry.token === expectedToken));
  }
});
