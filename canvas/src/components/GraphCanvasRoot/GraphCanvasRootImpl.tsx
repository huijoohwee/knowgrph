import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useGraphStoreKeyRef } from '@/hooks/useGraphStoreKeyRef'
import { useContainerDims } from '@/hooks/useContainerDims'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { cloneGraphDataForRender } from '@/components/GraphCanvas/renderClone'
import { normalizeEdgesForSim } from '@/components/GraphCanvas/simulation'
import { create2dSvgSnapshotFns, computeFlowState, getNodeMediaSpec } from '@/components/GraphCanvas/helpers'
import { looksLikeSingleTagBlock } from 'grph-shared/markdown/mediaHtml'
import { useZoomEffects } from '@/components/GraphCanvas/hooks/useZoomEffects'
import { useEdgeCreationEffect } from '@/components/GraphCanvas/hooks/useEdgeCreationEffect'
import { useSelectionHighlight } from '@/components/GraphCanvas/hooks/useSelectionHighlight'
import { useGroupSelectionHighlight } from '@/components/GraphCanvas/hooks/useGroupSelectionHighlight'
import { useGraphCanvasStyles } from '@/components/GraphCanvas/useGraphCanvasStyles'
import { useAutoZoomModes2d } from '@/features/zoom/useAutoZoomModes2d'
import { GraphHoverTooltip, type HoverInfo } from '@/components/GraphHoverTooltip'
import { MarkdownDesignOverlay } from '@/features/markdown-edgeless/MarkdownDesignOverlay'
import { buildMarkdownTokensKey, lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { deriveMarkdownDesignLayout, MARKDOWN_DESIGN_LAYOUT, type MarkdownDesignBlock, type MarkdownDesignLayout } from '@/features/markdown-edgeless/markdownDesignLayout'
import { readNodeCenterWorld2d } from '@/lib/render/mediaAnchor'
import { useOverlayInteractions2d } from '@/components/GraphCanvasRoot/hooks/useOverlayInteractions2d'
import { resetGlobalUserSelectLock } from '@/lib/canvas/interaction-user-select'
import { InfiniteGridCanvasOverlay } from '@/components/InfiniteGridCanvasOverlay'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'
import { CANVAS_INTERACTIVE_CLASS, CANVAS_SURFACE_CLASS } from '@/lib/canvas/surface'
import { readCanvasGridConfigFromSchema, readCanvasGridWorldStepFromSchema } from '@/lib/canvas/canvasGridConfig'
import { deriveSceneDisplayGraph, deriveSceneGroups } from '@/lib/scene/sceneDerivation'
import { useMediaQuery } from '@/lib/ui/useMediaQuery'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import type { PortHandleDatum } from '@/components/GraphCanvas/portHandles'

import { useEnsureSpacePanListener, useCanvasWheelAndGestureGuards } from '@/components/GraphCanvasRoot/hooks/useCanvasNativeGuards'
import { useCanvasContextMenu } from '@/components/GraphCanvasRoot/hooks/useCanvasContextMenu'
import { useCanvasLayoutSync } from '@/components/GraphCanvasRoot/hooks/useCanvasLayoutSync'
import { useZoomStateSeeding2d } from '@/components/GraphCanvasRoot/hooks/useZoomStateSeeding2d'
import { usePersistLayoutOnDeactivate2d } from '@/components/GraphCanvasRoot/hooks/usePersistLayoutOnDeactivate2d'
import { useRichMediaOverlays2d } from '@/components/GraphCanvasRoot/hooks/useRichMediaOverlays2d'
import { RichMediaOverlayLayer2d } from '@/components/GraphCanvasRoot/components/RichMediaOverlayLayer2d'
import { useD3GraphScene2d } from '@/components/GraphCanvasRoot/hooks/useD3GraphScene2d'
import { useD3PresentationUpdates2d } from '@/components/GraphCanvasRoot/hooks/useD3PresentationUpdates2d'
import { useSelectionRerenderSubscription2d, useZoomScaleReapplySubscription2d } from '@/components/GraphCanvasRoot/hooks/usePresentationSubscriptions2d'
import { useFlowLabelPresentation2d } from '@/components/GraphCanvasRoot/hooks/useFlowLabelPresentation2d'
import { useArrange2d } from '@/components/GraphCanvasRoot/hooks/useArrange2d'
import { useArrangeKeyboardShortcuts2d } from '@/components/GraphCanvasRoot/hooks/useArrangeKeyboardShortcuts2d'
import { useArrangeRequestEffect2d } from '@/components/GraphCanvasRoot/hooks/useArrangeRequestEffect2d'
import { ArrangeToolbar2d } from '@/components/GraphCanvasRoot/components/ArrangeToolbar2d'
import { useMarqueeSelection2d } from '@/components/GraphCanvasRoot/hooks/useMarqueeSelection2d'
import { MarqueeBoxOverlay } from '@/components/GraphCanvasRoot/components/MarqueeBoxOverlay'

const MARKDOWN_PANEL_ALLOWED_KINDS = ['table', 'code', 'blockquote', 'callout', 'html'] as const

export default function GraphCanvas({ active = true }: { active?: boolean }) {
  const containerRef = useRef<HTMLElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const coarsePointer = useMediaQuery('(pointer: coarse)')
  const isEmbeddedPreview = useMemo(() => {
    try {
      const q = new URLSearchParams(String(window.location.search || '')).get('kgPreview') === '1'
      if (q) return true
      const w = window as unknown as { frameElement?: Element | null; parent?: Window | null }
      const parent = w?.parent
      if (!parent || parent === window) return false
      const frameEl = w?.frameElement
      if (!frameEl) return false
      return String(frameEl.getAttribute('data-kg-preview') || '') === '1'
    } catch {
      return false
    }
  }, [])

  const activeRef = useRef<boolean>(true)
  activeRef.current = !!active

  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const nodesSelRef = useRef<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>(null)
  const groupChevronSelRef = useRef<d3.Selection<SVGPathElement, GraphNode, SVGGElement, unknown> | null>(null)
  const mediaSelRef = useRef<d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null>(null)
  const portHandlesSelRef = useRef<d3.Selection<SVGCircleElement, PortHandleDatum, SVGGElement, unknown> | null>(null)
  const linksHitSelRef = useRef<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>(null)
  const linksSelRef = useRef<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>(null)
  const labelsSelRef = useRef<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null)
  const sceneGraphDataRef = useRef<GraphData | null>(null)
  const beforeRenderFrameRef = useRef<(() => void) | null>(null)
  const beforeRenderFrameWrappedSourceRef = useRef<(() => void) | null>(null)
  const nodesPresentationAppliedKeyRef = useRef<string | null>(null)
  const groupsPresentationAppliedKeyRef = useRef<string | null>(null)
  const sceneCleanupRef = useRef<null | (() => void)>(null)
  const sceneBuildKeyRef = useRef<string | null>(null)
  const activeLayoutCacheKeyRef = useRef<string | null>(null)

  useEnsureSpacePanListener()
  useCanvasWheelAndGestureGuards({ svgRef, activeRef })

  const {
    graphDataRevision,
    setCanvasDims,
    setCanvasPos,
    schema,
    renderMediaAsNodes,
    mediaPanelDensity,
    threeIframeOverlayPoolMax,
    threeIframeOverlayBaseWidthRatioDefault,
    threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthMinPxDefault,
    threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlayBaseWidthMaxPxCompact,
    setLayoutPositionsForMode,
    frontmatterModeEnabled,
    multiDimTableModeEnabled,
    documentSemanticMode,
    canvasRenderMode,
    canvas2dRenderer,
    viewportControlsPreset,
    collapsedGroupIds,
    viewPinned,
    zoomState,
    fitToScreenMode,
    zoomToSelectionMode,
    graphCanvasArrangeRequest,
    clearGraphCanvasArrangeRequest,
    selectedNodeId,
    selectedNodeIds,
    selectNode,
    markdownDocumentName,
    markdownDocumentText,
  } = useGraphStore(
    useShallow(s => ({
      graphDataRevision: s.graphDataRevision,
      setCanvasDims: s.setCanvasDims,
      setCanvasPos: s.setCanvasPos,
      schema: s.schema,
      renderMediaAsNodes: s.renderMediaAsNodes,
      mediaPanelDensity: s.mediaPanelDensity,
      threeIframeOverlayPoolMax: s.threeIframeOverlayPoolMax,
      threeIframeOverlayBaseWidthRatioDefault: s.threeIframeOverlayBaseWidthRatioDefault,
      threeIframeOverlayBaseWidthRatioCompact: s.threeIframeOverlayBaseWidthRatioCompact,
      threeIframeOverlayBaseWidthMinPxDefault: s.threeIframeOverlayBaseWidthMinPxDefault,
      threeIframeOverlayBaseWidthMinPxCompact: s.threeIframeOverlayBaseWidthMinPxCompact,
      threeIframeOverlayBaseWidthMaxPxDefault: s.threeIframeOverlayBaseWidthMaxPxDefault,
      threeIframeOverlayBaseWidthMaxPxCompact: s.threeIframeOverlayBaseWidthMaxPxCompact,
      setLayoutPositionsForMode: s.setLayoutPositionsForMode,
      frontmatterModeEnabled: s.frontmatterModeEnabled || false,
      multiDimTableModeEnabled: (s as unknown as { multiDimTableModeEnabled?: unknown }).multiDimTableModeEnabled === true,
      documentSemanticMode: (s.documentSemanticMode || 'document') as 'document' | 'keyword',
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
      viewportControlsPreset: s.viewportControlsPreset,
      collapsedGroupIds: s.collapsedGroupIds || [],
      viewPinned: s.viewPinned === true,
      zoomState: s.zoomState || null,
      fitToScreenMode: s.fitToScreenMode === true,
      zoomToSelectionMode: s.zoomToSelectionMode === true,
      graphCanvasArrangeRequest: s.graphCanvasArrangeRequest,
      clearGraphCanvasArrangeRequest: s.clearGraphCanvasArrangeRequest,
      selectedNodeId: s.selectedNodeId,
      selectedNodeIds: s.selectedNodeIds,
      selectNode: s.selectNode,
      markdownDocumentName: s.markdownDocumentName,
      markdownDocumentText: s.markdownDocumentText,
    })),
  )

  const layoutSemanticModeKey = useMemo(() => {
    const base = String(documentSemanticMode || 'document')
    return multiDimTableModeEnabled ? `${base}:mdtbl` : base
  }, [documentSemanticMode, multiDimTableModeEnabled])

  const registerCanvasSnapshotFns = useGraphStore(s => s.registerCanvasSnapshotFns)
  const selectedNodeIdRef = useGraphStoreKeyRef('selectedNodeId')
  const selectedEdgeIdRef = useGraphStoreKeyRef('selectedEdgeId')
  const selectedNodeIdsRef = useGraphStoreKeyRef('selectedNodeIds')
  const selectedEdgeIdsRef = useGraphStoreKeyRef('selectedEdgeIds')
  const graphDataRevisionRef = useGraphStoreKeyRef('graphDataRevision')

  const schemaRef = useRef(schema)
  useEffect(() => {
    schemaRef.current = schema
  }, [schema])

  const schemaLayoutEngineJson = useMemo(() => buildSchemaLayoutEngineJson2d(schema), [schema])
  const schemaNodesPresentationJson = useMemo(() => {
    return JSON.stringify({
      nodeShapeMode: schema?.behavior?.nodeShapeMode || 'auto',
      portHandles: schema?.behavior?.portHandles || null,
      nodeShapes: schema?.nodeShapes || null,
      allowNodeDrag: schema?.behavior?.allowNodeDrag !== false,
      hoverEnabled: schema?.behavior?.hover?.enabled !== false,
      expansion: schema?.behavior?.expansion || null,
      renderMediaAsNodes,
      mediaPanelDensity,
    })
  }, [
    mediaPanelDensity,
    renderMediaAsNodes,
    schema?.behavior?.allowNodeDrag,
    schema?.behavior?.expansion,
    schema?.behavior?.hover?.enabled,
    schema?.behavior?.nodeShapeMode,
    schema?.behavior?.portHandles,
    schema?.nodeShapes,
  ])
  const schemaGroupsPresentationJson = useMemo(() => {
    return JSON.stringify({
      groups: schema?.layout?.groups || null,
      labelStyles: schema?.labelStyles || null,
      nodeShapeMode: schema?.behavior?.nodeShapeMode || 'auto',
      portHandles: schema?.behavior?.portHandles || null,
    })
  }, [schema?.behavior?.nodeShapeMode, schema?.behavior?.portHandles, schema?.labelStyles, schema?.layout?.groups])

  const renderGraphData = useActiveGraphRenderData(active)
  const effectiveFrontmatterModeEnabled = useMemo(() => {
    return computeEffectiveFrontmatterMode({
      frontmatterModeEnabled: frontmatterModeEnabled === true,
      documentSemanticMode,
      graphData: renderGraphData,
    })
  }, [documentSemanticMode, frontmatterModeEnabled, renderGraphData])
  const collapsedGroupIdsKey = useMemo(() => buildCollapsedGroupIdsKey(collapsedGroupIds), [collapsedGroupIds])

  const clonedGraphData = useMemo(() => {
    if (!renderGraphData) return null
    return cloneGraphDataForRender(renderGraphData) as GraphData
  }, [renderGraphData])
  const sceneDisplayGraphDerivation = useMemo(() => {
    if (!clonedGraphData) return null
    return deriveSceneDisplayGraph({ graphData: clonedGraphData })
  }, [clonedGraphData])
  const sceneGraphData = useMemo(() => {
    if (!clonedGraphData) return null
    return sceneDisplayGraphDerivation?.displayGraphData || clonedGraphData
  }, [clonedGraphData, sceneDisplayGraphDerivation])
  const sceneGroupsDerivation = useMemo(() => {
    return deriveSceneGroups({
      graphData: clonedGraphData,
      graphDataRevision: graphDataRevision || 0,
      schema,
      documentSemanticMode: String(documentSemanticMode || ''),
      frontmatterModeEnabled: !!effectiveFrontmatterModeEnabled,
    })
  }, [clonedGraphData, documentSemanticMode, effectiveFrontmatterModeEnabled, graphDataRevision, schema])

  const { width, height, left, top, dpr } = useContainerDims(containerRef)
  const canvasGrid = useMemo(() => readCanvasGridConfigFromSchema(schema), [schema])
  const canvasGridStep = useMemo(() => readCanvasGridWorldStepFromSchema(schema), [schema])
  const getZoomTransform = useCallback(() => {
    const el = svgRef.current
    if (!el) return null
    return d3.zoomTransform(el)
  }, [])
  const getZoomEventTarget = useCallback(() => svgRef.current, [])

  const debouncedWidth = useDebouncedValue(width, 100)
  const debouncedHeight = useDebouncedValue(height, 100)
  const sceneWidth = useMemo(() => Math.max(1, Math.floor(debouncedWidth)), [debouncedWidth])
  const sceneHeight = useMemo(() => Math.max(1, Math.floor(debouncedHeight)), [debouncedHeight])
  const tempLinkSelRef = useRef<TempLinkSelection>(null)
  const linkDragRef = useRef<PendingLink | null>(null)
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)

  useCanvasContextMenu({ svgRef })
  useCanvasLayoutSync({ width, height, left, top, setCanvasDims, setCanvasPos })
  useZoomStateSeeding2d({
    active,
    viewPinned,
    zoomState,
    fitToScreenMode,
    zoomToSelectionMode,
    svgRef,
    gRef,
    zoomRef,
    sceneWidth,
    sceneHeight,
    canvasRenderMode,
    canvas2dRenderer,
    collapsedGroupIdsKey,
    documentSemanticMode,
    frontmatterModeEnabled,
    mediaPanelDensity,
    renderMediaAsNodes,
    schemaLayoutEngineJson,
  })

  usePersistLayoutOnDeactivate2d({
    active,
    nodesSelRef,
    schemaRef: schemaRef as unknown as React.MutableRefObject<GraphSchema>,
    sceneGraphDataRef,
  })

  useEffect(() => {
    return () => {
      try {
        sceneCleanupRef.current?.()
      } catch {
        void 0
      } finally {
        sceneCleanupRef.current = null
        sceneBuildKeyRef.current = null
      }
    }
  }, [])

  useZoomEffects({ svgRef, zoomRef, width, height, paused: !active, graphDataOverride: sceneGraphData })
  useAutoZoomModes2d({ viewportW: width, viewportH: height, paused: !active })
  useEdgeCreationEffect({ paused: !active, tempLinkSelRef, linkDragRef })
  useEffect(() => {
    registerCanvasSnapshotFns('2d', svgRef.current ? create2dSvgSnapshotFns(svgRef) : null)
    return () => {
      registerCanvasSnapshotFns('2d', null)
    }
  }, [registerCanvasSnapshotFns])

  useEffect(() => {
    if (!active) {
      try {
        simulationRef.current?.stop()
      } catch {
        void 0
      }
    }
  }, [active])

  const edgesForSim = useMemo(() => {
    return normalizeEdgesForSim((sceneGraphData?.nodes ?? []) as GraphNode[], (sceneGraphData?.edges ?? []) as GraphEdge[])
  }, [sceneGraphData])
  const flowState = useMemo(() => computeFlowState(sceneGraphData as GraphData | null), [sceneGraphData])

  const markdownDesignLayout: MarkdownDesignLayout | null = useMemo(() => {
    const markdownText = String(markdownDocumentText || '')
    if (!markdownText.trim()) return null
    const activeDocumentPath = String(markdownDocumentName || '').trim() || 'markdown'
    const markdownTokensKey = buildMarkdownTokensKey(markdownText)
    const lexed = lexMarkdown(markdownText)
    return deriveMarkdownDesignLayout({ activeDocumentPath, markdownTokensKey, tokens: lexed.tokens as never })
  }, [markdownDocumentName, markdownDocumentText])

  const nodeByIdForPanelsRef = useRef<{ rev: number; sim: d3.Simulation<GraphNode, GraphEdge> | null; map: Map<string, GraphNode> }>({
    rev: -1,
    sim: null,
    map: new Map(),
  })
  const graphBlockPanelLastPosRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const getNodeWorldCenterForId = useCallback((idRaw: string) => {
    const id = String(idRaw || '').trim()
    if (!id) return null
    const sim = simulationRef.current
    const graph = sceneGraphDataRef.current
    const graphNodes = Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
    const simNodes = sim ? (sim.nodes() as unknown as GraphNode[]) : []
    const rev = typeof graphDataRevision === 'number' && Number.isFinite(graphDataRevision) ? Math.floor(graphDataRevision) : 0
    const cached = nodeByIdForPanelsRef.current
    if (cached.rev !== rev || cached.sim !== sim) {
      const map = new Map<string, GraphNode>()
      for (let i = 0; i < graphNodes.length; i += 1) {
        const n = graphNodes[i]
        const key = String(n?.id || '').trim()
        if (!key) continue
        map.set(key, n)
      }
      for (let i = 0; i < simNodes.length; i += 1) {
        const n = simNodes[i]
        const key = String(n?.id || '').trim()
        if (!key) continue
        map.set(key, n)
      }
      nodeByIdForPanelsRef.current = { rev, sim: sim || null, map }
    }
    const n = nodeByIdForPanelsRef.current.map.get(id) || null
    return readNodeCenterWorld2d(n, { coords: 'center' })
  }, [graphDataRevision])

  const markdownAnchorNodeIdByBlockId = useMemo(() => {
    if (!markdownDesignLayout) return null
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData!.nodes as GraphNode[]) : []
    if (nodes.length === 0) return null

    const tableByStart = new Map<number, string>()
    const codeByStart = new Map<number, string>()
    const paraByStart = new Map<number, string>()
    const mediaIframeByStart = new Map<number, string>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]!
      const id = String(n?.id || '').trim()
      if (!id) continue
      const meta = n.metadata && typeof n.metadata === 'object' && !Array.isArray(n.metadata) ? (n.metadata as Record<string, unknown>) : null
      const lineStartRaw = meta ? meta.lineStart : null
      const lineStart = typeof lineStartRaw === 'number' ? lineStartRaw : typeof lineStartRaw === 'string' ? Number(lineStartRaw) : NaN
      if (!Number.isFinite(lineStart)) continue
      const start = Math.max(1, Math.floor(lineStart))
      const type = String(n.type || '').trim()
      if (type === 'Table' && !tableByStart.has(start)) tableByStart.set(start, id)
      else if (type === 'CodeBlock' && !codeByStart.has(start)) codeByStart.set(start, id)
      else if (type === 'Paragraph' && !paraByStart.has(start)) paraByStart.set(start, id)
      const spec = getNodeMediaSpec(n)
      if (spec?.kind === 'iframe' && !mediaIframeByStart.has(start)) mediaIframeByStart.set(start, id)
    }

    const out: Record<string, string> = {}
    for (let i = 0; i < markdownDesignLayout.blocks.length; i += 1) {
      const b = markdownDesignLayout.blocks[i]!
      const start = Math.max(1, Math.floor(Number(b.startLine) || 1))
      if (b.type === 'table') {
        const nid = tableByStart.get(start)
        if (nid) out[b.id] = nid
      } else if (b.type === 'code') {
        const nid = codeByStart.get(start)
        if (nid) out[b.id] = nid
      } else if (b.type === 'blockquote' || b.type === 'callout') {
        const nid = paraByStart.get(start)
        if (nid) out[b.id] = nid
      } else if (b.type === 'html') {
        const raw = String(b.preview.kind === 'html' ? (b.preview.html?.raw || '') : '').trim()
        if (/<\s*iframe\b/i.test(raw)) {
          const nid = mediaIframeByStart.get(start) || paraByStart.get(start)
          if (nid) out[b.id] = nid
        }
      }
    }
    return Object.keys(out).length ? out : null
  }, [markdownDesignLayout, sceneGraphData])

  const graphBlockPanel = useMemo(() => {
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData!.nodes as GraphNode[]) : []
    if (nodes.length === 0) return null

    const blocks: MarkdownDesignBlock[] = []
    const iframeNodeIds: string[] = []

    const sim = simulationRef.current
    const simNodes = sim ? (sim.nodes() as unknown as GraphNode[]) : []
    const simById = new Map<string, GraphNode>()
    for (let i = 0; i < simNodes.length; i += 1) {
      const n = simNodes[i]!
      const id = String(n?.id || '').trim()
      if (!id) continue
      simById.set(id, n)
    }
    const lastPos = graphBlockPanelLastPosRef.current
    const keepPosIds = new Set<string>()

    const getNum = (v: unknown): number | null => {
      if (typeof v === 'number' && Number.isFinite(v)) return v
      if (typeof v === 'string') {
        const n = Number(v)
        if (Number.isFinite(n)) return n
      }
      return null
    }

    const escapeAttr = (s: string): string => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]!
      const id = String(n?.id || '').trim()
      if (!id) continue
      const xGraph = getNum((n as unknown as { x?: unknown }).x)
      const yGraph = getNum((n as unknown as { y?: unknown }).y)
      const simNode = simById.get(id) || null
      const xSim = simNode ? getNum((simNode as unknown as { x?: unknown }).x) : null
      const ySim = simNode ? getNum((simNode as unknown as { y?: unknown }).y) : null
      const prev = lastPos.get(id) || null
      const x = xGraph ?? xSim ?? prev?.x ?? null
      const y = yGraph ?? ySim ?? prev?.y ?? null
      if (x == null || y == null) continue
      keepPosIds.add(id)
      lastPos.set(id, { x, y })

      const meta = n.metadata && typeof n.metadata === 'object' && !Array.isArray(n.metadata) ? (n.metadata as Record<string, unknown>) : null
      const lineStart = getNum(meta ? meta.lineStart : null)
      const lineEnd = getNum(meta ? meta.lineEnd : null)
      const startLine = Math.max(1, Math.floor(lineStart ?? 1))
      const endLine = Math.max(startLine, Math.floor(lineEnd ?? startLine))

      const propsObj = n.properties && typeof n.properties === 'object' && !Array.isArray(n.properties) ? (n.properties as Record<string, unknown>) : null
      const w = Math.max(1, Math.floor(getNum(propsObj ? propsObj['visual:width'] : null) ?? MARKDOWN_DESIGN_LAYOUT.block.widthPx))
      const h = Math.max(1, Math.floor(getNum(propsObj ? propsObj['visual:height'] : null) ?? MARKDOWN_DESIGN_LAYOUT.block.minHeightPx))

      const nodeType = String(n.type || '').trim()

      if (nodeType === 'Table') {
        const headerRaw = propsObj ? propsObj['table:header'] : null
        const rowsRaw = propsObj ? propsObj['table:rows'] : null
        const header = Array.isArray(headerRaw) ? headerRaw.map(v => String(v ?? '')) : []
        const rows = Array.isArray(rowsRaw)
          ? rowsRaw.map(r => (Array.isArray(r) ? r.map(v => String(v ?? '')) : [])).filter(r => r.length > 0)
          : []
        blocks.push({
          id,
          type: 'table',
          title: String(n.label || '').trim() || 'Table',
          summary: '',
          startLine,
          endLine,
          x: x - w / 2,
          y: y - h / 2,
          w,
          h,
          preview: { kind: 'table', table: { columns: header, rows, rowCount: rows.length } },
        })
        continue
      }

      if (nodeType === 'CodeBlock') {
        const lang = propsObj && typeof propsObj.language === 'string' ? String(propsObj.language || '') : ''
        const code = propsObj && typeof propsObj.code === 'string' ? String(propsObj.code || '') : ''
        const lines = code ? code.split(/\r?\n/).slice(0, 6) : []
        blocks.push({
          id,
          type: 'code',
          title: String(n.label || '').trim() || (lang ? `Code (${lang})` : 'Code'),
          summary: '',
          startLine,
          endLine,
          x: x - w / 2,
          y: y - h / 2,
          w,
          h,
          preview: { kind: 'code', code: { lang, lines } },
        })
        continue
      }

      if (nodeType === 'Paragraph') {
        const text = propsObj && typeof propsObj['text'] === 'string' ? String(propsObj['text'] || '') : ''
        const trimmed = text.trim()
        const isCallout = propsObj && propsObj.calloutType === true
        if (isCallout) {
          const calloutType = String(propsObj?.calloutKind || 'note')
          const title = String(propsObj?.calloutTitle || '').trim()
          const collapsed = String(propsObj?.calloutFoldable || '') === '-'
          blocks.push({
            id,
            type: 'blockquote',
            title: String(n.label || '').trim() || 'Callout',
            summary: '',
            startLine,
            endLine,
            x: x - w / 2,
            y: y - h / 2,
            w,
            h,
            preview: { kind: 'callout', callout: { calloutType, title, collapsed } },
          })
          continue
        }
        if (trimmed.startsWith('>')) {
          const lines = trimmed.split(/\r?\n/).map(l => l.replace(/^\s*>\s?/, '')).filter(Boolean).slice(0, 6)
          blocks.push({
            id,
            type: 'blockquote',
            title: String(n.label || '').trim() || 'Blockquote',
            summary: '',
            startLine,
            endLine,
            x: x - w / 2,
            y: y - h / 2,
            w,
            h,
            preview: { kind: 'blockquote', blockquote: { lines } },
          })
          continue
        }
      }

      const spec = getNodeMediaSpec(n)
      if (spec?.kind === 'iframe') {
        const url = String(spec.url || '').trim()
        if (!url) continue
        iframeNodeIds.push(id)
        const title = String(n.label || 'Iframe').trim() || 'Iframe'
        const raw = `<iframe src="${escapeAttr(url)}" title="${escapeAttr(title)}"></iframe>`
        blocks.push({
          id,
          type: 'html',
          title,
          summary: '',
          startLine,
          endLine,
          x: x - w / 2,
          y: y - h / 2,
          w,
          h,
          preview: { kind: 'html', html: { raw } },
        })
        continue
      }
    }

    for (const id of Array.from(lastPos.keys())) {
      if (!keepPosIds.has(id)) lastPos.delete(id)
    }

    if (blocks.length === 0) return null

    const sortedIframes = Array.from(new Set(iframeNodeIds)).sort((a, b) => a.localeCompare(b))
    const key = `graphBlocks|rev:${graphDataRevision || 0}|nodes:${nodes.length}`
    return {
      layout: { key, blocks } as MarkdownDesignLayout,
      panelOnlyNodeIdsKey: blocks.map(b => b.id).sort((a, b) => a.localeCompare(b)).join('|'),
      panelOnlyNodeIdSet: new Set(blocks.map(b => b.id)),
      iframeNodeIdsKey: sortedIframes.join('|'),
      iframeNodeIdSet: new Set(sortedIframes),
    }
  }, [graphDataRevision, sceneGraphData])

  const markdownPanelLineRanges = useMemo(() => {
    const layout = markdownDesignLayout
    if (!layout) return null
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
  }, [markdownDesignLayout])

  const { markdownIframeNodeIdsKey, markdownIframeNodeIdSet } = useMemo(() => {
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData!.nodes as GraphNode[]) : []
    const ids: string[] = []
    const iframeRanges = markdownPanelLineRanges?.iframe || null
    if (!iframeRanges || iframeRanges.size === 0) return { markdownIframeNodeIdsKey: '', markdownIframeNodeIdSet: new Set<string>() }
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]!
      const id = String(n?.id || '').trim()
      if (!id) continue
      const spec = getNodeMediaSpec(n)
      if (spec?.kind !== 'iframe') continue
      const meta = n.metadata && typeof n.metadata === 'object' && !Array.isArray(n.metadata) ? (n.metadata as Record<string, unknown>) : null
      const lineStartRaw = meta ? meta.lineStart : null
      const lineStart = typeof lineStartRaw === 'number' ? lineStartRaw : typeof lineStartRaw === 'string' ? Number(lineStartRaw) : NaN
      if (!Number.isFinite(lineStart)) continue
      const start = Math.max(1, Math.floor(lineStart))
      if (!iframeRanges.has(start)) continue
      ids.push(id)
    }
    const sorted = Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b))
    return { markdownIframeNodeIdsKey: sorted.join('|'), markdownIframeNodeIdSet: new Set(sorted) }
  }, [markdownPanelLineRanges, sceneGraphData])

  const panelIframeNodeIdsKey = graphBlockPanel ? graphBlockPanel.iframeNodeIdsKey : markdownIframeNodeIdsKey
  const panelIframeNodeIdSet = graphBlockPanel ? graphBlockPanel.iframeNodeIdSet : markdownIframeNodeIdSet

  const markdownPanelLayoutRef = React.useRef<MarkdownDesignLayout | null>(null)
  const markdownPanelLayoutLive = graphBlockPanel?.layout || markdownDesignLayout || null
  React.useEffect(() => {
    if (markdownPanelLayoutLive) markdownPanelLayoutRef.current = markdownPanelLayoutLive
  }, [markdownPanelLayoutLive])
  const markdownPanelLayoutForOverlay = markdownPanelLayoutLive || markdownPanelLayoutRef.current

  const markdownOverlayEnabled = active && (!!String(markdownDocumentText || '').trim() || !!markdownPanelLayoutForOverlay)

  const { panelOnlyNodeIdsKey, panelOnlyNodeIdSet } = useMemo(() => {
    if (graphBlockPanel) {
      return { panelOnlyNodeIdsKey: graphBlockPanel.panelOnlyNodeIdsKey, panelOnlyNodeIdSet: graphBlockPanel.panelOnlyNodeIdSet }
    }
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData!.nodes as GraphNode[]) : []
    const idsSet = new Set<string>()
    if (markdownAnchorNodeIdByBlockId) {
      const anchorIds = Object.values(markdownAnchorNodeIdByBlockId)
      for (let i = 0; i < anchorIds.length; i += 1) {
        const id = String(anchorIds[i] || '').trim()
        if (!id) continue
        idsSet.add(id)
      }
    }
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]!
      const id = String(n?.id || '').trim()
      if (!id) continue

      const nodeType = String(n.type || '').trim()
      if (nodeType === 'Table' || nodeType === 'CodeBlock') idsSet.add(id)

      if (panelIframeNodeIdSet.has(id)) idsSet.add(id)

      if (nodeType === 'Paragraph') {
        const propsObj = n.properties && typeof n.properties === 'object' && !Array.isArray(n.properties) ? (n.properties as Record<string, unknown>) : null
        const text = propsObj && typeof propsObj.text === 'string' ? String(propsObj.text || '').trim() : ''
        if (propsObj && propsObj.calloutType === true) idsSet.add(id)
        else if (text.startsWith('>')) idsSet.add(id)
        if (text && /<\s*iframe\b/i.test(text) && text.toLowerCase().startsWith('<iframe') && looksLikeSingleTagBlock(text, 'iframe')) {
          idsSet.add(id)
        }
      }

      if (!markdownPanelLineRanges) continue
      if (!id.startsWith('blk:')) continue
      const type = nodeType
      if (type !== 'Table' && type !== 'CodeBlock' && type !== 'Paragraph') continue
      const meta = n.metadata && typeof n.metadata === 'object' && !Array.isArray(n.metadata) ? (n.metadata as Record<string, unknown>) : null
      const lineStartRaw = meta ? meta.lineStart : null
      const lineStart = typeof lineStartRaw === 'number' ? lineStartRaw : typeof lineStartRaw === 'string' ? Number(lineStartRaw) : NaN
      if (!Number.isFinite(lineStart)) continue
      const start = Math.max(1, Math.floor(lineStart))
      if (type === 'Table' && markdownPanelLineRanges.table.has(start)) idsSet.add(id)
      else if (type === 'CodeBlock' && markdownPanelLineRanges.code.has(start)) idsSet.add(id)
      else if (type === 'Paragraph' && markdownPanelLineRanges.blockquote.has(start)) idsSet.add(id)
    }
    const sorted = Array.from(idsSet).sort((a, b) => a.localeCompare(b))
    return { panelOnlyNodeIdsKey: sorted.join('|'), panelOnlyNodeIdSet: new Set(sorted) }
  }, [graphBlockPanel, markdownAnchorNodeIdByBlockId, markdownPanelLineRanges, panelIframeNodeIdsKey, panelIframeNodeIdSet, sceneGraphData])

  const panelOnlyNodeIdSetRef = React.useRef<Set<string> | null>(null)
  const panelOnlyNodeIdsKeyRef = React.useRef<string>('')
  const [markdownOverlayVisibleNodeIds, setMarkdownOverlayVisibleNodeIds] = useState<string[]>([])
  React.useEffect(() => {
    if (panelOnlyNodeIdSet && panelOnlyNodeIdSet.size > 0) {
      panelOnlyNodeIdSetRef.current = panelOnlyNodeIdSet
      panelOnlyNodeIdsKeyRef.current = panelOnlyNodeIdsKey
    }
  }, [panelOnlyNodeIdSet, panelOnlyNodeIdsKey])

  const panelOnlyNodeIdsMerged = useMemo(() => {
    const out = new Set<string>()
    const base = panelOnlyNodeIdSet && panelOnlyNodeIdSet.size > 0 ? panelOnlyNodeIdSet : panelOnlyNodeIdSetRef.current
    if (base) {
      for (const id of base) out.add(id)
    }
    for (let i = 0; i < markdownOverlayVisibleNodeIds.length; i += 1) {
      const id = String(markdownOverlayVisibleNodeIds[i] || '').trim()
      if (!id) continue
      out.add(id)
    }
    return out
  }, [markdownOverlayVisibleNodeIds, panelOnlyNodeIdSet])
  const panelOnlyNodeIdsMergedKey = useMemo(
    () => Array.from(panelOnlyNodeIdsMerged).sort((a, b) => a.localeCompare(b)).join('|'),
    [panelOnlyNodeIdsMerged],
  )
  const panelOnlyNodeIdSetForScene = markdownOverlayEnabled ? panelOnlyNodeIdsMerged : null
  const panelOnlyNodeIdsKeyForScene = markdownOverlayEnabled ? panelOnlyNodeIdsMergedKey : ''
  const [overlayInteractionActive, setOverlayInteractionActive] = useState(false)
  React.useEffect(() => {
    if (!overlayInteractionActive) return
    const end = () => {
      setOverlayInteractionActive(false)
    }
    window.addEventListener('pointerup', end, { capture: true })
    window.addEventListener('pointercancel', end, { capture: true })
    window.addEventListener('blur', end)
    return () => {
      window.removeEventListener('pointerup', end, { capture: true } as AddEventListenerOptions)
      window.removeEventListener('pointercancel', end, { capture: true } as AddEventListenerOptions)
      window.removeEventListener('blur', end)
    }
  }, [overlayInteractionActive])

  const richMedia = useRichMediaOverlays2d({
    active,
    activeRef,
    svgRef,
    zoomRef,
    simulationRef,
    sceneGraphData,
    sceneGraphDataRef,
    graphDataRevision: graphDataRevision || 0,
    schemaRef: schemaRef as unknown as React.MutableRefObject<GraphSchema>,
    renderMediaAsNodes,
    mediaPanelDensity,
    excludeNodeIdsKey: panelIframeNodeIdsKey,
    excludeNodeIdSet: panelIframeNodeIdSet,
    threeIframeOverlayPoolMax,
    threeIframeOverlayBaseWidthRatioDefault,
    threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthMinPxDefault,
    threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlayBaseWidthMaxPxCompact,
    sceneWidth,
    sceneHeight,
    freezeOverlayMembership: overlayInteractionActive,
  })

  React.useEffect(() => {
    const hasHiddenSelected =
      (typeof selectedNodeId === 'string' &&
        selectedNodeId &&
        ((panelOnlyNodeIdSetForScene && panelOnlyNodeIdSetForScene.has(selectedNodeId)) ||
          (richMedia.mediaOverlayNodeIdSet && richMedia.mediaOverlayNodeIdSet.has(selectedNodeId)))) ||
      (Array.isArray(selectedNodeIds) &&
        selectedNodeIds.some(id =>
          (panelOnlyNodeIdSetForScene && panelOnlyNodeIdSetForScene.has(id)) ||
          (richMedia.mediaOverlayNodeIdSet && richMedia.mediaOverlayNodeIdSet.has(id)),
        ))
    if (!hasHiddenSelected) return
    try {
      selectNode(null)
    } catch {
      void 0
    }
  }, [panelOnlyNodeIdSetForScene, richMedia.mediaOverlayNodeIdSet, selectNode, selectedNodeId, selectedNodeIds])

  const overlayInteractions = useOverlayInteractions2d({
    activeRef,
    svgRef,
    zoomRef,
    simulationRef,
    sceneGraphDataRef,
    schemaRef: schemaRef as unknown as React.MutableRefObject<GraphSchema>,
    requestOverlaySchedule: richMedia.requestMediaOverlaySchedule,
  })

  useD3GraphScene2d({
    active,
    activeRef,
    svgRef,
    gRef,
    zoomRef,
    simulationRef,
    sceneGraphDataRef,
    sceneCleanupRef,
    sceneBuildKeyRef,
    beforeRenderFrameRef,
    beforeRenderFrameWrappedSourceRef,
    nodesSelRef,
    groupChevronSelRef,
    mediaSelRef,
    portHandlesSelRef,
    linksHitSelRef,
    linksSelRef,
    labelsSelRef,
    tempLinkSelRef,
    linkDragRef,
    schemaRef: schemaRef as unknown as React.MutableRefObject<GraphSchema>,
    schemaLayoutEngineJson,
    schemaNodesPresentationJson,
    schemaGroupsPresentationJson,
    nodesPresentationAppliedKeyRef,
    groupsPresentationAppliedKeyRef,
    activeLayoutCacheKeyRef,
    graphDataRevision: graphDataRevision || 0,
    graphDataRevisionRef,
    sceneWidth,
    sceneHeight,
    sceneGraphData,
    sceneGroupsDerivation,
    edgesForSim,
    effectiveFrontmatterModeEnabled,
    documentSemanticMode,
    layoutSemanticModeKey,
    canvasRenderMode,
    canvas2dRenderer,
    renderMediaAsNodes,
    mediaPanelDensity,
    viewportControlsPreset,
    collapsedGroupIdsKey,
    fitToScreenMode,
    zoomToSelectionMode,
    isEmbeddedPreview,
    coarsePointer: coarsePointer === true,
    mediaOverlayNodeIdSet: richMedia.mediaOverlayNodeIdSet,
    panelOnlyNodeIdsKey: panelOnlyNodeIdsKeyForScene,
    panelOnlyNodeIdSet: panelOnlyNodeIdSetForScene,
    overlayBaseWidthRatioDefault: threeIframeOverlayBaseWidthRatioDefault,
    overlayBaseWidthRatioCompact: threeIframeOverlayBaseWidthRatioCompact,
    overlayBaseWidthMinPxDefault: threeIframeOverlayBaseWidthMinPxDefault,
    overlayBaseWidthMinPxCompact: threeIframeOverlayBaseWidthMinPxCompact,
    overlayBaseWidthMaxPxDefault: threeIframeOverlayBaseWidthMaxPxDefault,
    overlayBaseWidthMaxPxCompact: threeIframeOverlayBaseWidthMaxPxCompact,
    requestMediaOverlaySchedule: richMedia.requestMediaOverlaySchedule,
    setLayoutPositionsForMode,
    selectedEdgeIdRef,
    selectedNodeIdRef,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    setHoverInfo,
  })

  useD3PresentationUpdates2d({
    activeRef,
    svgRef,
    gRef,
    zoomRef,
    simulationRef,
    sceneGraphDataRef,
    sceneGraphData,
    schemaRef: schemaRef as unknown as React.MutableRefObject<GraphSchema>,
    documentSemanticMode,
    coarsePointer: coarsePointer === true,
    sceneWidth,
    sceneHeight,
    schemaNodesPresentationJson,
    schemaGroupsPresentationJson,
    nodesPresentationAppliedKeyRef,
    groupsPresentationAppliedKeyRef,
    edgesForSim,
    sceneGroupsDerivation,
    renderMediaAsNodes,
    mediaPanelDensity,
    mediaOverlayNodeIdSet: richMedia.mediaOverlayNodeIdSet,
    panelOnlyNodeIdsKey,
    panelOnlyNodeIdSet,
    tempLinkSelRef,
    linkDragRef,
    nodesSelRef,
    groupChevronSelRef,
    mediaSelRef,
    portHandlesSelRef,
    labelsSelRef,
    beforeRenderFrameRef,
    selectedEdgeIdRef,
    setHoverInfo,
  })

  useSelectionHighlight({ paused: !active, nodesSelRef, mediaSelRef, labelsSelRef, linksSelRef })
  useGroupSelectionHighlight({ gRef, paused: !active })
  useSelectionRerenderSubscription2d({ active, beforeRenderFrameRef })
  useZoomScaleReapplySubscription2d({ active, svgRef, zoomRef })
  useFlowLabelPresentation2d({
    active,
    labelsSelRef,
    sceneGraphData,
    flowState: flowState as unknown as { valuesByNodeId: Record<string, unknown>; kindsByNodeId: Record<string, unknown> },
    schemaNodesPresentationJson,
  })
  useGraphCanvasStyles({
    gRef,
    nodesSelRef,
    linksSelRef,
    labelsSelRef,
    schema,
    documentSemanticMode: documentSemanticMode ?? undefined,
    paused: !active,
    graphDataRevision: graphDataRevisionRef.current ?? 0,
  })

  const arrange = useArrange2d({
    active,
    schema,
    svgRef,
    simulationRef,
    sceneGraphDataRef,
    activeLayoutCacheKeyRef,
    selectedNodeId,
    selectedNodeIds,
  })
  useArrangeKeyboardShortcuts2d({
    active,
    schema,
    selectedIds: arrange.selectedIds,
    applyArrange: arrange.applyArrange,
    svgRef,
    simulationRef,
    sceneGraphDataRef,
    activeLayoutCacheKeyRef,
  })
  useArrangeRequestEffect2d({
    active,
    graphCanvasArrangeRequest,
    clearGraphCanvasArrangeRequest,
    svgRef,
    sceneGraphDataRef,
    selectedNodeIdRef,
    selectedNodeIdsRef,
    sceneWidth,
    sceneHeight,
    simulationRef,
    activeLayoutCacheKeyRef,
  })

  const marquee = useMarqueeSelection2d({ active, schema: schema as GraphSchema | null, svgRef, sceneGraphDataRef })

  return (
    <main ref={containerRef} className={CANVAS_SURFACE_CLASS} role="main" aria-label="Graph Canvas">
      <ArrangeToolbar2d active={active} selectedCount={arrange.selectedIds.length} onArrange={arrange.applyArrange} />
      <InfiniteGridCanvasOverlay
        enabled={canvasGrid.enabled}
        gridSize={canvasGridStep}
        variant={canvasGrid.variant}
        majorEvery={canvasGrid.majorEvery}
        dotRadiusPx={canvasGrid.dotRadiusPx}
        width={width}
        height={height}
        dpr={dpr}
        getTransform={getZoomTransform}
        getEventTarget={getZoomEventTarget}
      />
      <svg
        ref={svgRef}
        className={`${CANVAS_INTERACTIVE_CLASS} z-10`}
        data-kg-canvas-interactive="1"
        viewBox={`0 0 ${Math.max(1, Math.floor(width))} ${Math.max(1, Math.floor(height))}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDownCapture={() => {
          try {
            resetGlobalUserSelectLock()
          } catch {
            void 0
          }
          try {
            setOverlayInteractionActive(false)
          } catch {
            void 0
          }
        }}
        onPointerDown={marquee.svgPointerHandlers.onPointerDown}
        onPointerMove={marquee.svgPointerHandlers.onPointerMove}
        onPointerUp={marquee.svgPointerHandlers.onPointerUp}
      />
      <RichMediaOverlayLayer2d
        active={active}
        mediaOverlayNodes={richMedia.mediaOverlayNodes}
        getOverlayRefForId={richMedia.getOverlayRefForId}
        svgRef={svgRef}
        renderMediaAsNodes={renderMediaAsNodes === true}
        stopEvent={overlayInteractions.stopEvent}
        onOverlayPanStart={args0 => {
          setOverlayInteractionActive(true)
          overlayInteractions.startOverlayPan(args0)
        }}
        onOverlayPan={overlayInteractions.moveOverlayPan}
        onOverlayPanEnd={args0 => {
          overlayInteractions.endOverlayPan(args0)
          setOverlayInteractionActive(false)
        }}
        onHeaderDragStart={({ id, clientX, clientY }) => {
          setOverlayInteractionActive(true)
          overlayInteractions.beginHeaderDrag(id, clientX, clientY)
        }}
        onHeaderDrag={({ dx, dy }) => overlayInteractions.moveHeaderDrag(dx, dy)}
        onHeaderDragEnd={() => {
          overlayInteractions.endHeaderDrag()
          setOverlayInteractionActive(false)
        }}
      />
      <MarqueeBoxOverlay marqueeBox={marquee.marqueeBox} />
      <GraphHoverTooltip
        hoverInfo={hoverInfo}
        containerRef={containerRef as unknown as React.RefObject<HTMLElement | null>}
        nodes={(sceneGraphData as GraphData | null)?.nodes}
        edges={(sceneGraphData as GraphData | null)?.edges}
        schema={schema as GraphSchema | null}
        onRequestClose={() => setHoverInfo(null)}
      />
      <MarkdownDesignOverlay
        enabled={markdownOverlayEnabled}
        svgRef={svgRef}
        markdownDocumentName={markdownDocumentName}
        markdownDocumentText={markdownDocumentText}
        allowedKinds={MARKDOWN_PANEL_ALLOWED_KINDS}
        layoutOverride={markdownPanelLayoutForOverlay}
        anchorNodeIdByBlockId={markdownAnchorNodeIdByBlockId}
        getNodeWorldCenterForId={getNodeWorldCenterForId}
        stopEvent={overlayInteractions.stopEvent}
        onOverlayPanStart={args0 => {
          setOverlayInteractionActive(true)
          overlayInteractions.startOverlayPan(args0)
        }}
        onOverlayPan={overlayInteractions.moveOverlayPan}
        onOverlayPanEnd={args0 => {
          overlayInteractions.endOverlayPan(args0)
          setOverlayInteractionActive(false)
        }}
        onHeaderDragStart={({ id, clientX, clientY }) => {
          setOverlayInteractionActive(true)
          overlayInteractions.beginHeaderDrag(id, clientX, clientY)
        }}
        onHeaderDrag={({ dx, dy }) => overlayInteractions.moveHeaderDrag(dx, dy)}
        onHeaderDragEnd={() => {
          overlayInteractions.endHeaderDrag()
          setOverlayInteractionActive(false)
        }}
        onVisibleNodeIdsChange={setMarkdownOverlayVisibleNodeIds}
      />
    </main>
  )
}
