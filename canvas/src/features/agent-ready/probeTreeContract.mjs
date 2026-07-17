export const KNOWGRPH_PROBE_TREE_CONTRACT_VERSION = "knowgrph-probe-tree/v0.1";
export const PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION = "probe-tree-llm-response/v1";

export const KNOWGRPH_PROBE_TREE_TOOL_NAMES = Object.freeze({
  generate: "knowgrph.probe.generate",
  select: "knowgrph.probe.select",
  evolve: "knowgrph.probe.evolve",
});

export const PROBE_TREE_DEFAULTS = Object.freeze({
  optionCount: 3,
  minOptionCount: 2,
  maxOptionCount: 4,
  recallTopK: 5,
  tokenBudget: 1200,
  optionCompletionTokenEstimate: 64,
  maxDepth: 8,
  appMemoryScope: "knowgrph-probe-tree",
});

export const PROBE_TREE_FALLBACK_OPTIONS = Object.freeze([
  { text: "What outcome would make this resolved?", rationale: "Locks the terminal condition before more branching." },
  { text: "Which constraint matters most right now?", rationale: "Separates blockers from preferences so the next step can narrow quickly." },
  { text: "What information is still missing?", rationale: "Finds the smallest context gap before handing off to a downstream capability." },
  { text: "Which path should be ruled out first?", rationale: "Cuts low-value branches before spending more tokens or taps." },
]);

const PROBE_TREE_CONTEXT_STOP_WORDS = new Set([
  "about", "across", "active", "agent", "agentic", "against", "also", "and", "answer", "approval", "assess", "author", "authored", "body", "bounded", "branch", "branches",
  "canvas", "card", "cards", "care", "change", "changes", "command", "confirm", "confirms", "context", "continuation", "contract", "cost", "current", "depth", "editable", "economics", "fact", "facts", "for", "from", "frontmatter", "gate", "generate", "generated",
  "adviser", "advisor", "approved", "authoritative", "before", "call", "candidate", "confirm", "connect", "directive", "directives", "do", "each", "evidence", "fallback", "generation", "generic", "guidance", "harness", "into", "invocation", "keep", "knowgrph", "label", "licensed", "local", "log", "make", "media", "next", "node", "not", "output", "panel", "policies", "policy", "probe", "proof", "provider", "publish", "question", "questions",
  "id", "os", "ready", "regulator", "regulatory", "request", "require", "required", "requires", "response", "review", "rich", "route", "run", "runtime", "scope", "selected", "separate", "separately", "sme-care-agent", "smes", "source", "sources", "stop", "storyboard", "structured", "summary", "text", "the", "this", "title", "token", "tree", "unchanged", "unless",
  "what", "when", "where", "which", "who", "why", "using", "visibly", "widget", "with", "workspace", "would", "zero-cost",
]);

const cleanResponseText = (value, maxLength = 320) =>
  String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);

const safeResponseId = (value, fallback) => {
  const normalized = cleanResponseText(value, 160).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
};

const escapeProbeTreePattern = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildProbeTreeKeywordPattern = keyword => keyword.split("-")
  .map(escapeProbeTreePattern)
  .join("(?:-|\\s)+");

const readProbeTreeKeywordLabel = (contextText, keyword) => {
  const pattern = buildProbeTreeKeywordPattern(keyword);
  const match = String(contextText || "").match(new RegExp(`(?:^|[^a-z0-9-])(${pattern})(?=$|[^a-z0-9-])`, "i"));
  return String(match?.[1] || keyword).replace(/-/g, " ");
};

const boundedResponseInteger = (value, fallback, min, max) => {
  const parsed = Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
  return Math.max(min, Math.min(max, parsed));
};

export function collectProbeTreeContextKeywords(value, maxCount = 8) {
  const seen = new Set();
  const words = String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b(?:response\.)?structuredcontent\b/g, " ")
    .match(/[a-z][a-z0-9]*(?:-[a-z0-9]+)*/g) || [];
  const out = [];
  for (const word of words) {
    const compoundStopWord = word.includes("-")
      && word.split("-").every(part => PROBE_TREE_CONTEXT_STOP_WORDS.has(part));
    if (word.length < 3 || PROBE_TREE_CONTEXT_STOP_WORDS.has(word) || compoundStopWord || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= Math.max(1, Math.min(12, Number(maxCount) || 8))) break;
  }
  return out;
}

export function buildProbeTreeContextualFallbackOptions(contextText) {
  const keywords = collectProbeTreeContextKeywords(contextText, 6);
  if (keywords.length < 2) return [];
  const scope = keywords.slice(0, 6)
    .map(keyword => readProbeTreeKeywordLabel(contextText, keyword))
    .join(" / ");
  return [
    {
      text: `Which authoritative evidence confirms the current facts for the ${scope} scope?`,
      rationale: `Grounds the ${scope} decision in named, current source evidence instead of an inferred assumption.`,
      evidenceNeeded: `A dated system-of-record source for the ${scope} facts.`,
    },
    {
      text: `Which unresolved assumption in the ${scope} scope would materially change the recommended next action?`,
      rationale: `Surfaces the highest-impact unknown in the ${scope} request before a recommendation is promoted.`,
      evidenceNeeded: `The missing ${scope} fact plus the decision rule it changes.`,
    },
    {
      text: `What evidence and accountable reviewer are required before the ${scope} handoff?`,
      rationale: `Keeps the ${scope} branch reviewable and prevents an unapproved tool or adviser handoff.`,
      evidenceNeeded: `Acceptance evidence, reviewer identity, and the explicit approval boundary.`,
    },
    {
      text: `Which option in the ${scope} scope can be ruled out now, and what source supports that decision?`,
      rationale: `Prunes one low-value ${scope} path without spending another model turn on an unsupported option.`,
      evidenceNeeded: `A source-backed exclusion criterion for the rejected ${scope} option.`,
    },
  ];
}

export function isProbeTreeResponseContextRelevant({ contextText, responseTexts } = {}) {
  const keywords = collectProbeTreeContextKeywords(contextText, 8);
  if (keywords.length < 2) return true;
  const response = String(Array.isArray(responseTexts) ? responseTexts.join(" ") : responseTexts || "").toLowerCase();
  const matched = keywords.filter(keyword => {
    const pattern = buildProbeTreeKeywordPattern(keyword);
    return new RegExp(`(^|[^a-z0-9-])${pattern}([^a-z0-9-]|$)`, "i").test(response);
  });
  return matched.length >= Math.min(2, keywords.length);
}

const buildStructuredResponseOptions = ({ options, optionCount, degraded, contextText }) => {
  const candidates = [
    ...(Array.isArray(options) ? options : []),
    ...buildProbeTreeContextualFallbackOptions(contextText),
    ...PROBE_TREE_FALLBACK_OPTIONS,
  ];
  const seen = new Set();
  const out = [];
  for (const candidate of candidates) {
    const question = cleanResponseText(candidate?.text || candidate?.question);
    if (!question || seen.has(question.toLowerCase())) continue;
    seen.add(question.toLowerCase());
    const index = out.length;
    const candidateOptionId = cleanResponseText(candidate?.id, 160)
      || `probe-option-${safeResponseId(question, String(index + 1)).slice(0, 72)}-${index + 1}`;
    out.push({
      id: candidateOptionId,
      label: cleanResponseText(candidate?.label, 120) || question,
      kind: "text",
      candidateOptionId,
      question,
      output: "",
      rationale: cleanResponseText(candidate?.rationale) || "Keeps the next probe bounded and selectable.",
      evidenceNeeded: cleanResponseText(candidate?.evidenceNeeded || candidate?.evidence_needed)
        || "An explicit, source-backed answer for this question.",
      confidence: cleanResponseText(candidate?.confidence, 32) || (degraded ? "low" : "medium"),
      nextAction: KNOWGRPH_PROBE_TREE_TOOL_NAMES.select,
    });
    if (out.length >= optionCount) break;
  }
  return out;
};

export function buildProbeTreeStructuredResponse(args = {}) {
  const currentNodeId = cleanResponseText(args.currentNodeId || args.current_node_id, 160) || "n-deliver";
  const threadRootId = cleanResponseText(args.threadRootId || args.thread_root_id, 160) || currentNodeId;
  const contextText = cleanResponseText(args.contextText || args.context_text, 1200) || `Probe source ${currentNodeId}`;
  const optionCount = boundedResponseInteger(
    args.optionCount,
    Array.isArray(args.options) ? args.options.length : PROBE_TREE_DEFAULTS.optionCount,
    PROBE_TREE_DEFAULTS.minOptionCount,
    PROBE_TREE_DEFAULTS.maxOptionCount,
  );
  const probeTreeDepth = boundedResponseInteger(args.probeTreeDepth || args.probe_tree_depth, 1, 1, PROBE_TREE_DEFAULTS.maxDepth);
  const cards = buildStructuredResponseOptions({ options: args.options, optionCount, degraded: args.degraded === true, contextText })
    .map(card => ({ ...card, parentNodeId: currentNodeId, probeTreeDepth }));
  const panelId = `probe-tree-branches-${safeResponseId(currentNodeId, "current-node")}`;
  const panelOutput = [
    "# Probe-Tree Branches",
    "",
    `Source node: ${currentNodeId}`,
    `Contract: ${PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION}`,
    "",
    ...cards.map((card, index) => `${index + 1}. **${card.label}** — ${card.rationale}`),
  ].join("\n");
  return {
    structuredContent: {
      contractVersion: PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
      widgets: [{
        id: currentNodeId,
        label: `Probe source: ${currentNodeId}`,
        kind: "text",
        nodeTypeId: "TextGeneration",
        formId: "textGeneration",
        widgetTypeId: "default",
        prompt: contextText,
        output: contextText,
        cardTypeLabel: "Widget Card",
        lane: "SOURCE",
        invocation: KNOWGRPH_PROBE_TREE_TOOL_NAMES.generate,
        responseContractVersion: PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
        probeTreeThreadRootId: threadRootId,
        probeTreeCurrentNodeId: currentNodeId,
      }],
      cards,
      panels: [{
        id: panelId,
        label: "Probe-Tree Branches",
        kind: "text",
        output: panelOutput,
        responseContractVersion: PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
        probeTreeThreadRootId: threadRootId,
        probeTreeCurrentNodeId: currentNodeId,
        probeTreeOptionCount: cards.length,
      }],
      edges: [{
        id: `${panelId}-summary`,
        source: currentNodeId,
        sourceHandle: "text_out",
        target: panelId,
        targetHandle: "output",
        label: "probeTreeSummary",
      }],
    },
  };
}

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
    k: { type: "integer", minimum: PROBE_TREE_DEFAULTS.minOptionCount, maximum: PROBE_TREE_DEFAULTS.maxOptionCount, default: PROBE_TREE_DEFAULTS.optionCount },
    recall_top_k: { type: "integer", minimum: 0, maximum: 20, default: PROBE_TREE_DEFAULTS.recallTopK },
    token_budget: { type: "integer", minimum: 1, default: PROBE_TREE_DEFAULTS.tokenBudget },
    probe_tree_depth: { type: "integer", minimum: 1, maximum: PROBE_TREE_DEFAULTS.maxDepth, default: 1 },
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
  required: ["contractVersion", "ok", "options", "response", "cost_log"],
  properties: {
    contractVersion: { type: "string" },
    ok: { type: "boolean" },
    options: { type: "array", minItems: PROBE_TREE_DEFAULTS.minOptionCount, maxItems: PROBE_TREE_DEFAULTS.maxOptionCount, items: optionSchema },
    response: {
      type: "object",
      additionalProperties: false,
      required: ["structuredContent"],
      properties: {
        structuredContent: {
          type: "object",
          additionalProperties: true,
          required: ["contractVersion", "widgets", "cards", "panels", "edges"],
          properties: {
            contractVersion: { const: PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION },
            widgets: { type: "array", minItems: 1, maxItems: 1, items: { type: "object", additionalProperties: true } },
            cards: { type: "array", minItems: PROBE_TREE_DEFAULTS.minOptionCount, maxItems: PROBE_TREE_DEFAULTS.maxOptionCount, items: { type: "object", additionalProperties: true } },
            panels: { type: "array", minItems: 1, maxItems: 1, items: { type: "object", additionalProperties: true } },
            edges: { type: "array", items: { type: "object", additionalProperties: true } },
          },
        },
      },
    },
    degraded: { type: "boolean" },
    recalled_exemplars: { type: "array", items: { type: "object", additionalProperties: true } },
    token_budget: { type: "object", additionalProperties: true },
    cost_log: costLogSchema,
  },
});

export const PROBE_SELECT_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: true,
  required: ["contractVersion", "ok", "new_node_id", "edge_id", "node_path", "cost_log"],
  properties: {
    contractVersion: { type: "string" },
    ok: { type: "boolean" },
    new_node_id: { type: "string" },
    edge_id: { type: "string" },
    node_path: { type: "string" },
    checkpoint: { type: "object", additionalProperties: true },
    cost_log: costLogSchema,
  },
});

export const PROBE_EVOLVE_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: true,
  required: ["contractVersion", "ok", "updated_scores", "exemplar_id", "cost_log"],
  properties: {
    contractVersion: { type: "string" },
    ok: { type: "boolean" },
    updated_scores: { type: "array", items: { type: "object", additionalProperties: true } },
    exemplar_id: { type: "string" },
    complete_path_scored: { type: "boolean" },
    unscored_parent_node_ids: { type: "array", items: { type: "string" } },
    cost_log: costLogSchema,
  },
});
