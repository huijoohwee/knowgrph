import { BROWSER_API_TOOL } from "./browser-api-runtime.js";

export const KNOWGRPH_LOCAL_MCP_TOOL_NAMES = Object.freeze({
  uiLaunch: "knowgrph.ui.launch",
  uiStop: "knowgrph.ui.stop",
  pipeline: "knowgrph.pipeline",
  graphragPipeline: "knowgrph.graphrag_pipeline",
  superagentRun: "knowgrph.superagent.run",
  browserApiRun: "knowgrph.browser_api.run",
});

export const buildKnowgrphLocalMcpToolDefinitions = (args = {}) => {
  const defaultUiHost = String(args.defaultUiHost || "127.0.0.1").trim() || "127.0.0.1";
  const defaultUiPort = Number(args.defaultUiPort || 5173);

  return [
    {
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.uiLaunch,
      description:
        "Launch the Knowgrph Canvas UI (Vite dev server) and return a URL pre-configured for Canvas / Workspace Editor / Geospatial mode.",
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
    },
    {
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.uiStop,
      description: "Stop the running Knowgrph Canvas dev server (if started by knowgrph.ui.launch).",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    },
    {
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.pipeline,
      description:
        "Run the Knowgrph pipeline (GraphData -> A0 CSV/JSON-LD + codebase index artifacts).",
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
    },
    {
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.graphragPipeline,
      description:
        "Run the GraphRAG pipeline wrapper (attempts `graphrag index`, then emits GraphData + A0 exports).",
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
    },
    {
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.superagentRun,
      description:
        "Run the Codex-compatible super-agent harness for rich media canvas generation with deterministic mock media providers.",
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
    },
    BROWSER_API_TOOL,
  ];
};
