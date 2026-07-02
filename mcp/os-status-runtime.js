import fs from "node:fs/promises";
import path from "node:path";

import { buildKnowgrphVdeoxplnRegistry } from "../canvas/src/features/agent-ready/knowgrphVdeoxplnContract.mjs";
import { buildKnowgrphLocalMcpToolDefinitions } from "./local-tool-contract.js";
import { OS_STATUS_TOOL_NAME } from "./os-status-contract.js";

export const OS_STATUS_VIEWS = Object.freeze({
  processList: "process_list",
  capabilities: "capabilities",
});

const ZERO_COST_LOG = Object.freeze({
  model: "none",
  prompt_tokens: 0,
  completion_tokens: 0,
  cache_hits: 0,
  estimated_cost_usd: 0,
  incomplete: false,
});

const SOURCE_CATALOGS = Object.freeze({
  vdeoxpln: "vdeoxpln",
  localMcp: "local_mcp",
  cloudflareMcpAgent: "cloudflare_mcp_agent",
});

const text = (value) => String(value || "").trim();

const stableIsoOrUnknown = (value) => {
  const candidate = text(value);
  if (!candidate) return "unknown";
  const time = Date.parse(candidate);
  return Number.isNaN(time) ? candidate : new Date(time).toISOString();
};

const entryTime = (entry) => {
  const time = Date.parse(entry.startedAt);
  return Number.isNaN(time) ? 0 : time;
};

const cloneCostLog = () => ({ ...ZERO_COST_LOG });

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function listRunDirs(rootDir, relativeDir, harness, unavailableSources) {
  const absoluteDir = path.join(rootDir, relativeDir);
  try {
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        runId: entry.name,
        statePath: path.join(absoluteDir, entry.name, "state.json"),
        sourceRef: path.join(relativeDir, entry.name, "state.json"),
      }));
  } catch (error) {
    unavailableSources.push({
      harness,
      sourceRef: relativeDir,
      reason: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function normalizeProcessEntry({ harness, runId, state, sourceRef }) {
  return {
    processId: text(state.run_id) || text(state.runId) || text(state.id) || runId,
    harness,
    status:
      text(state.status) ||
      text(state.run_status) ||
      text(state.state) ||
      text(state.phase) ||
      "unknown",
    startedAt: stableIsoOrUnknown(
      state.startedAt ||
      state.started_at ||
      state.createdAt ||
      state.created_at ||
      state.updatedAt ||
      state.updated_at,
    ),
    sourceRef,
  };
}

async function readStateRunEntries({ rootDir, relativeDir, harness, unavailableSources }) {
  const candidates = await listRunDirs(rootDir, relativeDir, harness, unavailableSources);
  const entries = [];
  for (const candidate of candidates) {
    try {
      const state = await readJson(candidate.statePath);
      entries.push(normalizeProcessEntry({
        harness,
        runId: candidate.runId,
        state,
        sourceRef: candidate.sourceRef,
      }));
    } catch (error) {
      unavailableSources.push({
        harness,
        sourceRef: candidate.sourceRef,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return entries;
}

function capProcessEntries(entries) {
  const sorted = [...entries].sort((left, right) => {
    const delta = entryTime(right) - entryTime(left);
    return delta || left.harness.localeCompare(right.harness) || left.processId.localeCompare(right.processId);
  });
  return {
    entries: sorted.slice(0, 200),
    truncated: sorted.length > 200,
  };
}

export async function listProcessRegistry({ rootDir = process.cwd() } = {}) {
  const unavailableSources = [];
  const showrunnerEntries = await readStateRunEntries({
    rootDir,
    relativeDir: "showrunner/runs",
    harness: "showrunner",
    unavailableSources,
  });
  const superagentEntries = await readStateRunEntries({
    rootDir,
    relativeDir: "data/superagent-runs",
    harness: "superagent",
    unavailableSources,
  });
  unavailableSources.push({
    harness: "video_remix",
    sourceRef: "local Run_Manifest store",
    reason: "No durable local Run_Manifest enumeration source is configured.",
  });
  const capped = capProcessEntries([...showrunnerEntries, ...superagentEntries]);
  return {
    ok: true,
    ...capped,
    unavailableSources,
  };
}

function owningHarnessForTool(toolId, fallback = "unknown") {
  if (toolId === OS_STATUS_TOOL_NAME) return "agentic_os";
  if (toolId.startsWith("knowgrph.showrunner.")) return "showrunner";
  if (toolId.startsWith("knowgrph.video_remix.")) return "video_remix";
  if (toolId.startsWith("knowgrph.superagent.")) return "superagent";
  if (toolId.startsWith("knowgrph.memory.")) return "memory_layer";
  if (toolId.startsWith("knowgrph.html_video.")) return "html_video_renderer";
  if (toolId.startsWith("knowgrph.annotate.")) return "visual_annotation_engine";
  if (toolId.startsWith("knowgrph.vdeoxpln.")) return "vdeoxpln";
  if (toolId.startsWith("knowgrph.")) return "local_mcp";
  return fallback;
}

function upsertCapability(catalog, { toolId, owningHarness, schemaRef, sourceCatalog }) {
  const normalizedToolId = text(toolId);
  if (!normalizedToolId) return;
  const existing = catalog.get(normalizedToolId);
  if (existing) {
    if (!existing.sourceCatalogs.includes(sourceCatalog)) {
      existing.sourceCatalogs.push(sourceCatalog);
      existing.sourceCatalogs.sort();
    }
    return;
  }
  catalog.set(normalizedToolId, {
    toolId: normalizedToolId,
    owningHarness: text(owningHarness) || owningHarnessForTool(normalizedToolId),
    schemaRef: text(schemaRef) || "schema:unknown",
    sourceCatalogs: [sourceCatalog],
  });
}

function addVdeoxplnCapabilities(catalog) {
  for (const vdeoxpln of buildKnowgrphVdeoxplnRegistry()) {
    for (const tools of Object.values(vdeoxpln.tools || {})) {
      for (const toolId of Array.isArray(tools) ? tools : []) {
        upsertCapability(catalog, {
          toolId,
          owningHarness: vdeoxpln.id,
          schemaRef: `vdeoxpln:${vdeoxpln.id}:tools`,
          sourceCatalog: SOURCE_CATALOGS.vdeoxpln,
        });
      }
    }
  }
}

function addLocalMcpCapabilities(catalog, localMcpArgs) {
  for (const tool of buildKnowgrphLocalMcpToolDefinitions(localMcpArgs)) {
    upsertCapability(catalog, {
      toolId: tool.name,
      owningHarness: owningHarnessForTool(tool.name),
      schemaRef: `local_mcp:${tool.name}:input_output_schema`,
      sourceCatalog: SOURCE_CATALOGS.localMcp,
    });
  }
}

async function fetchCloudflareMcpTools(cloudflareMcpUrl) {
  const url = text(cloudflareMcpUrl);
  if (!url) throw new Error("KNOWGRPH_MCP_AGENT_URL is not configured.");
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "knowgrph-os-status-tools-list", method: "tools/list" }),
  });
  if (!response.ok) throw new Error(`Cloudflare McpAgent returned HTTP ${response.status}.`);
  const payload = await response.json();
  const tools = payload?.result?.tools || payload?.tools;
  if (!Array.isArray(tools)) throw new Error("Cloudflare McpAgent tools/list response did not include tools[].");
  return tools;
}

async function addCloudflareMcpCapabilities(catalog, { cloudflareMcpUrl, unreachableCatalogs }) {
  try {
    const tools = await fetchCloudflareMcpTools(cloudflareMcpUrl);
    for (const tool of tools) {
      upsertCapability(catalog, {
        toolId: tool.name,
        owningHarness: owningHarnessForTool(tool.name, "cloudflare_mcp_agent"),
        schemaRef: `cloudflare_mcp_agent:${tool.name}:input_output_schema`,
        sourceCatalog: SOURCE_CATALOGS.cloudflareMcpAgent,
      });
    }
  } catch {
    unreachableCatalogs.push(SOURCE_CATALOGS.cloudflareMcpAgent);
  }
}

export async function listCapabilityRegistry({
  cloudflareMcpUrl = process.env.KNOWGRPH_MCP_AGENT_URL,
  localMcpArgs = {},
} = {}) {
  const catalog = new Map();
  const unreachableCatalogs = [];
  addVdeoxplnCapabilities(catalog);
  addLocalMcpCapabilities(catalog, localMcpArgs);
  await addCloudflareMcpCapabilities(catalog, { cloudflareMcpUrl, unreachableCatalogs });
  return {
    ok: true,
    entries: [...catalog.values()].sort((left, right) => left.toolId.localeCompare(right.toolId)),
    unreachableCatalogs,
  };
}

export async function runOsStatusTool(view, args = {}, { rootDir } = {}) {
  const normalizedView = text(view || args.view);
  try {
    if (normalizedView === OS_STATUS_VIEWS.processList) {
      return {
        view: normalizedView,
        ...(await listProcessRegistry({ rootDir })),
        cost_log: cloneCostLog(),
      };
    }
    if (normalizedView === OS_STATUS_VIEWS.capabilities) {
      return {
        view: normalizedView,
        ...(await listCapabilityRegistry({
          cloudflareMcpUrl: args.cloudflareMcpUrl,
          localMcpArgs: args.localMcpArgs,
        })),
        cost_log: cloneCostLog(),
      };
    }
    return {
      ok: false,
      view: normalizedView || "unknown",
      errorCode: "invalid_view",
      message: `Unsupported Agentic OS status view: ${normalizedView || "(missing)"}.`,
    };
  } catch (error) {
    return {
      ok: false,
      view: normalizedView || "unknown",
      errorCode: "registry_failure",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
