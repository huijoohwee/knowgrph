import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

import FlowEditorCanvas from '@/components/FlowEditorCanvas'
import { computeCollectiveFollowPinnedScale, computeWidgetScaledSize, WIDGET_BASE_SIZE } from '@/components/FlowEditor/widgetZoom'
import { applyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import { activateFirstImportedWorkspaceFile } from '@/features/markdown-workspace/useWorkspaceFileActions/importActions'
import { importWorkspaceLocalFiles } from '@/features/markdown-workspace/workspaceImport'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { useGraphStore } from '@/hooks/useGraphStore'
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { LS_KEYS } from '@/lib/config'
import { buildFlowWidgetEligibleNodeIdSet } from '@/lib/graph/flowWidgetEligibility'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import { KNOWGRPH_VIDEO_DEMO_BASENAME, readDocsSsotFixtureText } from '@/tests/lib/docsSsotFixture'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'

type NonFlowEditorRenderer = 'd3' | 'flowchart' | 'flow' | 'design'

const ALL_NON_FLOW_EDITOR_RENDERERS: NonFlowEditorRenderer[] = ['d3', 'flowchart', 'flow', 'design']
const PRIOR_WIDGET_BY_RENDERER: Record<NonFlowEditorRenderer, string> = {
  d3: 'prior-d3',
  flowchart: 'prior-flowchart',
  flow: 'prior-flow',
  design: 'prior-design',
}

const createFile = (name: string, text: string) => {
  const blob = new Blob([text], { type: 'text/plain' })
  return new File([blob], name, { type: 'text/plain' })
}

const readScopedWidgetIds = (ids: unknown[] | null | undefined): string[] => {
  return Array.isArray(ids) ? ids.map(id => String(id || '').trim()).filter(Boolean) : []
}

const buildPriorWidgetIdSet = (renderers: NonFlowEditorRenderer[]): Set<string> => {
  return new Set(renderers.map(renderer => PRIOR_WIDGET_BY_RENDERER[renderer]))
}

function assertRendererScopedSeeds(renderers: NonFlowEditorRenderer[]) {
  const seededByRenderer = useGraphStore.getState().openWidgetNodeIdsByRenderer || {}
  for (const renderer of renderers) {
    const expectedNodeId = PRIOR_WIDGET_BY_RENDERER[renderer]
    const seeded = readScopedWidgetIds(seededByRenderer[renderer])
    if (seeded.length !== 1 || seeded[0] !== expectedNodeId) {
      throw new Error(`expected prior ${renderer} widget state to stay renderer-scoped before import, got ${JSON.stringify(seeded)}`)
    }
  }
}

function assertNoWidgetSeepage(args: {
  priorWidgetIds: Set<string>
  activeWidgetIds?: unknown[] | null
  flowEditorWidgetIds?: unknown[] | null
  context: string
}) {
  const activeWidgetIds = readScopedWidgetIds(args.activeWidgetIds)
  if (activeWidgetIds.some(id => args.priorWidgetIds.has(id))) {
    throw new Error(`expected ${args.context} active Flow Editor widget state to reject non-flow-editor seepage, got ${JSON.stringify(activeWidgetIds)}`)
  }
  const flowEditorWidgetIds = readScopedWidgetIds(args.flowEditorWidgetIds)
  if (flowEditorWidgetIds.some(id => args.priorWidgetIds.has(id))) {
    throw new Error(`expected ${args.context} flowEditor-scoped widget state to stay isolated from d3/flowchart/flow/design, got ${JSON.stringify(flowEditorWidgetIds)}`)
  }
}

async function runVideoDemoRuntimeLandingRendererIsolation(args?: {
  seedRenderers?: NonFlowEditorRenderer[]
}) {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) => setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame = anyWindow.requestAnimationFrame

    resetWorkspaceFsForTests()
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const store = useGraphStore.getState()
    const explorer = useMarkdownExplorerStore.getState()
    store.resetAll()
    store.setDocumentStructureBaselineLock(false)
    store.setCanvasRenderMode('2d')
    store.setDocumentSemanticMode('keyword')
    store.setFrontmatterModeEnabled(false)
    store.setGraphData({
      type: 'Graph',
      context: 'renderer-isolation-seed',
      nodes: [
        { id: 'prior-d3', type: 'Node', label: 'Prior D3', properties: {}, x: 0, y: 0, vx: 0, vy: 0 },
        { id: 'prior-flowchart', type: 'Node', label: 'Prior Flowchart', properties: {}, x: 1, y: 0, vx: 0, vy: 0 },
        { id: 'prior-flow', type: 'Node', label: 'Prior Flow', properties: {}, x: 2, y: 0, vx: 0, vy: 0 },
        { id: 'prior-design', type: 'Node', label: 'Prior Design', properties: {}, x: 3, y: 0, vx: 0, vy: 0 },
      ],
      edges: [],
    } as never)

    const seedRenderers = Array.isArray(args?.seedRenderers) && args.seedRenderers.length > 0
      ? args.seedRenderers
      : ALL_NON_FLOW_EDITOR_RENDERERS
    for (const renderer of seedRenderers) {
      const nodeId = PRIOR_WIDGET_BY_RENDERER[renderer]
      store.setCanvas2dRenderer(renderer)
      store.setOpenWidgetNodeIds([nodeId])
    }

    assertRendererScopedSeeds(seedRenderers)

    const videoText = readDocsSsotFixtureText(KNOWGRPH_VIDEO_DEMO_BASENAME)
    const videoImport = await importWorkspaceLocalFiles({
      fs,
      files: [createFile(KNOWGRPH_VIDEO_DEMO_BASENAME, videoText)],
      parentPath: '/',
    })
    const importedVideoPath = String(videoImport.createdPaths[0] || '').trim()
    if (!importedVideoPath) throw new Error('expected imported video path')

    explorer.setActivePath('/README.md')
    await activateFirstImportedWorkspaceFile({ fs, createdPaths: videoImport.createdPaths, applyToGraph: true })

    const afterImport = useGraphStore.getState()
    if (useMarkdownExplorerStore.getState().activePath !== importedVideoPath) {
      throw new Error(`expected import activation to focus imported video doc, got ${String(useMarkdownExplorerStore.getState().activePath || '')}`)
    }
    if (afterImport.canvasRenderMode !== '2d') {
      throw new Error(`expected video import to preserve 2d render mode, got ${String(afterImport.canvasRenderMode || '')}`)
    }
    if (afterImport.canvas2dRenderer !== 'flowEditor') {
      throw new Error(`expected video import to land on flowEditor, got ${String(afterImport.canvas2dRenderer || '')}`)
    }
    if (afterImport.documentSemanticMode !== 'document') {
      throw new Error(`expected video import to enable document mode, got ${String(afterImport.documentSemanticMode || '')}`)
    }
    if (afterImport.frontmatterModeEnabled !== true) {
      throw new Error('expected video import to enable frontmatter mode')
    }

    const priorWidgetIds = buildPriorWidgetIdSet(seedRenderers)
    assertNoWidgetSeepage({
      priorWidgetIds,
      activeWidgetIds: afterImport.openWidgetNodeIds,
      flowEditorWidgetIds: (afterImport.openWidgetNodeIdsByRenderer || {}).flowEditor,
      context: 'imported',
    })
    const importedLayoutCache = afterImport.layoutPositionCacheByMode || {}
    const importedLayoutKeys = Object.keys(importedLayoutCache)
    const foreignRendererLayoutKeys = importedLayoutKeys.filter(key => /:2d:(d3|flowchart|flow|design)(:|$)/.test(key))
    if (foreignRendererLayoutKeys.length > 0) {
      throw new Error(`expected imported Flow Editor landing to avoid seeding foreign 2D renderer layout cache keys, got ${JSON.stringify(foreignRendererLayoutKeys)}`)
    }

    const importedNodes = Array.isArray(afterImport.graphData?.nodes) ? afterImport.graphData.nodes : []
    const eligibleWidgetIds = Array.from(buildFlowWidgetEligibleNodeIdSet(importedNodes as never)).map(id => String(id || '').trim()).filter(Boolean)
    if (eligibleWidgetIds.length === 0) {
      throw new Error('expected imported knowgrph-video-demo graph to expose Flow Editor widget-eligible nodes')
    }

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'runtime-root'
    doc.body.appendChild(container)
    await act(async () => {
      root = createRoot(container as unknown as HTMLElement)
      root.render(React.createElement(FlowEditorCanvas, { active: true } as never))
      await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
    })

    const waitForFlowEditorOverlaySeed = async () => {
      const deadline = Date.now() + 1500
      while (Date.now() < deadline) {
        const state = useGraphStore.getState() as unknown as {
          canvas2dRenderer?: string
          openWidgetNodeIds?: string[]
          openWidgetNodeIdsByRenderer?: Partial<Record<string, string[]>>
          flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>
        }
        if (String(state.canvas2dRenderer || '') !== 'flowEditor') {
          throw new Error(`expected mounted runtime to stay on flowEditor, got ${String(state.canvas2dRenderer || '')}`)
        }
        assertNoWidgetSeepage({
          priorWidgetIds,
          activeWidgetIds: state.openWidgetNodeIds,
          flowEditorWidgetIds: state.openWidgetNodeIdsByRenderer?.flowEditor,
          context: 'mounted runtime',
        })
        const worldById = state.flowWidgetWorldPosByNodeId || {}
        const seededEligibleIds = eligibleWidgetIds.filter(id => {
          const pos = worldById[id]
          return !!pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)
        })
        if (seededEligibleIds.length > 0) return seededEligibleIds
        await new Promise<void>(resolveWait => setTimeout(resolveWait, 5))
      }
      throw new Error('expected mounted Flow Editor runtime to seed imported video-demo widget overlay world positions')
    }

    const seededEligibleIds = await waitForFlowEditorOverlaySeed()
    if (seededEligibleIds.some(id => priorWidgetIds.has(id))) {
      throw new Error(`expected seeded Flow Editor overlay ids to belong to imported video-demo widgets only, got ${JSON.stringify(seededEligibleIds)}`)
    }
  } finally {
    try {
      await act(async () => {
        root?.unmount()
        await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
      })
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testVideoDemoRuntimeLandingRejectsRendererWidgetSeepage() {
  await runVideoDemoRuntimeLandingRendererIsolation()
}

export async function testVideoDemoRuntimeLandingRejectsFlowchartWidgetSeepage() {
  await runVideoDemoRuntimeLandingRendererIsolation({ seedRenderers: ['flowchart'] })
}

export async function testVideoDemoRuntimeLandingRejectsFlowWidgetSeepage() {
  await runVideoDemoRuntimeLandingRendererIsolation({ seedRenderers: ['flow'] })
}

function readFirstNodeIdByType(nodes: unknown[], nodeType: string): string {
  const target = String(nodeType || '').trim()
  const match = nodes.find(node => String((node as { type?: unknown })?.type || '').trim() === target) as
    | { id?: unknown }
    | undefined
  return String(match?.id || '').trim()
}

function findWidgetOverlayById(doc: Document, nodeId: string): HTMLElement | null {
  const all = Array.from(doc.querySelectorAll<HTMLElement>('[data-kg-widget]'))
  return all.find(el => String(el.getAttribute('data-kg-widget') || '').trim() === nodeId) || null
}

export async function testVideoDemoRuntimeWidgetUiVisibleInHideFieldsMode() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) => setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame = anyWindow.requestAnimationFrame

    resetWorkspaceFsForTests()
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const store = useGraphStore.getState()
    const explorer = useMarkdownExplorerStore.getState()
    store.resetAll()
    store.setDocumentStructureBaselineLock(false)
    store.setCanvasRenderMode('2d')
    store.setCanvas2dRenderer('flowEditor')
    store.setDocumentSemanticMode('document')
    store.setFrontmatterModeEnabled(true)

    dom.window.localStorage.setItem(LS_KEYS.flowWidgetHideFields, '1')

    const videoText = readDocsSsotFixtureText(KNOWGRPH_VIDEO_DEMO_BASENAME)
    const videoImport = await importWorkspaceLocalFiles({
      fs,
      files: [createFile(KNOWGRPH_VIDEO_DEMO_BASENAME, videoText)],
      parentPath: '/',
    })
    const importedVideoPath = String(videoImport.createdPaths[0] || '').trim()
    if (!importedVideoPath) throw new Error('expected imported video-demo workspace path')
    explorer.setActivePath('/README.md')
    await activateFirstImportedWorkspaceFile({ fs, createdPaths: videoImport.createdPaths, applyToGraph: true })

    const afterImport = useGraphStore.getState()
    if (afterImport.canvas2dRenderer !== 'flowEditor') {
      throw new Error(`expected video-demo runtime validation to land on flowEditor, got ${String(afterImport.canvas2dRenderer || '')}`)
    }
    const nodes = Array.isArray(afterImport.graphData?.nodes) ? afterImport.graphData.nodes : []
    const textWidgetId = readFirstNodeIdByType(nodes, 'TextGeneration')
    const imageWidgetId = readFirstNodeIdByType(nodes, 'ImageGeneration')
    const videoWidgetId = readFirstNodeIdByType(nodes, 'VideoGeneration')
    const richMediaWidgetId = readFirstNodeIdByType(nodes, 'RichMediaPanel')
    if (!textWidgetId || !imageWidgetId || !videoWidgetId || !richMediaWidgetId) {
      throw new Error('expected knowgrph-video-demo to contain Text/Image/Video/RichMedia widget node types for runtime visibility validation')
    }
    const selectedIds = new Set([textWidgetId, imageWidgetId, videoWidgetId, richMediaWidgetId])
    const incidentEdgeCount = (Array.isArray(afterImport.graphData?.edges) ? afterImport.graphData.edges : []).filter(edge => {
      const { src, tgt } = readGraphEdgeEndpoints(edge)
      return selectedIds.has(src) || selectedIds.has(tgt)
    }).length
    if (incidentEdgeCount < 1) {
      throw new Error('expected knowgrph-video-demo widget visibility validation to include at least one edge linked to Text/Image/Video/RichMedia runtime widgets')
    }

    store.setOpenWidgetNodeIds([textWidgetId, imageWidgetId, videoWidgetId, richMediaWidgetId])

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'runtime-root-widget-visibility'
    doc.body.appendChild(container)

    await act(async () => {
      root = createRoot(container as unknown as HTMLElement)
      root.render(React.createElement(FlowEditorCanvas, { active: true } as never))
      await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
    })

    const waitForWidgetUiVisibility = async () => {
      const deadline = Date.now() + 2200
      let lastSnapshot = ''
      while (Date.now() < deadline) {
        const textOverlay = findWidgetOverlayById(doc, textWidgetId)
        const imageOverlay = findWidgetOverlayById(doc, imageWidgetId)
        const videoOverlay = findWidgetOverlayById(doc, videoWidgetId)
        const richOverlay = findWidgetOverlayById(doc, richMediaWidgetId)
        const overlaysReady = !!(textOverlay && imageOverlay && videoOverlay && richOverlay)
        const richKtvVisible = !!(
          richOverlay &&
          String(richOverlay.textContent || '').includes('Key') &&
          String(richOverlay.textContent || '').includes('Type') &&
          String(richOverlay.textContent || '').includes('Value')
        )
        const richPortHandles = richOverlay
          ? richOverlay.querySelectorAll('button[data-kg-port-handle="1"]').length
          : 0
        const typedWidgetPortHandles = [textOverlay, imageOverlay, videoOverlay]
          .filter(Boolean)
          .reduce(
            (count, overlay) => count + (overlay as HTMLElement).querySelectorAll('button[data-kg-port-handle="1"]').length,
            0,
          )
        const overlayEdgePaths = doc.querySelectorAll('[data-kg-overlay-edge-id]').length
        const canvasEdgePaths = doc.querySelectorAll('path.kg-edge-path[data-edge-id]').length
        const edgePaths = overlayEdgePaths + canvasEdgePaths
        const edgeSurfacePresent = !!doc.querySelector('svg.absolute.inset-0.pointer-events-none')
        const mountedIds = (Array.from(doc.querySelectorAll('[data-kg-widget]')) as HTMLElement[]).map(el =>
          String(el.getAttribute('data-kg-widget') || '').trim(),
        )
        lastSnapshot = JSON.stringify({
          overlaysReady,
          richKtvVisible,
          richPortHandles,
          typedWidgetPortHandles,
          overlayEdgePaths,
          canvasEdgePaths,
          edgePaths,
          edgeSurfacePresent,
          incidentEdgeCount,
          mountedIds,
        })
        if (
          overlaysReady &&
          richKtvVisible &&
          richPortHandles >= 2 &&
          typedWidgetPortHandles >= 6 &&
          edgeSurfacePresent &&
          incidentEdgeCount >= 1
        ) {
          return
        }
        await new Promise<void>(resolveWait => setTimeout(resolveWait, 12))
      }
      throw new Error(
        `expected knowgrph-video-demo Flow Editor runtime to keep Text/Image/Video widget UI, Rich Media KTV rows, and port handles visible with mounted edge surface + linked edge contracts in hide-fields mode; snapshot=${lastSnapshot}`,
      )
    }

    await waitForWidgetUiVisibility()
  } finally {
    try {
      await act(async () => {
        root?.unmount()
        await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
      })
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testVideoDemoRuntimeCollectiveBalancedFit1920x1080Viewport() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  const targetViewport = { width: 1920, height: 1080 }
  let restoreElementRect: (() => void) | null = null

  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
      dispatchEvent?: (event: Event) => boolean
    }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) => setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame = anyWindow.requestAnimationFrame
    const elementProto = dom.window.HTMLElement.prototype
    const originalElementRect = elementProto.getBoundingClientRect
    elementProto.getBoundingClientRect = function patchedGetBoundingClientRect(this: HTMLElement): DOMRect {
      const shouldForceViewportRect =
        this.matches('[data-kg-canvas-viewport-root="1"]')
        || this.matches('[data-kg-flow-editor-surface-root]')
      if (!shouldForceViewportRect) return originalElementRect.call(this) as DOMRect
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: targetViewport.width,
        height: targetViewport.height,
        right: targetViewport.width,
        bottom: targetViewport.height,
        toJSON: () => ({}),
      } as DOMRect
    }
    restoreElementRect = () => {
      elementProto.getBoundingClientRect = originalElementRect
    }

    resetWorkspaceFsForTests()
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const store = useGraphStore.getState()
    const explorer = useMarkdownExplorerStore.getState()
    store.resetAll()
    store.setDocumentStructureBaselineLock(false)
    store.setCanvasRenderMode('2d')
    store.setCanvas2dRenderer('flowEditor')
    store.setDocumentSemanticMode('document')
    store.setFrontmatterModeEnabled(true)

    const videoText = readDocsSsotFixtureText(KNOWGRPH_VIDEO_DEMO_BASENAME)
    const videoImport = await importWorkspaceLocalFiles({
      fs,
      files: [createFile(KNOWGRPH_VIDEO_DEMO_BASENAME, videoText)],
      parentPath: '/',
    })
    explorer.setActivePath('/README.md')
    await activateFirstImportedWorkspaceFile({ fs, createdPaths: videoImport.createdPaths, applyToGraph: true })

    const postImport = useGraphStore.getState()
    if (postImport.canvas2dRenderer !== 'flowEditor') {
      throw new Error(`expected video-demo collective fit validation to land on flowEditor, got ${String(postImport.canvas2dRenderer || '')}`)
    }
    const graphNodes = Array.isArray(postImport.graphData?.nodes) ? postImport.graphData.nodes : []
    const eligibleWidgetIds = Array.from(buildFlowWidgetEligibleNodeIdSet(graphNodes as never))
      .map(id => String(id || '').trim())
      .filter(Boolean)
    if (eligibleWidgetIds.length < 4) {
      throw new Error(`expected video-demo collective fit validation to include at least 4 widget-eligible nodes, got ${eligibleWidgetIds.length}`)
    }
    store.setOpenWidgetNodeIds(eligibleWidgetIds)
    store.setFlowWidgetWorldPosByNodeId({})

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.setAttribute('data-kg-canvas-viewport-root', '1')
    container.id = 'runtime-root-balanced-1920x1080'
    doc.body.appendChild(container)

    await act(async () => {
      root = createRoot(container as unknown as HTMLElement)
      root.render(React.createElement(FlowEditorCanvas, { active: true } as never))
      await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
    })

    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerWidth = targetViewport.width
    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerHeight = targetViewport.height
    await act(async () => {
      dom.window.dispatchEvent(new dom.window.Event('resize'))
      await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
    })

    const waitForBalancedFit = async () => {
      const deadline = Date.now() + 2500
      let lastSnapshot = ''
      while (Date.now() < deadline) {
        const state = useGraphStore.getState() as unknown as {
          flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>
          zoomState?: { k?: number; x?: number; y?: number }
          zoomStateByKey?: Record<string, { k?: number; x?: number; y?: number }>
          graphData?: { nodes?: Array<{ x?: number; y?: number }> }
        }
        const worldById = state.flowWidgetWorldPosByNodeId || {}
        const seededIds = eligibleWidgetIds.filter(id => {
          const pos = worldById[id]
          return !!pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)
        })
        const zoomK = Number.isFinite(state.zoomState?.k) ? Math.max(0.001, Number(state.zoomState?.k)) : 1
        const zoomX = Number.isFinite(state.zoomState?.x) ? Number(state.zoomState?.x) : 0
        const zoomY = Number.isFinite(state.zoomState?.y) ? Number(state.zoomState?.y) : 0
        const keyedZoomValues = Object.values(state.zoomStateByKey || {})
        const keyedZoom = keyedZoomValues[0] || {}
        const keyedZoomX = Number.isFinite(keyedZoom.x) ? Number(keyedZoom.x) : 0
        const keyedZoomY = Number.isFinite(keyedZoom.y) ? Number(keyedZoom.y) : 0
        const keyedZoomK = Number.isFinite(keyedZoom.k) ? Math.max(0.001, Number(keyedZoom.k)) : 1
        const graphNodes = Array.isArray(state.graphData?.nodes) ? state.graphData.nodes : []
        let graphMinX = Number.POSITIVE_INFINITY
        let graphMaxX = Number.NEGATIVE_INFINITY
        let graphMinY = Number.POSITIVE_INFINITY
        let graphMaxY = Number.NEGATIVE_INFINITY
        let graphMeasured = 0
        for (let i = 0; i < graphNodes.length; i += 1) {
          const node = graphNodes[i]
          const x = typeof node?.x === 'number' && Number.isFinite(node.x) ? node.x : null
          const y = typeof node?.y === 'number' && Number.isFinite(node.y) ? node.y : null
          if (x == null || y == null) continue
          graphMeasured += 1
          graphMinX = Math.min(graphMinX, x)
          graphMaxX = Math.max(graphMaxX, x)
          graphMinY = Math.min(graphMinY, y)
          graphMaxY = Math.max(graphMaxY, y)
        }
        if (seededIds.length > 0) {
          const panelScale = computeCollectiveFollowPinnedScale({
            zoomK,
            viewportW: targetViewport.width,
            viewportH: targetViewport.height,
            count: seededIds.length,
            baseWidth: WIDGET_BASE_SIZE.width,
            baseHeight: WIDGET_BASE_SIZE.height,
          })
          const panelScreen = computeWidgetScaledSize(panelScale)
          const panelWorldW = panelScreen.width / zoomK
          const panelWorldH = panelScreen.height / zoomK
          let minLeft = Number.POSITIVE_INFINITY
          let minTop = Number.POSITIVE_INFINITY
          let maxRight = Number.NEGATIVE_INFINITY
          let maxBottom = Number.NEGATIVE_INFINITY
          let centroidX = 0
          let centroidY = 0
          for (let i = 0; i < seededIds.length; i += 1) {
            const id = seededIds[i]!
            const world = worldById[id]!
            const left = world.x * zoomK + zoomX
            const top = world.y * zoomK + zoomY
            const right = (world.x + panelWorldW) * zoomK + zoomX
            const bottom = (world.y + panelWorldH) * zoomK + zoomY
            minLeft = Math.min(minLeft, left)
            minTop = Math.min(minTop, top)
            maxRight = Math.max(maxRight, right)
            maxBottom = Math.max(maxBottom, bottom)
            centroidX += left + panelScreen.width / 2
            centroidY += top + panelScreen.height / 2
          }
          centroidX /= seededIds.length
          centroidY /= seededIds.length
          const fitsViewport =
            minLeft >= -1 &&
            minTop >= -1 &&
            maxRight <= targetViewport.width + 1 &&
            maxBottom <= targetViewport.height + 1
          const centroidNearViewportCenter =
            Math.abs(centroidX - targetViewport.width / 2) <= 6 &&
            Math.abs(centroidY - targetViewport.height / 2) <= 6
          lastSnapshot = JSON.stringify({
            seededCount: seededIds.length,
            zoomK,
            zoomX,
            zoomY,
            bounds: { minLeft, minTop, maxRight, maxBottom },
            centroid: { x: centroidX, y: centroidY },
          })
          if (fitsViewport && centroidNearViewportCenter) return
        }
        await new Promise<void>(resolveWait => setTimeout(resolveWait, 12))
      }
      throw new Error(
        `expected collective Flow Editor widget layout to fit 1920x1080 viewport with centroid centered; snapshot=${lastSnapshot}`,
      )
    }

    await waitForBalancedFit()
  } finally {
    try {
      restoreElementRect?.()
    } catch {
      void 0
    }
    try {
      await act(async () => {
        root?.unmount()
        await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
      })
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testVideoDemoSourceFilesRuntimeCollectiveBalancedFit1920x1080Viewport() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  const targetViewport = { width: 1920, height: 1080 }
  let restoreElementRect: (() => void) | null = null

  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
      dispatchEvent?: (event: Event) => boolean
    }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) => setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame = anyWindow.requestAnimationFrame
    const elementProto = dom.window.HTMLElement.prototype
    const originalElementRect = elementProto.getBoundingClientRect
    elementProto.getBoundingClientRect = function patchedGetBoundingClientRect(this: HTMLElement): DOMRect {
      const shouldForceViewportRect =
        this.matches('[data-kg-canvas-viewport-root="1"]')
        || this.matches('[data-kg-flow-editor-surface-root]')
      if (!shouldForceViewportRect) return originalElementRect.call(this) as DOMRect
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: targetViewport.width,
        height: targetViewport.height,
        right: targetViewport.width,
        bottom: targetViewport.height,
        toJSON: () => ({}),
      } as DOMRect
    }
    restoreElementRect = () => {
      elementProto.getBoundingClientRect = originalElementRect
    }

    const store = useGraphStore.getState()
    const explorer = useMarkdownExplorerStore.getState()
    store.resetAll()
    store.setDocumentStructureBaselineLock(false)
    store.setCanvasRenderMode('2d')
    store.setCanvas2dRenderer('d3')
    store.setDocumentSemanticMode('keyword')
    store.setFrontmatterModeEnabled(false)

    const sourcePath = '/docs/knowgrph-video-demo.md'
    const sourceText = readDocsSsotFixtureText(KNOWGRPH_VIDEO_DEMO_BASENAME)
    const parsed = await loadGraphDataFromTextViaParser(sourcePath, sourceText, { applyToStore: false, syncMarkdownDocument: false })
    const parsedGraphData = parsed?.graphData
    if (!parsedGraphData) {
      throw new Error('expected source-files knowgrph-video-demo parse to produce graph data')
    }

    store.setSourceFiles([{
      id: 'sf-video',
      name: KNOWGRPH_VIDEO_DEMO_BASENAME,
      text: sourceText,
      enabled: true,
      status: 'parsed',
      parsedTextHash: 'video-demo-source-files-h1',
      parsedGraphRevision: 1,
      parsedGraphData,
      source: { kind: 'local', path: sourcePath },
    }])
    explorer.setActivePath(sourcePath)
    store.setMarkdownDocument(sourcePath, sourceText)
    applyComposedGraphFromSourceFiles()

    const postCompose = useGraphStore.getState()
    if (postCompose.canvas2dRenderer !== 'flowEditor') {
      throw new Error(`expected source-files video-demo landing to use flowEditor renderer, got ${String(postCompose.canvas2dRenderer || '')}`)
    }
    if (postCompose.documentSemanticMode !== 'document') {
      throw new Error(`expected source-files video-demo landing to force document semantic mode, got ${String(postCompose.documentSemanticMode || '')}`)
    }
    if (postCompose.frontmatterModeEnabled !== true) {
      throw new Error('expected source-files video-demo landing to enable frontmatter mode')
    }

    const graphNodes = Array.isArray(postCompose.graphData?.nodes) ? postCompose.graphData.nodes : []
    const eligibleWidgetIds = Array.from(buildFlowWidgetEligibleNodeIdSet(graphNodes as never))
      .map(id => String(id || '').trim())
      .filter(Boolean)
    if (eligibleWidgetIds.length < 4) {
      throw new Error(`expected source-files video-demo collective fit validation to include at least 4 widget-eligible nodes, got ${eligibleWidgetIds.length}`)
    }
    store.setOpenWidgetNodeIds(eligibleWidgetIds)
    store.setFlowWidgetWorldPosByNodeId({})

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.setAttribute('data-kg-canvas-viewport-root', '1')
    container.id = 'runtime-root-source-files-balanced-1920x1080'
    doc.body.appendChild(container)

    await act(async () => {
      root = createRoot(container as unknown as HTMLElement)
      root.render(React.createElement(FlowEditorCanvas, { active: true } as never))
      await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
    })

    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerWidth = targetViewport.width
    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerHeight = targetViewport.height
    await act(async () => {
      dom.window.dispatchEvent(new dom.window.Event('resize'))
      await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
    })

    const waitForBalancedFit = async () => {
      const deadline = Date.now() + 2500
      let lastSnapshot = ''
      while (Date.now() < deadline) {
        const state = useGraphStore.getState() as unknown as {
          flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>
          zoomState?: { k?: number; x?: number; y?: number }
          zoomStateByKey?: Record<string, { k?: number; x?: number; y?: number }>
        }
        const worldById = state.flowWidgetWorldPosByNodeId || {}
        const seededIds = eligibleWidgetIds.filter(id => {
          const pos = worldById[id]
          return !!pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)
        })
        const zoomK = Number.isFinite(state.zoomState?.k) ? Math.max(0.001, Number(state.zoomState?.k)) : 1
        const zoomX = Number.isFinite(state.zoomState?.x) ? Number(state.zoomState?.x) : 0
        const zoomY = Number.isFinite(state.zoomState?.y) ? Number(state.zoomState?.y) : 0
        const keyedZoomValues = Object.values(state.zoomStateByKey || {})
        const keyedZoom = keyedZoomValues[0] || {}
        const keyedZoomX = Number.isFinite(keyedZoom.x) ? Number(keyedZoom.x) : 0
        const keyedZoomY = Number.isFinite(keyedZoom.y) ? Number(keyedZoom.y) : 0
        const keyedZoomK = Number.isFinite(keyedZoom.k) ? Math.max(0.001, Number(keyedZoom.k)) : 1
        if (seededIds.length > 0) {
          const panelScale = computeCollectiveFollowPinnedScale({
            zoomK,
            viewportW: targetViewport.width,
            viewportH: targetViewport.height,
            count: seededIds.length,
            baseWidth: WIDGET_BASE_SIZE.width,
            baseHeight: WIDGET_BASE_SIZE.height,
          })
          const panelScreen = computeWidgetScaledSize(panelScale)
          const panelWorldW = panelScreen.width / zoomK
          const panelWorldH = panelScreen.height / zoomK
          let minLeft = Number.POSITIVE_INFINITY
          let minTop = Number.POSITIVE_INFINITY
          let maxRight = Number.NEGATIVE_INFINITY
          let maxBottom = Number.NEGATIVE_INFINITY
          let centroidX = 0
          let centroidY = 0
          for (let i = 0; i < seededIds.length; i += 1) {
            const id = seededIds[i]!
            const world = worldById[id]!
            const left = world.x * zoomK + zoomX
            const top = world.y * zoomK + zoomY
            const right = (world.x + panelWorldW) * zoomK + zoomX
            const bottom = (world.y + panelWorldH) * zoomK + zoomY
            minLeft = Math.min(minLeft, left)
            minTop = Math.min(minTop, top)
            maxRight = Math.max(maxRight, right)
            maxBottom = Math.max(maxBottom, bottom)
            centroidX += left + panelScreen.width / 2
            centroidY += top + panelScreen.height / 2
          }
          centroidX /= seededIds.length
          centroidY /= seededIds.length
          const fitsViewport =
            minLeft >= -1 &&
            minTop >= -1 &&
            maxRight <= targetViewport.width + 1 &&
            maxBottom <= targetViewport.height + 1
          const centroidNearViewportCenter =
            Math.abs(centroidX - targetViewport.width / 2) <= 6 &&
            Math.abs(centroidY - targetViewport.height / 2) <= 6
          lastSnapshot = JSON.stringify({
            seededCount: seededIds.length,
            zoomK,
            zoomX,
            zoomY,
            bounds: { minLeft, minTop, maxRight, maxBottom },
            centroid: { x: centroidX, y: centroidY },
          })
          if (fitsViewport && centroidNearViewportCenter) return
        }
        await new Promise<void>(resolveWait => setTimeout(resolveWait, 12))
      }
      throw new Error(
        `expected source-files Flow Editor collective widget layout to fit 1920x1080 viewport with centroid centered; snapshot=${lastSnapshot}`,
      )
    }

    await waitForBalancedFit()
  } finally {
    try {
      restoreElementRect?.()
    } catch {
      void 0
    }
    try {
      await act(async () => {
        root?.unmount()
        await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
      })
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testVideoDemoSourceFilesRuntimeOpenCloseReopenStaysInView1920x1080Viewport() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  const targetViewport = { width: 1920, height: 1080 }
  let restoreElementRect: (() => void) | null = null

  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
      dispatchEvent?: (event: Event) => boolean
    }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) => setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame = anyWindow.requestAnimationFrame
    const elementProto = dom.window.HTMLElement.prototype
    const originalElementRect = elementProto.getBoundingClientRect
    elementProto.getBoundingClientRect = function patchedGetBoundingClientRect(this: HTMLElement): DOMRect {
      const shouldForceViewportRect =
        this.matches('[data-kg-canvas-viewport-root="1"]')
        || this.matches('[data-kg-flow-editor-surface-root]')
      if (!shouldForceViewportRect) return originalElementRect.call(this) as DOMRect
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: targetViewport.width,
        height: targetViewport.height,
        right: targetViewport.width,
        bottom: targetViewport.height,
        toJSON: () => ({}),
      } as DOMRect
    }
    restoreElementRect = () => {
      elementProto.getBoundingClientRect = originalElementRect
    }

    const store = useGraphStore.getState()
    const explorer = useMarkdownExplorerStore.getState()
    store.resetAll()
    store.setDocumentStructureBaselineLock(false)
    store.setCanvasRenderMode('2d')
    store.setCanvas2dRenderer('d3')
    store.setDocumentSemanticMode('keyword')
    store.setFrontmatterModeEnabled(false)

    const sourcePath = '/docs/knowgrph-video-demo.md'
    const sourceText = readDocsSsotFixtureText(KNOWGRPH_VIDEO_DEMO_BASENAME)
    const parsed = await loadGraphDataFromTextViaParser(sourcePath, sourceText, { applyToStore: false, syncMarkdownDocument: false })
    const parsedGraphData = parsed?.graphData
    if (!parsedGraphData) {
      throw new Error('expected source-files knowgrph-video-demo parse to produce graph data')
    }

    store.setSourceFiles([{
      id: 'sf-video-open-close-reopen',
      name: KNOWGRPH_VIDEO_DEMO_BASENAME,
      text: sourceText,
      enabled: true,
      status: 'parsed',
      parsedTextHash: 'video-demo-source-files-open-close-reopen-h1',
      parsedGraphRevision: 1,
      parsedGraphData,
      source: { kind: 'local', path: sourcePath },
    }])
    explorer.setActivePath(sourcePath)
    store.setMarkdownDocument(sourcePath, sourceText)
    applyComposedGraphFromSourceFiles()

    const postCompose = useGraphStore.getState()
    if (postCompose.canvas2dRenderer !== 'flowEditor') {
      throw new Error(`expected source-files video-demo landing to use flowEditor renderer, got ${String(postCompose.canvas2dRenderer || '')}`)
    }

    const graphNodes = Array.isArray(postCompose.graphData?.nodes) ? postCompose.graphData.nodes : []
    const eligibleWidgetIds = Array.from(buildFlowWidgetEligibleNodeIdSet(graphNodes as never))
      .map(id => String(id || '').trim())
      .filter(Boolean)
    if (eligibleWidgetIds.length < 4) {
      throw new Error(`expected source-files video-demo open-close-reopen validation to include at least 4 widget-eligible nodes, got ${eligibleWidgetIds.length}`)
    }
    store.setOpenWidgetNodeIds(eligibleWidgetIds)
    store.setFlowWidgetWorldPosByNodeId({})

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.setAttribute('data-kg-canvas-viewport-root', '1')
    container.id = 'runtime-root-source-files-open-close-reopen-1920x1080'
    doc.body.appendChild(container)

    await act(async () => {
      root = createRoot(container as unknown as HTMLElement)
      root.render(React.createElement(FlowEditorCanvas, { active: true } as never))
      await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
    })

    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerWidth = targetViewport.width
    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerHeight = targetViewport.height
    await act(async () => {
      dom.window.dispatchEvent(new dom.window.Event('resize'))
      await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
    })

    const waitForInViewCollective = async (phase: string) => {
      const deadline = Date.now() + 3000
      let lastSnapshot = ''
      while (Date.now() < deadline) {
        const state = useGraphStore.getState() as unknown as {
          flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>
          zoomState?: { k?: number; x?: number; y?: number }
          zoomStateByKey?: Record<string, { k?: number; x?: number; y?: number }>
        }
        const worldById = state.flowWidgetWorldPosByNodeId || {}
        const seededIds = eligibleWidgetIds.filter(id => {
          const pos = worldById[id]
          return !!pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)
        })
        const zoomK = Number.isFinite(state.zoomState?.k) ? Math.max(0.001, Number(state.zoomState?.k)) : 1
        const zoomX = Number.isFinite(state.zoomState?.x) ? Number(state.zoomState?.x) : 0
        const zoomY = Number.isFinite(state.zoomState?.y) ? Number(state.zoomState?.y) : 0
        const keyedZoomValues = Object.values(state.zoomStateByKey || {})
        const keyedZoom = keyedZoomValues[0] || {}
        const keyedZoomX = Number.isFinite(keyedZoom.x) ? Number(keyedZoom.x) : 0
        const keyedZoomY = Number.isFinite(keyedZoom.y) ? Number(keyedZoom.y) : 0
        const keyedZoomK = Number.isFinite(keyedZoom.k) ? Math.max(0.001, Number(keyedZoom.k)) : 1
        if (seededIds.length > 0) {
          const panelScale = computeCollectiveFollowPinnedScale({
            zoomK,
            viewportW: targetViewport.width,
            viewportH: targetViewport.height,
            count: seededIds.length,
            baseWidth: WIDGET_BASE_SIZE.width,
            baseHeight: WIDGET_BASE_SIZE.height,
          })
          const panelScreen = computeWidgetScaledSize(panelScale)
          const panelWorldW = panelScreen.width / zoomK
          const panelWorldH = panelScreen.height / zoomK
          let minLeft = Number.POSITIVE_INFINITY
          let minTop = Number.POSITIVE_INFINITY
          let maxRight = Number.NEGATIVE_INFINITY
          let maxBottom = Number.NEGATIVE_INFINITY
          let centroidX = 0
          let centroidY = 0
          for (let i = 0; i < seededIds.length; i += 1) {
            const id = seededIds[i]!
            const world = worldById[id]!
            const left = world.x * zoomK + zoomX
            const top = world.y * zoomK + zoomY
            const right = (world.x + panelWorldW) * zoomK + zoomX
            const bottom = (world.y + panelWorldH) * zoomK + zoomY
            minLeft = Math.min(minLeft, left)
            minTop = Math.min(minTop, top)
            maxRight = Math.max(maxRight, right)
            maxBottom = Math.max(maxBottom, bottom)
            centroidX += left + panelScreen.width / 2
            centroidY += top + panelScreen.height / 2
          }
          centroidX /= seededIds.length
          centroidY /= seededIds.length
          const fitsViewport =
            minLeft >= -1 &&
            minTop >= -1 &&
            maxRight <= targetViewport.width + 1 &&
            maxBottom <= targetViewport.height + 1
          const centroidNearViewportCenter =
            Math.abs(centroidX - targetViewport.width / 2) <= 6 &&
            Math.abs(centroidY - targetViewport.height / 2) <= 6
          lastSnapshot = JSON.stringify({
            phase,
            seededCount: seededIds.length,
            zoomK,
            bounds: { minLeft, minTop, maxRight, maxBottom },
            centroid: { x: centroidX, y: centroidY },
          })
          if (fitsViewport && centroidNearViewportCenter) return
        }
        await new Promise<void>(resolveWait => setTimeout(resolveWait, 12))
      }
      throw new Error(`expected source-files Flow Editor collective layout to remain in-view after ${phase}; snapshot=${lastSnapshot}`)
    }

    await waitForInViewCollective('initial-canvas')

    await act(async () => {
      store.setWorkspaceViewMode('editor')
      store.setWorkspaceCanvasPaneOpen(true)
      dom.window.dispatchEvent(new dom.window.Event('resize'))
      await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
    })

    await waitForInViewCollective('opened')

    await act(async () => {
      store.setWorkspaceCanvasPaneOpen(false)
      store.setWorkspaceViewMode('canvas')
      await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
    })

    await act(async () => {
      store.setWorkspaceViewMode('editor')
      store.setWorkspaceCanvasPaneOpen(true)
      dom.window.dispatchEvent(new dom.window.Event('resize'))
      await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
    })

    await waitForInViewCollective('reopen')
  } finally {
    try {
      restoreElementRect?.()
    } catch {
      void 0
    }
    try {
      await act(async () => {
        root?.unmount()
        await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
      })
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testVideoDemoSourceFilesRuntimeInitialWorkspaceOpenStaysInView1920x1080Viewport() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  const targetViewport = { width: 1920, height: 1080 }
  let restoreElementRect: (() => void) | null = null

  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
      dispatchEvent?: (event: Event) => boolean
    }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) => setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame = anyWindow.requestAnimationFrame
    const elementProto = dom.window.HTMLElement.prototype
    const originalElementRect = elementProto.getBoundingClientRect
    elementProto.getBoundingClientRect = function patchedGetBoundingClientRect(this: HTMLElement): DOMRect {
      const shouldForceViewportRect =
        this.matches('[data-kg-canvas-viewport-root="1"]')
        || this.matches('[data-kg-flow-editor-surface-root]')
      if (!shouldForceViewportRect) return originalElementRect.call(this) as DOMRect
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: targetViewport.width,
        height: targetViewport.height,
        right: targetViewport.width,
        bottom: targetViewport.height,
        toJSON: () => ({}),
      } as DOMRect
    }
    restoreElementRect = () => {
      elementProto.getBoundingClientRect = originalElementRect
    }

    const store = useGraphStore.getState()
    const explorer = useMarkdownExplorerStore.getState()
    store.resetAll()
    store.setDocumentStructureBaselineLock(false)
    store.setCanvasRenderMode('2d')
    store.setCanvas2dRenderer('d3')
    store.setDocumentSemanticMode('keyword')
    store.setFrontmatterModeEnabled(false)
    store.setWorkspaceViewMode('editor')
    store.setWorkspaceCanvasPaneOpen(true)

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.setAttribute('data-kg-canvas-viewport-root', '1')
    container.id = 'runtime-root-source-files-initial-workspace-open-1920x1080'
    doc.body.appendChild(container)

    await act(async () => {
      root = createRoot(container as unknown as HTMLElement)
      root.render(React.createElement(FlowEditorCanvas, { active: true } as never))
      await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
    })

    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerWidth = targetViewport.width
    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerHeight = targetViewport.height
    await act(async () => {
      dom.window.dispatchEvent(new dom.window.Event('resize'))
      await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
    })

    const sourcePath = '/docs/knowgrph-video-demo.md'
    const sourceText = readDocsSsotFixtureText(KNOWGRPH_VIDEO_DEMO_BASENAME)
    const parsed = await loadGraphDataFromTextViaParser(sourcePath, sourceText, { applyToStore: false, syncMarkdownDocument: false })
    const parsedGraphData = parsed?.graphData
    if (!parsedGraphData) {
      throw new Error('expected source-files knowgrph-video-demo parse to produce graph data')
    }
    store.setSourceFiles([{
      id: 'sf-video-initial-open',
      name: KNOWGRPH_VIDEO_DEMO_BASENAME,
      text: sourceText,
      enabled: true,
      status: 'parsed',
      parsedTextHash: 'video-demo-source-files-initial-open-h1',
      parsedGraphRevision: 1,
      parsedGraphData,
      source: { kind: 'local', path: sourcePath },
    }])
    explorer.setActivePath(sourcePath)
    store.setMarkdownDocument(sourcePath, sourceText)
    applyComposedGraphFromSourceFiles()

    const postCompose = useGraphStore.getState()
    if (postCompose.canvas2dRenderer !== 'flowEditor') {
      throw new Error(`expected source-files initial workspace-open landing to use flowEditor renderer, got ${String(postCompose.canvas2dRenderer || '')}`)
    }
    const graphNodes = Array.isArray(postCompose.graphData?.nodes) ? postCompose.graphData.nodes : []
    const eligibleWidgetIds = Array.from(buildFlowWidgetEligibleNodeIdSet(graphNodes as never))
      .map(id => String(id || '').trim())
      .filter(Boolean)
    if (eligibleWidgetIds.length < 4) {
      throw new Error(`expected source-files initial workspace-open validation to include at least 4 widget-eligible nodes, got ${eligibleWidgetIds.length}`)
    }
    store.setOpenWidgetNodeIds(eligibleWidgetIds)
    store.setFlowWidgetWorldPosByNodeId({})
    await act(async () => {
      dom.window.dispatchEvent(new dom.window.Event('resize'))
      await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
    })

    const waitForInViewCollective = async () => {
      const deadline = Date.now() + 3200
      let lastSnapshot = ''
      while (Date.now() < deadline) {
        const state = useGraphStore.getState() as unknown as {
          flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>
          zoomState?: { k?: number; x?: number; y?: number }
          zoomStateByKey?: Record<string, { k?: number; x?: number; y?: number }>
        }
        const worldById = state.flowWidgetWorldPosByNodeId || {}
        const seededIds = eligibleWidgetIds.filter(id => {
          const pos = worldById[id]
          return !!pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)
        })
        const zoomK = Number.isFinite(state.zoomState?.k) ? Math.max(0.001, Number(state.zoomState?.k)) : 1
        const zoomX = Number.isFinite(state.zoomState?.x) ? Number(state.zoomState?.x) : 0
        const zoomY = Number.isFinite(state.zoomState?.y) ? Number(state.zoomState?.y) : 0
        const keyedZoomValues = Object.values(state.zoomStateByKey || {})
        const keyedZoom = keyedZoomValues[0] || {}
        const keyedZoomX = Number.isFinite(keyedZoom.x) ? Number(keyedZoom.x) : 0
        const keyedZoomY = Number.isFinite(keyedZoom.y) ? Number(keyedZoom.y) : 0
        const keyedZoomK = Number.isFinite(keyedZoom.k) ? Math.max(0.001, Number(keyedZoom.k)) : 1
        if (seededIds.length > 0) {
          const panelScale = computeCollectiveFollowPinnedScale({
            zoomK,
            viewportW: targetViewport.width,
            viewportH: targetViewport.height,
            count: seededIds.length,
            baseWidth: WIDGET_BASE_SIZE.width,
            baseHeight: WIDGET_BASE_SIZE.height,
          })
          const panelScreen = computeWidgetScaledSize(panelScale)
          const panelWorldW = panelScreen.width / zoomK
          const panelWorldH = panelScreen.height / zoomK
          let minLeft = Number.POSITIVE_INFINITY
          let minTop = Number.POSITIVE_INFINITY
          let maxRight = Number.NEGATIVE_INFINITY
          let maxBottom = Number.NEGATIVE_INFINITY
          let centroidX = 0
          let centroidY = 0
          for (let i = 0; i < seededIds.length; i += 1) {
            const id = seededIds[i]!
            const world = worldById[id]!
            const left = world.x * zoomK + zoomX
            const top = world.y * zoomK + zoomY
            const right = (world.x + panelWorldW) * zoomK + zoomX
            const bottom = (world.y + panelWorldH) * zoomK + zoomY
            minLeft = Math.min(minLeft, left)
            minTop = Math.min(minTop, top)
            maxRight = Math.max(maxRight, right)
            maxBottom = Math.max(maxBottom, bottom)
            centroidX += left + panelScreen.width / 2
            centroidY += top + panelScreen.height / 2
          }
          centroidX /= seededIds.length
          centroidY /= seededIds.length
          const fitsViewport =
            minLeft >= -1 &&
            minTop >= -1 &&
            maxRight <= targetViewport.width + 1 &&
            maxBottom <= targetViewport.height + 1
          const centroidNearViewportCenter =
            Math.abs(centroidX - targetViewport.width / 2) <= 6 &&
            Math.abs(centroidY - targetViewport.height / 2) <= 6
          lastSnapshot = JSON.stringify({
            seededCount: seededIds.length,
            zoomK,
            zoomX,
            zoomY,
            keyedZoomK,
            keyedZoomX,
            keyedZoomY,
            bounds: { minLeft, minTop, maxRight, maxBottom },
            centroid: { x: centroidX, y: centroidY },
          })
          if (fitsViewport && centroidNearViewportCenter) return
        }
        await new Promise<void>(resolveWait => setTimeout(resolveWait, 12))
      }
      throw new Error(
        `expected source-files initial workspace-open Flow Editor collective layout to stay in-view; snapshot=${lastSnapshot}`,
      )
    }

    await waitForInViewCollective()
  } finally {
    try {
      restoreElementRect?.()
    } catch {
      void 0
    }
    try {
      await act(async () => {
        root?.unmount()
        await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
      })
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}
