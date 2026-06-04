import { BROWSER_API_TOOL } from "./browser-api-runtime.js";
import {
  KNOWGRPH_AGENT_READY_DEFAULT_WORKSPACE_ID,
  KNOWGRPH_AGENT_READY_TOOL_IDS,
  buildKnowgrphAgentReadyToolContracts,
} from "../canvas/src/features/agent-ready/knowgrphAgentReadyToolContract.mjs";
import { KNOWGRPH_LOCAL_MCP_TOOL_NAMES as SHARED_KNOWGRPH_LOCAL_MCP_TOOL_NAMES } from "../canvas/src/features/agent-ready/knowgrphVdeoxplnContract.mjs";
import {
  buildKnowgrphMcpAppsToolMeta,
  buildKnowgrphMcpNoauthSecuritySchemes,
} from "../canvas/src/features/agent-ready/mcpAppsReadyContract.mjs";

export const KNOWGRPH_LOCAL_MCP_TOOL_NAMES = SHARED_KNOWGRPH_LOCAL_MCP_TOOL_NAMES;

const VDEOXPLN_LIST_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: true,
  required: ["contractVersion", "validation", "vdeoxplnEntries", "routingPlan"],
  properties: {
    contractVersion: { type: "string" },
    validation: { type: "object", additionalProperties: true },
    vdeoxplnEntries: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
    routingPlan: { type: "object", additionalProperties: true },
  },
});

const PUBLISHED_SOURCE_TOOL_CONTRACTS = buildKnowgrphAgentReadyToolContracts({
  defaultWorkspaceId: KNOWGRPH_AGENT_READY_DEFAULT_WORKSPACE_ID,
}).filter((tool) =>
  [
    KNOWGRPH_AGENT_READY_TOOL_IDS.search,
    KNOWGRPH_AGENT_READY_TOOL_IDS.fetch,
  ].includes(tool.name)
);

const READ_ONLY_TOOL_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: true,
});

const LOCAL_PROCESS_TOOL_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: false,
});

const LOCAL_IDEMPOTENT_PROCESS_TOOL_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: true,
});

const BROWSER_API_TOOL_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: true,
  idempotentHint: false,
});

const cloneAnnotations = (annotations) => ({ ...(annotations || READ_ONLY_TOOL_ANNOTATIONS) });
const withLocalMcpDescriptorDefaults = (tool, annotations = READ_ONLY_TOOL_ANNOTATIONS) => ({
  ...tool,
  securitySchemes: Array.isArray(tool.securitySchemes) && tool.securitySchemes.length
    ? tool.securitySchemes
    : buildKnowgrphMcpNoauthSecuritySchemes(),
  annotations: tool.annotations && typeof tool.annotations === "object"
    ? { ...tool.annotations }
    : cloneAnnotations(annotations),
});

const buildLocalPublishedSourceToolDefinition = (toolName) => {
  const tool = PUBLISHED_SOURCE_TOOL_CONTRACTS.find((entry) => entry.name === toolName);
  if (!tool) {
    throw new Error(`Missing shared published Source Files tool contract: ${toolName}`);
  }
  return withLocalMcpDescriptorDefaults({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    securitySchemes: tool.securitySchemes,
    annotations: tool.annotations,
  });
};

export const buildKnowgrphLocalMcpToolDefinitions = (args = {}) => {
  const defaultUiHost = String(args.defaultUiHost || "127.0.0.1").trim() || "127.0.0.1";
  const defaultUiPort = Number(args.defaultUiPort || 5173);

  return [
    buildLocalPublishedSourceToolDefinition(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.search),
    buildLocalPublishedSourceToolDefinition(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.fetch),
    withLocalMcpDescriptorDefaults({
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.uiLaunch,
      description:
        "Use this when a local MCP host needs to launch the Knowgrph Canvas UI (Vite dev server) and return a URL pre-configured for Canvas / Workspace Editor / Geospatial mode.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          target: {
            type: "string",
            enum: ["canvas", "workspaceEditor", "geospatial"],
            default: "canvas",
            description: "Which UI experience to open.",
          },
          host: {
            type: "string",
            description: `Host to bind and open. Default: ${defaultUiHost} (or KNOWGRPH_UI_HOST).`,
          },
          port: {
            type: "number",
            description: `Port for the dev server. Default: ${String(defaultUiPort)} (or KNOWGRPH_UI_PORT).`,
          },
          waitForReady: {
            type: "boolean",
            description: "If true, waits briefly for the port to accept TCP connections before returning.",
            default: true,
          },
        },
      },
    }, LOCAL_PROCESS_TOOL_ANNOTATIONS),
    withLocalMcpDescriptorDefaults({
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.uiStop,
      description: "Use this when a local MCP host needs to stop the running Knowgrph Canvas dev server if it was started by knowgrph.ui.launch.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    }, LOCAL_IDEMPOTENT_PROCESS_TOOL_ANNOTATIONS),
    withLocalMcpDescriptorDefaults({
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.pipeline,
      description:
        "Use this when a local MCP host needs to run the Knowgrph pipeline (GraphData -> A0 CSV/JSON-LD + codebase index artifacts).",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          mode: {
            type: "string",
            enum: ["pipeline"],
            default: "pipeline",
            description: "Which pipeline mode to run.",
          },
          inputPath: {
            type: "string",
            description: "Path to an input GraphData JSON file (required when mode=pipeline).",
          },
          outputDir: {
            type: "string",
            description:
              "Directory for outputs. If omitted, defaults to knowgrph_parser's configured output directory.",
          },
          timeoutMs: {
            type: "number",
            description: "Optional timeout in milliseconds.",
          },
        },
      },
    }, LOCAL_PROCESS_TOOL_ANNOTATIONS),
    withLocalMcpDescriptorDefaults({
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.graphragPipeline,
      description:
        "Use this when a local MCP host needs to run the GraphRAG pipeline wrapper (attempts `graphrag index`, then emits GraphData + A0 exports).",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          configPath: { type: "string", description: "GraphRAG config YAML path." },
          inputDir: { type: "string", description: "Input directory containing raw docs." },
          outDir: { type: "string", description: "Output directory." },
          graphId: { type: "string", description: "Graph identifier used in emitted workflow doc." },
          timeoutMs: { type: "number", description: "Optional timeout in milliseconds." },
        },
      },
    }, LOCAL_PROCESS_TOOL_ANNOTATIONS),
    withLocalMcpDescriptorDefaults({
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.superagentRun,
      description:
        "Use this when a local MCP host needs to run the Codex-compatible long-horizon SuperAgent harness for research, code, and create tasks across quick_triage, bounded_compile, deep_research, and parallel_build levels with native memory, skill selection, sandbox artifacts, subagent contracts, and provider-neutral media outputs.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          inputPath: {
            type: "string",
            description: "Path to a markdown/text brief. Required unless resume=true.",
          },
          outputDir: {
            type: "string",
            description: "Directory for state, trace, report, and artifacts. Defaults to data/outputs/superagent-mcp-run-<timestamp>.",
          },
          goalPath: {
            type: "string",
            description: "Optional goal file path. Defaults to KNOWGRPH_ROOT/goal.",
          },
          runId: {
            type: "string",
            description: "Optional stable run id.",
          },
          providerMode: {
            type: "string",
            enum: ["mock", "pixverse"],
            default: "mock",
            description: "Optional media provider mode. mock is deterministic; pixverse uses local PixVerse MCP with mock fallback.",
          },
          resume: {
            type: "boolean",
            default: false,
            description: "Resume from outputDir/state.json.",
          },
          stopAfterStep: {
            type: "number",
            description: "Optional checkpoint after N completed tasks.",
          },
          failOnceTool: {
            type: "string",
            description: "Optional tool name to fail once for recovery testing, e.g. video.generate.mock.",
          },
          allowExternalInput: {
            type: "boolean",
            default: false,
            description: "Allow inputPath outside KNOWGRPH_ROOT for explicit E2E runs.",
          },
          timeoutMs: {
            type: "number",
            description: "Optional timeout in milliseconds.",
          },
        },
      },
    }, LOCAL_PROCESS_TOOL_ANNOTATIONS),
    withLocalMcpDescriptorDefaults(BROWSER_API_TOOL, BROWSER_API_TOOL_ANNOTATIONS),
    withLocalMcpDescriptorDefaults({
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.vdeoxplnList,
      description:
        "Use this when a local MCP host needs to list the canonical Knowgrph vdeoxpln registry with semantic keys, source owners, tool projections, and optional generated skill markdown.",
      securitySchemes: buildKnowgrphMcpNoauthSecuritySchemes(),
      _meta: buildKnowgrphMcpAppsToolMeta(),
      outputSchema: VDEOXPLN_LIST_OUTPUT_SCHEMA,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          includeMarkdown: {
            type: "boolean",
            default: false,
            description: "If true, include generated SKILL.md-style markdown for each vdeoxpln.",
          },
          vdeoxplnId: {
            type: "string",
            description: "Optional vdeoxpln id filter, e.g. knowgrph-source-files.",
          },
          intentText: {
            type: "string",
            description: "Optional neutral user intent to route against the canonical vdeoxpln registry. Route names and file paths are ignored.",
          },
          contentTypes: {
            type: "array",
            items: { type: "string" },
            description: "Optional neutral content types, such as kgc markdown, source evidence, workspace document, or media metadata.",
          },
          requestedOutputs: {
            type: "array",
            items: { type: "string" },
            description: "Optional artifact families requested by the user, such as workspace artifact, GraphData, report, or canvas topology snapshot.",
          },
          stateSignals: {
            type: "array",
            items: { type: "string" },
            description: "Optional current-state signals from the host workspace; do not pass absolute paths or route-only labels.",
          },
          chatStorageTarget: {
            type: "string",
            enum: ["chatHistory", "chatKnowgrph"],
            description: "Optional chat storage target used as a state signal for chat-backed vdeoxpln planning.",
          },
          sourceFileCount: {
            type: "number",
            description: "Optional count of active source files in the current workspace.",
          },
          hasGraphData: {
            type: "boolean",
            description: "Optional current-state signal indicating the host has graph topology available.",
          },
          hasSelection: {
            type: "boolean",
            description: "Optional current-state signal indicating there is a current canvas or document selection.",
          },
          hasWorkspaceDocument: {
            type: "boolean",
            description: "Optional current-state signal indicating there is an active workspace document.",
          },
        },
      },
    }, READ_ONLY_TOOL_ANNOTATIONS),
  ];
};
