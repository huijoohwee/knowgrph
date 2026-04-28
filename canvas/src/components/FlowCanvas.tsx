import React from 'react'
import * as d3 from 'd3'
import { useShallow } from 'zustand/react/shallow'

import { useGraphStore } from '@/hooks/useGraphStore'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useContainerDims } from '@/hooks/useContainerDims'
import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { buildLayoutPositionCacheKey, buildLayoutViewKey, computeLayoutDatasetKey } from '@/components/GraphCanvas/layout/positioning'
import { cloneGraphDataForRender } from '@/components/GraphCanvas/renderClone'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import { coerceNodesForFit, fitAllTransform } from '@/components/GraphCanvas/fit'
import { buildZoomViewKey } from '@/components/GraphCanvas/zoomViewKey'
import { pickInitialZoomTransform } from '@/lib/zoom/viewport'
import { pickZoomStateForView } from '@/lib/canvas/zoom-effective'
import { readFlowConfig } from '@/components/FlowCanvas/config'
import { buildAndSetFlowNativeScene } from '@/components/FlowCanvas/buildNativeScene'
import { buildGraphMetaKeyIgnoringPending, deriveRankdir } from '@/components/FlowCanvas/layout'
import { isFlowTransformShowingGraph } from '@/components/FlowCanvas/transformGuards'
import { deriveSceneGroups } from '@/lib/scene/sceneDerivation'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { useAutoZoomModes2d } from '@/features/zoom/useAutoZoomModes2d'
import { computeEffectiveFrontmatterMode, isFlowEditorFrontmatterDocumentModeRequested } from '@/lib/graph/frontmatterMode'
import { readFrontmatterFlowRenderSettings } from '@/lib/graph/frontmatterFlowSettings'
import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { computeArrangeCenters, type ArrangeAction2d } from '@/lib/canvas/arrange2d'
import { isEditableTarget, readArrangeShortcut, readNudgeDelta } from '@/lib/canvas/arrangeShortcuts'
import { readSnapGridConfigFromSchema, snapScalarToGrid } from '@/lib/canvas/gridSnap'
import { readCanvasGridRenderConfigFromSchema } from '@/lib/canvas/canvasGridConfig'
import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'
import { clampCanvasInteractionSpeedMultiplier, clampCanvasPanSpeedMultiplier } from '@/lib/canvas/camera-options-2d'
import { readAllowGroupResize } from '@/lib/canvas/groupResizePolicy'
import {
  createFlowNativeRuntime,
  requestFlowNativeDraw,
  setFlowNativePresentation,
  setFlowNativeTransform,
  setFlowNativeViewport,
  type FlowNativeDrawArgs,
  type FlowNativeRuntime,
} from '@/components/FlowCanvas/nativeRuntime'
import { createZoomWheelGuardState } from '@/lib/canvas/zoom-wheel-guard'
import { ensureSpacePanKeyListenerInstalled } from '@/lib/canvas/space-pan'
import { applyZoomRequestNative } from '@/components/FlowCanvas/applyZoomRequestNative'
import { setFlowAutoMinScale } from '@/components/FlowCanvas/flowScaleExtentOverride'
import { bindFlowCanvasNativeInteractions, type FlowCanvasDrag } from '@/components/FlowCanvas/bindNativeInteractions'
import { __flowCanvasDebug } from '@/components/FlowCanvas/flowCanvasDebug'
import { placeFlowFallbackSeedPositions } from '@/components/FlowCanvas/seedFallbackPositions'
import { useFlowComputedPositions } from '@/components/FlowCanvas/useFlowComputedPositions'
import { fitFlowEditorPinnedWidgets } from '@/components/FlowCanvas/fitPinnedWidgets'
import { readFlowPresentation } from '@/components/FlowCanvas/presentation'
import { useFlowRequestCommit } from '@/components/FlowCanvas/useFlowRequestCommit'
import { computeCollisionDuringDrag } from '@/components/FlowCanvas/collisionPolicy'
import { CANVAS_INTERACTIVE_CLASS, CANVAS_SURFACE_CLASS } from '@/lib/canvas/surface'
import { computeWidgetScale, computeWidgetScaledSize, WIDGET_BASE_SIZE } from '@/components/FlowEditor/widgetZoom'
import { computeWidgetMaxAnchorShiftPx } from '@/components/FlowEditor/widgetLayout'
import { DEFAULT_FLOW_NODE_WIDTH_PX } from '@/lib/graph/layoutDefaults'
import type { GraphSchema } from '@/lib/graph/schema'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import type { MediaOverlayNode } from '@/lib/render/mediaOverlayPool'
import {
  commitRichMediaPanelChange,
  isRichMediaPanelNode,
  listDisplayRichMediaOverlayNodes,
  normalizeRichMediaPanelDensity,
  resolveRichMediaPanelInteractive,
} from '@/lib/render/richMediaSsot'
import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'
import RichMediaPanel from '@/components/RichMediaPanel'
import { readNodeCenterWorld2d } from '@/lib/render/mediaAnchor'
import { startMediaOverlayLayoutLoop2d } from '@/lib/render/mediaOverlayLayoutLoop2d'
import { computeMediaOverlaySizing } from '@/lib/render/mediaOverlaySizing'
import { computeOverlayDraggedPoint2d, computeOverlayPanTransform2d } from '@/lib/canvas/overlayInteractions2d'
import { renderGraphCanvasSvgForHtmlExport } from '@/lib/graph/htmlCanvasSvgExport'
import { isCanonicalNodeIdEqual } from '@/lib/graph/canonicalNodeIds'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import { resolveActiveDocumentViewMode } from '@/lib/graph/documentViewMode'
import { buildMarkdownTokensKey, lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { deriveMarkdownDesignLayout } from '@/features/markdown-edgeless/markdownDesignLayout'
import { buildPanelOnlyNodeIdSetFromGraphNodes } from '@/lib/render/markdownPanelOverlayPool'
import { computeFlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { buildDataflowWidgetRegistry } from '@/lib/flowEditor/widgetRegistryDataflow'
import { applyConnectedValuesToNodeForRender } from '@/lib/render/effectiveMediaNode'
import { createRafLatestScheduler, type RafLatestScheduler } from '@/lib/react/rafLatestScheduler'

const EMPTY_WIDGET_REGISTRY: WidgetRegistryEntry[] = []
const EMPTY_STRING_ARRAY: string[] = []
const EMPTY_BOOL_RECORD: Record<string, boolean> = {}
const EMPTY_POS_RECORD: Record<string, { x: number; y: number }> = {}
const FLOW_RESET_ZOOM_FLOOR_CACHE_EVENT = 'kg:flow:resetZoomFloorCache'

type FlowCanvasInteractionRuntimeProps = {
  active: boolean
  allowMutations: boolean
  schema: GraphSchema | null
  runtimeRef: React.MutableRefObject<FlowNativeRuntime | null>
  positionsDirtySinceCommitRef: React.MutableRefObject<boolean>
  selectedNodeIdsRef: React.MutableRefObject<string[]>
  selectedEdgeIdsRef: React.MutableRefObject<string[]>
  drawArgsRef: React.MutableRefObject<FlowNativeDrawArgs>
  scheduleFlowDraw: () => void
  requestCommit: () => void
  handleInteractionFrame: () => void
  canvas2dRenderer: string
  graphDataForZoomRequests: GraphData | null
  viewportW: number
  viewportH: number
  flowEditorReservedW: number
}

const FlowCanvasInteractionRuntime = React.memo(function FlowCanvasInteractionRuntime(
  props: FlowCanvasInteractionRuntimeProps,
) {
  const {
    active,
    allowMutations,
    schema,
    runtimeRef,
    positionsDirtySinceCommitRef,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    drawArgsRef,
    scheduleFlowDraw,
    requestCommit,
    handleInteractionFrame,
    canvas2dRenderer,
    graphDataForZoomRequests,
    viewportW,
    viewportH,
    flowEditorReservedW,
  } = props

  const { selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds, selectedGroupId, zoomRequest } = useGraphStore(
    useShallow(s => {
      if (!active) {
        return {
          selectedNodeId: null,
          selectedEdgeId: null,
          selectedNodeIds: EMPTY_STRING_ARRAY,
          selectedEdgeIds: EMPTY_STRING_ARRAY,
          selectedGroupId: null,
          zoomRequest: null,
        }
      }
      return {
        selectedNodeId: s.selectedNodeId,
        selectedEdgeId: s.selectedEdgeId,
        selectedNodeIds: s.selectedNodeIds,
        selectedEdgeIds: s.selectedEdgeIds,
        selectedGroupId: s.selectedGroupId,
        zoomRequest: s.zoomRequest,
      }
    }),
  )

  React.useEffect(() => {
    const nodeIdSet = new Set<string>((selectedNodeIds || []).map(v => String(v)))
    if (selectedNodeId) nodeIdSet.add(String(selectedNodeId))
    const edgeIdSet = new Set<string>((selectedEdgeIds || []).map(v => String(v)))
    if (selectedEdgeId) edgeIdSet.add(String(selectedEdgeId))
    const nextSelectedNodeIds = Array.from(nodeIdSet)
    const nextSelectedEdgeIds = Array.from(edgeIdSet)
    selectedNodeIdsRef.current = nextSelectedNodeIds
    selectedEdgeIdsRef.current = nextSelectedEdgeIds
    drawArgsRef.current.selectedNodeIds = nextSelectedNodeIds
    drawArgsRef.current.selectedEdgeIds = nextSelectedEdgeIds
    drawArgsRef.current.selectedGroupId = selectedGroupId ? String(selectedGroupId || '').trim() : null
    scheduleFlowDraw()
  }, [
    drawArgsRef,
    scheduleFlowDraw,
    selectedEdgeId,
    selectedEdgeIds,
    selectedEdgeIdsRef,
    selectedGroupId,
    selectedNodeId,
    selectedNodeIds,
    selectedNodeIdsRef,
  ])

  const selectedIds = React.useMemo(() => {
    const set = new Set<string>()
    if (selectedNodeId) {
      const id = String(selectedNodeId || '').trim()
      if (id) set.add(id)
    }
    const ids = Array.isArray(selectedNodeIds) ? selectedNodeIds : []
    for (let i = 0; i < ids.length; i += 1) {
      const id = String(ids[i] || '').trim()
      if (id) set.add(id)
    }
    return Array.from(set)
  }, [selectedNodeId, selectedNodeIds])

  const applyArrange = React.useMemo(() => {
    return (action: ArrangeAction2d) => {
      if (!active) return
      if (selectedIds.length < 2) return
      const runtime = runtimeRef.current
      const scene = runtime?.scene
      if (!runtime || !scene) return
      const byId = scene.nodeById
      const refId = (() => {
        const a = String(selectedNodeId || '').trim()
        if (a && selectedIds.includes(a)) return a
        return selectedIds[0] || ''
      })()
      const grid = readSnapGridConfigFromSchema(schema)
      const gridSize = grid.enabled ? grid.size : 0
      const snap = (v: number) => (grid.enabled ? snapScalarToGrid(v, grid.size) : v)

      const items = selectedIds
        .map(id => {
          const n = byId.get(id)
          if (!n) return null
          const cx = n.x + n.width / 2
          const cy = n.y + n.height / 2
          return { id, cx, cy, w: n.width, h: n.height }
        })
        .filter(Boolean) as { id: string; cx: number; cy: number; w: number; h: number }[]
      if (items.length < 2) return
      const next = computeArrangeCenters({ action, items, refId, minSpacing: gridSize || 24 })
      for (let i = 0; i < items.length; i += 1) {
        const id = items[i]!.id
        const n = byId.get(id)
        const p = next[id]
        if (!n || !p) continue
        n.x = snap(p.cx - n.width / 2)
        n.y = snap(p.cy - n.height / 2)
      }
      runtime.dirty = true
      positionsDirtySinceCommitRef.current = true
      scheduleFlowDraw()
      requestCommit()
    }
  }, [active, positionsDirtySinceCommitRef, requestCommit, runtimeRef, schema, scheduleFlowDraw, selectedIds, selectedNodeId])

  React.useEffect(() => {
    if (!active) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      const arrange = readArrangeShortcut(e)
      if (arrange) {
        e.preventDefault()
        applyArrange(arrange)
        return
      }
      if (selectedIds.length === 0) return
      const grid = readSnapGridConfigFromSchema(schema)
      const delta = readNudgeDelta({ e, snapGridEnabled: grid.enabled, snapGridSize: grid.size })
      if (!delta) return
      const runtime = runtimeRef.current
      const scene = runtime?.scene
      if (!runtime || !scene) return
      e.preventDefault()
      for (let i = 0; i < selectedIds.length; i += 1) {
        const id = selectedIds[i]!
        const n = scene.nodeById.get(id)
        if (!n) continue
        n.x += delta.dx
        n.y += delta.dy
      }
      runtime.dirty = true
      positionsDirtySinceCommitRef.current = true
      scheduleFlowDraw()
      requestCommit()
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true } as AddEventListenerOptions)
    }
  }, [active, applyArrange, positionsDirtySinceCommitRef, requestCommit, runtimeRef, scheduleFlowDraw, schema, selectedIds])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    if (!zoomRequest) return
    const isFlowEditor = canvas2dRenderer === 'flowEditor'
    const widthEffective =
      isFlowEditor && (zoomRequest.type === 'fit' || zoomRequest.type === 'reset')
        ? Math.max(1, viewportW - flowEditorReservedW)
        : viewportW
    applyZoomRequestNative({
      zoomRequest,
      runtime,
      graphData: graphDataForZoomRequests,
      width: widthEffective,
      height: viewportH,
      selectedNodeId: selectedNodeId ? String(selectedNodeId) : null,
      selectedEdgeId: selectedEdgeId ? String(selectedEdgeId) : null,
      selectedNodeIds: (selectedNodeIds || []).map(v => String(v)),
      selectedEdgeIds: (selectedEdgeIds || []).map(v => String(v)),
      onFrame: () => {
        scheduleFlowDraw()
        requestCommit()
        handleInteractionFrame()
      },
    })
  }, [
    active,
    canvas2dRenderer,
    flowEditorReservedW,
    graphDataForZoomRequests,
    handleInteractionFrame,
    requestCommit,
    runtimeRef,
    scheduleFlowDraw,
    selectedEdgeId,
    selectedEdgeIds,
    selectedNodeId,
    selectedNodeIds,
    viewportH,
    viewportW,
    zoomRequest,
  ])

  return active && allowMutations && selectedIds.length >= 2 ? (
    <div className="pointer-events-none absolute right-3 top-3 z-50 flex flex-wrap gap-1 rounded-md border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] p-2 text-xs text-[var(--kg-text)] shadow">
      <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-left')}>
        Align L
      </button>
      <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-center-x')}>
        Align CX
      </button>
      <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-right')}>
        Align R
      </button>
      <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-top')}>
        Align T
      </button>
      <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-center-y')}>
        Align CY
      </button>
      <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-bottom')}>
        Align B
      </button>
      <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('distribute-x')}>
        Dist X
      </button>
      <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('distribute-y')}>
        Dist Y
      </button>
    </div>
  ) : null
})

function clampFinite(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo
  return Math.max(lo, Math.min(hi, v))
}

export function pickGraphDataForFlowRenderer(args: {
  graphData: GraphData | null
  effectiveFrontmatter: boolean
}): GraphData | null {
  if (!args.graphData) return null
  return args.graphData
}

export default function FlowCanvas({
  active = true,
  graphDataOverride,
  graphDataRevisionOverride,
  collisionDuringDrag = false,
  allowNodeDragOverride,
  exposeRuntimeRef,
  onInteractionFrame,
  hideSelectedNodeGlyph = false,
  hideSelectedNodePortHandles,
  hideNodeIds,
  hidePortHandleNodeIds,
  excludeRichMediaOverlayNodeIds,
  renderEdges,
  renderGroups,
  renderNodes,
  forbidCircleNodes = false,
}: {
  active?: boolean
  graphDataOverride?: GraphData | null
  graphDataRevisionOverride?: number
  collisionDuringDrag?: boolean
  allowNodeDragOverride?: boolean
  exposeRuntimeRef?: (ref: React.MutableRefObject<FlowNativeRuntime | null>) => void
  onInteractionFrame?: () => void
  hideSelectedNodeGlyph?: boolean
  hideSelectedNodePortHandles?: boolean
  hideNodeIds?: string[]
  hidePortHandleNodeIds?: string[]
  excludeRichMediaOverlayNodeIds?: string[]
  renderEdges?: boolean
  renderGroups?: boolean
  renderNodes?: boolean
  forbidCircleNodes?: boolean
}) {
  const containerRef = React.useRef<HTMLElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const runtimeRef = React.useRef<FlowNativeRuntime | null>(null)
  const lastBuiltGraphKeyRef = React.useRef<string>('')
  const lastUserInteractionAtMsRef = React.useRef<number>(0)
  const lastInitTransformZoomViewKeyRef = React.useRef<string | null>(null)
  const lastAppliedPositionsRef = React.useRef<Record<string, { x: number; y: number }> | null>(null)
  const lastCommittedPositionsRef = React.useRef<Record<string, { x: number; y: number }> | null>(null)
  const positionsDirtySinceCommitRef = React.useRef(false)
  const selectedNodeIdsRef = React.useRef<string[]>([])
  const selectedEdgeIdsRef = React.useRef<string[]>([])
  const drawArgsRef = React.useRef<FlowNativeDrawArgs>({
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedGroupId: null,
    showGroupResizeHandle: false,
    hideNodeIds: undefined,
    hidePortHandleNodeIds: undefined,
    renderEdges: undefined,
    renderGroups: undefined,
    renderNodes: undefined,
    grid: null,
    flowEditorWidgetOpenNodeIds: undefined,
    flowEditorWidgetPinnedByNodeId: undefined,
    flowEditorWidgetWorldPosByNodeId: undefined,
  })
  const lastPointerInCanvasRef = React.useRef<null | { sx: number; sy: number; ts: number }>(null)
  const lastWheelIntentRef = React.useRef<null | { dir: 'in' | 'out'; ts: number }>(null)
  const zoomWheelGuardRef = React.useRef(createZoomWheelGuardState())
  const userSelectLockPointerIdRef = React.useRef<number | null>(null)

  const registerCanvasSnapshotFns = useGraphStore(s => s.registerCanvasSnapshotFns)
  const selectedNodeId = useGraphStore(s => (active ? s.selectedNodeId : null))
  const selectedNodeIds = useGraphStore(s => (active ? s.selectedNodeIds : EMPTY_STRING_ARRAY))
  const { width, height, dpr } = useContainerDims(containerRef)
  const viewportW = Math.max(1, Math.floor(width))
  const viewportH = Math.max(1, Math.floor(height))

  React.useEffect(() => {
    if (!active) return
    const capturePng = async (pixelRatio?: number): Promise<Blob | null> => {
      try {
        const canvas = canvasRef.current
        if (!canvas) return null
        const ratio = pixelRatio && pixelRatio > 0 ? pixelRatio : 1
        if (ratio === 1 && typeof canvas.toBlob === 'function') {
          const directBlob = await new Promise<Blob | null>(resolve => {
            canvas.toBlob(b => resolve(b), 'image/png')
          })
          return directBlob || null
        }
        const width = Math.max(1, Math.floor(canvas.width * ratio))
        const height = Math.max(1, Math.floor(canvas.height * ratio))
        const target = document.createElement('canvas')
        target.width = width
        target.height = height
        const ctx = target.getContext('2d')
        if (!ctx) return null
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(canvas, 0, 0, width, height)
        const blob = await new Promise<Blob | null>(resolve => {
          target.toBlob(b => resolve(b), 'image/png')
        })
        return blob || null
      } catch {
        return null
      }
    }

    const captureSvg = async (): Promise<string | null> => {
      try {
        const store = useGraphStore.getState()
        const graphData = (graphDataOverride || store.graphData) as GraphData | null
        const schema = store.schema as GraphSchema | null
        if (!graphData || !schema) return null

        const documentSemanticMode = store.documentSemanticMode === 'keyword' ? 'keyword' : 'document'
        const activeDocumentViewMode = resolveActiveDocumentViewMode({
          frontmatterModeEnabled: store.frontmatterModeEnabled === true,
          multiDimTableModeEnabled: store.multiDimTableModeEnabled === true,
          documentSemanticMode: String(store.documentSemanticMode || 'document'),
          documentStructureBaselineLock: store.documentStructureBaselineLock === true,
        })
        const layoutSemanticModeKey = activeDocumentViewMode === 'multiDimTable' ? `${documentSemanticMode}:mdtbl` : documentSemanticMode
        const frontmatterModeEnabled = computeEffectiveFrontmatterMode({
          frontmatterModeEnabled: store.frontmatterModeEnabled,
          documentSemanticMode: store.documentSemanticMode,
          graphData,
        })

        const markdownDesignBlocks = (() => {
          try {
            const markdownText = String(store.markdownDocumentText || '')
            if (!markdownText.trim()) return []
            const activeDocumentPath = String(store.markdownDocumentName || '').trim() || 'markdown'
            const markdownTokensKey = buildMarkdownTokensKey(markdownText)
            const lexed = lexMarkdown(markdownText)
            const layout = deriveMarkdownDesignLayout({ activeDocumentPath, markdownTokensKey, tokens: lexed.tokens as never })
            return Array.isArray(layout.blocks) ? layout.blocks : []
          } catch {
            return []
          }
        })()

        const svg = await renderGraphCanvasSvgForHtmlExport({
          graphData,
          graphDataRevision: store.graphDataRevision,
          schema,
          widthPx: viewportW,
          heightPx: viewportH,
          viewportControlsPreset: (store as unknown as { viewportControlsPreset?: 'map' | 'design' }).viewportControlsPreset === 'design' ? 'design' : 'map',
          renderMediaAsNodes: store.renderMediaAsNodes === true,
          mediaPanelDensity: store.mediaPanelDensity === 'compact' ? 'compact' : 'default',
          documentSemanticMode,
          frontmatterModeEnabled,
          multiDimTableModeEnabled: store.multiDimTableModeEnabled === true,
          documentStructureBaselineLock: store.documentStructureBaselineLock === true,
          markdownDesignBlocks,
          collapsedGroupIds: store.collapsedGroupIds,
          layoutPositionCacheByMode: store.layoutPositionCacheByMode,
          canvas2dRenderer: store.canvas2dRenderer,
          overlayBaseWidthRatioDefault: (store as unknown as { threeIframeOverlayBaseWidthRatioDefault?: number }).threeIframeOverlayBaseWidthRatioDefault,
          overlayBaseWidthRatioCompact: (store as unknown as { threeIframeOverlayBaseWidthRatioCompact?: number }).threeIframeOverlayBaseWidthRatioCompact,
          overlayBaseWidthMinPxDefault: (store as unknown as { threeIframeOverlayBaseWidthMinPxDefault?: number }).threeIframeOverlayBaseWidthMinPxDefault,
          overlayBaseWidthMinPxCompact: (store as unknown as { threeIframeOverlayBaseWidthMinPxCompact?: number }).threeIframeOverlayBaseWidthMinPxCompact,
          overlayBaseWidthMaxPxDefault: (store as unknown as { threeIframeOverlayBaseWidthMaxPxDefault?: number }).threeIframeOverlayBaseWidthMaxPxDefault,
          overlayBaseWidthMaxPxCompact: (store as unknown as { threeIframeOverlayBaseWidthMaxPxCompact?: number }).threeIframeOverlayBaseWidthMaxPxCompact,
          layoutSemanticModeKey,
        })
        const trimmed = String(svg || '').trim()
        if (!trimmed) return null

        const runtime = runtimeRef.current
        const t = runtime?.transform || null
        if (!t) return trimmed

        try {
          const noXml = trimmed.replace(/^<\?xml[^>]*>\s*/i, '')
          const parser = new DOMParser()
          const doc = parser.parseFromString(noXml, 'image/svg+xml')
          const svgEl = doc.querySelector('svg')
          const g = svgEl?.querySelector('g')
          if (g) g.setAttribute('transform', `translate(${t.x},${t.y}) scale(${t.k})`)
          return svgEl ? svgEl.outerHTML : trimmed
        } catch {
          return trimmed
        }
      } catch {
        return null
      }
    }

    registerCanvasSnapshotFns('2d', { capturePng, captureSvg })
    return () => {
      registerCanvasSnapshotFns('2d', null)
    }
  }, [active, graphDataOverride, registerCanvasSnapshotFns, viewportH, viewportW])

  const [selectionBox, setSelectionBox] = React.useState<null | { left: number; top: number; width: number; height: number }>(null)
  const selectionBoxRafRef = React.useRef<number | null>(null)
  const requestSetSelectionBox = React.useCallback((next: null | { left: number; top: number; width: number; height: number }) => {
    if (selectionBoxRafRef.current != null) cancelAnimationFrame(selectionBoxRafRef.current)
    selectionBoxRafRef.current = requestAnimationFrame(() => {
      selectionBoxRafRef.current = null
      setSelectionBox(prev => {
        if (!prev && !next) return prev
        if (next) {
          const w = clampFinite(next.width, 0, 1_000_000)
          const h = clampFinite(next.height, 0, 1_000_000)
          const maxLeft = Math.max(0, viewportW - w)
          const maxTop = Math.max(0, viewportH - h)
          const left = clampFinite(next.left, 0, maxLeft)
          const top = clampFinite(next.top, 0, maxTop)
          next = { left, top, width: clampFinite(w, 0, viewportW - left), height: clampFinite(h, 0, viewportH - top) }
        }
        if (prev && next && prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height) return prev
        return next
      })
    })
  }, [viewportH, viewportW])

  React.useEffect(() => {
    ensureSpacePanKeyListenerInstalled()
  }, [])

  React.useEffect(() => {
    exposeRuntimeRef?.(runtimeRef)
  }, [exposeRuntimeRef])

  const handleInteractionFrame = React.useCallback(() => {
    lastUserInteractionAtMsRef.current = Date.now()
    mediaOverlayLayoutScheduleRef.current?.()
    onInteractionFrame?.()
  }, [onInteractionFrame])

  const buildDrawArgs = React.useCallback(
    () => drawArgsRef.current,
    [],
  )

  const drawRafRef = React.useRef<number | null>(null)
  const scheduleFlowDraw = React.useCallback(() => {
    if (drawRafRef.current != null) return
    drawRafRef.current = requestAnimationFrame(() => {
      drawRafRef.current = null
      if (!active) return
      const runtime = runtimeRef.current
      if (!runtime) return
      runtime.dirty = true
      requestFlowNativeDraw(runtime, buildDrawArgs())
      mediaOverlayLayoutScheduleRef.current?.()
    })
  }, [active, buildDrawArgs])

  const stopEvent = React.useCallback((event: React.SyntheticEvent) => {
    try {
      event.stopPropagation()
    } catch {
      void 0
    }
  }, [])

  React.useEffect(() => {
    return () => {
      if (drawRafRef.current != null) {
        try {
          cancelAnimationFrame(drawRafRef.current)
        } catch {
          void 0
        }
        drawRafRef.current = null
      }
      const rt = runtimeRef.current
      if (rt?.pendingRaf != null) {
        try {
          cancelAnimationFrame(rt.pendingRaf)
        } catch {
          void 0
        }
        rt.pendingRaf = null
      }
    }
  }, [])
  const collisionSchemaRef = React.useRef<typeof schema | null>(null)
  const collisionGraphDataRef = React.useRef<GraphData | null>(null)
  const collisionFlowConfigRef = React.useRef<typeof flowConfig | null>(null)
  const collisionPresentationRef = React.useRef<typeof flowPresentation | null>(null)
  const dragRef = React.useRef<FlowCanvasDrag>(null)
  const {
    schema,
    frontmatterModeEnabled,
    documentSemanticMode,
    multiDimTableModeEnabled,
    documentStructureBaselineLock,
    collapsedGroupIds,
    renderMediaAsNodes,
    mediaPanelDensity,
    threeIframeOverlayPoolMax,
    threeIframeOverlayBaseWidthRatioDefault,
    threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthMinPxDefault,
    threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlayBaseWidthMaxPxCompact,
    canvasRenderMode,
    canvas2dRenderer,
    infiniteCanvasInteractionMode,
    viewportControlsPreset,
    flowEditorSelectionOnDrag,
    setLayoutPositionsForMode,
    graphDataRevision: baseGraphDataRevision,
    viewPinned,
    fitToScreenMode,
    zoomToSelectionMode,
    setZoomState,
    setZoomStateForKey,
    widgetRegistry,
    baseWidgetRegistry,
    documentWidgetRegistry,
    openWidgetNodeIds,
    flowWidgetPinnedByNodeId,
    flowWidgetWorldPosByNodeId,
    flowWidgetPosByNodeId,
    markdownDocumentName,
    markdownDocumentText,
  } = useGraphStore(
    useShallow(s => {
      if (!active) {
        return {
          schema: s.schema,
          frontmatterModeEnabled: false,
          documentSemanticMode: 'document' as const,
          multiDimTableModeEnabled: false,
          documentStructureBaselineLock: false,
          collapsedGroupIds: EMPTY_STRING_ARRAY,
          renderMediaAsNodes: false,
          mediaPanelDensity: 'default' as const,
          threeIframeOverlayPoolMax: s.threeIframeOverlayPoolMax,
          threeIframeOverlayBaseWidthRatioDefault: s.threeIframeOverlayBaseWidthRatioDefault,
          threeIframeOverlayBaseWidthRatioCompact: s.threeIframeOverlayBaseWidthRatioCompact,
          threeIframeOverlayBaseWidthMinPxDefault: s.threeIframeOverlayBaseWidthMinPxDefault,
          threeIframeOverlayBaseWidthMinPxCompact: s.threeIframeOverlayBaseWidthMinPxCompact,
          threeIframeOverlayBaseWidthMaxPxDefault: s.threeIframeOverlayBaseWidthMaxPxDefault,
          threeIframeOverlayBaseWidthMaxPxCompact: s.threeIframeOverlayBaseWidthMaxPxCompact,
          canvasRenderMode: '2d' as const,
          canvas2dRenderer: 'flow' as const,
          infiniteCanvasInteractionMode: 'static' as const,
          viewportControlsPreset: s.viewportControlsPreset,
          flowEditorSelectionOnDrag: false,
          setLayoutPositionsForMode: s.setLayoutPositionsForMode,
          graphDataRevision: s.graphDataRevision || 0,
          viewPinned: false,
          fitToScreenMode: false,
          zoomToSelectionMode: false,
          setZoomState: s.setZoomState,
          setZoomStateForKey: s.setZoomStateForKey,
          widgetRegistry: EMPTY_WIDGET_REGISTRY,
          baseWidgetRegistry: EMPTY_WIDGET_REGISTRY,
          documentWidgetRegistry: EMPTY_WIDGET_REGISTRY,
          openWidgetNodeIds: EMPTY_STRING_ARRAY,
          flowWidgetPinnedByNodeId: EMPTY_BOOL_RECORD,
          flowWidgetWorldPosByNodeId: EMPTY_POS_RECORD,
          flowWidgetPosByNodeId: EMPTY_POS_RECORD,
          markdownDocumentName: null,
          markdownDocumentText: '',
        }
      }
      return {
        schema: s.schema,
        frontmatterModeEnabled: s.frontmatterModeEnabled || false,
        documentSemanticMode: (s.documentSemanticMode || 'document') as 'document' | 'keyword',
        multiDimTableModeEnabled: (s as unknown as { multiDimTableModeEnabled?: unknown }).multiDimTableModeEnabled === true,
        documentStructureBaselineLock: s.documentStructureBaselineLock === true,
        collapsedGroupIds: s.collapsedGroupIds || [],
        renderMediaAsNodes: s.renderMediaAsNodes,
        mediaPanelDensity: s.mediaPanelDensity,
        threeIframeOverlayPoolMax: s.threeIframeOverlayPoolMax,
        threeIframeOverlayBaseWidthRatioDefault: s.threeIframeOverlayBaseWidthRatioDefault,
        threeIframeOverlayBaseWidthRatioCompact: s.threeIframeOverlayBaseWidthRatioCompact,
        threeIframeOverlayBaseWidthMinPxDefault: s.threeIframeOverlayBaseWidthMinPxDefault,
        threeIframeOverlayBaseWidthMinPxCompact: s.threeIframeOverlayBaseWidthMinPxCompact,
        threeIframeOverlayBaseWidthMaxPxDefault: s.threeIframeOverlayBaseWidthMaxPxDefault,
        threeIframeOverlayBaseWidthMaxPxCompact: s.threeIframeOverlayBaseWidthMaxPxCompact,
        canvasRenderMode: s.canvasRenderMode,
        canvas2dRenderer: s.canvas2dRenderer,
        infiniteCanvasInteractionMode: (s.infiniteCanvasInteractionMode || 'static') as 'static' | 'interactive',
        viewportControlsPreset: s.viewportControlsPreset,
        flowEditorSelectionOnDrag: s.flowEditorSelectionOnDrag === true,
        setLayoutPositionsForMode: s.setLayoutPositionsForMode,
        graphDataRevision: s.graphDataRevision || 0,
        viewPinned: s.viewPinned === true,
        fitToScreenMode: s.fitToScreenMode === true,
        zoomToSelectionMode: s.zoomToSelectionMode === true,
        setZoomState: s.setZoomState,
        setZoomStateForKey: s.setZoomStateForKey,
        widgetRegistry: s.effectiveWidgetRegistry ?? EMPTY_WIDGET_REGISTRY,
        baseWidgetRegistry: s.widgetRegistry ?? EMPTY_WIDGET_REGISTRY,
        documentWidgetRegistry: s.documentWidgetRegistry ?? EMPTY_WIDGET_REGISTRY,
        openWidgetNodeIds: s.openWidgetNodeIds || [],
        flowWidgetPinnedByNodeId: s.flowWidgetPinnedByNodeId || {},
        flowWidgetWorldPosByNodeId: (s as unknown as { flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }> }).flowWidgetWorldPosByNodeId || {},
        flowWidgetPosByNodeId: s.flowWidgetPosByNodeId || {},
        markdownDocumentName: (s as unknown as { markdownDocumentName?: unknown }).markdownDocumentName,
        markdownDocumentText: (s as unknown as { markdownDocumentText?: unknown }).markdownDocumentText,
      }
    }),
  )

  const graphDataRevision = typeof graphDataRevisionOverride === 'number' ? graphDataRevisionOverride : baseGraphDataRevision

  const stickyOverlayNodeByIdRef = React.useRef<Map<string, MediaOverlayNode>>(new Map())
  const stickyOverlayOrderRef = React.useRef<string[]>([])
  const mediaOverlayElsRef = React.useRef<Map<string, HTMLElement>>(new Map())
  const panelOnlyNodeIdSetRef = React.useRef<Set<string> | null>(null)
  const plannedOverlayNodeIdSetRef = React.useRef<Set<string>>(new Set())

  const updateOverlayHiddenDrawArgs = React.useCallback(() => {
    drawArgsRef.current.hideNodeIds = (() => {
      const explicit = (hideNodeIds || []).map(v => String(v)).filter(Boolean)
      const overlays = Array.from(plannedOverlayNodeIdSetRef.current)
      const base = explicit.length > 0 || overlays.length > 0 ? Array.from(new Set([...explicit, ...overlays])) : []
      if (hideSelectedNodeGlyph) return Array.from(new Set([...(selectedNodeIdsRef.current || []), ...base]))
      return base.length > 0 ? base : undefined
    })()
    drawArgsRef.current.hidePortHandleNodeIds = (() => {
      const explicit = (hidePortHandleNodeIds || []).map(v => String(v)).filter(Boolean)
      const overlays = Array.from(plannedOverlayNodeIdSetRef.current)
      const base = explicit.length > 0 || overlays.length > 0 ? Array.from(new Set([...explicit, ...overlays])) : []
      if (hideSelectedNodePortHandles) return Array.from(new Set([...(selectedNodeIdsRef.current || []), ...base]))
      return base.length > 0 ? base : undefined
    })()
    scheduleFlowDraw()
  }, [hideNodeIds, hidePortHandleNodeIds, hideSelectedNodeGlyph, hideSelectedNodePortHandles, scheduleFlowDraw])

  const markdownPanelAllowedKinds = React.useMemo(() => {
    const activeDocumentViewMode = resolveActiveDocumentViewMode({
      frontmatterModeEnabled: frontmatterModeEnabled === true,
      multiDimTableModeEnabled: multiDimTableModeEnabled === true,
      documentSemanticMode: String(documentSemanticMode || 'document'),
      documentStructureBaselineLock: documentStructureBaselineLock === true,
    })
    if (activeDocumentViewMode === 'multiDimTable') return ['code', 'blockquote', 'callout', 'html'] as const
    return ['table', 'code', 'blockquote', 'callout', 'html'] as const
  }, [documentSemanticMode, documentStructureBaselineLock, frontmatterModeEnabled, multiDimTableModeEnabled])

  React.useEffect(() => {
    drawArgsRef.current.showGroupResizeHandle = readAllowGroupResize(schema)
    drawArgsRef.current.grid = readCanvasGridRenderConfigFromSchema(schema)
    updateOverlayHiddenDrawArgs()
    drawArgsRef.current.renderEdges = renderEdges
    drawArgsRef.current.renderGroups = renderGroups
    drawArgsRef.current.renderNodes = renderNodes
    if (canvas2dRenderer === 'flowEditor') {
      drawArgsRef.current.flowEditorWidgetOpenNodeIds = openWidgetNodeIds || []
      drawArgsRef.current.flowEditorWidgetPinnedByNodeId = flowWidgetPinnedByNodeId || {}
      drawArgsRef.current.flowEditorWidgetWorldPosByNodeId = flowWidgetWorldPosByNodeId || {}
    } else {
      drawArgsRef.current.flowEditorWidgetOpenNodeIds = undefined
      drawArgsRef.current.flowEditorWidgetPinnedByNodeId = undefined
      drawArgsRef.current.flowEditorWidgetWorldPosByNodeId = undefined
    }
  }, [
    active,
    buildDrawArgs,
    canvas2dRenderer,
    flowWidgetPinnedByNodeId,
    flowWidgetWorldPosByNodeId,
    openWidgetNodeIds,
    renderEdges,
    renderGroups,
    renderNodes,
    renderMediaAsNodes,
    schema,
    updateOverlayHiddenDrawArgs,
  ])

  useAutoZoomModes2d({
    viewportW,
    viewportH,
    paused: !active,
  })

  const schemaLayoutEngineJson = React.useMemo(() => buildSchemaLayoutEngineJson2d(schema), [schema])

  const storeGraphData = useActiveGraphRenderData(active)
  const renderGraphData = graphDataOverride !== undefined ? graphDataOverride : storeGraphData

  const allowMutations = allowNodeDragOverride !== false && documentStructureBaselineLock !== true
  const effectiveFrontmatter = React.useMemo(() => {
    return computeEffectiveFrontmatterMode({
      frontmatterModeEnabled: frontmatterModeEnabled === true,
      documentSemanticMode,
      graphData: renderGraphData,
    })
  }, [documentSemanticMode, frontmatterModeEnabled, renderGraphData])
  const flowEditorFrontmatterInteractionMode = isFlowEditorFrontmatterDocumentModeRequested({
    canvas2dRenderer: String(canvas2dRenderer || ''),
    frontmatterModeEnabled: frontmatterModeEnabled === true,
    documentSemanticMode: String(documentSemanticMode || ''),
  })
  // Overlay drag/resize interaction should be renderer-gated (Flow Editor SSOT),
  // while frontmatter/document mode remains the stricter gate for other semantics.
  const flowEditorOverlayInteractionMode = canvas2dRenderer === 'flowEditor'

  const collapsedGroupIdsKey = React.useMemo(() => {
    return buildCollapsedGroupIdsKey(collapsedGroupIds)
  }, [collapsedGroupIds])

  const clonedGraphData = React.useMemo(() => {
    if (!renderGraphData) return null
    return cloneGraphDataForRender(renderGraphData) as GraphData
  }, [renderGraphData])

  const filteredGraphDataForRenderer = React.useMemo(() => {
    return pickGraphDataForFlowRenderer({ graphData: clonedGraphData, effectiveFrontmatter })
  }, [clonedGraphData, effectiveFrontmatter])

  const sceneDisplayGraphDerivation = React.useMemo(() => {
    if (!filteredGraphDataForRenderer) return null
    return deriveSceneDisplayGraph({ graphData: filteredGraphDataForRenderer })
  }, [filteredGraphDataForRenderer])

  const sceneGraphData = React.useMemo(() => {
    if (!filteredGraphDataForRenderer) return null
    return sceneDisplayGraphDerivation?.displayGraphData || filteredGraphDataForRenderer
  }, [filteredGraphDataForRenderer, sceneDisplayGraphDerivation])

  const selectedOverlayNodeIds = React.useMemo(() => {
    const nodeIdSet = new Set<string>((selectedNodeIds || []).map(v => String(v)))
    if (selectedNodeId) nodeIdSet.add(String(selectedNodeId))
    const ids = Array.from(nodeIdSet)
      .map(rawId => {
        const resolved = resolveGraphNodeByCanonicalId(sceneGraphData, rawId)
        return String(resolved?.id || rawId || '').trim()
      })
      .filter(Boolean)
    return ids
  }, [sceneGraphData, selectedNodeId, selectedNodeIds])

  const panelOnlyNodeIdSet = React.useMemo(() => {
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData!.nodes as unknown as GraphNode[]) : []
    if (nodes.length === 0) return null
    const set = buildPanelOnlyNodeIdSetFromGraphNodes(nodes)
    return set.size > 0 ? set : null
  }, [sceneGraphData])
  React.useEffect(() => {
    panelOnlyNodeIdSetRef.current = panelOnlyNodeIdSet
    updateOverlayHiddenDrawArgs()
  }, [panelOnlyNodeIdSet, updateOverlayHiddenDrawArgs])

  React.useEffect(() => {
    if (!panelOnlyNodeIdSet) return
    const next = new Set<string>(plannedOverlayNodeIdSetRef.current)
    for (const id of panelOnlyNodeIdSet) next.add(id)
    plannedOverlayNodeIdSetRef.current = next
    updateOverlayHiddenDrawArgs()
  }, [panelOnlyNodeIdSet, updateOverlayHiddenDrawArgs])

  const mediaRenderConnectedValuesByNodeId = React.useMemo(() => {
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData!.nodes as unknown as GraphNode[]) : []
    if (nodes.length === 0) return new Map()
    const dataflowRegistry = buildDataflowWidgetRegistry({
      documentWidgetRegistry,
      effectiveWidgetRegistry: widgetRegistry,
      widgetRegistry: baseWidgetRegistry,
    })
    return computeFlowConnectedValuesBySchemaPath({
      graphData: sceneGraphData,
      registry: dataflowRegistry,
    })
  }, [baseWidgetRegistry, sceneGraphData, widgetRegistry, documentWidgetRegistry])

  const mediaRenderNodes = React.useMemo(() => {
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData!.nodes as unknown as GraphNode[]) : []
    if (nodes.length === 0) return nodes
    return nodes.map(node => {
      const nodeId = String(node?.id || '').trim()
      return applyConnectedValuesToNodeForRender({
        node,
        connectedValuesBySchemaPath: nodeId ? mediaRenderConnectedValuesByNodeId.get(nodeId) || undefined : undefined,
      })
    })
  }, [mediaRenderConnectedValuesByNodeId, sceneGraphData])

  const flowEditorRichMediaPanelOverlayExcludeNodeIdSet = React.useMemo(() => {
    if (canvas2dRenderer !== 'flowEditor') return undefined
    const candidateRawIds = [
      ...(Array.isArray(openWidgetNodeIds) ? openWidgetNodeIds : []),
      ...(Array.isArray(excludeRichMediaOverlayNodeIds) ? excludeRichMediaOverlayNodeIds : []),
    ]
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData!.nodes as unknown as GraphNode[]) : []
    if (nodes.length === 0) return undefined
    const nodeById = new Map<string, GraphNode>()
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]!
      const id = String(node?.id || '').trim()
      if (!id) continue
      nodeById.set(id, node)
    }
    const out = new Set<string>()
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]!
      const id = String(node?.id || '').trim()
      if (!id) continue
      if (!isRichMediaPanelNode(node)) continue
      out.add(id)
    }
    for (let i = 0; i < candidateRawIds.length; i += 1) {
      const rawId = candidateRawIds[i]
      const id = String(resolveGraphNodeByCanonicalId(sceneGraphData, rawId)?.id || rawId || '').trim()
      if (!id) continue
      if (!isRichMediaPanelNode(nodeById.get(id))) continue
      out.add(id)
    }
    return out.size > 0 ? out : undefined
  }, [canvas2dRenderer, excludeRichMediaOverlayNodeIds, openWidgetNodeIds, sceneGraphData])

  const mediaNodes = React.useMemo(() => {
    const nodes = mediaRenderNodes
    const poolMaxRaw = typeof threeIframeOverlayPoolMax === 'number' && Number.isFinite(threeIframeOverlayPoolMax) ? threeIframeOverlayPoolMax : 0
    const poolMax = poolMaxRaw > 0 ? poolMaxRaw : 24
    const suggested = listDisplayRichMediaOverlayNodes({
      renderMediaAsNodes,
      nodes,
      poolMax,
      excludeNodeIdSet: flowEditorRichMediaPanelOverlayExcludeNodeIdSet,
      connectedValuesByNodeId: mediaRenderConnectedValuesByNodeId,
    })

    const pinnedOrder = Array.from(mediaOverlayElsRef.current.keys())
    const prevOrder = stickyOverlayOrderRef.current
    const stickyMap = stickyOverlayNodeByIdRef.current
    for (let i = 0; i < suggested.length; i += 1) {
      const n = suggested[i]!
      stickyMap.set(n.id, n)
    }

    const needed = new Set<string>()
    for (let i = 0; i < pinnedOrder.length; i += 1) {
      const id = String(pinnedOrder[i] || '').trim()
      if (id) needed.add(id)
    }
    for (let i = 0; i < prevOrder.length; i += 1) {
      const id = String(prevOrder[i] || '').trim()
      if (id) needed.add(id)
    }
    for (let i = 0; i < suggested.length; i += 1) {
      const id = String(suggested[i]!.id || '').trim()
      if (id) needed.add(id)
    }
    const nodeById = new Map<string, GraphNode>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]!
      const id = String(n?.id || '').trim()
      if (!id) continue
      if (!needed.has(id)) continue
      nodeById.set(id, n)
    }
    const isValid = (id: string): boolean => {
      const key = String(id || '').trim()
      if (!key) return false
      const n = nodeById.get(key)
      if (!n) return false
      return !!getNodeMediaSpec(n)
    }

    const nextIds: string[] = []
    for (let i = 0; i < pinnedOrder.length; i += 1) {
      if (nextIds.length >= poolMax) break
      const id = String(pinnedOrder[i] || '').trim()
      if (!id) continue
      if (nextIds.includes(id)) continue
      if (!stickyMap.has(id)) continue
      if (!isValid(id)) continue
      nextIds.push(id)
    }
    for (let i = 0; i < prevOrder.length; i += 1) {
      if (nextIds.length >= poolMax) break
      const id = String(prevOrder[i] || '').trim()
      if (!id) continue
      if (nextIds.includes(id)) continue
      if (!stickyMap.has(id)) continue
      if (!isValid(id)) continue
      nextIds.push(id)
    }
    for (let i = 0; i < suggested.length; i += 1) {
      if (nextIds.length >= poolMax) break
      const id = String(suggested[i]!.id || '').trim()
      if (!id) continue
      if (nextIds.includes(id)) continue
      nextIds.push(id)
    }

    stickyOverlayOrderRef.current = nextIds
    const out: MediaOverlayNode[] = []
    for (let i = 0; i < nextIds.length; i += 1) {
      const n = stickyMap.get(nextIds[i]!)
      if (n) out.push(n)
    }
    if (stickyMap.size > Math.max(96, poolMax * 6)) {
      const keep = new Set<string>(nextIds)
      for (let i = 0; i < suggested.length; i += 1) keep.add(String(suggested[i]!.id || ''))
      for (const [id] of stickyMap) {
        if (!keep.has(id)) stickyMap.delete(id)
      }
    }
    return out
  }, [flowEditorRichMediaPanelOverlayExcludeNodeIdSet, mediaRenderConnectedValuesByNodeId, mediaRenderNodes, threeIframeOverlayPoolMax])

  const overlayNodes = mediaNodes
  React.useEffect(() => {
    __flowCanvasDebug.sceneNodeIds = Array.isArray(sceneGraphData?.nodes)
      ? sceneGraphData!.nodes.map(node => String((node as GraphNode | null | undefined)?.id || '').trim()).filter(Boolean)
      : []
  }, [sceneGraphData])
  React.useEffect(() => {
    __flowCanvasDebug.mediaNodeIds = mediaNodes.map(n => String(n.id || '').trim()).filter(Boolean)
  }, [mediaNodes])
  React.useEffect(() => {
    __flowCanvasDebug.overlayNodeIds = overlayNodes.map(n => String(n.id || '').trim()).filter(Boolean)
  }, [overlayNodes])
  React.useEffect(() => {
    try {
      ;(window as unknown as { __flowCanvasDebug?: unknown }).__flowCanvasDebug = __flowCanvasDebug
      return () => {
        try {
          const w = window as unknown as { __flowCanvasDebug?: unknown }
          if (w.__flowCanvasDebug === __flowCanvasDebug) delete w.__flowCanvasDebug
        } catch {
          void 0
        }
      }
    } catch {
      return () => void 0
    }
  }, [])

  const plannedOverlayNodeIdsKey = React.useMemo(() => {
    const ids: string[] = []
    for (let i = 0; i < mediaNodes.length; i += 1) {
      const id = String(mediaNodes[i]?.id || '').trim()
      if (id) ids.push(id)
    }
    if (panelOnlyNodeIdSetRef.current) {
      for (const id of panelOnlyNodeIdSetRef.current) ids.push(id)
    }
    const sorted = ids.length <= 1 ? ids : Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b))
    plannedOverlayNodeIdSetRef.current = new Set(sorted)
    return sorted.join('|')
  }, [mediaNodes])

  const mediaNodeIdsKey = React.useMemo(() => mediaNodes.map(n => n.id).join('|'), [mediaNodes])
  React.useEffect(() => {
    const next = new Map<string, HTMLElement>()
    for (const n of mediaNodes) {
      const existing = mediaOverlayElsRef.current.get(n.id)
      if (existing) next.set(n.id, existing)
    }
    mediaOverlayElsRef.current = next
  }, [mediaNodeIdsKey, mediaNodes])

  React.useEffect(() => {
    if (!plannedOverlayNodeIdsKey) return
    updateOverlayHiddenDrawArgs()
  }, [plannedOverlayNodeIdsKey, updateOverlayHiddenDrawArgs])

  const mediaOverlayHeaderDragRef = React.useRef<null | { id: string; pointerId: number; startX: number; startY: number; startK: number; lastDx: number; lastDy: number }>(null)
  const mediaOverlayPanRef = React.useRef<null | { pointerId: number; startTransform: d3.ZoomTransform; lastDx: number; lastDy: number }>(null)
  const mediaOverlayResizeRef = React.useRef<null | { id: string; pointerId: number; startW: number; startH: number; startScale: number; headerH: number; bodyAspect: number; lastW: number; lastH: number }>(null)
  const mediaOverlayPanelSizeOverrideRef = React.useRef<Map<string, { w: number; h: number }>>(new Map())
  const mediaOverlayPanelSizeTargetWorldRef = React.useRef<Map<string, { w: number; h: number }>>(new Map())
  const mediaOverlayPanMoveSchedulerRef = React.useRef<RafLatestScheduler<{ pointerId: number; clientX: number; clientY: number; dx: number; dy: number; buttons: number; shiftKey: boolean }> | null>(null)
  const mediaOverlayPanMoveLatestRef = React.useRef<{ pointerId: number; clientX: number; clientY: number; dx: number; dy: number; buttons: number; shiftKey: boolean } | null>(null)
  const mediaOverlayHeaderMoveSchedulerRef = React.useRef<RafLatestScheduler<{ id: string; pointerId: number; dx: number; dy: number }> | null>(null)
  const mediaOverlayHeaderMoveLatestRef = React.useRef<{ id: string; pointerId: number; dx: number; dy: number } | null>(null)
  const mediaOverlayResizeMoveSchedulerRef = React.useRef<RafLatestScheduler<{ id: string; pointerId: number; dx: number; dy: number }> | null>(null)
  const mediaOverlayResizeMoveLatestRef = React.useRef<{ id: string; pointerId: number; dx: number; dy: number } | null>(null)
  const requestCommitRef = React.useRef<null | (() => void)>(null)
  const mediaOverlayLayoutScheduleRef = React.useRef<null | (() => void)>(null)
  const isFlowEditorOverlayInteractionMode = React.useCallback(() => {
    const st = useGraphStore.getState() as unknown as {
      canvas2dRenderer?: unknown
    }
    if (String(st.canvas2dRenderer || '') !== 'flowEditor') return false
    return true
  }, [])
  const isFlowEditorFrontmatterDocumentInteractionMode = React.useCallback(() => {
    return isFlowEditorFrontmatterDocumentModeRequested({
      canvas2dRenderer: String(canvas2dRenderer || ''),
      frontmatterModeEnabled: frontmatterModeEnabled === true,
      documentSemanticMode: String(documentSemanticMode || ''),
    })
  }, [canvas2dRenderer, documentSemanticMode, frontmatterModeEnabled])
  const writeRichMediaResizeTrace = React.useCallback((parts: Array<string | number>) => {
    try {
      __flowCanvasDebug.lastRichMediaResizeTrace = parts.map(v => String(v)).join('|')
    } catch {
      void 0
    }
  }, [])

  const beginMediaOverlayHeaderDrag = React.useCallback((id: string, pointerId: number) => {
    if (!active) return
    if (!isFlowEditorOverlayInteractionMode()) return
    const rt = runtimeRef.current
    const scene = rt?.scene
    if (!rt || !scene) return
    const node = scene.nodeById.get(id)
    if (!node) return
    disableAutoZoomModesForUserGesture(useGraphStore.getState())
    mediaOverlayHeaderDragRef.current = { id, pointerId, startX: node.x, startY: node.y, startK: rt.transform?.k || 1, lastDx: 0, lastDy: 0 }
  }, [active, isFlowEditorOverlayInteractionMode])

  const beginMediaOverlayPan = React.useCallback((args: { pointerId: number; clientX: number; clientY: number; buttons: number; shiftKey: boolean }) => {
    if (!active) return
    if (!isFlowEditorOverlayInteractionMode()) return
    const rt = runtimeRef.current
    if (!rt) return
    disableAutoZoomModesForUserGesture(useGraphStore.getState())
    mediaOverlayPanRef.current = {
      pointerId: args.pointerId,
      startTransform: rt.transform || d3.zoomIdentity,
      lastDx: 0,
      lastDy: 0,
    }
  }, [active, isFlowEditorOverlayInteractionMode])

  const applyMediaOverlayPanMove = React.useCallback((args: { pointerId: number; clientX: number; clientY: number; dx: number; dy: number; buttons: number; shiftKey: boolean }) => {
    if (!isFlowEditorOverlayInteractionMode()) return
    const drag = mediaOverlayPanRef.current
    if (!drag || drag.pointerId !== args.pointerId) return
    const rt = runtimeRef.current
    if (!rt) return
    drag.lastDx = args.dx
    drag.lastDy = args.dy
    const st = useGraphStore.getState() as unknown as { canvasPanSpeedMultiplier?: unknown; canvasInteractionSpeedMultiplier?: unknown }
    const next = computeOverlayPanTransform2d({
      startTransform: drag.startTransform,
      dxClientPx: args.dx,
      dyClientPx: args.dy,
      canvasPanSpeedMultiplier: st.canvasPanSpeedMultiplier,
      canvasInteractionSpeedMultiplier: st.canvasInteractionSpeedMultiplier,
      applySpeedMultipliers: true,
    })
    setFlowNativeTransform(rt, next)
    requestFlowNativeDraw(rt, buildDrawArgs())
    onInteractionFrame?.()
  }, [buildDrawArgs, isFlowEditorOverlayInteractionMode, onInteractionFrame])

  const moveMediaOverlayPan = React.useCallback((args: { pointerId: number; clientX: number; clientY: number; dx: number; dy: number; buttons: number; shiftKey: boolean }) => {
    mediaOverlayPanMoveLatestRef.current = args
    if (!mediaOverlayPanMoveSchedulerRef.current) {
      mediaOverlayPanMoveSchedulerRef.current = createRafLatestScheduler((queued) => {
        applyMediaOverlayPanMove(queued)
      })
    }
    mediaOverlayPanMoveSchedulerRef.current.schedule(args)
  }, [applyMediaOverlayPanMove])

  const endMediaOverlayPan = React.useCallback((args: { pointerId: number; clientX: number; clientY: number; buttons: number; shiftKey: boolean }) => {
    if (!isFlowEditorOverlayInteractionMode()) return
    const drag = mediaOverlayPanRef.current
    if (!drag || drag.pointerId !== args.pointerId) return
    mediaOverlayPanMoveSchedulerRef.current?.cancel()
    const pending = mediaOverlayPanMoveLatestRef.current
    if (pending && pending.pointerId === args.pointerId) {
      applyMediaOverlayPanMove(pending)
    }
    mediaOverlayPanMoveLatestRef.current = null
    mediaOverlayPanRef.current = null
    requestCommitRef.current?.()
  }, [applyMediaOverlayPanMove, isFlowEditorOverlayInteractionMode])

  const applyMediaOverlayHeaderDragMove = React.useCallback((id: string, args: { pointerId: number; dx: number; dy: number }) => {
    if (!isFlowEditorOverlayInteractionMode()) return
    const drag = mediaOverlayHeaderDragRef.current
    if (!drag || drag.id !== id || drag.pointerId !== args.pointerId) return
    const rt = runtimeRef.current
    const scene = rt?.scene
    if (!rt || !scene) return
    const node = scene.nodeById.get(id)
    if (!node) return
    drag.lastDx = args.dx
    drag.lastDy = args.dy
    const p = computeOverlayDraggedPoint2d({
      baseX: drag.startX,
      baseY: drag.startY,
      dxClientPx: args.dx,
      dyClientPx: args.dy,
      zoomK: drag.startK,
      schema,
      snapToGrid: false,
    })
    node.x = p.x
    node.y = p.y
    rt.dirty = true
    positionsDirtySinceCommitRef.current = true
    requestFlowNativeDraw(rt, buildDrawArgs())
    mediaOverlayLayoutScheduleRef.current?.()
    onInteractionFrame?.()
  }, [buildDrawArgs, isFlowEditorOverlayInteractionMode, onInteractionFrame])

  const beginMediaOverlayResize = React.useCallback((id: string, pointerId: number) => {
    if (!active) {
      writeRichMediaResizeTrace(['phase=skip', 'reason=inactive', `id=${id}`, `pid=${pointerId}`])
      return
    }
    if (!isFlowEditorOverlayInteractionMode()) {
      writeRichMediaResizeTrace(['phase=skip', 'reason=renderer', `id=${id}`, `pid=${pointerId}`])
      return
    }
    if (!isFlowEditorFrontmatterDocumentInteractionMode()) {
      writeRichMediaResizeTrace(['phase=skip', 'reason=frontmatter-document-gate', `id=${id}`, `pid=${pointerId}`])
      return
    }
    const rt = runtimeRef.current
    const scene = rt?.scene
    if (!rt || !scene) {
      writeRichMediaResizeTrace(['phase=skip', 'reason=runtime-scene', `id=${id}`, `pid=${pointerId}`])
      return
    }
    disableAutoZoomModesForUserGesture(useGraphStore.getState())

    const rawK = rt.transform?.k
    const zoomK = typeof rawK === 'number' && Number.isFinite(rawK) && rawK > 0 ? rawK : 1
    const scale = computeWidgetScale(zoomK, null, { mode: 'pinnedInCanvas' })
    const el = mediaOverlayElsRef.current.get(id) || null
    const rect = el ? el.getBoundingClientRect() : null
    const measuredW = rect && Number.isFinite(rect.width) ? rect.width : 0
    const measuredH = rect && Number.isFinite(rect.height) ? rect.height : 0

    const headerPx = (() => {
      if (!el) return 0
      const headerEl = el.querySelector('[data-kg-media-panel-header="1"]') as HTMLElement | null
      if (!headerEl) return 0
      const r = headerEl.getBoundingClientRect()
      return r && Number.isFinite(r.height) ? r.height : 0
    })()
    const headerWorldH = Math.max(0, headerPx / Math.max(0.001, scale))

    const startW = Math.max(24, Math.round(measuredW / Math.max(0.001, scale)))
    const startH = Math.max(24, Math.round(measuredH / Math.max(0.001, scale)))
    const baseProps = (() => {
      const st = useGraphStore.getState() as unknown as { graphData?: unknown }
      const gd = st.graphData as { nodes?: unknown } | null | undefined
      const nodes = Array.isArray(gd?.nodes) ? (gd!.nodes as Array<{ id?: unknown; properties?: unknown }>) : []
      const node = nodes.find(n => String(n?.id || '') === id) || null
      const props = node?.properties
      if (!props || typeof props !== 'object' || Array.isArray(props)) return {}
      return props as Record<string, unknown>
    })()
    const storedW = Number(baseProps['visual:width'])
    const storedH = Number(baseProps['visual:height'])
    const useW = Number.isFinite(storedW) && storedW > 0 ? Math.max(24, Math.round(storedW)) : startW
    const useH = Number.isFinite(storedH) && storedH > 0 ? Math.max(24, Math.round(storedH)) : startH

    const bodyH0 = Math.max(24, useH - headerWorldH)
    const bodyAspect = Math.max(0.001, bodyH0 / Math.max(1, useW))
    const stableH = Math.max(24 + headerWorldH, Math.round(useW * bodyAspect + headerWorldH))
    mediaOverlayResizeRef.current = {
      id,
      pointerId,
      startW: useW,
      startH: stableH,
      startScale: scale,
      headerH: headerWorldH,
      bodyAspect,
      lastW: useW,
      lastH: stableH,
    }
    mediaOverlayPanelSizeOverrideRef.current.set(id, { w: useW * scale, h: stableH * scale })
    mediaOverlayPanelSizeTargetWorldRef.current.set(id, { w: useW, h: stableH })
    try {
      __flowCanvasDebug.lastRichMediaResizeTarget = id
    } catch {
      void 0
    }
    writeRichMediaResizeTrace([
      'phase=start',
      `id=${id}`,
      `pid=${pointerId}`,
      `startW=${useW}`,
      `startH=${stableH}`,
      `scale=${scale.toFixed(4)}`,
      `headerH=${headerWorldH.toFixed(2)}`,
      `aspect=${bodyAspect.toFixed(5)}`,
    ])
    mediaOverlayLayoutScheduleRef.current?.()
    onInteractionFrame?.()
  }, [active, isFlowEditorFrontmatterDocumentInteractionMode, isFlowEditorOverlayInteractionMode, onInteractionFrame, writeRichMediaResizeTrace])

  const applyMediaOverlayResizeMove = React.useCallback((id: string, args: { pointerId: number; dx: number; dy: number }) => {
    if (!isFlowEditorOverlayInteractionMode()) return
    const drag = mediaOverlayResizeRef.current
    if (!drag || drag.id !== id || drag.pointerId !== args.pointerId) return
    const scale = Math.max(0.001, drag.startScale)
    const headerH = Math.max(0, drag.headerH)
    const bodyAspect = Math.max(0.001, drag.bodyAspect)
    const wFromDx = drag.startW + args.dx / scale
    const wFromDy = Math.max(1, (drag.startH + args.dy / scale) - headerH) / bodyAspect
    const chosenW = Math.abs(args.dy) > Math.abs(args.dx) ? wFromDy : wFromDx
    const nextW = Math.max(24, Math.round(chosenW))
    const nextH = Math.max(24 + headerH, Math.round(nextW * bodyAspect + headerH))
    drag.lastW = nextW
    drag.lastH = nextH
    mediaOverlayPanelSizeOverrideRef.current.set(id, { w: nextW * scale, h: nextH * scale })
    mediaOverlayPanelSizeTargetWorldRef.current.set(id, { w: nextW, h: nextH })
    writeRichMediaResizeTrace([
      'phase=move',
      `id=${id}`,
      `pid=${args.pointerId}`,
      `dx=${Math.round(args.dx)}`,
      `dy=${Math.round(args.dy)}`,
      `nextW=${nextW}`,
      `nextH=${nextH}`,
    ])
    mediaOverlayLayoutScheduleRef.current?.()
    onInteractionFrame?.()
  }, [isFlowEditorOverlayInteractionMode, onInteractionFrame, writeRichMediaResizeTrace])

  const moveMediaOverlayResize = React.useCallback((id: string, args: { pointerId: number; dx: number; dy: number }) => {
    const next = { id, ...args }
    mediaOverlayResizeMoveLatestRef.current = next
    if (!mediaOverlayResizeMoveSchedulerRef.current) {
      mediaOverlayResizeMoveSchedulerRef.current = createRafLatestScheduler(
        (queued: { id: string; pointerId: number; dx: number; dy: number }) => {
          applyMediaOverlayResizeMove(queued.id, queued)
        },
      )
    }
    mediaOverlayResizeMoveSchedulerRef.current.schedule(next)
  }, [applyMediaOverlayResizeMove])

  const endMediaOverlayResize = React.useCallback((id: string, pointerId: number) => {
    if (!isFlowEditorOverlayInteractionMode()) return
    const drag = mediaOverlayResizeRef.current
    if (!drag || drag.id !== id || drag.pointerId !== pointerId) return
    mediaOverlayResizeMoveSchedulerRef.current?.cancel()
    const pending = mediaOverlayResizeMoveLatestRef.current
    if (pending && pending.id === id && pending.pointerId === pointerId) {
      applyMediaOverlayResizeMove(id, pending)
    }
    mediaOverlayResizeMoveLatestRef.current = null
    mediaOverlayResizeRef.current = null
    try {
      const st = useGraphStore.getState() as unknown as { graphData?: unknown; updateNode?: (id: string, updates: { properties: Record<string, unknown> }) => void }
      const gd = st.graphData as { nodes?: unknown } | null | undefined
      const nodes = Array.isArray(gd?.nodes) ? (gd!.nodes as Array<{ id?: unknown; properties?: unknown }>) : []
      const node = nodes.find(n => String(n?.id || '') === id) || null
      const baseProps = node?.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
        ? (node.properties as Record<string, unknown>)
        : {}
      const nextProps = { ...baseProps, 'visual:width': drag.lastW, 'visual:height': drag.lastH }
      st.updateNode?.(id, { properties: nextProps })
    } catch {
      void 0
    }
    writeRichMediaResizeTrace([
      'phase=end',
      `id=${id}`,
      `pid=${pointerId}`,
      `finalW=${drag.lastW}`,
      `finalH=${drag.lastH}`,
    ])
    mediaOverlayLayoutScheduleRef.current?.()
    requestCommitRef.current?.()
  }, [applyMediaOverlayResizeMove, isFlowEditorOverlayInteractionMode, writeRichMediaResizeTrace])

  React.useEffect(() => {
    if (flowEditorOverlayInteractionMode !== true) {
      mediaOverlayPanelSizeOverrideRef.current.clear()
      mediaOverlayPanelSizeTargetWorldRef.current.clear()
      return
    }
    const targets = mediaOverlayPanelSizeTargetWorldRef.current
    if (targets.size === 0) return

    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData!.nodes as unknown as Array<{ id?: unknown; properties?: unknown }>) : []
    const byId = new Map<string, Record<string, unknown>>()
    for (let i = 0; i < nodes.length; i += 1) {
      const id = String(nodes[i]?.id || '').trim()
      if (!id) continue
      const props = nodes[i]?.properties
      if (!props || typeof props !== 'object' || Array.isArray(props)) continue
      byId.set(id, props as Record<string, unknown>)
    }

    let changed = false
    for (const [id, t] of targets.entries()) {
      const props = byId.get(id) || null
      if (!props) continue
      const w = Number(props['visual:width'])
      const h = Number(props['visual:height'])
      if (!Number.isFinite(w) || !Number.isFinite(h)) continue
      if (Math.abs(w - t.w) <= 0.5 && Math.abs(h - t.h) <= 0.5) {
        targets.delete(id)
        mediaOverlayPanelSizeOverrideRef.current.delete(id)
        changed = true
      }
    }
    if (changed) {
      mediaOverlayLayoutScheduleRef.current?.()
    }
  }, [flowEditorOverlayInteractionMode, sceneGraphData])

  const moveMediaOverlayHeaderDrag = React.useCallback((id: string, args: { pointerId: number; dx: number; dy: number }) => {
    const next = { id, ...args }
    mediaOverlayHeaderMoveLatestRef.current = next
    if (!mediaOverlayHeaderMoveSchedulerRef.current) {
      mediaOverlayHeaderMoveSchedulerRef.current = createRafLatestScheduler(
        (queued: { id: string; pointerId: number; dx: number; dy: number }) => {
          applyMediaOverlayHeaderDragMove(queued.id, queued)
        },
      )
    }
    mediaOverlayHeaderMoveSchedulerRef.current.schedule(next)
  }, [applyMediaOverlayHeaderDragMove])

  const endMediaOverlayHeaderDrag = React.useCallback((id: string, pointerId: number) => {
    if (!isFlowEditorOverlayInteractionMode()) return
    const drag = mediaOverlayHeaderDragRef.current
    if (!drag || drag.id !== id || drag.pointerId !== pointerId) return
    mediaOverlayHeaderMoveSchedulerRef.current?.cancel()
    const pending = mediaOverlayHeaderMoveLatestRef.current
    if (pending && pending.id === id && pending.pointerId === pointerId) {
      applyMediaOverlayHeaderDragMove(id, pending)
    }
    mediaOverlayHeaderMoveLatestRef.current = null
    const rt = runtimeRef.current
    const scene = rt?.scene
    const node = scene?.nodeById.get(id)
    if (node) {
      try {
        const p = computeOverlayDraggedPoint2d({
          baseX: drag.startX,
          baseY: drag.startY,
          dxClientPx: drag.lastDx,
          dyClientPx: drag.lastDy,
          zoomK: drag.startK,
          schema,
          snapToGrid: false,
        })
        node.x = p.x
        node.y = p.y
      } catch {
        void 0
      }
    }
    mediaOverlayHeaderDragRef.current = null
    requestCommitRef.current?.()
  }, [applyMediaOverlayHeaderDragMove, isFlowEditorOverlayInteractionMode, schema])

  React.useEffect(() => {
    return () => {
      mediaOverlayPanMoveSchedulerRef.current?.cancel()
      mediaOverlayPanMoveLatestRef.current = null
      mediaOverlayPanRef.current = null
      mediaOverlayHeaderMoveSchedulerRef.current?.cancel()
      mediaOverlayHeaderMoveLatestRef.current = null
      mediaOverlayResizeMoveSchedulerRef.current?.cancel()
      mediaOverlayResizeMoveLatestRef.current = null
      mediaOverlayPanelSizeOverrideRef.current.clear()
      mediaOverlayPanelSizeTargetWorldRef.current.clear()
    }
  }, [])

  React.useEffect(() => {
    if (canvas2dRenderer === 'flowEditor') return
    mediaOverlayPanMoveSchedulerRef.current?.cancel()
    mediaOverlayPanMoveLatestRef.current = null
    mediaOverlayPanRef.current = null
    mediaOverlayHeaderMoveSchedulerRef.current?.cancel()
    mediaOverlayHeaderMoveLatestRef.current = null
    mediaOverlayHeaderDragRef.current = null
    mediaOverlayResizeMoveSchedulerRef.current?.cancel()
    mediaOverlayResizeMoveLatestRef.current = null
    mediaOverlayResizeRef.current = null
    mediaOverlayPanelSizeOverrideRef.current.clear()
    mediaOverlayPanelSizeTargetWorldRef.current.clear()
  }, [canvas2dRenderer])

  const overlayNodeIdsKey = React.useMemo(() => overlayNodes.map(n => n.id).join('|'), [overlayNodes])

  React.useEffect(() => {
    if (!active) return
    if (overlayNodes.length === 0) return
    const density = normalizeRichMediaPanelDensity(mediaPanelDensity)
    const widthRatioRaw = density === 'compact' ? threeIframeOverlayBaseWidthRatioCompact : threeIframeOverlayBaseWidthRatioDefault
    const widthMinRaw = density === 'compact' ? threeIframeOverlayBaseWidthMinPxCompact : threeIframeOverlayBaseWidthMinPxDefault
    const widthMaxRaw = density === 'compact' ? threeIframeOverlayBaseWidthMaxPxCompact : threeIframeOverlayBaseWidthMaxPxDefault

    const loop = startMediaOverlayLayoutLoop2d({
      enabled: true,
      loop: 'onDemand',
      items: overlayNodes,
      density,
      viewportW,
      viewportH,
      readTransform: () => runtimeRef.current?.transform || d3.zoomIdentity,
      computeSizingZoomK: (zoomK) => {
        if (flowEditorFrontmatterInteractionMode !== true) return zoomK
        return computeWidgetScale(zoomK, null, { mode: 'pinnedInCanvas' })
      },
      getPanelSizeForId: (id) => {
        if (flowEditorFrontmatterInteractionMode !== true) return null

        const override = mediaOverlayPanelSizeOverrideRef.current.get(id)
        if (override) {
          try {
            __flowCanvasDebug.lastRichMediaResizeTrace = [
              'phase=layout-override',
              `id=${id}`,
              `w=${Math.round(override.w)}`,
              `h=${Math.round(override.h)}`,
            ].join('|')
            __flowCanvasDebug.lastRichMediaResizeTarget = id
          } catch {
            void 0
          }
          return override
        }

        const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData!.nodes as unknown as Array<{ id?: unknown; properties?: unknown }>) : []
        const node = nodes.find(n => String(n?.id || '') === id) || null
        const props = node?.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
          ? (node.properties as Record<string, unknown>)
          : null
        if (!props) return null
        const w0 = Number(props['visual:width'])
        const h0 = Number(props['visual:height'])
        if (!Number.isFinite(w0) || !Number.isFinite(h0) || w0 <= 0 || h0 <= 0) return null

        const rt = runtimeRef.current
        const rawK = rt?.transform?.k
        const zoomK = typeof rawK === 'number' && Number.isFinite(rawK) && rawK > 0 ? rawK : 1
        const scale = computeWidgetScale(zoomK, null, { mode: 'pinnedInCanvas' })
        return { w: Math.max(24, w0) * scale, h: Math.max(24, h0) * scale }
      },
      getElementForId: (id) => mediaOverlayElsRef.current.get(id) || null,
      getNodeWorldCenterForId: (id) => {
        const rt = runtimeRef.current
        const node = rt?.scene?.nodeById.get(id) as unknown as { x?: unknown; y?: unknown; width?: unknown; height?: unknown } | undefined
        return readNodeCenterWorld2d(node, { coords: 'topLeft' })
      },
      sizingConfig: {
        widthRatio: Number.isFinite(widthRatioRaw) ? Math.max(0.001, Number(widthRatioRaw)) : 0.2,
        widthMinPx: Number.isFinite(widthMinRaw) ? Math.max(1, Math.floor(widthMinRaw)) : 210,
        widthMaxPx: Number.isFinite(widthMaxRaw) ? Math.max(1, Math.floor(widthMaxRaw)) : 360,
        quantizeStepPx: flowEditorFrontmatterInteractionMode ? 1 : 16,
      },
    })
    mediaOverlayLayoutScheduleRef.current = loop.schedule
    loop.schedule()
    return () => {
      loop.stop()
      if (mediaOverlayLayoutScheduleRef.current === loop.schedule) {
        mediaOverlayLayoutScheduleRef.current = null
      }
    }
  }, [
    active,
    overlayNodes,
    overlayNodeIdsKey,
    sceneGraphData,
    flowEditorFrontmatterInteractionMode,
    mediaPanelDensity,
    renderMediaAsNodes,
    threeIframeOverlayBaseWidthMaxPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMinPxDefault,
    threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthRatioDefault,
    viewportW,
    viewportH,
  ])

  const layoutViewKey = React.useMemo(() => {
    return buildLayoutViewKey({
      schemaLayoutEngineJson,
      frontmatterModeEnabled: effectiveFrontmatter,
      documentSemanticMode: String(documentSemanticMode),
      graphMetaKey: buildGraphMetaKeyIgnoringPending(sceneGraphData),
      renderMediaAsNodes: renderMediaAsNodes === true,
      mediaPanelDensity: String(mediaPanelDensity),
      collapsedGroupIdsKey,
    })
  }, [
    collapsedGroupIdsKey,
    documentSemanticMode,
    effectiveFrontmatter,
    mediaPanelDensity,
    renderMediaAsNodes,
    schemaLayoutEngineJson,
    sceneGraphData,
  ])

  const zoomViewKey = React.useMemo(() => {
    return buildZoomViewKey({
      canvasRenderMode,
      canvas2dRenderer,
      schemaLayoutEngineJson,
      frontmatterModeEnabled: effectiveFrontmatter,
      documentSemanticMode: String(documentSemanticMode),
      graphMetaKey: buildGraphMetaKeyIgnoringPending(sceneGraphData),
      renderMediaAsNodes: renderMediaAsNodes === true,
      mediaPanelDensity: String(mediaPanelDensity),
      collapsedGroupIdsKey,
    })
  }, [
    canvas2dRenderer,
    canvasRenderMode,
    collapsedGroupIdsKey,
    documentSemanticMode,
    effectiveFrontmatter,
    mediaPanelDensity,
    renderMediaAsNodes,
    schemaLayoutEngineJson,
    sceneGraphData,
  ])

  React.useEffect(() => {
    __flowCanvasDebug.lastZoomViewKey = zoomViewKey
  }, [zoomViewKey])

  const frontmatterFlowRenderSettings = React.useMemo(() => {
    return readFrontmatterFlowRenderSettings(sceneGraphData)
  }, [sceneGraphData])

  const layoutMode = schema ? readLayoutMode(schema) : 'radial'
  const rankdir =
    layoutMode === 'block'
      ? 'LR'
      : frontmatterFlowRenderSettings?.rankdir || deriveRankdir({ flowRankdir: schema?.layout?.flow?.rankdir })
  const flowConfig = React.useMemo(() => readFlowConfig({ schema, rankdir }), [rankdir, schema])
  const flowConfigEffective = React.useMemo(() => {
    if (documentSemanticMode !== 'keyword') return flowConfig
    const explicitElkLayout = schema?.layout?.flow?.elkLayout
    if (typeof explicitElkLayout === 'string' && explicitElkLayout.trim()) return flowConfig
    if (flowConfig.engine !== 'auto' && flowConfig.engine !== 'elk') return flowConfig
    if (flowConfig.elk.algorithm !== 'layered') return flowConfig
    return { ...flowConfig, elk: { ...flowConfig.elk, algorithm: 'stress' as const } }
  }, [documentSemanticMode, flowConfig, schema?.layout?.flow?.elkLayout])
  const flowPresentation = React.useMemo(() => {
    const p = readFlowPresentation({ schema, documentSemanticMode })
    const gd = sceneGraphData as unknown as { context?: unknown; metadata?: unknown } | null
    const metaKind = (() => {
      const meta = gd?.metadata
      if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return ''
      return String((meta as Record<string, unknown>).kind || '').trim()
    })()
    const isFrontmatterFlow = metaKind === 'frontmatter-flow'
    const isMermaidLayout = (() => {
      if (!gd) return false
      if (String(gd.context || '') === 'frontmatter-mermaid') return true
      const meta = gd.metadata
      if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false
      return String((meta as Record<string, unknown>).layoutEngine || '') === 'mermaid'
    })()
    const base =
      !isMermaidLayout
        ? p
        : {
            ...p,
            edges: {
              ...p.edges,
              underlay: { ...p.edges.underlay, enabled: false },
            },
          }
    if (!isFrontmatterFlow) return base
    return {
      ...base,
      edges: {
        ...base.edges,
        edgeType: frontmatterFlowRenderSettings?.edgeType || base.edges.edgeType,
      },
      portHandles: {
        ...base.portHandles,
        enabled: true,
        sizePx: Math.max(10, base.portHandles.sizePx),
        offsetPx: Math.max(4, base.portHandles.offsetPx),
        strokeWidthPx: Math.max(1.5, base.portHandles.strokeWidthPx),
      },
    }
  }, [documentSemanticMode, frontmatterFlowRenderSettings?.edgeType, schema, sceneGraphData])

  const layoutVariant = React.useMemo(() => {
    return [
      `e=${flowConfigEffective.engine}`,
      `rd=${rankdir}`,
      `dir=${flowConfigEffective.elk.direction}`,
      `alg=${flowConfigEffective.elk.algorithm}`,
      `n=${flowConfigEffective.node.widthPx}x${flowConfigEffective.node.heightPx}`,
      `s=${flowConfigEffective.elk.nodeNodeSpacingPx},${flowConfigEffective.elk.layerSpacingPx},${flowConfigEffective.elk.edgeNodeSpacingPx}`,
      `h=${flowConfigEffective.handle.sizePx},${flowConfigEffective.handle.lineHeightPx}`,
      'cs=topLeftV2',
    ].join('|')
  }, [flowConfigEffective, rankdir])

  const sceneGroupsDerivation = React.useMemo(() => {
    return deriveSceneGroups({
      graphData: filteredGraphDataForRenderer,
      graphDataRevision,
      schema,
      documentSemanticMode: String(documentSemanticMode || ''),
      frontmatterModeEnabled: !!effectiveFrontmatter,
      multiDimTableModeEnabled: multiDimTableModeEnabled === true,
      documentStructureBaselineLock: documentStructureBaselineLock === true,
    })
  }, [
    documentSemanticMode,
    documentStructureBaselineLock,
    effectiveFrontmatter,
    filteredGraphDataForRenderer,
    graphDataRevision,
    multiDimTableModeEnabled,
    schema,
  ])

  const sceneGroups = React.useMemo(() => {
    if (!flowPresentation.groups.enabled) return []
    return sceneGroupsDerivation?.allGroups || []
  }, [flowPresentation.groups.enabled, sceneGroupsDerivation])

  const datasetKey = React.useMemo(() => {
    return computeLayoutDatasetKey({
      graphData: sceneGraphData as unknown as { metadata?: unknown; nodes?: Array<{ type?: unknown; properties?: unknown; metadata?: unknown }> } | null,
      graphDataRevision,
    })
  }, [graphDataRevision, sceneGraphData])

  const cacheKey = React.useMemo(() => {
    return buildLayoutPositionCacheKey({
      datasetKey,
      mode: layoutMode,
      frontmatterMode: effectiveFrontmatter,
      semanticMode: documentSemanticMode,
      renderMode: '2d',
      viewKey: layoutViewKey,
      renderVariant: canvas2dRenderer,
      layoutVariant,
    })
  }, [canvas2dRenderer, datasetKey, documentSemanticMode, effectiveFrontmatter, layoutMode, layoutVariant, layoutViewKey])

  const layoutPositionsForMode = useGraphStore(s => (cacheKey ? (s.layoutPositionCacheByMode?.[cacheKey] ?? null) : null))

  const computedPositions = useFlowComputedPositions({
    active,
    cacheKey,
    datasetKey,
    graphDataRevision,
    layoutMode,
    layoutVariant,
    flowEditorMode: canvas2dRenderer === 'flowEditor',
    documentSemanticMode: String(documentSemanticMode || 'document'),
    effectiveFrontmatter,
    layoutViewKey,
    rankdir,
    sceneGraphData,
    sceneGroups,
    schema,
    flowConfig: flowConfigEffective,
    flowPresentation,
    layoutPositionsForMode,
    setLayoutPositionsForMode,
  })

  React.useEffect(() => {
    if (!active) return
    lastAppliedPositionsRef.current = null
  }, [active, cacheKey])

  const seededFallbackPositions = React.useMemo(() => {
    if (computedPositions) return null
    const g = sceneGraphData
    const nodes = Array.isArray(g?.nodes) ? (g!.nodes as GraphNode[]) : ([] as GraphNode[])
    if (nodes.length < 2) return null

    const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
    let finiteCount = 0
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    const seen = new Set<string>()
    for (let i = 0; i < nodes.length; i += 1) {
      const id = String(nodes[i]?.id || '').trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      const x = (nodes[i] as unknown as { x?: unknown }).x
      const y = (nodes[i] as unknown as { y?: unknown }).y
      if (!isFiniteNum(x) || !isFiniteNum(y)) continue
      finiteCount += 1
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }

    const spanX = maxX === -Infinity ? 0 : maxX - minX
    const spanY = maxY === -Infinity ? 0 : maxY - minY
    const looksCollapsed = finiteCount >= 2 && spanX < 1 && spanY < 1
    const shouldSeedAll = finiteCount < 2 || looksCollapsed

    const ids = nodes
      .map(n => String((n as unknown as { id?: unknown })?.id || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
    if (ids.length < 2) return null

    const gap = 48
    const cellW = Math.max(120, Math.floor(flowConfigEffective.node.widthPx + gap))
    const cellH = Math.max(120, Math.floor(flowConfigEffective.node.heightPx + gap))
    const seeded = placeFlowFallbackSeedPositions({ ids, cellW, cellH })

    const next: Record<string, { x: number; y: number }> = {}
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i]!
      if (!shouldSeedAll) {
        const n = nodes.find(nn => String((nn as unknown as { id?: unknown })?.id || '').trim() === id) || null
        const x0 = n ? (n as unknown as { x?: unknown }).x : null
        const y0 = n ? (n as unknown as { y?: unknown }).y : null
        if (isFiniteNum(x0) && isFiniteNum(y0)) continue
      }
      const pos = seeded[id]
      if (!pos) continue
      next[id] = pos
    }
    return Object.keys(next).length > 0 ? next : null
  }, [computedPositions, flowConfigEffective.node.heightPx, flowConfigEffective.node.widthPx, sceneGraphData])

  const graphDataForZoom = React.useMemo(() => {
    if (!sceneGraphData) return null
    const pos = computedPositions || seededFallbackPositions
    if (!pos) return sceneGraphData
    const nodes = Array.isArray(sceneGraphData.nodes) ? sceneGraphData.nodes : []
    const nextNodes = nodes.map(n => {
      const id = String(n.id || '')
      const p = id ? pos[id] : null
      if (!p) return n
      return { ...n, x: p.x, y: p.y }
    })
    return { ...sceneGraphData, nodes: nextNodes }
  }, [computedPositions, sceneGraphData, seededFallbackPositions])

  const nodesForFlowTransformGuard = React.useMemo(() => {
    const isFlowEditor = canvas2dRenderer === 'flowEditor'
    const base = (Array.isArray(graphDataForZoom?.nodes) ? graphDataForZoom!.nodes : []) as GraphNode[]
    if (!isFlowEditor) return base
    const pos = computedPositions || seededFallbackPositions
    if (!pos) return base
    const out: GraphNode[] = []
    for (let i = 0; i < base.length; i += 1) {
      const n = base[i]
      const id = String((n as unknown as { id?: unknown })?.id || '').trim()
      if (!id) continue
      const p = pos[id]
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
      out.push({ ...n, x: p.x, y: p.y })
    }
    return out
  }, [canvas2dRenderer, computedPositions, graphDataForZoom, seededFallbackPositions])

  const nodesForFlowZoom = React.useMemo(() => {
    const isFlowEditor = canvas2dRenderer === 'flowEditor'
    const baseForFit = (Array.isArray(graphDataForZoom?.nodes) ? graphDataForZoom!.nodes : []) as GraphNode[]
    const base = isFlowEditor ? nodesForFlowTransformGuard : baseForFit
    return coerceNodesForFit({
      nodes: base,
      coords: 'topLeft',
      defaultW: flowConfigEffective.node.widthPx,
      defaultH: flowConfigEffective.node.heightPx,
      setVisualRect: true,
    })
  }, [canvas2dRenderer, flowConfigEffective.node.heightPx, flowConfigEffective.node.widthPx, graphDataForZoom, nodesForFlowTransformGuard])

  const mediaPanelWorldSizeForFit = React.useMemo(() => {
    const density = normalizeRichMediaPanelDensity(mediaPanelDensity)
    const widthRatioRaw = density === 'compact' ? threeIframeOverlayBaseWidthRatioCompact : threeIframeOverlayBaseWidthRatioDefault
    const widthRatio = Number.isFinite(widthRatioRaw) ? Math.max(0.001, Number(widthRatioRaw)) : 0.2
    const widthMinRaw = density === 'compact' ? threeIframeOverlayBaseWidthMinPxCompact : threeIframeOverlayBaseWidthMinPxDefault
    const widthMin = Number.isFinite(widthMinRaw) ? Math.max(1, Math.floor(widthMinRaw)) : 210
    const widthMaxRaw = density === 'compact' ? threeIframeOverlayBaseWidthMaxPxCompact : threeIframeOverlayBaseWidthMaxPxDefault
    const widthMax = Number.isFinite(widthMaxRaw) ? Math.max(1, Math.floor(widthMaxRaw)) : 360
    const sizing = computeMediaOverlaySizing({
      density,
      viewportW,
      zoomK: 1,
      config: { widthRatio, widthMinPx: widthMin, widthMaxPx: widthMax },
    })
    return { panelW: sizing.panelW, panelH: sizing.panelH }
  }, [
    mediaPanelDensity,
    threeIframeOverlayBaseWidthMaxPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMinPxDefault,
    threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthRatioDefault,
    viewportW,
  ])

  React.useEffect(() => {
    if (!active) return
    const onResetZoomFloor = () => {
      const runtime = runtimeRef.current
      if (!runtime) return
      setFlowAutoMinScale(runtime, null)
    }
    window.addEventListener(FLOW_RESET_ZOOM_FLOOR_CACHE_EVENT, onResetZoomFloor as EventListener)
    return () => {
      window.removeEventListener(FLOW_RESET_ZOOM_FLOOR_CACHE_EVENT, onResetZoomFloor as EventListener)
    }
  }, [active])

  const nodesForFlowZoomCollective = React.useMemo(() => {
    if (!Array.isArray(nodesForFlowZoom) || nodesForFlowZoom.length === 0) return nodesForFlowZoom
    if (!Array.isArray(mediaNodes) || mediaNodes.length === 0) return nodesForFlowZoom
    const nodeById = new Map<string, GraphNode>()
    for (let i = 0; i < nodesForFlowZoom.length; i += 1) {
      const n = nodesForFlowZoom[i]
      const id = String(n?.id || '').trim()
      if (!id) continue
      nodeById.set(id, n)
    }
    const panelW = Math.max(2, Number(mediaPanelWorldSizeForFit.panelW) || 2)
    const panelH = Math.max(2, Number(mediaPanelWorldSizeForFit.panelH) || 2)
    const extras: GraphNode[] = []
    for (let i = 0; i < mediaNodes.length; i += 1) {
      const id = String(mediaNodes[i]?.id || '').trim()
      if (!id) continue
      const base = nodeById.get(id)
      if (!base) continue
      const x = typeof base.x === 'number' && Number.isFinite(base.x) ? base.x : null
      const y = typeof base.y === 'number' && Number.isFinite(base.y) ? base.y : null
      if (x == null || y == null) continue
      extras.push({
        id: `__fit_media_panel__:${id}`,
        type: 'MediaPanel',
        label: '',
        x,
        y,
        properties: {
          'visual:shape': 'rect',
          'visual:width': panelW,
          'visual:height': panelH,
        },
      })
    }
    return extras.length > 0 ? [...nodesForFlowZoom, ...extras] : nodesForFlowZoom
  }, [mediaNodes, mediaPanelWorldSizeForFit.panelH, mediaPanelWorldSizeForFit.panelW, nodesForFlowZoom])

  const flowEditorReservedW = React.useMemo(() => {
    if (canvas2dRenderer !== 'flowEditor') return 0
    const openCount = openWidgetNodeIds.length
    if (openCount <= 0) return 0
    const pinnedById = flowWidgetPinnedByNodeId || {}
    let unpinnedCount = 0
    for (let i = 0; i < openWidgetNodeIds.length; i += 1) {
      const id = String(openWidgetNodeIds[i] || '').trim()
      if (!id) continue
      const v = pinnedById[id]
      const pinnedInCanvas = typeof v === 'boolean' ? v : true
      if (!pinnedInCanvas) unpinnedCount += 1
    }
    if (unpinnedCount <= 0) return 0

    const port = schema?.behavior?.portHandles || null
    const portEnabled = Boolean((port as { enabled?: unknown } | null)?.enabled)
    const portSizePx =
      typeof (port as { size?: unknown } | null)?.size === 'number' && Number.isFinite((port as { size: number }).size)
        ? Math.max(0, (port as { size: number }).size)
        : 4
    const portOffsetPx =
      typeof (port as { offset?: unknown } | null)?.offset === 'number' && Number.isFinite((port as { offset: number }).offset)
        ? Math.max(0, (port as { offset: number }).offset)
        : 2
    const portExtraPadPx = portEnabled ? Math.floor((portSizePx + portOffsetPx + 8) * 0.7) : 0

    const gapPx = (() => {
      const flow = schema?.layout?.flow
      const overlay = flow && typeof flow === 'object' ? (flow as { overlay?: { collisionGapPx?: unknown } }).overlay : null
      const raw = overlay ? overlay.collisionGapPx : null
      const base = typeof raw === 'number' && Number.isFinite(raw) ? raw : 12
      return Math.max(0, Math.min(40, Math.floor(base)))
    })()

    const marginLeft = 20
    const marginRight = 20
    const marginTop = 96
    const marginBottom = 24
    const cellW = WIDGET_BASE_SIZE.width + gapPx + portExtraPadPx
    const cellH = Math.round(WIDGET_BASE_SIZE.height * 0.76) + gapPx
    const rowsMax = Math.max(1, Math.floor((viewportH - marginTop - marginBottom) / Math.max(1, cellH)))
    const colsNeeded = Math.max(1, Math.ceil(unpinnedCount / rowsMax))
    const colsMax = Math.max(1, Math.min(3, Math.floor((viewportW - marginLeft - marginRight) / Math.max(1, cellW))))
    const cols = Math.max(1, Math.min(colsNeeded, colsMax))
    const dockWidth = cols * cellW - gapPx
    const raw = dockWidth + marginRight + 12
    return Math.max(0, Math.min(Math.floor(viewportW * 0.72), Math.floor(raw)))
  }, [
    canvas2dRenderer,
    flowWidgetPinnedByNodeId,
    openWidgetNodeIds,
    schema?.behavior?.portHandles,
    schema?.layout?.flow,
    viewportH,
    viewportW,
  ])

  const graphDataForZoomRequests = React.useMemo(() => {
    if (!graphDataForZoom) return null
    return { ...graphDataForZoom, nodes: nodesForFlowZoomCollective }
  }, [graphDataForZoom, nodesForFlowZoomCollective])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    if (canvas2dRenderer !== 'flowEditor') {
      setFlowAutoMinScale(runtime, null)
      return
    }
    const nodes = nodesForFlowZoom
    if (!Array.isArray(nodes) || nodes.length === 0) {
      setFlowAutoMinScale(runtime, null)
      return
    }
    const mode = readLayoutMode(schema)
    const opts = readFitAllOptions({ schema, mode, intent: 'fitToView' })
    const activeDocumentViewMode = resolveActiveDocumentViewMode({
      frontmatterModeEnabled: frontmatterModeEnabled === true,
      multiDimTableModeEnabled: multiDimTableModeEnabled === true,
      documentSemanticMode: String(documentSemanticMode || 'document'),
      documentStructureBaselineLock: documentStructureBaselineLock === true,
    })
    if (activeDocumentViewMode === 'documentStructure') {
      opts.detectClusters = false
      opts.includeGroupsBounds = true
      opts.deriveGroupsOptions = { forceDocumentStructure: true }
      opts.schema = {
        ...schema,
        layout: {
          ...(schema?.layout || {}),
          groups: {
            ...(schema?.layout?.groups || {}),
            enabled: true,
          },
        },
      } as GraphSchema
    }
    const fitW = Math.max(1, viewportW - flowEditorReservedW)
    const port = schema?.behavior?.portHandles || null
    const portEnabled = Boolean((port as { enabled?: unknown } | null)?.enabled)
    const portSizePx =
      typeof (port as { size?: unknown } | null)?.size === 'number' && Number.isFinite((port as { size: number }).size)
        ? Math.max(0, (port as { size: number }).size)
        : 4
    const portOffsetPx =
      typeof (port as { offset?: unknown } | null)?.offset === 'number' && Number.isFinite((port as { offset: number }).offset)
        ? Math.max(0, (port as { offset: number }).offset)
        : 2
    const portExtraPadScreenPx = portEnabled ? portSizePx + portOffsetPx + 8 : 0

    const fit = fitFlowEditorPinnedWidgets({
      nodes,
      fitW,
      viewportH,
      viewportW,
      openWidgetNodeIds,
      pinnedById: flowWidgetPinnedByNodeId || {},
      worldPosById: flowWidgetWorldPosByNodeId || {},
      portExtraPadScreenPx,
      graphData: graphDataForZoomRequests,
      fitOpts: opts,
    })
    const k = typeof fit?.k === 'number' && Number.isFinite(fit.k) ? fit.k : null
    setFlowAutoMinScale(runtime, k != null && k > 0 ? k : null)
  }, [
    active,
    canvas2dRenderer,
    documentSemanticMode,
    documentStructureBaselineLock,
    flowEditorReservedW,
    frontmatterModeEnabled,
    flowWidgetPinnedByNodeId,
    flowWidgetWorldPosByNodeId,
    flowWidgetPosByNodeId,
    graphDataForZoomRequests,
    multiDimTableModeEnabled,
    nodesForFlowZoom,
    openWidgetNodeIds,
    schema,
    viewportH,
    viewportW,
  ])

  React.useEffect(() => {
    collisionSchemaRef.current = schema
    collisionGraphDataRef.current =
      graphDataForZoom && typeof graphDataForZoom === 'object'
        ? (graphDataForZoom as GraphData)
        : sceneGraphData && typeof sceneGraphData === 'object'
          ? (sceneGraphData as GraphData)
          : null
    collisionFlowConfigRef.current = flowConfigEffective
    collisionPresentationRef.current = flowPresentation
  }, [flowConfigEffective, flowPresentation, graphDataForZoom, schema, sceneGraphData])

  const requestCommit = useFlowRequestCommit({
    cacheKey,
    flowConfig: flowConfigEffective,
    flowPresentation,
    graphDataRevision,
    runtimeRef,
    graphDataForZoomRef: collisionGraphDataRef,
    schemaRef: collisionSchemaRef,
    disableRelaxOnCommit: canvas2dRenderer === 'flowEditor',
    setLayoutPositionsForMode,
    setZoomState,
    setZoomStateForKey,
    viewportW,
    viewportH,
    zoomViewKey,
    positionsDirtySinceCommitRef,
    lastCommittedPositionsRef,
    buildDrawArgs,
  })
  requestCommitRef.current = requestCommit

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    const pos = computedPositions
    if (!pos) return
    if (lastAppliedPositionsRef.current === pos) return
    lastAppliedPositionsRef.current = pos

    const scene = runtime.scene
    if (!scene) return
    let applied = 0
    for (let i = 0; i < scene.nodes.length; i += 1) {
      const n = scene.nodes[i]
      const p = pos[n.id]
      if (!p) continue
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
      n.x = p.x
      n.y = p.y
      applied += 1
    }
    if (applied > 0) runtime.positionsReady = true
    runtime.dirty = true
    scheduleFlowDraw()
    if (!cacheKey || typeof setLayoutPositionsForMode !== 'function') return
    lastCommittedPositionsRef.current = pos
  }, [active, buildDrawArgs, cacheKey, computedPositions, setLayoutPositionsForMode])

  React.useEffect(() => {
    if (!active) return
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    if (runtimeRef.current) return
    const ctx = canvasEl.getContext('2d')
    if (!ctx) return
    runtimeRef.current = createFlowNativeRuntime({
      canvas: canvasEl,
      ctx,
      viewportW,
      viewportH,
      dpr,
      rankdir,
      initialTransform: d3.zoomIdentity,
    })
  }, [active, dpr, rankdir, viewportH, viewportW])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    setFlowNativeViewport(runtime, { viewportW, viewportH, dpr })
    const canvasEl = runtime.canvas
    const nextW = Math.max(1, Math.floor(viewportW * dpr))
    const nextH = Math.max(1, Math.floor(viewportH * dpr))
    const resized = canvasEl.width !== nextW || canvasEl.height !== nextH
    if (canvasEl.width !== nextW) canvasEl.width = nextW
    if (canvasEl.height !== nextH) canvasEl.height = nextH
    if (resized) runtime.dirty = true
    scheduleFlowDraw()
  }, [active, buildDrawArgs, dpr, viewportH, viewportW])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    if (!graphDataForZoom) return

    const isFlowEditor = canvas2dRenderer === 'flowEditor'
    const effectiveFitToScreenMode = fitToScreenMode
    const effectiveZoomToSelectionMode = zoomToSelectionMode

    const nodesForTransformGuard = nodesForFlowTransformGuard
    const nodesForFit = nodesForFlowZoomCollective

    if (documentSemanticMode === 'keyword') {
      const meta = (sceneGraphData?.metadata || null) as Record<string, unknown> | null
      if (meta && meta.pending === true) return
    }

    const initKey = zoomViewKey
    const alreadyInitializedForKey = lastInitTransformZoomViewKeyRef.current === initKey
    const t0 = runtime.transform || d3.zoomIdentity
    const hasNonIdentityTransform = t0.k !== 1 || t0.x !== 0 || t0.y !== 0
    if (isFlowEditor && alreadyInitializedForKey) return
    if (!isFlowEditor && alreadyInitializedForKey && hasNonIdentityTransform) return

    const now = Date.now()
    const lastInteraction = lastUserInteractionAtMsRef.current
    if (lastInteraction && now - lastInteraction < 500) return

    const st = useGraphStore.getState()
    const z = pickZoomStateForView({
      zoomViewKey,
      zoomStateByKey: st.zoomStateByKey,
      viewPinned,
      fitToScreenMode: effectiveFitToScreenMode,
      zoomToSelectionMode: effectiveZoomToSelectionMode,
    })
    const initial = pickInitialZoomTransform({
      zoomState: z,
      pinned: viewPinned,
      graphDataRevision,
      nextViewportW: viewportW,
      nextViewportH: viewportH,
    })
    const schema = useGraphStore.getState().schema
    const mode = readLayoutMode(schema)
    const opts = readFitAllOptions({ schema, mode, intent: effectiveFitToScreenMode ? 'fitToScreen' : 'initialFit' })
    const activeDocumentViewMode = resolveActiveDocumentViewMode({
      frontmatterModeEnabled: frontmatterModeEnabled === true,
      multiDimTableModeEnabled: multiDimTableModeEnabled === true,
      documentSemanticMode: String(documentSemanticMode || 'document'),
      documentStructureBaselineLock: documentStructureBaselineLock === true,
    })

    // In Document Structure Mode, enforce collective fit + center by disabling cluster detection
    // and ensuring groups are included in the bounds calculation.
    if (activeDocumentViewMode === 'documentStructure') {
      opts.detectClusters = false
      opts.includeGroupsBounds = true
      opts.deriveGroupsOptions = { forceDocumentStructure: true }
      // Force enable groups in the schema copy passed to fitAllTransform so it calculates their bounds
      // even if the base schema has them disabled.
      opts.schema = {
        ...schema,
        layout: {
          ...(schema?.layout || {}),
          groups: {
            ...(schema?.layout?.groups || {}),
            enabled: true,
          },
        },
      } as GraphSchema
    }

    if (isFlowEditor && nodesForTransformGuard.length === 0) return

    const fitW = Math.max(1, viewportW - (isFlowEditor ? flowEditorReservedW : 0))
    const fit = isFlowEditor
      ? (() => {
          const port = schema?.behavior?.portHandles || null
          const portEnabled = Boolean((port as { enabled?: unknown } | null)?.enabled)
          const portSizePx =
            typeof (port as { size?: unknown } | null)?.size === 'number' && Number.isFinite((port as { size: number }).size)
              ? Math.max(0, (port as { size: number }).size)
              : 4
          const portOffsetPx =
            typeof (port as { offset?: unknown } | null)?.offset === 'number' && Number.isFinite((port as { offset: number }).offset)
              ? Math.max(0, (port as { offset: number }).offset)
              : 2
          const portExtraPadScreenPx = portEnabled ? portSizePx + portOffsetPx + 8 : 0
          return fitFlowEditorPinnedWidgets({
            nodes: nodesForFit,
            fitW,
            viewportH,
            viewportW,
            openWidgetNodeIds,
            pinnedById: flowWidgetPinnedByNodeId || {},
            worldPosById: flowWidgetWorldPosByNodeId || {},
            portExtraPadScreenPx,
            graphData: graphDataForZoomRequests,
            fitOpts: opts,
          })
        })()
      : fitAllTransform(nodesForFit, fitW, viewportH, { ...opts, graphData: graphDataForZoomRequests || undefined })
    const fallbackInitial =
      !initial && !effectiveFitToScreenMode && !effectiveZoomToSelectionMode && hasNonIdentityTransform
        ? { k: t0.k, x: t0.x, y: t0.y }
        : null
    const seeded = initial || fallbackInitial
    const centered = (() => {
      if (effectiveFitToScreenMode || effectiveZoomToSelectionMode) return null
      if (!nodesForFit || nodesForFit.length === 0) return null
      if (isFlowEditor) {
        const zoomK = 1
        const targetSx = fitW / 2
        const targetSy = viewportH / 2

        let sumX = 0
        let sumY = 0
        let count = 0
        for (let i = 0; i < nodesForFit.length; i += 1) {
          const n = nodesForFit[i] as unknown as { x?: unknown; y?: unknown }
          const x = typeof n?.x === 'number' && Number.isFinite(n.x) ? (n.x as number) : null
          const y = typeof n?.y === 'number' && Number.isFinite(n.y) ? (n.y as number) : null
          if (x == null || y == null) continue
          sumX += x
          sumY += y
          count += 1
        }
        const openIds = openWidgetNodeIds || []
        const pinnedById = flowWidgetPinnedByNodeId || {}
        const worldById = flowWidgetWorldPosByNodeId || {}
        const panelScale = computeWidgetScale(zoomK, null, { mode: 'pinnedInCanvas' })
        const panelScreen = computeWidgetScaledSize(panelScale)
        const panelWorldW = panelScreen.width / Math.max(0.001, zoomK)
        const panelWorldH = panelScreen.height / Math.max(0.001, zoomK)
        for (let i = 0; i < openIds.length; i += 1) {
          const id = String(openIds[i] || '').trim()
          if (!id) continue
          const v = pinnedById[id]
          const pinned = typeof v === 'boolean' ? v : true
          if (!pinned) continue
          const wp = worldById[id]
          if (!wp || !Number.isFinite(wp.x) || !Number.isFinite(wp.y)) continue
          sumX += wp.x + panelWorldW / 2
          sumY += wp.y + panelWorldH / 2
          count += 1
        }
        if (count <= 0) return null
        const cx = sumX / count
        const cy = sumY / count
        return { k: zoomK, x: targetSx - cx * zoomK, y: targetSy - cy * zoomK }
      }

      const t = fitAllTransform(nodesForFit, fitW, viewportH, {
        ...opts,
        graphData: graphDataForZoomRequests || undefined,
        minScale: 1,
        maxScale: 1,
        maxScaleHardCap: 1,
        enforceAspectRatio: false,
        useCentroidCentering: true,
        centerMode: 'centroid',
      })
      return { k: t.k, x: t.x, y: t.y }
    })()
    const next = (() => {
      if (!seeded) return centered ? d3.zoomIdentity.translate(centered.x, centered.y).scale(centered.k) : fit
      const candidate = d3.zoomIdentity.translate(seeded.x, seeded.y).scale(seeded.k)
      if (isFlowEditor) return candidate
      const ok = isFlowTransformShowingGraph(
        { k: candidate.k, x: candidate.x, y: candidate.y },
        { nodes: nodesForTransformGuard as Array<{ x?: unknown; y?: unknown }>, viewportW, viewportH, nodeW: flowConfigEffective.node.widthPx, nodeH: flowConfigEffective.node.heightPx },
      )
      return ok ? candidate : fit
    })()

    lastInitTransformZoomViewKeyRef.current = initKey
    const curT = runtime.transform || d3.zoomIdentity
    const changed = Math.abs(curT.k - next.k) > 1e-9 || Math.abs(curT.x - next.x) > 1e-6 || Math.abs(curT.y - next.y) > 1e-6
    if (changed) {
      setFlowNativeTransform(runtime, next)
    }
    requestCommit()
  }, [
    active,
    canvas2dRenderer,
    datasetKey,
    fitToScreenMode,
    flowConfigEffective.node.heightPx,
    flowConfigEffective.node.widthPx,
    flowConfig.node.heightPx,
    flowConfig.node.widthPx,
    graphDataForZoom,
    graphDataForZoomRequests,
    graphDataRevision,
    requestCommit,
    viewportH,
    viewportW,
    viewPinned,
    zoomToSelectionMode,
    zoomViewKey,
    nodesForFlowTransformGuard,
    nodesForFlowZoomCollective,
    documentSemanticMode,
    documentStructureBaselineLock,
    frontmatterModeEnabled,
    multiDimTableModeEnabled,
    sceneGraphData,
    flowEditorReservedW,
  ])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    const g = sceneGraphData
    const nodeList = Array.isArray(g?.nodes) ? g?.nodes : []
    const edgeList = Array.isArray(g?.edges) ? g?.edges : []
    const portHandlesCfg = (schema?.behavior?.portHandles || null) as { enabled?: unknown; showAllInputs?: unknown } | null
    const portHandlesEnabled = !!portHandlesCfg?.enabled
    const portHandlesShowAllInputs = !!portHandlesCfg?.showAllInputs
    const portHandlesKey = `${portHandlesEnabled ? 1 : 0}:${portHandlesShowAllInputs ? 1 : 0}`
    const graphKey = `${graphDataRevision}:${nodeList.length}:${edgeList.length}:${buildGraphMetaKeyIgnoringPending(g)}:${layoutVariant}:${portHandlesKey}`
    if (graphKey === lastBuiltGraphKeyRef.current && (runtime.scene?.nodes.length || 0) > 0) return
    lastBuiltGraphKeyRef.current = graphKey
    __flowCanvasDebug.lastBuiltSceneKey = graphKey
    runtime.positionsReady = computedPositions != null
    const res = buildAndSetFlowNativeScene({
      runtime,
      graphData: sceneGraphData,
      positions: computedPositions || seededFallbackPositions,
      schema,
      forbidCircleNodes,
      flowConfig: flowConfigEffective,
      sceneGroups,
      rankdir,
      widgetRegistry,
    })
    __flowCanvasDebug.lastBuiltSceneNodeCount = res.nodeCount
    scheduleFlowDraw()
  }, [
    active,
    buildDrawArgs,
    computedPositions,
    seededFallbackPositions,
    flowConfigEffective,
    forbidCircleNodes,
    graphDataRevision,
    layoutVariant,
    rankdir,
    sceneGraphData,
    sceneGroups,
    schema,
    widgetRegistry,
  ])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    setFlowNativePresentation(runtime, flowPresentation)
    scheduleFlowDraw()
  }, [active, buildDrawArgs, flowPresentation])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    const canvasEl = canvasRef.current
    if (!runtime || !canvasEl) return
    const selectionOnDrag = canvas2dRenderer === 'flowEditor' && flowEditorSelectionOnDrag === true
    const effectiveCollisionDuringDrag = computeCollisionDuringDrag({
      collisionDuringDrag: collisionDuringDrag === true,
      canvas2dRenderer: String(canvas2dRenderer || ''),
    })
    return bindFlowCanvasNativeInteractions({
      active,
      canvasEl,
      runtime,
      viewportControlsPreset,
      selectionOnDrag,
      allowNodeDragOverride,
      collisionDuringDrag: effectiveCollisionDuringDrag,
      requestCommit,
      buildDrawArgs,
      setSelectionBox: requestSetSelectionBox,
      onInteractionFrame: handleInteractionFrame,
      dragRef,
      lastPointerInCanvasRef,
      lastWheelIntentRef,
      zoomWheelGuardRef,
      userSelectLockPointerIdRef,
      positionsDirtySinceCommitRef,
      collisionSchemaRef,
      collisionGraphDataRef,
      collisionFlowConfigRef,
      collisionPresentationRef,
    })
  }, [
    active,
    allowNodeDragOverride,
    buildDrawArgs,
    canvas2dRenderer,
    collisionDuringDrag,
    flowEditorSelectionOnDrag,
    handleInteractionFrame,
    requestCommit,
    requestSetSelectionBox,
    viewportControlsPreset,
  ])

  return (
    <section ref={containerRef} className={CANVAS_SURFACE_CLASS}>
      <FlowCanvasInteractionRuntime
        active={active}
        allowMutations={allowMutations}
        schema={schema}
        runtimeRef={runtimeRef}
        positionsDirtySinceCommitRef={positionsDirtySinceCommitRef}
        selectedNodeIdsRef={selectedNodeIdsRef}
        selectedEdgeIdsRef={selectedEdgeIdsRef}
        drawArgsRef={drawArgsRef}
        scheduleFlowDraw={scheduleFlowDraw}
        requestCommit={requestCommit}
        handleInteractionFrame={handleInteractionFrame}
        canvas2dRenderer={canvas2dRenderer}
        graphDataForZoomRequests={graphDataForZoomRequests}
        viewportW={viewportW}
        viewportH={viewportH}
        flowEditorReservedW={flowEditorReservedW}
      />
      <canvas
        ref={canvasRef}
        aria-label="Flow renderer"
        data-kg-canvas-interactive="1"
        className={CANVAS_INTERACTIVE_CLASS}
        draggable={false}
      />
      {active && overlayNodes.length > 0 ? (
        <section aria-label="Flow media overlay" className="absolute inset-0 z-[80] pointer-events-none">
          {overlayNodes.map(n => {
            const isSelected = selectedOverlayNodeIds.some(id => isCanonicalNodeIdEqual(id, n.id))
            const resizeInteractionActive = flowEditorOverlayInteractionMode && isSelected
            const updateNode = useGraphStore.getState().updateNode
            return (
              <RichMediaPanel
                key={n.id}
                overlayId={n.id}
                ref={(el) => {
                  if (!el) {
                    mediaOverlayElsRef.current.delete(n.id)
                    updateOverlayHiddenDrawArgs()
                    return
                  }
                  mediaOverlayElsRef.current.set(n.id, el)
                  updateOverlayHiddenDrawArgs()
                }}
                className="absolute left-0 top-0 pointer-events-auto"
                title={n.title}
                url={n.url}
                srcDoc={n.srcDoc}
                openUrl={n.openUrl}
                kind={n.kind}
                interactive={resolveRichMediaPanelInteractive({
                  nodeInteractive: n.interactive,
                  renderMediaAsNodes,
                  infiniteCanvasInteractionMode,
                })}
                iframeMode="srcdoc-when-needed"
      panel={n.panel}
      onPanelChange={next => {
        if (!n.panel) return
        commitRichMediaPanelChange({
          nodeId: n.id,
          next,
          updateNode,
        })
      }}
                forwardWheelTo={() => canvasRef.current}
                onOverlayPanStart={flowEditorOverlayInteractionMode ? (args) => beginMediaOverlayPan(args) : undefined}
                onOverlayPan={flowEditorOverlayInteractionMode ? (args) => moveMediaOverlayPan(args) : undefined}
                onOverlayPanEnd={flowEditorOverlayInteractionMode ? (args) => endMediaOverlayPan(args) : undefined}
                onHeaderDragStart={flowEditorOverlayInteractionMode ? ({ pointerId }) => beginMediaOverlayHeaderDrag(n.id, pointerId) : undefined}
                onHeaderDrag={flowEditorOverlayInteractionMode ? ({ dx, dy, pointerId }) => moveMediaOverlayHeaderDrag(n.id, { pointerId, dx, dy }) : undefined}
                onHeaderDragEnd={flowEditorOverlayInteractionMode ? ({ pointerId }) => endMediaOverlayHeaderDrag(n.id, pointerId) : undefined}
                resizable={flowEditorOverlayInteractionMode && isSelected}
                onResizeStart={resizeInteractionActive ? ({ pointerId }) => beginMediaOverlayResize(n.id, pointerId) : undefined}
                onResize={resizeInteractionActive ? ({ dx, dy, pointerId }) => moveMediaOverlayResize(n.id, { pointerId, dx, dy }) : undefined}
                onResizeEnd={resizeInteractionActive ? ({ pointerId }) => endMediaOverlayResize(n.id, pointerId) : undefined}
                flowEditorInteractionMode={flowEditorOverlayInteractionMode}
                flowEditorFrontmatterDocumentMode={flowEditorFrontmatterInteractionMode}
                style={{
                  transform: 'translate(-99999px, -99999px)',
                  width: 1,
                  height: 1,
                }}
                onWheelCapture={stopEvent}
                onClickCapture={stopEvent}
                onDoubleClickCapture={stopEvent}
                onContextMenuCapture={stopEvent}
              />
            )
          })}
        </section>
      ) : null}
      {selectionBox && (
        <section
          aria-hidden={true}
          className="absolute pointer-events-none border border-[var(--kg-canvas-node-selected)] bg-[color-mix(in_srgb,var(--kg-canvas-node-selected)_15%,transparent)]"
          style={{ left: selectionBox.left, top: selectionBox.top, width: selectionBox.width, height: selectionBox.height }}
        />
      )}
    </section>
  )
}
