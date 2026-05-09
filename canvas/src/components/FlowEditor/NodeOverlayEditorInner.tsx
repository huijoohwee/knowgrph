import React from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'

import { NodeOverlayEditorView } from '@/components/FlowEditor/NodeOverlayEditorView'
import { useNodeOverlayRichMediaToolbar } from '@/components/FlowEditor/useNodeOverlayRichMediaToolbar'
import { useNodeOverlayDragHandlers } from '@/components/FlowEditor/useNodeOverlayDragHandlers'
import { useNodeOverlayPlacementRuntime } from '@/components/FlowEditor/useNodeOverlayPlacementRuntime'
import {
  FLOW_EDITOR_NODE_OVERLAY_Z_INDEX_BASE,
  FLOW_EDITOR_NODE_OVERLAY_Z_INDEX_SELECTED,
  type NodeOverlayEditorProps,
} from '@/components/FlowEditor/nodeOverlayEditorShared'
import { useOutsideClose } from '@/hooks/useOutsideClose'
import { useGraphStore } from '@/hooks/useGraphStore'
import { resolveDefaultFlowWidgetPinnedInCanvas, shouldUseFlowEditorWidgetFloatingScreenAuthority } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { computeWidgetAnchoredStackOffset } from '@/components/FlowEditor/widgetLayout'
import { isHandlesForAllInputsEnabled, isLoopNode } from '@/lib/flowEditor/flowEditorActions'
import { lsBool, lsSetBool } from '@/lib/persistence'
import { LS_KEYS, UI_COPY } from '@/lib/config'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { resolveWidgetRegistryEntry } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { FLOW_EDITOR_INTERACTION_FRAME_EVENT } from '@/lib/canvas/flow-editor-overlay-proxy'

const EMPTY_WIDGET_REGISTRY: WidgetRegistryEntry[] = []

const NodeOverlayEditorInner = React.memo(function NodeOverlayEditorInner({
  active,
  flowEditorSurfaceId,
  interactionPassthrough = false,
  node,
  viewportW,
  viewportH,
  canvasWindowOffset,
  autoRevealKey,
  stackIndex,
  getLiveNodeWorldPos,
  getLiveZoomTransform,
  getLiveContainmentGroupAabbForNode,
  graphMetaKind,
  portHandleEdges = [],
  registryEntries = EMPTY_WIDGET_REGISTRY,
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
  onRun,
  onDuplicate,
  onRemove,
  onClearOutput,
  onHelp,
  onConvertToLoopNode,
  onEnableHandlesForAllInputs,
  onUpdateKvEntry,
  onPinnedInCanvasChange,
  onRenameSchemaFieldId,
}: NodeOverlayEditorProps) {
  const { panelTextClass, microLabelClass, monospaceTextClass } = usePanelTypography()
  const {
    uiIconScale,
    uiIconStrokeWidth,
    uiPanelOpacity,
    schema,
    documentStructureBaselineLock,
    openWidgetNodeCount,
    upsertUiToast,
    selectNode,
    setSelectionSource,
    selectedNodeId,
    setFlowWidgetWorldPosByNodeId,
    setFlowWidgetPinnedByNodeId,
  } = useGraphStore(
    useShallow(s => ({
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
      uiPanelOpacity: s.uiPanelOpacity,
      schema: s.schema,
      documentStructureBaselineLock: s.documentStructureBaselineLock === true,
      openWidgetNodeCount: Array.isArray(s.openWidgetNodeIds) ? s.openWidgetNodeIds.length : 0,
      upsertUiToast: s.upsertUiToast,
      selectNode: s.selectNode,
      setSelectionSource: s.setSelectionSource,
      selectedNodeId: s.selectedNodeId,
      setFlowWidgetWorldPosByNodeId: (s as unknown as { setFlowWidgetWorldPosByNodeId: (pos: Record<string, { x: number; y: number }>) => void }).setFlowWidgetWorldPosByNodeId,
      setFlowWidgetPinnedByNodeId: s.setFlowWidgetPinnedByNodeId,
    })),
  )

  const nodeId = React.useMemo(() => String(node.id || '').trim(), [node.id])
  const widgetPos = useGraphStore(useShallow(s => s.flowWidgetPosByNodeId?.[nodeId]))
  const registryEntry = React.useMemo(
    () => resolveWidgetRegistryEntry({ node, registry: registryEntries, graphMetaKind }),
    [graphMetaKind, node, registryEntries],
  )

  const overlayZIndex = React.useMemo(() => {
    const idx = Number.isFinite(stackIndex) ? Math.max(0, Math.floor(stackIndex as number)) : 0
    const selected = String(selectedNodeId || '').trim() === nodeId
    return selected ? FLOW_EDITOR_NODE_OVERLAY_Z_INDEX_SELECTED : FLOW_EDITOR_NODE_OVERLAY_Z_INDEX_BASE - idx
  }, [nodeId, selectedNodeId, stackIndex])

  const readPinnedInCanvas = React.useCallback((id: string): boolean => {
    if (!id) return false
    const map = useGraphStore.getState().flowWidgetPinnedByNodeId || {}
    const v = map[id]
    return typeof v === 'boolean' ? v : resolveDefaultFlowWidgetPinnedInCanvas({ graphMetaKind })
  }, [graphMetaKind])

  const [pinnedInCanvas, setPinnedInCanvasState] = React.useState<boolean>(() => readPinnedInCanvas(nodeId))
  const pinnedInCanvasRef = React.useRef<boolean>(readPinnedInCanvas(nodeId))
  const previousPinnedInCanvasRef = React.useRef<boolean>(pinnedInCanvas)
  const [minimized, setMinimized] = React.useState<boolean>(() => lsBool(LS_KEYS.flowWidgetMinimized, false))
  const [hideFields, setHideFields] = React.useState<boolean>(() => lsBool(LS_KEYS.flowWidgetHideFields, false))
  const [toolbarVisible, setToolbarVisible] = React.useState(false)
  const labelInputRef = React.useRef<HTMLInputElement | null>(null)
  const pinToggleCollisionGuardRef = React.useRef<number | null>(null)
  const skipPinClickRef = React.useRef(false)
  const spacePanUserSelectUnlockRef = React.useRef<null | (() => void)>(null)

  const floating = pinnedInCanvas !== true
  const floatingUsesScreenAuthority = shouldUseFlowEditorWidgetFloatingScreenAuthority({ graphMetaKind, pinnedInCanvas })
  const autoStackOffset = React.useMemo(() => computeWidgetAnchoredStackOffset(stackIndex), [stackIndex])

  const placement = useNodeOverlayPlacementRuntime({
    node,
    nodeId,
    stackIndex,
    active,
    viewportW,
    viewportH,
    canvasWindowOffset,
    graphMetaKind,
    zoomViewKey,
    getLiveNodeWorldPos,
    getLiveZoomTransform,
    getLiveContainmentGroupAabbForNode,
    widgetPos,
    schema,
    openWidgetNodeCount,
    autoStackOffset,
    floating,
    floatingUsesScreenAuthority,
    setFlowWidgetWorldPosByNodeId,
  })

  useOutsideClose(toolbarVisible, setToolbarVisible, placement.asideRef)

  React.useEffect(() => {
    const next = readPinnedInCanvas(nodeId)
    pinnedInCanvasRef.current = next
    setPinnedInCanvasState(next)
  }, [nodeId, readPinnedInCanvas])

  React.useEffect(() => {
    const readPinned = (s: unknown) => {
      const map = (s as { flowWidgetPinnedByNodeId?: Record<string, boolean> })?.flowWidgetPinnedByNodeId || {}
      const v = nodeId ? map[nodeId] : undefined
      return typeof v === 'boolean' ? v : readPinnedInCanvas(nodeId)
    }
    const unsub = useGraphStore.subscribe(readPinned, next => {
      pinnedInCanvasRef.current = next
      setPinnedInCanvasState(prev => (prev === next ? prev : next))
    })
    return () => {
      try {
        unsub()
      } catch {
        void 0
      }
    }
  }, [nodeId, readPinnedInCanvas])

  React.useEffect(() => {
    if (!active || !autoRevealKey) return
    setMinimized(prev => {
      if (!prev) return prev
      lsSetBool(LS_KEYS.flowWidgetMinimized, false)
      return false
    })
  }, [active, autoRevealKey])

  React.useEffect(() => {
    if (!toolbarVisible) return
    const id = String(node.id || '').trim()
    if (!id) return
    if (selectedNodeId !== id) setToolbarVisible(false)
  }, [node.id, selectedNodeId, toolbarVisible])

  const wasSelectedRef = React.useRef(false)
  React.useEffect(() => {
    const id = String(node.id || '').trim()
    const selected = !!id && selectedNodeId === id
    if (selected && !wasSelectedRef.current) setToolbarVisible(true)
    wasSelectedRef.current = selected
  }, [node.id, selectedNodeId])

  React.useEffect(() => {
    const wasPinned = previousPinnedInCanvasRef.current === true
    if (wasPinned && pinnedInCanvas !== true && floatingUsesScreenAuthority) {
      const applied = placement.lastAppliedRef.current
      if (applied) placement.persistFloatingPlacement({ top: applied.top, left: applied.left })
    }
    previousPinnedInCanvasRef.current = pinnedInCanvas
  }, [floatingUsesScreenAuthority, pinnedInCanvas, placement])

  React.useEffect(() => {
    if (!active || typeof window === 'undefined') return
    let raf: number | null = null
    const onFrame = () => {
      if (floating && !placement.pinnedDragOverrideRef.current && !placement.widgetWorldPosRef.current) return
      if (raf != null) return
      raf = requestAnimationFrame(() => {
        raf = null
        placement.applyOverlayPosition({ persistClamp: false })
      })
    }
    window.addEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, onFrame as EventListener)
    return () => {
      window.removeEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, onFrame as EventListener)
      if (raf != null) cancelAnimationFrame(raf)
    }
  }, [active, floating, placement])

  React.useEffect(() => {
    return () => {
      const unlock = spacePanUserSelectUnlockRef.current
      spacePanUserSelectUnlockRef.current = null
      if (unlock) unlock()
      if (pinToggleCollisionGuardRef.current != null) {
        try {
          clearTimeout(pinToggleCollisionGuardRef.current)
        } catch {
          void 0
        }
        pinToggleCollisionGuardRef.current = null
      }
    }
  }, [])

  const setPinnedInCanvas = React.useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    const prev = pinnedInCanvasRef.current
    const resolved = !!(typeof next === 'function' ? (next as (v: boolean) => boolean)(prev) : next)
    pinnedInCanvasRef.current = resolved
    setPinnedInCanvasState(prevState => (prevState === resolved ? prevState : resolved))
    if (!nodeId) return
    const map = useGraphStore.getState().flowWidgetPinnedByNodeId || {}
    if (map[nodeId] === resolved) return
    setFlowWidgetPinnedByNodeId({ ...map, [nodeId]: resolved })
  }, [nodeId, setFlowWidgetPinnedByNodeId])

  const togglePinnedInternal = React.useCallback(() => {
    if (pinToggleCollisionGuardRef.current != null) clearTimeout(pinToggleCollisionGuardRef.current)
    pinToggleCollisionGuardRef.current = null
    if (nodeId) {
      useGraphStore.getState().setFlowWidgetDraggingNodeId(nodeId)
      pinToggleCollisionGuardRef.current = setTimeout(() => {
        pinToggleCollisionGuardRef.current = null
        const cur = useGraphStore.getState().flowWidgetDraggingNodeId
        if (cur === nodeId) useGraphStore.getState().setFlowWidgetDraggingNodeId(null)
      }, 240) as unknown as number
    }
    setPinnedInCanvas(prev => !prev)
  }, [nodeId, setPinnedInCanvas])

  const handleTogglePinned = React.useCallback((event: React.MouseEvent) => {
    if (skipPinClickRef.current) {
      skipPinClickRef.current = false
      return
    }
    event.preventDefault()
    event.stopPropagation()
    togglePinnedInternal()
  }, [togglePinnedInternal])

  const handlePinnedPointerDown = React.useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return
    skipPinClickRef.current = true
    togglePinnedInternal()
  }, [togglePinnedInternal])

  const handleToggleMinimized = React.useCallback(() => {
    setMinimized(prev => {
      const next = !prev
      lsSetBool(LS_KEYS.flowWidgetMinimized, next)
      return next
    })
  }, [])

  const handleToggleHideFields = React.useCallback(() => {
    setHideFields(prev => {
      const next = !prev
      lsSetBool(LS_KEYS.flowWidgetHideFields, next)
      return next
    })
  }, [])

  const { isRichMediaPanelWidget, richMediaWidgetPreview, richMediaPanelToolbarProps } = useNodeOverlayRichMediaToolbar({
    node,
    minimized,
    hideFields,
    connectedValuesBySchemaPath,
    onPatchProperties,
    onToggleHideFields: handleToggleHideFields,
  })

  const drag = useNodeOverlayDragHandlers({
    nodeId,
    active,
    floating,
    pinnedInCanvas,
    zoomViewKey,
    getLiveZoomTransform,
    pinnedTopPx: placement.pinnedTopPx,
    pinnedLeftPx: placement.pinnedLeftPx,
    applyOverlayPosition: placement.applyOverlayPosition,
    persistFloatingPlacement: placement.persistFloatingPlacement,
    persistWorldPos: placement.persistWorldPos,
    setSelectionSource,
    selectNode,
    setToolbarVisible,
    canvasWindowOffsetRef: placement.canvasWindowOffsetRef,
    zoomStateRef: placement.zoomStateRef,
    anchoredPosRef: placement.anchoredPosRef,
    autoStackOffset,
    widgetWorldPosRef: placement.widgetWorldPosRef,
    worldDragOverrideRef: placement.worldDragOverrideRef,
    pinnedDragOverrideRef: placement.pinnedDragOverrideRef,
    lastAppliedRef: placement.lastAppliedRef,
    scaledSizeRef: placement.scaledSizeRef,
    viewportRef: placement.viewportRef,
  })

  const enableHandlesDisabled = documentStructureBaselineLock === true || isHandlesForAllInputsEnabled(schema)
  const convertToLoopDisabled = isLoopNode(node)
  const isVideoTranscriberWidget = String(node.type || '').trim() === 'kg-flow-video-transcriber-panel'

  const handleRegistrySelectionChange = React.useCallback(({ entry }: { entry: WidgetRegistryEntry | null }) => {
    if (!active) return
    if (!entry) {
      upsertUiToast({
        id: `flow-widget-registry-clear-${String(node.id || '')}`,
        kind: 'neutral',
        message: UI_COPY.flowWidgetRegistryClearedToast,
        ttlMs: 2200,
      })
      return
    }
    upsertUiToast({
      id: `flow-widget-registry-${entry.id}`,
      kind: 'neutral',
      message: UI_COPY.flowWidgetRegistryToast(`${entry.nodeTypeId} · ${entry.widgetTypeId} · ${entry.formId}`),
      ttlMs: 2500,
    })
  }, [active, node.id, upsertUiToast])

  const overlayElement = (
    <NodeOverlayEditorView
      asideRef={placement.asideRef}
      flowEditorSurfaceId={flowEditorSurfaceId}
      node={node}
      interactionPassthrough={interactionPassthrough}
      pinnedInCanvas={pinnedInCanvas}
      overlayZIndex={overlayZIndex}
      active={active}
      toolbarVisible={toolbarVisible}
      toolbarDock={placement.toolbarDock}
      toolbarSideClamp={placement.toolbarSideClamp}
      isRichMediaPanelWidget={isRichMediaPanelWidget}
      isVideoTranscriberWidget={isVideoTranscriberWidget}
      uiIconScale={uiIconScale}
      uiIconStrokeWidth={uiIconStrokeWidth}
      enableHandlesDisabled={enableHandlesDisabled}
      convertToLoopDisabled={convertToLoopDisabled}
      richMediaPanelToolbarProps={richMediaPanelToolbarProps}
      onRun={onRun}
      onDuplicate={onDuplicate}
      onClearOutput={onClearOutput}
      onHelp={onHelp}
      onRemove={onRemove}
      onEnableHandlesForAllInputs={onEnableHandlesForAllInputs}
      onConvertToLoopNode={onConvertToLoopNode}
      onUpdateKvEntry={onUpdateKvEntry}
      onPatchProperties={onPatchProperties}
      uiPanelOpacity={uiPanelOpacity}
      panelTextClass={panelTextClass}
      microLabelClass={microLabelClass}
      monospaceTextClass={monospaceTextClass}
      labelInputRef={labelInputRef}
      onHeaderPointerDown={drag.handleHeaderPointerDown}
      onToggleHideFields={handleToggleHideFields}
      onTogglePinned={handleTogglePinned}
      onPinnedPointerDown={handlePinnedPointerDown}
      onToggleMinimized={handleToggleMinimized}
      onSetLabel={onSetLabel}
      onSetType={onSetType}
      onSetProperties={onSetProperties}
      onValidate={onValidate}
      onRegistrySelectionChange={handleRegistrySelectionChange}
      onRenameSchemaFieldId={onRenameSchemaFieldId}
      richMediaWidgetPreview={richMediaWidgetPreview}
      registryEntry={registryEntry}
      registryEntries={registryEntries}
      connectedValuesBySchemaPath={connectedValuesBySchemaPath}
      portHandleEdges={portHandleEdges}
      schema={schema}
      graphMetaKind={graphMetaKind}
      minimized={minimized}
      hideFields={hideFields}
      toolMode={toolMode}
      pendingEdgeSourceId={pendingEdgeSourceId}
      onBeginAddEdgeFromNode={onBeginAddEdgeFromNode}
      onFinalizeAddEdgeToNode={onFinalizeAddEdgeToNode}
      setSelectionSource={setSelectionSource}
      selectNode={selectNode}
      setToolbarVisible={setToolbarVisible}
      spacePanUserSelectUnlockRef={spacePanUserSelectUnlockRef}
    />
  )

  return typeof document === 'undefined' ? overlayElement : createPortal(overlayElement, document.body)
})

const NodeOverlayEditor = React.memo(function NodeOverlayEditor(props: NodeOverlayEditorProps) {
  if (props.visible === false) return null
  return <NodeOverlayEditorInner {...props} />
})

export default NodeOverlayEditor
