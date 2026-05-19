import React from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useContainerDims } from '@/hooks/useContainerDims'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useCanvasAppliedMarkdownDocument } from '@/features/canvas/useCanvasAppliedMarkdownDocument'
import {
  EMPTY_BOOL_RECORD,
  EMPTY_POS_RECORD,
  EMPTY_STRING_ARRAY,
  EMPTY_WIDGET_REGISTRY,
} from '@/components/FlowCanvas/shared'
import { resolveCanvasViewportMeasureElement } from '@/lib/canvas/viewportMeasureElement'
import { readOverlaySizingInputFromStoreState } from '@/lib/render/overlaySizing2d'

export function useFlowCanvasStoreState(args: {
  active: boolean
  containerRef: React.RefObject<HTMLElement>
}) {
  const { active, containerRef } = args
  const registerCanvasSnapshotFns = useGraphStore(s => s.registerCanvasSnapshotFns)
  const selectedNodeId = useGraphStore(s => (active ? s.selectedNodeId : null))
  const selectedNodeIds = useGraphStore(s => (active ? s.selectedNodeIds : EMPTY_STRING_ARRAY))
  const { width, height, dpr } = useContainerDims(containerRef, {
    resolveMeasureElement: resolveCanvasViewportMeasureElement,
  })
  const viewportW = Math.max(1, Math.floor(width))
  const viewportH = Math.max(1, Math.floor(height))

  const storeState = useGraphStore(
    useShallow(s => {
      if (!active) {
        return {
          schema: s.schema,
          frontmatterModeEnabled: false,
          documentSemanticMode: 'document' as const,
          multiDimTableModeEnabled: false,
          documentStructureBaselineLock: false,
          collapsedGroupIds: EMPTY_STRING_ARRAY,
          renderMediaAsNodes: false,
          mediaPanelDensity: 'default' as const,
          threeIframeOverlayPoolMax: s.threeIframeOverlayPoolMax,
          overlaySizing: readOverlaySizingInputFromStoreState(s),
          canvasRenderMode: '2d' as const,
          canvas2dRenderer: 'flow' as const,
          infiniteCanvasInteractionMode: 'static' as const,
          viewportControlsPreset: s.viewportControlsPreset,
          flowEditorSelectionOnDrag: false,
          setLayoutPositionsForMode: s.setLayoutPositionsForMode,
          graphDataRevision: s.graphDataRevision || 0,
          viewPinned: false,
          fitToScreenMode: false,
          zoomToSelectionMode: false,
          setZoomState: s.setZoomState,
          setZoomStateForKey: s.setZoomStateForKey,
          widgetRegistry: EMPTY_WIDGET_REGISTRY,
          baseWidgetRegistry: EMPTY_WIDGET_REGISTRY,
          documentWidgetRegistry: EMPTY_WIDGET_REGISTRY,
          openWidgetNodeIds: EMPTY_STRING_ARRAY,
          flowWidgetPinnedByNodeId: EMPTY_BOOL_RECORD,
          flowWidgetWorldPosByNodeId: EMPTY_POS_RECORD,
          flowWidgetPosByNodeId: EMPTY_POS_RECORD,
          markdownDocumentName: null,
          markdownDocumentSourceUrl: null,
          markdownDocumentText: '',
          markdownDocumentApplyViewPreset: false,
        }
      }
      return {
        schema: s.schema,
        frontmatterModeEnabled: s.frontmatterModeEnabled || false,
        documentSemanticMode: (s.documentSemanticMode || 'document') as 'document' | 'keyword',
        multiDimTableModeEnabled: (s as unknown as { multiDimTableModeEnabled?: unknown }).multiDimTableModeEnabled === true,
        documentStructureBaselineLock: s.documentStructureBaselineLock === true,
        collapsedGroupIds: s.collapsedGroupIds ?? EMPTY_STRING_ARRAY,
        renderMediaAsNodes: s.renderMediaAsNodes,
        mediaPanelDensity: s.mediaPanelDensity,
        threeIframeOverlayPoolMax: s.threeIframeOverlayPoolMax,
        overlaySizing: readOverlaySizingInputFromStoreState(s),
        canvasRenderMode: s.canvasRenderMode,
        canvas2dRenderer: s.canvas2dRenderer,
        infiniteCanvasInteractionMode: (s.infiniteCanvasInteractionMode || 'static') as 'static' | 'interactive',
        viewportControlsPreset: s.viewportControlsPreset,
        flowEditorSelectionOnDrag: s.flowEditorSelectionOnDrag === true,
        setLayoutPositionsForMode: s.setLayoutPositionsForMode,
        graphDataRevision: s.graphDataRevision || 0,
        viewPinned: s.viewPinned === true,
        fitToScreenMode: s.fitToScreenMode === true,
        zoomToSelectionMode: s.zoomToSelectionMode === true,
        setZoomState: s.setZoomState,
        setZoomStateForKey: s.setZoomStateForKey,
        widgetRegistry: s.effectiveWidgetRegistry ?? EMPTY_WIDGET_REGISTRY,
        baseWidgetRegistry: s.widgetRegistry ?? EMPTY_WIDGET_REGISTRY,
        documentWidgetRegistry: s.documentWidgetRegistry ?? EMPTY_WIDGET_REGISTRY,
        openWidgetNodeIds: s.openWidgetNodeIds ?? EMPTY_STRING_ARRAY,
        flowWidgetPinnedByNodeId: s.flowWidgetPinnedByNodeId ?? EMPTY_BOOL_RECORD,
        flowWidgetWorldPosByNodeId:
          (s as unknown as { flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }> }).flowWidgetWorldPosByNodeId
          ?? EMPTY_POS_RECORD,
        flowWidgetPosByNodeId: s.flowWidgetPosByNodeId || {},
        markdownDocumentName: (s as unknown as { markdownDocumentName?: unknown }).markdownDocumentName,
        markdownDocumentSourceUrl: (s as unknown as { markdownDocumentSourceUrl?: unknown }).markdownDocumentSourceUrl,
        markdownDocumentText: (s as unknown as { markdownDocumentText?: unknown }).markdownDocumentText,
        markdownDocumentApplyViewPreset: (s as unknown as { markdownDocumentApplyViewPreset?: unknown }).markdownDocumentApplyViewPreset,
      }
    }),
  )
  const canvasMarkdownDocument = useCanvasAppliedMarkdownDocument({
    name: typeof storeState.markdownDocumentName === 'string' ? storeState.markdownDocumentName : null,
    sourceUrl: typeof storeState.markdownDocumentSourceUrl === 'string' ? storeState.markdownDocumentSourceUrl : null,
    text: typeof storeState.markdownDocumentText === 'string' ? storeState.markdownDocumentText : '',
    applyViewPreset: storeState.markdownDocumentApplyViewPreset !== false,
  })

  return {
    registerCanvasSnapshotFns,
    selectedNodeId,
    selectedNodeIds,
    width,
    height,
    dpr,
    viewportW,
    viewportH,
    ...storeState,
    markdownDocumentName: canvasMarkdownDocument.name,
    markdownDocumentText: canvasMarkdownDocument.text,
  }
}
