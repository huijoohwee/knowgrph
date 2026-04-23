import React from 'react'

import IconButton from '@/components/IconButton'
import { FloatingPanel } from '@/components/ui/FloatingPanel'
import { NodeOverlayEditorForm } from '@/components/FlowEditor/NodeOverlayEditorForm'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { getIconSizeClass, getPinToggleButtonClassName } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { WIDGET_BASE_SIZE } from '@/components/FlowEditor/widgetZoom'
import { ChevronDown, ChevronUp, Pin, PinOff, CheckCircle, Minimize2, Maximize2 } from 'lucide-react'
import { resolveBeatRefForNode, resolveBeatClipOverlayIdsForNode } from '@/components/FlowEditor/beatByBeat'
import { FLOW_EDITOR_INTERACTION_FRAME_EVENT } from '@/lib/canvas/flow-editor-overlay-proxy'
import { NodeOverlayEditorPortHandles } from '@/components/FlowEditor/NodeOverlayEditorPortHandles'
import { parseMarkdownSigil } from '@/features/markdown/ui/markdownSigil'
import {
  FLOW_IMAGE_GENERATION_NODE_LABEL,
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_LABEL,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_LABEL,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
  getFlowEditorSmartWidgetLabel,
} from '@/lib/config.flow-editor'
import { getTextGenerationWidgetLabel } from '@/features/flow-editor-manager/registryTemplates'
import {
  FLOW_WIDGET_FORM_ID_KEY,
  FLOW_WIDGET_TYPE_ID_KEY,
} from '@/features/flow-editor-manager/resolveWidgetRegistry'

const normalizeWidgetLabelText = (raw: unknown): string => {
  const source = String(raw || '').trim()
  if (!source) return ''
  const sigil = parseMarkdownSigil(source)
  if (sigil && String(sigil.text || '').trim()) return String(sigil.text || '').trim()
  const unwrapped = source.startsWith('`') && source.endsWith('`') ? source.slice(1, -1).trim() : source
  return unwrapped
}

const readNodeData = (node: GraphNode): Record<string, unknown> => {
  const properties = (node.properties || null) as Record<string, unknown> | null
  const raw = properties && typeof properties.data === 'object' && properties.data !== null && !Array.isArray(properties.data)
    ? (properties.data as Record<string, unknown>)
    : null
  return raw || {}
}

function resolveSpecificWidgetTitle(args: {
  node: GraphNode
  registryEntry?: WidgetRegistryEntry | null
}): string | null {
  const properties = (args.node.properties || {}) as Record<string, unknown>
  const registryEntry = args.registryEntry || null
  const nodeTypeId = String(registryEntry?.nodeTypeId || args.node.type || '').trim()
  if (nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID) {
    return getTextGenerationWidgetLabel({
      provider: properties.chatProvider,
      widgetTypeId: registryEntry?.widgetTypeId || properties[FLOW_WIDGET_TYPE_ID_KEY],
      formId: registryEntry?.formId || properties[FLOW_WIDGET_FORM_ID_KEY],
    })
  }
  if (nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID) {
    return getFlowEditorSmartWidgetLabel({
      mode: 'image',
      model: properties.model,
    })
  }
  if (nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) {
    return getFlowEditorSmartWidgetLabel({
      mode: 'video',
      model: properties.model,
    })
  }
  if (nodeTypeId === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) {
    return FLOW_RICH_MEDIA_PANEL_NODE_LABEL
  }
  return null
}

export const resolveWidgetNodeTitle = (args: { node: GraphNode; graphMetaKind?: string | null; registryEntry?: WidgetRegistryEntry | null }): string => {
  const node = args.node
  const fallback = normalizeWidgetLabelText(node.label) || String(node.id || '').trim() || 'Node'
  const specificTitle = resolveSpecificWidgetTitle(args)
  const genericFallbacks = new Set([
    '',
    String(node.id || '').trim(),
    FLOW_TEXT_GENERATION_NODE_LABEL,
    FLOW_IMAGE_GENERATION_NODE_LABEL,
    FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
    FLOW_VIDEO_GENERATION_NODE_LABEL,
  ])
  if (String(args.graphMetaKind || '').trim() !== 'frontmatter-flow') {
    return specificTitle && genericFallbacks.has(fallback) ? specificTitle : fallback
  }
  const data = readNodeData(node)
  const type = String(node.type || '').trim().toLowerCase()
  if (type === 'input') {
    const dataLabel = String(data.label || '').trim().toUpperCase()
    if (dataLabel === 'R') return 'Red'
    if (dataLabel === 'G') return 'Green'
    if (dataLabel === 'B') return 'Blue'
    if (dataLabel) return dataLabel
    return fallback
  }
  if (type === 'default') {
    if (/colorpreview/i.test(fallback)) return 'RGB'
    if (/lightness/i.test(fallback)) return 'LightDark'
    return fallback
  }
  if (type === 'output') {
    const reads = String(data.reads || '').trim().toLowerCase()
    if (reads.includes('.light')) return 'Light'
    if (reads.includes('.dark')) return 'Dark'
    if (/\blight\b/i.test(fallback)) return 'Light'
    if (/\bdark\b/i.test(fallback)) return 'Dark'
    return fallback
  }
  return fallback
}

export const NodeOverlayEditorPanel = React.memo(function NodeOverlayEditorPanel(args: {
  active: boolean
  node: GraphNode
  graphMetaKind?: string | null
  registryEntry: WidgetRegistryEntry | null
  registryEntries: ReadonlyArray<WidgetRegistryEntry>
  minimized: boolean
  hideFields: boolean
  pinned: boolean
  showPinToggle?: boolean
  uiPanelOpacity: number | null | undefined
  panelTextClass: string
  microLabelClass: string
  monospaceTextClass: string
  uiIconScale: 'compact' | 'default' | undefined
  uiIconStrokeWidth: number
  labelInputRef: React.MutableRefObject<HTMLInputElement | null>
  onHeaderPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  onToggleHideFields: () => void
  onTogglePinned?: (event: React.MouseEvent) => void
  onPinnedPointerDown?: (event: React.PointerEvent) => void
  onToggleMinimized: () => void
  onSetLabel: (label: string) => void
  onSetType: (type: string) => void
  onPatchProperties: (patch: Record<string, unknown>) => void
  onSetProperties: (properties: Record<string, unknown>) => void
  onValidate: () => void
  onRegistrySelectionChange?: (args: { entry: WidgetRegistryEntry | null }) => void
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
    graphMetaKind,
    registryEntry,
    registryEntries,
    minimized,
    hideFields,
    pinned,
    showPinToggle = true,
    uiPanelOpacity,
    panelTextClass,
    microLabelClass,
    monospaceTextClass,
    uiIconScale,
    uiIconStrokeWidth,
    labelInputRef,
    onHeaderPointerDown,
    onToggleHideFields,
    onTogglePinned,
    onPinnedPointerDown,
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

  const beatByBeatTitle = React.useMemo(() => {
    const kind = String(graphMetaKind || '').trim()
    if (kind !== 'frontmatter-flow') return null
    const beatRef = resolveBeatRefForNode(node)
    if (!beatRef) return null
    const ids = resolveBeatClipOverlayIdsForNode(node)
    if (!ids) return null
    return (
      <>
        <span>{beatRef}</span>
        <span>{' · '}</span>
        <code className={cn(monospaceTextClass, UI_THEME_TOKENS.text.secondary)}>{`{{timeline.beats.${beatRef}.label}}`}</code>
        <span>{' · '}</span>
        <code className={cn(monospaceTextClass, UI_THEME_TOKENS.text.secondary)}>{ids.clipNodeId}</code>
        <span>{' → '}</span>
        <code className={cn(monospaceTextClass, UI_THEME_TOKENS.text.secondary)}>{ids.overlayNodeId}</code>
      </>
    )
  }, [graphMetaKind, monospaceTextClass, node.id, (node.properties as unknown as { params?: unknown } | null)?.params])
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

  const isFrontmatterFlow = React.useMemo(() => {
    return String(graphMetaKind || '').trim() === 'frontmatter-flow'
  }, [graphMetaKind])

  return (
    <FloatingPanel
      as="section"
      ariaLabel={UI_LABELS.flowWidget}
      data-kg-widget={String(node.id || '')}
      data-kg-widget-pinned={pinned ? '1' : '0'}
      className={cn(
        'rounded-xl border shadow-lg flex flex-col relative',
        UI_THEME_TOKENS.panel.bg,
        UI_THEME_TOKENS.input.border,
        UI_THEME_TOKENS.text.primary,
        panelTextClass,
      )}
      onWheelCapture={e => {
        try {
          if (e.ctrlKey === true || e.metaKey === true) {
            e.preventDefault()
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event(FLOW_EDITOR_INTERACTION_FRAME_EVENT))
          }
        } catch {
          void 0
        }
      }}
      onScrollCapture={() => {
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event(FLOW_EDITOR_INTERACTION_FRAME_EVENT))
          }
        } catch {
          void 0
        }
      }}
      style={{
        opacity: Number.isFinite(uiPanelOpacity) ? uiPanelOpacity : 1,
        height: minimized ? undefined : WIDGET_BASE_SIZE.height,
      }}
    >
      <header
        className={cn(
          'border-b',
          UI_THEME_TOKENS.panel.border,
          'cursor-move select-none',
          minimized ? 'px-2 py-0 h-[36px]' : 'px-3 py-2',
        )}
        data-kg-flow-node-drag-handle="true"
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
              {beatByBeatTitle || resolveWidgetNodeTitle({ node, graphMetaKind, registryEntry })}
            </h3>
          </section>

          <nav className="flex items-center gap-1" aria-label={UI_LABELS.flowWidget}>
              <IconButton
                title={UI_LABELS.flowWidgetValidate}
                tooltipContent={UI_LABELS.flowWidgetValidate}
                showTooltip
                disabled={!active}
                onClick={onValidate}
                className="App-toolbar__btn"
              >
                <CheckCircle className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
              </IconButton>

              <IconButton
                title={hideFields ? UI_LABELS.showFields : UI_LABELS.hideFields}
                tooltipContent={hideFields ? UI_COPY.flowWidgetShowFields : UI_COPY.flowWidgetHideFields}
                showTooltip
                disabled={!active}
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
                tooltipContent={minimized ? UI_COPY.flowWidgetRestore : UI_COPY.flowWidgetMinimize}
                showTooltip
                disabled={!active}
                onClick={onToggleMinimized}
                className="App-toolbar__btn"
              >
                {minimized ? (
                  <Maximize2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
                ) : (
                  <Minimize2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
                )}
              </IconButton>

              {showPinToggle && (
                <IconButton
                  title={pinned ? UI_LABELS.unpinPanel : UI_LABELS.pinPanel}
                  tooltipContent={pinned ? UI_COPY.flowWidgetUnpin : UI_COPY.flowWidgetPin}
                  showTooltip
                  disabled={!active}
                  onPointerDown={onPinnedPointerDown}
                  onClick={onTogglePinned}
                  className={getPinToggleButtonClassName(pinned)}
                >
                  {pinned ? (
                    <Pin className={cn(iconSizeClass, UI_THEME_TOKENS.icon.active)} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
                  ) : (
                    <PinOff className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
                  )}
                </IconButton>
              )}
          </nav>
        </section>
      </header>

      {!minimized && (
        <NodeOverlayEditorForm
          active={active}
          node={node}
          graphMetaKind={graphMetaKind}
          edges={portHandleEdges}
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

      <NodeOverlayEditorPortHandles
        active={active}
        node={{ id: node.id, type: node.type, properties: node.properties }}
        schema={schema}
        registryEntries={registryEntries}
        edges={portHandleEdges}
        minimized={minimized}
        forceEnabled={isFrontmatterFlow}
        strictHandleSet={isFrontmatterFlow}
        toolMode={toolMode}
        pendingEdgeSourceId={pendingEdgeSourceId}
        onBeginAddEdgeFromNode={onBeginAddEdgeFromNode}
        onFinalizeAddEdgeToNode={onFinalizeAddEdgeToNode}
      />
    </FloatingPanel>
  )
})
