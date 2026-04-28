import React from 'react'
import { createPortal } from 'react-dom'

import { NodeOverlayEditorPanel } from '@/components/FlowEditor/NodeOverlayEditorPanel'
import { NodeOverlayEditorActionsToolbar } from '@/components/FlowEditor/NodeOverlayEditorActionsToolbar'
import { screenToWorld, worldToScreen } from '@/lib/zoom/viewport'
import {
  DEFAULT_FLOW_NODE_WIDTH_PX,
  DEFAULT_ZOOM_MAX_SCALE,
  DEFAULT_ZOOM_MIN_SCALE,
  DEFAULT_ZOOM_MIN_SCALE_HARD_CAP,
  readZoomScaleExtent,
} from '@/lib/graph/layoutDefaults'
import { useOutsideClose } from '@/hooks/useOutsideClose'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getEffectiveZoomStateForKey } from '@/lib/canvas/zoom-effective'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import {
  LS_KEYS,
  UI_COPY,
  UI_LABELS,
  UI_SELECTORS,
} from '@/lib/config'
import { isHandlesForAllInputsEnabled, isLoopNode } from '@/lib/flowEditor/flowEditorActions'
import { lsBool, lsSetBool } from '@/lib/persistence'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { clampOverlayTopLeftFullyInViewport, clampOverlayTopLeftToViewport } from '@/lib/ui/overlayClamp'
import { useIsomorphicLayoutEffect } from '@/lib/react/useIsomorphicLayoutEffect'
import { createRafLatestScheduler } from '@/lib/react/rafLatestScheduler'
import { lockGlobalUserSelect, unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import { FLOW_EDITOR_INTERACTION_FRAME_EVENT } from '@/lib/canvas/flow-editor-overlay-proxy'
import {
  computeWidgetScale,
  computeWidgetScaledSize,
  WIDGET_BASE_SIZE,
} from '@/components/FlowEditor/widgetZoom'
import { computeDefaultWidgetFloatingPos, computeWidgetAnchoredStackOffset } from '@/components/FlowEditor/widgetLayout'
import { getIconSizeClass } from '@/lib/ui'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { buildDataflowWidgetRegistry } from '@/lib/flowEditor/widgetRegistryDataflow'
import { useShallow } from 'zustand/react/shallow'
import { resolveWidgetRegistryEntry } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { readPortHandleUiMetrics } from '@/components/FlowEditor/portHandleUi'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID } from '@/lib/config.flow-editor'
import type { RichMediaPanelTab } from '@/lib/render/richMediaSsot'

const FLOW_EDITOR_NODE_OVERLAY_Z_INDEX_BASE = 140
const FLOW_EDITOR_NODE_OVERLAY_Z_INDEX_SELECTED = 170
const EMPTY_WIDGET_REGISTRY: WidgetRegistryEntry[] = []
const WIDGET_ACTIONS_TOOLBAR_OFFSET_PX = 40
const WIDGET_ACTIONS_TOOLBAR_CLEARANCE_PX = 48
const WIDGET_ACTIONS_TOOLBAR_SIDE_OFFSET_PX = 8
const WIDGET_ACTIONS_TOOLBAR_SIDE_CLEARANCE_PX = 220
const RICH_MEDIA_ASPECT_HORIZONTAL = '16:9' as const
const RICH_MEDIA_ASPECT_VERTICAL = '9:16' as const
const RICH_MEDIA_ASPECT_MIN_WIDTH = 220
const RICH_MEDIA_ASPECT_MIN_HEIGHT = 160
const RICH_MEDIA_ASPECT_DEFAULT_WIDTH = 280
const RICH_MEDIA_ASPECT_DEFAULT_HEIGHT = 180

type NodeOverlayEditorProps = {
  visible?: boolean
  active: boolean
  node: GraphNode
  viewportW: number
  viewportH: number
  canvasWindowOffset?: { left: number; top: number } | null
  autoRevealKey?: number
  forcePinnedToCanvas?: boolean
  stackIndex?: number
  getLiveNodeWorldPos?: (nodeId: string) => { x: number; y: number } | null
  getLiveZoomTransform?: () => { k: number; x: number; y: number } | null
  getLiveContainmentGroupAabbForNode?: (nodeId: string) => { groupId: string; minX: number; minY: number; maxX: number; maxY: number } | null
  graphMetaKind?: string | null
  edges: ReadonlyArray<GraphEdge>
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
  toolMode?: 'select' | 'addEdge'
  pendingEdgeSourceId?: string | null
  zoomViewKey?: string | null
  onBeginAddEdgeFromNode?: (nodeId: string, portKey?: string | null) => void
  onFinalizeAddEdgeToNode?: (nodeId: string, portKey?: string | null) => void
  onSetLabel: (label: string) => void
  onSetType: (type: string) => void
  onPatchProperties: (patch: Record<string, unknown>) => void
  onSetProperties: (properties: Record<string, unknown>) => void
  onValidate: () => void
  onRun: () => void
  onDuplicate: () => void
  onRemove: () => void
  onClearOutput: () => void
  onHelp: () => void
  onConvertToLoopNode: () => void
  onEnableHandlesForAllInputs: () => void
  onUpdateKvEntry?: () => void
  onPinnedInCanvasChange?: (pinnedInCanvas: boolean) => void
  onRenameSchemaFieldId?: (args: { prevId: string; nextId: string }) => void
}

const NodeOverlayEditorInner = React.memo(function NodeOverlayEditorInner({
  active,
  node,
  viewportW,
  viewportH,
  canvasWindowOffset,
  autoRevealKey,
  forcePinnedToCanvas,
  stackIndex,
  getLiveNodeWorldPos,
  getLiveZoomTransform,
  getLiveContainmentGroupAabbForNode,
  graphMetaKind,
  edges,
  connectedValuesBySchemaPath,
  toolMode,
  pendingEdgeSourceId,
  zoomViewKey,
  onBeginAddEdgeFromNode,
  onFinalizeAddEdgeToNode,
  onSetLabel,
  onSetType,
  onPatchProperties,
  onSetProperties,
  onValidate,
  onRun,
  onDuplicate,
  onRemove,
  onClearOutput,
  onHelp,
  onConvertToLoopNode,
  onEnableHandlesForAllInputs,
  onUpdateKvEntry,
  onPinnedInCanvasChange,
  onRenameSchemaFieldId,
}: NodeOverlayEditorProps) {
  const { panelTextClass, microLabelClass, monospaceTextClass } = usePanelTypography()
  const {
    uiIconScale,
    uiIconStrokeWidth,
    uiPanelOpacity,
    schema,
    documentStructureBaselineLock,
    documentWidgetRegistry,
    effectiveWidgetRegistry,
    baseWidgetRegistry,
    upsertUiToast,
    selectNode,
    setSelectionSource,
    selectedNodeId,
    setFlowWidgetPosByNodeId,
    setFlowWidgetWorldPosByNodeId,
    setFlowWidgetPinnedByNodeId,
  } = useGraphStore(
    useShallow(s => ({
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
      uiPanelOpacity: s.uiPanelOpacity,
      schema: s.schema,
      documentStructureBaselineLock: s.documentStructureBaselineLock === true,
      documentWidgetRegistry: (s.documentWidgetRegistry ?? EMPTY_WIDGET_REGISTRY) as WidgetRegistryEntry[],
      effectiveWidgetRegistry: (s.effectiveWidgetRegistry ?? EMPTY_WIDGET_REGISTRY) as WidgetRegistryEntry[],
      baseWidgetRegistry: (s.widgetRegistry ?? EMPTY_WIDGET_REGISTRY) as WidgetRegistryEntry[],
      upsertUiToast: s.upsertUiToast,
      selectNode: s.selectNode,
      setSelectionSource: s.setSelectionSource,
      selectedNodeId: s.selectedNodeId,
      setFlowWidgetPosByNodeId: s.setFlowWidgetPosByNodeId,
      setFlowWidgetWorldPosByNodeId: (s as unknown as { setFlowWidgetWorldPosByNodeId: (pos: Record<string, { x: number; y: number }>) => void })
        .setFlowWidgetWorldPosByNodeId,
      setFlowWidgetPinnedByNodeId: s.setFlowWidgetPinnedByNodeId,
    })),
  )

  const widgetRegistry = React.useMemo(
    () =>
      buildDataflowWidgetRegistry({
        documentWidgetRegistry,
        effectiveWidgetRegistry,
        widgetRegistry: baseWidgetRegistry,
      }),
    [baseWidgetRegistry, documentWidgetRegistry, effectiveWidgetRegistry],
  )

  const nodeId = React.useMemo(() => String(node.id || '').trim(), [node.id])

  const widgetPos = useGraphStore(
    useShallow(s => s.flowWidgetPosByNodeId?.[nodeId]),
  )

  const overlayZIndex = React.useMemo(() => {
    const idx = Number.isFinite(stackIndex) ? Math.max(0, Math.floor(stackIndex as number)) : 0
    const selected = String(selectedNodeId || '').trim() === nodeId
    if (selected) return FLOW_EDITOR_NODE_OVERLAY_Z_INDEX_SELECTED
    return Math.max(20, FLOW_EDITOR_NODE_OVERLAY_Z_INDEX_BASE - Math.min(48, idx))
  }, [nodeId, selectedNodeId, stackIndex])

  const registryEntry: WidgetRegistryEntry | null = React.useMemo(
    () => resolveWidgetRegistryEntry({ node, registry: widgetRegistry, graphMetaKind }),
    [graphMetaKind, node, widgetRegistry],
  )

  const asideRef = React.useRef<HTMLElement | null>(null)
  const nodeRef = React.useRef<GraphNode>(node)
  const widgetWorldPosRef = React.useRef<{ x: number; y: number } | null>(null)
  const lastGoodWorldPosRef = React.useRef<{ x: number; y: number } | null>(null)
  const pinnedDragOverrideRef = React.useRef<{ left: number; top: number } | null>(null)
  const worldDragOverrideRef = React.useRef<{ x: number; y: number } | null>(null)
  const viewportRef = React.useRef<{ width: number; height: number }>({
    width: viewportW,
    height: viewportH,
  })
  const canvasWindowOffsetRef = React.useRef<{ left: number; top: number }>({ left: 0, top: 0 })
  const schemaRef = React.useRef(schema)
  const floatingRef = React.useRef(false)
  const anchoredPosRef = React.useRef<{ top: number; left: number }>({ top: 48, left: 16 })
  const scaledSizeRef = React.useRef<{ width: number; height: number }>({ width: WIDGET_BASE_SIZE.width, height: WIDGET_BASE_SIZE.height })
  const zoomStateRef = React.useRef<{ k: number; x: number; y: number } | null>(
    getEffectiveZoomStateForKey({
      zoomViewKey,
      zoomStateByKey: useGraphStore.getState().zoomStateByKey,
      zoomState: useGraphStore.getState().zoomState,
    }),
  )
  const lastAppliedRef = React.useRef<{ left: number; top: number; scale: number; offsetLeft: number; offsetTop: number } | null>(null)
  const cssInitRef = React.useRef(false)
  const pendingClampCommitRef = React.useRef<number | null>(null)
  const pinToggleCollisionGuardRef = React.useRef<number | null>(null)
  const skipPinClickRef = React.useRef(false)
  const livePosWarmupRafRef = React.useRef<number | null>(null)

  const readPinnedInCanvas = React.useCallback(
    (id: string): boolean => {
      if (!id) return false
      const map = useGraphStore.getState().flowWidgetPinnedByNodeId || {}
      const v = map[id]
      return typeof v === 'boolean' ? v : true
    },
    [],
  )

  const [pinnedInCanvas, setPinnedInCanvasState] = React.useState<boolean>(() => readPinnedInCanvas(nodeId))
  const pinnedInCanvasRef = React.useRef<boolean>(readPinnedInCanvas(nodeId))

  React.useEffect(() => {
    const next = readPinnedInCanvas(nodeId)
    pinnedInCanvasRef.current = next
    setPinnedInCanvasState(next)
  }, [nodeId, readPinnedInCanvas])

  React.useEffect(() => {
    const readPinned = (s: unknown) => {
      const map = (s as { flowWidgetPinnedByNodeId?: Record<string, boolean> })?.flowWidgetPinnedByNodeId || {}
      const v = nodeId ? map[nodeId] : undefined
      return typeof v === 'boolean' ? v : readPinnedInCanvas(nodeId)
    }
    setPinnedInCanvasState(prev => {
      const next = readPinned(useGraphStore.getState())
      pinnedInCanvasRef.current = next
      return prev === next ? prev : next
    })
    const unsub = useGraphStore.subscribe(
      readPinned,
      next => {
        pinnedInCanvasRef.current = next
        setPinnedInCanvasState(prev => (prev === next ? prev : next))
      },
    )
    return () => {
      try {
        unsub()
      } catch {
        void 0
      }
    }
  }, [nodeId, readPinnedInCanvas])

  const setPinnedInCanvas = React.useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const prev = pinnedInCanvasRef.current
      const resolved = !!(typeof next === 'function' ? (next as (v: boolean) => boolean)(prev) : next)
      pinnedInCanvasRef.current = resolved
      setPinnedInCanvasState(prevState => (prevState === resolved ? prevState : resolved))
      if (!nodeId) return
      const map = useGraphStore.getState().flowWidgetPinnedByNodeId || {}
      if (map[nodeId] === resolved) return
      setFlowWidgetPinnedByNodeId({ ...map, [nodeId]: resolved })
    },
    [nodeId, setFlowWidgetPinnedByNodeId],
  )

  const [minimized, setMinimized] = React.useState<boolean>(() => lsBool(LS_KEYS.flowWidgetMinimized, false))
  const [hideFields, setHideFields] = React.useState<boolean>(() => lsBool(LS_KEYS.flowWidgetHideFields, false))

  const defaultFloatingPos = React.useMemo(() => {
    return computeDefaultWidgetFloatingPos({ stackIndex, viewportW, viewportH })
  }, [stackIndex, viewportH, viewportW])

  const resolveFloatingPos = React.useCallback(
    (pos: { top: number; left: number } | undefined, fallback: { top: number; left: number }): { top: number; left: number } => {
      const v = pos
      if (v && Number.isFinite(v.top) && Number.isFinite(v.left)) {
        const offset = canvasWindowOffsetRef.current
        const viewportWidth = (() => {
          void offset
          return viewportW
        })()
        const viewportHeight = (() => {
          void offset
          return viewportH
        })()
        const leftRaw = v.left
        const topRaw = v.top
        const looksLikeWindowCoords =
          (offset.left !== 0 || offset.top !== 0) &&
          leftRaw >= offset.left - 2 &&
          leftRaw <= offset.left + viewportWidth + 2 &&
          topRaw >= offset.top - 2 &&
          topRaw <= offset.top + viewportHeight + 2
        const coerce = looksLikeWindowCoords ? { left: leftRaw - offset.left, top: topRaw - offset.top } : v
        const clamped = clampOverlayTopLeftFullyInViewport({
          pos: coerce,
          size: WIDGET_BASE_SIZE,
          viewport: { width: viewportWidth, height: viewportHeight },
          snapPx: 1,
        })
        return clamped
      }
      return fallback
    },
    [viewportH, viewportW],
  )

  const [pinnedTopPx, setPinnedTopPx] = React.useState<number>(() => resolveFloatingPos(widgetPos, defaultFloatingPos).top)
  const [pinnedLeftPx, setPinnedLeftPx] = React.useState<number>(() => resolveFloatingPos(widgetPos, defaultFloatingPos).left)

  useIsomorphicLayoutEffect(() => {
    const pos = resolveFloatingPos(widgetPos, defaultFloatingPos)
    setPinnedTopPx(prev => (prev === pos.top ? prev : pos.top))
    setPinnedLeftPx(prev => (prev === pos.left ? prev : pos.left))
  }, [defaultFloatingPos, widgetPos, resolveFloatingPos])

  const [toolbarVisible, setToolbarVisible] = React.useState(false)
  const [toolbarDock, setToolbarDock] = React.useState<'above' | 'below'>('above')
  const [toolbarSideClamp, setToolbarSideClamp] = React.useState(false)
  useOutsideClose(toolbarVisible, setToolbarVisible, asideRef)
  const isRichMediaPanelWidget = String(node.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
  const isVideoTranscriberWidget = String(node.type || '').trim() === FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID

  const labelInputRef = React.useRef<HTMLInputElement | null>(null)

  const floating = false

  const autoStackOffset = React.useMemo(() => computeWidgetAnchoredStackOffset(stackIndex), [stackIndex])

  React.useEffect(() => {
    if (!active) return
    if (!autoRevealKey) return
    if (forcePinnedToCanvas === true) setPinnedInCanvas(true)
    setMinimized(prev => {
      if (!prev) return prev
      lsSetBool(LS_KEYS.flowWidgetMinimized, false)
      return false
    })
  }, [active, autoRevealKey, forcePinnedToCanvas, setPinnedInCanvas])

  const enableHandlesDisabled = documentStructureBaselineLock === true || isHandlesForAllInputsEnabled(schema)
  const convertToLoopDisabled = isLoopNode(node)

  React.useEffect(() => {
    onPinnedInCanvasChange?.(pinnedInCanvas)
  }, [onPinnedInCanvasChange, pinnedInCanvas])

  React.useEffect(() => {
    nodeRef.current = node
  }, [node])

  React.useEffect(() => {
    if (!toolbarVisible) return
    const id = String(node.id || '').trim()
    if (!id) return
    if (selectedNodeId !== id) setToolbarVisible(false)
  }, [node.id, selectedNodeId, toolbarVisible])

  const wasSelectedRef = React.useRef(false)
  React.useEffect(() => {
    const id = String(node.id || '').trim()
    const selected = !!id && selectedNodeId === id
    if (selected && !wasSelectedRef.current) {
      setToolbarVisible(true)
    }
    wasSelectedRef.current = selected
  }, [node.id, selectedNodeId])

  React.useEffect(() => {
    viewportRef.current = { width: viewportW, height: viewportH }
  }, [viewportH, viewportW])

  React.useEffect(() => {
    const next = canvasWindowOffset && Number.isFinite(canvasWindowOffset.left) && Number.isFinite(canvasWindowOffset.top)
      ? { left: canvasWindowOffset.left, top: canvasWindowOffset.top }
      : { left: 0, top: 0 }
    canvasWindowOffsetRef.current = next
  }, [canvasWindowOffset])

  React.useEffect(() => {
    schemaRef.current = schema
  }, [schema])

  useIsomorphicLayoutEffect(() => {
    floatingRef.current = floating
  }, [floating])

  const persistFloatingPos = React.useCallback(
    (pos: { top: number; left: number }) => {
      if (!nodeId) return
      const current = useGraphStore.getState().flowWidgetPosByNodeId || {}
      const prev = current[nodeId]
      if (prev && prev.top === pos.top && prev.left === pos.left) return
      const next = { ...current, [nodeId]: { top: pos.top, left: pos.left } }
      useGraphStore.getState().setFlowWidgetPosByNodeId(next)
    },
    [nodeId],
  )

  const persistWorldPos = React.useCallback(
    (pos: { x: number; y: number }) => {
      if (!nodeId) return
      const current =
        (useGraphStore.getState() as unknown as { flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }> })
          .flowWidgetWorldPosByNodeId || {}
      const prev = current[nodeId]
      if (prev && Math.abs(prev.x - pos.x) <= 0.0001 && Math.abs(prev.y - pos.y) <= 0.0001) return
      const next = { ...current, [nodeId]: { x: pos.x, y: pos.y } }
      setFlowWidgetWorldPosByNodeId(next)
    },
    [nodeId, setFlowWidgetWorldPosByNodeId],
  )

  const scheduleClampCommit = React.useCallback((next: { top: number; left: number }) => {
    if (pendingClampCommitRef.current != null) {
      try {
        cancelAnimationFrame(pendingClampCommitRef.current)
      } catch {
        void 0
      }
    }
    pendingClampCommitRef.current = requestAnimationFrame(() => {
      pendingClampCommitRef.current = null
      if (!floatingRef.current) return
      if (pinnedTopPx === next.top && pinnedLeftPx === next.left) return
      setPinnedTopPx(prev => (prev === next.top ? prev : next.top))
      setPinnedLeftPx(prev => (prev === next.left ? prev : next.left))
      persistFloatingPos(next)
    })
  }, [persistFloatingPos, pinnedLeftPx, pinnedTopPx])

  const applyOverlayPosition = React.useCallback(() => {
    const el = asideRef.current
    if (!el) return
    if (!cssInitRef.current) {
      cssInitRef.current = true
      el.style.left = '0px'
      el.style.top = '0px'
      el.style.width = `${WIDGET_BASE_SIZE.width}px`
      el.style.transformOrigin = 'top left'
      el.style.willChange = 'transform'
    }
    const liveZoom = getLiveZoomTransform ? getLiveZoomTransform() : null
    const storeZoom = getEffectiveZoomStateForKey({
      zoomViewKey,
      zoomStateByKey: useGraphStore.getState().zoomStateByKey,
      zoomState: useGraphStore.getState().zoomState,
    })

    let z = liveZoom || zoomStateRef.current
    if (!liveZoom && storeZoom && storeZoom !== z) {
      z = storeZoom
      zoomStateRef.current = storeZoom
    }
    const zoomK = Number.isFinite(z?.k) ? (z?.k as number) : 1
    const extent = (() => {
      const s = schemaRef.current
      if (!s) return { minK: DEFAULT_ZOOM_MIN_SCALE, maxK: DEFAULT_ZOOM_MAX_SCALE }
      const [minK, maxK] = readZoomScaleExtent(s)
      return { minK: Math.min(minK, DEFAULT_ZOOM_MIN_SCALE_HARD_CAP), maxK }
    })()
    const panelScale = computeWidgetScale(zoomK, extent, { mode: floatingRef.current ? 'floating' : 'pinnedInCanvas' })
    const scaled = computeWidgetScaledSize(panelScale)
    scaledSizeRef.current = scaled

    const n = nodeRef.current
    const live = getLiveNodeWorldPos ? getLiveNodeWorldPos(nodeId) : null
    const liveX = live && Number.isFinite(live.x) ? (live.x as number) : null
    const liveY = live && Number.isFinite(live.y) ? (live.y as number) : null
    const nx = typeof n.x === 'number' && Number.isFinite(n.x) ? (n.x as number) : null
    const ny = typeof n.y === 'number' && Number.isFinite(n.y) ? (n.y as number) : null
    if (liveX != null && liveY != null) {
      lastGoodWorldPosRef.current = { x: liveX, y: liveY }
    } else if (nx != null && ny != null) {
      lastGoodWorldPosRef.current = { x: nx, y: ny }
    }
    const world = lastGoodWorldPosRef.current || { x: 0, y: 0 }
    const { sx: screenX, sy: screenY } = worldToScreen({
      transform: z,
      x: world.x,
      y: world.y,
    })
    const port = schemaRef.current?.behavior?.portHandles || null
    const portEnabled = Boolean((port as { enabled?: unknown } | null)?.enabled) || String(graphMetaKind || '').trim() === 'frontmatter-flow'
    const portMetrics = readPortHandleUiMetrics(schemaRef.current || null, { zoomK })
    const portExtraPadScreenPx = portEnabled ? Math.max(0, portMetrics.railWidthPx + 8) : 0
    const anchoredLeftPx = screenX + DEFAULT_FLOW_NODE_WIDTH_PX * zoomK + 16 + portExtraPadScreenPx
    const anchoredTopPx = screenY - 12
    anchoredPosRef.current = { top: anchoredTopPx, left: anchoredLeftPx }

    const viewportWidth = viewportW
    const viewportHeight = viewportH
    const floating = floatingRef.current
    const dragOverride = pinnedDragOverrideRef.current
    const worldDragOverride = worldDragOverrideRef.current
    const storedWorld = widgetWorldPosRef.current
    const defaultWorld = screenToWorld({
      transform: z,
      sx: anchoredPosRef.current.left + autoStackOffset.left,
      sy: anchoredPosRef.current.top + autoStackOffset.top,
    })
    const worldPinned = worldDragOverride || storedWorld || defaultWorld
    const worldPinnedScreen = worldToScreen({ transform: z, x: worldPinned.x, y: worldPinned.y })
    const basePos = dragOverride
      ? { top: dragOverride.top, left: dragOverride.left }
      : floating
        ? { top: pinnedTopPx, left: pinnedLeftPx }
        : { top: worldPinnedScreen.sy, left: worldPinnedScreen.sx }
    const safeBasePos = {
      top: Number.isFinite(basePos.top) ? basePos.top : 8,
      left: Number.isFinite(basePos.left) ? basePos.left : 8,
    }
    const shouldClampFloating = floating && !dragOverride
    const floatingViewport = (() => {
      if (!shouldClampFloating) return { width: viewportWidth, height: viewportHeight }
      void canvasWindowOffsetRef
      return {
        width: viewportWidth,
        height: viewportHeight,
      }
    })()
    const posBase = shouldClampFloating
      ? clampOverlayTopLeftToViewport({
          pos: { top: safeBasePos.top, left: safeBasePos.left },
          size: scaled,
          viewport: floatingViewport,
          visiblePx: 48,
          snapPx: 1,
        })
      : safeBasePos

    const pos = (() => {
      if (floating) return posBase
      const aabb = getLiveContainmentGroupAabbForNode?.(nodeId)
      if (!aabb) return posBase

      const a = worldToScreen({ transform: z, x: aabb.minX, y: aabb.minY })
      const b = worldToScreen({ transform: z, x: aabb.maxX, y: aabb.maxY })
      const left0 = Math.min(a.sx, b.sx)
      const right0 = Math.max(a.sx, b.sx)
      const top0 = Math.min(a.sy, b.sy)
      const bottom0 = Math.max(a.sy, b.sy)
      if (!Number.isFinite(left0) || !Number.isFinite(right0) || !Number.isFinite(top0) || !Number.isFinite(bottom0)) return posBase

      const INSET_PX = 8
      const minLeft = left0 + INSET_PX
      const minTop = top0 + INSET_PX
      const maxLeft = Math.max(minLeft, right0 - INSET_PX - scaled.width)
      const maxTop = Math.max(minTop, bottom0 - INSET_PX - scaled.height)
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
      return {
        left: clamp(posBase.left, minLeft, maxLeft),
        top: clamp(posBase.top, minTop, maxTop),
      }
    })()

    if (shouldClampFloating && (pos.top !== safeBasePos.top || pos.left !== safeBasePos.left)) scheduleClampCommit(pos)
    const nextToolbarDock = pos.top >= WIDGET_ACTIONS_TOOLBAR_CLEARANCE_PX ? 'above' : 'below'
    setToolbarDock(prev => (prev === nextToolbarDock ? prev : nextToolbarDock))
    const nextToolbarSideClamp = pos.left + scaled.width + WIDGET_ACTIONS_TOOLBAR_SIDE_CLEARANCE_PX > viewportWidth
    setToolbarSideClamp(prev => (prev === nextToolbarSideClamp ? prev : nextToolbarSideClamp))

    const offset = canvasWindowOffsetRef.current
    const offsetLeft = Number.isFinite(offset.left) ? offset.left : 0
    const offsetTop = Number.isFinite(offset.top) ? offset.top : 0
    const tx = pos.left + offsetLeft
    const ty = pos.top + offsetTop

    const last = lastAppliedRef.current
    if (
      last &&
      last.left === pos.left &&
      last.top === pos.top &&
      last.offsetLeft === offsetLeft &&
      last.offsetTop === offsetTop &&
      Math.abs(last.scale - panelScale) < 1e-6
    ) {
      return
    }
    lastAppliedRef.current = { left: pos.left, top: pos.top, scale: panelScale, offsetLeft, offsetTop }
    el.style.transform = `matrix(${panelScale}, 0, 0, ${panelScale}, ${tx}, ${ty})`
  }, [
    getLiveNodeWorldPos,
    getLiveZoomTransform,
    nodeId,
    pinnedLeftPx,
    pinnedTopPx,
    scheduleClampCommit,
    viewportH,
    viewportW,
    zoomViewKey,
  ])

  React.useEffect(() => {
    const pick = (s: unknown) =>
      (s as { flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }> })
        ?.flowWidgetWorldPosByNodeId?.[nodeId]
    const coerce = (v: unknown): { x: number; y: number } | null => {
      if (!v || typeof v !== 'object') return null
      const rec = v as { x?: unknown; y?: unknown }
      const x = typeof rec.x === 'number' && Number.isFinite(rec.x) ? rec.x : null
      const y = typeof rec.y === 'number' && Number.isFinite(rec.y) ? rec.y : null
      return x == null || y == null ? null : { x, y }
    }
    widgetWorldPosRef.current = coerce(pick(useGraphStore.getState()))
    const unsub = useGraphStore.subscribe(
      pick,
      next => {
        widgetWorldPosRef.current = coerce(next)
        applyOverlayPosition()
      },
    )
    return () => {
      try {
        unsub()
      } catch {
        void 0
      }
    }
  }, [applyOverlayPosition, nodeId])

  React.useEffect(() => {
    if (!active) return
    if (!getLiveNodeWorldPos) return
    if (floating) return
    if (typeof window === 'undefined') return

    const initialLive = getLiveNodeWorldPos(nodeId)
    if (initialLive && Number.isFinite(initialLive.x) && Number.isFinite(initialLive.y)) return

    const startedAtMs = Date.now()
    let attempts = 0
    const tick = () => {
      attempts += 1
      applyOverlayPosition()
      const live = getLiveNodeWorldPos(nodeId)
      const elapsedMs = Date.now() - startedAtMs
      if ((live && Number.isFinite(live.x) && Number.isFinite(live.y)) || attempts >= 120 || elapsedMs >= 1600) {
        livePosWarmupRafRef.current = null
        return
      }
      livePosWarmupRafRef.current = window.requestAnimationFrame(tick)
    }

    livePosWarmupRafRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (livePosWarmupRafRef.current != null) {
        try {
          cancelAnimationFrame(livePosWarmupRafRef.current)
        } catch {
          void 0
        }
        livePosWarmupRafRef.current = null
      }
    }
  }, [active, applyOverlayPosition, floating, getLiveNodeWorldPos, nodeId])

  useIsomorphicLayoutEffect(() => {
    applyOverlayPosition()
  }, [
    applyOverlayPosition,
    canvasWindowOffset?.left,
    canvasWindowOffset?.top,
    pinnedInCanvas,
    pinnedLeftPx,
    pinnedTopPx,
    viewportH,
    viewportW,
    node.x,
    node.y,
  ])

  React.useEffect(() => {
    if (!active) return
    if (floating) return
    if (!nodeId) return
    if (widgetWorldPosRef.current) return
    applyOverlayPosition()
    const z = (getLiveZoomTransform ? getLiveZoomTransform() : null) || zoomStateRef.current || { k: 1, x: 0, y: 0 }
    const world = screenToWorld({
      transform: z,
      sx: anchoredPosRef.current.left + autoStackOffset.left,
      sy: anchoredPosRef.current.top + autoStackOffset.top,
    })
    persistWorldPos(world)
  }, [active, applyOverlayPosition, autoStackOffset.left, autoStackOffset.top, floating, getLiveZoomTransform, nodeId, persistWorldPos])

  React.useEffect(() => {
    const unsub = useGraphStore.subscribe(
      s =>
        getEffectiveZoomStateForKey({
          zoomViewKey,
          zoomStateByKey: s.zoomStateByKey,
          zoomState: s.zoomState,
        }),
      next => {
        zoomStateRef.current = next || null
        applyOverlayPosition()
      },
    )
    return () => {
      try {
        unsub()
      } catch {
        void 0
      }
    }
  }, [applyOverlayPosition, zoomViewKey])

  React.useEffect(() => {
    if (!active) return
    if (typeof window === 'undefined') return
    let raf: number | null = null
    const onFrame = () => {
      if (raf != null) return
      raf = requestAnimationFrame(() => {
        raf = null
        applyOverlayPosition()
      })
    }
    try {
      window.addEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, onFrame as EventListener)
    } catch {
      void 0
    }
    return () => {
      try {
        window.removeEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, onFrame as EventListener)
      } catch {
        void 0
      }
      if (raf != null) {
        try {
          cancelAnimationFrame(raf)
        } catch {
          void 0
        }
        raf = null
      }
    }
  }, [active, applyOverlayPosition])

  const togglePinnedInternal = React.useCallback((opts?: { keepDragging?: boolean }) => {
    if (pinToggleCollisionGuardRef.current != null) {
      try {
        clearTimeout(pinToggleCollisionGuardRef.current)
      } catch {
        void 0
      }
      pinToggleCollisionGuardRef.current = null
    }
    if (nodeId) {
      const st = useGraphStore.getState()
      st.setFlowWidgetDraggingNodeId(nodeId)
      if (opts?.keepDragging !== true) {
        pinToggleCollisionGuardRef.current = setTimeout(() => {
          pinToggleCollisionGuardRef.current = null
          const cur = useGraphStore.getState().flowWidgetDraggingNodeId
          if (cur === nodeId) useGraphStore.getState().setFlowWidgetDraggingNodeId(null)
        }, 240) as unknown as number
      }
    }
    setPinnedInCanvas(prev => !prev)
  }, [
    nodeId,
    setPinnedInCanvas,
  ])

  const handleTogglePinned = React.useCallback((event: React.MouseEvent) => {
    if (skipPinClickRef.current) {
      skipPinClickRef.current = false
      return
    }
    try {
      event.preventDefault()
    } catch {
      void 0
    }
    try {
      event.stopPropagation()
    } catch {
      void 0
    }
    togglePinnedInternal()
  }, [togglePinnedInternal])

  const handlePinnedPointerDown = React.useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return
    skipPinClickRef.current = true
    togglePinnedInternal()
  }, [togglePinnedInternal])

  const handleToggleMinimized = React.useCallback(() => {
    setMinimized(prev => {
      const next = !prev
      lsSetBool(LS_KEYS.flowWidgetMinimized, next)
      return next
    })
  }, [])

  const handleToggleHideFields = React.useCallback(() => {
    setHideFields(prev => {
      const next = !prev
      lsSetBool(LS_KEYS.flowWidgetHideFields, next)
      return next
    })
  }, [])
  const richMediaSelectedMode = React.useMemo<RichMediaPanelTab>(() => {
    if (!isRichMediaPanelWidget) return 'auto'
    const raw = String((node.properties || {}).richMediaActiveTab || '').trim().toLowerCase()
    return raw === 'text' || raw === 'image' || raw === 'video' || raw === 'poi' || raw === 'auto'
      ? raw as RichMediaPanelTab
      : 'auto'
  }, [isRichMediaPanelWidget, node.properties])
  const handleSelectRichMediaMode = React.useCallback((nextMode: RichMediaPanelTab) => {
    if (!isRichMediaPanelWidget) return
    onPatchProperties({
      richMediaActiveTab: nextMode,
    })
  }, [isRichMediaPanelWidget, onPatchProperties])
  const richMediaAspectSelection = React.useMemo<'16:9' | '9:16' | null>(() => {
    if (!isRichMediaPanelWidget) return null
    const props = (node.properties || {}) as Record<string, unknown>
    const width = Number(props['visual:width'])
    const height = Number(props['visual:height'])
    if (!(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0)) return null
    const ratio = width / height
    const horizontal = 16 / 9
    const vertical = 9 / 16
    return Math.abs(ratio - horizontal) <= Math.abs(ratio - vertical)
      ? RICH_MEDIA_ASPECT_HORIZONTAL
      : RICH_MEDIA_ASPECT_VERTICAL
  }, [isRichMediaPanelWidget, node.properties])
  const handleToggleRichMediaAspect = React.useCallback(() => {
    if (!isRichMediaPanelWidget) return
    const props = (node.properties || {}) as Record<string, unknown>
    const width0 = Number(props['visual:width'])
    const height0 = Number(props['visual:height'])
    const widthBase = Number.isFinite(width0) && width0 > 0 ? width0 : RICH_MEDIA_ASPECT_DEFAULT_WIDTH
    const heightBase = Number.isFinite(height0) && height0 > 0 ? height0 : RICH_MEDIA_ASPECT_DEFAULT_HEIGHT
    const area = Math.max(RICH_MEDIA_ASPECT_MIN_WIDTH * RICH_MEDIA_ASPECT_MIN_HEIGHT, widthBase * heightBase)
    const next = richMediaAspectSelection === RICH_MEDIA_ASPECT_VERTICAL
      ? RICH_MEDIA_ASPECT_HORIZONTAL
      : RICH_MEDIA_ASPECT_VERTICAL
    const target = next === RICH_MEDIA_ASPECT_HORIZONTAL ? (16 / 9) : (9 / 16)
    let nextHeight = Math.sqrt(area / target)
    let nextWidth = target * nextHeight
    if (nextWidth < RICH_MEDIA_ASPECT_MIN_WIDTH) {
      nextWidth = RICH_MEDIA_ASPECT_MIN_WIDTH
      nextHeight = nextWidth / target
    }
    if (nextHeight < RICH_MEDIA_ASPECT_MIN_HEIGHT) {
      nextHeight = RICH_MEDIA_ASPECT_MIN_HEIGHT
      nextWidth = nextHeight * target
    }
    onPatchProperties({
      'visual:width': Math.round(nextWidth),
      'visual:height': Math.round(nextHeight),
    })
  }, [isRichMediaPanelWidget, node.properties, onPatchProperties, richMediaAspectSelection])

  const spacePanUserSelectUnlockRef = React.useRef<null | (() => void)>(null)

  React.useEffect(() => {
    return () => {
      const unlock = spacePanUserSelectUnlockRef.current
      spacePanUserSelectUnlockRef.current = null
      if (unlock) unlock()
      if (pinToggleCollisionGuardRef.current != null) {
        try {
          clearTimeout(pinToggleCollisionGuardRef.current)
        } catch {
          void 0
        }
        pinToggleCollisionGuardRef.current = null
      }
    }
  }, [])

  const handleHeaderPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest(UI_SELECTORS.draggablePanelIgnorePointerDown)) return

      if (nodeId) {
        setSelectionSource('editor')
        selectNode(nodeId)
        setToolbarVisible(true)
      }
      if (pinnedInCanvas) return

      try {
        event.preventDefault()
      } catch {
        void 0
      }
      try {
        event.stopPropagation()
      } catch {
        void 0
      }

      const startX = event.clientX
      const startY = event.clientY

      try {
        lockGlobalUserSelect()
      } catch {
        void 0
      }

      if (!floating) {
        useGraphStore.getState().setFlowWidgetDraggingNodeId(nodeId)
        applyOverlayPosition()

        const startClientX = event.clientX
        const startClientY = event.clientY
        const startOffset = canvasWindowOffsetRef.current

        const readZoom = () => {
          const liveZoom = getLiveZoomTransform ? getLiveZoomTransform() : null
          const storeZoom = getEffectiveZoomStateForKey({
            zoomViewKey,
            zoomStateByKey: useGraphStore.getState().zoomStateByKey,
            zoomState: useGraphStore.getState().zoomState,
          })
          let z = liveZoom || zoomStateRef.current
          if (!liveZoom && storeZoom && storeZoom !== z) {
            z = storeZoom
            zoomStateRef.current = storeZoom
          }
          return z || { k: 1, x: 0, y: 0 }
        }

        const z0 = readZoom()
        const storedWorld = widgetWorldPosRef.current
        const defaultWorld = screenToWorld({
          transform: z0,
          sx: anchoredPosRef.current.left + autoStackOffset.left,
          sy: anchoredPosRef.current.top + autoStackOffset.top,
        })
        const startWorld = worldDragOverrideRef.current || storedWorld || defaultWorld
        const startPointerWorld = screenToWorld({
          transform: z0,
          sx: startClientX - startOffset.left,
          sy: startClientY - startOffset.top,
        })
        const grabDx = startPointerWorld.x - startWorld.x
        const grabDy = startPointerWorld.y - startWorld.y

        let pending: { x: number; y: number } | null = null

        const flush = (p: { x: number; y: number } | null) => {
          if (!p) return
          worldDragOverrideRef.current = p
          applyOverlayPosition()
          try {
            window.dispatchEvent(new CustomEvent(FLOW_EDITOR_INTERACTION_FRAME_EVENT))
          } catch {
            void 0
          }
        }

        const scheduler = createRafLatestScheduler((p: { x: number; y: number }) => {
          pending = p
          flush(p)
        })

        startPointerDrag({
          ev: event.nativeEvent,
          cursor: 'move',
          onMove: mv => {
            const z = readZoom()
            const offset = canvasWindowOffsetRef.current
            const pointerWorld = screenToWorld({
              transform: z,
              sx: mv.clientX - offset.left,
              sy: mv.clientY - offset.top,
            })
            pending = { x: pointerWorld.x - grabDx, y: pointerWorld.y - grabDy }
            scheduler.schedule(pending)
          },
          onEnd: () => {
            scheduler.cancel()
            flush(pending)
            const out = worldDragOverrideRef.current || startWorld
            worldDragOverrideRef.current = null
            persistWorldPos(out)
            useGraphStore.getState().setFlowWidgetDraggingNodeId(null)
            unlockGlobalUserSelect()
          },
          onCancel: () => {
            scheduler.cancel()
            flush(pending)
            worldDragOverrideRef.current = null
            applyOverlayPosition()
            useGraphStore.getState().setFlowWidgetDraggingNodeId(null)
            unlockGlobalUserSelect()
          },
        })
        return
      }

      const applied = lastAppliedRef.current
      const startTop = applied ? applied.top : pinnedTopPx
      const startLeft = applied ? applied.left : pinnedLeftPx
      useGraphStore.getState().setFlowWidgetDraggingNodeId(nodeId)
      let pendingTop = startTop
      let pendingLeft = startLeft

      const flush = (pos: { top: number; left: number }) => {
        pendingTop = pos.top
        pendingLeft = pos.left
        pinnedDragOverrideRef.current = { left: pendingLeft, top: pendingTop }
        applyOverlayPosition()
        try {
          window.dispatchEvent(new CustomEvent(FLOW_EDITOR_INTERACTION_FRAME_EVENT))
        } catch {
          void 0
        }
      }

      const scheduler = createRafLatestScheduler((pos: { top: number; left: number }) => {
        flush(pos)
      })

      startPointerDrag({
        ev: event.nativeEvent,
        cursor: 'move',
        onMove: mv => {
          const dx = mv.clientX - startX
          const dy = mv.clientY - startY
          pendingTop = startTop + dy
          pendingLeft = startLeft + dx
          scheduler.schedule({ top: pendingTop, left: pendingLeft })
        },
        onEnd: () => {
          scheduler.cancel()
          flush({ top: pendingTop, left: pendingLeft })
          pinnedDragOverrideRef.current = null
          const scaled = scaledSizeRef.current
          const viewportWidth = viewportRef.current.width
          const viewportHeight = viewportRef.current.height
          const clamped = clampOverlayTopLeftToViewport({
            pos: { top: pendingTop, left: pendingLeft },
            size: scaled,
            viewport: { width: viewportWidth, height: viewportHeight },
            visiblePx: 48,
            snapPx: 1,
          })
          pendingTop = clamped.top
          pendingLeft = clamped.left
          setPinnedTopPx(prev => (prev === pendingTop ? prev : pendingTop))
          setPinnedLeftPx(prev => (prev === pendingLeft ? prev : pendingLeft))
          persistFloatingPos({ top: pendingTop, left: pendingLeft })
          useGraphStore.getState().setFlowWidgetDraggingNodeId(null)
          unlockGlobalUserSelect()
        },
        onCancel: () => {
          scheduler.cancel()
          flush({ top: pendingTop, left: pendingLeft })
          pinnedDragOverrideRef.current = null
          const scaled = scaledSizeRef.current
          const viewportWidth = viewportRef.current.width
          const viewportHeight = viewportRef.current.height
          const clamped = clampOverlayTopLeftToViewport({
            pos: { top: pendingTop, left: pendingLeft },
            size: scaled,
            viewport: { width: viewportWidth, height: viewportHeight },
            visiblePx: 48,
            snapPx: 1,
          })
          pendingTop = clamped.top
          pendingLeft = clamped.left
          setPinnedTopPx(prev => (prev === pendingTop ? prev : pendingTop))
          setPinnedLeftPx(prev => (prev === pendingLeft ? prev : pendingLeft))
          persistFloatingPos({ top: pendingTop, left: pendingLeft })
          useGraphStore.getState().setFlowWidgetDraggingNodeId(null)
          unlockGlobalUserSelect()
        },
      })
    },
    [
      applyOverlayPosition,
      autoStackOffset.left,
      autoStackOffset.top,
      floating,
      forcePinnedToCanvas,
      getLiveZoomTransform,
      nodeId,
      pinnedInCanvas,
      persistFloatingPos,
      persistWorldPos,
      pinnedLeftPx,
      pinnedTopPx,
      selectNode,
      setSelectionSource,
      zoomViewKey,
    ],
  )

  const handleRegistrySelectionChange = React.useCallback(
    ({ entry }: { entry: WidgetRegistryEntry | null }) => {
      if (!active) return
      if (!entry) {
        upsertUiToast({
          id: `flow-widget-registry-clear-${String(node.id || '')}`,
          kind: 'neutral',
          message: UI_COPY.flowWidgetRegistryClearedToast,
          ttlMs: 2200,
        })
        return
      }
      const label = `${entry.nodeTypeId} · ${entry.widgetTypeId} · ${entry.formId}`
      upsertUiToast({
        id: `flow-widget-registry-${entry.id}`,
        kind: 'neutral',
        message: UI_COPY.flowWidgetRegistryToast(label),
        ttlMs: 2500,
      })
    },
    [active, node.id, upsertUiToast],
  )

  const overlayElement = (
    <aside
      ref={asideRef}
      aria-label={UI_LABELS.flowWidget}
      data-kg-widget={String(node.id || '')}
      data-kg-widget-pinned={pinnedInCanvas ? '1' : '0'}
      data-kg-canvas-wheel-ignore="true"
      className="fixed"
      style={{ zIndex: overlayZIndex }}
      onPointerDownCapture={(ev) => {
        const t = ev.target
        const el = t instanceof Element ? t : null
        const isInteractiveControl = !!el?.closest('input,textarea,select,button,[contenteditable="true"]')
        if (active && ev.button === 0 && pinnedInCanvas && ev.altKey !== true && isSpacePanHeld() !== true) {
          if (el?.closest('[data-kg-flow-node-drag-handle="true"]')) return
        }
        if (active && ev.button === 0 && isSpacePanHeld()) {
          if (!isInteractiveControl) {
            if (!spacePanUserSelectUnlockRef.current) {
              lockGlobalUserSelect()
              const unlock = () => {
                if (!spacePanUserSelectUnlockRef.current) return
                spacePanUserSelectUnlockRef.current = null
                unlockGlobalUserSelect()
                try {
                  window.removeEventListener('pointerup', unlock, true)
                  window.removeEventListener('pointercancel', unlock, true)
                  window.removeEventListener('blur', unlock, true)
                  document.removeEventListener('visibilitychange', unlock, true)
                } catch {
                  void 0
                }
              }
              spacePanUserSelectUnlockRef.current = unlock
              try {
                window.addEventListener('pointerup', unlock, true)
                window.addEventListener('pointercancel', unlock, true)
                window.addEventListener('blur', unlock, true)
                document.addEventListener('visibilitychange', unlock, true)
              } catch {
                unlock()
              }
            }
          }
        }
        if (active && ev.button === 0 && isInteractiveControl) return
        const id = String(node.id || '').trim()
        if (!id) return
        setSelectionSource('editor')
        selectNode(id)
        setToolbarVisible(true)
      }}
    >
      <div className="relative">
        <div
          className={isRichMediaPanelWidget ? 'absolute z-10 pointer-events-auto' : 'absolute left-1/2 z-10 -translate-x-1/2 pointer-events-auto'}
          style={isRichMediaPanelWidget
            ? {
                top: '50%',
                left: toolbarSideClamp ? undefined : '100%',
                right: toolbarSideClamp ? `${WIDGET_ACTIONS_TOOLBAR_SIDE_OFFSET_PX}px` : undefined,
                marginLeft: toolbarSideClamp ? undefined : `${WIDGET_ACTIONS_TOOLBAR_SIDE_OFFSET_PX}px`,
                transform: 'translateY(-50%)',
              }
            : { top: toolbarDock === 'above' ? -WIDGET_ACTIONS_TOOLBAR_OFFSET_PX : 8 }}
        >
          <NodeOverlayEditorActionsToolbar
            visible={toolbarVisible}
            iconSizeClass={getIconSizeClass(uiIconScale)}
            iconStrokeWidth={uiIconStrokeWidth}
            active={active}
            enableHandlesDisabled={enableHandlesDisabled}
            convertToLoopDisabled={convertToLoopDisabled}
            duplicateDisabled={pinnedInCanvas || forcePinnedToCanvas === true}
            importUrlAction={isVideoTranscriberWidget ? {
              visible: true,
              initialUrl: typeof (node.properties || {}).sourceUrl === 'string' ? String((node.properties || {}).sourceUrl || '').trim() : '',
              onConfirm: (url) => {
                onPatchProperties({ sourceUrl: url })
              },
            } : undefined}
            richMediaViewToggle={isRichMediaPanelWidget ? {
              visible: true,
              isKtvRows: hideFields,
              onToggle: handleToggleHideFields,
            } : undefined}
            richMediaMediaSelector={isRichMediaPanelWidget ? {
              visible: true,
              selectedMode: richMediaSelectedMode,
              onSelect: handleSelectRichMediaMode,
            } : undefined}
            richMediaAspectToggle={isRichMediaPanelWidget ? {
              visible: true,
              selected: richMediaAspectSelection,
              onToggle: handleToggleRichMediaAspect,
            } : undefined}
            onRun={onRun}
            onDuplicate={onDuplicate}
            onClearOutput={onClearOutput}
            onHelp={onHelp}
            onRemove={onRemove}
            onEnableHandlesForAllInputs={onEnableHandlesForAllInputs}
            onConvertToLoopNode={onConvertToLoopNode}
            onUpdateKvEntry={onUpdateKvEntry}
          />
        </div>

      <NodeOverlayEditorPanel
        active={active}
        node={node}
        graphMetaKind={graphMetaKind}
        minimized={minimized}
        hideFields={hideFields}
        pinned={pinnedInCanvas}
        uiPanelOpacity={uiPanelOpacity}
        panelTextClass={panelTextClass}
        microLabelClass={microLabelClass}
        monospaceTextClass={monospaceTextClass}
        uiIconScale={uiIconScale}
        uiIconStrokeWidth={uiIconStrokeWidth}
        labelInputRef={labelInputRef}
        onHeaderPointerDown={handleHeaderPointerDown}
        onToggleHideFields={handleToggleHideFields}
        onTogglePinned={handleTogglePinned}
        onPinnedPointerDown={handlePinnedPointerDown}
        onToggleMinimized={handleToggleMinimized}
        onSetLabel={onSetLabel}
        onSetType={onSetType}
        onPatchProperties={onPatchProperties}
        onSetProperties={onSetProperties}
        onValidate={onValidate}
        onRegistrySelectionChange={handleRegistrySelectionChange}
        onRenameSchemaFieldId={onRenameSchemaFieldId}

        registryEntry={registryEntry}
        registryEntries={widgetRegistry}

        connectedValuesBySchemaPath={connectedValuesBySchemaPath}

        portHandleEdges={Array.isArray(edges) ? edges : []}
        schema={schema}
        toolMode={toolMode}
        pendingEdgeSourceId={pendingEdgeSourceId}
        onBeginAddEdgeFromNode={onBeginAddEdgeFromNode}
        onFinalizeAddEdgeToNode={onFinalizeAddEdgeToNode}
      />
      </div>
    </aside>
  )

  if (typeof document === 'undefined') return overlayElement
  return createPortal(overlayElement, document.body)
})

const NodeOverlayEditor = React.memo(function NodeOverlayEditor(props: NodeOverlayEditorProps) {
  if (props.visible === false) return null
  return <NodeOverlayEditorInner {...props} />
})

export default NodeOverlayEditor
