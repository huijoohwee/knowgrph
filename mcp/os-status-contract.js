export const OS_STATUS_TOOL_NAME = "knowgrph.os.status";

export const OS_STATUS_INPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["view"],
  properties: {
    view: {
      type: "string",
      enum: ["process_list", "capabilities"],
      description: "Read-only Agentic OS view to return.",
    },
    cloudflareMcpUrl: {
      type: "string",
      description: "Optional Cloudflare McpAgent endpoint for tools/list discovery. Unset is reported as unreachable, not fatal.",
    },
  },
});

export const OS_STATUS_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: true,
  required: ["ok"],
  properties: {
    ok: { type: "boolean" },
    view: { type: "string" },
    entries: { type: "array", items: { type: "object", additionalProperties: true } },
    truncated: { type: "boolean" },
    unavailableSources: { type: "array", items: { type: "object", additionalProperties: true } },
    unreachableCatalogs: { type: "array", items: { type: "string" } },
    cost_log: { type: "object", additionalProperties: true },
    errorCode: { type: "string" },
    message: { type: "string" },
  },
});

export const buildOsStatusToolDefinition = () => ({
  name: OS_STATUS_TOOL_NAME,
  description:
    "Use this when a local MCP host needs a zero-token Agentic OS read view over existing harness process state or capability catalogs without creating a second store.",
  outputSchema: OS_STATUS_OUTPUT_SCHEMA,
  inputSchema: OS_STATUS_INPUT_SCHEMA,
});
