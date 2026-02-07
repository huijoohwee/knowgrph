import React from 'react'
import { createPortal } from 'react-dom'

import { NodeOverlayEditorPanel } from '@/components/FlowEditor/NodeOverlayEditorPanel'
import { worldToScreen } from '@/lib/zoom/viewport'
import { DEFAULT_FLOW_NODE_WIDTH_PX } from '@/lib/graph/layoutDefaults'
import { useOutsideClose } from '@/hooks/useOutsideClose'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import {
  LS_KEYS,
  UI_COPY,
  UI_LABELS,
  UI_SELECTORS,
} from '@/lib/config'
import { isHandlesForAllInputsEnabled, isLoopNode } from '@/lib/flowEditor/flowEditorActions'
import { lsBool, lsInt, lsSetBool, lsSetInt } from '@/lib/persistence'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { usePinnedLs } from '@/lib/ui/panelPinned'
import { clampOverlayTopLeftToViewport } from '@/lib/ui/overlayClamp'
import { useIsomorphicLayoutEffect } from '@/lib/react/useIsomorphicLayoutEffect'
import { DEFAULT_ZOOM_MAX_SCALE, DEFAULT_ZOOM_MIN_SCALE, readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import {
  computeNodeQuickEditorScale,
  computeNodeQuickEditorScaledSize,
  NODE_QUICK_EDITOR_BASE_SIZE,
} from '@/components/FlowEditor/nodeQuickEditorZoom'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { useShallow } from 'zustand/react/shallow'
import { resolveNodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'
import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'

const NodeOverlayEditor = React.memo(function NodeOverlayEditor({
  active,
  node,
  viewportW,
  viewportH,
  canvasWindowOffset,
  autoRevealKey,
  forcePinnedToNode,
  stackIndex,
  edges,
  toolMode,
  pendingEdgeSourceId,
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
  onTogglePortHandles,
  onEnableHandlesForAllInputs,
  onPinnedToNodeChange,
}: {
  active: boolean
  node: GraphNode
  viewportW: number
  viewportH: number
  canvasWindowOffset?: { left: number; top: number } | null
  autoRevealKey?: number
  forcePinnedToNode?: boolean
  stackIndex?: number
  edges: ReadonlyArray<GraphEdge>
  toolMode?: 'select' | 'addEdge'
  pendingEdgeSourceId?: string | null
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
  onTogglePortHandles: () => void
  onEnableHandlesForAllInputs: () => void
  onPinnedToNodeChange?: (pinnedToNode: boolean) => void
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
    })),
  )

  const overlayZIndex = React.useMemo(() => {
    const safeFloating = Number.isFinite(floatingPanelZIndex) ? Math.max(1, Math.floor(floatingPanelZIndex)) : 5000
    return Math.max(2600, safeFloating + 10)
  }, [floatingPanelZIndex])

  const registryEntry: NodeQuickEditorRegistryEntry | null = React.useMemo(
    () => resolveNodeQuickEditorRegistryEntry({ node, registry: nodeQuickEditorRegistry }),
    [node, nodeQuickEditorRegistry],
  )

  const asideRef = React.useRef<HTMLElement | null>(null)
  const nodeRef = React.useRef<GraphNode>(node)
  const viewportRef = React.useRef<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : viewportW,
    height: typeof window !== 'undefined' ? window.innerHeight : viewportH,
  })
  const canvasWindowOffsetRef = React.useRef<{ left: number; top: number }>({ left: 0, top: 0 })
  const schemaRef = React.useRef(schema)
  const pinnedRef = React.useRef(false)
  const pinnedPosRef = React.useRef<{ top: number; left: number }>({ top: 48, left: 16 })
  const anchoredPosRef = React.useRef<{ top: number; left: number }>({ top: 48, left: 16 })
  const scaledSizeRef = React.useRef<{ width: number; height: number }>({ width: NODE_QUICK_EDITOR_BASE_SIZE.width, height: NODE_QUICK_EDITOR_BASE_SIZE.height })
  const zoomStateRef = React.useRef<{ k: number; x: number; y: number } | null>(useGraphStore.getState().zoomState || null)
  const lastAppliedRef = React.useRef<{ left: number; top: number; scale: number } | null>(null)
  const cssInitRef = React.useRef(false)
  const pendingClampCommitRef = React.useRef<number | null>(null)

  const { pinned, setPinned } = usePinnedLs(LS_KEYS.flowNodeQuickEditorPinned, false)
  const [minimized, setMinimized] = React.useState<boolean>(() => lsBool(LS_KEYS.flowNodeQuickEditorMinimized, false))
  const [hideFields, setHideFields] = React.useState<boolean>(() => lsBool(LS_KEYS.flowNodeQuickEditorHideFields, false))
  const [pinnedTopPx, setPinnedTopPx] = React.useState<number>(() => lsInt(LS_KEYS.flowNodeQuickEditorTopPx, 48))
  const [pinnedLeftPx, setPinnedLeftPx] = React.useState<number>(() => lsInt(LS_KEYS.flowNodeQuickEditorLeftPx, 16))

  const [menuOpen, setMenuOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLElement | null>(null)
  const moreButtonRef = React.useRef<HTMLButtonElement | null>(null)
  useOutsideClose(menuOpen, setMenuOpen, menuRef, [moreButtonRef])

  const labelInputRef = React.useRef<HTMLInputElement | null>(null)

  const effectivePinned = forcePinnedToNode ? false : pinned
  const pinnedToNode = !effectivePinned

  const autoStackOffset = React.useMemo(() => {
    const idx = Number.isFinite(stackIndex) ? Math.max(0, Math.floor(stackIndex as number)) : 0
    if (idx <= 0) return { top: 0, left: 0 }
    return { top: idx * 28, left: idx * 10 }
  }, [stackIndex])

  React.useEffect(() => {
    if (!active) return
    if (!autoRevealKey) return
    setPinned(false)
    setMinimized(prev => {
      if (!prev) return prev
      lsSetBool(LS_KEYS.flowNodeQuickEditorMinimized, false)
      return false
    })
  }, [active, autoRevealKey, setPinned])

  React.useEffect(() => {
    if (!active) return
    if (!forcePinnedToNode) return
    if (!pinned) return
    setPinned(false)
  }, [active, forcePinnedToNode, pinned, setPinned])

  const portHandlesEnabled = Boolean(schema?.behavior?.portHandles?.enabled)
  const portHandlesDisabled = documentStructureBaselineLock === true
  const enableHandlesDisabled = documentStructureBaselineLock === true || isHandlesForAllInputsEnabled(schema)
  const convertToLoopDisabled = isLoopNode(node)

  React.useEffect(() => {
    onPinnedToNodeChange?.(pinnedToNode)
  }, [onPinnedToNodeChange, pinnedToNode])

  React.useEffect(() => {
    nodeRef.current = node
  }, [node])

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      viewportRef.current = { width: viewportW, height: viewportH }
      return
    }
    const apply = () => {
      const w = Math.max(1, Math.floor(window.innerWidth || 1))
      const h = Math.max(1, Math.floor(window.innerHeight || 1))
      viewportRef.current = { width: w, height: h }
    }
    apply()
    window.addEventListener('resize', apply)
    return () => {
      window.removeEventListener('resize', apply)
    }
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

  React.useEffect(() => {
    pinnedRef.current = effectivePinned
  }, [effectivePinned])

  React.useEffect(() => {
    pinnedPosRef.current = { top: pinnedTopPx, left: pinnedLeftPx }
  }, [pinnedLeftPx, pinnedTopPx])

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
      const cur = pinnedPosRef.current
      if (cur.top === next.top && cur.left === next.left) return
      setPinnedTopPx(prev => (prev === next.top ? prev : next.top))
      setPinnedLeftPx(prev => (prev === next.left ? prev : next.left))
      lsSetInt(LS_KEYS.flowNodeQuickEditorTopPx, next.top, { min: -4096, max: 4096 })
      lsSetInt(LS_KEYS.flowNodeQuickEditorLeftPx, next.left, { min: -4096, max: 4096 })
    }, 140) as unknown as number
  }, [])

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
    const storeZoom = useGraphStore.getState().zoomState || null
    let z = zoomStateRef.current
    if (storeZoom && storeZoom !== z) {
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
    const { sx: screenX, sy: screenY } = worldToScreen({
      transform: z,
      x: Number.isFinite(n.x) ? n.x : 0,
      y: Number.isFinite(n.y) ? n.y : 0,
    })
    const offset = canvasWindowOffsetRef.current
    const nodeWindowX = screenX + offset.left
    const nodeWindowY = screenY + offset.top
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
    const anchoredLeftPx = nodeWindowX + DEFAULT_FLOW_NODE_WIDTH_PX * zoomK + 16 + portExtraPadScreenPx
    const anchoredTopPx = nodeWindowY - 12
    anchoredPosRef.current = { top: anchoredTopPx, left: anchoredLeftPx }

    const { width: viewportWidth, height: viewportHeight } = viewportRef.current
    const pinned = pinnedRef.current
    const basePos = pinned
      ? pinnedPosRef.current
      : { top: anchoredPosRef.current.top + autoStackOffset.top, left: anchoredPosRef.current.left + autoStackOffset.left }
    const pos = clampOverlayTopLeftToViewport({
      pos: basePos,
      size: scaled,
      viewport: { width: viewportWidth, height: viewportHeight },
      visiblePx: 32,
      snapPx: 1,
    })

    if (pinned && (pos.top !== basePos.top || pos.left !== basePos.left)) scheduleClampCommit(pos)

    const last = lastAppliedRef.current
    if (last && last.left === pos.left && last.top === pos.top && Math.abs(last.scale - panelScale) < 1e-6) return
    lastAppliedRef.current = { left: pos.left, top: pos.top, scale: panelScale }

    el.style.transform = `translate3d(${pos.left}px, ${pos.top}px, 0) scale(${panelScale})`
  }, [autoStackOffset.left, autoStackOffset.top, scheduleClampCommit])

  useIsomorphicLayoutEffect(() => {
    applyOverlayPosition()
  }, [applyOverlayPosition, pinned, pinnedLeftPx, pinnedTopPx, viewportH, viewportW, node.x, node.y])

  React.useEffect(() => {
    const unsub = useGraphStore.subscribe(
      s => s.zoomState,
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
  }, [applyOverlayPosition])

  const handleTogglePinned = React.useCallback(() => {
    setPinned(prev => {
      const next = !prev
      if (next) {
        const anchor = anchoredPosRef.current
        const scaled = scaledSizeRef.current
        const { width: viewportWidth, height: viewportHeight } = viewportRef.current
        const pos = clampOverlayTopLeftToViewport({
          pos: anchor,
          size: scaled,
          viewport: { width: viewportWidth, height: viewportHeight },
          visiblePx: 32,
          snapPx: 1,
        })
        setPinnedTopPx(lsSetInt(LS_KEYS.flowNodeQuickEditorTopPx, pos.top, { min: -4096, max: 4096 }))
        setPinnedLeftPx(lsSetInt(LS_KEYS.flowNodeQuickEditorLeftPx, pos.left, { min: -4096, max: 4096 }))
      }
      return next
    })
  }, [setPinned])

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

  const handleHeaderPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!pinnedRef.current) return
      if (event.button !== 0) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest(UI_SELECTORS.draggablePanelIgnorePointerDown)) return

      const startTop = pinnedPosRef.current.top
      const startLeft = pinnedPosRef.current.left
      const startX = event.clientX
      const startY = event.clientY
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
          const next = clampOverlayTopLeftToViewport({
            pos: { top: startTop + dy, left: startLeft + dx },
            size: scaled,
            viewport: { width: viewportWidth, height: viewportHeight },
            visiblePx: 32,
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
          lsSetInt(LS_KEYS.flowNodeQuickEditorTopPx, pendingTop, { min: -4096, max: 4096 })
          lsSetInt(LS_KEYS.flowNodeQuickEditorLeftPx, pendingLeft, { min: -4096, max: 4096 })
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
          lsSetInt(LS_KEYS.flowNodeQuickEditorTopPx, pendingTop, { min: -4096, max: 4096 })
          lsSetInt(LS_KEYS.flowNodeQuickEditorLeftPx, pendingLeft, { min: -4096, max: 4096 })
        },
      })
    },
    [],
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
      data-kg-canvas-wheel-ignore="true"
      className="fixed"
      style={{ zIndex: overlayZIndex }}
    >
      <NodeOverlayEditorPanel
        active={active}
        node={node}
        minimized={minimized}
        hideFields={hideFields}
        pinned={effectivePinned}
        portHandlesEnabled={portHandlesEnabled}
        portHandlesDisabled={portHandlesDisabled}
        enableHandlesDisabled={enableHandlesDisabled}
        convertToLoopDisabled={convertToLoopDisabled}
        uiPanelOpacity={uiPanelOpacity}
        panelTextClass={panelTextClass}
        microLabelClass={microLabelClass}
        uiIconScale={uiIconScale}
        uiIconStrokeWidth={uiIconStrokeWidth}
        labelInputRef={labelInputRef}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        menuRef={menuRef}
        moreButtonRef={moreButtonRef}
        onHeaderPointerDown={handleHeaderPointerDown}
        onToggleHideFields={handleToggleHideFields}
        onTogglePinned={handleTogglePinned}
        onToggleMinimized={handleToggleMinimized}
        onTogglePortHandles={onTogglePortHandles}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
        onClearOutput={onClearOutput}
        onHelp={onHelp}
        onConvertToLoopNode={onConvertToLoopNode}
        onEnableHandlesForAllInputs={onEnableHandlesForAllInputs}
        onSetLabel={onSetLabel}
        onSetType={onSetType}
        onPatchProperties={onPatchProperties}
        onSetProperties={onSetProperties}
        onValidate={onValidate}
        onRegistrySelectionChange={handleRegistrySelectionChange}

        registryEntry={registryEntry}
        registryEntries={nodeQuickEditorRegistry}

        portHandleEdges={Array.isArray(edges) ? edges : []}
        schema={schema}
        toolMode={toolMode}
        pendingEdgeSourceId={pendingEdgeSourceId}
        onBeginAddEdgeFromNode={onBeginAddEdgeFromNode}
        onFinalizeAddEdgeToNode={onFinalizeAddEdgeToNode}
      />
    </aside>
  )

  if (typeof document === 'undefined') return overlayElement
  return createPortal(overlayElement, document.body)
})

export default NodeOverlayEditor
