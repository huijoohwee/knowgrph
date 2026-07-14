import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { KNOWGRPH_LOCAL_MCP_TOOL_NAMES } from "../local-tool-contract.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("local stdio MCP discovers and executes SME risk-copilot tools at zero cost", async () => {
  const client = new Client({ name: "knowgrph-sme-risk-copilot-e2e", version: "0.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(repoRoot, "mcp", "server.js")],
    cwd: repoRoot,
    env: {
      PATH: String(process.env.PATH || ""),
      HOME: String(process.env.HOME || ""),
      NODE_ENV: "test",
      KNOWGRPH_ROOT: repoRoot,
      KNOWGRPH_PYTHON: String(process.env.KNOWGRPH_PYTHON || "python3"),
    },
    stderr: "pipe",
  });
  let stderrText = "";
  transport.stderr?.on("data", (chunk) => { stderrText += String(chunk); });

  try {
    await client.connect(transport, { timeout: 10_000 });
    const listed = await client.listTools(undefined, { timeout: 10_000 });
    const names = new Set(listed.tools.map((tool) => tool.name));
    for (const name of [
      KNOWGRPH_LOCAL_MCP_TOOL_NAMES.smeSourceNormalize,
      KNOWGRPH_LOCAL_MCP_TOOL_NAMES.smeTriggerEvaluate,
      KNOWGRPH_LOCAL_MCP_TOOL_NAMES.smeBrokerDraftNudge,
      KNOWGRPH_LOCAL_MCP_TOOL_NAMES.smeMarketplaceMatch,
      KNOWGRPH_LOCAL_MCP_TOOL_NAMES.smeMultilingualAdapt,
      KNOWGRPH_LOCAL_MCP_TOOL_NAMES.smeCareAgentStatus,
    ]) assert.equal(names.has(name), true, `missing ${name}; stderr=${stderrText}`);

    const trigger = await client.callTool({
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.smeTriggerEvaluate,
      arguments: { reg_delta: { changes: [{ element: "node", milestone: "first_hire", source_field: "size", operation: "added" }] } },
    }, undefined, { timeout: 10_000 });
    assert.equal(trigger.isError, false, stderrText);
    assert.equal(trigger.structuredContent?.trigger_event?.rule_id, "first-hire");
    assert.equal(trigger.structuredContent?.cost_log?.estimated_cost_usd, 0);

    const status = await client.callTool({
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.smeCareAgentStatus,
      arguments: { view: "capabilities" },
    }, undefined, { timeout: 10_000 });
    assert.equal(status.isError, false, stderrText);
    assert.equal(status.structuredContent?.ok, true);
    assert.equal(status.structuredContent?.mutation_performed, false);
    assert.equal(status.structuredContent?.cost_log?.estimated_cost_usd, 0);
  } finally {
    await client.close().catch(() => undefined);
  }
});
