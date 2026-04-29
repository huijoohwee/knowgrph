import React, { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'
import { useShallow } from 'zustand/react/shallow'
import { DesignCanvasArrangeActionBar } from '@/components/DesignCanvas/ArrangeActionBar'
import { DesignCanvasFrameShellLayer } from '@/components/DesignCanvas/FrameShellLayer'
import { DesignCanvasLabelBadgesLayer } from '@/components/DesignCanvas/LabelBadgesLayer'
import { DesignCanvasMediaOverlay } from '@/components/DesignCanvas/MediaOverlay'
import { DesignCanvasSelectionOverlay } from '@/components/DesignCanvas/SelectionOverlay'
import { DesignCanvasWireframePreviewLayer } from '@/components/DesignCanvas/WireframePreviewLayer'
import { useDesignCanvasArrangeActions } from '@/components/DesignCanvas/arrangeActions'
import { useFrameDragController } from '@/components/DesignCanvas/useFrameDragController'
import { useDesignCanvasGraphOrchestration } from '@/components/DesignCanvas/useDesignCanvasGraphOrchestration'
import { useDesignCanvasLabelLayout } from '@/components/DesignCanvas/useDesignCanvasLabelLayout'
import { useDesignCanvasMarkdownPanelGroups } from '@/components/DesignCanvas/useDesignCanvasMarkdownPanelGroups'
import { useDesignCanvasOverlayRuntime } from '@/components/DesignCanvas/useDesignCanvasOverlayRuntime'
import { useDesignCanvasRenderData } from '@/components/DesignCanvas/useDesignCanvasRenderData'
import { useDesignCanvasWireframeDecor } from '@/components/DesignCanvas/useDesignCanvasWireframeDecor'
import { useGroupResizeController } from '@/components/DesignCanvas/useGroupResizeController'
import { useGlobalInteractionCleanup } from '@/components/DesignCanvas/useGlobalInteractionCleanup'
import { useResizeMarqueeController } from '@/components/DesignCanvas/useResizeMarqueeController'
import { useZoomInitController } from '@/components/DesignCanvas/useZoomInitController'
import { DesignCanvasWebpageStatusPanel } from '@/components/DesignCanvas/webpageStatusPanel'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { DesignFramePos, DesignFrameSize } from '@/hooks/store/designRendererSlice'
import { useContainerDims } from '@/hooks/useContainerDims'
import { CANVAS_INTERACTIVE_CLASS, CANVAS_SURFACE_CLASS } from '@/lib/canvas/surface'
import { InfiniteGridCanvasOverlay } from '@/components/InfiniteGridCanvasOverlay'
import { readCanvasGridRenderConfigFromSchema } from '@/lib/canvas/canvasGridConfig'
import { invertZoomPoint } from '@/lib/canvas/viewport-transform'
import { readElementLocalPoint } from '@/lib/canvas/canvas-event-coords'
import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'
import { computeOverlayDraggedPoint2d, computeOverlayPanTransform2d } from '@/lib/canvas/overlayInteractions2d'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'

import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { readDesignWireframeSettings } from '@/lib/render/designWireframeSettings'
import { buildViewportSvgMarkupFromElement } from '@/lib/graph/svgSnapshot'
import type { DesignLayerState } from '@/features/design/designLayersState'

const EMPTY_STRING_ARRAY: string[] = []
const EMPTY_DESIGN_LAYER_STATE: DesignLayerState = { order: [], hiddenById: {} }
const EMPTY_DESIGN_FRAME_POS_BY_ID: Record<string, DesignFramePos> = {}
const EMPTY_DESIGN_FRAME_SIZE_BY_ID: Record<string, DesignFrameSize> = {}
import { MarkdownDesignOverlay } from '@/features/markdown-edgeless/MarkdownDesignOverlay'

export default function DesignCanvas({
  active = true,
}: {
  active?: boolean
}) {
  const containerRef = useRef<HTMLElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const labelsSelRef = useRef<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>(null)
  const mediaOverlayPanRef = useRef<null | { pointerId: number; startTransform: d3.ZoomTransform }>(null)
  const dims = useContainerDims(containerRef)
  const registerCanvasSnapshotFns = useGraphStore(s => s.registerCanvasSnapshotFns)

  const moveDesignMediaOverlayPan = React.useCallback((args: { pointerId: number; dx: number; dy: number }) => {
    const drag = mediaOverlayPanRef.current
    if (!drag || drag.pointerId !== args.pointerId) return
    const svgEl = svgRef.current
    const zoom = zoomRef.current
    if (!svgEl || !zoom) return
    const st = useGraphStore.getState()
    disableAutoZoomModesForUserGesture(st)
    const next = computeOverlayPanTransform2d({
      startTransform: drag.startTransform,
      dxClientPx: args.dx,
      dyClientPx: args.dy,
      canvasPanSpeedMultiplier: st.canvasPanSpeedMultiplier,
      canvasInteractionSpeedMultiplier: st.canvasInteractionSpeedMultiplier,
      applySpeedMultipliers: false,
    })
    d3.select(svgEl).call(zoom.transform as never, next)
  }, [])

  const endDesignMediaOverlayPan = React.useCallback((args: { pointerId: number }) => {
    const drag = mediaOverlayPanRef.current
    if (!drag || drag.pointerId !== args.pointerId) return
    mediaOverlayPanRef.current = null
  }, [])

  useEffect(() => {
    if (!active) return
    const captureSvg = async (): Promise<string | null> => {
      try {
        const el = svgRef.current
        if (!el) return null
        return buildViewportSvgMarkupFromElement(el, {
          includeXmlDeclaration: true,
          inlineComputedStyles: true,
          removeCssClasses: true,
          removeDataAttributes: false,
        })
      } catch {
        return null
      }
    }

    const capturePng = async (pixelRatio?: number): Promise<Blob | null> => {
      try {
        const el = svgRef.current
        if (!el) return null
        const serializer = new XMLSerializer()
        const markup = serializer.serializeToString(el)
        if (!markup || !markup.trim()) return null
        const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        try {
          const img = new Image()
          const vb = el.viewBox && el.viewBox.baseVal ? el.viewBox.baseVal : null
          const w = vb && vb.width ? vb.width : el.clientWidth || 800
          const h = vb && vb.height ? vb.height : el.clientHeight || 600
          const ratio = pixelRatio && pixelRatio > 0 ? pixelRatio : 1
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.floor(w * ratio))
          canvas.height = Math.max(1, Math.floor(h * ratio))
          const ctx = canvas.getContext('2d')
          if (!ctx) return null
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = () => reject(new Error('Image load failed'))
            img.src = url
          })
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const pngBlob = await new Promise<Blob | null>(resolve => {
            canvas.toBlob(b => resolve(b), 'image/png')
          })
          return pngBlob || null
        } finally {
          URL.revokeObjectURL(url)
        }
      } catch {
        return null
      }
    }

    registerCanvasSnapshotFns('2d', { captureSvg, capturePng })
    return () => {
      registerCanvasSnapshotFns('2d', null)
    }
  }, [active, registerCanvasSnapshotFns])

  const snapshot = useGraphStore(
    useShallow(s => {
      if (!active) {
        return {
          graphData: null,
          graphDataRevision: s.graphDataRevision,
          schema: s.schema,
          canvasRenderMode: '2d' as const,
          canvas2dRenderer: 'design' as const,
          documentSemanticMode: 'document' as const,
          frontmatterModeEnabled: false,
          multiDimTableModeEnabled: false,
          documentStructureBaselineLock: false,
          renderMediaAsNodes: false,
          mediaPanelDensity: 'default' as const,
          threeIframeOverlayPoolMax: s.threeIframeOverlayPoolMax,
          threeIframeOverlayBaseWidthRatioDefault: s.threeIframeOverlayBaseWidthRatioDefault,
          threeIframeOverlayBaseWidthRatioCompact: s.threeIframeOverlayBaseWidthRatioCompact,
          threeIframeOverlayBaseWidthMinPxDefault: s.threeIframeOverlayBaseWidthMinPxDefault,
          threeIframeOverlayBaseWidthMinPxCompact: s.threeIframeOverlayBaseWidthMinPxCompact,
          threeIframeOverlayBaseWidthMaxPxDefault: s.threeIframeOverlayBaseWidthMaxPxDefault,
          threeIframeOverlayBaseWidthMaxPxCompact: s.threeIframeOverlayBaseWidthMaxPxCompact,
          collapsedGroupIds: EMPTY_STRING_ARRAY,
          selectedNodeId: null,
          selectedNodeIds: EMPTY_STRING_ARRAY,
          selectedGroupId: null,
          workspaceViewMode: 'canvas' as const,
          viewportControlsPreset: s.viewportControlsPreset,
          canvasPointerMode2d: (s as unknown as { canvasPointerMode2d?: unknown }).canvasPointerMode2d,
          designLayerState: EMPTY_DESIGN_LAYER_STATE,
          designWireframeCacheEpoch: 0,
          designFramePosById: EMPTY_DESIGN_FRAME_POS_BY_ID,
          designFrameSizeById: EMPTY_DESIGN_FRAME_SIZE_BY_ID,
          setDesignFramePosMany: s.setDesignFramePosMany,
          setDesignFrameSizeMany: s.setDesignFrameSizeMany,
          setDesignRendererNodes: s.setDesignRendererNodes,
          setDesignRendererWebpageGraph: s.setDesignRendererWebpageGraph,
          markdownDocumentName: null,
          markdownDocumentText: '',
        }
      }
      return {
        graphData: s.graphData,
        graphDataRevision: s.graphDataRevision,
        schema: s.schema,
        canvasRenderMode: s.canvasRenderMode,
        canvas2dRenderer: s.canvas2dRenderer,
        documentSemanticMode: s.documentSemanticMode,
        frontmatterModeEnabled: s.frontmatterModeEnabled,
        multiDimTableModeEnabled: s.multiDimTableModeEnabled,
        documentStructureBaselineLock: s.documentStructureBaselineLock,
        renderMediaAsNodes: s.renderMediaAsNodes,
        mediaPanelDensity: s.mediaPanelDensity,
        threeIframeOverlayPoolMax: s.threeIframeOverlayPoolMax,
        threeIframeOverlayBaseWidthRatioDefault: s.threeIframeOverlayBaseWidthRatioDefault,
        threeIframeOverlayBaseWidthRatioCompact: s.threeIframeOverlayBaseWidthRatioCompact,
        threeIframeOverlayBaseWidthMinPxDefault: s.threeIframeOverlayBaseWidthMinPxDefault,
        threeIframeOverlayBaseWidthMinPxCompact: s.threeIframeOverlayBaseWidthMinPxCompact,
        threeIframeOverlayBaseWidthMaxPxDefault: s.threeIframeOverlayBaseWidthMaxPxDefault,
        threeIframeOverlayBaseWidthMaxPxCompact: s.threeIframeOverlayBaseWidthMaxPxCompact,
        collapsedGroupIds: s.collapsedGroupIds,
        selectedNodeId: s.selectedNodeId,
        selectedNodeIds: s.selectedNodeIds,
        selectedGroupId: s.selectedGroupId,
        workspaceViewMode: s.workspaceViewMode,
        viewportControlsPreset: s.viewportControlsPreset,
        canvasPointerMode2d: s.canvasPointerMode2d,
        designLayerState: s.designLayerState,
        designWireframeCacheEpoch: s.designWireframeCacheEpoch,
        designFramePosById: s.designFramePosById,
        designFrameSizeById: s.designFrameSizeById,
        setDesignFramePosMany: s.setDesignFramePosMany,
        setDesignFrameSizeMany: s.setDesignFrameSizeMany,
        setDesignRendererNodes: s.setDesignRendererNodes,
        setDesignRendererWebpageGraph: s.setDesignRendererWebpageGraph,
        markdownDocumentName: s.markdownDocumentName,
        markdownDocumentText: s.markdownDocumentText,
      }
    }),
  )
  const workspaceEditorOverlayMode = snapshot.workspaceViewMode === 'editor'
  const interactionActive = active && !workspaceEditorOverlayMode
  const workspaceEditorOverlayEnabled = workspaceEditorOverlayMode && active && !!String(snapshot.markdownDocumentText || '').trim()
  const stopOverlayEvent = React.useCallback((event: React.SyntheticEvent) => {
    try {
      event.stopPropagation()
    } catch {
      void 0
    }
  }, [])
  const startDesignMediaOverlayPan = React.useCallback((args: { pointerId: number }) => {
    if (!interactionActive) return
    const svgEl = svgRef.current
    if (!svgEl) return
    disableAutoZoomModesForUserGesture(useGraphStore.getState())
    mediaOverlayPanRef.current = { pointerId: args.pointerId, startTransform: d3.zoomTransform(svgEl) }
  }, [interactionActive])
  const {
    documentUrl,
    webpageFrontmatter,
    webpageWorkspacePath,
    webpageLayout,
    webpageLayoutStatus,
    setWebpageLayoutStatus,
    setWebpageStatusUi,
    webpageStatusStore,
    activeWebpageLayoutGraphData,
    webpageLayoutKey,
    webpageGraphNodesById,
    decreaseWebpageFidelity,
    increaseWebpageFidelity,
    retryWebpageLayout,
    visibleNodes,
    designGraphNodeById,
    positions,
    localGraphData,
  } = useDesignCanvasGraphOrchestration({
    active,
    graphData: snapshot.graphData as GraphData | null,
    designLayerState: snapshot.designLayerState,
    designWireframeCacheEpoch: snapshot.designWireframeCacheEpoch,
    designFramePosById: snapshot.designFramePosById,
    designFrameSizeById: snapshot.designFrameSizeById,
    documentSemanticMode: String(snapshot.documentSemanticMode || 'document'),
    frontmatterModeEnabled: snapshot.frontmatterModeEnabled === true,
    markdownDocumentName: snapshot.markdownDocumentName,
    markdownDocumentText: snapshot.markdownDocumentText,
    viewportW: dims.width,
    viewportH: dims.height,
    setDesignRendererNodes: snapshot.setDesignRendererNodes,
    setDesignRendererWebpageGraph: snapshot.setDesignRendererWebpageGraph,
  })

  const FRAME_W = 320
  const FRAME_H = 240

  const {
    markdownPanelAllowedKinds,
    panelOnlyNodeIdSet,
    designGroups,
    allowGroupResize,
    groupHandleCfg,
    explicitGroupRectByNodeId,
    designGroupBoundsById,
    designMediaOverlayNodes,
    designMediaOverlayNodeIdSet,
    designMediaOverlayNodeIdsKey,
  } = useDesignCanvasMarkdownPanelGroups({
    active,
    localGraphData,
    positions,
    graphData: snapshot.graphData as GraphData | null,
    schema: snapshot.schema as GraphSchema | null,
    documentSemanticMode: String(snapshot.documentSemanticMode || 'document'),
    frontmatterModeEnabled: snapshot.frontmatterModeEnabled === true,
    multiDimTableModeEnabled: snapshot.multiDimTableModeEnabled === true,
    documentStructureBaselineLock: snapshot.documentStructureBaselineLock === true,
    renderMediaAsNodes: snapshot.renderMediaAsNodes,
    threeIframeOverlayPoolMax: snapshot.threeIframeOverlayPoolMax,
    markdownDocumentName: snapshot.markdownDocumentName,
    markdownDocumentText: snapshot.markdownDocumentText,
  })
  const { localGraphDataRef, designMediaOverlayElsRef, designMediaHeaderDragRef } = useDesignCanvasOverlayRuntime({
    active,
    localGraphData,
    designMediaOverlayNodeIdsKey,
    designMediaOverlayNodes,
    viewportW: dims.width,
    viewportH: dims.height,
    mediaPanelDensity: snapshot.mediaPanelDensity,
    renderMediaAsNodes: snapshot.renderMediaAsNodes,
    threeIframeOverlayBaseWidthRatioDefault: snapshot.threeIframeOverlayBaseWidthRatioDefault,
    threeIframeOverlayBaseWidthRatioCompact: snapshot.threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthMinPxDefault: snapshot.threeIframeOverlayBaseWidthMinPxDefault,
    threeIframeOverlayBaseWidthMinPxCompact: snapshot.threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault: snapshot.threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlayBaseWidthMaxPxCompact: snapshot.threeIframeOverlayBaseWidthMaxPxCompact,
    svgRef,
    zoomRef,
    documentUrl,
    webpageLayoutStatus,
    activeWebpageLayoutGraphData,
    hiddenById: snapshot.designLayerState?.hiddenById,
    webpageLayout,
    schema: snapshot.schema as GraphSchema | null,
    setWebpageLayoutStatus,
    setWebpageStatusUi,
  })

  const setDesignFramePosMany = React.useCallback((patch: Record<string, DesignFramePos>) => {
    if (!interactionActive) return
    snapshot.setDesignFramePosMany(patch)
  }, [interactionActive, snapshot])
  const setDesignFrameSizeMany = React.useCallback((patch: Record<string, DesignFrameSize>) => {
    if (!interactionActive) return
    snapshot.setDesignFrameSizeMany(patch)
  }, [interactionActive, snapshot])

  const frameElByIdRef = useRef<Map<string, SVGGElement>>(new Map())
  const frameRectElByIdRef = useRef<Map<string, SVGRectElement>>(new Map())
  const frameStatusElByIdRef = useRef<Map<string, SVGPathElement>>(new Map())
  const groupRectElByIdRef = useRef<Map<string, SVGRectElement>>(new Map())
  const groupHandleElByIdRef = useRef<Map<string, SVGGElement>>(new Map())
  const resizeOverlayElRef = useRef<SVGGElement | null>(null)

  useEffect(() => {
    if (interactionActive) return
    mediaOverlayPanRef.current = null
  }, [interactionActive])

  const pointerToWorld = useMemo(() => {
    return (ev: React.PointerEvent, svgEl: SVGSVGElement): { x: number; y: number } | null => {
      const local = readElementLocalPoint({ el: svgEl, event: ev })
      if (!local) return null
      const t = d3.zoomTransform(svgEl)
      return invertZoomPoint(t, local)
    }
  }, [])
  useZoomInitController({
    active,
    svgRef,
    gRef,
    zoomRef,
    labelsSelRef,
    viewportW: dims.width,
    viewportH: dims.height,
    localGraphData,
    localGraphDataRef,
    graphDataRevision: snapshot.graphDataRevision || 0,
    canvasRenderMode: snapshot.canvasRenderMode,
    canvas2dRenderer: snapshot.canvas2dRenderer,
    schema: snapshot.schema,
    viewportControlsPreset: snapshot.viewportControlsPreset,
    documentSemanticMode: snapshot.documentSemanticMode,
    frontmatterModeEnabled: snapshot.frontmatterModeEnabled,
    documentStructureBaselineLock: snapshot.documentStructureBaselineLock,
    renderMediaAsNodes: snapshot.renderMediaAsNodes,
    mediaPanelDensity: snapshot.mediaPanelDensity,
    collapsedGroupIds: snapshot.collapsedGroupIds,
    webpageLayoutKey,
  })
  const wireframeSettings = useMemo(() => readDesignWireframeSettings(snapshot.schema, localGraphData?.metadata || null), [localGraphData?.metadata, snapshot.schema])
  const {
    styleById,
    wireframeNodeById,
    denseRender,
    renderNodes,
    domDepthById,
    designMediaPreviewById,
  } = useDesignCanvasRenderData({
    activeWebpageLayoutGraphData,
    localGraphData,
    visibleNodes,
    positions,
    selectedNodeId: snapshot.selectedNodeId,
    selectedNodeIds: Array.isArray(snapshot.selectedNodeIds) ? snapshot.selectedNodeIds : EMPTY_STRING_ARRAY,
    designMediaOverlayNodeIdSet,
    webpageGraphNodesById,
    designGraphNodeById,
    showMediaPreview: wireframeSettings.showMediaPreview,
  })
  const labelLayoutById = useDesignCanvasLabelLayout({
    styleById,
    wireframeSettings,
    schema: snapshot.schema as GraphSchema | null,
    documentSemanticMode: (snapshot.documentSemanticMode as 'document' | 'keyword' | undefined) ?? undefined,
    renderNodes,
    positions,
    selectedNodeIds: Array.isArray(snapshot.selectedNodeIds) ? snapshot.selectedNodeIds : EMPTY_STRING_ARRAY,
    denseRender,
  })
  const { selectedIds, applyArrange } = useDesignCanvasArrangeActions({
    active: interactionActive,
    positions,
    schema: snapshot.schema,
    selectedNodeId: snapshot.selectedNodeId,
    selectedNodeIds: Array.isArray(snapshot.selectedNodeIds) ? snapshot.selectedNodeIds : EMPTY_STRING_ARRAY,
    setDesignFramePosMany,
  })

  const canvasGrid = React.useMemo(() => readCanvasGridRenderConfigFromSchema(snapshot.schema), [snapshot.schema])
  const getZoomTransform = React.useCallback(() => {
    const el = svgRef.current
    if (!el) return null
    return d3.zoomTransform(el)
  }, [])
  const getZoomEventTarget = React.useCallback(() => svgRef.current, [])
  const hasWebpageOverlay = !!(activeWebpageLayoutGraphData?.nodes && activeWebpageLayoutGraphData.nodes.length > 0)
  const {
    wireframeEdges,
    wireframeEdgeStroke,
    wireframeEdgeStrokeWidth,
    wireframeEdgesAnimated,
    wireframePreviewById,
    frameVisualById,
  } = useDesignCanvasWireframeDecor({
    styleById,
    wireframeSettings,
    localGraphData,
    positions,
    schema: snapshot.schema as GraphSchema | null,
    selectedNodeId: snapshot.selectedNodeId,
    documentUrl,
    domDepthById,
    renderNodes,
    wireframeNodeById,
    denseRender,
    hasWebpageOverlay,
  })

  const {
    dragRef: frameDragRef,
    dragPendingRef: frameDragPendingRef,
    dragRafRef: frameDragRafRef,
    handleFramePointerDown,
    handleFramePointerMove,
    handleFramePointerUp,
    handleFramePointerCancel,
  } = useFrameDragController({
    active: interactionActive,
    canvasPointerMode2d: String(snapshot.canvasPointerMode2d || ''),
    documentStructureBaselineLock: snapshot.documentStructureBaselineLock === true,
    schema: snapshot.schema,
    positions,
    visibleNodes,
    explicitGroupRectByNodeId,
    frameElByIdRef,
    svgRef,
    setDesignFramePosMany,
    activeWebpageOverlayNodeCount: activeWebpageLayoutGraphData?.nodes?.length || 0,
    frameDefaultWidth: FRAME_W,
    frameDefaultHeight: FRAME_H,
  })
  const {
    resizeRef,
    marqueeRef,
    marqueeBox,
    beginResize,
    handleSvgPointerDown,
    handleSvgPointerMove,
    handleSvgPointerUp,
    handleSvgPointerCancel,
    cancelResizeAndMarquee,
  } = useResizeMarqueeController({
    active,
    interactionActive,
    canvasPointerMode2d: String(snapshot.canvasPointerMode2d || ''),
    documentStructureBaselineLock: snapshot.documentStructureBaselineLock === true,
    viewportControlsPreset: String(snapshot.viewportControlsPreset || ''),
    schema: snapshot.schema,
    svgRef,
    positions,
    visibleNodes,
    pointerToWorld,
    frameElByIdRef,
    frameRectElByIdRef,
    frameStatusElByIdRef,
    resizeOverlayElRef,
    setDesignFramePosMany,
    setDesignFrameSizeMany,
  })
  const {
    groupResizeRef,
    beginGroupResize,
    handleSvgPointerMove: handleGroupResizePointerMove,
    handleSvgPointerUp: handleGroupResizePointerUp,
    handleSvgPointerCancel: handleGroupResizePointerCancel,
    cancelGroupResize,
  } = useGroupResizeController({
    active,
    interactionActive,
    documentStructureBaselineLock: snapshot.documentStructureBaselineLock === true,
    allowGroupResize,
    schema: snapshot.schema,
    svgRef,
    pointerToWorld,
    groupRectElByIdRef,
    groupHandleElByIdRef,
    positions,
    designGroupBoundsById,
    minBoundsSizePx: groupHandleCfg.minBoundsSizePx,
  })
  useGlobalInteractionCleanup({
    interactionActive,
    svgRef,
    frameElByIdRef,
    frameDragRef,
    frameDragPendingRef,
    frameDragRafRef,
    resizeRef,
    marqueeRef,
    cancelResizeAndMarquee,
    groupResizeRef,
    cancelGroupResize,
    designMediaHeaderDragRef,
  })

  return (
    <section
      ref={containerRef}
      className={`${CANVAS_SURFACE_CLASS} relative h-full w-full overflow-hidden bg-[var(--kg-panel-bg)]`}
      aria-label="Design Canvas"
    >
      <DesignCanvasWebpageStatusPanel
        active={active}
        documentUrl={documentUrl}
        webpageFrontmatter={webpageFrontmatter}
        webpageWorkspacePath={webpageWorkspacePath}
        webpageLayoutStatus={webpageLayoutStatus}
        webpageStatusStore={webpageStatusStore}
        onDecreaseFidelity={decreaseWebpageFidelity}
        onIncreaseFidelity={increaseWebpageFidelity}
        onRetry={retryWebpageLayout}
      />
      <DesignCanvasArrangeActionBar active={interactionActive} selectedCount={selectedIds.length} onAction={applyArrange} />
      <InfiniteGridCanvasOverlay
        enabled={canvasGrid?.enabled === true}
        gridSize={canvasGrid?.size || 10}
        anchor={canvasGrid?.anchor}
        lockToBaseStep={canvasGrid?.lockToBaseStep}
        variant={canvasGrid?.variant}
        majorEvery={canvasGrid?.majorEvery}
        dotRadiusPx={canvasGrid?.dotRadiusPx}
        minorAlpha={canvasGrid?.minorAlpha}
        majorAlpha={canvasGrid?.majorAlpha}
        minorWidthPx={canvasGrid?.minorWidthPx}
        majorWidthPx={canvasGrid?.majorWidthPx}
        minorStroke={canvasGrid?.minorStroke}
        majorStroke={canvasGrid?.majorStroke}
        width={dims.width}
        height={dims.height}
        dpr={dims.dpr}
        getTransform={getZoomTransform}
        getEventTarget={getZoomEventTarget}
      />
      <svg
        ref={svgRef}
        className={`${CANVAS_INTERACTIVE_CLASS} block h-full w-full select-none`}
        role="img"
        aria-label="Design renderer"
        onPointerDown={e => {
          handleSvgPointerDown(e)
        }}
        onPointerMove={e => {
          if (handleGroupResizePointerMove(e)) return
          handleSvgPointerMove(e)
        }}
        onPointerUp={e => {
          if (handleGroupResizePointerUp(e)) return
          handleSvgPointerUp(e)
        }}
        onPointerCancel={() => {
          if (handleGroupResizePointerCancel()) return
          handleSvgPointerCancel()
        }}
      >
        <defs>
          <filter id="shadow-sm" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1" />
          </filter>
          <filter id="shadow-md" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.1" />
          </filter>
        </defs>

        <g ref={gRef}>
          {designGroups.length > 0 ? (
            <g data-kg-layer="design-groups">
              {designGroups.map(g => {
                const id = String(g.id || '').trim()
                if (!id) return null
                const b = designGroupBoundsById[id]
                if (!b) return null
                const selected = String(snapshot.selectedGroupId || '').trim() === id
                const stroke = selected ? 'var(--kg-canvas-accent)' : 'var(--kg-border)'
                const strokeWidth = selected ? 2 : 1.5
                const canResize = allowGroupResize && selected
                const isHeadingGroup = g.source === 'markdownHeading' || id.startsWith('md:')
                const fill = isHeadingGroup ? (g.style?.fill || 'var(--kg-panel-bg)') : 'transparent'
                const fillOpacity = isHeadingGroup ? 0.16 : 0
                return (
                  <g key={id} data-kg-group-id={id} style={{ pointerEvents: 'all' }}>
                    <rect
                      ref={el => {
                        const map = groupRectElByIdRef.current
                        if (el) map.set(id, el)
                        else map.delete(id)
                      }}
                      data-kg-design-group-rect="1"
                      x={b.x}
                      y={b.y}
                      width={b.w}
                      height={b.h}
                      fill={fill}
                      fillOpacity={fillOpacity}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      rx={12}
                      ry={12}
                      onPointerDown={e => {
                        if (!interactionActive) return
                        if (isSpacePanHeld()) return
                        e.stopPropagation()
                        const store = useGraphStore.getState()
                        store.setSelectionSource('canvas')
                        try {
                          store.selectNode(null)
                        } catch {
                          void 0
                        }
                        store.selectGroup(id)
                      }}
                    />
                    {isHeadingGroup ? (
                      <text
                        x={b.x + 14}
                        y={b.y + 12}
                        dominantBaseline="hanging"
                        textAnchor="start"
                        fill="var(--kg-text-primary)"
                        fontSize={13}
                        fontWeight={600}
                        style={{ userSelect: 'none', pointerEvents: 'none' }}
                      >
                        {String(g.label || '').trim()}
                      </text>
                    ) : null}
                    <g
                      ref={el => {
                        const map = groupHandleElByIdRef.current
                        if (el) map.set(id, el)
                        else map.delete(id)
                      }}
                      data-kg-group-resize="br"
                      transform={`translate(${b.x + b.w},${b.y + b.h})`}
                      style={{ display: canResize ? undefined : 'none', pointerEvents: 'all', cursor: 'nwse-resize' }}
                    >
                      <circle
                        data-kg-group-resize-hit="1"
                        r={groupHandleCfg.hitRadiusPx}
                        fill="transparent"
                        stroke="transparent"
                        onPointerDown={e => {
                          beginGroupResize(e, {
                            groupId: id,
                            memberNodeIds: Array.isArray(g.memberNodeIds) ? g.memberNodeIds.map(v => String(v || '')) : [],
                            startBounds: { x: b.x, y: b.y, w: b.w, h: b.h },
                          })
                        }}
                      />
                      <circle
                        data-kg-group-resize-dot="1"
                        r={groupHandleCfg.dotRadiusPx}
                        fill="var(--kg-panel-bg)"
                        fillOpacity={0.72}
                        stroke="var(--kg-text-secondary)"
                        strokeWidth={groupHandleCfg.strokeWidthPx}
                        style={{ pointerEvents: 'none' }}
                      />
                    </g>
                  </g>
                )
              })}
            </g>
          ) : null}
          {styleById && wireframeEdges.length > 0 ? (
            <g data-kg-layer="wireframe-edges" style={{ pointerEvents: 'none' }}>
              {wireframeEdges.map(e => (
                <path
                  key={e.id}
                  d={e.d}
                  stroke={wireframeEdgeStroke}
                  strokeWidth={wireframeEdgeStrokeWidth}
                  opacity={e.opacity}
                  strokeDasharray={wireframeEdgesAnimated ? '7 5' : undefined}
                  style={wireframeEdgesAnimated ? { animation: 'kg-edge-dash-flow 1.25s linear infinite' } : undefined}
                  fill="none"
                />
              ))}
            </g>
          ) : null}

          <DesignCanvasFrameShellLayer
            renderNodes={renderNodes}
            positions={positions}
            panelOnlyNodeIdSet={panelOnlyNodeIdSet}
            frameVisualById={frameVisualById}
            renderMediaAsNodes={snapshot.renderMediaAsNodes === true || Boolean(styleById)}
            inlineMediaPreviewById={designMediaPreviewById}
            forwardWheelTo={() => svgRef.current}
            onOverlayPanStart={({ pointerId, buttons }) => {
              if ((buttons & 1) !== 1 && (buttons & 4) !== 4) return
              startDesignMediaOverlayPan({ pointerId })
            }}
            onOverlayPan={({ pointerId, dx, dy }) => moveDesignMediaOverlayPan({ pointerId, dx, dy })}
            onOverlayPanEnd={({ pointerId }) => endDesignMediaOverlayPan({ pointerId })}
            registerFrameEl={(id, el) => {
              const map = frameElByIdRef.current
              if (el) map.set(id, el)
              else map.delete(id)
            }}
            registerFrameRectEl={(id, el) => {
              const map = frameRectElByIdRef.current
              if (el) map.set(id, el)
              else map.delete(id)
            }}
            registerFrameStatusEl={(id, el) => {
              const map = frameStatusElByIdRef.current
              if (el) map.set(id, el)
              else map.delete(id)
            }}
            onFramePointerDown={handleFramePointerDown}
            onFramePointerMove={handleFramePointerMove}
            onFramePointerUp={handleFramePointerUp}
            onFramePointerCancel={handleFramePointerCancel}
          />

          <DesignCanvasWireframePreviewLayer
            enabled={Boolean(styleById) && snapshot.renderMediaAsNodes !== true}
            renderNodes={renderNodes}
            positions={positions}
            panelOnlyNodeIdSet={panelOnlyNodeIdSet}
            wireframePreviewById={wireframePreviewById}
            forwardWheelTo={() => svgRef.current}
            onOverlayPanStart={({ pointerId, buttons }) => {
              if ((buttons & 1) !== 1 && (buttons & 4) !== 4) return
              startDesignMediaOverlayPan({ pointerId })
            }}
            onOverlayPan={({ pointerId, dx, dy }) => moveDesignMediaOverlayPan({ pointerId, dx, dy })}
            onOverlayPanEnd={({ pointerId }) => endDesignMediaOverlayPan({ pointerId })}
          />

          <DesignCanvasLabelBadgesLayer
            enabled={Boolean(styleById)}
            renderNodes={renderNodes}
            positions={positions}
            panelOnlyNodeIdSet={panelOnlyNodeIdSet}
            labelLayoutById={labelLayoutById}
          />

          <DesignCanvasSelectionOverlay
            active={active}
            selectedNodeId={snapshot.selectedNodeId}
            positions={positions}
            marqueeBox={marqueeBox}
            resizeOverlayRef={resizeOverlayElRef}
            onBeginResize={beginResize}
          />
        </g>
      </svg>
      <MarkdownDesignOverlay
        enabled={workspaceEditorOverlayEnabled}
        svgRef={svgRef}
        markdownDocumentName={snapshot.markdownDocumentName}
        markdownDocumentText={snapshot.markdownDocumentText}
        allowedKinds={markdownPanelAllowedKinds}
        stopEvent={stopOverlayEvent}
      />
      <DesignCanvasMediaOverlay
        active={active}
        designMediaOverlayNodes={designMediaOverlayNodes}
        onRegisterOverlayEl={(id, el) => {
          if (!el) {
            designMediaOverlayElsRef.current.delete(id)
            return
          }
          designMediaOverlayElsRef.current.set(id, el)
        }}
        forwardWheelTo={() => svgRef.current}
        shouldStartHeaderDrag={() => {
          if (isSpacePanHeld()) return false
          if (snapshot.canvasPointerMode2d === 'pan') return false
          return true
        }}
        onOverlayPanStart={({ pointerId, buttons }) => {
          if ((buttons & 1) !== 1 && (buttons & 4) !== 4) return
          startDesignMediaOverlayPan({ pointerId })
        }}
        onOverlayPan={({ pointerId, dx, dy }) => moveDesignMediaOverlayPan({ pointerId, dx, dy })}
        onOverlayPanEnd={({ pointerId }) => endDesignMediaOverlayPan({ pointerId })}
        onHeaderDragStart={({ nodeId, pointerId }) => {
          const p = positions[nodeId]
          if (!p) return
          const svgEl = svgRef.current
          if (!svgEl) return
          const t = d3.zoomTransform(svgEl)
          const k = typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0 ? t.k : 1
          const schema = ((snapshot as unknown as { schema?: unknown }).schema || (useGraphStore.getState() as unknown as { schema?: unknown }).schema) as
            | GraphSchema
            | null
          designMediaHeaderDragRef.current = { id: nodeId, pointerId, startX: p.x, startY: p.y, startK: k, lastDx: 0, lastDy: 0, schema }
        }}
        onHeaderDrag={({ nodeId, dx, dy, pointerId }) => {
          const st = designMediaHeaderDragRef.current
          if (!st || st.id !== nodeId || st.pointerId !== pointerId) return
          st.lastDx = dx
          st.lastDy = dy
          if (!st.schema) {
            const k = Number.isFinite(st.startK) && st.startK > 0 ? st.startK : 1
            setDesignFramePosMany({ [nodeId]: { x: st.startX + dx / k, y: st.startY + dy / k } })
            return
          }
          const p = computeOverlayDraggedPoint2d({
            baseX: st.startX,
            baseY: st.startY,
            dxClientPx: dx,
            dyClientPx: dy,
            zoomK: st.startK,
            schema: st.schema,
            snapToGrid: false,
          })
          setDesignFramePosMany({ [nodeId]: { x: p.x, y: p.y } })
        }}
        onHeaderDragEnd={({ nodeId, pointerId }) => {
          const st = designMediaHeaderDragRef.current
          if (!st || st.id !== nodeId || st.pointerId !== pointerId) return
          if (st.schema) {
            try {
              const p = computeOverlayDraggedPoint2d({
                baseX: st.startX,
                baseY: st.startY,
                dxClientPx: st.lastDx,
                dyClientPx: st.lastDy,
                zoomK: st.startK,
                schema: st.schema,
                snapToGrid: true,
              })
              setDesignFramePosMany({ [nodeId]: { x: p.x, y: p.y } })
            } catch {
              void 0
            }
          }
          designMediaHeaderDragRef.current = null
        }}
      />
    </section>
  )
}
