import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildKnowgrphLocalMcpToolDefinitions, KNOWGRPH_LOCAL_MCP_TOOL_NAMES } from "../local-tool-contract.js";
import {
  listCapabilityRegistry,
  listProcessRegistry,
  runOsStatusTool,
} from "../os-status-runtime.js";

async function tempRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "knowgrph-os-status-"));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

test("Feature: knowgrph-agentic-os, process_list normalizes readable harness state and records unavailable sources", async () => {
  const rootDir = await tempRoot();
  const showrunnerStatePath = path.join(rootDir, "showrunner/runs/show-1/state.json");
  const superagentStatePath = path.join(rootDir, "data/superagent-runs/super-1/state.json");
  await writeJson(showrunnerStatePath, {
    run_id: "show-1",
    run_status: "awaiting_review",
    startedAt: "2026-07-02T09:00:00.000Z",
  });
  await writeJson(superagentStatePath, {
    runId: "super-1",
    status: "running",
    created_at: "2026-07-02T10:00:00.000Z",
  });
  await fs.mkdir(path.join(rootDir, "data/superagent-runs/no-state"), { recursive: true });

  const beforeShowrunner = await fs.readFile(showrunnerStatePath, "utf8");
  const beforeSuperagent = await fs.readFile(superagentStatePath, "utf8");
  const result = await listProcessRegistry({ rootDir });

  assert.equal(result.ok, true);
  assert.equal(result.truncated, false);
  assert.deepEqual(
    result.entries.map((entry) => `${entry.harness}:${entry.processId}:${entry.status}`),
    ["superagent:super-1:running", "showrunner:show-1:awaiting_review"],
  );
  assert.ok(result.unavailableSources.some((source) => source.harness === "superagent" && source.sourceRef.includes("no-state")));
  assert.ok(result.unavailableSources.some((source) => source.harness === "video_remix"));
  assert.equal(await fs.readFile(showrunnerStatePath, "utf8"), beforeShowrunner);
  assert.equal(await fs.readFile(superagentStatePath, "utf8"), beforeSuperagent);
});

test("Feature: knowgrph-agentic-os, capability registry unions local MCP and vdeoxpln catalogs by tool id", async () => {
  const result = await listCapabilityRegistry({ cloudflareMcpUrl: "" });
  const byId = new Map(result.entries.map((entry) => [entry.toolId, entry]));

  assert.equal(result.ok, true);
  assert.ok(result.unreachableCatalogs.includes("cloudflare_mcp_agent"));
  assert.ok(byId.has(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.osStatus));
  assert.equal(byId.get(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.osStatus).owningHarness, "agentic_os");
  assert.ok(byId.get(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.vdeoxplnList).sourceCatalogs.includes("local_mcp"));
  assert.ok(byId.get(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.vdeoxplnList).sourceCatalogs.includes("vdeoxpln"));
});

test("Feature: knowgrph-agentic-os, local MCP descriptor exposes knowgrph.os.status as read-only", () => {
  const definitions = buildKnowgrphLocalMcpToolDefinitions();
  const descriptor = definitions.find((tool) => tool.name === KNOWGRPH_LOCAL_MCP_TOOL_NAMES.osStatus);

  assert.ok(descriptor, "knowgrph.os.status descriptor must exist");
  assert.deepEqual(descriptor.inputSchema.properties.view.enum, ["process_list", "capabilities"]);
  assert.equal(descriptor.annotations.readOnlyHint, true);
  assert.equal(descriptor.annotations.idempotentHint, true);
});

test("Feature: knowgrph-agentic-os, runOsStatusTool returns structured errors for unsupported views", async () => {
  const result = await runOsStatusTool("cost_summary", {}, { rootDir: await tempRoot() });

  assert.equal(result.ok, false);
  assert.equal(result.view, "cost_summary");
  assert.equal(result.errorCode, "invalid_view");
});

test("Feature: knowgrph-agentic-os, runOsStatusTool adds zero cost log on successful views", async () => {
  const rootDir = await tempRoot();
  await writeJson(path.join(rootDir, "showrunner/runs/show-2/state.json"), {
    run_id: "show-2",
    status: "complete",
  });

  const result = await runOsStatusTool("process_list", {}, { rootDir });

  assert.equal(result.ok, true);
  assert.deepEqual(result.cost_log, {
    model: "none",
    prompt_tokens: 0,
    completion_tokens: 0,
    cache_hits: 0,
    estimated_cost_usd: 0,
    incomplete: false,
  });
});
