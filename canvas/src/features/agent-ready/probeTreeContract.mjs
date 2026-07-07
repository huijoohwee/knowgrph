export const KNOWGRPH_PROBE_TREE_CONTRACT_VERSION = "knowgrph-probe-tree/v0.1";

export const KNOWGRPH_PROBE_TREE_TOOL_NAMES = Object.freeze({
  generate: "knowgrph.probe.generate",
  select: "knowgrph.probe.select",
  evolve: "knowgrph.probe.evolve",
});

export const PROBE_TREE_DEFAULTS = Object.freeze({
  optionCount: 3,
  maxOptionCount: 4,
  recallTopK: 5,
  tokenBudget: 1200,
  optionCompletionTokenEstimate: 64,
  maxDepth: 8,
  appMemoryScope: "knowgrph-probe-tree",
});

const optionSchema = Object.freeze({
  type: "object",
  additionalProperties: true,
  required: ["id", "text", "rationale"],
  properties: {
    id: { type: "string" },
    text: { type: "string" },
    rationale: { type: "string" },
  },
});

const costLogSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["model", "prompt_tokens", "completion_tokens", "cache_hits", "estimated_cost_usd"],
  properties: {
    model: { type: "string" },
    prompt_tokens: { type: "number" },
    completion_tokens: { type: "number" },
    cache_hits: { type: "number" },
    estimated_cost_usd: { oneOf: [{ type: "number" }, { type: "null" }] },
  },
});

export const PROBE_GENERATE_INPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["thread_root_id", "current_node_id"],
  properties: {
    thread_root_id: { type: "string", minLength: 1 },
    current_node_id: { type: "string", minLength: 1 },
    context_text: { type: "string" },
    k: { type: "integer", minimum: 1, maximum: PROBE_TREE_DEFAULTS.maxOptionCount, default: PROBE_TREE_DEFAULTS.optionCount },
    recall_top_k: { type: "integer", minimum: 0, maximum: 20, default: PROBE_TREE_DEFAULTS.recallTopK },
    token_budget: { type: "integer", minimum: 1, default: PROBE_TREE_DEFAULTS.tokenBudget },
    graph_store_dir: { type: "string" },
  },
});

export const PROBE_SELECT_INPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["thread_root_id", "parent_node_id", "chosen_option"],
  properties: {
    thread_root_id: { type: "string", minLength: 1 },
    parent_node_id: { type: "string", minLength: 1 },
    chosen_option: optionSchema,
    context_text: { type: "string" },
    terminal: { type: "boolean", default: false },
    graph_store_dir: { type: "string" },
  },
});

export const PROBE_EVOLVE_INPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["thread_root_id"],
  properties: {
    thread_root_id: { type: "string", minLength: 1 },
    terminal_node_id: { type: "string" },
    resolved: { type: "boolean", default: true },
    rating: { type: "number", minimum: 0, maximum: 1 },
    allow_partial_path: { type: "boolean", default: false },
    graph_store_dir: { type: "string" },
  },
});

export const PROBE_GENERATE_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: true,
  required: ["contractVersion", "ok", "options", "cost_log"],
  properties: {
    contractVersion: { type: "string" },
    ok: { type: "boolean" },
    options: { type: "array", items: optionSchema },
    degraded: { type: "boolean" },
    recalled_exemplars: { type: "array", items: { type: "object", additionalProperties: true } },
    token_budget: { type: "object", additionalProperties: true },
    cost_log: costLogSchema,
  },
});

export const PROBE_SELECT_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: true,
  required: ["contractVersion", "ok", "new_node_id", "edge_id", "node_path"],
  properties: {
    contractVersion: { type: "string" },
    ok: { type: "boolean" },
    new_node_id: { type: "string" },
    edge_id: { type: "string" },
    node_path: { type: "string" },
    checkpoint: { type: "object", additionalProperties: true },
  },
});

export const PROBE_EVOLVE_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: true,
  required: ["contractVersion", "ok", "updated_scores", "exemplar_id"],
  properties: {
    contractVersion: { type: "string" },
    ok: { type: "boolean" },
    updated_scores: { type: "array", items: { type: "object", additionalProperties: true } },
    exemplar_id: { type: "string" },
    complete_path_scored: { type: "boolean" },
    unscored_parent_node_ids: { type: "array", items: { type: "string" } },
  },
});
