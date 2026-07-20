import { KNOWGRPH_LOCAL_MCP_TOOL_NAMES } from "../canvas/src/features/agent-ready/knowgrphLocalMcpToolNames.mjs";

export const ECS_EXECUTION_BOUNDARY = "dev-only";
export const ECS_SCOPE = "#agentic-ecs";
export const ECS_SOURCE_BINDING = "@source.frontmatter";
export const ECS_SESSION_BINDING = "@ecs-session";

export const ECS_INVOCATION_GRAMMAR = Object.freeze({
  [KNOWGRPH_LOCAL_MCP_TOOL_NAMES.ecsSessionStart]: "/ecs.session-start #agentic-ecs @source.frontmatter",
  [KNOWGRPH_LOCAL_MCP_TOOL_NAMES.ecsWorldTick]: "/ecs.world-tick #agentic-ecs @ecs-session",
  [KNOWGRPH_LOCAL_MCP_TOOL_NAMES.ecsDecisionPersist]: "/ecs.decision-persist #agentic-ecs @ecs-session",
});

export const ECS_TOOL_NAMES = Object.freeze(Object.keys(ECS_INVOCATION_GRAMMAR));
const ECS_TOOL_NAME_SET = new Set(ECS_TOOL_NAMES);

export const isEcsToolName = (toolName) => ECS_TOOL_NAME_SET.has(toolName);

const executionBoundaryProperty = Object.freeze({
  type: "string",
  const: ECS_EXECUTION_BOUNDARY,
});

export const ECS_TOOL_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: true,
  required: ["ok", "execution_boundary"],
  properties: {
    ok: { type: "boolean" },
    execution_boundary: executionBoundaryProperty,
    errorCode: { type: "string" },
    message: { type: "string" },
  },
});

const scopeProperty = Object.freeze({ type: "string", enum: [ECS_SCOPE] });
const sourceBindingProperty = Object.freeze({ type: "string", enum: [ECS_SOURCE_BINDING] });
const sessionBindingProperty = Object.freeze({ type: "string", enum: [ECS_SESSION_BINDING] });

const ECS_TOOL_DEFINITIONS = Object.freeze([
  {
    name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.ecsSessionStart,
    title: "Start Agentic ECS session",
    description: `Hydrate one existing repository KGC Markdown document into an ephemeral ECS session. Invocation: ${ECS_INVOCATION_GRAMMAR[KNOWGRPH_LOCAL_MCP_TOOL_NAMES.ecsSessionStart]}`,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["kgcPath"],
      properties: {
        kgcPath: { type: "string", minLength: 1 },
        scope: scopeProperty,
        binding: sourceBindingProperty,
      },
    },
    outputSchema: ECS_TOOL_OUTPUT_SCHEMA,
  },
  {
    name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.ecsWorldTick,
    title: "Advance Agentic ECS world",
    description: `Advance one ephemeral ECS World and retain only completed Decisions for terminal persistence. Invocation: ${ECS_INVOCATION_GRAMMAR[KNOWGRPH_LOCAL_MCP_TOOL_NAMES.ecsWorldTick]}`,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["sessionId"],
      properties: {
        sessionId: { type: "string", minLength: 1 },
        input: { type: "object", additionalProperties: true },
        scope: scopeProperty,
        binding: sessionBindingProperty,
      },
    },
    outputSchema: ECS_TOOL_OUTPUT_SCHEMA,
  },
  {
    name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.ecsDecisionPersist,
    title: "Persist Agentic ECS Decisions",
    description: `Persist only completed Decisions retained by the referenced ECS session, then close it. Invocation: ${ECS_INVOCATION_GRAMMAR[KNOWGRPH_LOCAL_MCP_TOOL_NAMES.ecsDecisionPersist]}`,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["sessionId"],
      properties: {
        sessionId: { type: "string", minLength: 1 },
        scope: scopeProperty,
        binding: sessionBindingProperty,
      },
    },
    outputSchema: ECS_TOOL_OUTPUT_SCHEMA,
  },
]);

export function buildEcsLocalToolDefinitions({ withDefaults = (tool) => tool, annotations } = {}) {
  return ECS_TOOL_DEFINITIONS.map((tool) => withDefaults(tool, annotations));
}
