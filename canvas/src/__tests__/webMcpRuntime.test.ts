import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { encodePublishedDocShareToken } from '@/features/canvas/canvasDocShareToken.mjs'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  installKnowgrphWebMcpRuntime,
  resetKnowgrphWebMcpRuntimeForTests,
} from '@/features/agent-ready/webMcpRuntime'

type RegisteredTool = {
  name: string
  execute: (input?: Record<string, unknown>) => Promise<unknown>
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

    if (document.documentElement.dataset.kgWebmcpContext !== 'fallback-readable') {
      throw new Error(
        `expected fallback-readable runtime state before late modelContext binding, got ${String(document.documentElement.dataset.kgWebmcpContext)}`,
      )
    }

    navigatorObject.modelContext = {
      registerTool(tool, options) {
        if (!options?.signal) {
          throw new Error(`expected AbortSignal-backed registerTool options for ${tool.name}`)
        }
        registeredTools.set(tool.name, tool)
      },
    }

    if (document.documentElement.dataset.kgWebmcpContext !== 'installed') {
      throw new Error(
        `expected installed runtime state after late modelContext binding, got ${String(document.documentElement.dataset.kgWebmcpContext)}`,
      )
    }

    const listTool = registeredTools.get('knowgrph.list_source_files')
    const readTool = registeredTools.get('knowgrph.read_source_file')
    const readSharedTool = registeredTools.get('knowgrph.read_shared_document')
    const inspectSharedDocumentTool = registeredTools.get('knowgrph.inspect_shared_document_structure')
    const inspectLocalDocumentTool = registeredTools.get('knowgrph.inspect_local_workspace_document')
    const inspectLocalCanvasTool = registeredTools.get('knowgrph.inspect_local_canvas_topology')
    const inspectLocalCanvasSnapshotTool = registeredTools.get('knowgrph.inspect_local_canvas_snapshot')
    const inspectLocal3dCameraPoseTool = registeredTools.get('knowgrph.inspect_local_3d_camera_pose')
    const inspectLocal3dLayoutPositionsTool = registeredTools.get('knowgrph.inspect_local_3d_layout_positions')
    const inspectTool = registeredTools.get('knowgrph.inspect_agent_surface')
    if (!listTool || !readTool || !readSharedTool || !inspectSharedDocumentTool || !inspectLocalDocumentTool || !inspectLocalCanvasTool || !inspectLocalCanvasSnapshotTool || !inspectLocal3dCameraPoseTool || !inspectLocal3dLayoutPositionsTool || !inspectTool) {
      throw new Error(`expected all read-only WebMCP tools to be registered, got ${Array.from(registeredTools.keys()).join(', ')}`)
    }

    const shareToken = encodePublishedDocShareToken({ canonicalPath: 'docs/shared.md' })
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
    } as never)
    await listTool.execute()
    await readTool.execute({ canonicalPath: 'docs/example.md' })
    await readSharedTool.execute({ shareUrl: `/knowgrph/share/${shareToken}` })
    const sharedStructure = await inspectSharedDocumentTool.execute({ shareUrl: `/knowgrph/share/${shareToken}` })
    const localStructure = await inspectLocalDocumentTool.execute()
    const localCanvasTopology = await inspectLocalCanvasTool.execute()
    const localCanvasSnapshot = await inspectLocalCanvasSnapshotTool.execute()
    useGraphStore.setState({ canvasRenderMode: '3d' } as never)
    const localThreeCameraPose = await inspectLocal3dCameraPoseTool.execute()
    const localThreeLayoutPositions = await inspectLocal3dLayoutPositionsTool.execute()
    useGraphStore.setState({ canvasRenderMode: '2d' } as never)
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
    if (!fetchCalls.some((url) => url.endsWith('/knowgrph/health'))) {
      throw new Error(`expected inspect_agent_surface to fetch the agent-ready health route, got ${fetchCalls.join(', ')}`)
    }
    if (!fetchCalls.some((url) => url.endsWith('/knowgrph/.well-known/mcp/server-card.json'))) {
      throw new Error(`expected inspect_agent_surface to fetch the MCP server card, got ${fetchCalls.join(', ')}`)
    }
    if (String((inspection as { healthUrl?: unknown }).healthUrl || '').endsWith('/knowgrph/health') !== true) {
      throw new Error(`expected inspect_agent_surface to return the health URL, got ${JSON.stringify(inspection)}`)
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
    } as never)
    resetKnowgrphWebMcpRuntimeForTests()
    restore()
  }
}
