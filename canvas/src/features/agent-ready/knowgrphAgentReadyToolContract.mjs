import {
  KNOWGRPH_AGENT_SURFACE_OUTPUT_SCHEMA,
  buildKnowgrphMcpNoauthSecuritySchemes,
  buildKnowgrphMcpAppsToolMeta,
} from './mcpAppsReadyContract.mjs'
import { XR_SCENE_WEB_MCP_TOOL_IDS } from '../three/xrSceneMcpContract.mjs'
import { CAMERA_WEB_MCP_TOOL_IDS } from '../strybldr/cameraMcpContract.mjs'
import { XR_ANIMATION_WEB_MCP_TOOL_IDS } from '../three/xrAnimationMcpContract.mjs'

export const KNOWGRPH_AGENT_READY_TOOL_IDS = Object.freeze({
  search: 'search',
  fetch: 'fetch',
  listSourceFiles: 'list_source_files',
  readSourceFile: 'read_source_file',
  readSharedDocument: 'read_shared_document',
  inspectSharedDocumentStructure: 'inspect_shared_document_structure',
  inspectLocalSettingsChatReadiness: 'inspect_local_settings_chat_readiness',
  inspectLocalMainPanelState: 'inspect_local_mainpanel_state',
  inspectLocalEditorWorkspaceState: 'inspect_local_editor_workspace_state',
  inspectLocalChatPipelineState: 'inspect_local_chat_pipeline_state',
  inspectLocalMainPanelChatCanvasPipeline: 'inspect_local_mainpanel_chat_canvas_pipeline',
  inspectLocalWorkspaceDocument: 'inspect_local_workspace_document',
  inspectLocalCanvasTopology: 'inspect_local_canvas_topology',
  inspectLocalCanvasSnapshot: 'inspect_local_canvas_snapshot',
  inspectLocal3dCameraPose: 'inspect_local_3d_camera_pose',
  inspectLocalCamera: CAMERA_WEB_MCP_TOOL_IDS.inspect,
  controlLocalCamera: CAMERA_WEB_MCP_TOOL_IDS.control,
  inspectLocalAnimation: XR_ANIMATION_WEB_MCP_TOOL_IDS.inspect,
  controlLocalAnimation: XR_ANIMATION_WEB_MCP_TOOL_IDS.control,
  inspectLocal3dLayoutPositions: 'inspect_local_3d_layout_positions',
  inspectLocalXrSceneAssets: XR_SCENE_WEB_MCP_TOOL_IDS.inspect,
  controlLocalXrScene: XR_SCENE_WEB_MCP_TOOL_IDS.control,
  inspectLocal2dZoomViewport: 'inspect_local_2d_zoom_viewport',
  inspectLocalSourceFilesSnapshot: 'inspect_local_source_files_snapshot',
  readLocalRuntimeIdentity: 'read_local_runtime_identity',
  inspectAgentSurface: 'inspect_agent_surface',
})

export const KNOWGRPH_AGENT_READY_WEB_MCP_NAMESPACE = 'knowgrph'
export const KNOWGRPH_AGENT_READY_DEFAULT_WORKSPACE_ID = 'kgws:canonical-docs'

const buildReadOnlyToolAnnotations = () => Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: true,
})
const READ_ONLY_TOOL_ANNOTATIONS = buildReadOnlyToolAnnotations()
const LOCAL_MUTATION_TOOL_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: false,
})

const SEARCH_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: true,
  required: ['ids', 'results'],
  properties: {
    ids: {
      type: 'array',
      items: { type: 'string' },
    },
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        required: ['id', 'title', 'url'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          url: { type: 'string' },
          snippet: { type: 'string' },
          workspaceId: { type: 'string' },
          canonicalPath: { type: 'string' },
        },
      },
    },
  },
})

const FETCH_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: true,
  required: ['id', 'title', 'content', 'text', 'url'],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    content: { type: 'string' },
    text: { type: 'string' },
    url: { type: 'string' },
    metadata: {
      type: 'object',
      additionalProperties: true,
    },
  },
})

const RUNTIME_IDENTITY_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['identity', 'gate'],
  properties: {
    identity: {
      type: 'object',
      additionalProperties: true,
      required: [
        'schema', 'device', 'branch', 'knowgrphRevision', 'agenticCanvasOsRevision',
        'catalogRevision', 'catalogHydration', 'catalogCounts',
      ],
    },
    gate: {
      type: 'object',
      additionalProperties: true,
      required: [
        'schema', 'status', 'transportStatus', 'requiredDeviceCount',
        'observedDeviceCount', 'expiresAtMs', 'verificationDigest', 'message', 'differences',
      ],
    },
  },
})

export const buildKnowgrphWebMcpToolName = (
  toolName,
  namespace = KNOWGRPH_AGENT_READY_WEB_MCP_NAMESPACE,
) => `${String(namespace || '').trim()}.${String(toolName || '').trim()}`

export const buildKnowgrphAgentReadyToolContracts = (args = {}) => {
  const defaultWorkspaceId = String(args.defaultWorkspaceId || '').trim()
  const includeBrowserOnlyTools = args.includeBrowserOnlyTools === true
  const contracts = [
    {
      name: KNOWGRPH_AGENT_READY_TOOL_IDS.search,
      webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.search),
      title: 'Search Knowgrph Source Files',
      description: 'Use this when an MCP host needs to search published Knowgrph Source Files and return stable document IDs for the `fetch` tool. Call this first for OpenAI Deep Research-style retrieval, Claude, Qwen Code, Kimi CLI, BytePlus ModelArk, and generic MCP clients.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['query'],
        properties: {
          query: { type: 'string' },
          limit: { type: 'number', default: 10 },
        },
      },
      outputSchema: SEARCH_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    {
      name: KNOWGRPH_AGENT_READY_TOOL_IDS.fetch,
      webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.fetch),
      title: 'Fetch Knowgrph Source File',
      description: 'Use this when an MCP host needs the complete published Knowgrph Source File for an ID returned by `search`. Returns markdown as both `content` and `text` for OpenAI, Claude, Qwen Code, Kimi CLI, BytePlus ModelArk, and generic MCP clients.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      outputSchema: FETCH_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    {
      name: KNOWGRPH_AGENT_READY_TOOL_IDS.listSourceFiles,
      webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.listSourceFiles),
      title: 'List Source Files',
      description: 'Use this when an MCP host needs the published Knowgrph Source Files index as markdown.',
      inputSchema: { type: 'object', additionalProperties: false, properties: {} },
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    {
      name: KNOWGRPH_AGENT_READY_TOOL_IDS.readSourceFile,
      webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.readSourceFile),
      title: 'Read Source File',
      description: 'Use this when an MCP host knows a published Knowgrph canonical path and needs that Editor Workspace markdown content. Defaults to the canonical docs workspace when workspaceId is omitted.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['canonicalPath'],
        properties: {
          canonicalPath: { type: 'string' },
          workspaceId: defaultWorkspaceId ? { type: 'string', default: defaultWorkspaceId } : { type: 'string' },
        },
      },
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    {
      name: KNOWGRPH_AGENT_READY_TOOL_IDS.readSharedDocument,
      webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.readSharedDocument),
      title: 'Read Shared Document',
      description: 'Use this when an MCP host has a Knowgrph share token or public Knowgrph share/document URL and needs the published markdown content.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          shareToken: { type: 'string' },
          shareUrl: { type: 'string' },
        },
        anyOf: [{ required: ['shareToken'] }, { required: ['shareUrl'] }],
      },
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    {
      name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectSharedDocumentStructure,
      webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectSharedDocumentStructure),
      title: 'Inspect Shared Document Structure',
      description: 'Use this when an MCP host has a Knowgrph share token or public Knowgrph share/document URL and needs frontmatter/body structure without mutating the document.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          shareToken: { type: 'string' },
          shareUrl: { type: 'string' },
        },
        anyOf: [{ required: ['shareToken'] }, { required: ['shareUrl'] }],
      },
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    ...(includeBrowserOnlyTools
      ? [{
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalSettingsChatReadiness,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalSettingsChatReadiness),
          title: 'Inspect Local Settings Chat Readiness',
          description: 'Inspect the active browser-local Knowgrph SettingsView chat readiness state for MainPanel MCP, Integrations, and Commerce, including provider, routing, and model discovery status.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalMainPanelState,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalMainPanelState),
          title: 'Inspect Local MainPanel State',
          description: 'Inspect the active browser-local Knowgrph MainPanel tab, search, and shared action state for MCP, Integrations, and Commerce readiness.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalEditorWorkspaceState,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalEditorWorkspaceState),
          title: 'Inspect Local Editor Workspace State',
          description: 'Inspect the active browser-local Knowgrph Editor Workspace and Markdown pane state, including pane visibility and live draft/frontmatter structure.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalChatPipelineState,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalChatPipelineState),
          title: 'Inspect Local Chat Pipeline State',
          description: 'Inspect the active browser-local Knowgrph FloatingPanel chat runtime, including streaming, workspace follow path, LLM-to-workspace pipeline state, and promotion retry recovery for already-saved local artifacts.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalMainPanelChatCanvasPipeline,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalMainPanelChatCanvasPipeline),
          title: 'Inspect Local MainPanel Chat Canvas Pipeline',
          description: 'Inspect the active browser-local Knowgrph E2E readiness path from MainPanel MCP, Integrations, and Commerce through FloatingPanel Chat, workspace markdown/frontmatter, and canvas topology.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalWorkspaceDocument,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalWorkspaceDocument),
          title: 'Inspect Local Workspace Document',
          description: 'Inspect the active browser-local Knowgrph workspace markdown document structure without reading published storage routes.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalCanvasTopology,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalCanvasTopology),
          title: 'Inspect Local Canvas Topology',
          description: 'Inspect the active browser-local Knowgrph canvas topology summary from the app runtime without calling published storage or Pages MCP routes.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalCanvasSnapshot,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalCanvasSnapshot),
          title: 'Inspect Local Canvas Snapshot',
          description: 'Inspect the active browser-local Knowgrph canvas SVG snapshot from the app runtime without calling published storage or Pages MCP routes.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocal3dCameraPose,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocal3dCameraPose),
          title: 'Inspect Local 3D Camera Pose',
          description: 'Inspect the active browser-local Knowgrph 3D camera pose from the app runtime without calling published storage or Pages MCP routes.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalCamera,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalCamera),
          title: 'Inspect Local Camera',
          description: 'Inspect the first-class shared Camera framing and XR camera choreography, including its hydrated MCP and / @ # invocation grammar.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          outputSchema: { type: 'object', additionalProperties: true, required: ['schema', 'webMcpTools', 'invocationGrammar', 'surface', 'framing', 'choreography'] },
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.controlLocalCamera,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.controlLocalCamera),
          title: 'Control Local Camera',
          description: 'Control shared Camera framing and XR camera choreography through structured actions or upstream Camera commands, bindings, semantic routes, and typed key=value parameters.',
          inputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              invocation: { type: 'string', description: 'Invocation such as /camera.animate @camera #camera-motion rig=handheld time=2.5.' },
              action: { type: 'string', enum: ['frame', 'animate', 'playback', 'scrub'] },
              targetId: { type: 'string' },
              angle: { type: 'string', enum: ['front', 'left-side', 'right-side', 'overhead'] },
              level: { type: 'string', enum: ['eye-level', 'high-angle', 'low-angle'] },
              shot: { type: 'string', enum: ['wide', 'medium', 'close-up'] },
              focalLengthMm: { type: 'number', minimum: 14, maximum: 200 },
              rig: { type: 'string', enum: ['dolly', 'steadicam', 'handheld', 'crane', 'drone', 'car-mount'] },
              timeSeconds: { type: 'number', minimum: 0 },
              playing: { type: 'boolean' },
            },
            anyOf: [{ required: ['invocation'] }, { required: ['action'] }],
          },
          outputSchema: { type: 'object', additionalProperties: true, required: ['ok', 'message'] },
          annotations: LOCAL_MUTATION_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalAnimation,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalAnimation),
          title: 'Inspect Local Animation',
          description: 'Inspect native XR character-motion and action-path presets, selected cast state, deterministic package capability, and hydrated upstream invocation grammar.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          outputSchema: { type: 'object', additionalProperties: true, required: ['schema', 'webMcpTools', 'sceneReady', 'catalog', 'invocationGrammar', 'presets', 'runtime'] },
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.controlLocalAnimation,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.controlLocalAnimation),
          title: 'Control Local Animation',
          description: 'Apply, clear, play, pause, scrub, or export native XR choreography through structured fields or the upstream /animation.control, #character-motion, #action-path, @selected-actor, and @canvas grammar.',
          inputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              invocation: { type: 'string', description: 'Upstream invocation such as /animation.control #character-motion @selected-actor operation=apply preset=dance.' },
              operation: { type: 'string', enum: ['apply', 'clear', 'play', 'pause', 'scrub', 'export'] },
              trackKind: { type: 'string', enum: ['character-motion', 'action-path'] },
              presetId: { type: 'string' },
              targetId: { type: 'string' },
              timeSeconds: { type: 'number', minimum: 0 },
            },
            anyOf: [{ required: ['invocation'] }, { required: ['operation'] }],
          },
          outputSchema: { type: 'object', additionalProperties: true, required: ['ok', 'message'] },
          annotations: LOCAL_MUTATION_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocal3dLayoutPositions,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocal3dLayoutPositions),
          title: 'Inspect Local 3D Layout Positions',
          description: 'Inspect the active browser-local Knowgrph 3D layout positions from the app runtime without calling published storage or Pages MCP routes.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalXrSceneAssets,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalXrSceneAssets),
          title: 'Inspect Local XR Scene Assets',
          description: 'Inspect the browser-local XR environment kits, procedural 3D asset library, typed placement grammar, placed subjects, and path interpolation without mutating the scene.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          outputSchema: { type: 'object', additionalProperties: true, required: ['schema', 'webMcpTools', 'sceneReady', 'invocationGrammar', 'environments', 'assets', 'runtime'] },
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.controlLocalXrScene,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.controlLocalXrScene),
          title: 'Control Local XR Scene',
          description: 'Control the open browser-local XR scene through structured stage, placement, path-interpolation, label, and removal actions. Animation is owned separately by /animation.control.',
          inputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              invocation: { type: 'string', description: 'Invocation such as /xr.place @person-adult transition=linear.' },
              action: { type: 'string', enum: ['stage', 'place', 'transition', 'label', 'remove'] },
              stageId: { type: 'string' },
              assetId: { type: 'string' },
              subjectId: { type: 'string' },
              label: { type: 'string', maxLength: 80 },
              transition: { type: 'string', enum: ['linear', 'hold'] },
            },
            anyOf: [{ required: ['invocation'] }, { required: ['action'] }],
          },
          outputSchema: { type: 'object', additionalProperties: true, required: ['ok', 'message'] },
          annotations: LOCAL_MUTATION_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocal2dZoomViewport,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocal2dZoomViewport),
          title: 'Inspect Local 2D Zoom Viewport',
          description: 'Inspect the active browser-local Knowgrph 2D zoom and viewport state from the app runtime without calling published storage or Pages MCP routes.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalSourceFilesSnapshot,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalSourceFilesSnapshot),
          title: 'Inspect Local Source Files Snapshot',
          description: 'Inspect the active browser-local Knowgrph Source Files runtime snapshot from the app runtime without calling published storage or Pages MCP routes.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.readLocalRuntimeIdentity,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.readLocalRuntimeIdentity),
          title: 'Read Local Runtime Identity',
          description: 'Read the application-global canonical Knowgrph runtime identity and automatic cross-device verification status without refreshing catalogs, rebuilding identity, copying clipboard data, or mutating source.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          outputSchema: RUNTIME_IDENTITY_OUTPUT_SCHEMA,
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
        }]
      : []),
    {
      name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectAgentSurface,
      webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectAgentSurface),
      title: 'Inspect Agent Surface',
      description: 'Use this when an MCP Apps-capable host or generic MCP client needs to inspect Knowgrph agent-ready discovery, MCP Apps readiness, OpenAPI, and skill metadata.',
      inputSchema: { type: 'object', additionalProperties: false, properties: {} },
      outputSchema: KNOWGRPH_AGENT_SURFACE_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      _meta: buildKnowgrphMcpAppsToolMeta(),
    },
  ]
  return contracts.map((contract) => ({
    ...contract,
    securitySchemes: Array.isArray(contract.securitySchemes) && contract.securitySchemes.length
      ? contract.securitySchemes
      : buildKnowgrphMcpNoauthSecuritySchemes(),
  }))
}
