import {
  KNOWGRPH_AGENT_READY_DEFAULT_WORKSPACE_ID,
  buildKnowgrphAgentReadyToolContracts,
  KNOWGRPH_AGENT_READY_TOOL_IDS,
} from "./knowgrphAgentReadyToolContract.mjs";
import { hashSignatureParts } from "../../../../grph-shared/dist/hash/signature.js";

export const KNOWGRPH_VDEOXPLN_CONTRACT_VERSION = "knowgrph-vdeoxpln/v0.1";

export const KNOWGRPH_LOCAL_MCP_TOOL_NAMES = Object.freeze({
  search: KNOWGRPH_AGENT_READY_TOOL_IDS.search,
  fetch: KNOWGRPH_AGENT_READY_TOOL_IDS.fetch,
  uiLaunch: "knowgrph.ui.launch",
  uiStop: "knowgrph.ui.stop",
  pipeline: "knowgrph.pipeline",
  graphragPipeline: "knowgrph.graphrag_pipeline",
  superagentRun: "knowgrph.superagent.run",
  browserApiRun: "knowgrph.browser_api.run",
  vdeoxplnList: "knowgrph.vdeoxpln.list",
});

export const KNOWGRPH_VDEOXPLN_IDS = Object.freeze({
  sourceFiles: "knowgrph-source-files",
  agentReady: "knowgrph-agent-ready",
  localMcp: "knowgrph-mcp-local",
  chatToCanvas: "knowgrph-chat-to-canvas",
  strybldr: "knowgrph-strybldr",
  researchVisual: "knowgrph-research-visual",
  commerceReadiness: "knowgrph-commerce-readiness",
});

const normalizeString = (value) => String(value || "").trim();

const normalizeStringArray = (values) =>
  Array.from(new Set((Array.isArray(values) ? values : [])
    .map(normalizeString)
    .filter(Boolean)))
    .sort((left, right) => left.localeCompare(right));

const normalizeOrderedStringArray = (values) => {
  const seen = new Set();
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalizeString(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
};

const normalizeJsonValue = (value) => {
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort((left, right) => left.localeCompare(right)).reduce((acc, key) => {
    acc[key] = normalizeJsonValue(value[key]);
    return acc;
  }, {});
};

export const stableStringifyVdeoxplnValue = (value) => JSON.stringify(normalizeJsonValue(value));

export const buildKnowgrphVdeoxplnSemanticKey = (scope, parts) => {
  const normalizedScope = normalizeString(scope) || "vdeoxpln";
  return `kgvx_${hashSignatureParts([
    normalizedScope,
    KNOWGRPH_VDEOXPLN_CONTRACT_VERSION,
    stableStringifyVdeoxplnValue(parts),
  ])}`;
};

const buildPublishedToolNames = () =>
  buildKnowgrphAgentReadyToolContracts({ defaultWorkspaceId: KNOWGRPH_AGENT_READY_DEFAULT_WORKSPACE_ID })
    .map((tool) => tool.name);

const buildBrowserToolNames = () =>
  buildKnowgrphAgentReadyToolContracts({
    defaultWorkspaceId: KNOWGRPH_AGENT_READY_DEFAULT_WORKSPACE_ID,
    includeBrowserOnlyTools: true,
  }).map((tool) => tool.name);

const RAW_VDEOXPLN = Object.freeze([
  {
    id: KNOWGRPH_VDEOXPLN_IDS.sourceFiles,
    title: "Knowgrph Source Files",
    purpose: "Discover, read, inspect, and route published Source Files and shared documents through the canonical storage and document-structure owners.",
    scope: "read-only-published",
    mutation: "read-only",
    triggers: ["source files", "published documents", "shared document", "read markdown", "inspect document structure"],
    inputs: ["workspace document", "published markdown", "share token", "share URL", "canonical path"],
    outputs: ["source-files index", "published markdown", "document structure report"],
    owners: [
      "canvas/src/features/workspace-fs/workspaceFs.ts",
      "canvas/src/features/source-files/sourceFilesSignatures.ts",
      "canvas/src/features/agent-ready/publishedToolExecutors.mjs",
      "canvas/src/features/agent-ready/sharedDocumentStructureInspection.mjs",
      "cloudflare/pages/knowgrph-agent-ready.mjs",
    ],
    tools: {
      published: [
        KNOWGRPH_AGENT_READY_TOOL_IDS.listSourceFiles,
        KNOWGRPH_AGENT_READY_TOOL_IDS.readSourceFile,
        KNOWGRPH_AGENT_READY_TOOL_IDS.readSharedDocument,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectSharedDocumentStructure,
      ],
      browserLocal: [KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalSourceFilesSnapshot],
      local: [
        KNOWGRPH_LOCAL_MCP_TOOL_NAMES.search,
        KNOWGRPH_LOCAL_MCP_TOOL_NAMES.fetch,
        KNOWGRPH_LOCAL_MCP_TOOL_NAMES.vdeoxplnList,
      ],
    },
    workflow: [
      "Resolve source identity from storage, share token, or canonical path.",
      "Fetch through published storage/document executors.",
      "Inspect structure with the shared document-structure owner.",
      "Return read-only artifacts without graph mutation.",
    ],
    aiPolicy: {
      mode: "none",
      maxAttempts: 0,
      tokenBudget: 0,
      fallback: "Return source-read or structure errors without model calls.",
    },
    artifactPolicy: {
      persistence: "published-read-only",
      graphMaterialization: "none",
      semanticKeyInputs: ["workspaceId", "canonicalPath", "shareToken", "toolContract"],
    },
    validation: ["agent-ready:check", "pages:check-sync", "vdeoxpln:check"],
    publish: ["pages-agent-skills", "http-mcp", "webmcp-html-fallback"],
  },
  {
    id: KNOWGRPH_VDEOXPLN_IDS.agentReady,
    title: "Knowgrph Agent Ready",
    purpose: "Inspect Knowgrph health, MCP, WebMCP, A2A, OpenAPI, commerce, and browser-local readiness without claiming deployed mutation.",
    scope: "read-only-published-and-browser-local",
    mutation: "read-only",
    triggers: ["agent-ready", "webmcp", "mcp health", "openapi", "a2a", "discovery", "readiness"],
    inputs: ["agent-ready base URL", "browser runtime state", "published metadata"],
    outputs: ["agent surface inspection", "browser-local readiness snapshot", "metadata report"],
    owners: [
      "canvas/src/features/agent-ready/knowgrphAgentReadyToolContract.mjs",
      "canvas/src/features/agent-ready/webMcpRuntime.ts",
      "canvas/src/features/agent-ready/agentSurfaceInspection.mjs",
      "cloudflare/pages/knowgrph-agent-ready.mjs",
      "scripts/check-agent-ready.mjs",
    ],
    tools: {
      published: [KNOWGRPH_AGENT_READY_TOOL_IDS.inspectAgentSurface],
      browserLocal: [
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalSettingsChatReadiness,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalMainPanelState,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalEditorWorkspaceState,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalChatPipelineState,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalMainPanelChatCanvasPipeline,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalWorkspaceDocument,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalCanvasTopology,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalCanvasSnapshot,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocal3dCameraPose,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocal3dLayoutPositions,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocal2dZoomViewport,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalSourceFilesSnapshot,
      ],
      local: [KNOWGRPH_LOCAL_MCP_TOOL_NAMES.vdeoxplnList],
    },
    workflow: [
      "Inspect published agent-ready metadata.",
      "Inspect browser-local state only when running inside the app runtime.",
      "Report scope boundaries between Pages read-only tools and browser-local inspectors.",
    ],
    aiPolicy: {
      mode: "none",
      maxAttempts: 0,
      tokenBudget: 0,
      fallback: "Return metadata inspection errors directly.",
    },
    artifactPolicy: {
      persistence: "inspection-only",
      graphMaterialization: "none",
      semanticKeyInputs: ["toolContracts", "metadataRoutes", "browserLocalToolNames"],
    },
    validation: ["agent-ready:check", "vdeoxpln:check"],
    publish: ["pages-agent-skills", "http-mcp", "browser-webmcp"],
  },
  {
    id: KNOWGRPH_VDEOXPLN_IDS.localMcp,
    title: "Knowgrph Local MCP",
    purpose: "Expose local UI launch, pipeline, GraphRAG, superagent, browser bridge, and vdeoxpln inspection tools through the stdio MCP server.",
    scope: "local-stdio",
    mutation: "local-confirmed",
    triggers: ["local mcp", "launch canvas", "run pipeline", "graphrag", "superagent", "browser api", "list vdeoxpln"],
    inputs: ["local root", "workspace file", "graph data", "pipeline config", "browser API runtime"],
    outputs: ["local tool result", "pipeline artifact", "superagent report", "vdeoxpln registry snapshot"],
    owners: [
      "mcp/local-tool-contract.js",
      "mcp/server.js",
      "mcp/README.md",
      "knowgrph_parser/superagent_harness.py",
      "canvas/src/features/agent-ready/knowgrphVdeoxplnContract.mjs",
    ],
    tools: {
      published: [],
      browserLocal: [],
      local: [
        KNOWGRPH_LOCAL_MCP_TOOL_NAMES.search,
        KNOWGRPH_LOCAL_MCP_TOOL_NAMES.fetch,
        KNOWGRPH_LOCAL_MCP_TOOL_NAMES.uiLaunch,
        KNOWGRPH_LOCAL_MCP_TOOL_NAMES.uiStop,
        KNOWGRPH_LOCAL_MCP_TOOL_NAMES.pipeline,
        KNOWGRPH_LOCAL_MCP_TOOL_NAMES.graphragPipeline,
        KNOWGRPH_LOCAL_MCP_TOOL_NAMES.superagentRun,
        KNOWGRPH_LOCAL_MCP_TOOL_NAMES.browserApiRun,
        KNOWGRPH_LOCAL_MCP_TOOL_NAMES.vdeoxplnList,
      ],
    },
    workflow: [
      "List local tools from the shared local MCP contract.",
      "Run only path-guarded local-root operations.",
      "Summarize artifacts and registry metadata in the MCP result.",
    ],
    aiPolicy: {
      mode: "optional-via-local-tools",
      maxAttempts: 1,
      tokenBudget: "tool-owned",
      fallback: "Return local command failure and detected artifacts.",
    },
    artifactPolicy: {
      persistence: "local-workspace",
      graphMaterialization: "tool-owned",
      semanticKeyInputs: ["localToolNames", "rootScope", "artifactList"],
    },
    validation: ["vdeoxpln:check", "mcpLocalToolContract"],
    publish: ["local-mcp-docs"],
  },
  {
    id: KNOWGRPH_VDEOXPLN_IDS.chatToCanvas,
    title: "Knowgrph Chat To Canvas",
    purpose: "Route AI-assisted graph generation through FloatingPanel Chat, KGC validation, Workspace FS, Source Files, and Canvas apply owners.",
    scope: "browser-local-ai-assisted",
    mutation: "browser-local-user-mediated",
    triggers: ["chat to canvas", "generate graph", "kgc markdown", "flow.subgraphs", "apply to canvas"],
    inputs: ["chat request", "workspace context", "selection context", "source evidence", "model settings"],
    outputs: ["validated KGC Markdown", "workspace artifact", "GraphData", "canvas topology snapshot"],
    owners: [
      "canvas/src/features/chat/floatingPanelChat/floatingPanelChatSubmitCoordinator.ts",
      "canvas/src/features/chat/floatingPanelChat/floatingPanelChatSubmitRequest.ts",
      "canvas/src/features/chat/chatMarkdownValidation.ts",
      "canvas/src/features/chat/chatKgcCanvasApply.ts",
      "canvas/src/features/workspace-fs/workspaceFs.ts",
      "canvas/src/features/source-files/applyComposedGraphFromSourceFiles.ts",
      "canvas/src/lib/graph/semanticKey.ts",
    ],
    tools: {
      published: [],
      browserLocal: [
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalChatPipelineState,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalMainPanelChatCanvasPipeline,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalWorkspaceDocument,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalCanvasTopology,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalCanvasSnapshot,
      ],
      local: [KNOWGRPH_LOCAL_MCP_TOOL_NAMES.vdeoxplnList],
    },
    workflow: [
      "Vdeoxpln context through the shared chat submit request owner.",
      "Call provider transport only after typed request construction.",
      "Validate KGC Markdown with bounded retries.",
      "Persist through Workspace FS and apply through the existing Canvas path.",
    ],
    aiPolicy: {
      mode: "required-for-generation",
      maxAttempts: 2,
      tokenBudget: "settings-owned",
      fallback: "Persist validation or provider failure as reviewable chat/workspace state.",
    },
    artifactPolicy: {
      persistence: "workspace-fs-and-source-files",
      graphMaterialization: "kgc-validation-to-canvas-apply",
      semanticKeyInputs: ["chatContextScope", "workspacePath", "graphSemanticKey", "sourceLayerHash"],
    },
    validation: ["chatResponseContract", "sourceFiles", "vdeoxpln:check"],
    publish: ["browser-webmcp", "mainpanel-mcp"],
  },
  {
    id: KNOWGRPH_VDEOXPLN_IDS.strybldr,
    title: "Knowgrph Strybldr",
    purpose: "Turn image or media source units into editable Storyboard cards and bounded media handoff artifacts through Strybldr and shared renderer owners.",
    scope: "browser-local-source-backed",
    mutation: "browser-local-user-mediated",
    triggers: ["strybldr", "storyboard", "image to storyboard", "media handoff", "visual brief"],
    inputs: ["image source unit", "media metadata", "workspace document", "storyboard graph"],
    outputs: ["Strybldr Markdown", "Storyboard graph cards", "media handoff prompt", "canvas snapshot"],
    owners: [
      "canvas/src/features/strybldr/strybldrStoryboard.ts",
      "canvas/src/features/strybldr",
      "canvas/src/features/workspace-fs/workspaceFs.ts",
      "canvas/src/features/source-files/applyComposedGraphFromSourceFiles.ts",
      "canvas/src/components/StoryboardCanvas/storyboardModel.ts",
      "canvas/src/lib/config.render.ts",
      "canvas/src/lib/graph/semanticKey.ts",
      "docs/documents/knowgrph-strybldr-prd-tad.md",
    ],
    tools: {
      published: [],
      browserLocal: [
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalSourceFilesSnapshot,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalCanvasTopology,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalCanvasSnapshot,
      ],
      local: [KNOWGRPH_LOCAL_MCP_TOOL_NAMES.vdeoxplnList],
    },
    workflow: [
      "Import media through existing workspace/source owners.",
      "Build Strybldr cards with source-unit provenance.",
      "Render through the shared Storyboard surface.",
      "Compile bounded media handoff only after user approval.",
    ],
    aiPolicy: {
      mode: "optional-for-refinement",
      maxAttempts: 1,
      tokenBudget: "user-approved-provider-step",
      fallback: "Keep editable storyboard and structured handoff error.",
    },
    artifactPolicy: {
      persistence: "workspace-fs-and-source-files",
      graphMaterialization: "storyboard-graph",
      semanticKeyInputs: ["sourceUnitId", "strybldrRunId", "graphSemanticKey"],
    },
    validation: ["strybldr", "rendererPipelineNeutrality", "vdeoxpln:check"],
    publish: ["mainpanel-mcp", "browser-webmcp"],
  },
  {
    id: KNOWGRPH_VDEOXPLN_IDS.researchVisual,
    title: "Knowgrph Research Visual",
    purpose: "Create file-backed research visual workflows from source material using Knowgrph parsing, Source Files, Storyboard, renderer, and chat owners.",
    scope: "browser-local-ai-assisted",
    mutation: "browser-local-user-mediated",
    triggers: ["research visual", "explainer", "formula", "algorithm", "proof", "dynamic scene", "storyboard"],
    inputs: ["paper excerpt", "formula", "algorithm", "figure", "workspace document", "source evidence"],
    outputs: ["mechanism brief", "storyboard", "renderer-neutral scene plan", "validated KGC Markdown"],
    owners: [
      "canvas/src/features/parsers/default.ts",
      "canvas/src/features/source-files/applyComposedGraphFromSourceFiles.ts",
      "canvas/src/features/chat/floatingPanelChat/floatingPanelChatSubmitCoordinator.ts",
      "canvas/src/components/StoryboardCanvas/storyboardModel.ts",
      "canvas/src/lib/config.render.ts",
      "canvas/src/lib/graph/semanticKey.ts",
      "docs/documents/knowgrph-vdeoxpln-prd-tad.md",
    ],
    tools: {
      published: [],
      browserLocal: [
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalChatPipelineState,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalSourceFilesSnapshot,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalCanvasTopology,
      ],
      local: [KNOWGRPH_LOCAL_MCP_TOOL_NAMES.vdeoxplnList],
    },
    workflow: [
      "Extract source-backed semantic units into workspace artifacts.",
      "Plan exact deterministic graph/storyboard layers before optional AI support.",
      "Persist artifacts through Workspace FS and Source Files.",
      "Use Canvas/Storyboard renderers as projections of graph state.",
    ],
    aiPolicy: {
      mode: "optional-for-drafting",
      maxAttempts: 2,
      tokenBudget: "settings-owned",
      fallback: "Return deterministic source brief with unresolved questions.",
    },
    artifactPolicy: {
      persistence: "workspace-fs-and-source-files",
      graphMaterialization: "kgc-validation-to-canvas-apply",
      semanticKeyInputs: ["sourceSignature", "graphSemanticKey", "rendererId"],
    },
    validation: ["sourceFiles", "chatResponseContract", "vdeoxpln:check"],
    publish: ["mainpanel-mcp", "browser-webmcp"],
  },
  {
    id: KNOWGRPH_VDEOXPLN_IDS.commerceReadiness,
    title: "Knowgrph Commerce Readiness",
    purpose: "Inspect Commerce, payment worker, x402, ACP, UCP, MPP, and readiness metadata without bypassing the shared payment SSOT.",
    scope: "read-only-published-and-browser-local",
    mutation: "read-only",
    triggers: ["commerce", "payment", "x402", "acp", "ucp", "mpp", "stripe", "readiness"],
    inputs: ["agent-ready metadata", "commerce route health", "browser readiness snapshot"],
    outputs: ["commerce readiness report", "payment route summary", "agent-ready commerce metadata"],
    owners: [
      "canvas/src/features/panels/views/CommerceHubView.tsx",
      "canvas/src/features/agent-ready/browserLocalSurfaceSnapshots.ts",
      "cloudflare/pages/knowgrph-agent-ready-commerce.mjs",
      "cloudflare/workers/knowgrph-payment/agenticCommerce.ts",
      "grph-shared/src/payments/agenticCommerceSsot.ts",
    ],
    tools: {
      published: [KNOWGRPH_AGENT_READY_TOOL_IDS.inspectAgentSurface],
      browserLocal: [
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalSettingsChatReadiness,
        KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalMainPanelState,
      ],
      local: [KNOWGRPH_LOCAL_MCP_TOOL_NAMES.vdeoxplnList],
    },
    workflow: [
      "Inspect published commerce discovery metadata.",
      "Read browser-local readiness snapshots when available.",
      "Report payment capability boundaries without initiating checkout.",
    ],
    aiPolicy: {
      mode: "none",
      maxAttempts: 0,
      tokenBudget: 0,
      fallback: "Return route or metadata errors directly.",
    },
    artifactPolicy: {
      persistence: "inspection-only",
      graphMaterialization: "none",
      semanticKeyInputs: ["commerceSemanticKey", "routeHealth", "toolContract"],
    },
    validation: ["agent-ready:check", "mainPanelCommerce", "vdeoxpln:check"],
    publish: ["pages-agent-skills", "mainpanel-mcp", "browser-webmcp"],
  },
]);

const normalizeVdeoxpln = (vdeoxpln) => {
  const normalizedTools = {
    published: normalizeStringArray(vdeoxpln.tools?.published),
    browserLocal: normalizeStringArray(vdeoxpln.tools?.browserLocal),
    local: normalizeStringArray(vdeoxpln.tools?.local),
  };
  const semanticKey = buildKnowgrphVdeoxplnSemanticKey(vdeoxpln.id, {
    id: vdeoxpln.id,
    scope: vdeoxpln.scope,
    mutation: vdeoxpln.mutation,
    owners: normalizeStringArray(vdeoxpln.owners),
    tools: normalizedTools,
    triggers: normalizeStringArray(vdeoxpln.triggers),
    outputs: normalizeStringArray(vdeoxpln.outputs),
    workflow: normalizeOrderedStringArray(vdeoxpln.workflow),
    artifactPolicy: vdeoxpln.artifactPolicy || {},
    aiPolicy: vdeoxpln.aiPolicy || {},
  });
  const path = `/.well-known/agent-skills/${vdeoxpln.id}.md`;
  return Object.freeze({
    ...vdeoxpln,
    version: KNOWGRPH_VDEOXPLN_CONTRACT_VERSION,
    triggers: normalizeStringArray(vdeoxpln.triggers),
    inputs: normalizeStringArray(vdeoxpln.inputs),
    outputs: normalizeStringArray(vdeoxpln.outputs),
    owners: normalizeStringArray(vdeoxpln.owners),
    tools: Object.freeze(normalizedTools),
    workflow: normalizeOrderedStringArray(vdeoxpln.workflow),
    validation: normalizeStringArray(vdeoxpln.validation),
    publish: normalizeStringArray(vdeoxpln.publish),
    semanticKey,
    agentSkill: Object.freeze({
      name: vdeoxpln.id,
      type: "markdown",
      description: vdeoxpln.purpose,
      path,
    }),
  });
};

export const buildKnowgrphVdeoxplnRegistry = () =>
  RAW_VDEOXPLN.map(normalizeVdeoxpln)
    .sort((left, right) => left.id.localeCompare(right.id));

export const buildKnowgrphVdeoxplnToolNameSets = () => ({
  published: new Set(buildPublishedToolNames()),
  browserLocal: new Set(buildBrowserToolNames()),
  local: new Set(Object.values(KNOWGRPH_LOCAL_MCP_TOOL_NAMES)),
});

export const validateKnowgrphVdeoxplnRegistry = (registry = buildKnowgrphVdeoxplnRegistry()) => {
  const errors = [];
  const ids = new Set();
  const toolSets = buildKnowgrphVdeoxplnToolNameSets();
  for (const vdeoxpln of registry) {
    if (!vdeoxpln.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(vdeoxpln.id)) {
      errors.push(`${vdeoxpln.id || "(missing)"}: invalid provider-neutral id`);
    }
    if (ids.has(vdeoxpln.id)) errors.push(`${vdeoxpln.id}: duplicate vdeoxpln id`);
    ids.add(vdeoxpln.id);
    if (Array.isArray(vdeoxpln.aliases) && vdeoxpln.aliases.length > 0) {
      errors.push(`${vdeoxpln.id}: compatibility aliases are forbidden`);
    }
    if (!vdeoxpln.semanticKey || !vdeoxpln.semanticKey.startsWith("kgvx_")) {
      errors.push(`${vdeoxpln.id}: missing semantic key`);
    }
    for (const owner of vdeoxpln.owners || []) {
      if (owner.startsWith("/") || owner.includes("..")) {
        errors.push(`${vdeoxpln.id}: owner must be repo-relative and neutral (${owner})`);
      }
    }
    for (const [scope, tools] of Object.entries(vdeoxpln.tools || {})) {
      for (const toolName of tools || []) {
        if (!toolSets[scope]?.has(toolName)) {
          errors.push(`${vdeoxpln.id}: ${scope} tool does not resolve (${toolName})`);
        }
      }
    }
    if (vdeoxpln.aiPolicy?.mode !== "none") {
      if (!vdeoxpln.aiPolicy?.maxAttempts || Number(vdeoxpln.aiPolicy.maxAttempts) < 1) {
        errors.push(`${vdeoxpln.id}: AI policy must declare bounded maxAttempts`);
      }
      if (typeof vdeoxpln.aiPolicy?.fallback === "undefined") {
        errors.push(`${vdeoxpln.id}: AI policy must declare fallback`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
};

const VDEOXPLN_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "with",
]);

const tokenizeVdeoxplnText = (value) =>
  Array.from(new Set(String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part && part.length > 1 && !VDEOXPLN_STOP_WORDS.has(part))))
    .sort((left, right) => left.localeCompare(right));

const normalizeRoutingArray = (values) => normalizeStringArray(values).slice(0, 24);

const buildVdeoxplnRoutingSignalText = (args = {}) => {
  const stateSignals = [
    args.intentText,
    args.contentType,
    ...normalizeRoutingArray(args.contentTypes),
    args.requestedOutput,
    ...normalizeRoutingArray(args.requestedOutputs),
    ...normalizeRoutingArray(args.stateSignals),
  ];
  if (args.chatStorageTarget === "chatKnowgrph") {
    stateSignals.push("kgc markdown graph canvas workspace artifact");
  } else if (args.chatStorageTarget === "chatHistory") {
    stateSignals.push("chat history narrative");
  }
  if (Number(args.sourceFileCount || 0) > 0 || args.hasSourceFiles === true) {
    stateSignals.push("source files source evidence workspace context");
  }
  if (args.hasGraphData === true) stateSignals.push("graph canvas topology");
  if (args.hasSelection === true) stateSignals.push("selection context");
  if (args.hasWorkspaceDocument === true) stateSignals.push("workspace document markdown");
  return stateSignals.map(normalizeString).filter(Boolean).join("\n");
};

const phraseMatchesSignal = (phrase, signalText, signalTokens) => {
  const normalizedPhrase = normalizeString(phrase).toLowerCase();
  if (!normalizedPhrase) return false;
  if (signalText.includes(normalizedPhrase)) return true;
  const phraseTokens = tokenizeVdeoxplnText(normalizedPhrase);
  if (phraseTokens.length === 0) return false;
  return phraseTokens.every((token) => signalTokens.has(token));
};

const scoreVdeoxplnForRouting = (vdeoxpln, signalText, signalTokens) => {
  const reasons = [];
  let score = 0;
  const addMatches = (label, values, weight) => {
    for (const value of values || []) {
      if (!phraseMatchesSignal(value, signalText, signalTokens)) continue;
      const tokens = tokenizeVdeoxplnText(value);
      const valueScore = weight + Math.min(4, tokens.length);
      score += valueScore;
      reasons.push(`${label}:${value}`);
    }
  };
  addMatches("trigger", vdeoxpln.triggers, 6);
  addMatches("input", vdeoxpln.inputs, 3);
  addMatches("output", vdeoxpln.outputs, 4);
  if (String(vdeoxpln.artifactPolicy?.graphMaterialization || "none") !== "none") {
    if (signalTokens.has("graph") || signalTokens.has("canvas") || signalTokens.has("kgc")) {
      score += 4;
      reasons.push("state:graph-materialization");
    }
  }
  if (String(vdeoxpln.artifactPolicy?.persistence || "").includes("source-files")) {
    if (signalTokens.has("source") || signalTokens.has("workspace") || signalTokens.has("artifact")) {
      score += 3;
      reasons.push("state:source-backed-artifact");
    }
  }
  return { score, reasons };
};

const buildVdeoxplnExecutionStages = (vdeoxpln) => {
  const graphMaterialization = String(vdeoxpln.artifactPolicy?.graphMaterialization || "none");
  const persistence = String(vdeoxpln.artifactPolicy?.persistence || "none");
  const stages = [
    {
      id: "registry",
      kind: "deterministic",
      owner: "canvas/src/features/agent-ready/knowgrphVdeoxplnContract.mjs",
      summary: "Load the canonical vdeoxpln registry and selected vdeoxpln metadata.",
    },
  ];
  if (persistence.includes("workspace") || persistence.includes("source-files")) {
    stages.push({
      id: "source-backed-artifact",
      kind: "deterministic",
      owner: "canvas/src/features/workspace-fs/workspaceFs.ts",
      summary: "Persist material run state as a workspace document so Source Files can inspect it.",
    });
  }
  if (persistence.includes("source-files")) {
    stages.push({
      id: "source-files",
      kind: "deterministic",
      owner: "canvas/src/features/source-files/applyComposedGraphFromSourceFiles.ts",
      summary: "Reuse Source Files composition and signatures for graph-producing artifacts.",
    });
  }
  if (vdeoxpln.aiPolicy?.mode && vdeoxpln.aiPolicy.mode !== "none") {
    stages.push({
      id: "floating-panel-chat",
      kind: "ai-assisted",
      owner: "canvas/src/features/chat/floatingPanelChat/floatingPanelChatSubmitCoordinator.ts",
      summary: "Use the FloatingPanel Chat harness for provider calls, bounded retries, cost visibility, and fallback state.",
      maxAttempts: vdeoxpln.aiPolicy.maxAttempts,
      tokenBudget: vdeoxpln.aiPolicy.tokenBudget,
      fallback: vdeoxpln.aiPolicy.fallback,
    });
  }
  if (graphMaterialization === "kgc-validation-to-canvas-apply") {
    stages.push(
      {
        id: "kgc-validation",
        kind: "deterministic",
        owner: "canvas/src/features/chat/chatMarkdownValidation.ts",
        summary: "Validate structured KGC Markdown before graph apply.",
      },
      {
        id: "canvas-apply",
        kind: "deterministic",
        owner: "canvas/src/features/chat/chatKgcCanvasApply.ts",
        summary: "Apply only validated KGC workspace documents through the existing Canvas path.",
      },
    );
  }
  return stages;
};

export const buildKnowgrphVdeoxplnRoutingPlan = (args = {}) => {
  const registry = Array.isArray(args.registry) ? args.registry : buildKnowgrphVdeoxplnRegistry();
  const signalText = buildVdeoxplnRoutingSignalText(args).toLowerCase();
  const signalTokens = new Set(tokenizeVdeoxplnText(signalText));
  const routeOnlyContext = !signalText.trim() && Boolean(
    normalizeString(args.routePath)
    || normalizeString(args.filePath)
    || normalizeString(args.absolutePath)
    || normalizeString(args.url),
  );
  if (signalTokens.size === 0) {
    return {
      status: "declined",
      reason: routeOnlyContext
        ? "Route, URL, and file path values are intentionally ignored for vdeoxpln routing."
        : "No intent, content type, state, or capability signal was provided.",
      signalTokens: [],
      ignoredContextKeys: ["routePath", "filePath", "absolutePath", "url"],
      rankedVdeoxpln: [],
    };
  }

  const rankedVdeoxpln = registry
    .map((vdeoxpln) => {
      const match = scoreVdeoxplnForRouting(vdeoxpln, signalText, signalTokens);
      return {
        id: vdeoxpln.id,
        title: vdeoxpln.title,
        score: match.score,
        reasons: match.reasons,
        semanticKey: vdeoxpln.semanticKey,
      };
    })
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  const selectedRank = rankedVdeoxpln[0] || null;
  if (!selectedRank || selectedRank.score < 6) {
    return {
      status: "declined",
      reason: "No vdeoxpln matched the provided neutral intent and state signals.",
      signalTokens: Array.from(signalTokens).sort((left, right) => left.localeCompare(right)),
      ignoredContextKeys: ["routePath", "filePath", "absolutePath", "url"],
      rankedVdeoxpln,
    };
  }
  const selectedVdeoxpln = registry.find((vdeoxpln) => vdeoxpln.id === selectedRank.id);
  const semanticRunKey = buildKnowgrphVdeoxplnSemanticKey("vdeoxpln-run", {
    vdeoxplnId: selectedVdeoxpln.id,
    vdeoxplnSemanticKey: selectedVdeoxpln.semanticKey,
    signalTokens: Array.from(signalTokens).sort((left, right) => left.localeCompare(right)),
    chatStorageTarget: normalizeString(args.chatStorageTarget),
    sourceFileCount: Number(args.sourceFileCount || 0),
    hasGraphData: args.hasGraphData === true,
    hasSelection: args.hasSelection === true,
    hasWorkspaceDocument: args.hasWorkspaceDocument === true,
  });
  return {
    status: "selected",
    reason: `Selected ${selectedVdeoxpln.id} from neutral trigger, input, output, and current-state signals.`,
    selectedVdeoxplnId: selectedVdeoxpln.id,
    selectedVdeoxpln: {
      id: selectedVdeoxpln.id,
      title: selectedVdeoxpln.title,
      purpose: selectedVdeoxpln.purpose,
      scope: selectedVdeoxpln.scope,
      mutation: selectedVdeoxpln.mutation,
      semanticKey: selectedVdeoxpln.semanticKey,
      owners: selectedVdeoxpln.owners,
      tools: selectedVdeoxpln.tools,
      artifactPolicy: selectedVdeoxpln.artifactPolicy,
      aiPolicy: selectedVdeoxpln.aiPolicy,
    },
    semanticRunKey,
    signalTokens: Array.from(signalTokens).sort((left, right) => left.localeCompare(right)),
    ignoredContextKeys: ["routePath", "filePath", "absolutePath", "url"],
    rankedVdeoxpln,
    executionStages: buildVdeoxplnExecutionStages(selectedVdeoxpln),
    artifactContract: {
      persistence: selectedVdeoxpln.artifactPolicy?.persistence || "none",
      graphMaterialization: selectedVdeoxpln.artifactPolicy?.graphMaterialization || "none",
      outputs: selectedVdeoxpln.outputs,
      semanticKeyInputs: selectedVdeoxpln.artifactPolicy?.semanticKeyInputs || [],
    },
  };
};

export const buildKnowgrphVdeoxplnChatSystemPrompt = (plan) => {
  if (!plan || plan.status !== "selected" || !plan.selectedVdeoxpln) return "";
  const stageLines = (plan.executionStages || [])
    .map((stage) => `- ${stage.id}: ${stage.summary}`)
    .join("\n");
  return [
    "Knowgrph vdeoxpln execution contract:",
    `- Selected vdeoxpln: ${plan.selectedVdeoxpln.id}`,
    `- Semantic run key: ${plan.semanticRunKey}`,
    `- Persistence: ${plan.artifactContract?.persistence || "none"}`,
    `- Graph materialization: ${plan.artifactContract?.graphMaterialization || "none"}`,
    `- AI max attempts: ${String(plan.selectedVdeoxpln.aiPolicy?.maxAttempts ?? 0)}`,
    `- AI token budget: ${String(plan.selectedVdeoxpln.aiPolicy?.tokenBudget ?? 0)}`,
    `- AI fallback: ${plan.selectedVdeoxpln.aiPolicy?.fallback || "Return deterministic errors without model calls."}`,
    "Use deterministic source, validation, and canvas owners for exact graph state. Use provider output only for the AI-assisted stage already routed through this FloatingPanel Chat harness.",
    "Do not infer vdeoxpln selection from route names, file names, absolute paths, demo fixtures, or compatibility aliases.",
    "Stages:",
    stageLines || "- registry: Load the selected vdeoxpln contract.",
  ].join("\n");
};

export const buildKnowgrphVdeoxplnAgentSkillDefinitions = (
  registry = buildKnowgrphVdeoxplnRegistry(),
) => registry.map((vdeoxpln) => ({
  ...vdeoxpln.agentSkill,
  vdeoxpln: {
    id: vdeoxpln.id,
    title: vdeoxpln.title,
    scope: vdeoxpln.scope,
    mutation: vdeoxpln.mutation,
    semanticKey: vdeoxpln.semanticKey,
    tools: vdeoxpln.tools,
    publish: vdeoxpln.publish,
  },
}));

const markdownList = (values) =>
  values && values.length ? values.map((value) => `- ${value}`).join("\n") : "- none";

export const buildKnowgrphVdeoxplnMarkdown = (vdeoxpln) => `# ${vdeoxpln.title} Skill

Use this skill when: ${vdeoxpln.purpose}

## Contract

- Vdeoxpln id: \`${vdeoxpln.id}\`
- Contract version: \`${vdeoxpln.version}\`
- Semantic key: \`${vdeoxpln.semanticKey}\`
- Scope: \`${vdeoxpln.scope}\`
- Mutation boundary: \`${vdeoxpln.mutation}\`

## Triggers

${markdownList(vdeoxpln.triggers)}

## Inputs

${markdownList(vdeoxpln.inputs)}

## Outputs

${markdownList(vdeoxpln.outputs)}

## Tools

Published tools:
${markdownList(vdeoxpln.tools.published)}

Browser-local tools:
${markdownList(vdeoxpln.tools.browserLocal)}

Local MCP tools:
${markdownList(vdeoxpln.tools.local)}

## Workflow

${markdownList(vdeoxpln.workflow)}

## Source Owners

${markdownList(vdeoxpln.owners)}

## Artifact Policy

- Persistence: \`${vdeoxpln.artifactPolicy?.persistence || "none"}\`
- Graph materialization: \`${vdeoxpln.artifactPolicy?.graphMaterialization || "none"}\`
- Semantic-key inputs:
${markdownList(vdeoxpln.artifactPolicy?.semanticKeyInputs || [])}

## AI Policy

- Mode: \`${vdeoxpln.aiPolicy?.mode || "none"}\`
- Max attempts: \`${String(vdeoxpln.aiPolicy?.maxAttempts ?? 0)}\`
- Token budget: \`${String(vdeoxpln.aiPolicy?.tokenBudget ?? 0)}\`
- Fallback: ${vdeoxpln.aiPolicy?.fallback || "Return deterministic errors without model calls."}

## Validation

${markdownList(vdeoxpln.validation)}

## Guardrails

- Keep behavior source-owned in the listed Knowgrph owners.
- Do not add compatibility aliases for stale vdeoxpln ids.
- Do not route by absolute paths, demo filenames, provider keys, or public route labels.
- Do not copy external vdeoxpln source, prompts, schemas, examples, assets, or prose.
`;

export const buildKnowgrphVdeoxplnMarkdownByName = (
  registry = buildKnowgrphVdeoxplnRegistry(),
) => Object.fromEntries(registry.map((vdeoxpln) => [vdeoxpln.id, buildKnowgrphVdeoxplnMarkdown(vdeoxpln)]));
