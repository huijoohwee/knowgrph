import {
  extractProbeTreeClarificationContextText,
  extractProbeTreeUserInputText,
} from "../canvas/src/features/agent-ready/probeTreeUserInputRelevance.mjs";

const PROVIDER_OLLAMA = "ollama";
const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_TIMEOUT_MS = 20000;

const normalizeString = (value) => String(value || "").replace(/\s+/g, " ").trim();

const isLoopbackHost = (hostname) => (
  hostname === "localhost"
  || hostname === "127.0.0.1"
  || hostname === "::1"
  || hostname.endsWith(".localhost")
);

const parseEndpoint = ({ endpoint, allowRemote }) => {
  let url;
  try {
    url = new URL(normalizeString(endpoint) || DEFAULT_OLLAMA_URL);
  } catch {
    throw new Error("KNOWGRPH_PROBE_TREE_MODEL_URL must be a valid URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("KNOWGRPH_PROBE_TREE_MODEL_URL must use http or https.");
  }
  if (url.username || url.password) {
    throw new Error("KNOWGRPH_PROBE_TREE_MODEL_URL must not include embedded credentials.");
  }
  if (!allowRemote && !isLoopbackHost(url.hostname)) {
    throw new Error("Probe-tree model URL must be loopback unless KNOWGRPH_PROBE_TREE_MODEL_ALLOW_REMOTE=1.");
  }
  return url;
};

export function readProbeTreeModelConfig(env = process.env) {
  const model = normalizeString(env.KNOWGRPH_PROBE_TREE_MODEL);
  const provider = normalizeString(env.KNOWGRPH_PROBE_TREE_MODEL_PROVIDER || (model ? PROVIDER_OLLAMA : ""));
  if (!provider && !model) return { configured: false, provider: "", model: "" };
  if (provider !== PROVIDER_OLLAMA) {
    return { configured: false, provider, model, disabledReason: "unsupported_model_provider" };
  }
  if (!model) return { configured: false, provider, model, disabledReason: "missing_model" };
  const allowRemote = normalizeString(env.KNOWGRPH_PROBE_TREE_MODEL_ALLOW_REMOTE).toLowerCase() === "1";
  const endpoint = parseEndpoint({ endpoint: env.KNOWGRPH_PROBE_TREE_MODEL_URL, allowRemote });
  const timeoutMs = Math.max(1000, Math.min(120000, Math.floor(Number(env.KNOWGRPH_PROBE_TREE_MODEL_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS)));
  return { configured: true, provider, model, endpoint: endpoint.toString().replace(/\/$/, ""), timeoutMs };
}

const optionFormatSchema = Object.freeze({
  type: "object",
  properties: {
    options: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          rationale: { type: "string" },
          evidenceNeeded: { type: "string" },
          selectionOptions: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
          contextAnchors: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
        },
        required: ["text", "rationale", "evidenceNeeded", "selectionOptions", "contextAnchors"],
      },
    },
  },
  required: ["options"],
});

export const buildProbeModelPrompt = ({ contextText, recalledExemplars, k }) => [
  "Generate concise candidate next questions and bounded answers for a branching probe-tree.",
  "Return JSON only with shape {\"options\":[{\"text\":\"...\",\"rationale\":\"...\",\"evidenceNeeded\":\"...\",\"selectionOptions\":[\"...\",\"...\"],\"contextAnchors\":[\"...\",\"...\"]}]}",
  `Return at most ${k} options.`,
  "Use the current user input as the only content source. Do not use stock evidence, process, policy, reviewer, or system-of-record choices unless those concepts appear in that input.",
  "Each question must resolve a concrete choice named by the user; each selectionOptions array must contain 2-4 concise answers to that exact question.",
  "Ask about missing parameters that materially change the requested answer. Never pair copied nouns inside canned relationship/evidence/dependency/decision-order questions or wrap the whole query in scope, priority, constraint, basis, or deliverable templates.",
  "Every selectionOptions item must be a suggested clarification answer. Never split the selected focus or repeat its words as bare answer fragments.",
  "Give every card a different user-named focus. Never reuse a choice label, another card's complete selection set, or a subset or superset of another card's choices.",
  "Each contextAnchors array must copy 2-6 short phrases verbatim from the current user input. Never invent an anchor and never copy wording from an exemplar.",
  "Questions must ask for missing context or user-selected direction, not answer the user's problem.",
  "If the selected input does not support 2-4 distinct query-specific cards without invented facts, return {\"options\":[]} instead of generic or hardcoded filler.",
  "Avoid medical advice, diagnosis, medication instructions, PHI, credentials, URLs, or provider claims.",
  "",
  `Current selected child input: ${normalizeString(extractProbeTreeUserInputText(contextText))}`,
  `Preceding probe context (lineage only): ${normalizeString(extractProbeTreeClarificationContextText(contextText)) || "none"}`,
  recalledExemplars.length
    ? `Resolved structural exemplars (structure only; never reuse their content):\n${recalledExemplars.map((entry) => `- ${normalizeString(entry.memory)}`).join("\n")}`
    : "Resolved exemplars: none",
].join("\n");

const parseOptionsJson = (text) => {
  const raw = normalizeString(text);
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return [];
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return [];
    }
  }
  const options = Array.isArray(parsed?.options) ? parsed.options : [];
  return options.map((option) => ({
    text: normalizeString(option?.text),
    rationale: normalizeString(option?.rationale),
    evidenceNeeded: normalizeString(option?.evidenceNeeded),
    selectionOptions: Array.isArray(option?.selectionOptions) ? option.selectionOptions.map(normalizeString).filter(Boolean) : [],
    contextAnchors: Array.isArray(option?.contextAnchors) ? option.contextAnchors.map(normalizeString).filter(Boolean) : [],
  })).filter((option) => (
    option.text
    && option.rationale
    && option.evidenceNeeded
    && option.selectionOptions.length >= 2
    && option.contextAnchors.length >= 2
  ));
};

export async function generateProbeOptionsWithLocalModel({ contextText, recalledExemplars = [], k, env = process.env, fetchImpl = fetch }) {
  const config = readProbeTreeModelConfig(env);
  if (!config.configured) return { configured: false, reason: config.disabledReason || "model_not_configured", options: [], costLog: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(`${config.endpoint}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        stream: false,
        format: optionFormatSchema,
        options: { temperature: 0 },
        messages: [
          { role: "system", content: "You produce strict JSON for a local Knowgrph probe-tree agent." },
          { role: "user", content: buildProbeModelPrompt({ contextText, recalledExemplars, k }) },
        ],
      }),
    });
    if (!response.ok) throw new Error(`ollama_http_${response.status}`);
    const payload = await response.json();
    const content = normalizeString(payload?.message?.content || payload?.response);
    const options = parseOptionsJson(content).slice(0, k);
    if (!options.length) throw new Error("model_returned_no_valid_options");
    return {
      configured: true,
      provider: config.provider,
      model: normalizeString(payload?.model) || config.model,
      options,
      costLog: {
        model: normalizeString(payload?.model) || config.model,
        prompt_tokens: Math.max(0, Number(payload?.prompt_eval_count) || 0),
        completion_tokens: Math.max(0, Number(payload?.eval_count) || 0),
        cache_hits: 0,
        estimated_cost_usd: 0,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}
