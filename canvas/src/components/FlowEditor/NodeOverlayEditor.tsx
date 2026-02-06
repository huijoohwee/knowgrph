import React from 'react'

import IconButton from '@/components/IconButton'
import { FloatingPanel } from '@/components/ui/FloatingPanel'
import { NodeOverlayEditorForm } from '@/components/FlowEditor/NodeOverlayEditorForm'
import { worldToScreen } from '@/lib/zoom/viewport'
import { emitSidePanelOpen } from '@/features/canvas/utils'
import { useOutsideClose } from '@/hooks/useOutsideClose'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphNode } from '@/lib/graph/types'
import {
  LS_KEYS,
  UI_COPY,
  UI_LABELS,
  UI_SELECTORS,
  type FlowEditorSmartNodeProperties,
} from '@/lib/config'
import { lsBool, lsInt, lsSetBool, lsSetInt } from '@/lib/persistence'
import { getIconSizeClass } from '@/lib/ui'
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
  ChevronDown,
  ChevronUp,
  Copy,
  Eraser,
  HelpCircle,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'

const NodeOverlayEditorPanel = React.memo(function NodeOverlayEditorPanel(args: {
  active: boolean
  node: GraphNode
  minimized: boolean
  hideFields: boolean
  pinned: boolean
  uiPanelOpacity: number | null | undefined
  panelTextClass: string
  microLabelClass: string
  iconSizeClass: string
  uiIconStrokeWidth: number
  labelInputRef: React.MutableRefObject<HTMLInputElement | null>
  menuOpen: boolean
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  menuRef: React.MutableRefObject<HTMLElement | null>
  moreButtonRef: React.MutableRefObject<HTMLButtonElement | null>
  onHeaderPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  onToggleHideFields: () => void
  onTogglePinned: () => void
  onToggleMinimized: () => void
  onDuplicate: () => void
  onRemove: () => void
  onClearOutput: () => void
  onHelp: () => void
  onConvertToLoopNode: () => void
  onEnableHandlesForAllInputs: () => void
  onSetLabel: (label: string) => void
  onSetType: (type: string) => void
  onPatchProperties: (patch: Partial<FlowEditorSmartNodeProperties>) => void
  onValidate: () => void
}) {
  const {
    active,
    node,
    minimized,
    hideFields,
    pinned,
    uiPanelOpacity,
    panelTextClass,
    microLabelClass,
    iconSizeClass,
    uiIconStrokeWidth,
    labelInputRef,
    menuOpen,
    setMenuOpen,
    menuRef,
    moreButtonRef,
    onHeaderPointerDown,
    onToggleHideFields,
    onTogglePinned,
    onToggleMinimized,
    onDuplicate,
    onRemove,
    onClearOutput,
    onHelp,
    onConvertToLoopNode,
    onEnableHandlesForAllInputs,
    onSetLabel,
    onSetType,
    onPatchProperties,
    onValidate,
  } = args

  return (
    <FloatingPanel
      as="section"
      ariaLabel={UI_LABELS.flowNodeQuickEditor}
      className={cn(
          'rounded-xl border shadow-lg overflow-hidden flex flex-col',
        UI_THEME_TOKENS.panel.bg,
        UI_THEME_TOKENS.input.border,
        UI_THEME_TOKENS.text.primary,
        panelTextClass,
      )}
      onWheelCapture={e => {
        try {
          e.stopPropagation()
        } catch {
          void 0
        }
      }}
      style={{
        opacity: Number.isFinite(uiPanelOpacity) ? uiPanelOpacity : 1,
        height: minimized ? undefined : NODE_QUICK_EDITOR_BASE_SIZE.height,
      }}
    >
      <header
        className={cn('px-3 py-2 border-b', UI_THEME_TOKENS.panel.border, pinned ? 'cursor-move select-none' : '')}
        onPointerDown={onHeaderPointerDown}
      >
        <section className="flex items-start justify-between gap-2" aria-label="Node editor header">
          <section className="min-w-0" aria-label="Node title">
            <h3 className={cn('font-semibold truncate', UI_THEME_TOKENS.text.primary)}>{String(node.label || node.id)}</h3>
            <p className={cn('mt-0.5 truncate', microLabelClass, UI_THEME_TOKENS.text.secondary)}>{String(node.id || '')}</p>
          </section>

          <nav className="flex items-center gap-1" aria-label={UI_LABELS.flowNodeQuickEditor}>
            <IconButton
              title={hideFields ? UI_LABELS.showFields : UI_LABELS.hideFields}
              tooltipContent={hideFields ? UI_COPY.flowNodeQuickEditorShowFields : UI_COPY.flowNodeQuickEditorHideFields}
              showTooltip
              onClick={onToggleHideFields}
              className={cn('App-toolbar__btn', hideFields ? 'text-blue-600 dark:text-blue-400' : '')}
              disabled={!active}
            >
              {hideFields ? (
                <ChevronDown className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
              ) : (
                <ChevronUp className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
              )}
            </IconButton>

            <IconButton
              title={UI_LABELS.changeName}
              tooltipContent={UI_COPY.flowNodeQuickEditorChangeName}
              showTooltip
              onClick={() => {
                const el = labelInputRef.current
                if (!el) return
                el.focus()
                el.select()
              }}
              className="App-toolbar__btn"
              disabled={!active}
            >
              <Pencil className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
            </IconButton>

            <IconButton
              title={UI_LABELS.duplicate}
              tooltipContent={UI_COPY.flowNodeQuickEditorDuplicate}
              showTooltip
              onClick={onDuplicate}
              className="App-toolbar__btn"
              disabled={!active}
            >
              <Copy className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
            </IconButton>

            <IconButton
              title={UI_LABELS.clearOutput}
              tooltipContent={UI_COPY.flowNodeQuickEditorClearOutput}
              showTooltip
              onClick={onClearOutput}
              className="App-toolbar__btn"
              disabled={!active}
            >
              <Eraser className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
            </IconButton>

            <IconButton
              title={UI_LABELS.help}
              tooltipContent={UI_COPY.flowNodeQuickEditorHelp}
              showTooltip
              onClick={onHelp}
              className="App-toolbar__btn"
              disabled={!active}
            >
              <HelpCircle className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
            </IconButton>

            <IconButton
              title={UI_LABELS.removeNode}
              tooltipContent={UI_COPY.flowNodeQuickEditorRemoveNode}
              showTooltip
              onClick={onRemove}
              className={cn('App-toolbar__btn', 'text-red-700 dark:text-red-400')}
              disabled={!active}
            >
              <Trash2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
            </IconButton>

            <IconButton
              title={pinned ? UI_LABELS.unpinPanel : UI_LABELS.pinPanel}
              tooltipContent={pinned ? UI_COPY.flowNodeQuickEditorUnpin : UI_COPY.flowNodeQuickEditorPin}
              showTooltip
              onClick={onTogglePinned}
              className={cn('App-toolbar__btn', pinned ? 'text-blue-600 dark:text-blue-400' : '')}
              disabled={!active}
            >
              {pinned ? (
                <Pin className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
              ) : (
                <PinOff className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
              )}
            </IconButton>

            <IconButton
              ref={moreButtonRef}
              title={UI_LABELS.more}
              tooltipContent={UI_COPY.flowNodeQuickEditorMenu}
              showTooltip
              onClick={() => setMenuOpen(v => !v)}
              className={cn('App-toolbar__btn', menuOpen ? 'text-blue-600 dark:text-blue-400' : '')}
              disabled={!active}
            >
              <MoreHorizontal className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
            </IconButton>
          </nav>
        </section>

        <section className="mt-1 flex items-center justify-end gap-1" aria-label="Node editor panel controls">
          <IconButton
            title={minimized ? UI_LABELS.restorePanel : UI_LABELS.minimizePanel}
            tooltipContent={minimized ? UI_COPY.flowNodeQuickEditorRestore : UI_COPY.flowNodeQuickEditorMinimize}
            showTooltip
            onClick={onToggleMinimized}
            className="App-toolbar__btn"
            disabled={!active}
          >
            {minimized ? (
              <ChevronDown className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
            ) : (
              <ChevronUp className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
            )}
          </IconButton>
        </section>

        {menuOpen && (
          <menu
            ref={menuRef}
            className={cn('mt-2 overflow-hidden rounded-lg border shadow-xl', UI_THEME_TOKENS.panel.bg, UI_THEME_TOKENS.panel.border)}
            aria-label={UI_LABELS.menu}
          >
            <li>
              <button
                type="button"
                className={cn('w-full text-left px-3 py-2', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                onClick={() => {
                  setMenuOpen(false)
                  emitSidePanelOpen({ tab: 'node', open: true })
                }}
                disabled={!active}
              >
                {UI_LABELS.openInSidepane}
              </button>
            </li>
            <li>
              <button
                type="button"
                className={cn('w-full text-left px-3 py-2', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                onClick={() => {
                  setMenuOpen(false)
                  onEnableHandlesForAllInputs()
                }}
                disabled={!active}
              >
                {UI_LABELS.enableHandlesForAllInputs}
              </button>
            </li>
            <li>
              <button
                type="button"
                className={cn('w-full text-left px-3 py-2', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                onClick={() => {
                  setMenuOpen(false)
                  onConvertToLoopNode()
                }}
                disabled={!active}
              >
                {UI_LABELS.convertToLoopNode}
              </button>
            </li>
          </menu>
        )}
      </header>

      {!minimized && (
        <NodeOverlayEditorForm
          active={active}
          node={node}
          hideFields={hideFields}
          labelInputRef={labelInputRef}
          onSetLabel={onSetLabel}
          onSetType={onSetType}
          onPatchProperties={onPatchProperties}
          onValidate={onValidate}
        />
      )}
    </FloatingPanel>
  )
})

const NodeOverlayEditor = React.memo(function NodeOverlayEditor({
  active,
  node,
  viewportW,
  viewportH,
  onSetLabel,
  onSetType,
  onPatchProperties,
  onValidate,
  onDuplicate,
  onRemove,
  onClearOutput,
  onHelp,
  onConvertToLoopNode,
  onEnableHandlesForAllInputs,
  onPinnedToNodeChange,
}: {
  active: boolean
  node: GraphNode
  viewportW: number
  viewportH: number
  onSetLabel: (label: string) => void
  onSetType: (type: string) => void
  onPatchProperties: (patch: Partial<FlowEditorSmartNodeProperties>) => void
  onValidate: () => void
  onDuplicate: () => void
  onRemove: () => void
  onClearOutput: () => void
  onHelp: () => void
  onConvertToLoopNode: () => void
  onEnableHandlesForAllInputs: () => void
  onPinnedToNodeChange?: (pinnedToNode: boolean) => void
}) {
  const { panelTextClass, microLabelClass } = usePanelTypography()
  const { uiIconScale, uiIconStrokeWidth, uiPanelOpacity, schema } = useGraphStore(
    useShallow(s => ({
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
      uiPanelOpacity: s.uiPanelOpacity,
      schema: s.schema,
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
  const iconSizeClass = getIconSizeClass(uiIconScale)

  const pinnedToNode = !pinned

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
    const anchoredLeftPx = screenX + 16
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
        uiPanelOpacity={uiPanelOpacity}
        panelTextClass={panelTextClass}
        microLabelClass={microLabelClass}
        iconSizeClass={iconSizeClass}
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
      />
    </aside>
  )
})

export default NodeOverlayEditor
