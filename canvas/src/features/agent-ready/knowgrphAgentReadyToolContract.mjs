export const KNOWGRPH_AGENT_READY_TOOL_IDS = Object.freeze({
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
  inspectLocal3dLayoutPositions: 'inspect_local_3d_layout_positions',
  inspectLocal2dZoomViewport: 'inspect_local_2d_zoom_viewport',
  inspectLocalSourceFilesSnapshot: 'inspect_local_source_files_snapshot',
  inspectAgentSurface: 'inspect_agent_surface',
})

export const KNOWGRPH_AGENT_READY_WEB_MCP_NAMESPACE = 'knowgrph'

const READ_ONLY_TOOL_ANNOTATIONS = Object.freeze({ readOnlyHint: true })

export const buildKnowgrphWebMcpToolName = (
  toolName,
  namespace = KNOWGRPH_AGENT_READY_WEB_MCP_NAMESPACE,
) => `${String(namespace || '').trim()}.${String(toolName || '').trim()}`

export const buildKnowgrphAgentReadyToolContracts = (args = {}) => {
  const defaultWorkspaceId = String(args.defaultWorkspaceId || '').trim()
  const includeBrowserOnlyTools = args.includeBrowserOnlyTools === true
  const contracts = [
    {
      name: KNOWGRPH_AGENT_READY_TOOL_IDS.listSourceFiles,
      webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.listSourceFiles),
      title: 'List Source Files',
      description: 'List published Knowgrph Source Files.',
      inputSchema: { type: 'object', additionalProperties: false, properties: {} },
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    {
      name: KNOWGRPH_AGENT_READY_TOOL_IDS.readSourceFile,
      webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.readSourceFile),
      title: 'Read Source File',
      description: 'Read published Knowgrph Editor Workspace markdown content. Defaults to the canonical docs workspace when workspaceId is omitted.',
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
      description: 'Read published Knowgrph markdown content from a share token or public Knowgrph share/document URL.',
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
      description: 'Inspect published Knowgrph shared-document frontmatter and body structure from a share token or public Knowgrph share/document URL.',
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
          description: 'Inspect the active browser-local Knowgrph SettingsView chat readiness state for MainPanel MCP and Integrations, including provider, routing, and model discovery status.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalMainPanelState,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalMainPanelState),
          title: 'Inspect Local MainPanel State',
          description: 'Inspect the active browser-local Knowgrph MainPanel tab, search, and shared action state for MCP and Integrations readiness.',
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
          description: 'Inspect the active browser-local Knowgrph FloatingPanel chat runtime, including streaming, workspace follow path, and LLM-to-workspace pipeline state.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
        }, {
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalMainPanelChatCanvasPipeline,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalMainPanelChatCanvasPipeline),
          title: 'Inspect Local MainPanel Chat Canvas Pipeline',
          description: 'Inspect the active browser-local Knowgrph E2E readiness path from MainPanel MCP and Integrations through FloatingPanel Chat, workspace markdown/frontmatter, and canvas topology.',
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
          name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocal3dLayoutPositions,
          webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocal3dLayoutPositions),
          title: 'Inspect Local 3D Layout Positions',
          description: 'Inspect the active browser-local Knowgrph 3D layout positions from the app runtime without calling published storage or Pages MCP routes.',
          inputSchema: { type: 'object', additionalProperties: false, properties: {} },
          annotations: READ_ONLY_TOOL_ANNOTATIONS,
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
        }]
      : []),
    {
      name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectAgentSurface,
      webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectAgentSurface),
      title: 'Inspect Agent Surface',
      description: 'Inspect the deployed Knowgrph agent-ready discovery surface, including health, OpenAPI, MCP, and skill metadata.',
      inputSchema: { type: 'object', additionalProperties: false, properties: {} },
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
  ]
  return contracts
}
