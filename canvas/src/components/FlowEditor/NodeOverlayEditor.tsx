import React from 'react'
import { createPortal } from 'react-dom'

import { NodeOverlayEditorPanel } from '@/components/FlowEditor/NodeOverlayEditorPanel'
import { NodeOverlayEditorActionsToolbar } from '@/components/FlowEditor/NodeOverlayEditorActionsToolbar'
import { worldToScreen } from '@/lib/zoom/viewport'
import { DEFAULT_FLOW_NODE_WIDTH_PX } from '@/lib/graph/layoutDefaults'
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
import { lsBool, lsJson, lsSetBool, lsSetJson } from '@/lib/persistence'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { clampOverlayTopLeftFullyInViewport } from '@/lib/ui/overlayClamp'
import { useIsomorphicLayoutEffect } from '@/lib/react/useIsomorphicLayoutEffect'
import { lockGlobalUserSelect, unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { DEFAULT_ZOOM_MAX_SCALE, DEFAULT_ZOOM_MIN_SCALE, readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
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

const NodeOverlayEditor = React.memo(function NodeOverlayEditor({
  active,
  node,
  viewportW,
  viewportH,
  canvasWindowOffset,
  autoRevealKey,
  forcePinnedToNode,
  stackIndex,
  liveInteractionTick,
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
  onPinnedToNodeChange,
  onRenameSchemaFieldId,
}: {
  active: boolean
  node: GraphNode
  viewportW: number
  viewportH: number
  canvasWindowOffset?: { left: number; top: number } | null
  autoRevealKey?: number
  forcePinnedToNode?: boolean
  stackIndex?: number
  liveInteractionTick?: number
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
  onPinnedToNodeChange?: (pinnedToNode: boolean) => void
  onRenameSchemaFieldId?: (args: { prevId: string; nextId: string }) => void
}) {
  const { panelTextClass, microLabelClass } = usePanelTypography()
  const {
    uiIconScale,
    uiIconStrokeWidth,
    uiPanelOpacity,
    floatingPanelZIndex,
    schema,
    documentStructureBaselineLock,
    nodeQuickEditorRegistry,
    upsertUiToast,
    selectNode,
    setSelectionSource,
    selectedNodeId,
  } = useGraphStore(
    useShallow(s => ({
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
      uiPanelOpacity: s.uiPanelOpacity,
      floatingPanelZIndex: s.floatingPanelZIndex,
      schema: s.schema,
      documentStructureBaselineLock: s.documentStructureBaselineLock === true,
      nodeQuickEditorRegistry: s.nodeQuickEditorRegistry || [],
      upsertUiToast: s.upsertUiToast,
      selectNode: s.selectNode,
      setSelectionSource: s.setSelectionSource,
      selectedNodeId: s.selectedNodeId,
    })),
  )

  const nodeId = React.useMemo(() => String(node.id || '').trim(), [node.id])

  const overlayZIndex = React.useMemo(() => {
    const safeFloating = Number.isFinite(floatingPanelZIndex) ? Math.max(1, Math.floor(floatingPanelZIndex)) : 5000
    const base = safeFloating - 1
    const idx = Number.isFinite(stackIndex) ? Math.max(0, Math.floor(stackIndex as number)) : 0
    const selected = String(selectedNodeId || '').trim() === nodeId
    if (selected) return Math.max(11, base)
    return Math.max(11, base - 1 - Math.min(24, idx))
  }, [floatingPanelZIndex, nodeId, selectedNodeId, stackIndex])

  const registryEntry: NodeQuickEditorRegistryEntry | null = React.useMemo(
    () => resolveNodeQuickEditorRegistryEntry({ node, registry: nodeQuickEditorRegistry }),
    [node, nodeQuickEditorRegistry],
  )

  const asideRef = React.useRef<HTMLElement | null>(null)
  const nodeRef = React.useRef<GraphNode>(node)
  const viewportRef = React.useRef<{ width: number; height: number }>({
    width: viewportW,
    height: viewportH,
  })
  const canvasWindowOffsetRef = React.useRef<{ left: number; top: number }>({ left: 0, top: 0 })
  const schemaRef = React.useRef(schema)
  const pinnedRef = React.useRef(false)
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
  const livePosWarmupRafRef = React.useRef<number | null>(null)

  const parsePinnedByNodeId = React.useCallback((raw: unknown): Record<string, boolean> | null => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const out: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const id = String(k || '').trim()
      if (!id) continue
      out[id] = !!v
    }
    return out
  }, [])

  const parsePosByNodeId = React.useCallback((raw: unknown): Record<string, { top: number; left: number }> | null => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const out: Record<string, { top: number; left: number }> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const id = String(k || '').trim()
      if (!id) continue
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue
      const o = v as { top?: unknown; left?: unknown }
      const top = typeof o.top === 'number' && Number.isFinite(o.top) ? o.top : null
      const left = typeof o.left === 'number' && Number.isFinite(o.left) ? o.left : null
      if (top == null || left == null) continue
      out[id] = { top, left }
    }
    return out
  }, [])

  const readLockedToNode = React.useCallback(
    (id: string): boolean => {
      if (!id) return false
      const map = lsJson(LS_KEYS.flowNodeQuickEditorPinnedByNodeId, {} as Record<string, boolean>, parsePinnedByNodeId)
      const v = map[id]
      return typeof v === 'boolean' ? v : false
    },
    [parsePinnedByNodeId],
  )

  const [lockedToNode, setLockedToNodeState] = React.useState<boolean>(() => readLockedToNode(nodeId))

  React.useEffect(() => {
    setLockedToNodeState(readLockedToNode(nodeId))
  }, [nodeId, readLockedToNode])

  const setLockedToNode = React.useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setLockedToNodeState(prev => {
        const resolved = typeof next === 'function' ? (next as (v: boolean) => boolean)(prev) : next
        pinnedRef.current = (forcePinnedToNode ? false : !resolved) === true
        const map = lsJson(LS_KEYS.flowNodeQuickEditorPinnedByNodeId, {} as Record<string, boolean>, parsePinnedByNodeId)
        const out = nodeId ? { ...map, [nodeId]: !!resolved } : map
        if (nodeId) lsSetJson(LS_KEYS.flowNodeQuickEditorPinnedByNodeId, out)
        return !!resolved
      })
    },
    [forcePinnedToNode, nodeId, parsePinnedByNodeId],
  )

  const [minimized, setMinimized] = React.useState<boolean>(() => lsBool(LS_KEYS.flowNodeQuickEditorMinimized, false))
  const [hideFields, setHideFields] = React.useState<boolean>(() => lsBool(LS_KEYS.flowNodeQuickEditorHideFields, false))

  const defaultFloatingPos = React.useMemo(() => {
    return computeDefaultNodeQuickEditorFloatingPos({ stackIndex, viewportW, viewportH })
  }, [stackIndex, viewportH, viewportW])

  const resolveFloatingPos = React.useCallback(
    (id: string, fallback: { top: number; left: number }): { top: number; left: number } => {
      if (!id) return fallback
      const map = lsJson(
        LS_KEYS.flowNodeQuickEditorPosByNodeId,
        {} as Record<string, { top: number; left: number }>,
        parsePosByNodeId,
      )
      const v = map[id]
      if (v && Number.isFinite(v.top) && Number.isFinite(v.left)) {
        const viewportWidth = viewportW
        const viewportHeight = viewportH
        const offset = canvasWindowOffsetRef.current
        const leftRaw = v.left
        const topRaw = v.top
        const looksLikeWindowCoords =
          (offset.left !== 0 || offset.top !== 0)
          && leftRaw >= offset.left - 2
          && leftRaw <= offset.left + viewportWidth + 2
          && topRaw >= offset.top - 2
          && topRaw <= offset.top + viewportHeight + 2
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
    [parsePosByNodeId, viewportH, viewportW],
  )

  const [pinnedTopPx, setPinnedTopPx] = React.useState<number>(() => resolveFloatingPos(nodeId, defaultFloatingPos).top)
  const [pinnedLeftPx, setPinnedLeftPx] = React.useState<number>(() => resolveFloatingPos(nodeId, defaultFloatingPos).left)

  React.useEffect(() => {
    const pos = resolveFloatingPos(nodeId, defaultFloatingPos)
    setPinnedTopPx(prev => (prev === pos.top ? prev : pos.top))
    setPinnedLeftPx(prev => (prev === pos.left ? prev : pos.left))
  }, [defaultFloatingPos, nodeId, resolveFloatingPos])

  const [toolbarVisible, setToolbarVisible] = React.useState(false)
  useOutsideClose(toolbarVisible, setToolbarVisible, asideRef)

  const labelInputRef = React.useRef<HTMLInputElement | null>(null)

  const floating = forcePinnedToNode ? false : !lockedToNode
  const pinnedToNode = !floating

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
    setLockedToNode(true)
    setMinimized(prev => {
      if (!prev) return prev
      lsSetBool(LS_KEYS.flowNodeQuickEditorMinimized, false)
      return false
    })
  }, [active, autoRevealKey, setLockedToNode])

  const enableHandlesDisabled = documentStructureBaselineLock === true || isHandlesForAllInputsEnabled(schema)
  const convertToLoopDisabled = isLoopNode(node)

  React.useEffect(() => {
    onPinnedToNodeChange?.(pinnedToNode)
  }, [onPinnedToNodeChange, pinnedToNode])

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
    pinnedRef.current = floating
  }, [floating])

  const persistFloatingPos = React.useCallback(
    (pos: { top: number; left: number }) => {
      if (!nodeId) return
      const map = lsJson(
        LS_KEYS.flowNodeQuickEditorPosByNodeId,
        {} as Record<string, { top: number; left: number }>,
        parsePosByNodeId,
      )
      const out = { ...map, [nodeId]: { top: pos.top, left: pos.left } }
      lsSetJson(LS_KEYS.flowNodeQuickEditorPosByNodeId, out)
    },
    [nodeId, parsePosByNodeId],
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
      if (!pinnedRef.current) return
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
    const schemaCur = schemaRef.current
    const [minK, maxK] = schemaCur ? readZoomScaleExtent(schemaCur) : [DEFAULT_ZOOM_MIN_SCALE, DEFAULT_ZOOM_MAX_SCALE]
    const panelScale = computeNodeQuickEditorScale(zoomK, { minK, maxK })
    const scaled = computeNodeQuickEditorScaledSize(panelScale)
    scaledSizeRef.current = scaled

    const n = nodeRef.current
    const live = getLiveNodeWorldPos ? getLiveNodeWorldPos(nodeId) : null
    const x = live && Number.isFinite(live.x) ? live.x : (Number.isFinite(n.x) ? n.x : 0)
    const y = live && Number.isFinite(live.y) ? live.y : (Number.isFinite(n.y) ? n.y : 0)
    const { sx: screenX, sy: screenY } = worldToScreen({
      transform: z,
      x,
      y,
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
    const portExtraPadScreenPx = portEnabled ? (portSizePx + portOffsetPx + 8) * zoomK : 0
    const anchoredLeftPx = screenX + DEFAULT_FLOW_NODE_WIDTH_PX * zoomK + 16 + portExtraPadScreenPx
    const anchoredTopPx = screenY - 12
    anchoredPosRef.current = { top: anchoredTopPx, left: anchoredLeftPx }

    const viewportWidth = viewportW
    const viewportHeight = viewportH
    const pinned = pinnedRef.current
    const anchorOffset = useGraphStore.getState().flowNodeQuickEditorAnchorOffsetByNodeId?.[nodeId] || null
    const anchorDx = typeof anchorOffset?.dx === 'number' && Number.isFinite(anchorOffset.dx) ? (anchorOffset.dx as number) : 0
    const anchorDy = typeof anchorOffset?.dy === 'number' && Number.isFinite(anchorOffset.dy) ? (anchorOffset.dy as number) : 0
    const basePos = pinned
      ? { top: pinnedTopPx, left: pinnedLeftPx }
      : {
          top: anchoredPosRef.current.top + autoStackOffset.top + anchorDy,
          left: anchoredPosRef.current.left + autoStackOffset.left + anchorDx,
        }
    const safeBasePos = {
      top: Number.isFinite(basePos.top) ? basePos.top : 8,
      left: Number.isFinite(basePos.left) ? basePos.left : 8,
    }
    const pos = pinned
      ? clampOverlayTopLeftFullyInViewport({
          pos: safeBasePos,
          size: scaled,
          viewport: { width: viewportWidth, height: viewportHeight },
          snapPx: 1,
        })
      : safeBasePos

    if (pinned && (pos.top !== safeBasePos.top || pos.left !== safeBasePos.left)) scheduleClampCommit(pos)

    const last = lastAppliedRef.current
    if (last && last.left === pos.left && last.top === pos.top && Math.abs(last.scale - panelScale) < 1e-6) return
    lastAppliedRef.current = { left: pos.left, top: pos.top, scale: panelScale }

    const offset = canvasWindowOffsetRef.current
    el.style.transform = `translate3d(${pos.left + offset.left}px, ${pos.top + offset.top}px, 0) scale(${panelScale})`
  }, [autoStackOffset.left, autoStackOffset.top, getLiveNodeWorldPos, nodeId, scheduleClampCommit, viewportH, viewportW, zoomViewKey])

  React.useEffect(() => {
    if (!active) return
    if (!getLiveNodeWorldPos) return
    if (floating) return
    if (typeof window === 'undefined') return

    const initialLive = getLiveNodeWorldPos(nodeId)
    if (initialLive && Number.isFinite(initialLive.x) && Number.isFinite(initialLive.y)) return

    let attempts = 0
    const tick = () => {
      attempts += 1
      applyOverlayPosition()
      const live = getLiveNodeWorldPos(nodeId)
      if ((live && Number.isFinite(live.x) && Number.isFinite(live.y)) || attempts >= 14) {
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
    liveInteractionTick,
    lockedToNode,
    pinnedLeftPx,
    pinnedTopPx,
    viewportH,
    viewportW,
    node.x,
    node.y,
  ])

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

  const handleTogglePinned = React.useCallback(() => {
    setLockedToNode(prev => {
      const nextLocked = !prev
      if (nextLocked) {
        const base = anchoredPosRef.current
        const applied = lastAppliedRef.current
        const desired = {
          top: applied ? applied.top : pinnedTopPx,
          left: applied ? applied.left : pinnedLeftPx,
        }
        const anchorBase = {
          top: base.top + autoStackOffset.top,
          left: base.left + autoStackOffset.left,
        }
        const dx = desired.left - anchorBase.left
        const dy = desired.top - anchorBase.top
        const st = useGraphStore.getState()
        const prevOffsets = st.flowNodeQuickEditorAnchorOffsetByNodeId || {}
        const nextOffsets = { ...prevOffsets, [nodeId]: { dx, dy } }
        st.setFlowNodeQuickEditorAnchorOffsetByNodeId(nextOffsets)
      } else {
        useGraphStore.getState().clearFlowNodeQuickEditorAnchorOffsetByNodeId(nodeId)
      }
      if (!nextLocked) {
        const scaled = scaledSizeRef.current
        const viewportWidth = viewportW
        const viewportHeight = viewportH
        const applied = lastAppliedRef.current
        const fallback = anchoredPosRef.current
        const current = {
          top: applied ? applied.top : fallback.top + autoStackOffset.top,
          left: applied ? applied.left : fallback.left + autoStackOffset.left,
        }
        const pos = clampOverlayTopLeftFullyInViewport({
          pos: current,
          size: scaled,
          viewport: { width: viewportWidth, height: viewportHeight },
          snapPx: 1,
        })
        setPinnedTopPx(prevTop => (prevTop === pos.top ? prevTop : pos.top))
        setPinnedLeftPx(prevLeft => (prevLeft === pos.left ? prevLeft : pos.left))
        persistFloatingPos(pos)
      }
      return nextLocked
    })
  }, [autoStackOffset.left, autoStackOffset.top, nodeId, persistFloatingPos, pinnedLeftPx, pinnedTopPx, setLockedToNode, viewportH, viewportW])

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
    }
  }, [])

  const handleHeaderPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest(UI_SELECTORS.draggablePanelIgnorePointerDown)) return

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

      if (lockedToNode) {
        const st = useGraphStore.getState()
        const clampOffset = (v: number) => Math.max(-400, Math.min(400, v))
        const prevOffsets = st.flowNodeQuickEditorAnchorOffsetByNodeId || {}
        const openIds = Array.isArray(st.openQuickEditorNodeIds) ? st.openQuickEditorNodeIds : []
        const pinnedIds = openIds.filter(id => readLockedToNode(id))
        const startOffsetsById = new Map<string, { dx: number; dy: number }>()
        for (let i = 0; i < pinnedIds.length; i += 1) {
          const id = pinnedIds[i]
          const o = prevOffsets[id] || { dx: 0, dy: 0 }
          const dx = typeof o.dx === 'number' && Number.isFinite(o.dx) ? o.dx : 0
          const dy = typeof o.dy === 'number' && Number.isFinite(o.dy) ? o.dy : 0
          startOffsetsById.set(id, { dx, dy })
        }
        let pendingDx = 0
        let pendingDy = 0
        let raf: number | null = null

        const flush = () => {
          raf = null
          const current = useGraphStore.getState().flowNodeQuickEditorAnchorOffsetByNodeId || {}
          const next = { ...current }
          for (let i = 0; i < pinnedIds.length; i += 1) {
            const id = pinnedIds[i]
            const start = startOffsetsById.get(id) || { dx: 0, dy: 0 }
            next[id] = { dx: clampOffset(start.dx + pendingDx), dy: clampOffset(start.dy + pendingDy) }
          }
          useGraphStore.getState().setFlowNodeQuickEditorAnchorOffsetByNodeId(next)
          applyOverlayPosition()
        }

        startPointerDrag({
          ev: event.nativeEvent,
          cursor: 'move',
          onMove: mv => {
            const dx = mv.clientX - startX
            const dy = mv.clientY - startY
            pendingDx = dx
            pendingDy = dy
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
            unlockGlobalUserSelect()
          },
        })
        return
      }

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
        ev: event.nativeEvent,
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
          unlockGlobalUserSelect()
        },
      })
    },
    [applyOverlayPosition, lockedToNode, nodeId, persistFloatingPos, pinnedLeftPx, pinnedTopPx, readLockedToNode],
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
      data-kg-canvas-wheel-ignore="true"
      className="fixed"
      style={{ zIndex: overlayZIndex }}
      onPointerDownCapture={(ev) => {
        if (!active) return
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
        pinned={lockedToNode}
        uiPanelOpacity={uiPanelOpacity}
        panelTextClass={panelTextClass}
        microLabelClass={microLabelClass}
        uiIconScale={uiIconScale}
        uiIconStrokeWidth={uiIconStrokeWidth}
        labelInputRef={labelInputRef}
        onHeaderPointerDown={handleHeaderPointerDown}
        onToggleHideFields={handleToggleHideFields}
        onTogglePinned={handleTogglePinned}
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

export default NodeOverlayEditor
