import React from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'

import { NodeOverlayEditorView } from '@/components/FlowEditor/NodeOverlayEditorView'
import { useNodeOverlayDragHandlers } from '@/components/FlowEditor/useNodeOverlayDragHandlers'
import { useNodeOverlayPlacementRuntime } from '@/components/FlowEditor/useNodeOverlayPlacementRuntime'
import { useNodeOverlayRichMediaToolbar } from '@/components/FlowEditor/useNodeOverlayRichMediaToolbar'
import {
  FLOW_WIDGET_OVERLAY_Z_INDEX_BASE,
  FLOW_WIDGET_OVERLAY_Z_INDEX_SELECTED,
  type FlowWidgetOverlayProps,
} from '@/components/FlowEditor/flowWidgetOverlayShared'
import { useOutsideClose } from '@/hooks/useOutsideClose'
import { useGraphStore } from '@/hooks/useGraphStore'
import { resolveEffectiveFlowWidgetPinnedInCanvas, shouldUseFlowEditorWidgetFloatingScreenAuthority } from '@/lib/flowEditor/widgetPlacementAuthority'
import { computeWidgetAnchoredStackOffset } from '@/components/FlowEditor/widgetLayout'
import { isHandlesForAllInputsEnabled, isLoopNode } from '@/lib/flowEditor/flowEditorActions'
import { lsBool, lsSetBool } from '@/lib/persistence'
import { LS_KEYS, UI_COPY } from '@/lib/config'
import { readScopedFlowWidgetNodeValue } from '@/lib/flowEditor/widgetStateScope'
import { useIsomorphicLayoutEffect } from '@/lib/react/useIsomorphicLayoutEffect'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { resolveWidgetRegistryEntry } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { FLOW_EDITOR_INTERACTION_FRAME_EVENT } from '@/lib/canvas/flow-editor-overlay-proxy'
import { isCanonicalNodeIdEqual } from '@/lib/graph/canonicalNodeIds'

const EMPTY_WIDGET_REGISTRY: WidgetRegistryEntry[] = []

const FlowWidgetOverlayInner = React.memo(function FlowWidgetOverlayInner({
  active,
  flowEditorSurfaceId,
  overlayCollectiveCount,
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
  graphMetaKey,
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
}: FlowWidgetOverlayProps) {
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
  const widgetPos = useGraphStore(useShallow(s => {
    return readScopedFlowWidgetNodeValue({
      nodeId,
      graphMetaKey,
      graphData: s.graphData,
      keyedByGraphMetaKey: s.flowWidgetPosByNodeIdByGraphMetaKey,
      globalByNodeId: s.flowWidgetPosByNodeId,
    })
  }))
  const registryEntry = React.useMemo(
    () => resolveWidgetRegistryEntry({ node, registry: registryEntries, graphMetaKind }),
    [graphMetaKind, node, registryEntries],
  )

  const overlayZIndex = React.useMemo(() => {
    const idx = Number.isFinite(stackIndex) ? Math.max(0, Math.floor(stackIndex as number)) : 0
    const selected = isCanonicalNodeIdEqual(selectedNodeId, nodeId)
    return selected ? FLOW_WIDGET_OVERLAY_Z_INDEX_SELECTED : FLOW_WIDGET_OVERLAY_Z_INDEX_BASE - idx
  }, [nodeId, selectedNodeId, stackIndex])

  const readPinnedInCanvas = React.useCallback((id: string): boolean => {
    if (!id) return false
    const state = useGraphStore.getState()
    const v = readScopedFlowWidgetNodeValue({
      nodeId: id,
      graphMetaKey,
      graphData: state.graphData,
      keyedByGraphMetaKey: state.flowWidgetPinnedByNodeIdByGraphMetaKey,
      globalByNodeId: state.flowWidgetPinnedByNodeId,
    })
    return resolveEffectiveFlowWidgetPinnedInCanvas({
      graphMetaKind,
      node,
      pinnedValue: typeof v === 'boolean' ? v : null,
    })
  }, [graphMetaKey, graphMetaKind, node])

  const [pinnedInCanvas, setPinnedInCanvasState] = React.useState<boolean>(() => readPinnedInCanvas(nodeId))
  const pinnedInCanvasRef = React.useRef<boolean>(readPinnedInCanvas(nodeId))
  const previousPinnedInCanvasRef = React.useRef<boolean>(pinnedInCanvas)
  const previousPinnedPlacementAuthorityRef = React.useRef<boolean>(pinnedInCanvas)
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

  const effectiveOverlayCollectiveCount = React.useMemo(() => {
    if (typeof overlayCollectiveCount === 'number' && Number.isFinite(overlayCollectiveCount)) {
      return Math.max(1, Math.floor(overlayCollectiveCount))
    }
    return Math.max(1, openWidgetNodeCount)
  }, [openWidgetNodeCount, overlayCollectiveCount])

  const placement = useNodeOverlayPlacementRuntime({
    node,
    nodeId,
    stackIndex,
    active,
    flowEditorSurfaceId,
    viewportW,
    viewportH,
    canvasWindowOffset,
    graphMetaKey,
    graphMetaKind,
    zoomViewKey,
    getLiveNodeWorldPos,
    getLiveZoomTransform,
    getLiveContainmentGroupAabbForNode,
    widgetPos,
    schema,
    openWidgetNodeCount: effectiveOverlayCollectiveCount,
    autoStackOffset,
    floating,
    floatingUsesScreenAuthority,
    setFlowWidgetWorldPosByNodeId,
  })
  const applyOverlayPosition = placement.applyOverlayPosition
  const persistCurrentScreenPlacementAsWorldPlacement = placement.persistCurrentScreenPlacementAsWorldPlacement

  useOutsideClose(toolbarVisible, setToolbarVisible, placement.asideRef)

  React.useEffect(() => {
    const next = readPinnedInCanvas(nodeId)
    pinnedInCanvasRef.current = next
    setPinnedInCanvasState(next)
  }, [nodeId, readPinnedInCanvas])

  React.useEffect(() => {
    const readPinned = (s: unknown) => {
      const state = s as {
        graphData?: unknown
        flowWidgetPinnedByNodeId?: Record<string, boolean>
        flowWidgetPinnedByNodeIdByGraphMetaKey?: Record<string, Record<string, boolean>>
      }
      const v = readScopedFlowWidgetNodeValue({
        nodeId,
        graphMetaKey,
        graphData: state.graphData,
        keyedByGraphMetaKey: state.flowWidgetPinnedByNodeIdByGraphMetaKey,
        globalByNodeId: state.flowWidgetPinnedByNodeId,
      })
      return resolveEffectiveFlowWidgetPinnedInCanvas({
        graphMetaKind,
        node,
        pinnedValue: typeof v === 'boolean' ? v : null,
      })
    }
    const unsub = useGraphStore.subscribe(readPinned, next => {
      if (
        pinnedInCanvasRef.current !== true
        && next === true
        && shouldUseFlowEditorWidgetFloatingScreenAuthority({ graphMetaKind, pinnedInCanvas: false })
      ) {
        persistCurrentScreenPlacementAsWorldPlacement()
      }
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
  }, [graphMetaKey, graphMetaKind, nodeId, persistCurrentScreenPlacementAsWorldPlacement, readPinnedInCanvas])

  React.useEffect(() => {
    if (!nodeId || !floatingUsesScreenAuthority) return
    const readRawPinned = (s: unknown): boolean | null => {
      const state = s as {
        graphData?: unknown
        flowWidgetPinnedByNodeId?: Record<string, boolean>
        flowWidgetPinnedByNodeIdByGraphMetaKey?: Record<string, Record<string, boolean>>
      }
      const v = readScopedFlowWidgetNodeValue({
        nodeId,
        graphMetaKey,
        graphData: state.graphData,
        keyedByGraphMetaKey: state.flowWidgetPinnedByNodeIdByGraphMetaKey,
        globalByNodeId: state.flowWidgetPinnedByNodeId,
      })
      return typeof v === 'boolean' ? v : null
    }
    let prevRawPinned = readRawPinned(useGraphStore.getState())
    const unsub = useGraphStore.subscribe(readRawPinned, nextRawPinned => {
      const wasRawPinned = prevRawPinned === true
      prevRawPinned = nextRawPinned
      if (!wasRawPinned || nextRawPinned === true) return
      const applied = placement.lastAppliedRef.current
      if (!applied) return
      placement.persistFloatingPlacement({ top: applied.top, left: applied.left })
    })
    return () => {
      try {
        unsub()
      } catch {
        void 0
      }
    }
  }, [floatingUsesScreenAuthority, graphMetaKey, nodeId, placement])

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
    if (!isCanonicalNodeIdEqual(selectedNodeId, id)) setToolbarVisible(false)
  }, [node.id, selectedNodeId, toolbarVisible])

  const wasSelectedRef = React.useRef(false)
  React.useEffect(() => {
    const id = String(node.id || '').trim()
    const selected = !!id && isCanonicalNodeIdEqual(selectedNodeId, id)
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

  useIsomorphicLayoutEffect(() => {
    const wasPinned = previousPinnedPlacementAuthorityRef.current === true
    const becamePinned = !wasPinned && pinnedInCanvas === true
    if (becamePinned && shouldUseFlowEditorWidgetFloatingScreenAuthority({ graphMetaKind, pinnedInCanvas: false })) {
      const persisted = persistCurrentScreenPlacementAsWorldPlacement()
      if (persisted) applyOverlayPosition({ emitInteractionFrame: false })
    }
    previousPinnedPlacementAuthorityRef.current = pinnedInCanvas
  }, [applyOverlayPosition, graphMetaKind, persistCurrentScreenPlacementAsWorldPlacement, pinnedInCanvas])

  React.useEffect(() => {
    if (!active || typeof window === 'undefined') return
    const onFrame = () => {
      placement.applyOverlayPosition({ emitInteractionFrame: false })
    }
    window.addEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, onFrame as EventListener)
    return () => {
      window.removeEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, onFrame as EventListener)
    }
  }, [active, placement])

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
        if (nodeId && useGraphStore.getState().flowWidgetDraggingNodeId === nodeId) {
          useGraphStore.getState().setFlowWidgetDraggingNodeId(null)
        }
      }
    }
  }, [nodeId])

  const setPinnedInCanvas = React.useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    const prev = pinnedInCanvasRef.current
    const requested = !!(typeof next === 'function' ? (next as (v: boolean) => boolean)(prev) : next)
    const resolved = resolveEffectiveFlowWidgetPinnedInCanvas({
      graphMetaKind,
      node,
      pinnedValue: requested,
    })
    if (
      prev !== true
      && resolved === true
      && shouldUseFlowEditorWidgetFloatingScreenAuthority({ graphMetaKind, pinnedInCanvas: false })
    ) {
      persistCurrentScreenPlacementAsWorldPlacement()
    }
    pinnedInCanvasRef.current = resolved
    setPinnedInCanvasState(prevState => (prevState === resolved ? prevState : resolved))
    if (!nodeId) return
    const map = useGraphStore.getState().flowWidgetPinnedByNodeId || {}
    const nextMap = { ...map, [nodeId]: resolved }
    const prevHas = Object.prototype.hasOwnProperty.call(map, nodeId)
    const nextHas = Object.prototype.hasOwnProperty.call(nextMap, nodeId)
    if (prevHas === nextHas && map[nodeId] === nextMap[nodeId]) return
    setFlowWidgetPinnedByNodeId(nextMap)
  }, [graphMetaKind, node, nodeId, persistCurrentScreenPlacementAsWorldPlacement, setFlowWidgetPinnedByNodeId])

  const togglePinnedInternal = React.useCallback(() => {
    if (pinToggleCollisionGuardRef.current != null) {
      clearTimeout(pinToggleCollisionGuardRef.current)
      pinToggleCollisionGuardRef.current = null
      if (nodeId && useGraphStore.getState().flowWidgetDraggingNodeId === nodeId) {
        useGraphStore.getState().setFlowWidgetDraggingNodeId(null)
      }
    }
    const requested = !pinnedInCanvasRef.current
    if (nodeId) {
      useGraphStore.getState().setFlowWidgetDraggingNodeId(nodeId)
      pinToggleCollisionGuardRef.current = setTimeout(() => {
        pinToggleCollisionGuardRef.current = null
        const cur = useGraphStore.getState().flowWidgetDraggingNodeId
        if (cur === nodeId) useGraphStore.getState().setFlowWidgetDraggingNodeId(null)
      }, 240) as unknown as number
    }
    setPinnedInCanvas(requested)
  }, [graphMetaKind, node, nodeId, setPinnedInCanvas])

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

  const setWidgetSelectionSource = React.useCallback((source: 'canvas' | 'editor' | 'none') => {
    setSelectionSource(source === 'none' ? 'unknown' : source)
  }, [setSelectionSource])

  const {
    isRichMediaPanelWidget,
    richMediaPanelToolbarProps,
    richMediaWidgetPreview,
  } = useNodeOverlayRichMediaToolbar({
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
    zoomViewKey,
    getLiveZoomTransform,
    pinnedTopPx: placement.pinnedTopPx,
    pinnedLeftPx: placement.pinnedLeftPx,
    applyOverlayPosition: placement.applyOverlayPosition,
    persistFloatingPlacement: placement.persistFloatingPlacement,
    persistWorldPos: placement.persistWorldPos,
    setSelectionSource: setWidgetSelectionSource,
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
      pinnedInCanvas={pinnedInCanvas}
      overlayZIndex={overlayZIndex}
      active={active}
      toolbarVisible={toolbarVisible}
      toolbarDock={placement.toolbarDock}
      toolbarSideClamp={placement.toolbarSideClamp}
      toolbarInlineShiftPx={placement.toolbarInlineShiftPx}
      toolbarMaxWidthPx={placement.toolbarMaxWidthPx}
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
      setSelectionSource={setWidgetSelectionSource}
      selectNode={selectNode}
      setToolbarVisible={setToolbarVisible}
      spacePanUserSelectUnlockRef={spacePanUserSelectUnlockRef}
    />
  )

  return typeof document === 'undefined' ? overlayElement : createPortal(overlayElement, document.body)
})

const FlowWidgetOverlayBody = React.memo(function FlowWidgetOverlayBody(props: FlowWidgetOverlayProps) {
  return <FlowWidgetOverlayInner {...props} />
})

const FlowWidgetOverlay = React.memo(function FlowWidgetOverlay(props: FlowWidgetOverlayProps) {
  if (props.visible === false) return null
  return <FlowWidgetOverlayBody {...props} />
})

export default FlowWidgetOverlay
