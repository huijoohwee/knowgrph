import React from 'react'
import { createRoot } from 'react-dom/client'

import FlowEditorCanvas from '@/components/FlowEditorCanvas'
import { computeCollectiveFollowPinnedScale, computeWidgetScaledSize, WIDGET_BASE_SIZE } from '@/lib/canvas/overlayWidgetZoom'
import { applyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import { activateFirstImportedWorkspaceFile } from '@/features/markdown-workspace/useWorkspaceFileActions/importRuntimeActions'
import { importWorkspaceLocalFiles } from '@/features/markdown-workspace/workspaceImport'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { useGraphStore } from '@/hooks/useGraphStore'
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { LS_KEYS, UI_LABELS } from '@/lib/config'
import { buildFlowWidgetEligibleNodeIdSet } from '@/lib/graph/flowWidgetEligibility'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import { DOCS_SSOT_VALIDATION_FIXTURE_BASENAME, readDocsSsotFixtureText } from '@/tests/lib/docsSsotFixture'
import { assertFlowWidgetStateScopedToEligibleIds } from '@/tests/lib/flowWidgetStateScopeAssert'
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
const TEST_RUNTIME_FRAME_MS = 16
type FlowEditorWidgetTransformEntry = {
  id: string
  scale: number
  left: number
  top: number
  inlineWidth: string
  pinned: boolean
  richMedia: boolean
}

const createFile = (name: string, text: string) => {
  const blob = new Blob([text], { type: 'text/plain' })
  return new File([blob], name, { type: 'text/plain' })
}

const waitForRuntimeTick = () => new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
const installRuntimeFrameHarness = (targetWindow: Window): (() => void) => {
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const anyWindow = targetWindow as unknown as {
    requestAnimationFrame?: (cb: (ts: number) => void) => number
    cancelAnimationFrame?: (id: number) => void
  }
  const previousWindowRequest = anyWindow.requestAnimationFrame
  const previousWindowCancel = anyWindow.cancelAnimationFrame
  const previousGlobalRequest = (globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame
  const previousGlobalCancel = (globalThis as unknown as { cancelAnimationFrame?: unknown }).cancelAnimationFrame
  const request = (cb: (ts: number) => void): number => {
    const timer = setTimeout(() => {
      timers.delete(timer)
      cb(Date.now())
    }, TEST_RUNTIME_FRAME_MS)
    timers.add(timer)
    return timer as unknown as number
  }
  const cancel = (id: number) => {
    const timer = id as unknown as ReturnType<typeof setTimeout>
    clearTimeout(timer)
    timers.delete(timer)
  }
  anyWindow.requestAnimationFrame = request
  anyWindow.cancelAnimationFrame = cancel
  ;(globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame = request
  ;(globalThis as unknown as { cancelAnimationFrame?: unknown }).cancelAnimationFrame = cancel
  return () => {
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
    anyWindow.requestAnimationFrame = previousWindowRequest
    anyWindow.cancelAnimationFrame = previousWindowCancel
    ;(globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame = previousGlobalRequest
    ;(globalThis as unknown as { cancelAnimationFrame?: unknown }).cancelAnimationFrame = previousGlobalCancel
  }
}

function parseOverlayMatrixTransform(transform: string): { scale: number; left: number; top: number } | null {
  const match = String(transform || '').match(/matrix\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/)
  if (!match) return null
  const scale = Number(match[1])
  const left = Number(match[5])
  const top = Number(match[6])
  if (!Number.isFinite(scale) || !Number.isFinite(left) || !Number.isFinite(top)) return null
  return { scale, left, top }
}

function readFlowEditorWidgetTransformEntries(doc: Document): FlowEditorWidgetTransformEntry[] {
  return Array.from(doc.querySelectorAll<HTMLElement>('[data-kg-widget][data-kg-flow-editor-mode="1"]'))
    .map(el => {
      const id = String(el.dataset.kgWidget || '').trim()
      const parsed = parseOverlayMatrixTransform(el.style.transform || '')
      return id && parsed
        ? {
            id,
            ...parsed,
            inlineWidth: el.style.width || '',
            pinned: el.getAttribute('data-kg-widget-pinned') === '1',
            richMedia: !!el.querySelector('[data-kg-rich-media-render-surface="1"]'),
          }
        : null
    })
    .filter((entry): entry is FlowEditorWidgetTransformEntry => !!entry)
}

async function waitForFlowEditorWidgetTransformSpread(args: {
  doc: Document
  minCount: number
  minUniqueBins: number
  minSpanW: number
  minSpanH: number
  label: string
}): Promise<FlowEditorWidgetTransformEntry[]> {
  const deadline = Date.now() + 3200
  let lastSnapshot = ''
  while (Date.now() < deadline) {
    const entries = readFlowEditorWidgetTransformEntries(args.doc)
    const ids = new Set(entries.map(entry => entry.id))
    const bins = new Set(entries.map(entry => `${Math.round(entry.left / 20)}:${Math.round(entry.top / 20)}`))
    const minLeft = Math.min(...entries.map(entry => entry.left))
    const maxLeft = Math.max(...entries.map(entry => entry.left))
    const minTop = Math.min(...entries.map(entry => entry.top))
    const maxTop = Math.max(...entries.map(entry => entry.top))
    const spanW = Number.isFinite(minLeft) && Number.isFinite(maxLeft) ? maxLeft - minLeft : 0
    const spanH = Number.isFinite(minTop) && Number.isFinite(maxTop) ? maxTop - minTop : 0
    lastSnapshot = JSON.stringify({
      label: args.label,
      count: entries.length,
      uniqueIds: ids.size,
      uniqueBins: bins.size,
      spanW,
      spanH,
      sample: entries.slice(0, 5),
    })
    if (
      entries.length >= args.minCount
      && ids.size >= args.minCount
      && bins.size >= args.minUniqueBins
      && spanW >= args.minSpanW
      && spanH >= args.minSpanH
    ) {
      return entries
    }
    await new Promise<void>(resolveWait => setTimeout(resolveWait, 16))
  }
  throw new Error(`expected Flow Editor widget transforms to stay visibly spread for ${args.label}; snapshot=${lastSnapshot}`)
}

function findFlowEditorWidgetEntry(entries: FlowEditorWidgetTransformEntry[], id: string): FlowEditorWidgetTransformEntry {
  const entry = entries.find(candidate => candidate.id === id)
  if (!entry) throw new Error(`expected Flow Editor widget ${id} to remain mounted`)
  return entry
}

function pickFlowEditorWidgetTarget(args: {
  entries: FlowEditorWidgetTransformEntry[]
  richMedia: boolean
  viewport: { width: number; height: number }
}): FlowEditorWidgetTransformEntry {
  const candidates = args.entries.filter(entry => entry.richMedia === args.richMedia)
  if (candidates.length === 0) {
    throw new Error(`expected Flow Editor runtime to render a ${args.richMedia ? 'rich-media' : 'widget'} target`)
  }
  const cx = args.viewport.width / 2
  const cy = args.viewport.height / 2
  return candidates
    .slice()
    .sort((a, b) => {
      const da = Math.abs(a.left - cx) + Math.abs(a.top - cy)
      const db = Math.abs(b.left - cx) + Math.abs(b.top - cy)
      return da - db
    })[0]!
}

function assertFlowEditorWidgetGeometryStable(args: {
  before: FlowEditorWidgetTransformEntry
  after: FlowEditorWidgetTransformEntry
  label: string
  maxPositionShiftPx?: number
}) {
  const maxPositionShiftPx = args.maxPositionShiftPx ?? 1
  const dx = Math.abs(args.before.left - args.after.left)
  const dy = Math.abs(args.before.top - args.after.top)
  const dScale = Math.abs(args.before.scale - args.after.scale)
  if (dx > maxPositionShiftPx || dy > maxPositionShiftPx || dScale > 0.0001 || args.before.inlineWidth !== args.after.inlineWidth) {
    throw new Error(`expected ${args.label} to keep widget geometry stable; before=${JSON.stringify(args.before)} after=${JSON.stringify(args.after)}`)
  }
}

function dispatchFlowEditorPointerEvent(target: EventTarget, win: Window & typeof globalThis, type: string, init: {
  pointerId?: number
  clientX?: number
  clientY?: number
  button?: number
  buttons?: number
}) {
  const event = new win.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    button: init.button ?? 0,
    buttons: init.buttons ?? (type === 'pointerup' ? 0 : 1),
  }) as unknown as PointerEvent
  for (const [key, value] of Object.entries({
    pointerId: init.pointerId ?? 71,
    pointerType: 'mouse',
    isPrimary: true,
  })) {
    try {
      Object.defineProperty(event, key, { value, configurable: true })
    } catch {
      void 0
    }
  }
  target.dispatchEvent(event)
}

async function waitForPinToggleGuard() {
  await new Promise<void>(resolveWait => setTimeout(resolveWait, 270))
  await waitForRuntimeTick()
}

function findPinToggleButton(doc: Document, widgetId: string): HTMLButtonElement {
  const root = Array.from(doc.querySelectorAll<HTMLElement>('[data-kg-widget][data-kg-flow-editor-mode="1"]'))
    .find(candidate => String(candidate.dataset.kgWidget || '') === widgetId) || null
  if (!root) throw new Error(`expected Flow Editor widget ${widgetId} root for pin toggle`)
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(candidate => {
    const title = String(candidate.getAttribute('title') || '').trim()
    const aria = String(candidate.getAttribute('aria-label') || '').trim()
    return title === UI_LABELS.pinPanel
      || title === UI_LABELS.unpinPanel
      || aria === UI_LABELS.pinPanel
      || aria === UI_LABELS.unpinPanel
  })
  if (!button) throw new Error(`expected Flow Editor widget ${widgetId} to expose a pin toggle button`)
  return button
}

function findWidgetDragHandle(doc: Document, widgetId: string): HTMLElement {
  const root = Array.from(doc.querySelectorAll<HTMLElement>('[data-kg-widget][data-kg-flow-editor-mode="1"]'))
    .find(candidate => String(candidate.dataset.kgWidget || '') === widgetId) || null
  const handle = root?.querySelector<HTMLElement>('[data-kg-flow-node-drag-handle="true"]') || null
  if (!handle) throw new Error(`expected Flow Editor widget ${widgetId} to expose a drag handle`)
  return handle
}

function assertFlowEditorRuntimeStillScoped(args: {
  doc: Document
  eligibleWidgetIds: string[]
  label: string
}) {
  const state = useGraphStore.getState()
  const graphNodes = Array.isArray(state.graphData?.nodes) ? state.graphData.nodes : []
  const graphEdges = Array.isArray(state.graphData?.edges) ? state.graphData.edges : []
  if (graphNodes.length === 0) throw new Error(`expected ${args.label} to keep active graph nodes mounted`)
  if (graphEdges.length === 0) throw new Error(`expected ${args.label} to keep active graph edges mounted`)
  const entries = readFlowEditorWidgetTransformEntries(args.doc)
  const eligible = new Set(args.eligibleWidgetIds)
  const foreignIds = entries.map(entry => entry.id).filter(id => !eligible.has(id))
  if (foreignIds.length > 0) {
    throw new Error(`expected ${args.label} to keep Flow Editor widgets scoped to graph-owned ids; foreign=${JSON.stringify(foreignIds.slice(0, 8))}`)
  }
  const surfaceRoots = args.doc.querySelectorAll('[data-kg-flow-editor-surface-root]')
  if (surfaceRoots.length !== 1) throw new Error(`expected ${args.label} to keep one active Flow Editor surface, got ${surfaceRoots.length}`)
}

const mountFlowEditorCanvasRuntime = async (container: HTMLElement): Promise<ReturnType<typeof createRoot>> => {
  const root = createRoot(container)
  root.render(React.createElement(FlowEditorCanvas, { active: true } as never))
  await waitForRuntimeTick()
  return root
}

const unmountFlowEditorCanvasRuntime = async (root: ReturnType<typeof createRoot> | null): Promise<void> => {
  root?.unmount()
  await waitForRuntimeTick()
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
  let restoreRuntimeFrames: (() => void) | null = null

  try {
    restoreRuntimeFrames = installRuntimeFrameHarness(dom.window)

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

    const videoText = readDocsSsotFixtureText(DOCS_SSOT_VALIDATION_FIXTURE_BASENAME)
    const videoImport = await importWorkspaceLocalFiles({
      fs,
      files: [createFile(DOCS_SSOT_VALIDATION_FIXTURE_BASENAME, videoText)],
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
    root = await mountFlowEditorCanvasRuntime(container as unknown as HTMLElement)

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
      await unmountFlowEditorCanvasRuntime(root)
    } catch {
      void 0
    }
    restoreRuntimeFrames?.()
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
  let restoreRuntimeFrames: (() => void) | null = null

  try {
    restoreRuntimeFrames = installRuntimeFrameHarness(dom.window)

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

    const videoText = readDocsSsotFixtureText(DOCS_SSOT_VALIDATION_FIXTURE_BASENAME)
    const videoImport = await importWorkspaceLocalFiles({
      fs,
      files: [createFile(DOCS_SSOT_VALIDATION_FIXTURE_BASENAME, videoText)],
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

    root = await mountFlowEditorCanvasRuntime(container as unknown as HTMLElement)

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
      await unmountFlowEditorCanvasRuntime(root)
    } catch {
      void 0
    }
    restoreRuntimeFrames?.()
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
  let restoreRuntimeFrames: (() => void) | null = null

  try {
    restoreRuntimeFrames = installRuntimeFrameHarness(dom.window)
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

    const videoText = readDocsSsotFixtureText(DOCS_SSOT_VALIDATION_FIXTURE_BASENAME)
    const videoImport = await importWorkspaceLocalFiles({
      fs,
      files: [createFile(DOCS_SSOT_VALIDATION_FIXTURE_BASENAME, videoText)],
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

    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerWidth = targetViewport.width
    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerHeight = targetViewport.height
    root = await mountFlowEditorCanvasRuntime(container as unknown as HTMLElement)

    dom.window.dispatchEvent(new dom.window.Event('resize'))
    await waitForRuntimeTick()

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
      await unmountFlowEditorCanvasRuntime(root)
    } catch {
      void 0
    }
    restoreRuntimeFrames?.()
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
  let restoreRuntimeFrames: (() => void) | null = null

  try {
    restoreRuntimeFrames = installRuntimeFrameHarness(dom.window)
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

    const sourcePath = `/docs/${DOCS_SSOT_VALIDATION_FIXTURE_BASENAME}`
    const sourceText = readDocsSsotFixtureText(DOCS_SSOT_VALIDATION_FIXTURE_BASENAME)
    const parsed = await loadGraphDataFromTextViaParser(sourcePath, sourceText, { applyToStore: false, syncMarkdownDocument: false })
    const parsedGraphData = parsed?.graphData
    if (!parsedGraphData) {
      throw new Error('expected source-files knowgrph-video-demo parse to produce graph data')
    }

    store.setSourceFiles([{
      id: 'sf-video',
      name: DOCS_SSOT_VALIDATION_FIXTURE_BASENAME,
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

    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerWidth = targetViewport.width
    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerHeight = targetViewport.height
    root = await mountFlowEditorCanvasRuntime(container as unknown as HTMLElement)

    dom.window.dispatchEvent(new dom.window.Event('resize'))
    await waitForRuntimeTick()

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

    await waitForBalancedFit(); assertFlowWidgetStateScopedToEligibleIds({ eligibleWidgetIds, messagePrefix: 'expected source-files Flow Editor widget state to stay on graph-owned node ids' })
  } finally {
    try {
      restoreElementRect?.()
    } catch {
      void 0
    }
    try {
      await unmountFlowEditorCanvasRuntime(root)
    } catch {
      void 0
    }
    restoreRuntimeFrames?.()
    restoreDom()
    restoreWindow()
  }
}

export async function testVideoDemoSourceFilesRuntimeScreenAuthorityIgnoresCanvasZoomProjection() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  const targetViewport = { width: 1920, height: 1080 }
  let restoreElementRect: (() => void) | null = null
  let restoreRuntimeFrames: (() => void) | null = null

  try {
    restoreRuntimeFrames = installRuntimeFrameHarness(dom.window)
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

    const sourcePath = `/docs/${DOCS_SSOT_VALIDATION_FIXTURE_BASENAME}`
    const sourceText = readDocsSsotFixtureText(DOCS_SSOT_VALIDATION_FIXTURE_BASENAME)
    const parsed = await loadGraphDataFromTextViaParser(sourcePath, sourceText, { applyToStore: false, syncMarkdownDocument: false })
    const parsedGraphData = parsed?.graphData
    if (!parsedGraphData) {
      throw new Error('expected source-files knowgrph-video-demo parse to produce graph data')
    }

    store.setSourceFiles([{
      id: 'sf-video-screen-authority-zoom-projection',
      name: DOCS_SSOT_VALIDATION_FIXTURE_BASENAME,
      text: sourceText,
      enabled: true,
      status: 'parsed',
      parsedTextHash: 'video-demo-source-files-screen-authority-zoom-projection-h1',
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
    if (eligibleWidgetIds.length < 12) {
      throw new Error(`expected source-files video-demo screen-authority validation to include at least 12 widget-eligible nodes, got ${eligibleWidgetIds.length}`)
    }
    store.setOpenWidgetNodeIds(eligibleWidgetIds)
    store.setFlowWidgetWorldPosByNodeId({})

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.setAttribute('data-kg-canvas-viewport-root', '1')
    container.id = 'runtime-root-source-files-screen-authority-zoom-projection'
    doc.body.appendChild(container)

    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerWidth = targetViewport.width
    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerHeight = targetViewport.height
    root = await mountFlowEditorCanvasRuntime(container as unknown as HTMLElement)

    dom.window.dispatchEvent(new dom.window.Event('resize'))
    await waitForRuntimeTick()

    const before = await waitForFlowEditorWidgetTransformSpread({
      doc,
      minCount: Math.min(eligibleWidgetIds.length, 24),
      minUniqueBins: Math.min(eligibleWidgetIds.length, 18),
      minSpanW: targetViewport.width * 0.45,
      minSpanH: targetViewport.height * 0.35,
      label: 'before-canvas-zoom',
    })
    const beforeById = new Map(before.map(entry => [entry.id, entry]))

    useGraphStore.getState().setZoomState({ k: 0.236057, x: 1471.46, y: 867.365 })
    dom.window.dispatchEvent(new dom.window.Event('resize'))
    for (let i = 0; i < 6; i += 1) await waitForRuntimeTick()

    const after = readFlowEditorWidgetTransformEntries(doc)
    const moved: Array<{ id: string; before: { scale: number; left: number; top: number }; after: { scale: number; left: number; top: number } }> = []
    for (let i = 0; i < after.length; i += 1) {
      const next = after[i]!
      const prev = beforeById.get(next.id)
      if (!prev) continue
      const movedPosition = Math.abs(prev.left - next.left) > 0.5 || Math.abs(prev.top - next.top) > 0.5
      const mutatedScale = Math.abs(prev.scale - next.scale) > 0.0001
      if (movedPosition || mutatedScale) moved.push({ id: next.id, before: prev, after: next })
    }
    if (moved.length > 0) {
      throw new Error(`expected frontmatter screen-authority widget transforms to ignore Flow Canvas zoom projection; moved=${JSON.stringify(moved.slice(0, 8))}`)
    }
    const afterSpread = await waitForFlowEditorWidgetTransformSpread({
      doc,
      minCount: Math.min(eligibleWidgetIds.length, 24),
      minUniqueBins: Math.min(eligibleWidgetIds.length, 18),
      minSpanW: targetViewport.width * 0.45,
      minSpanH: targetViewport.height * 0.35,
      label: 'after-canvas-zoom',
    })
    assertFlowWidgetStateScopedToEligibleIds({ eligibleWidgetIds, messagePrefix: `expected screen-authority zoom isolation to keep Flow Editor widget state graph-owned (${afterSpread.length} overlays)` })
  } finally {
    try {
      restoreElementRect?.()
    } catch {
      void 0
    }
    try {
      await unmountFlowEditorCanvasRuntime(root)
    } catch {
      void 0
    }
    restoreRuntimeFrames?.()
    restoreDom()
    restoreWindow()
  }
}

export async function testVideoDemoSourceFilesRuntimeScreenAuthorityDragPinUnpinKeepsGeometryStable() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  const targetViewport = { width: 1920, height: 1080 }
  const workspaceLeftPaneWidth = Math.round(targetViewport.width * 0.28)
  let restoreElementRect: (() => void) | null = null
  let restoreRuntimeFrames: (() => void) | null = null

  try {
    restoreRuntimeFrames = installRuntimeFrameHarness(dom.window)
    const elementProto = dom.window.HTMLElement.prototype
    const originalElementRect = elementProto.getBoundingClientRect
    elementProto.getBoundingClientRect = function patchedGetBoundingClientRect(this: HTMLElement): DOMRect {
      const shouldForceViewportRect =
        this.matches('[data-kg-canvas-viewport-root="1"]')
        || this.matches('[data-kg-flow-editor-surface-root]')
      if (this.matches('[data-kg-workspace-left-pane="1"]')) {
        return {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          width: workspaceLeftPaneWidth,
          height: targetViewport.height,
          right: workspaceLeftPaneWidth,
          bottom: targetViewport.height,
          toJSON: () => ({}),
        } as DOMRect
      }
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

    const sourcePath = `/docs/${DOCS_SSOT_VALIDATION_FIXTURE_BASENAME}`
    const sourceText = readDocsSsotFixtureText(DOCS_SSOT_VALIDATION_FIXTURE_BASENAME)
    const parsed = await loadGraphDataFromTextViaParser(sourcePath, sourceText, { applyToStore: false, syncMarkdownDocument: false })
    const parsedGraphData = parsed?.graphData
    if (!parsedGraphData) {
      throw new Error('expected source-files knowgrph-video-demo parse to produce graph data')
    }

    store.setSourceFiles([{
      id: 'sf-video-screen-authority-drag-pin-unpin',
      name: DOCS_SSOT_VALIDATION_FIXTURE_BASENAME,
      text: sourceText,
      enabled: true,
      status: 'parsed',
      parsedTextHash: 'video-demo-source-files-screen-authority-drag-pin-unpin-h1',
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
    if (eligibleWidgetIds.length < 12) {
      throw new Error(`expected source-files video-demo drag/pin validation to include at least 12 widget-eligible nodes, got ${eligibleWidgetIds.length}`)
    }
    store.setOpenWidgetNodeIds(eligibleWidgetIds)
    store.setFlowWidgetWorldPosByNodeId({})

    const doc = dom.window.document
    const workspaceLeftPane = doc.createElement('aside')
    workspaceLeftPane.setAttribute('data-kg-workspace-left-pane', '1')
    doc.body.appendChild(workspaceLeftPane)
    const container = doc.createElement('div')
    container.setAttribute('data-kg-canvas-viewport-root', '1')
    container.id = 'runtime-root-source-files-screen-authority-drag-pin-unpin'
    doc.body.appendChild(container)

    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerWidth = targetViewport.width
    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerHeight = targetViewport.height
    root = await mountFlowEditorCanvasRuntime(container as unknown as HTMLElement)

    dom.window.dispatchEvent(new dom.window.Event('resize'))
    await waitForRuntimeTick()

    const initial = await waitForFlowEditorWidgetTransformSpread({
      doc,
      minCount: Math.min(eligibleWidgetIds.length, 24),
      minUniqueBins: Math.min(eligibleWidgetIds.length, 18),
      minSpanW: targetViewport.width * 0.45,
      minSpanH: targetViewport.height * 0.35,
      label: 'drag-pin-unpin-initial',
    })
    const paneBlockedEntries = initial.filter(entry => entry.left < workspaceLeftPaneWidth - 1)
    if (paneBlockedEntries.length > 0) {
      throw new Error(`expected Flow Editor screen-authority widgets to honor the visible canvas strip beside the workspace pane; paneWidth=${workspaceLeftPaneWidth} blocked=${JSON.stringify(paneBlockedEntries.slice(0, 8))}`)
    }
    assertFlowEditorRuntimeStillScoped({ doc, eligibleWidgetIds, label: 'drag-pin-unpin-initial' })

    const widgetTarget = pickFlowEditorWidgetTarget({ entries: initial, richMedia: false, viewport: targetViewport })
    const richMediaTarget = pickFlowEditorWidgetTarget({ entries: initial, richMedia: true, viewport: targetViewport })

    const dragDx = 96
    const dragDy = 64
    const handle = findWidgetDragHandle(doc, widgetTarget.id)
    dispatchFlowEditorPointerEvent(handle, dom.window, 'pointerdown', {
      pointerId: 91,
      clientX: widgetTarget.left + 24,
      clientY: widgetTarget.top + 14,
      buttons: 1,
    })
    dispatchFlowEditorPointerEvent(dom.window, dom.window, 'pointermove', {
      pointerId: 91,
      clientX: widgetTarget.left + 24 + dragDx,
      clientY: widgetTarget.top + 14 + dragDy,
      buttons: 1,
    })
    await waitForRuntimeTick()
    dispatchFlowEditorPointerEvent(dom.window, dom.window, 'pointerup', {
      pointerId: 91,
      clientX: widgetTarget.left + 24 + dragDx,
      clientY: widgetTarget.top + 14 + dragDy,
      buttons: 0,
    })
    for (let i = 0; i < 4; i += 1) await waitForRuntimeTick()

    const afterDragEntries = await waitForFlowEditorWidgetTransformSpread({
      doc,
      minCount: Math.min(eligibleWidgetIds.length, 24),
      minUniqueBins: Math.min(eligibleWidgetIds.length, 18),
      minSpanW: targetViewport.width * 0.45,
      minSpanH: targetViewport.height * 0.35,
      label: 'after-widget-drag',
    })
    const afterDragWidget = findFlowEditorWidgetEntry(afterDragEntries, widgetTarget.id)
    const afterDragRichMedia = findFlowEditorWidgetEntry(afterDragEntries, richMediaTarget.id)
    const movedDx = afterDragWidget.left - widgetTarget.left
    const movedDy = afterDragWidget.top - widgetTarget.top
    if (
      Math.abs(movedDx - dragDx) > 1
      || Math.abs(movedDy - dragDy) > 1
      || Math.abs(afterDragWidget.scale - widgetTarget.scale) > 0.0001
      || afterDragWidget.inlineWidth !== widgetTarget.inlineWidth
    ) {
      throw new Error(`expected widget drag to preserve size and move by the pointer delta; before=${JSON.stringify(widgetTarget)} after=${JSON.stringify(afterDragWidget)} delta=${JSON.stringify({ movedDx, movedDy })}`)
    }
    assertFlowEditorWidgetGeometryStable({
      before: richMediaTarget,
      after: afterDragRichMedia,
      label: 'rich media during adjacent widget drag',
    })
    assertFlowEditorRuntimeStillScoped({ doc, eligibleWidgetIds, label: 'after-widget-drag' })

    const toggleAndAssert = async (id: string, expectedPinned: boolean, label: string) => {
      const beforeEntries = readFlowEditorWidgetTransformEntries(doc)
      const before = findFlowEditorWidgetEntry(beforeEntries, id)
      const button = findPinToggleButton(doc, id)
      dispatchFlowEditorPointerEvent(button, dom.window, 'pointerdown', {
        pointerId: expectedPinned ? 92 : 93,
        clientX: before.left + 8,
        clientY: before.top + 8,
        buttons: 1,
      })
      await waitForPinToggleGuard()
      const nextEntries = await waitForFlowEditorWidgetTransformSpread({
        doc,
        minCount: Math.min(eligibleWidgetIds.length, 24),
        minUniqueBins: Math.min(eligibleWidgetIds.length, 18),
        minSpanW: targetViewport.width * 0.45,
        minSpanH: targetViewport.height * 0.35,
        label,
      })
      const after = findFlowEditorWidgetEntry(nextEntries, id)
      if (after.pinned !== expectedPinned) {
        throw new Error(`expected ${label} to set pinned=${expectedPinned}, got ${after.pinned}`)
      }
      assertFlowEditorWidgetGeometryStable({ before, after, label })
      assertFlowEditorRuntimeStillScoped({ doc, eligibleWidgetIds, label })
    }

    await toggleAndAssert(widgetTarget.id, true, 'widget-pin-after-drag')
    await toggleAndAssert(widgetTarget.id, false, 'widget-unpin-after-drag')
    await toggleAndAssert(richMediaTarget.id, true, 'rich-media-pin')
    await toggleAndAssert(richMediaTarget.id, false, 'rich-media-unpin')
    assertFlowWidgetStateScopedToEligibleIds({ eligibleWidgetIds, messagePrefix: 'expected screen-authority drag/pin/unpin to keep Flow Editor widget state graph-owned' })
  } finally {
    try {
      restoreElementRect?.()
    } catch {
      void 0
    }
    try {
      await unmountFlowEditorCanvasRuntime(root)
    } catch {
      void 0
    }
    restoreRuntimeFrames?.()
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
  let restoreRuntimeFrames: (() => void) | null = null

  try {
    restoreRuntimeFrames = installRuntimeFrameHarness(dom.window)
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

    const sourcePath = `/docs/${DOCS_SSOT_VALIDATION_FIXTURE_BASENAME}`
    const sourceText = readDocsSsotFixtureText(DOCS_SSOT_VALIDATION_FIXTURE_BASENAME)
    const parsed = await loadGraphDataFromTextViaParser(sourcePath, sourceText, { applyToStore: false, syncMarkdownDocument: false })
    const parsedGraphData = parsed?.graphData
    if (!parsedGraphData) {
      throw new Error('expected source-files knowgrph-video-demo parse to produce graph data')
    }

    store.setSourceFiles([{
      id: 'sf-video-open-close-reopen',
      name: DOCS_SSOT_VALIDATION_FIXTURE_BASENAME,
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

    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerWidth = targetViewport.width
    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerHeight = targetViewport.height
    root = await mountFlowEditorCanvasRuntime(container as unknown as HTMLElement)

    dom.window.dispatchEvent(new dom.window.Event('resize'))
    await waitForRuntimeTick()

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

    store.setWorkspaceViewMode('editor')
    store.setWorkspaceCanvasPaneOpen(true)
    dom.window.dispatchEvent(new dom.window.Event('resize'))
    await waitForRuntimeTick()

    await waitForInViewCollective('opened')

    store.setWorkspaceCanvasPaneOpen(false)
    store.setWorkspaceViewMode('canvas')
    await waitForRuntimeTick()

    store.setWorkspaceViewMode('editor')
    store.setWorkspaceCanvasPaneOpen(true)
    dom.window.dispatchEvent(new dom.window.Event('resize'))
    await waitForRuntimeTick()

    await waitForInViewCollective('reopen')
  } finally {
    try {
      restoreElementRect?.()
    } catch {
      void 0
    }
    try {
      await unmountFlowEditorCanvasRuntime(root)
    } catch {
      void 0
    }
    restoreRuntimeFrames?.()
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
  let restoreRuntimeFrames: (() => void) | null = null

  try {
    restoreRuntimeFrames = installRuntimeFrameHarness(dom.window)
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

    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerWidth = targetViewport.width
    ;(dom.window as unknown as { innerWidth?: number; innerHeight?: number }).innerHeight = targetViewport.height
    root = await mountFlowEditorCanvasRuntime(container as unknown as HTMLElement)

    dom.window.dispatchEvent(new dom.window.Event('resize'))
    await waitForRuntimeTick()

    const sourcePath = `/docs/${DOCS_SSOT_VALIDATION_FIXTURE_BASENAME}`
    const sourceText = readDocsSsotFixtureText(DOCS_SSOT_VALIDATION_FIXTURE_BASENAME)
    const parsed = await loadGraphDataFromTextViaParser(sourcePath, sourceText, { applyToStore: false, syncMarkdownDocument: false })
    const parsedGraphData = parsed?.graphData
    if (!parsedGraphData) {
      throw new Error('expected source-files knowgrph-video-demo parse to produce graph data')
    }
    store.setSourceFiles([{
      id: 'sf-video-initial-open',
      name: DOCS_SSOT_VALIDATION_FIXTURE_BASENAME,
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
    dom.window.dispatchEvent(new dom.window.Event('resize'))
    await waitForRuntimeTick()

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
      await unmountFlowEditorCanvasRuntime(root)
    } catch {
      void 0
    }
    restoreRuntimeFrames?.()
    restoreDom()
    restoreWindow()
  }
}
