const COST_LOG_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: true,
  required: ["model", "prompt_tokens", "completion_tokens", "cache_hits", "estimated_cost_usd", "incomplete"],
  properties: {
    model: { type: "string" },
    prompt_tokens: { type: "integer", minimum: 0 },
    completion_tokens: { type: "integer", minimum: 0 },
    cache_hits: { type: "integer", minimum: 0 },
    estimated_cost_usd: { type: "number", minimum: 0 },
    incomplete: { type: "boolean" },
  },
});

const RESULT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: true,
  required: ["ok", "cost_log", "mutation_performed"],
  properties: {
    ok: { type: "boolean" },
    cost_log: COST_LOG_SCHEMA,
    mutation_performed: { type: "boolean" },
    error: { type: "object", additionalProperties: true },
  },
});

const APPROVAL_TOKEN_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: true,
  required: ["gateId", "issuedAt", "consumed"],
  properties: {
    gateId: { type: "string", const: "sme-marketplace-match" },
    issuedAt: { type: ["number", "string"] },
    consumed: { type: "boolean" },
    verified: { type: "boolean" },
    signature: { type: "string" },
    tokenId: { type: "string" },
  },
});

export const buildSmeRiskCopilotLocalToolDefinitions = ({ toolNames, withDefaults, readOnlyAnnotations, processAnnotations }) => [
  withDefaults({
    name: toolNames.smeSourceNormalize,
    description: "Use this when a local MCP host needs to validate and summarize a redacted SME profile before persistence or model spend; registry, financial-account, and credential-like content fails closed.",
    inputSchema: { type: "object", additionalProperties: false, required: ["profile"], properties: { profile: { type: "object", additionalProperties: true } } },
    outputSchema: RESULT_SCHEMA,
  }, readOnlyAnnotations),
  withDefaults({
    name: toolNames.smeTriggerEvaluate,
    description: "Use this when a local MCP host needs to evaluate typed Risk Exposure Graph changes against the six-row published SME Growth-Stage Trigger Map with exact-zero deterministic cost.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["reg_delta"],
      properties: {
        reg_delta: {
          type: "object",
          additionalProperties: false,
          required: ["changes"],
          properties: {
            changes: {
              type: "array",
              maxItems: 100,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["element", "milestone", "source_field"],
                properties: {
                  element: { type: "string", enum: ["node", "edge", "cluster"] },
                  milestone: { type: "string" },
                  source_field: { type: "string", minLength: 1 },
                  operation: { type: "string", enum: ["added", "removed", "updated"], default: "added" },
                },
              },
            },
          },
        },
      },
    },
    outputSchema: RESULT_SCHEMA,
  }, readOnlyAnnotations),
  withDefaults({
    name: toolNames.smeBrokerDraftNudge,
    description: "Use this when a local MCP host needs to create a plain-language draft for one declared SME trigger; the tool never sends or contacts a third party.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["trigger_event"],
      properties: {
        trigger_event: { type: "object", additionalProperties: true, required: ["rule_id", "milestone"], properties: { rule_id: { type: "string" }, milestone: { type: "string" }, source_field: { type: "string" } } },
        target_lang: { type: "string", enum: ["en", "en-SG", "ms", "id", "zh"], default: "en-SG" },
        adapter_available: { type: "boolean", default: true },
      },
    },
    outputSchema: RESULT_SCHEMA,
  }, readOnlyAnnotations),
  withDefaults({
    name: toolNames.smeMarketplaceMatch,
    description: "Use this when a local MCP host needs to rank at most ten neutral coverage categories for a gap and create a licensed-broker handoff packet only with a verified, unexpired, unconsumed SME marketplace approval token.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["approved_gap_id", "gap", "approval_token"],
      properties: {
        approved_gap_id: { type: "string", minLength: 1 },
        gap: { type: "object", additionalProperties: true, required: ["domain"], properties: { domain: { type: "string", enum: ["cyber", "supply_chain", "asset_physical"] } } },
        approval_token: APPROVAL_TOKEN_SCHEMA,
        max_candidates: { type: "integer", minimum: 1, maximum: 10, default: 10 },
      },
    },
    outputSchema: RESULT_SCHEMA,
  }, processAnnotations),
  withDefaults({
    name: toolNames.smeMultilingualAdapt,
    description: "Use this when a local MCP host needs approved SME text in en-SG, ms, id, or zh; when no localized output is available, return plain en-SG with a typed fallback reason.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["text", "target_lang"],
      properties: {
        text: { type: "string", minLength: 1 },
        target_lang: { type: "string", enum: ["en", "en-SG", "ms", "id", "zh"] },
        localized_variants: { type: "object", additionalProperties: { type: "string" } },
        adapter_available: { type: "boolean", default: false },
      },
    },
    outputSchema: RESULT_SCHEMA,
  }, readOnlyAnnotations),
  withDefaults({
    name: toolNames.smeCareAgentStatus,
    description: "Use this when a local MCP host needs one zero-token, read-only SME care-agent capability, cost, gate, or circuit-breaker view without creating a status datastore.",
    inputSchema: { type: "object", additionalProperties: false, required: ["view"], properties: { view: { type: "string", enum: ["capabilities", "cost_summary", "gate_catalog", "circuit_breakers"] } } },
    outputSchema: RESULT_SCHEMA,
  }, readOnlyAnnotations),
];
