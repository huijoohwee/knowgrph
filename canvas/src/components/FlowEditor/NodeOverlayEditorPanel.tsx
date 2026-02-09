import React from 'react'

import IconButton from '@/components/IconButton'
import { FloatingPanel } from '@/components/ui/FloatingPanel'
import { NodeOverlayEditorForm } from '@/components/FlowEditor/NodeOverlayEditorForm'
import { NodeOverlayEditorPortHandles } from '@/components/FlowEditor/NodeOverlayEditorPortHandles'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { readSchemaFieldSpecs } from '@/lib/graph/flowPorts'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { getIconSizeClass, getPinToggleButtonClassName } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { NODE_QUICK_EDITOR_BASE_SIZE } from '@/components/FlowEditor/nodeQuickEditorZoom'
import { ChevronDown, ChevronUp, Pin, PinOff, CheckCircle, Minimize2, Maximize2 } from 'lucide-react'

export const NodeOverlayEditorPanel = React.memo(function NodeOverlayEditorPanel(args: {
  active: boolean
  node: GraphNode
  registryEntry: NodeQuickEditorRegistryEntry | null
  registryEntries: ReadonlyArray<NodeQuickEditorRegistryEntry>
  minimized: boolean
  hideFields: boolean
  pinned: boolean
  uiPanelOpacity: number | null | undefined
  panelTextClass: string
  microLabelClass: string
  uiIconScale: 'compact' | 'default' | undefined
  uiIconStrokeWidth: number
  labelInputRef: React.MutableRefObject<HTMLInputElement | null>
  onHeaderPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  onToggleHideFields: () => void
  onTogglePinned: () => void
  onToggleMinimized: () => void
  onSetLabel: (label: string) => void
  onSetType: (type: string) => void
  onPatchProperties: (patch: Record<string, unknown>) => void
  onSetProperties: (properties: Record<string, unknown>) => void
  onValidate: () => void
  onRegistrySelectionChange?: (args: { entry: NodeQuickEditorRegistryEntry | null }) => void
  onRenameSchemaFieldId?: (args: { prevId: string; nextId: string }) => void

  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath

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
    uiPanelOpacity,
    panelTextClass,
    microLabelClass,
    uiIconScale,
    uiIconStrokeWidth,
    labelInputRef,
    onHeaderPointerDown,
    onToggleHideFields,
    onTogglePinned,
    onToggleMinimized,
    onSetLabel,
    onSetType,
    onPatchProperties,
    onSetProperties,
    onValidate,
    onRegistrySelectionChange,
    onRenameSchemaFieldId,

    connectedValuesBySchemaPath,

    portHandleEdges,
    schema,
    toolMode,
    pendingEdgeSourceId,
    onBeginAddEdgeFromNode,
    onFinalizeAddEdgeToNode,
  } = args

  const iconSizeClass = getIconSizeClass(uiIconScale)

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
      data-kg-node-quick-editor={String(node.id || '')}
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
    >
      {!hasSchemaFields && (
        <NodeOverlayEditorPortHandles
          active={active}
          node={node}
          schema={schema}
          registryEntries={registryEntries}
          edges={portHandleEdges}
          minimized={minimized}
          toolMode={toolMode}
          pendingEdgeSourceId={pendingEdgeSourceId}
          onBeginAddEdgeFromNode={onBeginAddEdgeFromNode}
          onFinalizeAddEdgeToNode={onFinalizeAddEdgeToNode}
        />
      )}

      <header
        className={cn(
          'border-b',
          UI_THEME_TOKENS.panel.border,
          pinned ? 'select-none' : 'cursor-move select-none',
          minimized ? 'px-2 py-0 h-[36px]' : 'px-3 py-2',
        )}
        onPointerDown={onHeaderPointerDown}
      >
        <section
          className={cn('flex items-center justify-between gap-2', minimized ? 'h-full' : '')}
          aria-label="Node editor header"
        >
          <section className="min-w-0" aria-label="Node title">
            <h3
              className={cn(
                'font-semibold truncate',
                UI_THEME_TOKENS.text.primary,
                minimized ? microLabelClass : '',
              )}
            >
              {String(node.label || node.id)}
            </h3>
          </section>

          {active && (
            <nav className="flex items-center gap-1" aria-label={UI_LABELS.flowNodeQuickEditor}>
              <IconButton
                title={UI_LABELS.flowNodeQuickEditorValidate}
                tooltipContent={UI_LABELS.flowNodeQuickEditorValidate}
                showTooltip
                onClick={onValidate}
                className="App-toolbar__btn"
              >
                <CheckCircle className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
              </IconButton>

              <IconButton
                title={hideFields ? UI_LABELS.showFields : UI_LABELS.hideFields}
                tooltipContent={hideFields ? UI_COPY.flowNodeQuickEditorShowFields : UI_COPY.flowNodeQuickEditorHideFields}
                showTooltip
                onClick={onToggleHideFields}
                className={cn('App-toolbar__btn', hideFields ? UI_THEME_TOKENS.icon.active : '')}
              >
                {hideFields ? (
                  <ChevronDown className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
                ) : (
                  <ChevronUp className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
                )}
              </IconButton>

              <IconButton
                title={minimized ? UI_LABELS.restorePanel : UI_LABELS.minimizePanel}
                tooltipContent={minimized ? UI_COPY.flowNodeQuickEditorRestore : UI_COPY.flowNodeQuickEditorMinimize}
                showTooltip
                onClick={onToggleMinimized}
                className="App-toolbar__btn"
              >
                {minimized ? (
                  <Maximize2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
                ) : (
                  <Minimize2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
                )}
              </IconButton>

              <IconButton
                title={pinned ? UI_LABELS.unpinPanel : UI_LABELS.pinPanel}
                tooltipContent={pinned ? UI_COPY.flowNodeQuickEditorUnpin : UI_COPY.flowNodeQuickEditorPin}
                showTooltip
                onClick={onTogglePinned}
                className={getPinToggleButtonClassName(pinned)}
              >
                {pinned ? (
                  <Pin className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
                ) : (
                  <PinOff className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
                )}
              </IconButton>
            </nav>
          )}
        </section>
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
          onRenameSchemaFieldId={onRenameSchemaFieldId}
          onRegistrySelectionChange={onRegistrySelectionChange}
          connectedValuesBySchemaPath={connectedValuesBySchemaPath}

          registryEntry={registryEntry}
          registryEntries={registryEntries}
        />
      )}
    </FloatingPanel>
  )
})
