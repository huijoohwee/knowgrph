import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildKnowgrphLocalMcpToolDefinitions, KNOWGRPH_LOCAL_MCP_TOOL_NAMES } from "../local-tool-contract.js";
import {
  evolveProbeTree,
  generateProbeOptions,
  parseProbeMarkdown,
  selectProbeOption,
} from "../probe-tree-runtime.js";

async function tempRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "knowgrph-probe-tree-"));
}

test("probe.generate recalls scoped exemplars and does not mutate the markdown graph store", async () => {
  const rootDir = await tempRoot();
  const storeDir = path.join(rootDir, "data/probe-tree");
  await fs.mkdir(storeDir, { recursive: true });
  await fs.writeFile(path.join(storeDir, "sentinel.txt"), "before", "utf8");
  await fs.mkdir(path.join(rootDir, "data/memory-layer"), { recursive: true });
  await fs.writeFile(path.join(rootDir, "data/memory-layer/local-memory-store.json"), JSON.stringify({
    version: "knowgrph-memory-store/v0.1",
    updated_at: "2026-07-07T00:00:00.000Z",
    memories: [{
      id: "mem-1",
      memory: "Probe exemplar for onboarding: What information is still missing?",
      scope: { app_id: "knowgrph-probe-tree" },
      categories: ["probe-tree"],
      metadata: { recommended_question: "What information is still missing?" },
      created_at: "2026-07-07T00:00:00.000Z",
      updated_at: "2026-07-07T00:00:00.000Z",
    }],
  }, null, 2), "utf8");

  const result = await generateProbeOptions({
    thread_root_id: "onboarding",
    current_node_id: "root",
    context_text: "onboarding missing information",
    k: 2,
  }, { rootDir, env: {} });

  assert.equal(result.ok, true);
  assert.equal(result.options.length, 2);
  assert.equal(result.options[0].text, "What information is still missing?");
  assert.equal(result.recalled_exemplars.length, 1);
  assert.equal(result.token_budget.within_budget, true);
  assert.equal(result.degraded, true);
  assert.equal(result.stateGraph.checkpointer, "markdown-graph-store");
  assert.equal(await fs.readFile(path.join(storeDir, "sentinel.txt"), "utf8"), "before");
});

test("probe.generate honors explicit zero recall against a seeded memory store", async () => {
  const rootDir = await tempRoot();
  await fs.mkdir(path.join(rootDir, "data/memory-layer"), { recursive: true });
  await fs.writeFile(path.join(rootDir, "data/memory-layer/local-memory-store.json"), JSON.stringify({
    version: "knowgrph-memory-store/v0.1",
    updated_at: "2026-07-07T00:00:00.000Z",
    memories: [{
      id: "mem-1",
      memory: "Probe exemplar for procurement: Which legal approver signs off the exception?",
      scope: { app_id: "knowgrph-probe-tree" },
      categories: ["probe-tree"],
      metadata: { recommended_question: "Which legal approver signs off the exception?" },
      created_at: "2026-07-07T00:00:00.000Z",
      updated_at: "2026-07-07T00:00:00.000Z",
    }],
  }, null, 2), "utf8");

  const result = await generateProbeOptions({
    thread_root_id: "procurement",
    current_node_id: "root",
    context_text: "procurement legal approver exception",
    k: 2,
    recall_top_k: 0,
  }, { rootDir, env: {} });

  assert.equal(result.ok, true);
  assert.equal(result.recalled_exemplars.length, 0);
  assert.equal(result.token_budget.recalled_exemplar_count, 0);
  assert.equal(result.options.some((option) => option.text === "Which legal approver signs off the exception?"), false);
});

test("probe.generate enforces token budget before local model invocation", async () => {
  const rootDir = await tempRoot();
  await fs.mkdir(path.join(rootDir, "data/memory-layer"), { recursive: true });
  await fs.writeFile(path.join(rootDir, "data/memory-layer/local-memory-store.json"), JSON.stringify({
    version: "knowgrph-memory-store/v0.1",
    updated_at: "2026-07-07T00:00:00.000Z",
    memories: [{
      id: "mem-1",
      memory: "Probe exemplar ".repeat(200),
      scope: { app_id: "knowgrph-probe-tree" },
      categories: ["probe-tree"],
      metadata: { recommended_question: "What information is still missing?" },
      created_at: "2026-07-07T00:00:00.000Z",
      updated_at: "2026-07-07T00:00:00.000Z",
    }],
  }, null, 2), "utf8");
  let called = false;

  const result = await generateProbeOptions({
    thread_root_id: "budgeted",
    current_node_id: "root",
    context_text: "x".repeat(2000),
    k: 4,
    token_budget: 10,
  }, {
    rootDir,
    env: { KNOWGRPH_PROBE_TREE_MODEL: "qwen-local" },
    fetchImpl: async () => {
      called = true;
      throw new Error("unexpected model call");
    },
  });

  assert.equal(called, false);
  assert.equal(result.degraded, true);
  assert.equal(result.degraded_reason, "token_budget_ceiling");
  assert.equal(result.token_budget.within_budget, false);
  assert.equal(result.recalled_exemplars.length, 0);
});

test("probe.generate uses host-owned Ollama adapter when configured and keeps cost local-zero", async () => {
  const rootDir = await tempRoot();
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return {
      ok: true,
      async json() {
        return {
          model: "qwen-local",
          message: {
            content: JSON.stringify({
              options: [
                { text: "What language should the care-plan coach use first?", rationale: "Localizes the first branch without collecting PHI." },
                { text: "Who needs the handoff summary?", rationale: "Separates patient and caregiver paths." },
              ],
            }),
          },
          prompt_eval_count: 42,
          eval_count: 24,
        };
      },
    };
  };

  const result = await generateProbeOptions({
    thread_root_id: "care-agent",
    current_node_id: "root",
    context_text: "care plan coach needs branching questions",
    k: 2,
    recall_top_k: 0,
  }, {
    rootDir,
    env: {
      KNOWGRPH_PROBE_TREE_MODEL: "qwen-local",
      KNOWGRPH_PROBE_TREE_MODEL_URL: "http://127.0.0.1:11434",
    },
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.degraded, false);
  assert.equal(result.model_adapter.configured, true);
  assert.equal(result.options[0].text, "What language should the care-plan coach use first?");
  assert.equal(result.cost_log.model, "qwen-local");
  assert.equal(result.cost_log.prompt_tokens, 42);
  assert.equal(result.cost_log.completion_tokens, 24);
  assert.equal(result.cost_log.estimated_cost_usd, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.stream, false);
  assert.equal(calls[0].body.format.type, "object");
});

test("probe.select persists a child node with branches-to edge and leaves parent markdown unchanged", async () => {
  const rootDir = await tempRoot();
  const parentPath = path.join(rootDir, "data/probe-tree/threads/thread-a/nodes/root.md");
  await fs.mkdir(path.dirname(parentPath), { recursive: true });
  await fs.writeFile(parentPath, "---\nid: \"root\"\n---\n\n# Root\n", "utf8");
  const beforeParent = await fs.readFile(parentPath, "utf8");

  const result = await selectProbeOption({
    thread_root_id: "thread-a",
    parent_node_id: "root",
    chosen_option: { id: "o1", text: "What outcome would make this resolved?", rationale: "terminal condition" },
  }, { rootDir });

  assert.equal(result.ok, true);
  assert.equal(result.parent_unchanged, true);
  assert.equal(result.cost_log.estimated_cost_usd, 0);
  assert.match(result.node_path, /^data\/probe-tree\/threads\/thread-a\/nodes\/probe_node_/);
  assert.equal(await fs.readFile(parentPath, "utf8"), beforeParent);

  const written = await fs.readFile(path.join(rootDir, result.node_path), "utf8");
  const parsed = parseProbeMarkdown(written);
  assert.equal(parsed.frontmatter.type, "probe");
  assert.equal(parsed.frontmatter.edge.type, "branches-to");
  assert.equal(parsed.frontmatter.edge.source, "root");
  assert.equal(parsed.frontmatter.edge.target, result.new_node_id);
  assert.equal(parsed.frontmatter.checkpoint.forked_from_node_id, "root");
});

test("probe markdown parser preserves semantic hyphen and dot frontmatter keys", () => {
  const parsed = parseProbeMarkdown([
    "---",
    "semantic-key: \"enabled\"",
    "kg.schema: \"kgc-computing-flow/v1\"",
    "flow: {\"nodes\":[],\"edges\":[]}",
    "---",
    "",
    "# Probe Node",
  ].join("\n"));

  assert.equal(parsed.frontmatter["semantic-key"], "enabled");
  assert.equal(parsed.frontmatter["kg.schema"], "kgc-computing-flow/v1");
  assert.deepEqual(parsed.frontmatter.flow, { nodes: [], edges: [] });
});

test("probe.evolve scores resolved path and writes a reusable memory exemplar", async () => {
  const rootDir = await tempRoot();
  const rootPath = path.join(rootDir, "data/probe-tree/threads/thread-b/nodes/root.md");
  await fs.mkdir(path.dirname(rootPath), { recursive: true });
  await fs.writeFile(rootPath, "---\nid: \"root\"\nstatus: \"active\"\nscore: 0\n---\n\n# Root\n", "utf8");
  const first = await selectProbeOption({
    thread_root_id: "thread-b",
    parent_node_id: "root",
    chosen_option: { id: "o1", text: "Which constraint matters most right now?", rationale: "narrowing" },
  }, { rootDir });
  const second = await selectProbeOption({
    thread_root_id: "thread-b",
    parent_node_id: first.new_node_id,
    chosen_option: { id: "o2", text: "What information is still missing?", rationale: "gap" },
    terminal: true,
  }, { rootDir });

  const result = await evolveProbeTree({
    thread_root_id: "thread-b",
    terminal_node_id: second.new_node_id,
    rating: 1,
  }, { rootDir });

  assert.equal(result.ok, true);
  assert.equal(result.updated_scores.length, 3);
  assert.equal(result.complete_path_scored, true);
  assert.ok(result.updated_scores.every((entry) => entry.score > 0));
  assert.match(result.exemplar_id, /^kgmem_/);
  assert.equal(result.cost_log.estimated_cost_usd, 0);

  const evolved = parseProbeMarkdown(await fs.readFile(path.join(rootDir, second.node_path), "utf8"));
  assert.equal(evolved.frontmatter.status, "resolved");
  assert.ok(evolved.frontmatter.score > 0);

  const memoryStore = JSON.parse(await fs.readFile(path.join(rootDir, "data/memory-layer/local-memory-store.json"), "utf8"));
  assert.equal(memoryStore.memories.length, 1);
  assert.equal(memoryStore.memories[0].metadata.terminal_node_id, second.new_node_id);
});

test("probe-tree clean-room smoke completes generate-select-evolve with observable local-zero economics", async () => {
  const rootDir = await tempRoot();
  const rootPath = path.join(rootDir, "data/probe-tree/threads/thread-smoke/nodes/root.md");
  await fs.mkdir(path.dirname(rootPath), { recursive: true });
  await fs.writeFile(rootPath, "---\nid: \"root\"\nstatus: \"active\"\nscore: 0\n---\n\n# Root\n", "utf8");

  const generated = await generateProbeOptions({
    thread_root_id: "thread-smoke",
    current_node_id: "root",
    context_text: "runtime-ready probe-tree clean-room smoke",
    k: 2,
    recall_top_k: 0,
    token_budget: 1200,
  }, { rootDir, env: {} });
  const selected = await selectProbeOption({
    thread_root_id: "thread-smoke",
    parent_node_id: "root",
    chosen_option: generated.options[0],
    terminal: true,
  }, { rootDir });
  const evolved = await evolveProbeTree({
    thread_root_id: "thread-smoke",
    terminal_node_id: selected.new_node_id,
    rating: 1,
  }, { rootDir });

  assert.equal(generated.ok, true);
  assert.equal(generated.token_budget.within_budget, true);
  assert.equal(generated.recalled_exemplars.length, 0);
  assert.equal(generated.cost_log.estimated_cost_usd, 0);
  assert.equal(selected.cost_log.estimated_cost_usd, 0);
  assert.equal(evolved.cost_log.estimated_cost_usd, 0);
  assert.equal(evolved.complete_path_scored, true);
  assert.deepEqual(evolved.path_node_ids, ["root", selected.new_node_id]);
});

test("probe.evolve rejects incomplete parent checkpoints unless explicitly partial", async () => {
  const rootDir = await tempRoot();
  const selected = await selectProbeOption({
    thread_root_id: "thread-c",
    parent_node_id: "missing-root",
    chosen_option: { id: "o1", text: "What information is still missing?", rationale: "gap" },
    terminal: true,
  }, { rootDir });

  await assert.rejects(
    () => evolveProbeTree({
      thread_root_id: "thread-c",
      terminal_node_id: selected.new_node_id,
    }, { rootDir }),
    /missing parent node\(s\): missing-root/,
  );

  const partial = await evolveProbeTree({
    thread_root_id: "thread-c",
    terminal_node_id: selected.new_node_id,
    allow_partial_path: true,
  }, { rootDir });
  assert.equal(partial.complete_path_scored, false);
  assert.deepEqual(partial.unscored_parent_node_ids, ["missing-root"]);
});

test("local MCP descriptors expose the probe-tree tools with mutation annotations", () => {
  const tools = buildKnowgrphLocalMcpToolDefinitions();
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  assert.equal(byName.get(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.probeGenerate).annotations.readOnlyHint, true);
  assert.equal(byName.get(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.probeSelect).annotations.idempotentHint, false);
  assert.equal(byName.get(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.probeEvolve).annotations.idempotentHint, false);
  assert.ok(byName.get(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.probeSelect).outputSchema.required.includes("cost_log"));
  assert.ok(byName.get(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.probeEvolve).outputSchema.required.includes("cost_log"));
  assert.equal(byName.get(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.probeEvolve).inputSchema.required[0], "thread_root_id");
});
