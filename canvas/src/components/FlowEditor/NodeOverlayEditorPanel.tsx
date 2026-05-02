import React from 'react'

import IconButton from '@/components/IconButton'
import RichMediaPanel from '@/components/RichMediaPanel'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
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
import { emitFlowEditorInteractionFrame } from '@/lib/canvas/flow-editor-overlay-proxy'
import { NodeOverlayEditorPortHandles } from '@/components/FlowEditor/NodeOverlayEditorPortHandles'
import { resolveWidgetNodeTitle } from '@/components/FlowEditor/nodeOverlayEditorTitle'
import {
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
} from '@/lib/config.flow-editor'
import {
  buildRichMediaPanelOverlayState,
  buildRichMediaPanelPreviewSpec,
  commitRichMediaPanelChange,
  coerceRichMediaPanelSizePx,
  getRichMediaPanelNodeLabel,
} from '@/lib/render/richMediaSsot'

const RICH_MEDIA_PANEL_MIN_WIDTH = 220
const RICH_MEDIA_PANEL_MIN_HEIGHT = 160

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
  richMediaViewToggle?: {
    visible: boolean
    isKtvRows: boolean
    onToggle: () => void
  }
  richMediaMediaSelector?: {
    visible: boolean
    selectedMode: 'auto' | 'text' | 'image' | 'video' | 'poi'
    onSelect: (next: 'auto' | 'text' | 'image' | 'video' | 'poi') => void
  }
  richMediaAspectToggle?: {
    visible: boolean
    selected: '16:9' | '9:16' | null
    onToggle: () => void
  }

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
    richMediaViewToggle,
    richMediaMediaSelector,
    richMediaAspectToggle,

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
  const richMediaPanelStoredWidth =
    typeof node.properties?.['visual:width'] === 'number' && Number.isFinite(node.properties['visual:width'])
      ? Math.max(RICH_MEDIA_PANEL_MIN_WIDTH, Math.round(node.properties['visual:width'] as number))
      : 280
  const richMediaPanelStoredHeight =
    typeof node.properties?.['visual:height'] === 'number' && Number.isFinite(node.properties['visual:height'])
      ? Math.max(RICH_MEDIA_PANEL_MIN_HEIGHT, Math.round(node.properties['visual:height'] as number))
      : 180
  const richMediaPanelBaseSize = React.useMemo(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : null
    const vh = typeof window !== 'undefined' ? window.innerHeight : null
    const coerced = coerceRichMediaPanelSizePx({
      width: richMediaPanelStoredWidth,
      height: richMediaPanelStoredHeight,
      viewportW: vw,
      viewportH: vh,
      minWidthPx: RICH_MEDIA_PANEL_MIN_WIDTH,
      minHeightPx: RICH_MEDIA_PANEL_MIN_HEIGHT,
    })
    return { width: coerced.width, height: coerced.height }
  }, [richMediaPanelStoredHeight, richMediaPanelStoredWidth])
  const [richMediaPanelViewSize, setRichMediaPanelViewSize] = React.useState(richMediaPanelBaseSize)
  const richMediaPanelResizeStartRef = React.useRef(richMediaPanelBaseSize)

  React.useEffect(() => {
    if (!showRichMediaPanelBody) return
    setRichMediaPanelViewSize(prev => (
      prev.width === richMediaPanelBaseSize.width && prev.height === richMediaPanelBaseSize.height
        ? prev
        : richMediaPanelBaseSize
    ))
  }, [richMediaPanelBaseSize, showRichMediaPanelBody])

  const richMediaPanelState = React.useMemo(() => {
    if (!showRichMediaPanelBody) return null
    return buildRichMediaPanelOverlayState({
      node,
      connectedValuesBySchemaPath,
    })
  }, [connectedValuesBySchemaPath, node, showRichMediaPanelBody])

  const richMediaPreview = React.useMemo(() => {
    if (!showRichMediaPanelBody) return null
    return buildRichMediaPanelPreviewSpec({
      node,
      connectedValuesBySchemaPath,
      panel: richMediaPanelState,
    })
  }, [connectedValuesBySchemaPath, node, richMediaPanelState, showRichMediaPanelBody])

  const handleRichMediaPanelChange = React.useCallback((next: {
    activeTab: 'auto' | 'text' | 'image' | 'video' | 'poi'
    freezeConnectedOutput: boolean
    text?: string
  }) => {
    if (!isRichMediaPanelWidget) return
    const nodeId = String(node.id || '').trim()
    if (!nodeId) return
    commitRichMediaPanelChange({
      nodeId,
      next,
      updateNode: (_id, patch) => {
        onPatchProperties(patch.properties)
      },
    })
  }, [isRichMediaPanelWidget, node.id, onPatchProperties])

  const handleRichMediaResizeStart = React.useCallback(() => {
    richMediaPanelResizeStartRef.current = richMediaPanelViewSize
  }, [richMediaPanelViewSize])

  const handleRichMediaResize = React.useCallback((args: { dx: number; dy: number }) => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : null
    const vh = typeof window !== 'undefined' ? window.innerHeight : null
    const coerced = coerceRichMediaPanelSizePx({
      width: Math.round(richMediaPanelResizeStartRef.current.width + args.dx),
      height: Math.round(richMediaPanelResizeStartRef.current.height + args.dy),
      viewportW: vw,
      viewportH: vh,
      minWidthPx: RICH_MEDIA_PANEL_MIN_WIDTH,
      minHeightPx: RICH_MEDIA_PANEL_MIN_HEIGHT,
    })
    setRichMediaPanelViewSize({ width: coerced.width, height: coerced.height })
  }, [])

  const handleRichMediaResizeEnd = React.useCallback(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : null
    const vh = typeof window !== 'undefined' ? window.innerHeight : null
    const coerced = coerceRichMediaPanelSizePx({
      width: richMediaPanelViewSize.width,
      height: richMediaPanelViewSize.height,
      viewportW: vw,
      viewportH: vh,
      minWidthPx: RICH_MEDIA_PANEL_MIN_WIDTH,
      minHeightPx: RICH_MEDIA_PANEL_MIN_HEIGHT,
    })
    onPatchProperties({
      'visual:width': coerced.width,
      'visual:height': coerced.height,
    })
  }, [onPatchProperties, richMediaPanelViewSize.height, richMediaPanelViewSize.width])

  const handleRichMediaResizePointerDown = React.useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!active || e.button !== 0) return
    const native = e.nativeEvent
    handleRichMediaResizeStart()
    try {
      e.preventDefault()
      e.stopPropagation()
    } catch {
      void 0
    }
    startPointerDrag({
      ev: native,
      cursor: 'nwse-resize',
      onMove: ev => {
        handleRichMediaResize({
          dx: ev.clientX - native.clientX,
          dy: ev.clientY - native.clientY,
        })
      },
      onEnd: handleRichMediaResizeEnd,
      onCancel: handleRichMediaResizeEnd,
    })
  }, [active, handleRichMediaResize, handleRichMediaResizeEnd, handleRichMediaResizeStart])

  return (
    <FloatingPanel
      as="section"
      ariaLabel={UI_LABELS.flowWidget}
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
          emitFlowEditorInteractionFrame()
        } catch {
          void 0
        }
      }}
      onScrollCapture={() => {
        try {
          emitFlowEditorInteractionFrame()
        } catch {
          void 0
        }
      }}
      style={{
        opacity: Number.isFinite(uiPanelOpacity) ? uiPanelOpacity : 1,
        height: minimized ? undefined : (showRichMediaPanelBody ? undefined : WIDGET_BASE_SIZE.height),
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

              {!isRichMediaPanelWidget ? (
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
              ) : null}

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

      {showRichMediaPanelBody ? (
        <section
          data-kg-widget-body="1"
          data-kg-rich-media-render-surface="1"
          className="relative min-h-0 overflow-hidden"
          style={{
            width: `${richMediaPanelViewSize.width}px`,
            maxWidth: '100%',
            height: `${richMediaPanelViewSize.height}px`,
          }}
        >
          {/* Shared RichMediaPanel body owns the canonical resize handle: data-kg-resize-handle="se". */}
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
            richMediaViewToggle={richMediaViewToggle}
            richMediaMediaSelector={richMediaMediaSelector}
            richMediaAspectToggle={richMediaAspectToggle}
            onPanelChange={handleRichMediaPanelChange}
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
