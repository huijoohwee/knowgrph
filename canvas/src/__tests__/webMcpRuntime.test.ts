import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { encodePublishedDocShareToken } from '@/features/canvas/canvasDocShareToken.mjs'
import { buildAgentSurfaceInspectionPayload } from '@/features/agent-ready/agentSurfaceInspection.mjs'
import { buildKnowgrphAgentReadyToolContracts } from '@/features/agent-ready/knowgrphAgentReadyToolContract.mjs'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import {
  installKnowgrphWebMcpRuntime,
  resetKnowgrphWebMcpRuntimeForTests,
} from '@/features/agent-ready/webMcpRuntime'
import {
  publishLocalChatPipelineSurfaceSnapshot,
  publishLocalEditorWorkspaceSurfaceSnapshot,
  publishLocalMainPanelSurfaceSnapshot,
  publishLocalSettingsChatReadinessSurfaceSnapshot,
} from '@/features/agent-ready/browserLocalSurfaceSnapshots'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import { KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID } from '@/lib/storage/knowgrphStorageSyncContract'

type RegisteredTool = {
  name: string
  title?: string; description?: string
  inputSchema?: Record<string, unknown>
  annotations?: Record<string, unknown>
  execute: (input?: Record<string, unknown>) => Promise<unknown>
}

const EXPECTED_WEB_MCP_RUNTIME_CONTRACTS = buildKnowgrphAgentReadyToolContracts({
  defaultWorkspaceId: KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID,
  includeBrowserOnlyTools: true,
})

const assertWebMcpRuntimeToolParity = (tools: RegisteredTool[], label: string): void => {
  const registeredToolNames = tools.map((tool) => tool.name).sort()
  const expectedToolNames = EXPECTED_WEB_MCP_RUNTIME_CONTRACTS.map((tool) => tool.webName).sort()
  if (registeredToolNames.join('|') !== expectedToolNames.join('|')) {
    throw new Error(
      `expected ${label} tool parity with shared browser contract, got ${registeredToolNames.join(', ')} expected ${expectedToolNames.join(', ')}`,
    )
  }
  if (new Set(registeredToolNames).size !== registeredToolNames.length) {
    throw new Error(`expected ${label} tool names to be unique, got ${registeredToolNames.join(', ')}`)
  }
  for (const contract of EXPECTED_WEB_MCP_RUNTIME_CONTRACTS) {
    const registeredTool = tools.find((tool) => tool.name === contract.webName)
    if (!registeredTool) {
      throw new Error(`expected ${label} to register ${contract.webName}`)
    }
    if (registeredTool.title !== contract.title) {
      throw new Error(`expected ${label} title parity for ${contract.webName}`)
    }
    if (registeredTool.description !== contract.description) {
      throw new Error(`expected ${label} description parity for ${contract.webName}`)
    }
    if (JSON.stringify(registeredTool.inputSchema) !== JSON.stringify(contract.inputSchema)) {
      throw new Error(`expected ${label} inputSchema parity for ${contract.webName}`)
    }
    if (JSON.stringify(registeredTool.annotations || null) !== JSON.stringify(contract.annotations || null)) {
      throw new Error(`expected ${label} annotations parity for ${contract.webName}`)
    }
  }
}

const MOCK_SHARED_DOCUMENT_MARKDOWN = `---
flow:
  nodes:
    - id: start
      label: Start
    - id: end
      label: End
  connections:
    - source: start
      target: end
  subgraphs:
    - id: lane-main
      label: Main
---

# Shared Doc

## Overview
`

const MOCK_CANVAS_GRAPH_DATA = {
  nodes: [
    { id: 'start', type: 'Step', label: 'Start' },
    { id: 'end', type: 'Step', label: 'End' },
  ],
  edges: [
    { id: 'edge-1', source: 'start', target: 'end', label: 'next' },
  ],
  metadata: {
    'kg:subgraphs': [
      { id: 'lane-main', label: 'Main', memberNodeIds: ['start', 'end'] },
    ],
  },
  type: 'application/json',
}

const MOCK_CANVAS_SVG = '<svg viewBox="0 0 640 360" width="640" height="360"><g data-kg-node="start" /></svg>'
const MOCK_THREE_CAMERA_POSE = {
  position: { x: 10, y: 20, z: 30 },
  quaternion: { x: 0, y: 0.5, z: 0, w: 0.8660254 },
  target: { x: 1, y: 2, z: 3 },
  fov: 45,
  zoom: 1.25,
}
const MOCK_THREE_LAYOUT_POSITIONS = {
  alpha: [1.1114, 2.2225, 3.3336],
  start: [10.1234, 20.5678, 30.9876],
  omega: [40.4444, 50.5555, 60.6666],
}

const createMockResponse = (url: string): Response =>
  ({
    ok: true,
    status: 200,
    text: async () => (
      url.includes('/api/storage/doc-default/')
        || url.includes('/api/storage/doc/')
        ? MOCK_SHARED_DOCUMENT_MARKDOWN
        : '# mock markdown'
    ),
    json: async () => ({
      url,
      ok: true,
      capabilities: { tools: [{ name: 'list_source_files' }] },
      status: 'pass',
      service: 'knowgrph-agent-ready-pages',
      skills: [{ name: 'knowgrph-source-files', type: 'markdown', url: `${url}/skill.md`, sha256: 'sha' }],
      openapi: '3.1.0',
      paths: { '/knowgrph/health': { get: {} } },
    }),
  }) as Response

const buildExpectedMockAgentSurfaceInspection = (baseUrl: string) =>
  buildAgentSurfaceInspectionPayload({
    baseUrl,
    health: {
      url: `${baseUrl}/health`,
      ok: true,
      capabilities: { tools: [{ name: 'list_source_files' }] },
      status: 'pass',
      service: 'knowgrph-agent-ready-pages',
      skills: [{ name: 'knowgrph-source-files', type: 'markdown', url: `${baseUrl}/health/skill.md`, sha256: 'sha' }],
      openapi: '3.1.0',
      paths: { '/knowgrph/health': { get: {} } },
    },
    apiCatalog: {
      url: `${baseUrl}/.well-known/api-catalog`,
      ok: true,
      capabilities: { tools: [{ name: 'list_source_files' }] },
      status: 'pass',
      service: 'knowgrph-agent-ready-pages',
      skills: [{ name: 'knowgrph-source-files', type: 'markdown', url: `${baseUrl}/.well-known/api-catalog/skill.md`, sha256: 'sha' }],
      openapi: '3.1.0',
      paths: { '/knowgrph/health': { get: {} } },
    },
    openApi: {
      url: `${baseUrl}/.well-known/openapi.json`,
      ok: true,
      capabilities: { tools: [{ name: 'list_source_files' }] },
      status: 'pass',
      service: 'knowgrph-agent-ready-pages',
      skills: [{ name: 'knowgrph-source-files', type: 'markdown', url: `${baseUrl}/.well-known/openapi.json/skill.md`, sha256: 'sha' }],
      openapi: '3.1.0',
      paths: { '/knowgrph/health': { get: {} } },
    },
    mcpServerCard: {
      url: `${baseUrl}/.well-known/mcp/server-card.json`,
      ok: true,
      capabilities: { tools: [{ name: 'list_source_files' }] },
      status: 'pass',
      service: 'knowgrph-agent-ready-pages',
      skills: [{ name: 'knowgrph-source-files', type: 'markdown', url: `${baseUrl}/.well-known/mcp/server-card.json/skill.md`, sha256: 'sha' }],
      openapi: '3.1.0',
      paths: { '/knowgrph/health': { get: {} } },
    },
    agentCard: {
      url: `${baseUrl}/.well-known/agent-card.json`,
      ok: true,
      capabilities: { tools: [{ name: 'list_source_files' }] },
      status: 'pass',
      service: 'knowgrph-agent-ready-pages',
      skills: [{ name: 'knowgrph-source-files', type: 'markdown', url: `${baseUrl}/.well-known/agent-card.json/skill.md`, sha256: 'sha' }],
      openapi: '3.1.0',
      paths: { '/knowgrph/health': { get: {} } },
    },
    agentSkills: {
      url: `${baseUrl}/.well-known/agent-skills/index.json`,
      ok: true,
      capabilities: { tools: [{ name: 'list_source_files' }] },
      status: 'pass',
      service: 'knowgrph-agent-ready-pages',
      skills: [{ name: 'knowgrph-source-files', type: 'markdown', url: `${baseUrl}/.well-known/agent-skills/index.json/skill.md`, sha256: 'sha' }],
      openapi: '3.1.0',
      paths: { '/knowgrph/health': { get: {} } },
    },
  })

export async function testWebMcpRuntimeLateBindsAndUsesSameOriginStoragePaths(): Promise<void> {
  const previousBaseUrl = process.env.VITE_KNOWGRPH_STORAGE_BASE_URL
  const previousFetch = globalThis.fetch
  const { restore } = initJsdomHarness()
  const registeredTools = new Map<string, RegisteredTool>()
  const fetchCalls: string[] = []
  const previousMarkdownDocumentName = useGraphStore.getState().markdownDocumentName
  const previousMarkdownDocumentText = useGraphStore.getState().markdownDocumentText
  const previousMarkdownDocumentSourceUrl = useGraphStore.getState().markdownDocumentSourceUrl
  const previousGraphData = useGraphStore.getState().graphData
  const previousGraphDataRevision = useGraphStore.getState().graphDataRevision
  const previousCanvasRenderMode = useGraphStore.getState().canvasRenderMode
  const previousCanvas2dRenderer = useGraphStore.getState().canvas2dRenderer
  const previousDocumentSemanticMode = useGraphStore.getState().documentSemanticMode
  const previousFrontmatterModeEnabled = useGraphStore.getState().frontmatterModeEnabled
  const previousMultiDimTableModeEnabled = useGraphStore.getState().multiDimTableModeEnabled
  const previousDocumentStructureBaselineLock = useGraphStore.getState().documentStructureBaselineLock
  const previousCollapsedGroupIds = useGraphStore.getState().collapsedGroupIds
  const previousSelectedNodeId = useGraphStore.getState().selectedNodeId
  const previousSelectedEdgeId = useGraphStore.getState().selectedEdgeId
  const previousCanvasSnapshotFns = useGraphStore.getState().canvasSnapshotFns
  const previousThreeCameraSnapshotFns = useGraphStore.getState().threeCameraSnapshotFns
  const previousThreeLayoutSnapshotFns = useGraphStore.getState().threeLayoutSnapshotFns
  const previousCanvas3dMode = useGraphStore.getState().canvas3dMode
  const previousViewPinned = useGraphStore.getState().viewPinned
  const previousFitToScreenMode = useGraphStore.getState().fitToScreenMode
  const previousZoomToSelectionMode = useGraphStore.getState().zoomToSelectionMode
  const previousZoomState = useGraphStore.getState().zoomState
  const previousZoomStateByKey = useGraphStore.getState().zoomStateByKey
  const previousRenderMediaAsNodes = useGraphStore.getState().renderMediaAsNodes
  const previousMediaPanelDensity = useGraphStore.getState().mediaPanelDensity
  const previousSchema = useGraphStore.getState().schema
  const previousDesignRendererWebpageLayoutKey = useGraphStore.getState().designRendererWebpageLayoutKey
  const previousSourceFiles = useGraphStore.getState().sourceFiles
  const previousExplorerActivePath = useMarkdownExplorerStore.getState().activePath

  try {
    delete process.env.VITE_KNOWGRPH_STORAGE_BASE_URL
    resetKnowgrphWebMcpRuntimeForTests()

    const navigatorObject = window.navigator as Navigator & {
      modelContext?: {
        registerTool?: (tool: RegisteredTool, options?: { signal?: AbortSignal }) => void
      }
    }
    try {
      delete navigatorObject.modelContext
    } catch {
      navigatorObject.modelContext = undefined
    }

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      fetchCalls.push(url)
      return createMockResponse(url)
    }) as typeof fetch

    installKnowgrphWebMcpRuntime()

    if (String(document.documentElement.dataset.kgWebmcpContext || '') !== 'fallback-readable') throw new Error(`expected fallback-readable runtime state before late modelContext binding, got ${String(document.documentElement.dataset.kgWebmcpContext)}`)
    const fallbackContext = navigatorObject.modelContext as { provideContext?: unknown; registerTool?: unknown } | undefined
    if (typeof fallbackContext?.provideContext !== 'function' || typeof fallbackContext.registerTool !== 'function' || (document as Document & { modelContext?: unknown }).modelContext !== fallbackContext) throw new Error('expected WebMCP fallback to expose scanner-visible API parity on document and navigator')

    navigatorObject.modelContext = {
      registerTool(tool, options) {
        if (!options?.signal) {
          throw new Error(`expected AbortSignal-backed registerTool options for ${tool.name}`)
        }
        registeredTools.set(tool.name, tool)
      },
    }

    if (String(document.documentElement.dataset.kgWebmcpContext || '') !== 'installed') {
      throw new Error(
        `expected installed runtime state after late modelContext binding, got ${String(document.documentElement.dataset.kgWebmcpContext)}`,
      )
    }
    assertWebMcpRuntimeToolParity(Array.from(registeredTools.values()), 'runtime registerTool')
    if (document.documentElement.dataset.kgWebmcpTools !== EXPECTED_WEB_MCP_RUNTIME_CONTRACTS.map((tool) => tool.webName).join(',')) {
      throw new Error(
        `expected runtime data-kg-webmcp-tools to match shared browser contract order, got ${String(document.documentElement.dataset.kgWebmcpTools)}`,
      )
    }

    const listTool = registeredTools.get('knowgrph.list_source_files')
    const readTool = registeredTools.get('knowgrph.read_source_file')
    const readSharedTool = registeredTools.get('knowgrph.read_shared_document')
    const inspectSharedDocumentTool = registeredTools.get('knowgrph.inspect_shared_document_structure')
    const inspectLocalSettingsChatReadinessTool = registeredTools.get('knowgrph.inspect_local_settings_chat_readiness')
    const inspectLocalMainPanelTool = registeredTools.get('knowgrph.inspect_local_mainpanel_state')
    const inspectLocalEditorWorkspaceTool = registeredTools.get('knowgrph.inspect_local_editor_workspace_state')
    const inspectLocalChatPipelineTool = registeredTools.get('knowgrph.inspect_local_chat_pipeline_state')
    const inspectLocalPipelineTool = registeredTools.get('knowgrph.inspect_local_mainpanel_chat_canvas_pipeline')
    const inspectLocalDocumentTool = registeredTools.get('knowgrph.inspect_local_workspace_document')
    const inspectLocalCanvasTool = registeredTools.get('knowgrph.inspect_local_canvas_topology')
    const inspectLocalCanvasSnapshotTool = registeredTools.get('knowgrph.inspect_local_canvas_snapshot')
    const inspectLocal3dCameraPoseTool = registeredTools.get('knowgrph.inspect_local_3d_camera_pose')
    const inspectLocal3dLayoutPositionsTool = registeredTools.get('knowgrph.inspect_local_3d_layout_positions')
    const inspectLocal2dZoomViewportTool = registeredTools.get('knowgrph.inspect_local_2d_zoom_viewport')
    const inspectLocalSourceFilesSnapshotTool = registeredTools.get('knowgrph.inspect_local_source_files_snapshot')
    const inspectTool = registeredTools.get('knowgrph.inspect_agent_surface')
    if (!listTool || !readTool || !readSharedTool || !inspectSharedDocumentTool || !inspectLocalSettingsChatReadinessTool || !inspectLocalMainPanelTool || !inspectLocalEditorWorkspaceTool || !inspectLocalChatPipelineTool || !inspectLocalPipelineTool || !inspectLocalDocumentTool || !inspectLocalCanvasTool || !inspectLocalCanvasSnapshotTool || !inspectLocal3dCameraPoseTool || !inspectLocal3dLayoutPositionsTool || !inspectLocal2dZoomViewportTool || !inspectLocalSourceFilesSnapshotTool || !inspectTool) {
      throw new Error(`expected all read-only WebMCP tools to be registered, got ${Array.from(registeredTools.keys()).join(', ')}`)
    }

    const shareToken = encodePublishedDocShareToken({ canonicalPath: 'docs/shared.md' })
    const zoomViewKey = buildActive2dZoomViewKey({
      canvasRenderMode: '2d',
      canvas2dRenderer: 'd3',
      schema: previousSchema,
      graphData: MOCK_CANVAS_GRAPH_DATA as never,
      documentSemanticMode: 'document',
      frontmatterModeEnabled: true,
      multiDimTableModeEnabled: false,
      documentStructureBaselineLock: false,
      renderMediaAsNodes: false,
      mediaPanelDensity: 'default',
      collapsedGroupIds: ['lane-main'],
      designRendererWebpageLayoutKey: null,
    })
    if (!zoomViewKey) {
      throw new Error('expected a local 2d zoom view key for the runtime test fixture')
    }
    useGraphStore.setState({
      markdownDocumentName: 'workspace:/local/agent-ready.md',
      markdownDocumentText: MOCK_SHARED_DOCUMENT_MARKDOWN,
      markdownDocumentSourceUrl: '/knowgrph/share/local-only',
      graphData: MOCK_CANVAS_GRAPH_DATA as never,
      graphDataRevision: 7,
      canvasRenderMode: '2d',
      canvas2dRenderer: 'd3',
      documentSemanticMode: 'document',
      frontmatterModeEnabled: true,
      multiDimTableModeEnabled: false,
      documentStructureBaselineLock: false,
      collapsedGroupIds: ['lane-main'],
      selectedNodeId: 'start',
      selectedEdgeId: 'edge-1',
      canvas3dMode: 'xr',
      viewPinned: true,
      fitToScreenMode: false,
      zoomToSelectionMode: false,
      zoomState: { k: 0.5, x: 0, y: 0, viewportW: 320, viewportH: 180, graphDataRevision: 1 },
      zoomStateByKey: {
        [zoomViewKey]: { k: 1.75, x: 12.5, y: -6.25, viewportW: 960, viewportH: 540, graphDataRevision: 7 },
      },
      renderMediaAsNodes: false,
      mediaPanelDensity: 'default',
      schema: previousSchema,
      designRendererWebpageLayoutKey: null,
      canvasSnapshotFns: {
        '2d': {
          captureSvg: async () => MOCK_CANVAS_SVG,
          capturePng: async () => null,
        },
      },
      threeCameraSnapshotFns: {
        capturePose: () => MOCK_THREE_CAMERA_POSE,
        restorePose: () => void 0,
      },
      threeLayoutSnapshotFns: {
        capturePositions: () => MOCK_THREE_LAYOUT_POSITIONS as never,
      },
      sourceFiles: [
        {
          id: 'remote-doc',
          name: 'Remote Doc',
          text: '# Remote',
          enabled: true,
          status: 'parsed',
          parsedTextHash: 'remote-hash',
          parsedGraphRevision: 3,
          parsedGraphData: { nodes: [], edges: [], metadata: {}, type: 'application/json' } as never,
          source: { kind: 'url', url: 'https://example.com/remote.md' },
        },
        {
          id: 'workspace-doc',
          name: 'Workspace Doc',
          text: MOCK_SHARED_DOCUMENT_MARKDOWN,
          enabled: true,
          status: 'parsed',
          parsedTextHash: 'workspace-hash',
          parsedGraphRevision: 7,
          parsedGraphData: MOCK_CANVAS_GRAPH_DATA as never,
          source: { kind: 'local', path: 'workspace:/docs/agent-ready.md' },
        },
        {
          id: 'workspace-empty',
          name: 'Workspace Empty',
          text: '',
          enabled: false,
          status: 'idle',
          source: { kind: 'local', path: 'workspace:/notes/todo.md' },
        },
      ] as never,
    } as never)
    useMarkdownExplorerStore.setState({ activePath: '/docs/agent-ready.md' })
    publishLocalMainPanelSurfaceSnapshot({
      activeTab: 'mcp',
      activeTabLabel: 'MCP',
      searchable: true,
      searchOpen: true,
      searchVisible: true,
      searchQuery: 'browser api',
      searchPlaceholder: 'Search settings',
      footerLabel: 'MCP',
      traversalChip: { modeLabel: 'AgenticRAG', edgesLabel: '1 edge', nodesLabel: '2 nodes' },
      sharedActions: {
        hasApply: true,
        hasReset: true,
        hasGlobalReset: false,
        hasCollapseAll: true,
        hasExpandAll: true,
        allCollapsed: false,
      },
    })
    publishLocalSettingsChatReadinessSurfaceSnapshot({
      normalizedChatProvider: 'openai',
      chatEndpointUrl: 'https://api.openai.com/v1/chat/completions',
      chatModel: 'gpt-4.1',
      chatAuthMode: 'serverManaged',
      chatContextScope: 'workspace',
      integrationEnabled: true,
      integrationOpenTab: 'chat',
      pixverseVideoEnabled: false, pixverseVideoStrategy: 'auto', pixverseVideoTransport: 'mcp-stdio',
      isRefreshingChatModels: false,
      chatModelsStatus: 'Discovered 3 models.',
      discoveredChatModelCount: 3,
      suggestedChatModelCount: 8,
    })
    publishLocalEditorWorkspaceSurfaceSnapshot({
      activeDocumentKey: 'workspace:/local/agent-ready.md',
      workspaceViewMode: 'editor',
      workspaceCanvasPaneOpen: true,
      workspaceEditorOverlayOpen: true,
      layoutMode: 'editor',
      viewerKind: 'markdown',
      viewerMode: 'read',
      isMarkdown: true,
      isJsonMarkdownEditing: false,
      paneVisibility: { markdown: true, json: true, viewer: true, html: false, binary: false },
      splitPaneVisibility: { markdown: true, json: true, viewer: true, html: false, bin: false },
      liveMarkdownText: `${MOCK_SHARED_DOCUMENT_MARKDOWN}\nAgent-ready draft\n`,
      persistedMarkdownText: MOCK_SHARED_DOCUMENT_MARKDOWN,
      hasUncommittedDraft: true,
      liveDraftSource: 'viewer-inline',
    })
    publishLocalChatPipelineSurfaceSnapshot({
      messageCount: 3,
      isLoading: true,
      errorText: null,
      connectivity: 'ok',
      connectivityDetail: 'streaming',
      chatProviderSummary: 'OpenAI · Global · gpt-4.1',
      chatProviderHint: 'Use a reasoning-capable model',
      chatContextScope: 'workspace',
      chatStorageTarget: 'chatKnowgrph',
      chatKnowgrphWorkspacePath: '/chat/knowgrph/session.md',
      chatHistoryWorkspacePath: '/chat/history/session.md',
      workspaceViewMode: 'editor',
      editorWorkspacePane: 'markdown',
      markdownDocumentName: 'workspace:/local/agent-ready.md',
      selectedNodeId: 'start',
      streamingAssistant: {
        id: 'assistant-1',
        text: '---\nflow:\n  nodes:\n    - id: start\n      label: Start\n---\n# Agent draft',
      },
      streamingWorkspacePath: '/chat/knowgrph/session.md',
      streamFollowPath: '/chat/knowgrph/session.md',
      streamDraft: {
        path: '/chat/knowgrph/session.md',
        text: '---\nflow:\n  nodes:\n    - id: start\n      label: Start\n---\n# Draft workspace',
      },
      kgcValidation: {
        stage: 'validated',
        attempt: 2,
        maxAttempts: 3,
        failedRuleId: null,
        failedMessage: null,
        correctionPromptPreview: null,
        hasStructuredKgc: true,
        hasYamlFrontmatter: true,
        validatedKgcLength: 94,
      },
      finalize: {
        stage: 'applied',
        traceId: 'trace-123',
        modelId: 'gpt-4.1',
        finalStatus: 'ok',
        persistedKnowgrphPath: '/chat/knowgrph/session.md',
        applied: true,
        message: 'Canonical KGC workspace document was persisted and applied to the active canvas graph.',
      },
    })
    await listTool.execute()
    await readTool.execute({ canonicalPath: 'docs/example.md' })
    await readSharedTool.execute({ shareUrl: `/knowgrph/share/${shareToken}` })
    const sharedStructure = await inspectSharedDocumentTool.execute({ shareUrl: `/knowgrph/share/${shareToken}` })
    const localSettingsChatReadiness = await inspectLocalSettingsChatReadinessTool.execute()
    const localMainPanelState = await inspectLocalMainPanelTool.execute()
    const localEditorWorkspaceState = await inspectLocalEditorWorkspaceTool.execute()
    const localChatPipelineState = await inspectLocalChatPipelineTool.execute()
    const localPipelineState = await inspectLocalPipelineTool.execute()
    const localStructure = await inspectLocalDocumentTool.execute()
    const localCanvasTopology = await inspectLocalCanvasTool.execute()
    const localCanvasSnapshot = await inspectLocalCanvasSnapshotTool.execute()
    useGraphStore.setState({ canvasRenderMode: '3d' } as never)
    const localThreeCameraPose = await inspectLocal3dCameraPoseTool.execute()
    const localThreeLayoutPositions = await inspectLocal3dLayoutPositionsTool.execute()
    useGraphStore.setState({ canvasRenderMode: '2d' } as never)
    const local2dZoomViewport = await inspectLocal2dZoomViewportTool.execute()
    const localSourceFilesSnapshot = await inspectLocalSourceFilesSnapshotTool.execute()
    const inspection = await inspectTool.execute()

    if (!fetchCalls.includes('/api/storage/source-files')) {
      throw new Error(`expected localhost list_source_files to use same-origin storage path, got ${fetchCalls.join(', ')}`)
    }
    if (!fetchCalls.includes('/api/storage/doc-default/docs%2Fexample.md')) {
      throw new Error(`expected localhost read_source_file to use same-origin storage path, got ${fetchCalls.join(', ')}`)
    }
    if (!fetchCalls.includes('/api/storage/doc-default/docs%2Fshared.md')) {
      throw new Error(`expected localhost read_shared_document to reuse same-origin storage path, got ${fetchCalls.join(', ')}`)
    }
    if ((sharedStructure as { flowNodeCount?: unknown }).flowNodeCount !== 2) {
      throw new Error(`expected inspect_shared_document_structure to count flow nodes, got ${JSON.stringify(sharedStructure)}`)
    }
    if ((sharedStructure as { flowSubgraphCount?: unknown }).flowSubgraphCount !== 1) {
      throw new Error(`expected inspect_shared_document_structure to count flow subgraphs, got ${JSON.stringify(sharedStructure)}`)
    }
    if ((localStructure as { available?: unknown }).available !== true) {
      throw new Error(`expected inspect_local_workspace_document to report an available active document, got ${JSON.stringify(localStructure)}`)
    }
    if ((localStructure as { documentName?: unknown }).documentName !== 'workspace:/local/agent-ready.md') {
      throw new Error(`expected inspect_local_workspace_document to return the active document name, got ${JSON.stringify(localStructure)}`)
    }
    if ((localStructure as { flowConnectionCount?: unknown }).flowConnectionCount !== 1) {
      throw new Error(`expected inspect_local_workspace_document to reuse structure inspection counts, got ${JSON.stringify(localStructure)}`)
    }
    if ((localSettingsChatReadiness as { available?: unknown }).available !== true) {
      throw new Error(`expected inspect_local_settings_chat_readiness to report available readiness state, got ${JSON.stringify(localSettingsChatReadiness)}`)
    }
    if ((localSettingsChatReadiness as { provider?: { id?: unknown } }).provider?.id !== 'openai') {
      throw new Error(`expected inspect_local_settings_chat_readiness to report the normalized provider, got ${JSON.stringify(localSettingsChatReadiness)}`)
    }
    if ((localSettingsChatReadiness as { routing?: { integrationEnabled?: unknown } }).routing?.integrationEnabled !== true) {
      throw new Error(`expected inspect_local_settings_chat_readiness to report integration enablement, got ${JSON.stringify(localSettingsChatReadiness)}`)
    }
    if ((localSettingsChatReadiness as { modelDiscovery?: { discoveredCount?: unknown } }).modelDiscovery?.discoveredCount !== 3) {
      throw new Error(`expected inspect_local_settings_chat_readiness to report discovered model count, got ${JSON.stringify(localSettingsChatReadiness)}`)
    }
    if ((localMainPanelState as { activeTab?: unknown }).activeTab !== 'mcp') {
      throw new Error(`expected inspect_local_mainpanel_state to report the active tab, got ${JSON.stringify(localMainPanelState)}`)
    }
    if ((localMainPanelState as { search?: { query?: unknown } }).search?.query !== 'browser api') {
      throw new Error(`expected inspect_local_mainpanel_state to report the current search query, got ${JSON.stringify(localMainPanelState)}`)
    }
    if ((localEditorWorkspaceState as { layoutMode?: unknown }).layoutMode !== 'editor') {
      throw new Error(`expected inspect_local_editor_workspace_state to report editor layout mode, got ${JSON.stringify(localEditorWorkspaceState)}`)
    }
    if ((localEditorWorkspaceState as { draftState?: { hasUncommittedDraft?: unknown } }).draftState?.hasUncommittedDraft !== true) {
      throw new Error(`expected inspect_local_editor_workspace_state to report a live draft, got ${JSON.stringify(localEditorWorkspaceState)}`)
    }
    if ((localEditorWorkspaceState as { liveStructure?: { hasFrontmatter?: unknown } }).liveStructure?.hasFrontmatter !== true) {
      throw new Error(`expected inspect_local_editor_workspace_state to inspect live frontmatter structure, got ${JSON.stringify(localEditorWorkspaceState)}`)
    }
    if ((localChatPipelineState as { isLoading?: unknown }).isLoading !== true) {
      throw new Error(`expected inspect_local_chat_pipeline_state to report streaming/loading state, got ${JSON.stringify(localChatPipelineState)}`)
    }
    if ((localChatPipelineState as { streaming?: { active?: unknown } }).streaming?.active !== true) {
      throw new Error(`expected inspect_local_chat_pipeline_state to report an active streaming pipeline, got ${JSON.stringify(localChatPipelineState)}`)
    }
    if ((localChatPipelineState as { workspacePaths?: { streamingWorkspacePath?: unknown } }).workspacePaths?.streamingWorkspacePath !== '/chat/knowgrph/session.md') {
      throw new Error(`expected inspect_local_chat_pipeline_state to expose the streaming workspace path, got ${JSON.stringify(localChatPipelineState)}`)
    }
    if ((localChatPipelineState as { kgcValidation?: { stage?: unknown } }).kgcValidation?.stage !== 'validated') {
      throw new Error(`expected inspect_local_chat_pipeline_state to expose validation stage, got ${JSON.stringify(localChatPipelineState)}`)
    }
    if ((localChatPipelineState as { kgcValidation?: { hasYamlFrontmatter?: unknown } }).kgcValidation?.hasYamlFrontmatter !== true) {
      throw new Error(`expected inspect_local_chat_pipeline_state to report YAML frontmatter readiness, got ${JSON.stringify(localChatPipelineState)}`)
    }
    if ((localChatPipelineState as { finalize?: { stage?: unknown } }).finalize?.stage !== 'applied') {
      throw new Error(`expected inspect_local_chat_pipeline_state to expose finalize/apply stage, got ${JSON.stringify(localChatPipelineState)}`)
    }
    if ((localChatPipelineState as { finalize?: { persistedKnowgrphPath?: unknown } }).finalize?.persistedKnowgrphPath !== '/chat/knowgrph/session.md') {
      throw new Error(`expected inspect_local_chat_pipeline_state to expose the persisted Knowgrph path, got ${JSON.stringify(localChatPipelineState)}`)
    }
    if ((localPipelineState as { pipelineReady?: unknown }).pipelineReady !== true) {
      throw new Error(`expected inspect_local_mainpanel_chat_canvas_pipeline to report a ready E2E pipeline, got ${JSON.stringify(localPipelineState)}`)
    }
    if ((localPipelineState as { readiness?: { markdownFlowReady?: unknown } }).readiness?.markdownFlowReady !== true) {
      throw new Error(`expected inspect_local_mainpanel_chat_canvas_pipeline to report markdown/frontmatter readiness, got ${JSON.stringify(localPipelineState)}`)
    }
    if ((localPipelineState as { counts?: { canvasNodeCount?: unknown } }).counts?.canvasNodeCount !== 2) {
      throw new Error(`expected inspect_local_mainpanel_chat_canvas_pipeline to report active canvas node count, got ${JSON.stringify(localPipelineState)}`)
    }
    if (Array.isArray((localPipelineState as { issues?: unknown }).issues) && (localPipelineState as { issues?: Array<unknown> }).issues?.length !== 0) {
      throw new Error(`expected inspect_local_mainpanel_chat_canvas_pipeline to avoid readiness issues for the happy path fixture, got ${JSON.stringify(localPipelineState)}`)
    }
    if ((localCanvasTopology as { available?: unknown }).available !== true) {
      throw new Error(`expected inspect_local_canvas_topology to report an available local canvas, got ${JSON.stringify(localCanvasTopology)}`)
    }
    if ((localCanvasTopology as { graphScope?: unknown }).graphScope !== 'active-render-graph') {
      throw new Error(`expected inspect_local_canvas_topology to inspect the active render graph in document mode, got ${JSON.stringify(localCanvasTopology)}`)
    }
    if ((localCanvasTopology as { subgraphCount?: unknown }).subgraphCount !== 1) {
      throw new Error(`expected inspect_local_canvas_topology to count local subgraphs, got ${JSON.stringify(localCanvasTopology)}`)
    }
    if ((localCanvasTopology as { collapsedGroupCount?: unknown }).collapsedGroupCount !== 1) {
      throw new Error(`expected inspect_local_canvas_topology to report collapsed group count, got ${JSON.stringify(localCanvasTopology)}`)
    }
    if ((localCanvasTopology as { graphTopology?: { nodeCount?: unknown } }).graphTopology?.nodeCount !== 2) {
      throw new Error(`expected inspect_local_canvas_topology to report local node count, got ${JSON.stringify(localCanvasTopology)}`)
    }
    if ((localCanvasSnapshot as { available?: unknown }).available !== true) {
      throw new Error(`expected inspect_local_canvas_snapshot to report an available SVG snapshot, got ${JSON.stringify(localCanvasSnapshot)}`)
    }
    if ((localCanvasSnapshot as { svgLength?: unknown }).svgLength !== MOCK_CANVAS_SVG.length) {
      throw new Error(`expected inspect_local_canvas_snapshot to report SVG length, got ${JSON.stringify(localCanvasSnapshot)}`)
    }
    if ((localCanvasSnapshot as { viewBox?: unknown }).viewBox !== '0 0 640 360') {
      throw new Error(`expected inspect_local_canvas_snapshot to report SVG viewBox, got ${JSON.stringify(localCanvasSnapshot)}`)
    }
    if ((localThreeCameraPose as { available?: unknown }).available !== true) {
      throw new Error(`expected inspect_local_3d_camera_pose to report an available 3d camera pose, got ${JSON.stringify(localThreeCameraPose)}`)
    }
    if ((localThreeCameraPose as { canvas3dMode?: unknown }).canvas3dMode !== 'xr') {
      throw new Error(`expected inspect_local_3d_camera_pose to report the active 3d mode, got ${JSON.stringify(localThreeCameraPose)}`)
    }
    if ((localThreeCameraPose as { pose?: { position?: { z?: unknown } } }).pose?.position?.z !== 30) {
      throw new Error(`expected inspect_local_3d_camera_pose to report camera position, got ${JSON.stringify(localThreeCameraPose)}`)
    }
    if ((localThreeLayoutPositions as { available?: unknown }).available !== true) {
      throw new Error(`expected inspect_local_3d_layout_positions to report available positions, got ${JSON.stringify(localThreeLayoutPositions)}`)
    }
    if ((localThreeLayoutPositions as { positionCount?: unknown }).positionCount !== 3) {
      throw new Error(`expected inspect_local_3d_layout_positions to report position count, got ${JSON.stringify(localThreeLayoutPositions)}`)
    }
    if ((localThreeLayoutPositions as { selectedNodePosition?: { z?: unknown } }).selectedNodePosition?.z !== 30.988) {
      throw new Error(`expected inspect_local_3d_layout_positions to report rounded selected-node position, got ${JSON.stringify(localThreeLayoutPositions)}`)
    }
    if ((localThreeLayoutPositions as { samplePositions?: Array<{ id?: unknown }> }).samplePositions?.[0]?.id !== 'alpha') {
      throw new Error(`expected inspect_local_3d_layout_positions to sort sampled positions deterministically, got ${JSON.stringify(localThreeLayoutPositions)}`)
    }
    if ((local2dZoomViewport as { available?: unknown }).available !== true) {
      throw new Error(`expected inspect_local_2d_zoom_viewport to report available zoom state, got ${JSON.stringify(local2dZoomViewport)}`)
    }
    if ((local2dZoomViewport as { zoomViewKey?: unknown }).zoomViewKey !== zoomViewKey) {
      throw new Error(`expected inspect_local_2d_zoom_viewport to reuse the active zoom view key, got ${JSON.stringify(local2dZoomViewport)}`)
    }
    if ((local2dZoomViewport as { zoomState?: { k?: unknown } }).zoomState?.k !== 1.75) {
      throw new Error(`expected inspect_local_2d_zoom_viewport to report keyed effective zoom scale, got ${JSON.stringify(local2dZoomViewport)}`)
    }
    if ((local2dZoomViewport as { zoomState?: { viewportW?: unknown } }).zoomState?.viewportW !== 960) {
      throw new Error(`expected inspect_local_2d_zoom_viewport to report keyed viewport width, got ${JSON.stringify(local2dZoomViewport)}`)
    }
    if ((localSourceFilesSnapshot as { available?: unknown }).available !== true) {
      throw new Error(`expected inspect_local_source_files_snapshot to report an available source-files snapshot, got ${JSON.stringify(localSourceFilesSnapshot)}`)
    }
    if ((localSourceFilesSnapshot as { activePath?: unknown }).activePath !== '/docs/agent-ready.md') {
      throw new Error(`expected inspect_local_source_files_snapshot to report the active workspace path, got ${JSON.stringify(localSourceFilesSnapshot)}`)
    }
    if ((localSourceFilesSnapshot as { activeSourcePath?: unknown }).activeSourcePath !== 'workspace:/docs/agent-ready.md') {
      throw new Error(`expected inspect_local_source_files_snapshot to report the active workspace source path, got ${JSON.stringify(localSourceFilesSnapshot)}`)
    }
    if ((localSourceFilesSnapshot as { sourceFileCount?: unknown }).sourceFileCount !== 3) {
      throw new Error(`expected inspect_local_source_files_snapshot to report source file count, got ${JSON.stringify(localSourceFilesSnapshot)}`)
    }
    if ((localSourceFilesSnapshot as { workspaceBackedSourceFileCount?: unknown }).workspaceBackedSourceFileCount !== 2) {
      throw new Error(`expected inspect_local_source_files_snapshot to report workspace-backed source file count, got ${JSON.stringify(localSourceFilesSnapshot)}`)
    }
    if ((localSourceFilesSnapshot as { enabledNonWorkspaceSourceFileCount?: unknown }).enabledNonWorkspaceSourceFileCount !== 1) {
      throw new Error(`expected inspect_local_source_files_snapshot to report enabled non-workspace count, got ${JSON.stringify(localSourceFilesSnapshot)}`)
    }
    if ((localSourceFilesSnapshot as { activeSourceFile?: { name?: unknown } }).activeSourceFile?.name !== 'Workspace Doc') {
      throw new Error(`expected inspect_local_source_files_snapshot to report the active workspace source file, got ${JSON.stringify(localSourceFilesSnapshot)}`)
    }
    if ((localSourceFilesSnapshot as { sampleSourceFiles?: Array<{ id?: unknown }> }).sampleSourceFiles?.[0]?.id !== 'remote-doc') {
      throw new Error(`expected inspect_local_source_files_snapshot to preserve source file order in the sample payload, got ${JSON.stringify(localSourceFilesSnapshot)}`)
    }
    if (typeof (localSourceFilesSnapshot as { compositionSignature?: unknown }).compositionSignature !== 'string' || !String((localSourceFilesSnapshot as { compositionSignature?: unknown }).compositionSignature).trim()) {
      throw new Error(`expected inspect_local_source_files_snapshot to report a composition signature, got ${JSON.stringify(localSourceFilesSnapshot)}`)
    }
    if (!String((localSourceFilesSnapshot as { storageSyncSignature?: unknown }).storageSyncSignature || '').startsWith('remote-doc:')) {
      throw new Error(`expected inspect_local_source_files_snapshot to report the non-workspace storage sync signature, got ${JSON.stringify(localSourceFilesSnapshot)}`)
    }
    if (!fetchCalls.some((url) => url.endsWith('/knowgrph/health'))) {
      throw new Error(`expected inspect_agent_surface to fetch the agent-ready health route, got ${fetchCalls.join(', ')}`)
    }
    if (!fetchCalls.some((url) => url.endsWith('/knowgrph/.well-known/mcp/server-card.json'))) {
      throw new Error(`expected inspect_agent_surface to fetch the MCP server card, got ${fetchCalls.join(', ')}`)
    }
    const expectedInspection = buildExpectedMockAgentSurfaceInspection('http://localhost/knowgrph')
    if (JSON.stringify(inspection) !== JSON.stringify(expectedInspection)) {
      throw new Error(`expected inspect_agent_surface to return the exact shared payload, got ${JSON.stringify(inspection)}`)
    }
  } finally {
    if (typeof previousBaseUrl === 'string') process.env.VITE_KNOWGRPH_STORAGE_BASE_URL = previousBaseUrl
    else delete process.env.VITE_KNOWGRPH_STORAGE_BASE_URL
    globalThis.fetch = previousFetch
    useGraphStore.setState({
      markdownDocumentName: previousMarkdownDocumentName,
      markdownDocumentText: previousMarkdownDocumentText,
      markdownDocumentSourceUrl: previousMarkdownDocumentSourceUrl,
      graphData: previousGraphData,
      graphDataRevision: previousGraphDataRevision,
      canvasRenderMode: previousCanvasRenderMode,
      canvas2dRenderer: previousCanvas2dRenderer,
      documentSemanticMode: previousDocumentSemanticMode,
      frontmatterModeEnabled: previousFrontmatterModeEnabled,
      multiDimTableModeEnabled: previousMultiDimTableModeEnabled,
      documentStructureBaselineLock: previousDocumentStructureBaselineLock,
      collapsedGroupIds: previousCollapsedGroupIds,
      selectedNodeId: previousSelectedNodeId,
      selectedEdgeId: previousSelectedEdgeId,
      canvasSnapshotFns: previousCanvasSnapshotFns,
      threeCameraSnapshotFns: previousThreeCameraSnapshotFns,
      threeLayoutSnapshotFns: previousThreeLayoutSnapshotFns,
      canvas3dMode: previousCanvas3dMode,
      viewPinned: previousViewPinned,
      fitToScreenMode: previousFitToScreenMode,
      zoomToSelectionMode: previousZoomToSelectionMode,
      zoomState: previousZoomState,
      zoomStateByKey: previousZoomStateByKey,
      renderMediaAsNodes: previousRenderMediaAsNodes,
      mediaPanelDensity: previousMediaPanelDensity,
      schema: previousSchema,
      designRendererWebpageLayoutKey: previousDesignRendererWebpageLayoutKey,
      sourceFiles: previousSourceFiles,
    } as never)
    useMarkdownExplorerStore.setState({ activePath: previousExplorerActivePath })
    resetKnowgrphWebMcpRuntimeForTests()
    restore()
  }
}

export async function testWebMcpRuntimeProvidesContextWhenRegisterToolIsUnavailable(): Promise<void> {
  const previousBaseUrl = process.env.VITE_KNOWGRPH_STORAGE_BASE_URL
  const { restore } = initJsdomHarness()
  const providedTools: RegisteredTool[] = []

  try {
    delete process.env.VITE_KNOWGRPH_STORAGE_BASE_URL
    resetKnowgrphWebMcpRuntimeForTests()

    const navigatorObject = window.navigator as Navigator & {
      modelContext?: {
        provideContext?: (context: { tools: RegisteredTool[] }) => void
      }
    }
    try {
      delete navigatorObject.modelContext
    } catch {
      navigatorObject.modelContext = undefined
    }

    navigatorObject.modelContext = {
      provideContext(context) {
        providedTools.splice(0, providedTools.length, ...context.tools)
      },
    }

    installKnowgrphWebMcpRuntime()

    if (document.documentElement.dataset.kgWebmcpContext !== 'installed') {
      throw new Error(
        `expected installed runtime state after provideContext registration, got ${String(document.documentElement.dataset.kgWebmcpContext)}`,
      )
    }
    assertWebMcpRuntimeToolParity(providedTools, 'runtime provideContext')
    if (document.documentElement.dataset.kgWebmcpTools !== EXPECTED_WEB_MCP_RUNTIME_CONTRACTS.map((tool) => tool.webName).join(',')) {
      throw new Error(
        `expected provideContext data-kg-webmcp-tools to match shared browser contract order, got ${String(document.documentElement.dataset.kgWebmcpTools)}`,
      )
    }
  } finally {
    if (typeof previousBaseUrl === 'string') process.env.VITE_KNOWGRPH_STORAGE_BASE_URL = previousBaseUrl
    else delete process.env.VITE_KNOWGRPH_STORAGE_BASE_URL
    resetKnowgrphWebMcpRuntimeForTests()
    restore()
  }
}
