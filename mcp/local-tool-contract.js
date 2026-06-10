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

const AGENTIC_CANVAS_OS_PLAN_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: true,
  required: ["contractVersion", "runId", "mode", "goal", "consumerRepo", "dashboard", "validation"],
  properties: {
    contractVersion: { type: "string" },
    runId: { type: "string" },
    mode: { type: "string" },
    goal: { type: "string" },
    consumerRepo: { type: "object", additionalProperties: true },
    dashboard: { type: "object", additionalProperties: true },
    validation: { type: "object", additionalProperties: true },
  },
});

const VIDEO_REMIX_RUN_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: true,
  required: ["contractVersion", "runId", "state", "mode", "approvalGates", "evidencePack", "storyboard", "budgetMeters", "validation"],
  properties: {
    contractVersion: { type: "string" },
    runId: { type: "string" },
    state: { type: "string" },
    mode: { type: "string" },
    approvalGates: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
    evidencePack: { type: "object", additionalProperties: true },
    storyboard: { type: "object", additionalProperties: true },
    budgetMeters: { type: "object", additionalProperties: true },
    validation: { type: "object", additionalProperties: true },
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
    withLocalMcpDescriptorDefaults({
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.agenticCanvasOsPlan,
      description:
        "Use this when a local MCP host needs to produce a dry-run Agentic Canvas OS dashboard and run manifest for a goal, repo profile, approval-gated build plan, token/TCO budget, and optional secured starter-repo blueprint.",
      outputSchema: AGENTIC_CANVAS_OS_PLAN_OUTPUT_SCHEMA,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["goal"],
        properties: {
          goal: {
            type: "string",
            description: "Product or agent-build goal to turn into an Agentic Canvas OS dashboard plan.",
          },
          consumerRepo: {
            type: "string",
            description: "Human-readable consumer repo name. Defaults to the consumerRepoPath basename.",
          },
          consumerRepoPath: {
            type: "string",
            description: "Repo path to profile. Relative paths resolve under KNOWGRPH_ROOT; external sibling repos require allowExternalRepo=true.",
          },
          allowExternalRepo: {
            type: "boolean",
            default: false,
            description: "Allow read-only profiling of a sibling repo outside KNOWGRPH_ROOT.",
          },
          runId: {
            type: "string",
            description: "Optional stable run id used for output artifact paths.",
          },
          outputDir: {
            type: "string",
            description: "Optional output directory inside KNOWGRPH_ROOT. Defaults to data/outputs/agentic-canvas-os/<runId>.",
          },
          lanes: {
            type: "array",
            items: { type: "string" },
            description: "Optional lanes such as adapter_readiness, market_radar, browser_evidence, market_to_artifact, learning_loop, starter_repo, demo_pack, or failure_handling.",
          },
          includeStarterRepo: {
            type: "boolean",
            default: true,
            description: "If true, include the secured React frontend plus AI-agent backend starter blueprint lane.",
          },
          writeArtifacts: {
            type: "boolean",
            default: false,
            description: "If true, writes dashboard.agentic-os.md and run-manifest.json under outputDir only.",
          },
          frontendFramework: {
            type: "string",
            default: "react",
            description: "Frontend framework label for the starter blueprint.",
          },
          agentBackend: {
            type: "string",
            default: "agent-platform-backend",
            description: "Backend adapter label for the starter blueprint.",
          },
          deploymentTarget: {
            type: "string",
            default: "dry-run",
            description: "Deployment target label for the dry-run blueprint.",
          },
          iac: {
            type: "string",
            enum: ["none", "cdk", "terraform"],
            default: "none",
            description: "Single infrastructure-as-code path to plan. Defaults to none until approved.",
          },
          marketQuestion: {
            type: "string",
            description: "Optional market question or product idea for the Market Radar lane. Defaults to goal.",
          },
          platforms: {
            type: "array",
            items: { type: "string" },
            description: "Scoped market evidence platforms to plan for, such as x, reddit, producthunt, linkedin, xiaohongshu, tiktok, facebook, or instagram.",
          },
          sourceCards: {
            type: "array",
            items: { type: "object", additionalProperties: true },
            description: "Optional already-captured source cards with url, platform, evidenceLevel, observedFields, and claimIds.",
          },
          allowedDomains: {
            type: "array",
            items: { type: "string" },
            description: "Browser-evidence domain allowlist. Authenticated capture still requires confirmBrowserScope=true.",
          },
          confirmBrowserScope: {
            type: "boolean",
            default: false,
            description: "If true with allowedDomains, marks local browser evidence scope approved for dry-run planning only.",
          },
          artifactKinds: {
            type: "array",
            items: { type: "string" },
            description: "Artifact kinds for market-to-artifact planning, such as text, image, audio, video, deck, landing_page, or demo_pack.",
          },
          finalizedTraceIds: {
            type: "array",
            items: { type: "string" },
            description: "Finalized run/chat trace ids allowed as Learning Loop inputs. Drafts and aborted turns are excluded.",
          },
          userNotes: {
            type: "array",
            items: { type: "string" },
            description: "Explicit user notes that may become approval-gated identity facets.",
          },
          failOnceTool: {
            type: "string",
            description: "Optional tool name for dry-run failure-handling injection.",
          },
          maxIterations: { type: "number", description: "Agent loop iteration budget. Default: 8." },
          tokenBudget: { type: "number", description: "Evidence/planning token budget. Default: 8000." },
          tcoBudgetUsd: { type: "number", description: "Default fixed monthly TCO budget before live adapters. Default: 0." },
        },
      },
    }, LOCAL_IDEMPOTENT_PROCESS_TOOL_ANNOTATIONS),
    withLocalMcpDescriptorDefaults({
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.videoRemixRun,
      description:
        "Use this when a local MCP host needs to produce an approval-gated video-remix run manifest from a reference URL, brief, source cards, storyboard plan, render/checkout gates, token/TCO budget, and failure evidence before any paid provider call.",
      outputSchema: VIDEO_REMIX_RUN_OUTPUT_SCHEMA,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["referenceUrl", "brief"],
        properties: {
          referenceUrl: {
            type: "string",
            description: "Absolute reference video URL supplied by the creator user.",
          },
          brief: {
            type: "string",
            description: "Creative intent for the remix run.",
          },
          mode: {
            type: "string",
            enum: ["dry-run", "live"],
            default: "dry-run",
            description: "Run mode. live still blocks before spend unless matching approval tokens are supplied.",
          },
          approvals: {
            type: "array",
            items: {
              oneOf: [
                { type: "string" },
                { type: "object", additionalProperties: true },
              ],
            },
            description: "Approval gate ids or token objects. Missing gates keep paid/render/payment/deploy actions blocked.",
          },
          sourceCards: {
            type: "array",
            items: { type: "object", additionalProperties: true },
            description: "Already-captured source cards with sourceId, url, platform, title, evidenceLevel, and observedFields; the local runtime never fabricates live Exa results.",
          },
          budgetUsd: {
            type: "number",
            default: 0,
            description: "Run budget cap used for local budget-meter accounting.",
          },
          shotCount: {
            type: "number",
            default: 4,
            description: "Number of storyboard shots to plan, bounded by the runtime.",
          },
          runId: {
            type: "string",
            description: "Optional stable run id.",
          },
          failOnceTool: {
            type: "string",
            description: "Optional tool name for bounded failure-handling injection.",
          },
          maxIterations: {
            type: "number",
            description: "Agent loop iteration budget. Default: 8.",
          },
          frontendUrl: {
            type: "string",
            description: "Optional Vercel frontend URL to record in the demo pack after all live gates are approved.",
          },
          backendHealthUrl: {
            type: "string",
            description: "Optional AWS backend health URL to record in the demo pack after all live gates are approved.",
          },
        },
      },
    }, LOCAL_IDEMPOTENT_PROCESS_TOOL_ANNOTATIONS),
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
