import React from 'react'

import { NodeOverlayEditorPanel } from '@/components/FlowEditor/NodeOverlayEditorPanel'
import { worldToScreen } from '@/lib/zoom/viewport'
import { DEFAULT_FLOW_NODE_WIDTH_PX } from '@/lib/graph/layoutDefaults'
import { useOutsideClose } from '@/hooks/useOutsideClose'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import {
  LS_KEYS,
  UI_LABELS,
  UI_SELECTORS,
  type FlowEditorSmartNodeProperties,
} from '@/lib/config'
import { isHandlesForAllInputsEnabled, isLoopNode } from '@/lib/flowEditor/flowEditorActions'
import { lsBool, lsInt, lsSetBool, lsSetInt } from '@/lib/persistence'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { usePinnedLs } from '@/lib/ui/panelPinned'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { clampOverlayTopLeftToViewport } from '@/lib/ui/overlayClamp'
import { useIsomorphicLayoutEffect } from '@/lib/react/useIsomorphicLayoutEffect'
import { cn } from '@/lib/utils'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import {
  computeNodeQuickEditorScale,
  computeNodeQuickEditorScaledSize,
  NODE_QUICK_EDITOR_BASE_SIZE,
} from '@/components/FlowEditor/nodeQuickEditorZoom'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import {
  X,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'

const NodeOverlayEditor = React.memo(function NodeOverlayEditor({
  active,
  node,
  viewportW,
  viewportH,
  edges,
  toolMode,
  pendingEdgeSourceId,
  onBeginAddEdgeFromNode,
  onFinalizeAddEdgeToNode,
  onSetLabel,
  onSetType,
  onPatchProperties,
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
  edges: ReadonlyArray<GraphEdge>
  toolMode?: 'select' | 'addEdge'
  pendingEdgeSourceId?: string | null
  onBeginAddEdgeFromNode?: (nodeId: string) => void
  onFinalizeAddEdgeToNode?: (nodeId: string) => void
  onSetLabel: (label: string) => void
  onSetType: (type: string) => void
  onPatchProperties: (patch: Partial<FlowEditorSmartNodeProperties>) => void
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
  const { uiIconScale, uiIconStrokeWidth, uiPanelOpacity, schema, documentStructureBaselineLock } = useGraphStore(
    useShallow(s => ({
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
      uiPanelOpacity: s.uiPanelOpacity,
      schema: s.schema,
      documentStructureBaselineLock: s.documentStructureBaselineLock === true,
    })),
  )

  const asideRef = React.useRef<HTMLElement | null>(null)
  const nodeRef = React.useRef<GraphNode>(node)
  const viewportRef = React.useRef<{ width: number; height: number }>({ width: viewportW, height: viewportH })
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

  const pinnedToNode = !pinned

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
    viewportRef.current = { width: viewportW, height: viewportH }
  }, [viewportH, viewportW])

  React.useEffect(() => {
    schemaRef.current = schema
  }, [schema])

  React.useEffect(() => {
    pinnedRef.current = pinned
  }, [pinned])

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
    const [minK, maxK] = readZoomScaleExtent(schemaRef.current)
    const panelScale = computeNodeQuickEditorScale(zoomK, { minK, maxK })
    const scaled = computeNodeQuickEditorScaledSize(panelScale)
    scaledSizeRef.current = scaled

    const n = nodeRef.current
    const { sx: screenX, sy: screenY } = worldToScreen({
      transform: z,
      x: Number.isFinite(n.x) ? n.x : 0,
      y: Number.isFinite(n.y) ? n.y : 0,
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

    const { width: viewportWidth, height: viewportHeight } = viewportRef.current
    const pinned = pinnedRef.current
    const basePos = pinned ? pinnedPosRef.current : anchoredPosRef.current
    const pos = pinned
      ? clampOverlayTopLeftToViewport({
          pos: basePos,
          size: scaled,
          viewport: { width: viewportWidth, height: viewportHeight },
          visiblePx: 32,
          snapPx: 1,
        })
      : basePos

    if (pinned && (pos.top !== basePos.top || pos.left !== basePos.left)) scheduleClampCommit(pos)

    const last = lastAppliedRef.current
    if (last && last.left === pos.left && last.top === pos.top && Math.abs(last.scale - panelScale) < 1e-6) return
    lastAppliedRef.current = { left: pos.left, top: pos.top, scale: panelScale }

    el.style.transform = `translate3d(${pos.left}px, ${pos.top}px, 0) scale(${panelScale})`
  }, [scheduleClampCommit])

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

  return (
    <aside
      ref={asideRef}
      aria-label={UI_LABELS.flowNodeQuickEditor}
      data-kg-canvas-wheel-ignore="true"
      className="absolute z-[240]"
    >
      <NodeOverlayEditorPanel
        active={active}
        node={node}
        minimized={minimized}
        hideFields={hideFields}
        pinned={pinned}
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
        onValidate={onValidate}

        portHandleEdges={edges}
        schema={schema}
        toolMode={toolMode}
        pendingEdgeSourceId={pendingEdgeSourceId}
        onBeginAddEdgeFromNode={onBeginAddEdgeFromNode}
        onFinalizeAddEdgeToNode={onFinalizeAddEdgeToNode}
      />
    </aside>
  )
})

export default NodeOverlayEditor
