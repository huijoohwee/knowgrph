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
import { useGroupResizeController } from '@/components/DesignCanvas/useGroupResizeController'
import { useGlobalInteractionCleanup } from '@/components/DesignCanvas/useGlobalInteractionCleanup'
import { useResizeMarqueeController } from '@/components/DesignCanvas/useResizeMarqueeController'
import { useZoomInitController } from '@/components/DesignCanvas/useZoomInitController'
import { DesignCanvasWebpageStatusPanel } from '@/components/DesignCanvas/webpageStatusPanel'
import { useDesignCanvasWebpageWireframe } from '@/components/DesignCanvas/webpageWireframe'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { DesignFramePos, DesignFrameSize } from '@/hooks/store/designRendererSlice'
import { useContainerDims } from '@/hooks/useContainerDims'
import { CANVAS_INTERACTIVE_CLASS, CANVAS_SURFACE_CLASS } from '@/lib/canvas/surface'
import { InfiniteGridCanvasOverlay } from '@/components/InfiniteGridCanvasOverlay'
import { readCanvasGridRenderConfigFromSchema } from '@/lib/canvas/canvasGridConfig'
import { invertZoomPoint } from '@/lib/canvas/viewport-transform'
import { readElementLocalPoint } from '@/lib/canvas/canvas-event-coords'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'
import { computeOverlayDraggedPoint2d, computeOverlayPanTransform2d } from '@/lib/canvas/overlayInteractions2d'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import { hashText } from '@/features/parsers/hash'

import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { estimateLabelCharWidthPx, estimateMaxCharsForWidthPx, truncateTextWithEllipsis, wrapTextByMaxChars } from '@/lib/ui/text/labelText'
import { relaxAabbLabels, type AabbLabelParticle } from '@/lib/ui/labels/relaxAabbLabels'
import { readDesignWireframeSettings } from '@/lib/render/designWireframeSettings'
import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'
import { buildMarkdownTokensKey, lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { deriveMarkdownDesignLayout } from '@/features/markdown-edgeless/markdownDesignLayout'
import { looksLikeSingleTagBlock } from 'grph-shared/markdown/mediaHtml'
import { buildViewportSvgMarkupFromElement } from '@/lib/graph/svgSnapshot'
import { readLabelPresentation2d } from '@/lib/canvas/labelPresentation2d'
import { resolveActiveDocumentViewMode } from '@/lib/graph/documentViewMode'
import { applyMediaProxySrc, resolveUrlAgainstBase } from '@/lib/url'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import { readAllowGroupResize } from '@/lib/canvas/groupResizePolicy'
import { readGroupResizeHandleConfig } from '@/lib/canvas/groupResizeHandleConfig'
import type { DesignLayerState } from '@/features/design/designLayersState'

const EMPTY_STRING_ARRAY: string[] = []
const EMPTY_DESIGN_LAYER_STATE: DesignLayerState = { order: [], hiddenById: {} }
const EMPTY_DESIGN_FRAME_POS_BY_ID: Record<string, DesignFramePos> = {}
const EMPTY_DESIGN_FRAME_SIZE_BY_ID: Record<string, DesignFrameSize> = {}
import { buildDeepestGroupRectByNodeId, buildGroupRectByIdFromSchemaOverrides } from '@/lib/canvas/groupExplicitBounds'
import type { RectBounds } from '@/lib/canvas/groupContainment'
import { listDisplayRichMediaOverlayNodes, normalizeRichMediaPanelDensity } from '@/lib/render/richMediaSsot'
import { readNodeCenterWorld2d } from '@/lib/render/mediaAnchor'
import { startMediaOverlayLayoutLoop2d } from '@/lib/render/mediaOverlayLayoutLoop2d'
import { MarkdownDesignOverlay } from '@/features/markdown-edgeless/MarkdownDesignOverlay'
import {
  buildEdgePathD,
  ensureEdgeAnimationStyleElement,
  readEdgePathCurveOptions,
  readGlobalEdgeAnimationEnabled,
  readGlobalEdgeColor,
  readGlobalEdgeThicknessPx,
  readGlobalEdgeType,
} from '@/lib/graph/edgeTypes'

type FrameNode = {
  id: string
  label: string
  type?: string
}

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
  const activeRenderGraphData = useActiveGraphRenderData(active)

  const deferredMarkdownText = React.useDeferredValue(String(snapshot.markdownDocumentText || ''))
  const markdownPanelLineRanges = useMemo(() => {
    const markdownText = String(deferredMarkdownText || '')
    if (!markdownText.trim()) return null
    const activeDocumentPath = String(snapshot.markdownDocumentName || '').trim() || 'markdown'
    const markdownTokensKey = buildMarkdownTokensKey(markdownText)
    const lexed = lexMarkdown(markdownText)
    const layout = deriveMarkdownDesignLayout({ activeDocumentPath, markdownTokensKey, tokens: lexed.tokens as never })
    const table = new Set<number>()
    const code = new Set<number>()
    const blockquote = new Set<number>()
    const iframe = new Set<number>()
    for (let i = 0; i < layout.blocks.length; i += 1) {
      const b = layout.blocks[i]!
      const start = Math.max(1, Math.floor(Number(b.startLine) || 1))
      if (b.type === 'table') table.add(start)
      else if (b.type === 'code') code.add(start)
      else if (b.type === 'blockquote' || b.type === 'callout') blockquote.add(start)
      else if (b.type === 'html') {
        const raw = String(b.preview.kind === 'html' ? (b.preview.html?.raw || '') : '').trim()
        if (/<\s*iframe\b/i.test(raw)) iframe.add(start)
      }
    }
    return { table, code, blockquote, iframe }
  }, [deferredMarkdownText, snapshot.markdownDocumentName])

  const markdownPanelAllowedKinds = useMemo(() => {
    const activeDocumentViewMode = resolveActiveDocumentViewMode({
      frontmatterModeEnabled: snapshot.frontmatterModeEnabled === true,
      multiDimTableModeEnabled: snapshot.multiDimTableModeEnabled === true,
      documentSemanticMode: String(snapshot.documentSemanticMode || 'document'),
      documentStructureBaselineLock: snapshot.documentStructureBaselineLock === true,
    })
    if (activeDocumentViewMode === 'multiDimTable') return ['code', 'blockquote', 'callout', 'html'] as const
    return ['table', 'code', 'blockquote', 'callout', 'html'] as const
  }, [
    snapshot.documentSemanticMode,
    snapshot.documentStructureBaselineLock,
    snapshot.frontmatterModeEnabled,
    snapshot.multiDimTableModeEnabled,
  ])

  const designGraphDataForDisplay = useMemo(() => {
    const g = (activeRenderGraphData || snapshot.graphData) as GraphData | null
    if (!g) return null
    return deriveSceneDisplayGraph({ graphData: g })?.displayGraphData || g
  }, [activeRenderGraphData, snapshot.graphData])
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
  } = useDesignCanvasWebpageWireframe({
    active,
    graphData: snapshot.graphData as GraphData | null,
    activeRenderGraphData: activeRenderGraphData as GraphData | null,
    designWireframeCacheEpoch: snapshot.designWireframeCacheEpoch,
    documentSemanticMode: String(snapshot.documentSemanticMode || 'document'),
    frontmatterModeEnabled: snapshot.frontmatterModeEnabled === true,
    markdownDocumentName: snapshot.markdownDocumentName,
    markdownDocumentText: snapshot.markdownDocumentText,
    setDesignRendererWebpageGraph: snapshot.setDesignRendererWebpageGraph,
  })

  const baseFrameNodes = useMemo(() => {
    if (activeWebpageLayoutGraphData?.nodes && activeWebpageLayoutGraphData.nodes.length > 0) {
      const out: FrameNode[] = []
      for (let i = 0; i < activeWebpageLayoutGraphData.nodes.length; i += 1) {
        const n = activeWebpageLayoutGraphData.nodes[i] as GraphNode
        const props = (n.properties || {}) as Record<string, unknown>
        const tag = typeof props['dom:tag'] === 'string' ? String(props['dom:tag'] || '').trim() : ''
        const domClass = typeof props['dom:attrs:class'] === 'string' ? String(props['dom:attrs:class'] || '').trim() : ''
        const isSynthSection = tag.toUpperCase() === 'SECTION' && domClass.includes('kg-synth-section')
        const id = String(n.id || '').trim()
        if (!id) continue
        if (isSynthSection) continue
        const visualLabel = typeof props['visual:label'] === 'string' ? String(props['visual:label'] || '').trim() : ''
        const label = visualLabel || String(n.label || n.id || '').trim() || id
        out.push({ id, label, ...(tag ? { type: tag } : {}) })
      }
      return out
    }
    if (documentUrl) {
      if (webpageLayoutStatus === 'loading') return [{ id: 'kg:webpage:loading', label: 'Loading webpage wireframe…', type: 'Webpage' }]
      if (webpageLayoutStatus === 'error') return [{ id: 'kg:webpage:error', label: 'Webpage export failed — click Retry', type: 'Webpage' }]
      return [{ id: 'kg:webpage:idle', label: 'Preparing webpage wireframe…', type: 'Webpage' }]
    }
    if (designGraphDataForDisplay?.nodes && designGraphDataForDisplay.nodes.length > 0) {
      const out: FrameNode[] = []
      for (let i = 0; i < designGraphDataForDisplay.nodes.length; i += 1) {
        const n = designGraphDataForDisplay.nodes[i] as GraphNode
        const id = String(n.id || '').trim()
        if (!id) continue
        const props = (n.properties || {}) as Record<string, unknown>
        const visualLabel = typeof props['visual:label'] === 'string' ? String(props['visual:label'] || '').trim() : ''
        const label = visualLabel || String(n.label || id).trim() || id
        out.push({ id, label, ...(n.type ? { type: String(n.type) } : {}) })
      }
      return out
    }
    return []
  }, [activeWebpageLayoutGraphData, designGraphDataForDisplay?.nodes, documentUrl, webpageLayoutStatus])

  const FRAME_W = 320
  const FRAME_H = 240

  const sortedNodes = useMemo(() => {
    const order = Array.isArray(snapshot.designLayerState?.order) ? snapshot.designLayerState!.order : []
    if (order.length === 0) return baseFrameNodes
    const byId = new Map(baseFrameNodes.map(n => [n.id, n] as const))
    const used = new Set<string>()
    const out: FrameNode[] = []
    for (let i = 0; i < order.length; i += 1) {
      const id = String(order[i] || '').trim()
      if (!id) continue
      const n = byId.get(id)
      if (!n) continue
      if (used.has(id)) continue
      used.add(id)
      out.push(n)
    }
    for (let i = 0; i < baseFrameNodes.length; i += 1) {
      const n = baseFrameNodes[i]
      if (used.has(n.id)) continue
      out.push(n)
    }
    return out
  }, [baseFrameNodes, snapshot.designLayerState])

  const visibleNodes = useMemo(() => {
    const hidden = snapshot.designLayerState?.hiddenById || {}
    return sortedNodes.filter(n => hidden[n.id] !== true)
  }, [snapshot.designLayerState?.hiddenById, sortedNodes])

  const layersPanelNodes = useMemo(() => {
    const out = baseFrameNodes.slice()
    out.sort((a, b) => (a.label || a.id).localeCompare(b.label || b.id) || a.id.localeCompare(b.id))
    return out
  }, [baseFrameNodes])

  useEffect(() => {
    if (!active) {
      snapshot.setDesignRendererNodes([])
      return
    }
    snapshot.setDesignRendererNodes(layersPanelNodes)
  }, [active, layersPanelNodes, snapshot.setDesignRendererNodes])

  const designGraphNodeById = useMemo(() => {
    const nodes = Array.isArray(designGraphDataForDisplay?.nodes) ? (designGraphDataForDisplay!.nodes as GraphNode[]) : []
    const map = new Map<string, GraphNode>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const id = String(n?.id || '').trim()
      if (!id) continue
      if (!map.has(id)) map.set(id, n)
    }
    return map
  }, [designGraphDataForDisplay?.nodes])

  const positions = useMemo(() => {
    const overrides = snapshot.designFramePosById || {}
    const sizeOverrides = snapshot.designFrameSizeById || {}
    const out: Record<string, { x: number; y: number; w: number; h: number }> = {}
    if (activeWebpageLayoutGraphData?.nodes && activeWebpageLayoutGraphData.nodes.length > 0) {
      const byId = new Map<string, GraphNode>()
      for (let i = 0; i < activeWebpageLayoutGraphData.nodes.length; i += 1) {
        const n = activeWebpageLayoutGraphData.nodes[i] as GraphNode
        byId.set(String(n.id), n)
      }
      for (let i = 0; i < visibleNodes.length; i += 1) {
        const n = visibleNodes[i]
        const base = byId.get(n.id)
        if (!base) continue
        const props = (base.properties || {}) as Record<string, unknown>
        const w0 = typeof props['visual:width'] === 'number' ? (props['visual:width'] as number) : FRAME_W
        const h0 = typeof props['visual:height'] === 'number' ? (props['visual:height'] as number) : FRAME_H
        const so = sizeOverrides[n.id]
        const w = so && Number.isFinite(so.w) ? Math.max(24, so.w) : w0
        const h = so && Number.isFinite(so.h) ? Math.max(18, so.h) : h0
        const cx = typeof base.x === 'number' && Number.isFinite(base.x) ? base.x : 0
        const cy = typeof base.y === 'number' && Number.isFinite(base.y) ? base.y : 0
        const basePos = { x: cx - w / 2, y: cy - h / 2, w, h }
        const o = overrides[n.id]
        if (o && Number.isFinite(o.x) && Number.isFinite(o.y)) out[n.id] = { x: o.x, y: o.y, w: basePos.w, h: basePos.h }
        else out[n.id] = basePos
      }
      return out
    }
    if (documentUrl && visibleNodes.length > 0) {
      const w0 = Math.max(360, Math.min(920, Math.floor(dims.width * 0.72)))
      const h0 = Math.max(220, Math.min(640, Math.floor(dims.height * 0.5)))
      for (let i = 0; i < visibleNodes.length; i += 1) {
        const n = visibleNodes[i]
        const so = sizeOverrides[n.id]
        const w = so && Number.isFinite(so.w) ? Math.max(24, so.w) : w0
        const h = so && Number.isFinite(so.h) ? Math.max(18, so.h) : h0
        const basePos = { x: -w / 2, y: -h / 2, w, h }
        const o = overrides[n.id]
        if (o && Number.isFinite(o.x) && Number.isFinite(o.y)) out[n.id] = { x: o.x, y: o.y, w: basePos.w, h: basePos.h }
        else out[n.id] = basePos
      }
      return out
    }
    if (visibleNodes.length > 0) {
      const byId = designGraphNodeById
      for (let i = 0; i < visibleNodes.length; i += 1) {
        const n = visibleNodes[i]
        const base = byId.get(n.id)
        if (!base) continue
        const props = (base.properties || {}) as Record<string, unknown>
        const w0 = typeof props['visual:width'] === 'number' ? (props['visual:width'] as number) : FRAME_W
        const h0 = typeof props['visual:height'] === 'number' ? (props['visual:height'] as number) : FRAME_H
        const so = sizeOverrides[n.id]
        const w = so && Number.isFinite(so.w) ? Math.max(24, so.w) : w0
        const h = so && Number.isFinite(so.h) ? Math.max(18, so.h) : h0
        const cx = typeof base.x === 'number' && Number.isFinite(base.x) ? base.x : 0
        const cy = typeof base.y === 'number' && Number.isFinite(base.y) ? base.y : 0
        const basePos = { x: cx - w / 2, y: cy - h / 2, w, h }
        const o = overrides[n.id]
        if (o && Number.isFinite(o.x) && Number.isFinite(o.y)) out[n.id] = { x: o.x, y: o.y, w: basePos.w, h: basePos.h }
        else out[n.id] = basePos
      }
      return out
    }
    return out
  }, [activeWebpageLayoutGraphData, designGraphNodeById, dims.height, dims.width, documentUrl, snapshot.designFramePosById, snapshot.designFrameSizeById, visibleNodes])

  const localGraphData: GraphData = useMemo(() => {
    if (activeWebpageLayoutGraphData?.nodes && activeWebpageLayoutGraphData.nodes.length > 0) {
      const byId = new Map<string, GraphNode>()
      for (let i = 0; i < activeWebpageLayoutGraphData.nodes.length; i += 1) {
        const n = activeWebpageLayoutGraphData.nodes[i] as GraphNode
        byId.set(String(n.id), n)
      }
      return {
        type: 'Graph',
        context: activeWebpageLayoutGraphData.context,
        nodes: visibleNodes.map(n => {
          const base = byId.get(n.id)
          const p = positions[n.id]
          if (!base || !p) return { id: n.id, label: n.label, type: 'Frame', properties: {}, x: 0, y: 0 }
          const props = (base.properties || {}) as Record<string, unknown>
          const width = typeof props['visual:width'] === 'number' ? (props['visual:width'] as number) : p.w
          const height = typeof props['visual:height'] === 'number' ? (props['visual:height'] as number) : p.h
          return {
            ...base,
            properties: {
              ...props,
              'visual:width': width,
              'visual:height': height,
              'visual:shape': 'rect',
            },
            x: p.x + p.w / 2,
            y: p.y + p.h / 2,
          }
        }),
        edges: [],
        metadata: activeWebpageLayoutGraphData.metadata,
      }
    }
    const fallbackNodes = Array.isArray(designGraphDataForDisplay?.nodes) ? (designGraphDataForDisplay.nodes as GraphNode[]) : []
    const fallbackEdges = Array.isArray(designGraphDataForDisplay?.edges) ? (designGraphDataForDisplay.edges as GraphEdge[]) : []
    const visibleNodeIdSet = new Set(visibleNodes.map(n => String(n.id || '').trim()).filter(Boolean))
    const nodes = fallbackNodes
      .filter(n => visibleNodeIdSet.has(String(n?.id || '').trim()))
      .map(n => {
        const id = String(n?.id || '').trim()
        const p = positions[id]
        if (!p) return n
        const props = (n.properties || {}) as Record<string, unknown>
        return {
          ...n,
          properties: {
            ...props,
            'visual:width': typeof props['visual:width'] === 'number' ? props['visual:width'] : p.w,
            'visual:height': typeof props['visual:height'] === 'number' ? props['visual:height'] : p.h,
          },
          x: p.x + p.w / 2,
          y: p.y + p.h / 2,
        }
      })
    const nodeIdSet = new Set(nodes.map(n => String(n?.id || '').trim()).filter(Boolean))
    const edges = fallbackEdges.filter(e => nodeIdSet.has(String(e?.source || '').trim()) && nodeIdSet.has(String(e?.target || '').trim()))
    return {
      type: 'Graph',
      context: designGraphDataForDisplay?.context,
      nodes,
      edges,
      metadata: designGraphDataForDisplay?.metadata || snapshot.graphData?.metadata,
    }
  }, [activeWebpageLayoutGraphData, designGraphDataForDisplay, positions, snapshot.graphData?.metadata, visibleNodes])

  const panelOnlyNodeIdSet = useMemo(() => {
    if (!active) return null
    if (!markdownPanelLineRanges) return null
    const nodes = Array.isArray(localGraphData?.nodes) ? (localGraphData.nodes as GraphNode[]) : []
    if (nodes.length === 0) return null
    const ids = new Set<string>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]!
      const id = String(n?.id || '').trim()
      if (!id) continue
      const typeLower = String(n.type || '').trim().toLowerCase()
      if (typeLower === 'table' || typeLower === 'codeblock') {
        ids.add(id)
        continue
      }
      if (typeLower === 'paragraph') {
        const propsObj = n.properties && typeof n.properties === 'object' && !Array.isArray(n.properties) ? (n.properties as Record<string, unknown>) : null
        const text = propsObj && typeof propsObj.text === 'string' ? String(propsObj.text || '').trim() : ''
        if (propsObj && propsObj.calloutType === true) {
          ids.add(id)
          continue
        }
        if (text.startsWith('>')) {
          ids.add(id)
          continue
        }
        if (text && /<\s*iframe\b/i.test(text) && text.toLowerCase().startsWith('<iframe') && looksLikeSingleTagBlock(text, 'iframe')) {
          ids.add(id)
          continue
        }
      }
      const meta = n.metadata && typeof n.metadata === 'object' && !Array.isArray(n.metadata) ? (n.metadata as Record<string, unknown>) : null
      const lineStartRaw = meta ? meta.lineStart : null
      const lineStart = typeof lineStartRaw === 'number' ? lineStartRaw : typeof lineStartRaw === 'string' ? Number(lineStartRaw) : NaN
      if (!Number.isFinite(lineStart)) continue
      const start = Math.max(1, Math.floor(lineStart))
      if (typeLower === 'table' && markdownPanelLineRanges.table.has(start)) ids.add(id)
      else if (typeLower === 'codeblock' && markdownPanelLineRanges.code.has(start)) ids.add(id)
      else if (typeLower === 'paragraph' && markdownPanelLineRanges.blockquote.has(start)) ids.add(id)
      else {
        const spec = getNodeMediaSpec(n)
        if (spec?.kind === 'iframe' && markdownPanelLineRanges.iframe.has(start)) ids.add(id)
      }
    }
    return ids.size > 0 ? ids : null
  }, [active, localGraphData, markdownPanelLineRanges])

  const localGraphDataRef = useRef<GraphData>(localGraphData)
  useEffect(() => {
    localGraphDataRef.current = localGraphData
  }, [localGraphData])

  const designGroups = useMemo(() => {
    const g = snapshot.graphData
    if (!g) return []
    const activeDocumentViewMode = resolveActiveDocumentViewMode({
      frontmatterModeEnabled: snapshot.frontmatterModeEnabled === true,
      multiDimTableModeEnabled: snapshot.multiDimTableModeEnabled === true,
      documentSemanticMode: String(snapshot.documentSemanticMode || 'document'),
      documentStructureBaselineLock: snapshot.documentStructureBaselineLock === true,
    })
    return deriveGraphGroups(g, { forceDocumentStructure: activeDocumentViewMode === 'documentStructure' })
  }, [
    snapshot.documentSemanticMode,
    snapshot.documentStructureBaselineLock,
    snapshot.frontmatterModeEnabled,
    snapshot.graphData,
    snapshot.multiDimTableModeEnabled,
  ])
  const allowGroupResize = readAllowGroupResize(snapshot.schema as GraphSchema | null)
  const groupHandleCfg = readGroupResizeHandleConfig(snapshot.schema as GraphSchema | null)

  const explicitGroupRectById = useMemo(() => {
    const schema = snapshot.schema as GraphSchema | null
    const nodes = Array.isArray(localGraphData?.nodes) ? (localGraphData.nodes as GraphNode[]) : []
    if (!schema || nodes.length === 0 || designGroups.length === 0) return new Map<string, RectBounds>()
    return buildGroupRectByIdFromSchemaOverrides({ groups: designGroups as any, graphNodes: nodes, schema })
  }, [designGroups, localGraphData?.nodes, snapshot.schema])

  const explicitGroupRectByNodeId = useMemo(() => {
    if (designGroups.length === 0 || explicitGroupRectById.size === 0) return new Map<string, RectBounds>()
    return buildDeepestGroupRectByNodeId({ groups: designGroups as any, groupRectById: explicitGroupRectById })
  }, [designGroups, explicitGroupRectById])

  const designGroupBoundsById = useMemo(() => {
    const schema = snapshot.schema as GraphSchema | null
    const cfg = schema?.layout?.groups as unknown as { padding?: unknown } | null
    const padding = typeof cfg?.padding === 'number' && Number.isFinite(cfg.padding) ? Math.max(0, cfg.padding) : 24
    const out: Record<string, { x: number; y: number; w: number; h: number; explicit: boolean }> = {}
    for (let i = 0; i < designGroups.length; i += 1) {
      const g = designGroups[i]
      const id = String(g.id || '').trim()
      if (!id) continue
      const explicit = explicitGroupRectById.get(id) || null
      if (explicit) {
        out[id] = { x: explicit.x, y: explicit.y, w: explicit.width, h: explicit.height, explicit: true }
        continue
      }
      const members = Array.isArray(g.memberNodeIds) ? g.memberNodeIds : []
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      let valid = 0
      for (let j = 0; j < members.length; j += 1) {
        const nodeId = String(members[j] || '').trim()
        if (!nodeId) continue
        const p = positions[nodeId]
        if (!p) continue
        const x0 = p.x
        const y0 = p.y
        const x1 = p.x + p.w
        const y1 = p.y + p.h
        if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) continue
        if (x0 < minX) minX = x0
        if (y0 < minY) minY = y0
        if (x1 > maxX) maxX = x1
        if (y1 > maxY) maxY = y1
        valid += 1
      }
      if (!valid || minX === Infinity) continue
      const x = minX - padding
      const y = minY - padding
      const w = Math.max(1, maxX - minX + padding * 2)
      const h = Math.max(1, maxY - minY + padding * 2)
      out[id] = { x, y, w, h, explicit: false }
    }
    return out
  }, [designGroups, explicitGroupRectById, positions, snapshot.schema])

  const designMediaOverlayNodes = useMemo(() => {
    const nodes = Array.isArray(localGraphData?.nodes) ? (localGraphData.nodes as GraphNode[]) : []
    const poolMaxRaw =
      typeof snapshot.threeIframeOverlayPoolMax === 'number' && Number.isFinite(snapshot.threeIframeOverlayPoolMax) ? snapshot.threeIframeOverlayPoolMax : 0
    const poolMax = poolMaxRaw > 0 ? poolMaxRaw : 24
    return listDisplayRichMediaOverlayNodes({
      renderMediaAsNodes: snapshot.renderMediaAsNodes,
      nodes,
      poolMax,
    })
  }, [localGraphData, snapshot.renderMediaAsNodes, snapshot.threeIframeOverlayPoolMax])

  const designMediaOverlayNodeIdSet = useMemo(() => {
    const ids = new Set<string>()
    for (let i = 0; i < designMediaOverlayNodes.length; i += 1) {
      const id = String(designMediaOverlayNodes[i]?.id || '').trim()
      if (id) ids.add(id)
    }
    return ids
  }, [designMediaOverlayNodes])

  const designMediaOverlayElsRef = useRef<Map<string, HTMLElement>>(new Map())
  const designMediaOverlayNodeByIdRef = useRef<{ graph: unknown | null; map: Map<string, GraphNode> }>({ graph: null, map: new Map() })
  const designMediaOverlayNodeIdsKey = useMemo(() => designMediaOverlayNodes.map(n => n.id).join('|'), [designMediaOverlayNodes])
  useEffect(() => {
    const next = new Map<string, HTMLElement>()
    for (const n of designMediaOverlayNodes) {
      const existing = designMediaOverlayElsRef.current.get(n.id)
      if (existing) next.set(n.id, existing)
    }
    designMediaOverlayElsRef.current = next
  }, [designMediaOverlayNodeIdsKey, designMediaOverlayNodes])

  const designMediaHeaderDragRef = useRef<null | { id: string; pointerId: number; startX: number; startY: number; startK: number; lastDx: number; lastDy: number; schema: GraphSchema | null }>(null)

  useEffect(() => {
    if (!active) return
    if (designMediaOverlayNodes.length === 0) return
    const density = normalizeRichMediaPanelDensity(snapshot.mediaPanelDensity)
    const widthRatioRaw = density === 'compact' ? snapshot.threeIframeOverlayBaseWidthRatioCompact : snapshot.threeIframeOverlayBaseWidthRatioDefault
    const widthMinRaw = density === 'compact' ? snapshot.threeIframeOverlayBaseWidthMinPxCompact : snapshot.threeIframeOverlayBaseWidthMinPxDefault
    const widthMaxRaw = density === 'compact' ? snapshot.threeIframeOverlayBaseWidthMaxPxCompact : snapshot.threeIframeOverlayBaseWidthMaxPxDefault

    const loop = startMediaOverlayLayoutLoop2d({
      enabled: true,
      loop: 'always',
      items: designMediaOverlayNodes,
      density,
      viewportW: dims.width,
      viewportH: dims.height,
      readTransform: () => {
        const svgEl = svgRef.current
        if (!svgEl) return null
        return d3.zoomTransform(svgEl as unknown as SVGSVGElement)
      },
      getElementForId: (id) => designMediaOverlayElsRef.current.get(id) || null,
      getNodeWorldCenterForId: (id) => {
        const graph = localGraphDataRef.current
        if (designMediaOverlayNodeByIdRef.current.graph !== graph) {
          const nodes = Array.isArray((graph as any)?.nodes) ? ((graph as any).nodes as GraphNode[]) : []
          const map = new Map<string, GraphNode>()
          for (let i = 0; i < nodes.length; i += 1) {
            const n = nodes[i]
            const key = String(n?.id || '').trim()
            if (!key) continue
            if (!map.has(key)) map.set(key, n)
          }
          designMediaOverlayNodeByIdRef.current = { graph, map }
        }
        const n = designMediaOverlayNodeByIdRef.current.map.get(id) || null
        return readNodeCenterWorld2d(n, { coords: 'center' })
      },
      sizingConfig: {
        widthRatio: Number.isFinite(widthRatioRaw) ? Math.max(0.001, Number(widthRatioRaw)) : 0.2,
        widthMinPx: Number.isFinite(widthMinRaw) ? Math.max(1, Math.floor(widthMinRaw)) : 210,
        widthMaxPx: Number.isFinite(widthMaxRaw) ? Math.max(1, Math.floor(widthMaxRaw)) : 360,
      },
    })

    return () => loop.stop()
  }, [
    active,
    designMediaOverlayNodeIdsKey,
    designMediaOverlayNodes,
    dims.width,
    dims.height,
    snapshot.mediaPanelDensity,
    snapshot.renderMediaAsNodes,
    snapshot.threeIframeOverlayBaseWidthMaxPxCompact,
    snapshot.threeIframeOverlayBaseWidthMaxPxDefault,
    snapshot.threeIframeOverlayBaseWidthMinPxCompact,
    snapshot.threeIframeOverlayBaseWidthMinPxDefault,
    snapshot.threeIframeOverlayBaseWidthRatioCompact,
    snapshot.threeIframeOverlayBaseWidthRatioDefault,
  ])

  const lastAutoFitWireframeKeyRef = useRef<string>('')
  useEffect(() => {
    if (!active) return
    if (!documentUrl) return
    if (webpageLayoutStatus !== 'ready') return
    const svgEl = svgRef.current
    if (!svgEl) return
    const zoom = zoomRef.current
    if (!zoom) return
    const g0 = localGraphDataRef.current
    const nodes0 = Array.isArray(g0.nodes) ? (g0.nodes as GraphNode[]) : ([] as GraphNode[])
    if (nodes0.length === 0) {
      const total = Array.isArray(activeWebpageLayoutGraphData?.nodes) ? activeWebpageLayoutGraphData!.nodes.length : 0
      if (total > 0) {
        const hidden = snapshot.designLayerState?.hiddenById || {}
        let hiddenCount = 0
        for (let i = 0; i < activeWebpageLayoutGraphData!.nodes.length; i += 1) {
          const id = String((activeWebpageLayoutGraphData!.nodes[i] as GraphNode)?.id || '').trim()
          if (!id) continue
          if (hidden[id] === true) hiddenCount += 1
        }
        if (hiddenCount >= total) {
          const ids: string[] = []
          for (let i = 0; i < activeWebpageLayoutGraphData!.nodes.length; i += 1) {
            const id = String((activeWebpageLayoutGraphData!.nodes[i] as GraphNode)?.id || '').trim()
            if (id) ids.push(id)
          }
          try {
            useGraphStore.getState().setDesignLayerState({ order: ids, hiddenById: {} })
          } catch {
            void 0
          }
          setWebpageStatusUi({ message: 'All wireframe layers were hidden. Reset visibility.' })
          lastAutoFitWireframeKeyRef.current = ''
          return
        }
      }
      setWebpageLayoutStatus('error')
      const elCount = Array.isArray(webpageLayout?.elements) ? webpageLayout!.elements.length : 0
      setWebpageStatusUi({ message: `Wireframe is empty (0 nodes). elements=${elCount}, convertedNodes=${total}. Click Retry.` })
      return
    }
    const key = `${documentUrl}#${webpageLayout?.meta?.ts || 0}#${nodes0.length}`
    if (lastAutoFitWireframeKeyRef.current === key) return
    lastAutoFitWireframeKeyRef.current = key
    if (dims.width <= 80 || dims.height <= 80) return
    const mode = readLayoutMode(snapshot.schema)
    const opts = readFitAllOptions({ schema: snapshot.schema, mode, intent: 'initialFit' })
    const t = fitAllTransform(nodes0, Math.max(1, dims.width), Math.max(1, dims.height), { ...opts, graphData: g0 })
    d3.select(svgEl).call(zoom.transform as never, d3.zoomIdentity.translate(t.x, t.y).scale(t.k))
  }, [
    active,
    activeWebpageLayoutGraphData,
    dims.height,
    dims.width,
    documentUrl,
    setWebpageLayoutStatus,
    setWebpageStatusUi,
    snapshot.designLayerState?.hiddenById,
    snapshot.schema,
    webpageLayout,
    webpageLayoutStatus,
  ])

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
  const styleById = useMemo(() => {
    const sourceNodes = Array.isArray(activeWebpageLayoutGraphData?.nodes) && activeWebpageLayoutGraphData.nodes.length > 0
      ? (activeWebpageLayoutGraphData.nodes as GraphNode[])
      : Array.isArray(localGraphData?.nodes)
        ? (localGraphData.nodes as GraphNode[])
        : []
    if (sourceNodes.length === 0) return null
    const map = new Map<
      string,
      {
        fill?: string
        stroke?: string
        strokeWidth?: number
        borderRadius?: number
        opacity?: number
        kind?: string
        zIndex?: number
        stackKey?: string
        xIndex?: number
        yIndex?: number
        boxShadow?: string
        position?: string
        tag?: string
      }
    >()
    for (let i = 0; i < sourceNodes.length; i += 1) {
      const n = sourceNodes[i] as GraphNode
      const props = (n.properties || {}) as Record<string, unknown>
      const fill = typeof props['visual:fill'] === 'string' ? String(props['visual:fill'] || '').trim() : ''
      const stroke = typeof props['visual:stroke'] === 'string' ? String(props['visual:stroke'] || '').trim() : ''
      const strokeWidth = typeof props['visual:strokeWidth'] === 'number' ? (props['visual:strokeWidth'] as number) : undefined
      const borderRadius = typeof props['visual:borderRadius'] === 'number' ? (props['visual:borderRadius'] as number) : undefined
      const opacity = typeof props['visual:opacity'] === 'number' ? (props['visual:opacity'] as number) : undefined
      const kind = typeof props['dom:kind'] === 'string' ? String(props['dom:kind'] || '').trim() : ''
      const tag = typeof props['dom:tag'] === 'string' ? String(props['dom:tag'] || '').trim() : ''
      const position = typeof props['css:position'] === 'string' ? String(props['css:position'] || '').trim() : ''
      const stackKey = typeof props['css:stackKey'] === 'string' ? String(props['css:stackKey'] || '').trim() : ''
      const visualZIndex = typeof props['visual:zIndex'] === 'number' && Number.isFinite(props['visual:zIndex'] as number) ? (props['visual:zIndex'] as number) : undefined
      const zIndex = (() => {
        const raw = typeof props['css:zIndex'] === 'string' ? String(props['css:zIndex'] || '').trim() : ''
        if (!raw || raw === 'auto') return 0
        const n = Number(raw)
        return Number.isFinite(n) ? n : 0
      })()
      const xIndex = typeof props['visual:xIndex'] === 'number' && Number.isFinite(props['visual:xIndex'] as number) ? (props['visual:xIndex'] as number) : undefined
      const yIndex = typeof props['visual:yIndex'] === 'number' && Number.isFinite(props['visual:yIndex'] as number) ? (props['visual:yIndex'] as number) : undefined
      const boxShadow = typeof props['css:boxShadow'] === 'string' ? String(props['css:boxShadow'] || '').trim() : ''
      const id = String(n.id || '').trim()
      if (!id) continue
      map.set(id, {
        ...(fill ? { fill } : {}),
        ...(stroke ? { stroke } : {}),
        ...(typeof strokeWidth === 'number' && Number.isFinite(strokeWidth) ? { strokeWidth } : {}),
        ...(typeof borderRadius === 'number' && Number.isFinite(borderRadius) ? { borderRadius } : {}),
        ...(typeof opacity === 'number' && Number.isFinite(opacity) ? { opacity } : {}),
        ...(kind ? { kind } : {}),
        ...(typeof visualZIndex === 'number' ? { zIndex: visualZIndex } : Number.isFinite(zIndex) ? { zIndex } : {}),
        ...(stackKey ? { stackKey } : {}),
        ...(typeof xIndex === 'number' ? { xIndex } : {}),
        ...(typeof yIndex === 'number' ? { yIndex } : {}),
        ...(boxShadow ? { boxShadow } : {}),
        ...(position ? { position } : {}),
        ...(tag ? { tag } : {}),
      })
    }
    return map
  }, [activeWebpageLayoutGraphData?.nodes, localGraphData?.nodes])

  const wireframeNodeById = useMemo(() => {
    if (webpageGraphNodesById) return webpageGraphNodesById
    const out: Record<string, GraphNode> = {}
    const nodes = Array.isArray(localGraphData?.nodes) ? (localGraphData.nodes as GraphNode[]) : []
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const id = String(n?.id || '').trim()
      if (!id) continue
      out[id] = n
    }
    return Object.keys(out).length > 0 ? out : null
  }, [localGraphData?.nodes, webpageGraphNodesById])

  const denseRender = visibleNodes.length > 450
  const renderNodes = useMemo(() => {
    const base = designMediaOverlayNodeIdSet.size > 0 ? visibleNodes.filter(n => !designMediaOverlayNodeIdSet.has(n.id)) : visibleNodes
    if (!styleById) return base
    const kindRank = (k: string): number => {
      if (k === 'container') return 0
      if (k === 'element') return 1
      if (k === 'media') return 2
      if (k === 'interactive') return 3
      return 4
    }
    const nodes = base.slice()
    nodes.sort((a, b) => {
      const sa = styleById.get(a.id)
      const sb = styleById.get(b.id)
      const boost = (s: { position?: string; tag?: string; kind?: string } | null | undefined) => {
        const pos = String(s?.position || '').toLowerCase()
        const tag = String(s?.tag || '').toUpperCase()
        const kind = String(s?.kind || '')
        let v = 0
        if (pos === 'fixed' || pos === 'sticky') v += 1000
        if (tag === 'HEADER' || tag === 'NAV') v += 220
        if (kind === 'interactive') v += 120
        return v
      }
      const za = (sa?.zIndex ?? 0) + boost(sa)
      const zb = (sb?.zIndex ?? 0) + boost(sb)
      if (za !== zb) return za - zb
      const ska = String(sa?.stackKey || '')
      const skb = String(sb?.stackKey || '')
      if (ska && skb && ska !== skb) return ska.localeCompare(skb)
      const ka = kindRank(sa?.kind || '')
      const kb = kindRank(sb?.kind || '')
      if (ka !== kb) return ka - kb
      const ya = typeof sa?.yIndex === 'number' ? sa.yIndex : 0
      const yb = typeof sb?.yIndex === 'number' ? sb.yIndex : 0
      if (ya !== yb) return ya - yb
      const xa = typeof sa?.xIndex === 'number' ? sa.xIndex : 0
      const xb = typeof sb?.xIndex === 'number' ? sb.xIndex : 0
      if (xa !== xb) return xa - xb
      const pa = positions[a.id]
      const pb = positions[b.id]
      const aa = pa ? pa.w * pa.h : 0
      const ab = pb ? pb.w * pb.h : 0
      if (aa !== ab) return ab - aa
      return a.id.localeCompare(b.id)
    })

    const selectedId = String(snapshot.selectedNodeId || '').trim()
    const selectedIds = Array.isArray(snapshot.selectedNodeIds) ? snapshot.selectedNodeIds : []
    const selected = new Set<string>()
    if (selectedId) selected.add(selectedId)
    for (let i = 0; i < selectedIds.length; i += 1) {
      const id = String(selectedIds[i] || '').trim()
      if (id) selected.add(id)
    }

    if (nodes.length <= 700) return nodes

    const kept: FrameNode[] = []
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]!
      if (selected.has(n.id)) {
        kept.push(n)
        continue
      }
      const p = positions[n.id]
      if (!p) continue
      const s = styleById.get(n.id) || null
      const kind = String(s?.kind || '')
      const tag = String(s?.tag || '').toUpperCase()
      const pos = String(s?.position || '').toLowerCase()
      const area = p.w * p.h
      const minSide = Math.min(p.w, p.h)
      if (minSide < 4 || area < 180) continue

      const base = wireframeNodeById ? wireframeNodeById[n.id] : null
      const props = (base?.properties || {}) as Record<string, unknown>
      const hasText =
        typeof props['dom:textPreview'] === 'string'
          ? !!String(props['dom:textPreview'] || '').trim()
          : typeof props['dom:text'] === 'string'
            ? !!String(props['dom:text'] || '').trim()
            : false
      const hasHref = typeof props['dom:attrs:href'] === 'string' ? !!String(props['dom:attrs:href'] || '').trim() : false
      const hasSrc = typeof props['dom:attrs:src'] === 'string' ? !!String(props['dom:attrs:src'] || '').trim() : false
      const hasFill = !!(s?.fill && s.fill !== 'transparent')

      const isSemanticContainer =
        tag === 'HEADER' || tag === 'NAV' || tag === 'MAIN' || tag === 'FOOTER' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'ASIDE'

      if (kind === 'interactive') {
        if (p.w >= 32 && p.h >= 16) kept.push(n)
        continue
      }
      if (kind === 'media') {
        if (hasSrc || (p.w >= 48 && p.h >= 48)) kept.push(n)
        continue
      }
      if (kind === 'container') {
        if (pos === 'fixed' || pos === 'sticky') {
          kept.push(n)
          continue
        }
        if (isSemanticContainer) {
          if (area >= 2800) kept.push(n)
          continue
        }
        if (hasFill && area >= 2200) {
          kept.push(n)
          continue
        }
        if (area >= 260_000 && minSide >= 140) {
          kept.push(n)
          continue
        }
        continue
      }

      const isImportantTag =
        tag === 'H1' ||
        tag === 'H2' ||
        tag === 'H3' ||
        tag === 'BUTTON' ||
        tag === 'A' ||
        tag === 'IMG' ||
        tag === 'VIDEO' ||
        tag === 'IFRAME'
      if (isImportantTag) {
        if (area >= 600 || hasText || hasHref) kept.push(n)
        continue
      }
      if (hasText || hasHref) {
        if (p.w >= 140 && p.h >= 22) kept.push(n)
        continue
      }
      if (hasFill && area >= 6000) {
        kept.push(n)
        continue
      }
      if (area >= 16_000 && minSide >= 24) {
        kept.push(n)
        continue
      }
    }

    if (kept.length <= 1800) return kept
    const fixed: FrameNode[] = []
    const rest: Array<{ n: FrameNode; area: number }> = []
    for (let i = 0; i < kept.length; i += 1) {
      const n = kept[i]!
      if (selected.has(n.id)) fixed.push(n)
      else {
        const p = positions[n.id]
        rest.push({ n, area: p ? p.w * p.h : 0 })
      }
    }
    rest.sort((a, b) => b.area - a.area)
    const cap = Math.max(0, 1800 - fixed.length)
    return fixed.concat(rest.slice(0, cap).map(r => r.n))
  }, [positions, snapshot.selectedNodeId, snapshot.selectedNodeIds, styleById, visibleNodes, wireframeNodeById])

  const domDepthById = useMemo(() => {
    const out = new Map<string, number>()
    if (!wireframeNodeById) return out
    const ids = visibleNodes.map(n => String(n.id || '').trim()).filter(Boolean)
    const compute = (id: string): number => {
      if (!id) return 0
      if (out.has(id)) return out.get(id)!
      const seen = new Set<string>()
      let cur = id
      let d = 0
      while (d < 12) {
        if (seen.has(cur)) break
        seen.add(cur)
        const node = wireframeNodeById[cur]
        const pid = String((node?.metadata as unknown as { domParentId?: unknown })?.domParentId || '').trim()
        if (!pid) break
        d += 1
        cur = pid
      }
      out.set(id, d)
      return d
    }
    for (let i = 0; i < ids.length; i += 1) compute(ids[i]!)
    return out
  }, [visibleNodes, wireframeNodeById])

  const wireframeSettings = useMemo(() => readDesignWireframeSettings(snapshot.schema, localGraphData?.metadata || null), [localGraphData?.metadata, snapshot.schema])

  const designMediaPreviewById = useMemo(() => {
    type Preview = { tag: 'IMG' | 'VIDEO' | 'IFRAME'; titleChip: string; url: string; clipId: string }
    const map = new Map<string, Preview>()
    if (styleById) return map
    if (!wireframeSettings.showMediaPreview) return map
    for (let i = 0; i < visibleNodes.length; i += 1) {
      const id = String(visibleNodes[i]?.id || '').trim()
      if (!id) continue
      const base = designGraphNodeById.get(id)
      if (!base) continue
      const spec = getNodeMediaSpec(base)
      if (!spec) continue
      const tag: 'IMG' | 'VIDEO' | 'IFRAME' = spec.kind === 'iframe' ? 'IFRAME' : spec.kind === 'video' ? 'VIDEO' : 'IMG'
      const rawSrc = String(spec.url || '').trim()
      if (!rawSrc) continue
      const title = tag === 'IMG' ? 'Image' : tag === 'VIDEO' ? 'Video' : 'IFrame'
      const titleChip = truncateTextWithEllipsis(title, 24)
      const clipId = `kgmd-clip-${hashText(id)}`
      map.set(id, { tag, titleChip, url: rawSrc, clipId })
    }
    return map
  }, [designGraphNodeById, styleById, visibleNodes, wireframeSettings.showMediaPreview])

  const labelLayoutById = useMemo(() => {
    type Chip = {
      boxX: number
      boxY: number
      boxW: number
      boxH: number
      textX: number
      textY: number
      textAnchor: 'start' | 'middle' | 'end'
      text: string
      fontSize: number
      fontWeight?: number
      fill: string
      bgFill: string
      bgOpacity: number
      stroke: string
      strokeOpacity: number
    }
    type Layout = { label?: Chip; meta?: Chip }

    const map = new Map<string, Layout>()
    if (!styleById) return map
    if (!wireframeSettings.showLabelChips && !wireframeSettings.showMetaChips) return map

    const labelPresentation = readLabelPresentation2d({
      schema: snapshot.schema || null,
      documentSemanticMode: (snapshot.documentSemanticMode as 'document' | 'keyword' | undefined) ?? undefined,
    })
    const labelFontSize = labelPresentation.nodeFontSizePx
    const metaFontSize = Math.max(9, Math.min(16, Math.round(labelFontSize * 0.85)))
    const rectIntersects = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => {
      const ax1 = a.x + a.w
      const ay1 = a.y + a.h
      const bx1 = b.x + b.w
      const by1 = b.y + b.h
      return a.x < bx1 && ax1 > b.x && a.y < by1 && ay1 > b.y
    }
    const rectIntersectionArea = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => {
      const ix0 = Math.max(a.x, b.x)
      const iy0 = Math.max(a.y, b.y)
      const ix1 = Math.min(a.x + a.w, b.x + b.w)
      const iy1 = Math.min(a.y + a.h, b.y + b.h)
      const iw = Math.max(0, ix1 - ix0)
      const ih = Math.max(0, iy1 - iy0)
      return iw > 0 && ih > 0 ? iw * ih : 0
    }

    const cell = 180
    const cellKey = (x: number, y: number) => `${Math.floor(x / cell)}:${Math.floor(y / cell)}`
    const neighbors = (x: number, y: number) => {
      const gx = Math.floor(x / cell)
      const gy = Math.floor(y / cell)
      const out: string[] = []
      for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) out.push(`${gx + dx}:${gy + dy}`)
      return out
    }
    const labelRectsByCell = new Map<string, Array<{ x: number; y: number; w: number; h: number }>>()
    const frameRectsByCell = new Map<string, Array<{ x: number; y: number; w: number; h: number; area: number }>>()
    const canPlaceLabel = (r: { x: number; y: number; w: number; h: number }) => {
      const keys = neighbors(r.x, r.y)
      for (let i = 0; i < keys.length; i += 1) {
        const list = labelRectsByCell.get(keys[i]!)
        if (!list) continue
        for (let j = 0; j < list.length; j += 1) {
          if (rectIntersects(r, list[j]!)) return false
        }
      }
      return true
    }
    const addLabelRect = (r: { x: number; y: number; w: number; h: number }) => {
      const k = cellKey(r.x, r.y)
      const list = labelRectsByCell.get(k)
      if (list) list.push(r)
      else labelRectsByCell.set(k, [r])
    }
    const addFrameRect = (r: { x: number; y: number; w: number; h: number; area: number }) => {
      const k = cellKey(r.x, r.y)
      const list = frameRectsByCell.get(k)
      if (list) list.push(r)
      else frameRectsByCell.set(k, [r])
    }
    const isMostlyOccluded = (r: { x: number; y: number; w: number; h: number; area: number }) => {
      if (!(r.area > 0)) return false
      const keys = neighbors(r.x, r.y)
      for (let i = 0; i < keys.length; i += 1) {
        const list = frameRectsByCell.get(keys[i]!)
        if (!list) continue
        for (let j = 0; j < list.length; j += 1) {
          const other = list[j]!
          const inter = rectIntersectionArea(r, other)
          if (inter <= 0) continue
          const ratio = inter / r.area
          if (ratio >= 0.72) return true
        }
      }
      return false
    }

    const zKey = (s: { zIndex?: number; position?: string; kind?: string; tag?: string } | null | undefined) => {
      const z = s?.zIndex ?? 0
      const pos = String(s?.position || '').toLowerCase()
      const tag = String(s?.tag || '').toUpperCase()
      let boost = 0
      if (pos === 'fixed' || pos === 'sticky') boost += 1000
      if (tag === 'HEADER' || tag === 'NAV') boost += 220
      if (tag === 'FOOTER') boost += 80
      const kind = String(s?.kind || '')
      if (kind === 'interactive') boost += 120
      if (kind === 'media') boost += 60
      return z + boost
    }

    const ordered = renderNodes
      .slice()
      .map(n => {
        const p = positions[n.id]
        const s = styleById.get(n.id) || null
        const area = p ? p.w * p.h : 0
        return { id: n.id, label: n.label, meta: n.type || n.id, p, s, area, z: zKey(s) }
      })
      .filter(v => !!v.p && v.area > 0)
    ordered.sort((a, b) => b.z - a.z || b.area - a.area || a.id.localeCompare(b.id))

    const importantTag = (tag: string) => {
      const t = String(tag || '').toUpperCase()
      return t === 'HEADER' || t === 'NAV' || t === 'MAIN' || t === 'FOOTER' || t === 'SECTION'
    }

    const selectedSet = (() => {
      const ids = Array.isArray(snapshot.selectedNodeIds) ? snapshot.selectedNodeIds : []
      const out = new Set<string>()
      for (let i = 0; i < ids.length; i += 1) {
        const id = String(ids[i] || '').trim()
        if (!id) continue
        if (!positions[id]) continue
        out.add(id)
      }
      return out
    })()

    const placed: Array<{
      particleId: string
      nodeId: string
      kind: 'label' | 'meta'
      z: number
      important: boolean
      p: { x: number; y: number; w: number; h: number }
    }> = []

    for (let i = 0; i < ordered.length; i += 1) {
      const n = ordered[i]!
      const p = n.p!
      const s = n.s
      const kind = String(s?.kind || '')
      const tag = String(s?.tag || '')
      const selected = selectedSet.has(n.id)
      const important = selected || kind === 'interactive' || kind === 'media' || importantTag(tag)

      const frameRect = { x: p.x, y: p.y, w: p.w, h: p.h, area: n.area }
      if (!important && isMostlyOccluded(frameRect)) {
        addFrameRect(frameRect)
        continue
      }

      const maxLabelW = Math.max(0, Math.min(420, p.w - 24))
      const maxMetaW = Math.max(0, Math.min(320, p.w - 24))

      const showLabel =
        wireframeSettings.showLabelChips &&
        (important ||
          (!denseRender && p.w >= 84 && p.h >= 26 && n.area >= 1200) ||
          (denseRender && p.w >= 140 && p.h >= 34 && n.area >= 24_000 && kind !== 'element'))
      const showMeta = wireframeSettings.showMetaChips && important && !denseRender && p.w >= 140 && p.h >= 26

      const layout: Layout = {}
      if (showLabel && maxLabelW >= 48) {
        const fontSize = labelFontSize
        const boxH = 18
        const padX = 8
        const maxChars = Math.min(wireframeSettings.maxLabelChars, estimateMaxCharsForWidthPx(Math.max(0, maxLabelW - 18), fontSize))
        const text = truncateTextWithEllipsis(n.label, maxChars)
        const charW = estimateLabelCharWidthPx(fontSize)
        const rawW = Math.max(48, Math.min(maxLabelW, text.length * charW + 18))
        const boxW = rawW
        const candidates: Array<{ boxX: number; boxY: number; textX: number; textY: number; textAnchor: 'start' | 'end' }> = [
          { boxX: 10, boxY: 8, textX: 10 + padX, textY: 8 + 13, textAnchor: 'start' },
          { boxX: Math.max(10, p.w - 10 - boxW), boxY: 8, textX: p.w - 10 - padX, textY: 8 + 13, textAnchor: 'end' },
          { boxX: 10, boxY: Math.max(6, p.h - 8 - boxH), textX: 10 + padX, textY: Math.max(6, p.h - 8 - boxH) + 13, textAnchor: 'start' },
          {
            boxX: Math.max(10, p.w - 10 - boxW),
            boxY: Math.max(6, p.h - 8 - boxH),
            textX: p.w - 10 - padX,
            textY: Math.max(6, p.h - 8 - boxH) + 13,
            textAnchor: 'end',
          },
        ]
        if (!wireframeSettings.avoidLabelCollisions) {
          const cand = candidates[0]!
          layout.label = {
            boxX: cand.boxX,
            boxY: cand.boxY,
            boxW,
            boxH,
            textX: cand.textX,
            textY: cand.textY,
            textAnchor: cand.textAnchor,
            text,
            fontSize,
            fontWeight: 600,
            fill: 'var(--kg-text-primary)',
            bgFill: 'var(--kg-panel-bg)',
            bgOpacity: 0.92,
            stroke: 'var(--kg-border)',
            strokeOpacity: 0.7,
          }
        } else {
          for (let c = 0; c < candidates.length; c += 1) {
            const cand = candidates[c]!
            const worldRect = { x: p.x + cand.boxX, y: p.y + cand.boxY, w: boxW, h: boxH }
            if (!canPlaceLabel(worldRect)) continue
            addLabelRect(worldRect)
            layout.label = {
              boxX: cand.boxX,
              boxY: cand.boxY,
              boxW,
              boxH,
              textX: cand.textX,
              textY: cand.textY,
              textAnchor: cand.textAnchor,
              text,
              fontSize,
              fontWeight: 600,
              fill: 'var(--kg-text-primary)',
              bgFill: 'var(--kg-panel-bg)',
              bgOpacity: 0.92,
              stroke: 'var(--kg-border)',
              strokeOpacity: 0.7,
            }
            break
          }
        }
      }

      if (showMeta && maxMetaW >= 48) {
        const fontSize = metaFontSize
        const boxH = 16
        const padX = 7
        const maxChars = Math.min(wireframeSettings.maxLabelChars, estimateMaxCharsForWidthPx(Math.max(0, maxMetaW - 18), fontSize))
        const metaText = truncateTextWithEllipsis(n.meta, maxChars)
        const charW = estimateLabelCharWidthPx(fontSize)
        const rawW = Math.max(44, Math.min(maxMetaW, metaText.length * charW + 18))
        const boxW = rawW
        const candidates: Array<{ boxX: number; boxY: number; textX: number; textY: number; textAnchor: 'start' | 'end' }> = [
          { boxX: Math.max(10, p.w - 10 - boxW), boxY: 8, textX: p.w - 10 - padX, textY: 8 + 12, textAnchor: 'end' },
          { boxX: 10, boxY: 8, textX: 10 + padX, textY: 8 + 12, textAnchor: 'start' },
          { boxX: Math.max(10, p.w - 10 - boxW), boxY: Math.max(6, p.h - 8 - boxH), textX: p.w - 10 - padX, textY: Math.max(6, p.h - 8 - boxH) + 12, textAnchor: 'end' },
        ]
        if (!wireframeSettings.avoidLabelCollisions) {
          const cand = candidates[0]!
          layout.meta = {
            boxX: cand.boxX,
            boxY: cand.boxY,
            boxW,
            boxH,
            textX: cand.textX,
            textY: cand.textY,
            textAnchor: cand.textAnchor,
            text: metaText,
            fontSize,
            fill: 'var(--kg-text-tertiary)',
            bgFill: 'var(--kg-panel-bg)',
            bgOpacity: 0.9,
            stroke: 'var(--kg-border)',
            strokeOpacity: 0.6,
          }
        } else {
          for (let c = 0; c < candidates.length; c += 1) {
            const cand = candidates[c]!
            const worldRect = { x: p.x + cand.boxX, y: p.y + cand.boxY, w: boxW, h: boxH }
            if (!canPlaceLabel(worldRect)) continue
            addLabelRect(worldRect)
            layout.meta = {
              boxX: cand.boxX,
              boxY: cand.boxY,
              boxW,
              boxH,
              textX: cand.textX,
              textY: cand.textY,
              textAnchor: cand.textAnchor,
              text: metaText,
              fontSize,
              fill: 'var(--kg-text-tertiary)',
              bgFill: 'var(--kg-panel-bg)',
              bgOpacity: 0.9,
              stroke: 'var(--kg-border)',
              strokeOpacity: 0.6,
            }
            break
          }
        }
      }

      if (layout.label || layout.meta) {
        map.set(n.id, layout)
        if (layout.label) placed.push({ particleId: `${n.id}:label`, nodeId: n.id, kind: 'label', z: n.z, important, p })
        if (layout.meta) placed.push({ particleId: `${n.id}:meta`, nodeId: n.id, kind: 'meta', z: n.z, important, p })
      }
      addFrameRect(frameRect)
    }

    if (wireframeSettings.avoidLabelCollisions && placed.length >= 2) {
      const particles: AabbLabelParticle[] = []
      const byParticleId = new Map<string, { nodeId: string; kind: 'label' | 'meta'; p: { x: number; y: number; w: number; h: number } }>()
      for (let i = 0; i < placed.length; i += 1) {
        const pl = placed[i]!
        const layout = map.get(pl.nodeId)
        if (!layout) continue
        const chip = pl.kind === 'label' ? layout.label : layout.meta
        if (!chip) continue
        const cx = pl.p.x + chip.boxX + chip.boxW / 2
        const cy = pl.p.y + chip.boxY + chip.boxH / 2
        const dxClamp = Math.max(18, Math.min(120, Math.floor(pl.p.w * 0.22)))
        const dyClamp = Math.max(14, Math.min(90, Math.floor(pl.p.h * 0.18)))
        const weight = (pl.important ? 2.2 : 1) + Math.max(0, Math.min(2, pl.z / 1200))
        particles.push({
          id: pl.particleId,
          baseX: cx,
          baseY: cy,
          x: cx,
          y: cy,
          vx: 0,
          vy: 0,
          halfW: chip.boxW / 2,
          halfH: chip.boxH / 2,
          dxClamp,
          dyClamp,
          weight,
        })
        byParticleId.set(pl.particleId, { nodeId: pl.nodeId, kind: pl.kind, p: pl.p })
      }
      relaxAabbLabels({ particles, steps: 16, maxOps: 32_000 })
      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i]!
        const ref = byParticleId.get(particle.id)
        if (!ref) continue
        const layout = map.get(ref.nodeId)
        if (!layout) continue
        const chip = ref.kind === 'label' ? layout.label : layout.meta
        if (!chip) continue
        const base = ref.p
        const worldX0 = particle.x - chip.boxW / 2
        const worldY0 = particle.y - chip.boxH / 2
        const localX0 = worldX0 - base.x
        const localY0 = worldY0 - base.y
        const minX = 6
        const minY = 6
        const maxX = Math.max(minX, base.w - 6 - chip.boxW)
        const maxY = Math.max(minY, base.h - 6 - chip.boxH)
        const boxX = Math.max(minX, Math.min(maxX, localX0))
        const boxY = Math.max(minY, Math.min(maxY, localY0))
        const isLabel = ref.kind === 'label'
        const padX = isLabel ? 8 : 7
        const textX = chip.textAnchor === 'end' ? boxX + chip.boxW - padX : boxX + padX
        const textY = boxY + (isLabel ? 13 : 12)
        if (ref.kind === 'label') layout.label = { ...chip, boxX, boxY, textX, textY }
        else layout.meta = { ...chip, boxX, boxY, textX, textY }
        map.set(ref.nodeId, layout)
      }
    }

    return map
  }, [denseRender, positions, renderNodes, snapshot.selectedNodeIds, styleById, wireframeSettings.avoidLabelCollisions, wireframeSettings.maxLabelChars, wireframeSettings.showLabelChips, wireframeSettings.showMetaChips])

  const wireframeEdges = useMemo(() => {
    if (!styleById) return [] as Array<{ id: string; d: string; opacity: number }>
    if (!wireframeSettings.showEdges) return [] as Array<{ id: string; d: string; opacity: number }>
    const edges = Array.isArray(localGraphData?.edges) ? (localGraphData.edges as unknown as GraphEdge[]) : []
    if (edges.length === 0) return []
    const out: Array<{ id: string; d: string; opacity: number }> = []
    const maxEdges = Math.max(0, Math.min(5000, Math.floor(wireframeSettings.maxEdges)))
    const edgeType = readGlobalEdgeType(snapshot.schema)
    for (let i = 0; i < edges.length; i += 1) {
      if (maxEdges > 0 && out.length >= maxEdges) break
      const e = edges[i]
      const id = String(e?.id || '').trim() || `e:${i}`
      const src = String((e as unknown as { source?: unknown }).source || '').trim()
      const tgt = String((e as unknown as { target?: unknown }).target || '').trim()
      if (!src || !tgt) continue
      const ps = positions[src]
      const pt = positions[tgt]
      if (!ps || !pt) continue
      const depth = domDepthById.get(tgt) ?? 0
      if (depth > 5 && !(snapshot.selectedNodeId === tgt || snapshot.selectedNodeId === src)) continue
      const ks = styleById.get(src)?.kind || ''
      const kt = styleById.get(tgt)?.kind || ''
      if (ks === 'element' && kt === 'element' && depth > 2) continue
      const x1 = ps.x + ps.w / 2
      const y1 = ps.y + ps.h / 2
      const x2 = pt.x + pt.w / 2
      const y2 = pt.y + pt.h / 2
      const opacity = Math.max(0.06, Math.min(0.42, 0.28 / (1 + depth * 0.55)))
      out.push({
        id,
        d: buildEdgePathD({ edgeType, sx: x1, sy: y1, tx: x2, ty: y2, curve: readEdgePathCurveOptions(e, snapshot.schema) }),
        opacity,
      })
    }
    return out
  }, [domDepthById, localGraphData?.edges, positions, snapshot.schema, snapshot.selectedNodeId, styleById, wireframeSettings.maxEdges, wireframeSettings.showEdges])
  const wireframeEdgeStroke = readGlobalEdgeColor(snapshot.schema)
  const wireframeEdgeStrokeWidth = readGlobalEdgeThicknessPx(snapshot.schema)
  const wireframeEdgesAnimated = readGlobalEdgeAnimationEnabled(snapshot.schema)
  useEffect(() => {
    if (!wireframeEdgesAnimated) return
    ensureEdgeAnimationStyleElement(typeof document !== 'undefined' ? document : null)
  }, [wireframeEdgesAnimated])

  const wireframePreviewById = useMemo(() => {
    type Preview =
      | { kind: 'media'; innerX: number; innerY: number; innerW: number; innerH: number; tag: string; titleChip: string; src: string; isDataImage: boolean; clipId: string }
      | {
          kind: 'text'
          title: string
          titleMaxChars: number
          x: number
          y: number
          fontSize: number
          fontWeight: number
          textAnchor: 'start' | 'middle' | 'end'
          lineH: number
          lines: string[]
          fill?: string
          fontFamily?: string
        }
    const map = new Map<string, Preview>()
    if (!styleById) return map
    if (!wireframeSettings.showTextPreview && !wireframeSettings.showMediaPreview) return map
    if (!wireframeNodeById) return map
    const safeCssColor = (raw: unknown): string | null => {
      const s = typeof raw === 'string' ? String(raw || '').trim() : ''
      if (!s) return null
      if (s.length > 80) return null
      const lower = s.toLowerCase()
      if (lower === 'transparent') return null
      if (lower === 'inherit' || lower === 'currentcolor') return null
      if (lower.includes('var(') || lower.includes('url(')) return null
      if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s
      if (/^rgba?\(/i.test(s) || /^hsla?\(/i.test(s)) return s
      if (/^[a-z]+$/i.test(s)) return s
      return null
    }
    const safeFontFamily = (raw: unknown): string | null => {
      const s = typeof raw === 'string' ? String(raw || '').trim() : ''
      if (!s) return null
      if (s.length > 160) return null
      const first = s.split(',')[0]?.trim() || ''
      const cleaned = first.replace(/^['"]+|['"]+$/g, '').trim()
      if (!cleaned) return null
      if (cleaned.length > 60) return null
      return cleaned
    }
    const parseBoxPx = (raw: unknown): { top: number; right: number; bottom: number; left: number } | null => {
      const s = typeof raw === 'string' ? String(raw || '').trim() : ''
      if (!s) return null
      const matches = Array.from(s.matchAll(/(-?\d+(\.\d+)?)px/gi)).map(m => Number(m[1]))
      const vals = matches.filter(v => Number.isFinite(v)).slice(0, 8)
      if (vals.length === 0) return null
      const clamp = (n: number) => Math.max(0, Math.min(200, n))
      if (vals.length === 1) {
        const a = clamp(vals[0]!)
        return { top: a, right: a, bottom: a, left: a }
      }
      if (vals.length === 2) {
        const a = clamp(vals[0]!)
        const b = clamp(vals[1]!)
        return { top: a, right: b, bottom: a, left: b }
      }
      if (vals.length === 3) {
        const a = clamp(vals[0]!)
        const b = clamp(vals[1]!)
        const c = clamp(vals[2]!)
        return { top: a, right: b, bottom: c, left: b }
      }
      const a = clamp(vals[0]!)
      const b = clamp(vals[1]!)
      const c = clamp(vals[2]!)
      const d = clamp(vals[3]!)
      return { top: a, right: b, bottom: c, left: d }
    }
    const selectedId = String(snapshot.selectedNodeId || '').trim()
    for (let i = 0; i < renderNodes.length; i += 1) {
      const n = renderNodes[i]!
      const p = positions[n.id]
      if (!p) continue
      const selected = selectedId === n.id
      if (denseRender && !selected) continue

      const base = wireframeNodeById[n.id]
      const props = (base?.properties || {}) as Record<string, unknown>
      const domTextRaw =
        typeof props['dom:textPreview'] === 'string'
          ? String(props['dom:textPreview'] || '').trim()
          : typeof props['dom:text'] === 'string'
            ? String(props['dom:text'] || '').trim()
            : ''
      const domText = domTextRaw.replace(/\s+/g, ' ').trim()
      const tag = typeof props['dom:tag'] === 'string' ? String(props['dom:tag'] || '').trim().toUpperCase() : ''
      const src = typeof props['dom:attrs:src'] === 'string' ? String(props['dom:attrs:src'] || '').trim() : ''
      const alt = typeof props['dom:attrs:alt'] === 'string' ? String(props['dom:attrs:alt'] || '').trim() : ''
      const href = typeof props['dom:attrs:href'] === 'string' ? String(props['dom:attrs:href'] || '').trim() : ''
      const srcResolved = src ? resolveUrlAgainstBase(documentUrl, src) : ''
      const hrefResolved = href ? resolveUrlAgainstBase(documentUrl, href) : ''
      const kind0 = typeof props['dom:kind'] === 'string' ? String(props['dom:kind'] || '').trim() : ''
      const cssFontSize = typeof props['css:fontSize'] === 'string' ? String(props['css:fontSize'] || '').trim() : ''
      const cssFontWeight = typeof props['css:fontWeight'] === 'string' ? String(props['css:fontWeight'] || '').trim() : ''
      const cssTextAlign = typeof props['css:textAlign'] === 'string' ? String(props['css:textAlign'] || '').trim().toLowerCase() : ''
      const cssColor = safeCssColor(props['css:color'])
      const cssFontFamily = safeFontFamily(props['css:fontFamily'])
      const cssPadding = parseBoxPx(props['css:padding'])
      const style = styleById.get(n.id) || null
      const kind = style?.kind || kind0

      const padX = Math.max(10, Math.min(26, Math.round((cssPadding?.left ?? 14) * 0.75)))
      const topY = Math.max(36, Math.min(72, Math.round(32 + (cssPadding?.top ?? 16) * 0.75)))
      const maxW = Math.max(0, p.w - padX * 2)
      const maxH = Math.max(0, p.h - topY - 12)
      if (maxW < 90 || maxH < 18) continue

      const isMedia = kind === 'media' || tag === 'IMG' || tag === 'VIDEO' || tag === 'IFRAME' || tag === 'CANVAS' || tag === 'SVG'
      if (isMedia) {
        if (!wireframeSettings.showMediaPreview) continue
        const isDataImage = /^data:image\//i.test(srcResolved || src)
        const srcFinal = tag === 'IMG' ? applyMediaProxySrc(srcResolved || src) : (srcResolved || src)
        const title = (() => {
          if (tag === 'IMG') return alt || (srcResolved ? srcResolved.split('/').slice(-1)[0] || 'IMG' : src ? src.split('/').slice(-1)[0] || 'IMG' : 'IMG')
          if (tag === 'IFRAME') return 'IFRAME'
          if (tag === 'VIDEO') return 'VIDEO'
          if (tag === 'CANVAS') return 'CANVAS'
          if (tag === 'SVG') return 'SVG'
          return tag || 'MEDIA'
        })()
        const innerX = padX
        const innerY = topY
        const innerW = Math.max(1, p.w - padX * 2)
        const innerH = Math.max(1, p.h - topY - 12)
        const titleMaxChars = estimateMaxCharsForWidthPx(Math.max(0, innerW - 20), 10)
        const titleChip = truncateTextWithEllipsis(title, Math.max(8, Math.min(64, titleMaxChars)))
        const clipId = `kgwf-clip-${hashText(n.id)}`
        map.set(n.id, { kind: 'media', innerX, innerY, innerW, innerH, tag, titleChip, src: srcFinal, isDataImage, clipId })
        continue
      }

      const isTextish =
        !!domText &&
        (kind === 'element' ||
          tag === 'P' ||
          tag === 'SPAN' ||
          tag === 'H1' ||
          tag === 'H2' ||
          tag === 'H3' ||
          tag === 'H4' ||
          tag === 'H5' ||
          tag === 'H6' ||
          tag === 'LI' ||
          tag === 'A' ||
          tag === 'BUTTON' ||
          tag === 'LABEL')
      if (!isTextish) continue
      if (!wireframeSettings.showTextPreview) continue

      const isHeading = tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6'
      const isCta = tag === 'A' || tag === 'BUTTON'
      const depth = domDepthById.get(n.id) ?? 0
      if (!selected && !isHeading && !isCta) {
        if (depth >= 4) continue
        if (p.w < 180 || p.h < 60) continue
      }

      const title = (() => {
        if (tag === 'A') {
          const h = hrefResolved || href
          if (!h) return 'Link'
          try {
            const u = new URL(h)
            const host = u.host || ''
            const path = decodeURIComponent(u.pathname || '').replace(/\/+$/, '')
            const p0 = path && path !== '/' ? path : ''
            const out = host ? `${host}${p0}` : p0 || h
            return `Link: ${out}`
          } catch {
            return `Link: ${h}`
          }
        }
        if (tag === 'BUTTON') return 'Button'
        return ''
      })()
      const fontSizeFromCss = (() => {
        const m = cssFontSize.match(/(-?\d+(\.\d+)?)px/i)
        const px = m ? Number(m[1]) : NaN
        if (!Number.isFinite(px) || px <= 0) return null
        return Math.max(10, Math.min(18, Math.round(px * 0.65)))
      })()
      const fontSize = fontSizeFromCss ?? (tag === 'H1' || tag === 'H2' || tag === 'H3' ? 12 : 11)
      const lineH = fontSize + 4
      const maxLinesFit = Math.max(1, Math.floor(maxH / lineH))
      const maxLinesWanted = Math.max(1, Math.min(selected ? 4 : 2, maxLinesFit))
      const maxCharsPerLine = Math.max(6, estimateMaxCharsForWidthPx(Math.max(0, maxW), fontSize))
      const wrapped = wrapTextByMaxChars(domText, maxCharsPerLine)
      const all = wrapped.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 60)
      if (all.length === 0) continue
      if (tag === 'LI') {
        const first = all[0] || ''
        all[0] = first.startsWith('•') ? first : `• ${first}`
      }
      let lines = all.slice(0, maxLinesWanted)
      if (all.length > maxLinesWanted && lines.length > 0) {
        const last = lines[lines.length - 1] || ''
        const next = last.endsWith('…') ? last : last.length >= maxCharsPerLine ? truncateTextWithEllipsis(last, maxCharsPerLine) : `${last}…`
        lines = lines.slice(0, -1).concat([next])
      }
      const fontWeight = (() => {
        const n = Number(cssFontWeight)
        if (Number.isFinite(n) && n >= 600) return 600
        if (isHeading || isCta) return 600
        return 400
      })()
      const align = cssTextAlign === 'center' || cssTextAlign === 'right' ? cssTextAlign : ''
      const textAnchor = isCta ? 'middle' : align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'
      const x0 = isCta ? padX + maxW / 2 : textAnchor === 'middle' ? padX + maxW / 2 : textAnchor === 'end' ? padX + maxW : padX
      const y0 = isCta ? topY + Math.max(fontSize, Math.min(maxH - 2, p.h * 0.5 - fontSize * 0.3)) : topY + fontSize
      map.set(n.id, {
        kind: 'text',
        title,
        titleMaxChars: Math.max(10, Math.min(90, estimateMaxCharsForWidthPx(Math.max(0, maxW), 10))),
        x: x0,
        y: y0,
        fontSize,
        fontWeight,
        textAnchor,
        lineH,
        lines,
        ...(cssColor ? { fill: cssColor } : {}),
        ...(cssFontFamily ? { fontFamily: cssFontFamily } : {}),
      })
    }
    return map
  }, [
    denseRender,
    documentUrl,
    domDepthById,
    positions,
    renderNodes,
    snapshot.selectedNodeId,
    styleById,
    wireframeNodeById,
    wireframeSettings.showMediaPreview,
    wireframeSettings.showTextPreview,
  ])

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
  const frameVisualById = useMemo(() => {
    const map = new Map<
      string,
      {
        fill: string
        stroke: string
        strokeWidth: number
        strokeDasharray?: string
        rx: number
        rectOpacity: number
        strokeOpacity: number
        showDecor: boolean
        filter: string
      }
    >()
    for (let i = 0; i < renderNodes.length; i += 1) {
      const node = renderNodes[i]!
      const position = positions[node.id]
      if (!position) continue
      const selected = snapshot.selectedNodeId === node.id
      const style = styleById ? styleById.get(node.id) || null : null
      const base = wireframeNodeById ? wireframeNodeById[node.id] : null
      const baseProps = (base?.properties || {}) as Record<string, unknown>
      const domTag = typeof baseProps['dom:tag'] === 'string' ? String(baseProps['dom:tag'] || '').trim().toUpperCase() : ''
      const domClass = typeof baseProps['dom:attrs:class'] === 'string' ? String(baseProps['dom:attrs:class'] || '').trim() : ''
      const isSynthSection = domTag === 'SECTION' && domClass.includes('kg-synth-section')
      const kind = style?.kind || ''
      const depth = wireframeSettings.depthFade ? (domDepthById.get(node.id) ?? 0) : 0
      const fill = (() => {
        const hasFill = !!(styleById && style?.fill && style.fill !== 'transparent')
        if (hasWebpageOverlay) {
          if (hasFill) return style!.fill!
          if (isSynthSection) return 'var(--kg-panel-bg)'
          return 'transparent'
        }
        if (!styleById) return 'var(--kg-panel-bg)'
        if (hasFill) return style!.fill!
        if (kind === 'container' || kind === 'interactive') return 'var(--kg-panel-bg)'
        return 'transparent'
      })()
      const stroke = selected ? 'var(--kg-canvas-accent)' : style?.stroke || 'var(--kg-border)'
      const strokeWidth = selected ? 2 : (style?.strokeWidth ?? (kind === 'interactive' ? 2 : 1))
      const strokeDasharray = !selected && kind === 'container' ? (isSynthSection ? (depth <= 1 ? '10 6' : '8 6') : depth <= 1 ? '8 4' : '6 4') : undefined
      const rx = typeof style?.borderRadius === 'number' && Number.isFinite(style.borderRadius) ? style.borderRadius : 8
      const rectOpacity = (() => {
        const baseOpacity = typeof style?.opacity === 'number' && Number.isFinite(style.opacity) ? style.opacity : 1
        if (hasWebpageOverlay) {
          const hasWireFill = !!(styleById && style?.fill && style.fill !== 'transparent') || isSynthSection
          if (hasWireFill) {
            const area = position.w * position.h
            if (area < 3200) return 0
            const factor = isSynthSection ? 0.08 : kind === 'interactive' ? 0.22 : kind === 'container' ? 0.18 : kind === 'media' ? 0.12 : 0.1
            const selectionBoost = selected ? 1.25 : 1
            return baseOpacity * (factor * selectionBoost) / (1 + depth * 0.35)
          }
          return 0
        }
        if (!styleById) return baseOpacity
        if (style?.fill) return baseOpacity
        if (kind === 'container') return baseOpacity * (0.26 / (1 + depth * 0.55))
        if (kind === 'interactive') return baseOpacity * (0.28 / (1 + depth * 0.35))
        return baseOpacity
      })()
      const strokeOpacity = (() => {
        if (!styleById) return 1
        if (selected) return 1
        const baseOpacity = kind === 'container' ? 0.55 : kind === 'interactive' ? 0.75 : kind === 'media' ? 0.65 : 0.22
        return Math.max(0.08, baseOpacity / (1 + depth * 0.35))
      })()
      const showDecor = !styleById && !denseRender
      const hasShadow = !!(styleById && style?.boxShadow && style.boxShadow !== 'none')
      const filter = selected ? 'url(#shadow-md)' : hasShadow ? 'url(#shadow-md)' : 'url(#shadow-sm)'
      map.set(node.id, { fill, stroke, strokeWidth, strokeDasharray, rx, rectOpacity, strokeOpacity, showDecor, filter })
    }
    return map
  }, [denseRender, domDepthById, hasWebpageOverlay, positions, renderNodes, snapshot.selectedNodeId, styleById, wireframeNodeById, wireframeSettings.depthFade])

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
