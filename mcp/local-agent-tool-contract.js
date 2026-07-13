import {
  AGENT_RUN_OUTPUT_SCHEMA,
  listAgentDefinitions,
} from "../contracts/agent-runtime.schema.js";

export function buildLocalAgentRuntimeToolDefinition(toolName) {
  const definitions = listAgentDefinitions();
  return {
    name: toolName,
    description:
      "Run one registered Knowgrph agent through the shared SuperAgent kernel. Agent identity, capabilities, policy, roles, and plan are resolved from the canonical agent-definition registry.",
    outputSchema: AGENT_RUN_OUTPUT_SCHEMA,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      anyOf: [
        { required: ["agentDefinitionId"] },
        { required: ["invocation"] },
        {
          properties: { resume: { const: true } },
          required: ["resume", "outputDir"],
        },
      ],
      properties: {
        agentDefinitionId: {
          type: "string",
          enum: definitions.map((definition) => definition.id),
          description: "Canonical agent definition id.",
        },
        invocation: {
          type: "string",
          enum: definitions.map((definition) => definition.invocation),
          description: "Canonical slash invocation derived from the agent id.",
        },
        inputPath: {
          type: "string",
          description: "Path to a markdown/text brief. Required unless resuming.",
        },
        outputDir: {
          type: "string",
          description: "Directory for state, trace, report, and artifacts.",
        },
        goalPath: { type: "string", description: "Optional goal file path." },
        runId: { type: "string", description: "Optional stable run id." },
        providerMode: {
          type: "string",
          enum: ["byteplus-modelark", "mock"],
          default: "byteplus-modelark",
        },
        mode: {
          type: "string",
          enum: ["dry-run", "live"],
          default: "dry-run",
        },
        approvals: {
          type: "array",
          items: {
            oneOf: [
              { type: "string" },
              { type: "object", additionalProperties: true },
            ],
          },
        },
        resume: { type: "boolean", default: false },
        stopAfterStep: { type: "number" },
        failOnceTool: { type: "string" },
        allowExternalInput: { type: "boolean", default: false },
        timeoutMs: { type: "number" },
      },
    },
  };
}
