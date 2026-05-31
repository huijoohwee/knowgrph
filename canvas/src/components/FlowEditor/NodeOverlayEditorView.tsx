import React from 'react'

import { NodeOverlayEditorActionsToolbar, type NodeOverlayEditorActionsToolbarProps } from '@/components/FlowEditor/NodeOverlayEditorActionsToolbar'
import { NodeOverlayEditorPanel } from '@/components/FlowEditor/NodeOverlayEditorPanel'
import { FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID } from '@/lib/config.flow-editor'
import { UI_LABELS } from '@/lib/config'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import { lockGlobalUserSelect, unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { subscribeGlobalCancelEvents } from '@/lib/browser/globalCancelEvents'
import { getIconSizeClass } from '@/lib/ui'
import type { UiIconScale } from '@/lib/ui'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'

import {
  WIDGET_ACTIONS_TOOLBAR_OFFSET_PX,
  WIDGET_ACTIONS_TOOLBAR_SIDE_OFFSET_PX,
} from '@/components/FlowEditor/nodeOverlayEditorShared'

type RichMediaPanelToolbarProps = Pick<
  NodeOverlayEditorActionsToolbarProps,
  'richMediaViewToggle' | 'richMediaMediaSelector' | 'richMediaAspectToggle' | 'richMediaTextModeToggle' | 'openExternalAction'
>

export function NodeOverlayEditorView(args: {
  asideRef: React.RefObject<HTMLElement | null>
  flowEditorSurfaceId?: string
  node: GraphNode
  interactionPassthrough: boolean
  pinnedInCanvas: boolean
  overlayZIndex: number
  active: boolean
  toolbarVisible: boolean
  toolbarDock: 'above' | 'below'
  toolbarSideClamp: boolean
  isRichMediaPanelWidget: boolean
  isVideoTranscriberWidget: boolean
  uiIconScale: UiIconScale | undefined
  uiIconStrokeWidth: number
  enableHandlesDisabled: boolean
  convertToLoopDisabled: boolean
  richMediaPanelToolbarProps: Partial<RichMediaPanelToolbarProps>
  onRun: () => void
  onDuplicate: () => void
  onClearOutput: () => void
  onHelp: () => void
  onRemove: () => void
  onEnableHandlesForAllInputs: () => void
  onConvertToLoopNode: () => void
  onUpdateKvEntry?: () => void
  onPatchProperties: (patch: Record<string, unknown>) => void
  uiPanelOpacity: number
  panelTextClass: string
  microLabelClass: string
  monospaceTextClass: string
  labelInputRef: React.RefObject<HTMLInputElement | null>
  onHeaderPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  onToggleHideFields: () => void
  onTogglePinned: (event: React.MouseEvent) => void
  onPinnedPointerDown: (event: React.PointerEvent) => void
  onToggleMinimized: () => void
  onSetLabel: (label: string) => void
  onSetType: (type: string) => void
  onSetProperties: (properties: Record<string, unknown>) => void
  onValidate: () => void
  onRegistrySelectionChange: ({ entry }: { entry: WidgetRegistryEntry | null }) => void
  onRenameSchemaFieldId?: (args: { prevId: string; nextId: string }) => void
  richMediaWidgetPreview: unknown
  registryEntry: WidgetRegistryEntry | null
  registryEntries: ReadonlyArray<WidgetRegistryEntry>
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
  portHandleEdges?: ReadonlyArray<GraphEdge>
  schema: unknown
  graphMetaKind?: string | null
  minimized: boolean
  hideFields: boolean
  toolMode?: 'select' | 'addEdge'
  pendingEdgeSourceId?: string | null
  onBeginAddEdgeFromNode?: (nodeId: string, portKey?: string | null) => void
  onFinalizeAddEdgeToNode?: (nodeId: string, portKey?: string | null) => void
  setSelectionSource: (source: 'canvas' | 'editor' | 'none') => void
  selectNode: (nodeId: string) => void
  setToolbarVisible: React.Dispatch<React.SetStateAction<boolean>>
  spacePanUserSelectUnlockRef: React.MutableRefObject<null | (() => void)>
}) {
  const {
    asideRef,
    flowEditorSurfaceId,
    node,
    interactionPassthrough,
    pinnedInCanvas,
    overlayZIndex,
    active,
    toolbarVisible,
    toolbarDock,
    toolbarSideClamp,
    isRichMediaPanelWidget,
    isVideoTranscriberWidget,
    uiIconScale,
    uiIconStrokeWidth,
    enableHandlesDisabled,
    convertToLoopDisabled,
    richMediaPanelToolbarProps,
    onRun,
    onDuplicate,
    onClearOutput,
    onHelp,
    onRemove,
    onEnableHandlesForAllInputs,
    onConvertToLoopNode,
    onUpdateKvEntry,
    onPatchProperties,
    uiPanelOpacity,
    panelTextClass,
    microLabelClass,
    monospaceTextClass,
    labelInputRef,
    onHeaderPointerDown,
    onToggleHideFields,
    onTogglePinned,
    onPinnedPointerDown,
    onToggleMinimized,
    onSetLabel,
    onSetType,
    onSetProperties,
    onValidate,
    onRegistrySelectionChange,
    onRenameSchemaFieldId,
    richMediaWidgetPreview,
    registryEntry,
    registryEntries,
    connectedValuesBySchemaPath,
    portHandleEdges,
    schema,
    graphMetaKind,
    minimized,
    hideFields,
    toolMode,
    pendingEdgeSourceId,
    onBeginAddEdgeFromNode,
    onFinalizeAddEdgeToNode,
    setSelectionSource,
    selectNode,
    setToolbarVisible,
    spacePanUserSelectUnlockRef,
  } = args
  const passthroughPointerEventsClass = interactionPassthrough ? 'pointer-events-none' : 'pointer-events-auto'
  return (
    <aside
      ref={asideRef}
      aria-label={UI_LABELS.flowWidget}
      data-kg-widget={String(node.id || '')}
      data-kg-flow-editor-mode="1"
      data-kg-flow-editor-surface={flowEditorSurfaceId || undefined}
      data-kg-widget-pinned={pinnedInCanvas ? '1' : '0'}
      data-kg-canvas-wheel-ignore={interactionPassthrough ? 'false' : 'true'}
      className={interactionPassthrough ? 'fixed pointer-events-none' : 'fixed'}
      style={{ zIndex: overlayZIndex }}
      onPointerDownCapture={(ev) => {
        if (interactionPassthrough) return
        const t = ev.target
        const el = t instanceof Element ? t : null
        const isInteractiveControl = !!el?.closest('input,textarea,select,button,[contenteditable="true"]')
        if (active && ev.button === 0 && pinnedInCanvas && ev.altKey !== true && isSpacePanHeld() !== true) {
          if (el?.closest('[data-kg-flow-node-drag-handle="true"]')) return
        }
        if (active && ev.button === 0 && isSpacePanHeld()) {
          if (!isInteractiveControl) {
            if (!spacePanUserSelectUnlockRef.current) {
              lockGlobalUserSelect()
              let unsubscribeGlobalUnlock = () => void 0
              const unlock = () => {
                if (!spacePanUserSelectUnlockRef.current) return
                spacePanUserSelectUnlockRef.current = null
                unlockGlobalUserSelect()
                try {
                  unsubscribeGlobalUnlock()
                } catch {
                  void 0
                }
              }
              try {
                unsubscribeGlobalUnlock = subscribeGlobalCancelEvents({
                  listener: unlock,
                  capture: true,
                  visibilityBehavior: 'any',
                })
                spacePanUserSelectUnlockRef.current = unlock
              } catch {
                unlock()
              }
            }
          }
        }
        if (active && ev.button === 0 && isInteractiveControl) return
        const id = String(node.id || '').trim()
        if (!id) return
        setSelectionSource('editor')
        selectNode(id)
        setToolbarVisible(true)
      }}
    >
      <div className="relative">
        <div
          className={
            isRichMediaPanelWidget
              ? `absolute z-10 ${passthroughPointerEventsClass}`
              : `absolute left-1/2 z-10 -translate-x-1/2 ${passthroughPointerEventsClass}`
          }
          style={isRichMediaPanelWidget
            ? {
                top: '50%',
                left: toolbarSideClamp ? undefined : '100%',
                right: toolbarSideClamp ? `${WIDGET_ACTIONS_TOOLBAR_SIDE_OFFSET_PX}px` : undefined,
                marginLeft: toolbarSideClamp ? undefined : `${WIDGET_ACTIONS_TOOLBAR_SIDE_OFFSET_PX}px`,
                transform: 'translateY(-50%)',
              }
            : { top: toolbarDock === 'above' ? -WIDGET_ACTIONS_TOOLBAR_OFFSET_PX : 8 }}
        >
          <NodeOverlayEditorActionsToolbar
            visible={toolbarVisible}
            iconSizeClass={getIconSizeClass(uiIconScale)}
            iconStrokeWidth={uiIconStrokeWidth}
            active={active}
            enableHandlesDisabled={enableHandlesDisabled}
            convertToLoopDisabled={convertToLoopDisabled}
            duplicateDisabled={pinnedInCanvas}
            richMediaViewToggle={isRichMediaPanelWidget ? richMediaPanelToolbarProps.richMediaViewToggle : undefined}
            richMediaMediaSelector={isRichMediaPanelWidget ? richMediaPanelToolbarProps.richMediaMediaSelector : undefined}
            richMediaAspectToggle={isRichMediaPanelWidget ? richMediaPanelToolbarProps.richMediaAspectToggle : undefined}
            richMediaTextModeToggle={isRichMediaPanelWidget ? richMediaPanelToolbarProps.richMediaTextModeToggle : undefined}
            openExternalAction={isRichMediaPanelWidget ? richMediaPanelToolbarProps.openExternalAction : undefined}
            importUrlAction={isVideoTranscriberWidget ? {
              visible: true,
              initialUrl: typeof (node.properties || {}).sourceUrl === 'string' ? String((node.properties || {}).sourceUrl || '').trim() : '',
              onConfirm: (url) => {
                onPatchProperties({ sourceUrl: url })
              },
            } : undefined}
            onRun={onRun}
            onDuplicate={onDuplicate}
            onClearOutput={onClearOutput}
            onHelp={onHelp}
            onRemove={onRemove}
            onEnableHandlesForAllInputs={onEnableHandlesForAllInputs}
            onConvertToLoopNode={onConvertToLoopNode}
            onUpdateKvEntry={onUpdateKvEntry}
          />
        </div>

        <div className={passthroughPointerEventsClass}>
          <NodeOverlayEditorPanel
            active={active}
            node={node}
            graphMetaKind={graphMetaKind}
            minimized={minimized}
            hideFields={hideFields}
            pinned={pinnedInCanvas}
            uiPanelOpacity={uiPanelOpacity}
            panelTextClass={panelTextClass}
            microLabelClass={microLabelClass}
            monospaceTextClass={monospaceTextClass}
            uiIconScale={uiIconScale}
            uiIconStrokeWidth={uiIconStrokeWidth}
            labelInputRef={labelInputRef}
            onHeaderPointerDown={onHeaderPointerDown}
            onToggleHideFields={onToggleHideFields}
            onTogglePinned={onTogglePinned}
            onPinnedPointerDown={onPinnedPointerDown}
            onToggleMinimized={onToggleMinimized}
            onSetLabel={onSetLabel}
            onSetType={onSetType}
            onPatchProperties={onPatchProperties}
            onSetProperties={onSetProperties}
            onValidate={onValidate}
            onRegistrySelectionChange={onRegistrySelectionChange}
            onRenameSchemaFieldId={onRenameSchemaFieldId}
            richMediaWidgetPreview={richMediaWidgetPreview as any}
            {...(richMediaPanelToolbarProps as any)}
            registryEntry={registryEntry}
            registryEntries={registryEntries}
            connectedValuesBySchemaPath={connectedValuesBySchemaPath}
            portHandleEdges={portHandleEdges}
            schema={schema}
            toolMode={toolMode}
            pendingEdgeSourceId={pendingEdgeSourceId}
            onBeginAddEdgeFromNode={onBeginAddEdgeFromNode}
            onFinalizeAddEdgeToNode={onFinalizeAddEdgeToNode}
          />
        </div>
      </div>
    </aside>
  )
}
