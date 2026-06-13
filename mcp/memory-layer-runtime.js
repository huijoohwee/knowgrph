import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  KNOWGRPH_MEMORY_LAYER_CONTRACT_VERSION,
  KNOWGRPH_MEMORY_LAYER_DEFAULT_MAX_MEMORY_TOKENS,
  KNOWGRPH_MEMORY_LAYER_DEFAULT_TOP_K,
  buildMemoryCostLog,
  estimateMemoryTokens,
  normalizeMemoryMessages,
  normalizeMemoryScope,
  normalizeMemoryText,
  requireMemoryScope,
} from "../canvas/src/features/memory/aiAgentsMemoryLayerContract.mjs";

const STORE_VERSION = "knowgrph-memory-store/v0.1";
const WORD_RE = /[a-z0-9]+/gi;

const nowIso = () => new Date().toISOString();

const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
};

const hashId = (prefix, parts) =>
  `${prefix}_${createHash("sha256").update(parts.map((part) => String(part || "")).join("\n")).digest("hex").slice(0, 20)}`;

const tokenize = (text) =>
  Array.from(new Set(String(text || "").toLowerCase().match(WORD_RE) || []))
    .filter((token) => token.length > 1);

const scoreMemory = (query, memory) => {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return 0;
  const memoryTokens = new Set(tokenize(memory));
  const overlap = queryTokens.filter((token) => memoryTokens.has(token)).length;
  if (!overlap) return 0;
  return Number((overlap / queryTokens.length).toFixed(6));
};

const scopeMatches = (recordScope, queryScope) =>
  Object.entries(queryScope).every(([key, value]) => recordScope?.[key] === value);

const buildStorePath = ({ rootDir, storePath }) => {
  const configured = String(storePath || process.env.KNOWGRPH_MEMORY_STORE_PATH || "").trim();
  if (configured) return path.resolve(rootDir, configured);
  return path.join(rootDir, "data", "memory-layer", "local-memory-store.json");
};

const readStore = async (storePath) => {
  try {
    const text = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.memories)) return parsed;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return { version: STORE_VERSION, updated_at: nowIso(), memories: [] };
};

const writeStore = async (storePath, store) => {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
};

const memoryTextFromInput = (input) => {
  const text = normalizeMemoryText(input?.text);
  if (text) return text;
  const messages = normalizeMemoryMessages(input?.messages);
  return normalizeMemoryText(messages.map((message) => `${message.role}: ${message.content}`).join("\n"));
};

export const addMemoryLayerMemory = async (input = {}, options = {}) => {
  const startedAt = performance.now();
  const scope = requireMemoryScope(input);
  const memory = memoryTextFromInput(input);
  if (!memory) throw new Error("Memory add requires text or at least one valid message.");

  const storePath = buildStorePath(options);
  const store = await readStore(storePath);
  const metadata = input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
    ? { ...input.metadata }
    : {};
  const memoryKey = normalizeMemoryText(metadata.memory_key || metadata.preference_key);
  const identityParts = [stableStringify(scope), memoryKey || memory];
  const id = hashId("kgmem", identityParts);
  const existingIndex = store.memories.findIndex((entry) => entry.id === id);
  const timestamp = nowIso();
  const baseRecord = {
    id,
    memory,
    scope,
    categories: Array.isArray(metadata.categories) ? metadata.categories.map(normalizeMemoryText).filter(Boolean) : [],
    metadata,
    created_at: timestamp,
    updated_at: timestamp,
  };

  let event = "ADD";
  if (existingIndex >= 0) {
    const previous = store.memories[existingIndex];
    event = previous.memory === memory ? "NONE" : "UPDATE";
    store.memories[existingIndex] = {
      ...previous,
      ...baseRecord,
      created_at: previous.created_at || timestamp,
      updated_at: event === "NONE" ? previous.updated_at || timestamp : timestamp,
    };
  } else {
    store.memories.push(baseRecord);
  }

  store.updated_at = timestamp;
  await writeStore(storePath, store);
  const latencyMs = performance.now() - startedAt;
  return {
    contractVersion: KNOWGRPH_MEMORY_LAYER_CONTRACT_VERSION,
    memory_ids: [id],
    results: [{ id, memory, event }],
    cost_log: buildMemoryCostLog({ provider: "local-json", operation: "add", latencyMs }),
    store_path: storePath,
  };
};

export const searchMemoryLayerMemories = async (input = {}, options = {}) => {
  const startedAt = performance.now();
  const scope = requireMemoryScope(input);
  const query = normalizeMemoryText(input.query);
  if (!query) throw new Error("Memory search requires a non-empty query.");
  const topK = Math.max(1, Math.min(100, Math.floor(Number(input.top_k) || KNOWGRPH_MEMORY_LAYER_DEFAULT_TOP_K)));
  const storePath = buildStorePath(options);
  const store = await readStore(storePath);
  const results = store.memories
    .filter((entry) => scopeMatches(entry.scope, scope))
    .map((entry) => ({ ...entry, score: scoreMemory(query, entry.memory) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || String(right.updated_at || "").localeCompare(String(left.updated_at || "")))
    .slice(0, topK)
    .map((entry) => ({
      id: entry.id,
      memory: entry.memory,
      score: entry.score,
      categories: entry.categories || [],
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      metadata: entry.metadata || {},
    }));
  const latencyMs = performance.now() - startedAt;
  return {
    contractVersion: KNOWGRPH_MEMORY_LAYER_CONTRACT_VERSION,
    results,
    latency_ms: Math.max(0, latencyMs),
    cost_log: buildMemoryCostLog({ provider: "local-json", operation: "search", latencyMs }),
    store_path: storePath,
  };
};

export const assembleMemoryLayerPrompt = (input = {}) => {
  const startedAt = performance.now();
  const base = normalizeMemoryText(input.base_system_message);
  const memories = Array.isArray(input.memories) ? input.memories : [];
  const maxTokens = Math.max(0, Math.floor(Number(input.max_memory_tokens) || KNOWGRPH_MEMORY_LAYER_DEFAULT_MAX_MEMORY_TOKENS));
  const selected = [];
  let tokenEstimate = 0;
  for (const memory of memories) {
    const text = normalizeMemoryText(memory?.memory);
    if (!text) continue;
    const nextTokens = estimateMemoryTokens(text);
    if (tokenEstimate + nextTokens > maxTokens) break;
    selected.push(text);
    tokenEstimate += nextTokens;
  }
  const memorySection = selected.length
    ? `\n\n## Relevant Context\n${selected.map((memory) => `- ${memory}`).join("\n")}`
    : "";
  const latencyMs = performance.now() - startedAt;
  return {
    contractVersion: KNOWGRPH_MEMORY_LAYER_CONTRACT_VERSION,
    enriched_system_message: `${base}${memorySection}`,
    injected_memory_count: selected.length,
    injected_token_estimate: tokenEstimate,
    cost_log: buildMemoryCostLog({ provider: "local-json", operation: "assemble_prompt", latencyMs }),
  };
};

export const inspectMemoryLayerStore = async (options = {}) => {
  const storePath = buildStorePath(options);
  const store = await readStore(storePath);
  const scopes = Array.from(new Set(store.memories.map((entry) => stableStringify(normalizeMemoryScope(entry.scope)))))
    .sort();
  return {
    contractVersion: KNOWGRPH_MEMORY_LAYER_CONTRACT_VERSION,
    store_path: storePath,
    memory_count: store.memories.length,
    scope_count: scopes.length,
    updated_at: store.updated_at || "",
  };
};
