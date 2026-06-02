import React from 'react'

import RichMediaPanel, { beginRichMediaPanelResizeDrag, RichMediaPanelResizeHandle } from '@/components/RichMediaPanel'
import { FloatingPanel } from '@/components/ui/FloatingPanel'
import { NodeOverlayEditorForm } from '@/components/FlowEditor/NodeOverlayEditorForm'
import { FlowEditorPanelChromeHeader } from '@/components/FlowEditor/FlowEditorPanelChrome'
import { getFlowEditorPanelChromeClassName } from '@/components/FlowEditor/flowEditorPanelChromeClassName'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { UI_LABELS } from '@/lib/config'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { WIDGET_BASE_SIZE } from '@/lib/canvas/overlayWidgetZoom'
import {
  handleWidgetInnerPanelScrollCapture,
  handleWidgetInnerPanelWheelCapture,
  RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE,
} from '@/components/FlowEditor/nodeOverlayEditorShared'
import { resolveBeatRefForNode, resolveBeatClipOverlayIdsForNode } from '@/components/FlowEditor/beatByBeat'
import { emitFlowEditorInteractionFrame } from '@/lib/canvas/flow-editor-overlay-proxy'
import { NodeOverlayEditorPortHandles } from '@/components/FlowEditor/NodeOverlayEditorPortHandles'
import { resolveWidgetNodeTitle } from '@/components/FlowEditor/nodeOverlayEditorTitle'
import type { RichMediaWidgetPreviewState } from '@/components/FlowEditor/useRichMediaWidgetPreview'
import {
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
} from '@/lib/config.flow-editor'
import {
  getRichMediaPanelNodeLabel,
} from '@/lib/render/richMediaSsot'

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
  richMediaWidgetPreview?: RichMediaWidgetPreviewState

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
    richMediaWidgetPreview,

    portHandleEdges,
    schema,
    toolMode,
    pendingEdgeSourceId,
    onBeginAddEdgeFromNode,
    onFinalizeAddEdgeToNode,
  } = args

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
  }, [graphMetaKind, monospaceTextClass, node])
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
  const isRichMediaPanelWidget = String(node.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
  const showRichMediaPanelBody = isRichMediaPanelWidget && !hideFields && !minimized
  const richMediaPanelState = richMediaWidgetPreview?.richMediaPanelState || null
  const richMediaPreview = richMediaWidgetPreview?.richMediaPreview || null
  const richMediaPanelViewSize = richMediaWidgetPreview?.richMediaPanelViewSize || RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE
  const handleRichMediaResizeStart = richMediaWidgetPreview?.handleRichMediaResizeStart
  const handleRichMediaResize = richMediaWidgetPreview?.handleRichMediaResize
  const handleRichMediaResizeEnd = richMediaWidgetPreview?.handleRichMediaResizeEnd
  const handleRichMediaContentSize = richMediaWidgetPreview?.handleRichMediaContentSize
  const handleRichMediaPanelChange = richMediaWidgetPreview?.handleRichMediaPanelChange
  const hasRichMediaResizeHandlers = Boolean(handleRichMediaResizeStart || handleRichMediaResize || handleRichMediaResizeEnd)
  const handleRichMediaOuterResizePointerDown = React.useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!hasRichMediaResizeHandlers) return
    beginRichMediaPanelResizeDrag({
      event,
      onBeforeStart: () => {
        try {
          emitFlowEditorInteractionFrame()
        } catch {
          void 0
        }
      },
      onResizeStart: handleRichMediaResizeStart,
      onResize: handleRichMediaResize,
      onResizeEnd: handleRichMediaResizeEnd,
    })
  }, [handleRichMediaResize, handleRichMediaResizeEnd, handleRichMediaResizeStart, hasRichMediaResizeHandlers])

  return (
    <FloatingPanel
      as="section"
      ariaLabel={UI_LABELS.flowWidget}
      className={getFlowEditorPanelChromeClassName(panelTextClass)}
      onWheelCapture={e => handleWidgetInnerPanelWheelCapture(e, emitFlowEditorInteractionFrame)}
      onScrollCapture={() => handleWidgetInnerPanelScrollCapture(emitFlowEditorInteractionFrame)}
      style={{
        opacity: Number.isFinite(uiPanelOpacity) ? uiPanelOpacity : 1,
        height: minimized ? undefined : (showRichMediaPanelBody ? undefined : WIDGET_BASE_SIZE.height),
      }}
    >
      <FlowEditorPanelChromeHeader
        active={active}
        title={beatByBeatTitle || resolveWidgetNodeTitle({ node, graphMetaKind, registryEntry })}
        minimized={minimized}
        hideFields={hideFields}
        showFieldToggle={!isRichMediaPanelWidget}
        showPinToggle={showPinToggle}
        pinned={pinned}
        microLabelClass={microLabelClass}
        uiIconScale={uiIconScale}
        uiIconStrokeWidth={uiIconStrokeWidth}
        onHeaderPointerDown={onHeaderPointerDown}
        onValidate={onValidate}
        onToggleHideFields={onToggleHideFields}
        onToggleMinimized={onToggleMinimized}
        onTogglePinned={onTogglePinned}
        onPinnedPointerDown={onPinnedPointerDown}
      />

      {showRichMediaPanelBody ? (
        <section
          data-kg-widget-body="1"
          data-kg-rich-media-render-surface="1"
          data-kg-rich-media-scroll-owner="panel"
          data-kg-media-scroll-surface="1"
          className="relative min-h-0 overflow-y-auto overflow-x-hidden"
          style={{
            width: `${richMediaPanelViewSize.width}px`,
            maxWidth: '100%',
            height: `${richMediaPanelViewSize.height}px`,
            overscrollBehaviorX: 'none',
            overscrollBehaviorY: 'contain',
            pointerEvents: 'auto',
            scrollbarGutter: 'stable',
          }}
        >
          <RichMediaPanel
            overlayId={String(node.id || '')}
            title={String(node.label || getRichMediaPanelNodeLabel())}
            url={richMediaPreview?.url || ''}
            srcDoc={richMediaPreview?.kind === 'iframe' ? richMediaPreview.srcDoc : undefined}
            openUrl={richMediaPreview?.openUrl || richMediaPreview?.url || ''}
            kind={richMediaPreview?.kind || 'iframe'}
            interactive={richMediaPreview?.interactive !== false}
            resizable={true}
            onResizeStart={handleRichMediaResizeStart}
            onResize={handleRichMediaResize}
            onResizeEnd={handleRichMediaResizeEnd}
            panel={richMediaPanelState || undefined}
            widgetToolbarActive={false}
            onPanelChange={handleRichMediaPanelChange}
            frameMode="surface"
            resizeHandlePlacement="external"
            scrollOwner="panel"
            flowEditorInteractionMode={true}
            flowEditorFrontmatterDocumentMode={isFrontmatterFlow}
            onInlineContentSize={handleRichMediaContentSize}
            style={{ width: '100%', height: '100%', boxShadow: 'none' }}
          />
        </section>
      ) : !minimized && (
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
          richMediaWidgetPreview={richMediaWidgetPreview}

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

      {showRichMediaPanelBody && hasRichMediaResizeHandlers ? (
        <RichMediaPanelResizeHandle placement="panel" onPointerDown={handleRichMediaOuterResizePointerDown} />
      ) : null}
    </FloatingPanel>
  )
})
