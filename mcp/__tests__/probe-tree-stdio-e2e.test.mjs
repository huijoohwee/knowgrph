import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION } from "../../canvas/src/features/agent-ready/probeTreeContract.mjs";
import { KNOWGRPH_LOCAL_MCP_TOOL_NAMES } from "../local-tool-contract.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("local stdio MCP emits a Canvas-ready bounded Probe-Tree response", async () => {
  const client = new Client({ name: "knowgrph-probe-tree-e2e", version: "0.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(repoRoot, "mcp", "server.js")],
    cwd: repoRoot,
    env: {
      PATH: String(process.env.PATH || ""),
      HOME: String(process.env.HOME || ""),
      NODE_ENV: "test",
      KNOWGRPH_ROOT: repoRoot,
      KNOWGRPH_PROBE_TREE_MODEL: "",
    },
    stderr: "pipe",
  });
  let stderrText = "";
  transport.stderr?.on("data", (chunk) => { stderrText += String(chunk); });

  try {
    await client.connect(transport, { timeout: 10_000 });
    const listed = await client.listTools(undefined, { timeout: 10_000 });
    const tool = listed.tools.find((entry) => entry.name === KNOWGRPH_LOCAL_MCP_TOOL_NAMES.probeGenerate);
    assert.ok(tool, `missing Probe-Tree tool; stderr=${stderrText}`);
    assert.equal(tool.inputSchema.properties?.k?.minimum, 2);
    assert.equal(tool.outputSchema?.required?.includes("response"), true);

    const result = await client.callTool({
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.probeGenerate,
      arguments: {
        thread_root_id: "care-agent",
        current_node_id: "widget-card",
        context_text: "Compare the selected care card across member goal, caregiver need, source evidence, and unresolved gap.",
        k: 3,
        recall_top_k: 0,
        token_budget: 1200,
      },
    }, undefined, { timeout: 10_000 });

    assert.equal(result.isError, false, stderrText);
    const payload = result.structuredContent;
    const surface = payload?.response?.structuredContent;
    assert.equal(surface?.contractVersion, PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION);
    assert.equal(surface?.widgets?.[0]?.id, "widget-card");
    assert.equal(surface?.cards?.length, 3);
    assert.equal(surface?.panels?.length, 1);
    assert.ok(surface.cards.every((card) => card.parentNodeId === "widget-card"));
    assert.ok(surface.cards.every((card) => card.nextAction === KNOWGRPH_LOCAL_MCP_TOOL_NAMES.probeSelect));
    assert.ok(surface.cards.every((card) => card.question && card.output === ""));
    assert.ok(surface.cards.every((card) => card.selectionOptions.length >= 2));
    assert.ok(surface.cards.every((card) => card.contextAnchors.length >= 2));
    assert.equal(payload?.cost_log?.estimated_cost_usd, 0);
  } finally {
    await client.close().catch(() => undefined);
  }
});
