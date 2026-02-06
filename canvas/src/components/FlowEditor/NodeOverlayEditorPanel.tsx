import React from 'react'

import IconButton from '@/components/IconButton'
import { FloatingPanel } from '@/components/ui/FloatingPanel'
import { NodeOverlayEditorForm } from '@/components/FlowEditor/NodeOverlayEditorForm'
import { NodeOverlayEditorPortHandles } from '@/components/FlowEditor/NodeOverlayEditorPortHandles'
import { emitSidePanelOpen } from '@/features/canvas/utils'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { readSchemaFieldSpecs } from '@/lib/graph/flowPorts'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { getIconSizeClass } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { NODE_QUICK_EDITOR_BASE_SIZE } from '@/components/FlowEditor/nodeQuickEditorZoom'
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
  Share2,
  Trash2,
} from 'lucide-react'

export const NodeOverlayEditorPanel = React.memo(function NodeOverlayEditorPanel(args: {
  active: boolean
  node: GraphNode
  registryEntry: NodeQuickEditorRegistryEntry | null
  registryEntries: ReadonlyArray<NodeQuickEditorRegistryEntry>
  minimized: boolean
  hideFields: boolean
  pinned: boolean
  portHandlesEnabled: boolean
  portHandlesDisabled: boolean
  enableHandlesDisabled: boolean
  convertToLoopDisabled: boolean
  uiPanelOpacity: number | null | undefined
  panelTextClass: string
  microLabelClass: string
  uiIconScale: 'compact' | 'default' | undefined
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
  onTogglePortHandles: () => void
  onDuplicate: () => void
  onRemove: () => void
  onClearOutput: () => void
  onHelp: () => void
  onConvertToLoopNode: () => void
  onEnableHandlesForAllInputs: () => void
  onSetLabel: (label: string) => void
  onSetType: (type: string) => void
  onPatchProperties: (patch: Record<string, unknown>) => void
  onSetProperties: (properties: Record<string, unknown>) => void
  onValidate: () => void
  onRegistrySelectionChange?: (args: { entry: NodeQuickEditorRegistryEntry | null }) => void

  portHandleEdges: ReadonlyArray<GraphEdge>
  schema: GraphSchema | null
  toolMode?: 'select' | 'addEdge'
  pendingEdgeSourceId?: string | null
  onBeginAddEdgeFromNode?: (nodeId: string, portKey?: string | null) => void
  onFinalizeAddEdgeToNode?: (nodeId: string, portKey?: string | null) => void
}) {
  const {
    active,
    node,
    registryEntry,
    registryEntries,
    minimized,
    hideFields,
    pinned,
    portHandlesEnabled,
    portHandlesDisabled,
    enableHandlesDisabled,
    convertToLoopDisabled,
    uiPanelOpacity,
    panelTextClass,
    microLabelClass,
    uiIconScale,
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
    onTogglePortHandles,
    onDuplicate,
    onRemove,
    onClearOutput,
    onHelp,
    onConvertToLoopNode,
    onEnableHandlesForAllInputs,
    onSetLabel,
    onSetType,
    onPatchProperties,
    onSetProperties,
    onValidate,
    onRegistrySelectionChange,

    portHandleEdges,
    schema,
    toolMode,
    pendingEdgeSourceId,
    onBeginAddEdgeFromNode,
    onFinalizeAddEdgeToNode,
  } = args

  const iconSizeClass = getIconSizeClass(uiIconScale)
  const menuId = `flow-node-quick-menu-${String(node.id || 'node').replace(/[^a-zA-Z0-9_-]/g, '_')}`

  const hasSchemaFields = React.useMemo(() => readSchemaFieldSpecs(node).length > 0, [node])
  const handleSchemaPortHandleClick = React.useCallback(
    (evt: { dir: 'in' | 'out'; portKey: string }) => {
      if (!active) return
      const nodeId = String(node.id || '').trim()
      if (!nodeId) return
      const portKey = String(evt.portKey || '').trim()
      if (!portKey) return

      if (evt.dir === 'out') {
        onBeginAddEdgeFromNode?.(nodeId, portKey)
        return
      }

      if (!pendingEdgeSourceId) return
      if (pendingEdgeSourceId === nodeId) return
      onFinalizeAddEdgeToNode?.(nodeId, portKey)
    },
    [active, node.id, onBeginAddEdgeFromNode, onFinalizeAddEdgeToNode, pendingEdgeSourceId],
  )

  return (
    <FloatingPanel
      as="section"
      ariaLabel={UI_LABELS.flowNodeQuickEditor}
      className={cn(
        'rounded-xl border shadow-lg flex flex-col relative',
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
      onKeyDownCapture={e => {
        if (!menuOpen) return
        if (e.key !== 'Escape') return
        e.preventDefault()
        e.stopPropagation()
        setMenuOpen(false)
        const btn = moreButtonRef.current
        if (btn) btn.focus()
      }}
    >
      {!hasSchemaFields && (
        <NodeOverlayEditorPortHandles
          active={active}
          nodeId={String(node.id || '')}
          schema={schema}
          edges={portHandleEdges}
          minimized={minimized}
          toolMode={toolMode}
          pendingEdgeSourceId={pendingEdgeSourceId}
          onBeginAddEdgeFromNode={onBeginAddEdgeFromNode}
          onFinalizeAddEdgeToNode={onFinalizeAddEdgeToNode}
        />
      )}

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
              title={UI_LABELS.portHandles}
              tooltipContent={UI_COPY.portHandlesTooltip}
              showTooltip
              onClick={onTogglePortHandles}
              className={cn(
                'App-toolbar__btn',
                portHandlesEnabled ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : '',
              )}
              disabled={!active || portHandlesDisabled}
            >
              <Share2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
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
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
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
            id={menuId}
            className={cn(
              'mt-2 list-none overflow-hidden rounded-lg border p-0 shadow-xl',
              UI_THEME_TOKENS.panel.bg,
              UI_THEME_TOKENS.panel.border,
            )}
            aria-label={UI_LABELS.menu}
          >
            <li>
              <button
                type="button"
                className={cn('w-full text-left px-3 py-2', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                title={UI_COPY.flowNodeQuickEditorOpenInSidepane}
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
                title={UI_COPY.flowNodeQuickEditorEnableHandles}
                onClick={() => {
                  setMenuOpen(false)
                  onEnableHandlesForAllInputs()
                }}
                disabled={!active || enableHandlesDisabled}
              >
                {UI_LABELS.enableHandlesForAllInputs}
              </button>
            </li>
            <li>
              <button
                type="button"
                className={cn('w-full text-left px-3 py-2', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                title={UI_COPY.flowNodeQuickEditorConvertToLoop}
                onClick={() => {
                  setMenuOpen(false)
                  onConvertToLoopNode()
                }}
                disabled={!active || convertToLoopDisabled}
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
          schema={schema}
          hideFields={hideFields}
          labelInputRef={labelInputRef}
          onSetLabel={onSetLabel}
          onSetType={onSetType}
          onPatchProperties={onPatchProperties}
          onSetProperties={onSetProperties}
          onValidate={onValidate}
          onSchemaPortHandleClick={handleSchemaPortHandleClick}
          onRegistrySelectionChange={onRegistrySelectionChange}

          registryEntry={registryEntry}
          registryEntries={registryEntries}
        />
      )}
    </FloatingPanel>
  )
})
