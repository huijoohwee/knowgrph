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
import { lockGlobalUserSelect, unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import { FLOW_EDITOR_INTERACTION_FRAME_EVENT } from '@/lib/canvas/flow-editor-overlay-proxy'
import {
  computeNodeQuickEditorScale,
  computeNodeQuickEditorScaledSize,
  NODE_QUICK_EDITOR_BASE_SIZE,
} from '@/components/FlowEditor/nodeQuickEditorZoom'
import { computeDefaultNodeQuickEditorFloatingPos } from '@/components/FlowEditor/nodeQuickEditorLayout'
import { getIconSizeClass } from '@/lib/ui'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { useShallow } from 'zustand/react/shallow'
import { resolveNodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'
import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'

const FLOW_EDITOR_NODE_OVERLAY_Z_INDEX_BASE = 140
const FLOW_EDITOR_NODE_OVERLAY_Z_INDEX_SELECTED = 170

type NodeOverlayEditorProps = {
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
  onDuplicate: () => void
  onRemove: () => void
  onClearOutput: () => void
  onHelp: () => void
  onConvertToLoopNode: () => void
  onEnableHandlesForAllInputs: () => void
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
  onDuplicate,
  onRemove,
  onClearOutput,
  onHelp,
  onConvertToLoopNode,
  onEnableHandlesForAllInputs,
  onPinnedInCanvasChange,
  onRenameSchemaFieldId,
}: NodeOverlayEditorProps) {
  const { panelTextClass, microLabelClass } = usePanelTypography()
  const {
    uiIconScale,
    uiIconStrokeWidth,
    uiPanelOpacity,
    schema,
    documentStructureBaselineLock,
    nodeQuickEditorRegistry,
    upsertUiToast,
    selectNode,
    setSelectionSource,
    selectedNodeId,
    setFlowNodeQuickEditorPosByNodeId,
    setFlowNodeQuickEditorWorldPosByNodeId,
    setFlowNodeQuickEditorPinnedByNodeId,
  } = useGraphStore(
    useShallow(s => ({
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
      uiPanelOpacity: s.uiPanelOpacity,
      schema: s.schema,
      documentStructureBaselineLock: s.documentStructureBaselineLock === true,
      nodeQuickEditorRegistry: s.nodeQuickEditorRegistry || [],
      upsertUiToast: s.upsertUiToast,
      selectNode: s.selectNode,
      setSelectionSource: s.setSelectionSource,
      selectedNodeId: s.selectedNodeId,
      setFlowNodeQuickEditorPosByNodeId: s.setFlowNodeQuickEditorPosByNodeId,
      setFlowNodeQuickEditorWorldPosByNodeId: (s as unknown as { setFlowNodeQuickEditorWorldPosByNodeId: (pos: Record<string, { x: number; y: number }>) => void })
        .setFlowNodeQuickEditorWorldPosByNodeId,
      setFlowNodeQuickEditorPinnedByNodeId: s.setFlowNodeQuickEditorPinnedByNodeId,
    })),
  )

  const nodeId = React.useMemo(() => String(node.id || '').trim(), [node.id])

  const quickEditorPos = useGraphStore(
    useShallow(s => s.flowNodeQuickEditorPosByNodeId?.[nodeId]),
  )
  const quickEditorWorldPos = useGraphStore(
    useShallow(s => (s as unknown as { flowNodeQuickEditorWorldPosByNodeId?: Record<string, { x: number; y: number }> }).flowNodeQuickEditorWorldPosByNodeId?.[nodeId]),
  )

  const overlayZIndex = React.useMemo(() => {
    const idx = Number.isFinite(stackIndex) ? Math.max(0, Math.floor(stackIndex as number)) : 0
    const selected = String(selectedNodeId || '').trim() === nodeId
    if (selected) return FLOW_EDITOR_NODE_OVERLAY_Z_INDEX_SELECTED
    return Math.max(20, FLOW_EDITOR_NODE_OVERLAY_Z_INDEX_BASE - Math.min(48, idx))
  }, [nodeId, selectedNodeId, stackIndex])

  const registryEntry: NodeQuickEditorRegistryEntry | null = React.useMemo(
    () => resolveNodeQuickEditorRegistryEntry({ node, registry: nodeQuickEditorRegistry }),
    [node, nodeQuickEditorRegistry],
  )

  const asideRef = React.useRef<HTMLElement | null>(null)
  const nodeRef = React.useRef<GraphNode>(node)
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
  const scaledSizeRef = React.useRef<{ width: number; height: number }>({ width: NODE_QUICK_EDITOR_BASE_SIZE.width, height: NODE_QUICK_EDITOR_BASE_SIZE.height })
  const zoomStateRef = React.useRef<{ k: number; x: number; y: number } | null>(
    getEffectiveZoomStateForKey({
      zoomViewKey,
      zoomStateByKey: useGraphStore.getState().zoomStateByKey,
      zoomState: useGraphStore.getState().zoomState,
    }),
  )
  const lastAppliedRef = React.useRef<{ left: number; top: number; scale: number } | null>(null)
  const cssInitRef = React.useRef(false)
  const pendingClampCommitRef = React.useRef<number | null>(null)
  const pinToggleCollisionGuardRef = React.useRef<number | null>(null)
  const skipPinClickRef = React.useRef(false)
  const livePosWarmupRafRef = React.useRef<number | null>(null)

  const readPinnedInCanvas = React.useCallback(
    (id: string): boolean => {
      if (!id) return false
      const map = useGraphStore.getState().flowNodeQuickEditorPinnedByNodeId || {}
      const v = map[id]
      return typeof v === 'boolean' ? v : true
    },
    [],
  )

  const [pinnedInCanvas, setPinnedInCanvasState] = React.useState<boolean>(() => readPinnedInCanvas(nodeId))

  React.useEffect(() => {
    setPinnedInCanvasState(readPinnedInCanvas(nodeId))
  }, [nodeId, readPinnedInCanvas])

  const setPinnedInCanvas = React.useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setPinnedInCanvasState(prev => {
        const resolved = typeof next === 'function' ? (next as (v: boolean) => boolean)(prev) : next
        if (nodeId) {
          const map = useGraphStore.getState().flowNodeQuickEditorPinnedByNodeId || {}
          setFlowNodeQuickEditorPinnedByNodeId({ ...map, [nodeId]: !!resolved })
        }
        return !!resolved
      })
    },
    [nodeId, setFlowNodeQuickEditorPinnedByNodeId],
  )

  const [minimized, setMinimized] = React.useState<boolean>(() => lsBool(LS_KEYS.flowNodeQuickEditorMinimized, false))
  const [hideFields, setHideFields] = React.useState<boolean>(() => lsBool(LS_KEYS.flowNodeQuickEditorHideFields, false))

  const defaultFloatingPos = React.useMemo(() => {
    return computeDefaultNodeQuickEditorFloatingPos({ stackIndex, viewportW, viewportH })
  }, [stackIndex, viewportH, viewportW])

  const resolveFloatingPos = React.useCallback(
    (pos: { top: number; left: number } | undefined, fallback: { top: number; left: number }): { top: number; left: number } => {
      const v = pos
      if (v && Number.isFinite(v.top) && Number.isFinite(v.left)) {
        const offset = canvasWindowOffsetRef.current
        const viewportWidth = (() => {
          if (typeof window === 'undefined') return viewportW
          const w =
            (typeof document !== 'undefined' && document.documentElement ? document.documentElement.clientWidth : null) ??
            window.innerWidth
          return Math.max(1, Math.floor((Number.isFinite(w) ? (w as number) : viewportW) - offset.left))
        })()
        const viewportHeight = (() => {
          if (typeof window === 'undefined') return viewportH
          const h =
            (typeof document !== 'undefined' && document.documentElement ? document.documentElement.clientHeight : null) ??
            window.innerHeight
          return Math.max(1, Math.floor((Number.isFinite(h) ? (h as number) : viewportH) - offset.top))
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
          size: NODE_QUICK_EDITOR_BASE_SIZE,
          viewport: { width: viewportWidth, height: viewportHeight },
          snapPx: 1,
        })
        return clamped
      }
      return fallback
    },
    [viewportH, viewportW],
  )

  const [pinnedTopPx, setPinnedTopPx] = React.useState<number>(() => resolveFloatingPos(quickEditorPos, defaultFloatingPos).top)
  const [pinnedLeftPx, setPinnedLeftPx] = React.useState<number>(() => resolveFloatingPos(quickEditorPos, defaultFloatingPos).left)

  React.useEffect(() => {
    const pos = resolveFloatingPos(quickEditorPos, defaultFloatingPos)
    setPinnedTopPx(prev => (prev === pos.top ? prev : pos.top))
    setPinnedLeftPx(prev => (prev === pos.left ? prev : pos.left))
  }, [defaultFloatingPos, quickEditorPos, resolveFloatingPos])

  const [toolbarVisible, setToolbarVisible] = React.useState(false)
  useOutsideClose(toolbarVisible, setToolbarVisible, asideRef)

  const labelInputRef = React.useRef<HTMLInputElement | null>(null)

  const floating = forcePinnedToCanvas ? false : !pinnedInCanvas

  const autoStackOffset = React.useMemo(() => {
    const idx = Number.isFinite(stackIndex) ? Math.max(0, Math.floor(stackIndex as number)) : 0
    if (idx <= 0) return { top: 0, left: 0 }
    const cols = 3
    const col = idx % cols
    const row = Math.floor(idx / cols)
    return { top: row * 54 + col * 8, left: col * 54 }
  }, [stackIndex])

  React.useEffect(() => {
    if (!active) return
    if (!autoRevealKey) return
    setPinnedInCanvas(true)
    setMinimized(prev => {
      if (!prev) return prev
      lsSetBool(LS_KEYS.flowNodeQuickEditorMinimized, false)
      return false
    })
  }, [active, autoRevealKey, setPinnedInCanvas])

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
    if (!active) {
      setToolbarVisible(false)
      return
    }
    const id = String(node.id || '').trim()
    if (!id) return
    if (selectedNodeId !== id) setToolbarVisible(false)
  }, [active, node.id, selectedNodeId, toolbarVisible])

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
      const current = useGraphStore.getState().flowNodeQuickEditorPosByNodeId || {}
      const next = { ...current, [nodeId]: { top: pos.top, left: pos.left } }
      useGraphStore.getState().setFlowNodeQuickEditorPosByNodeId(next)
    },
    [nodeId],
  )

  const persistWorldPos = React.useCallback(
    (pos: { x: number; y: number }) => {
      if (!nodeId) return
      const current =
        (useGraphStore.getState() as unknown as { flowNodeQuickEditorWorldPosByNodeId?: Record<string, { x: number; y: number }> })
          .flowNodeQuickEditorWorldPosByNodeId || {}
      const next = { ...current, [nodeId]: { x: pos.x, y: pos.y } }
      setFlowNodeQuickEditorWorldPosByNodeId(next)
    },
    [nodeId, setFlowNodeQuickEditorWorldPosByNodeId],
  )

  const scheduleClampCommit = React.useCallback((next: { top: number; left: number }) => {
    if (pendingClampCommitRef.current != null) {
      try {
        clearTimeout(pendingClampCommitRef.current)
      } catch {
        void 0
      }
    }
    pendingClampCommitRef.current = setTimeout(() => {
      pendingClampCommitRef.current = null
      if (!floatingRef.current) return
      if (pinnedTopPx === next.top && pinnedLeftPx === next.left) return
      setPinnedTopPx(prev => (prev === next.top ? prev : next.top))
      setPinnedLeftPx(prev => (prev === next.left ? prev : next.left))
      persistFloatingPos(next)
    }, 140) as unknown as number
  }, [persistFloatingPos, pinnedLeftPx, pinnedTopPx])

  const applyOverlayPosition = React.useCallback(() => {
    const el = asideRef.current
    if (!el) return
    if (!cssInitRef.current) {
      cssInitRef.current = true
      el.style.left = '0px'
      el.style.top = '0px'
      el.style.width = `${NODE_QUICK_EDITOR_BASE_SIZE.width}px`
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
    const panelScale = computeNodeQuickEditorScale(zoomK, extent, { mode: floatingRef.current ? 'floating' : 'pinnedInCanvas' })
    const scaled = computeNodeQuickEditorScaledSize(panelScale)
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
    const anchoredLeftPx = screenX + DEFAULT_FLOW_NODE_WIDTH_PX * zoomK + 16 + portExtraPadScreenPx
    const anchoredTopPx = screenY - 12
    anchoredPosRef.current = { top: anchoredTopPx, left: anchoredLeftPx }

    const viewportWidth = viewportW
    const viewportHeight = viewportH
    const floating = floatingRef.current
    const dragOverride = pinnedDragOverrideRef.current
    const worldDragOverride = worldDragOverrideRef.current
    const storedWorld = quickEditorWorldPos && Number.isFinite(quickEditorWorldPos.x) && Number.isFinite(quickEditorWorldPos.y)
      ? { x: quickEditorWorldPos.x, y: quickEditorWorldPos.y }
      : null
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
      if (typeof window === 'undefined') return { width: viewportWidth, height: viewportHeight }
      const offset = canvasWindowOffsetRef.current
      const w =
        (typeof document !== 'undefined' && document.documentElement ? document.documentElement.clientWidth : null) ??
        window.innerWidth
      const h =
        (typeof document !== 'undefined' && document.documentElement ? document.documentElement.clientHeight : null) ??
        window.innerHeight
      return {
        width: Math.max(1, Math.floor((Number.isFinite(w) ? (w as number) : viewportWidth) - offset.left)),
        height: Math.max(1, Math.floor((Number.isFinite(h) ? (h as number) : viewportHeight) - offset.top)),
      }
    })()
    const pos = shouldClampFloating
      ? clampOverlayTopLeftToViewport({
          pos: safeBasePos,
          size: scaled,
          viewport: floatingViewport,
          visiblePx: 48,
          snapPx: 1,
        })
      : safeBasePos

    if (shouldClampFloating && (pos.top !== safeBasePos.top || pos.left !== safeBasePos.left)) scheduleClampCommit(pos)

    const last = lastAppliedRef.current
    if (last && last.left === pos.left && last.top === pos.top && Math.abs(last.scale - panelScale) < 1e-6) return
    lastAppliedRef.current = { left: pos.left, top: pos.top, scale: panelScale }

    const offset = canvasWindowOffsetRef.current
    const tx = pos.left + offset.left
    const ty = pos.top + offset.top
    el.style.transform = `matrix(${panelScale}, 0, 0, ${panelScale}, ${tx}, ${ty})`
  }, [
    getLiveNodeWorldPos,
    getLiveZoomTransform,
    nodeId,
    quickEditorWorldPos,
    pinnedLeftPx,
    pinnedTopPx,
    scheduleClampCommit,
    viewportH,
    viewportW,
    zoomViewKey,
  ])

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
    if (quickEditorWorldPos && Number.isFinite(quickEditorWorldPos.x) && Number.isFinite(quickEditorWorldPos.y)) return
    applyOverlayPosition()
    const z = (getLiveZoomTransform ? getLiveZoomTransform() : null) || zoomStateRef.current || { k: 1, x: 0, y: 0 }
    const world = screenToWorld({
      transform: z,
      sx: anchoredPosRef.current.left + autoStackOffset.left,
      sy: anchoredPosRef.current.top + autoStackOffset.top,
    })
    persistWorldPos(world)
  }, [active, applyOverlayPosition, autoStackOffset.left, autoStackOffset.top, floating, getLiveZoomTransform, nodeId, persistWorldPos, quickEditorWorldPos])

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
      st.setFlowNodeQuickEditorDraggingNodeId(nodeId)
      if (opts?.keepDragging !== true) {
        pinToggleCollisionGuardRef.current = setTimeout(() => {
          pinToggleCollisionGuardRef.current = null
          const cur = useGraphStore.getState().flowNodeQuickEditorDraggingNodeId
          if (cur === nodeId) useGraphStore.getState().setFlowNodeQuickEditorDraggingNodeId(null)
        }, 240) as unknown as number
      }
    }
    setPinnedInCanvas(prev => {
      const nextPinned = !prev
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

      const z = readZoom()

      if (nextPinned) {
        const applied = lastAppliedRef.current
        const desired = {
          top: applied ? applied.top : pinnedTopPx,
          left: applied ? applied.left : pinnedLeftPx,
        }
        const world = screenToWorld({ transform: z, sx: desired.left, sy: desired.top })
        persistWorldPos(world)
        return nextPinned
      }

      const storedWorld =
        quickEditorWorldPos && Number.isFinite(quickEditorWorldPos.x) && Number.isFinite(quickEditorWorldPos.y)
          ? { x: quickEditorWorldPos.x, y: quickEditorWorldPos.y }
          : null
      const defaultWorld = screenToWorld({
        transform: z,
        sx: anchoredPosRef.current.left + autoStackOffset.left,
        sy: anchoredPosRef.current.top + autoStackOffset.top,
      })
      const world = worldDragOverrideRef.current || storedWorld || defaultWorld
      const screen = worldToScreen({ transform: z, x: world.x, y: world.y })
      const scaled = scaledSizeRef.current
      const pos = clampOverlayTopLeftFullyInViewport({
        pos: { top: screen.sy, left: screen.sx },
        size: scaled,
        viewport: { width: viewportW, height: viewportH },
        snapPx: 1,
      })
      setPinnedTopPx(prevTop => (prevTop === pos.top ? prevTop : pos.top))
      setPinnedLeftPx(prevLeft => (prevLeft === pos.left ? prevLeft : pos.left))
      persistFloatingPos(pos)
      return nextPinned
    })
  }, [
    autoStackOffset.left,
    autoStackOffset.top,
    getLiveZoomTransform,
    nodeId,
    persistFloatingPos,
    persistWorldPos,
    pinnedLeftPx,
    pinnedTopPx,
    quickEditorWorldPos,
    setPinnedInCanvas,
    viewportH,
    viewportW,
    zoomViewKey,
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
    const willUnpinToFloating = pinnedInCanvas === true && forcePinnedToCanvas !== true
    togglePinnedInternal({ keepDragging: willUnpinToFloating })
    if (!willUnpinToFloating) return

    const startX = event.clientX
    const startY = event.clientY
    const nativeEv = event.nativeEvent
    try {
      lockGlobalUserSelect()
    } catch {
      void 0
    }

    const startDrag = () => {
      const applied = lastAppliedRef.current
      const startTop = applied ? applied.top : pinnedTopPx
      const startLeft = applied ? applied.left : pinnedLeftPx
      let pendingTop = startTop
      let pendingLeft = startLeft
      let raf: number | null = null

      const flush = () => {
        raf = null
        setPinnedTopPx(prev => (prev === pendingTop ? prev : pendingTop))
        setPinnedLeftPx(prev => (prev === pendingLeft ? prev : pendingLeft))
      }

      startPointerDrag({
        ev: nativeEv,
        cursor: 'move',
        onMove: mv => {
          const dx = mv.clientX - startX
          const dy = mv.clientY - startY
          const scaled = scaledSizeRef.current
          const { width: viewportWidth, height: viewportHeight } = viewportRef.current
          const next = clampOverlayTopLeftFullyInViewport({
            pos: { top: startTop + dy, left: startLeft + dx },
            size: scaled,
            viewport: { width: viewportWidth, height: viewportHeight },
            snapPx: 1,
          })
          pendingTop = next.top
          pendingLeft = next.left
          if (raf != null) return
          raf = requestAnimationFrame(flush)
        },
        onEnd: () => {
          if (raf != null) {
            try {
              cancelAnimationFrame(raf)
            } catch {
              void 0
            }
            flush()
          }
          persistFloatingPos({ top: pendingTop, left: pendingLeft })
          const cur = useGraphStore.getState().flowNodeQuickEditorDraggingNodeId
          if (cur === nodeId) useGraphStore.getState().setFlowNodeQuickEditorDraggingNodeId(null)
          unlockGlobalUserSelect()
        },
        onCancel: () => {
          if (raf != null) {
            try {
              cancelAnimationFrame(raf)
            } catch {
              void 0
            }
            flush()
          }
          persistFloatingPos({ top: pendingTop, left: pendingLeft })
          const cur = useGraphStore.getState().flowNodeQuickEditorDraggingNodeId
          if (cur === nodeId) useGraphStore.getState().setFlowNodeQuickEditorDraggingNodeId(null)
          unlockGlobalUserSelect()
        },
      })
    }

    requestAnimationFrame(startDrag)
  }, [forcePinnedToCanvas, pinnedInCanvas, nodeId, persistFloatingPos, pinnedLeftPx, pinnedTopPx, togglePinnedInternal])

  const handleToggleMinimized = React.useCallback(() => {
    setMinimized(prev => {
      const next = !prev
      lsSetBool(LS_KEYS.flowNodeQuickEditorMinimized, next)
      return next
    })
  }, [])

  const handleToggleHideFields = React.useCallback(() => {
    setHideFields(prev => {
      const next = !prev
      lsSetBool(LS_KEYS.flowNodeQuickEditorHideFields, next)
      return next
    })
  }, [])

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
        useGraphStore.getState().setFlowNodeQuickEditorDraggingNodeId(nodeId)
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
        const storedWorld =
          quickEditorWorldPos && Number.isFinite(quickEditorWorldPos.x) && Number.isFinite(quickEditorWorldPos.y)
            ? { x: quickEditorWorldPos.x, y: quickEditorWorldPos.y }
            : null
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

        let raf: number | null = null
        let pending: { x: number; y: number } | null = null

        const flush = () => {
          raf = null
          if (!pending) return
          worldDragOverrideRef.current = pending
          applyOverlayPosition()
          try {
            window.dispatchEvent(new CustomEvent(FLOW_EDITOR_INTERACTION_FRAME_EVENT))
          } catch {
            void 0
          }
        }

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
            if (raf != null) return
            raf = requestAnimationFrame(flush)
          },
          onEnd: () => {
            if (raf != null) {
              try {
                cancelAnimationFrame(raf)
              } catch {
                void 0
              }
              flush()
            }
            const out = worldDragOverrideRef.current || startWorld
            worldDragOverrideRef.current = null
            persistWorldPos(out)
            useGraphStore.getState().setFlowNodeQuickEditorDraggingNodeId(null)
            unlockGlobalUserSelect()
          },
          onCancel: () => {
            if (raf != null) {
              try {
                cancelAnimationFrame(raf)
              } catch {
                void 0
              }
              flush()
            }
            worldDragOverrideRef.current = null
            applyOverlayPosition()
            useGraphStore.getState().setFlowNodeQuickEditorDraggingNodeId(null)
            unlockGlobalUserSelect()
          },
        })
        return
      }

      const applied = lastAppliedRef.current
      const startTop = applied ? applied.top : pinnedTopPx
      const startLeft = applied ? applied.left : pinnedLeftPx
      useGraphStore.getState().setFlowNodeQuickEditorDraggingNodeId(nodeId)
      let pendingTop = startTop
      let pendingLeft = startLeft
      let raf: number | null = null

      const flush = () => {
        raf = null
        pinnedDragOverrideRef.current = { left: pendingLeft, top: pendingTop }
        applyOverlayPosition()
        try {
          window.dispatchEvent(new CustomEvent(FLOW_EDITOR_INTERACTION_FRAME_EVENT))
        } catch {
          void 0
        }
      }

      startPointerDrag({
        ev: event.nativeEvent,
        cursor: 'move',
        onMove: mv => {
          const dx = mv.clientX - startX
          const dy = mv.clientY - startY
          pendingTop = startTop + dy
          pendingLeft = startLeft + dx
          if (raf != null) return
          raf = requestAnimationFrame(flush)
        },
        onEnd: () => {
          if (raf != null) {
            try {
              cancelAnimationFrame(raf)
            } catch {
              void 0
            }
            flush()
          }
          pinnedDragOverrideRef.current = null
          const scaled = scaledSizeRef.current
          const canvasOffset = canvasWindowOffsetRef.current
          const viewportWidth = (() => {
            if (typeof window === 'undefined') return viewportRef.current.width
            const w =
              (typeof document !== 'undefined' && document.documentElement ? document.documentElement.clientWidth : null) ??
              window.innerWidth
            return Math.max(1, Math.floor((Number.isFinite(w) ? (w as number) : viewportRef.current.width) - canvasOffset.left))
          })()
          const viewportHeight = (() => {
            if (typeof window === 'undefined') return viewportRef.current.height
            const h =
              (typeof document !== 'undefined' && document.documentElement ? document.documentElement.clientHeight : null) ??
              window.innerHeight
            return Math.max(1, Math.floor((Number.isFinite(h) ? (h as number) : viewportRef.current.height) - canvasOffset.top))
          })()
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
          useGraphStore.getState().setFlowNodeQuickEditorDraggingNodeId(null)
          unlockGlobalUserSelect()
        },
        onCancel: () => {
          if (raf != null) {
            try {
              cancelAnimationFrame(raf)
            } catch {
              void 0
            }
            flush()
          }
          pinnedDragOverrideRef.current = null
          const scaled = scaledSizeRef.current
          const canvasOffset = canvasWindowOffsetRef.current
          const viewportWidth = (() => {
            if (typeof window === 'undefined') return viewportRef.current.width
            const w =
              (typeof document !== 'undefined' && document.documentElement ? document.documentElement.clientWidth : null) ??
              window.innerWidth
            return Math.max(1, Math.floor((Number.isFinite(w) ? (w as number) : viewportRef.current.width) - canvasOffset.left))
          })()
          const viewportHeight = (() => {
            if (typeof window === 'undefined') return viewportRef.current.height
            const h =
              (typeof document !== 'undefined' && document.documentElement ? document.documentElement.clientHeight : null) ??
              window.innerHeight
            return Math.max(1, Math.floor((Number.isFinite(h) ? (h as number) : viewportRef.current.height) - canvasOffset.top))
          })()
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
          useGraphStore.getState().setFlowNodeQuickEditorDraggingNodeId(null)
          unlockGlobalUserSelect()
        },
      })
    },
    [
      applyOverlayPosition,
      autoStackOffset.left,
      autoStackOffset.top,
      floating,
      getLiveZoomTransform,
      nodeId,
      persistFloatingPos,
      persistWorldPos,
      pinnedLeftPx,
      pinnedTopPx,
      quickEditorWorldPos,
      selectNode,
      setSelectionSource,
      zoomViewKey,
    ],
  )

  const handleRegistrySelectionChange = React.useCallback(
    ({ entry }: { entry: NodeQuickEditorRegistryEntry | null }) => {
      if (!active) return
      if (!entry) {
        upsertUiToast({
          id: `flow-node-quick-editor-registry-clear-${String(node.id || '')}`,
          kind: 'neutral',
          message: UI_COPY.flowNodeQuickEditorRegistryClearedToast,
          ttlMs: 2200,
        })
        return
      }
      const label = `${entry.nodeTypeId} · ${entry.quickEditorTypeId} · ${entry.formId}`
      upsertUiToast({
        id: `flow-node-quick-editor-registry-${entry.id}`,
        kind: 'neutral',
        message: UI_COPY.flowNodeQuickEditorRegistryToast(label),
        ttlMs: 2500,
      })
    },
    [active, node.id, upsertUiToast],
  )

  const overlayElement = (
    <aside
      ref={asideRef}
      aria-label={UI_LABELS.flowNodeQuickEditor}
      data-kg-node-quick-editor={String(node.id || '')}
      data-kg-node-quick-editor-pinned={pinnedInCanvas ? '1' : '0'}
      data-kg-canvas-wheel-ignore="true"
      className="fixed"
      style={{ zIndex: overlayZIndex }}
      onPointerDownCapture={(ev) => {
        if (!active) return
        if (ev.button === 0 && pinnedInCanvas && ev.altKey !== true && isSpacePanHeld() !== true) {
          const t = ev.target
          const el = t instanceof Element ? t : null
          if (el?.closest('[data-kg-flow-node-drag-handle="true"]')) return
        }
        if (ev.button === 0 && isSpacePanHeld()) {
          const t = ev.target
          const el = t instanceof Element ? t : null
          if (!el?.closest('input,textarea,select,button,[contenteditable="true"]')) {
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
        const id = String(node.id || '').trim()
        if (!id) return
        setSelectionSource('editor')
        selectNode(id)
        setToolbarVisible(true)
      }}
    >
      <div className="relative">
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: -40 }}>
          <NodeOverlayEditorActionsToolbar
            visible={toolbarVisible && selectedNodeId === String(node.id || '').trim()}
            iconSizeClass={getIconSizeClass(uiIconScale)}
            iconStrokeWidth={uiIconStrokeWidth}
            active={active}
            enableHandlesDisabled={enableHandlesDisabled}
            convertToLoopDisabled={convertToLoopDisabled}
            onDuplicate={onDuplicate}
            onClearOutput={onClearOutput}
            onHelp={onHelp}
            onRemove={onRemove}
            onEnableHandlesForAllInputs={onEnableHandlesForAllInputs}
            onConvertToLoopNode={onConvertToLoopNode}
          />
        </div>

      <NodeOverlayEditorPanel
        active={active}
        node={node}
        minimized={minimized}
        hideFields={hideFields}
        pinned={pinnedInCanvas}
        uiPanelOpacity={uiPanelOpacity}
        panelTextClass={panelTextClass}
        microLabelClass={microLabelClass}
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
        registryEntries={nodeQuickEditorRegistry}

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
  if (props.active !== true) return null
  return <NodeOverlayEditorInner {...props} />
})

export default NodeOverlayEditor
