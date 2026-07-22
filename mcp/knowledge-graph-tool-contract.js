const INVOCATION_BY_OPERATION = Object.freeze({
  ingest: Object.freeze({
    action: "/knowledge.graph.ingest",
    semantics: Object.freeze(["#knowledge-graph", "#mcp", "#runtime-ready"]),
    bindings: Object.freeze(["@working-directory", "@knowledge-graph", "@operator", "@runtime-proof"]),
  }),
  query: Object.freeze({
    action: "/knowledge.graph.query",
    semantics: Object.freeze(["#knowledge-graph", "#mcp", "#vcc"]),
    bindings: Object.freeze(["@knowledge-graph", "@runtime-proof"]),
  }),
  explain: Object.freeze({
    action: "/knowledge.graph.explain",
    semantics: Object.freeze(["#knowledge-graph", "#mcp", "#vcc"]),
    bindings: Object.freeze(["@knowledge-graph", "@runtime-proof"]),
  }),
});

const stringArray = (description, maxItems = 128) => ({
  type: "array",
  items: { type: "string", minLength: 1, maxLength: 512 },
  maxItems,
  uniqueItems: true,
  description,
});

const invocationSchema = (operation) => ({
  type: "object",
  additionalProperties: false,
  description:
    "Optional exact Agentic Canvas OS invocation audit packet. The dictionaries remain authoritative; including this packet never grants filesystem, network, spend, or deployment authority.",
  required: ["action", "semantics", "bindings"],
  properties: {
    action: { const: INVOCATION_BY_OPERATION[operation].action },
    semantics: {
      ...stringArray("Authoritative # semantic tokens resolved from Agentic Canvas OS.", 12),
      const: [...INVOCATION_BY_OPERATION[operation].semantics],
    },
    bindings: {
      ...stringArray("Authoritative @ binding tokens resolved from Agentic Canvas OS.", 12),
      const: [...INVOCATION_BY_OPERATION[operation].bindings],
    },
  },
});

const commonOutputSchema = (operation) => ({
  type: "object",
  additionalProperties: true,
  required: ["schema", "ok", "operation"],
  properties: {
    schema: { type: "string", pattern: "^knowgrph-knowledge-graph(?:-[a-z-]+)?/v[0-9]+$" },
    ok: { type: "boolean" },
    operation: { const: operation },
    error: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message"],
      properties: {
        code: { type: "string", minLength: 1 },
        message: { type: "string", minLength: 1 },
        details: { type: "object", additionalProperties: true },
      },
    },
  },
});

const INGEST_INPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["rootPath"],
  properties: {
    rootPath: {
      type: "string",
      minLength: 1,
      description:
        "Codebase or corpus root. It must resolve inside the host-owned allowed-root set after realpath and symlink checks.",
    },
    outputPath: {
      type: "string",
      minLength: 1,
      description:
        "Optional JSON artifact path inside the host-owned output boundary. The runtime writes atomically and excludes that generated-output boundary from discovery when it is nested under the indexed root.",
    },
    include: stringArray("Optional repo-relative include globs or suffixes."),
    exclude: stringArray("Optional repo-relative exclude globs or path prefixes."),
    maxFiles: { type: "integer", minimum: 1, maximum: 100000, default: 10000 },
    maxFileBytes: { type: "integer", minimum: 1, maximum: 100000000, default: 2000000 },
    maxTotalBytes: { type: "integer", minimum: 1, maximum: 2000000000, default: 200000000 },
    useCache: { type: "boolean", default: true },
    strict: {
      type: "boolean",
      default: true,
      description:
        "Require explained, source-backed edges and refuse replacement after parser errors, partial syntax extraction, or invalid output. Typed unsupported and size-limited omissions remain in the manifest.",
    },
    invocation: invocationSchema("ingest"),
  },
});

const QUERY_INPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["artifactPath", "expectedDigest", "mode"],
  properties: {
    artifactPath: { type: "string", minLength: 1 },
    expectedDigest: {
      type: "string",
      pattern: "^[0-9a-f]{64}$",
      description: "Exact digest returned by ingestion; mismatch fails closed instead of selecting a replaced snapshot.",
    },
    mode: { enum: ["search", "path", "neighbors", "impact", "summary"] },
    query: { type: "string", maxLength: 4000 },
    from: { type: "string", maxLength: 1000 },
    to: { type: "string", maxLength: 1000 },
    direction: { enum: ["outgoing", "incoming", "both"], default: "both" },
    edgeLabels: stringArray("Optional exact edge-label allowlist for traversal.", 64),
    maxDepth: { type: "integer", minimum: 0, maximum: 12, default: 3 },
    limit: { type: "integer", minimum: 1, maximum: 200, default: 20 },
    invocation: invocationSchema("query"),
  },
});

const EXPLAIN_INPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["artifactPath", "expectedDigest", "edgeId"],
  properties: {
    artifactPath: { type: "string", minLength: 1 },
    expectedDigest: {
      type: "string",
      pattern: "^[0-9a-f]{64}$",
      description: "Exact digest returned by ingestion; mismatch fails closed instead of selecting a replaced snapshot.",
    },
    edgeId: { type: "string", minLength: 1, maxLength: 2000 },
    invocation: invocationSchema("explain"),
  },
});

export const KNOWLEDGE_GRAPH_INVOCATIONS = INVOCATION_BY_OPERATION;
export const KNOWLEDGE_GRAPH_INPUT_SCHEMAS = Object.freeze({
  ingest: INGEST_INPUT_SCHEMA,
  query: QUERY_INPUT_SCHEMA,
  explain_edge: EXPLAIN_INPUT_SCHEMA,
});

export function buildKnowledgeGraphToolDefinitions({ toolNames, withDefaults, readOnlyAnnotations, processAnnotations }) {
  return [
    withDefaults({
      name: toolNames.knowledgeGraphIngest,
      title: "Ingest deterministic knowledge graph",
      description:
        "Use this when a local MCP host needs /knowledge.graph.ingest #knowledge-graph #mcp #runtime-ready @working-directory @knowledge-graph @operator @runtime-proof to inventory a bounded codebase, docs, SQL, configs, and PDFs into one deterministic explained-edge artifact. This makes zero model calls, uses no vector store, and performs no network access.",
      inputSchema: INGEST_INPUT_SCHEMA,
      outputSchema: commonOutputSchema("ingest"),
    }, processAnnotations),
    withDefaults({
      name: toolNames.knowledgeGraphQuery,
      title: "Query deterministic knowledge graph",
      description:
        "Use this when a local MCP host needs /knowledge.graph.query #knowledge-graph #mcp #vcc @knowledge-graph @runtime-proof for bounded lexical search, directed paths, neighborhoods, impact traversal, or summaries over an existing local artifact. Results retain exact source and edge evidence.",
      inputSchema: QUERY_INPUT_SCHEMA,
      outputSchema: commonOutputSchema("query"),
    }, readOnlyAnnotations),
    withDefaults({
      name: toolNames.knowledgeGraphExplainEdge,
      title: "Explain knowledge graph edge",
      description:
        "Use this when a local MCP host needs /knowledge.graph.explain #knowledge-graph #mcp #vcc @knowledge-graph @runtime-proof to read the deterministic rule, parser, source span, excerpt hash, confidence, premises, and ambiguity for one edge without model or vector retrieval.",
      inputSchema: EXPLAIN_INPUT_SCHEMA,
      outputSchema: commonOutputSchema("explain_edge"),
    }, readOnlyAnnotations),
  ];
}
