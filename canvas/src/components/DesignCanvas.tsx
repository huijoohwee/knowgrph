import React, { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useContainerDims } from '@/hooks/useContainerDims'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import { pickZoomStateForView } from '@/lib/canvas/zoom-effective'
import { pickInitialZoomTransform } from '@/lib/zoom/viewport'
import { commitZoomTransformToStore } from '@/lib/canvas/zoom-commit'
import { CANVAS_INTERACTIVE_CLASS, CANVAS_SURFACE_CLASS } from '@/lib/canvas/surface'
import { invertZoomPoint } from '@/lib/canvas/viewport-transform'
import { readElementLocalPoint } from '@/lib/canvas/canvas-event-coords'
import { useZoomEffects } from '@/components/GraphCanvas/hooks/useZoomEffects'
import { createZoom } from '@/components/GraphCanvas/zoom'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import { relaxNodesWithCollision } from '@/components/GraphCanvas/layout/relax'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { useAutoZoomModes2d } from '@/features/zoom/useAutoZoomModes2d'
import type { WebpageLayoutSnapshot } from '@/lib/websites/webpageLayoutExport'
import { getCachedWebpageLayoutSnapshot, setCachedWebpageLayoutSnapshot } from '@/lib/websites/webpageLayoutCache'
import { convertWebpageLayoutToGraphData } from '@/lib/websites/webpageLayoutToGraph'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { normalizeWorkspacePath, workspaceDocumentKey } from '@/features/workspace-fs/path'
import { parseWebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'
import { createProgressTicker } from '@/lib/progress/progressTicker'
import type { WebpageDomProbeResult } from '@/lib/websites/webpageDomExport'

import type { GraphData, GraphNode } from '@/lib/graph/types'

type FrameNode = {
  id: string
  label: string
  type?: string
}

function coerceFrameNodes(nodes: Array<{ id?: unknown; label?: unknown }> | null | undefined): FrameNode[] {
  const src = Array.isArray(nodes) ? nodes : []
  const out: FrameNode[] = []
  for (let i = 0; i < src.length; i += 1) {
    const rawId = src[i]?.id
    const id = typeof rawId === 'string' ? rawId : String(rawId || '').trim()
    if (!id) continue
    const rawLabel = src[i]?.label
    const label = typeof rawLabel === 'string' && rawLabel.trim() ? rawLabel.trim() : id
    out.push({ id, label })
  }
  out.sort((a, b) => a.label.localeCompare(b.label))
  return out
}

function computeGridPositions(args: { nodes: FrameNode[]; colCount: number; colW: number; rowH: number; pad: number }):
  Record<string, { x: number; y: number; w: number; h: number }> {
  const nodes = args.nodes
  const cols = Math.max(1, Math.floor(args.colCount))
  const colW = Math.max(80, Math.floor(args.colW))
  const rowH = Math.max(64, Math.floor(args.rowH))
  const pad = Math.max(8, Math.floor(args.pad))
  const pos: Record<string, { x: number; y: number; w: number; h: number }> = {}

  const rows = Math.max(1, Math.ceil(nodes.length / Math.max(1, cols)))
  const gridW = cols * colW + Math.max(0, cols - 1) * pad
  const gridH = rows * rowH + Math.max(0, rows - 1) * pad
  const startX = -gridW / 2
  const startY = -gridH / 2

  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const col = i % cols
    const row = Math.floor(i / cols)
    pos[n.id] = {
      x: startX + col * (colW + pad),
      y: startY + row * (rowH + pad),
      w: colW,
      h: rowH,
    }
  }
  return pos
}

function tryExtractDocumentUrl(graphData: GraphData | null): string | null {
  const meta = graphData?.metadata && typeof graphData.metadata === 'object' ? (graphData.metadata as Record<string, unknown>) : null
  const direct = meta && typeof meta.documentUrl === 'string' ? meta.documentUrl.trim() : ''
  if (direct && /^https?:\/\//i.test(direct)) return direct
  const urlish =
    meta && typeof meta.url === 'string'
      ? meta.url.trim()
      : meta && typeof meta.href === 'string'
        ? meta.href.trim()
        : meta && typeof meta.sourceUrl === 'string'
          ? meta.sourceUrl.trim()
          : ''
  if (urlish && /^https?:\/\//i.test(urlish)) return urlish
  const layers = meta?.sourceLayers
  if (!Array.isArray(layers)) return null
  for (let i = 0; i < layers.length; i += 1) {
    const layer = layers[i] as Record<string, unknown> | null
    const src = layer?.source as Record<string, unknown> | null
    if (!src || src.kind !== 'url') continue
    const u = typeof src.url === 'string' ? src.url.trim() : ''
    if (u && /^https?:\/\//i.test(u)) return u
  }
  const nodes = Array.isArray(graphData?.nodes) ? (graphData!.nodes! as unknown as Array<Record<string, unknown>>) : []
  for (let i = 0; i < Math.min(150, nodes.length); i += 1) {
    const n = nodes[i]
    const nm = n && typeof n === 'object' && 'metadata' in n ? ((n as { metadata?: unknown }).metadata as Record<string, unknown> | null) : null
    if (!nm) continue
    const u = typeof nm.documentUrl === 'string' ? nm.documentUrl.trim() : ''
    if (u && /^https?:\/\//i.test(u)) return u
    const u2 =
      typeof nm.url === 'string'
        ? nm.url.trim()
        : typeof nm.href === 'string'
          ? nm.href.trim()
          : typeof nm.sourceUrl === 'string'
            ? nm.sourceUrl.trim()
            : ''
    if (u2 && /^https?:\/\//i.test(u2)) return u2
  }
  return null
}

function tryExtractWebpageWorkspacePath(graphData: GraphData | null): string | null {
  const meta = graphData?.metadata && typeof graphData.metadata === 'object' ? (graphData.metadata as Record<string, unknown>) : null
  const layers = meta?.sourceLayers
  if (!Array.isArray(layers)) return null
  for (let i = 0; i < layers.length; i += 1) {
    const layer = layers[i] as Record<string, unknown> | null
    const src = layer?.source as Record<string, unknown> | null
    const path =
      src && typeof src.path === 'string'
        ? String(src.path || '').trim()
        : layer && typeof layer.path === 'string'
          ? String(layer.path || '').trim()
          : ''
    if (!path.startsWith('workspace:')) continue
    const rel = path.slice('workspace:'.length)
    const normalized = normalizeWorkspacePath(rel)
    if (normalized) return normalized
  }
  return null
}

function tryExtractDocumentPaths(graphData: GraphData | null): string[] {
  const out: string[] = []
  const meta = graphData?.metadata && typeof graphData.metadata === 'object' ? (graphData.metadata as Record<string, unknown>) : null
  const docPath = meta && typeof meta.documentPath === 'string' ? meta.documentPath.trim() : ''
  if (docPath) out.push(docPath)
  const nodes = Array.isArray(graphData?.nodes) ? (graphData!.nodes! as unknown as Array<Record<string, unknown>>) : []
  for (let i = 0; i < Math.min(80, nodes.length); i += 1) {
    const n = nodes[i]
    const nm = n && typeof n === 'object' && 'metadata' in n ? ((n as { metadata?: unknown }).metadata as Record<string, unknown> | null) : null
    if (!nm) continue
    const p = typeof nm.documentPath === 'string' ? nm.documentPath.trim() : ''
    if (p) out.push(p)
  }
  const unique = new Set<string>()
  const cleaned: string[] = []
  for (let i = 0; i < out.length; i += 1) {
    const raw = String(out[i] || '').trim()
    if (!raw) continue
    const noHash = raw.split('#')[0] || raw
    const noQuery = noHash.split('?')[0] || noHash
    const k = noQuery.replace(/^\/+/, '').trim()
    if (!k) continue
    if (unique.has(k)) continue
    unique.add(k)
    cleaned.push(k)
  }
  return cleaned.slice(0, 6)
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
  const dims = useContainerDims(containerRef)

  const snapshot = useGraphStore(
    useShallow(s => ({
      graphData: s.graphData,
      graphDataRevision: s.graphDataRevision,
      schema: s.schema,
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
      documentSemanticMode: s.documentSemanticMode,
      frontmatterModeEnabled: s.frontmatterModeEnabled,
      documentStructureBaselineLock: s.documentStructureBaselineLock,
      renderMediaAsNodes: s.renderMediaAsNodes,
      mediaPanelDensity: s.mediaPanelDensity,
      collapsedGroupIds: s.collapsedGroupIds,
      zoomStateByKey: s.zoomStateByKey,
      viewPinned: s.viewPinned,
      fitToScreenMode: s.fitToScreenMode,
      zoomToSelectionMode: s.zoomToSelectionMode,
      selectedNodeId: s.selectedNodeId,
      viewportControlsPreset: s.viewportControlsPreset,
      designLayerState: s.designLayerState,
      designFramePosById: s.designFramePosById,
      setDesignFramePosMany: s.setDesignFramePosMany,
      setDesignRendererNodes: s.setDesignRendererNodes,
      setDesignRendererWebpageGraph: s.setDesignRendererWebpageGraph,
    })),
  )

  const directDocumentUrl = useMemo(() => tryExtractDocumentUrl(snapshot.graphData as GraphData | null), [snapshot.graphData])
  const [documentUrl, setDocumentUrl] = React.useState<string | null>(directDocumentUrl)
  const [webpageLayout, setWebpageLayout] = React.useState<WebpageLayoutSnapshot | null>(null)
  const [webpageLayoutStatus, setWebpageLayoutStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [webpageLayoutProgress, setWebpageLayoutProgress] = React.useState<number>(0)
  const [webpageLayoutMessage, setWebpageLayoutMessage] = React.useState<string>('')
  const [webpageLayoutRetryNonce, setWebpageLayoutRetryNonce] = React.useState<number>(0)
  const lastWebpageLayoutUrlRef = useRef<string>('')
  const lastWebpageLayoutReqRef = useRef<number>(0)

  useEffect(() => {
    setDocumentUrl(directDocumentUrl)
  }, [directDocumentUrl])

  useEffect(() => {
    if (!active) return
    if (directDocumentUrl) return
    const graph = snapshot.graphData as GraphData | null
    const p = tryExtractWebpageWorkspacePath(graph)
    let cancelled = false
    void (async () => {
      const fs = await getWorkspaceFs()
      const candidates: string[] = []
      if (p) candidates.push(p)

      if (candidates.length === 0) {
        const docKeys = tryExtractDocumentPaths(graph)
        if (docKeys.length > 0) {
          const entries = await fs.listEntries().catch(() => [])
          const byDocKey = new Map<string, string>()
          for (let i = 0; i < entries.length; i += 1) {
            const e = entries[i] as { kind?: unknown; path?: unknown } | null
            if (!e || e.kind !== 'file') continue
            const wp = normalizeWorkspacePath(e.path)
            const dk = workspaceDocumentKey(wp)
            if (!dk) continue
            if (!byDocKey.has(dk)) byDocKey.set(dk, wp)
          }
          for (let i = 0; i < docKeys.length; i += 1) {
            const match = byDocKey.get(docKeys[i] || '')
            if (match) candidates.push(match)
          }
        }
      }

      for (let i = 0; i < candidates.length; i += 1) {
        if (cancelled) return
        const text = await fs.readFileText(candidates[i]!).catch(() => '')
        const fm = parseWebpageFrontmatterMeta(text)
        const url = String(fm?.url || '').trim()
        if (!url || !/^https?:\/\//i.test(url)) continue
        if (!cancelled) setDocumentUrl(url)
        return
      }
    })()
    return () => {
      cancelled = true
    }
  }, [active, directDocumentUrl, snapshot.graphData])

  useEffect(() => {
    if (!active) return
    const url = String(documentUrl || '').trim()
    if (!url) {
      lastWebpageLayoutUrlRef.current = ''
      setWebpageLayout(null)
      setWebpageLayoutStatus('idle')
      setWebpageLayoutProgress(0)
      setWebpageLayoutMessage('')
      return
    }
    lastWebpageLayoutUrlRef.current = url
    const reqId = (lastWebpageLayoutReqRef.current += 1)
    let cancelled = false
    const allowCache = webpageLayoutRetryNonce <= 0
    if (allowCache) {
      const cached = getCachedWebpageLayoutSnapshot(url)
      if (cached) {
        setWebpageLayout(cached)
        setWebpageLayoutStatus('ready')
        setWebpageLayoutProgress(100)
        setWebpageLayoutMessage('Loaded from cache')
        return
      }
    }
    setWebpageLayoutStatus('loading')
    setWebpageLayoutProgress(0)
    setWebpageLayoutMessage('Loading webpage for wireframe…')
    const ticker = createProgressTicker({
      onProgress: (p) => setWebpageLayoutProgress(p),
      intervalMs: 280,
      maxPercentage: 92,
      maxStepPercentage: 12,
    })
    void (async () => {
      try {
        ticker.start()
        const { probeWebpageDomViaHiddenIframe } = await import('@/lib/websites/webpageDomExport')
        const probe = await probeWebpageDomViaHiddenIframe({
          url,
          mode: 'layout',
          maxElements: 1400,
          scrollCrawl: true,
          expandFaq: true,
          timeoutMs: 45_000,
          waitForNetworkIdle: true,
          networkIdleMs: 900,
          minWaitAfterLoadMs: 1200,
        })
        if (cancelled) return
        if (reqId !== lastWebpageLayoutReqRef.current) return
        if (!probe.ok) {
          const fail = probe as Extract<WebpageDomProbeResult, { ok: false }>
          ticker.stop()
          setWebpageLayout(null)
          setWebpageLayoutStatus('error')
          setWebpageLayoutMessage(`Export failed (${fail.stage}): ${fail.error}`)
          try {
            useGraphStore.getState().pushUiToast({
              id: 'design-webpage-layout-failed',
              kind: 'warning',
              message: `Webpage wireframe export failed (${fail.stage}): ${fail.error}`,
              ttlMs: 8000,
            })
          } catch {
            void 0
          }
          return
        }
        const res = probe.result
        if (!res?.text) {
          ticker.stop()
          setWebpageLayout(null)
          setWebpageLayoutStatus('error')
          setWebpageLayoutMessage('Export failed: empty result')
          return
        }
        const snap = (() => {
          try {
            const parsed = JSON.parse(res.text) as unknown
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
            const obj = parsed as Record<string, unknown>
            const meta = obj.meta as Record<string, unknown> | null
            const elements = obj.elements as unknown
            if (!meta || typeof meta !== 'object') return null
            if (!Array.isArray(elements)) return null
            if (meta.kind !== 'layout') return null
            return parsed as WebpageLayoutSnapshot
          } catch {
            return null
          }
        })()
        if (!snap) {
          ticker.stop()
          setWebpageLayout(null)
          setWebpageLayoutStatus('error')
          setWebpageLayoutMessage('Export failed: invalid snapshot payload')
          return
        }
        setCachedWebpageLayoutSnapshot(url, snap)
        setWebpageLayout(snap)
        setWebpageLayoutStatus('ready')
        ticker.stop(100)
        const n = Array.isArray(snap.elements) ? snap.elements.length : 0
        setWebpageLayoutMessage(`Wireframe ready — elements=${n}`)
      } catch (e) {
        if (cancelled) return
        if (reqId !== lastWebpageLayoutReqRef.current) return
        ticker.stop()
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message || '') : ''
        setWebpageLayout(null)
        setWebpageLayoutStatus('error')
        setWebpageLayoutMessage(`Export failed: ${msg || 'Request failed'}`)
        try {
          useGraphStore.getState().pushUiToast({
            id: 'design-webpage-layout-failed',
            kind: 'warning',
            message: `Webpage wireframe export failed: ${msg || 'Request failed'}`,
            ttlMs: 8000,
          })
        } catch {
          void 0
        }
      } finally {
        try {
          ticker.stop()
        } catch {
          void 0
        }
      }
    })()
    return () => {
      cancelled = true
      try {
        ticker.stop()
      } catch {
        void 0
      }
    }
  }, [active, documentUrl, webpageLayoutRetryNonce])

  const designGraphDataForDisplay = useMemo(() => {
    const g = snapshot.graphData
    if (!g) return null
    return deriveSceneDisplayGraph({ graphData: g as GraphData })?.displayGraphData || (g as GraphData)
  }, [snapshot.graphData])

  const webpageLayoutGraphData = useMemo(() => {
    if (!webpageLayout) return null
    const href = String(webpageLayout?.meta?.href || documentUrl || '').trim()
    const host = (() => {
      if (!href) return ''
      try {
        return new URL(href).hostname.toLowerCase()
      } catch {
        return ''
      }
    })()
    const vpW = typeof webpageLayout.meta?.viewport?.w === 'number' ? webpageLayout.meta.viewport.w : null
    const vpH = typeof webpageLayout.meta?.viewport?.h === 'number' ? webpageLayout.meta.viewport.h : null
    const vpArea = vpW != null && vpH != null && Number.isFinite(vpW) && Number.isFinite(vpH) ? vpW * vpH : null
    const baseMinAreaPx = (() => {
      if (vpArea != null && vpArea > 0) {
        const scaled = Math.round(vpArea * 0.012)
        return Math.max(6000, Math.min(30_000, scaled))
      }
      return 9000
    })()
    const isAstroBuild = host === 'astro.build' || host.endsWith('.astro.build')
    const primary = {
      minAreaPx: isAstroBuild ? Math.max(8000, Math.min(38_000, Math.round(baseMinAreaPx * 1.15))) : baseMinAreaPx,
      maxNodes: isAstroBuild ? 1100 : 1400,
    }
    const secondary = {
      minAreaPx: isAstroBuild ? 6500 : Math.max(5000, Math.round(baseMinAreaPx * 0.85)),
      maxNodes: isAstroBuild ? 1800 : 2000,
    }
    const tertiary = {
      minAreaPx: 1,
      maxNodes: 3000,
    }
    const g1 = convertWebpageLayoutToGraphData(webpageLayout, { maxNodes: primary.maxNodes, minAreaPx: primary.minAreaPx })
    const n1 = Array.isArray(g1?.nodes) ? g1.nodes.length : 0
    if (n1 >= 18) return g1
    const g2 = convertWebpageLayoutToGraphData(webpageLayout, { maxNodes: secondary.maxNodes, minAreaPx: secondary.minAreaPx })
    const n2 = Array.isArray(g2?.nodes) ? g2.nodes.length : 0
    const best = n2 > n1 ? g2 : g1
    const bestN = Math.max(n1, n2)
    if (bestN >= 8) return best
    const g3 = convertWebpageLayoutToGraphData(webpageLayout, { maxNodes: tertiary.maxNodes, minAreaPx: tertiary.minAreaPx })
    const n3 = Array.isArray(g3?.nodes) ? g3.nodes.length : 0
    return n3 > bestN ? g3 : best
  }, [documentUrl, webpageLayout])

  useEffect(() => {
    if (!documentUrl) return
    if (webpageLayoutStatus !== 'ready') return
    const elCount = Array.isArray(webpageLayout?.elements) ? webpageLayout!.elements.length : 0
    const nodeCount = Array.isArray(webpageLayoutGraphData?.nodes) ? webpageLayoutGraphData!.nodes.length : 0
    if (nodeCount > 0) setWebpageLayoutMessage(`Wireframe ready — elements=${elCount}, nodes=${nodeCount}`)
    else setWebpageLayoutMessage(`Wireframe ready — elements=${elCount}, nodes=0`)
  }, [documentUrl, webpageLayout?.elements, webpageLayoutGraphData, webpageLayoutStatus])

  const webpageLayoutKey = useMemo(() => {
    const url = String(documentUrl || '').trim()
    if (!url) return null
    const ts = typeof webpageLayout?.meta?.ts === 'number' && Number.isFinite(webpageLayout.meta.ts) ? webpageLayout.meta.ts : null
    const n = Array.isArray(webpageLayout?.elements) ? webpageLayout.elements.length : null
    if (ts == null || n == null) return null
    return `${url}#${ts}#${n}`
  }, [documentUrl, webpageLayout?.elements, webpageLayout?.meta?.ts])

  const webpageGraphNodesById = useMemo(() => {
    if (!webpageLayoutGraphData?.nodes || webpageLayoutGraphData.nodes.length === 0) return null
    const out: Record<string, GraphNode> = {}
    for (let i = 0; i < webpageLayoutGraphData.nodes.length; i += 1) {
      const n = webpageLayoutGraphData.nodes[i] as GraphNode
      const id = String(n.id || '').trim()
      if (!id) continue
      out[id] = n
    }
    return out
  }, [webpageLayoutGraphData])

  useEffect(() => {
    if (!active) {
      snapshot.setDesignRendererWebpageGraph({ key: null, nodesById: {} })
      return
    }
    if (webpageLayoutKey && webpageGraphNodesById) snapshot.setDesignRendererWebpageGraph({ key: webpageLayoutKey, nodesById: webpageGraphNodesById })
    else snapshot.setDesignRendererWebpageGraph({ key: null, nodesById: {} })
  }, [active, snapshot.setDesignRendererWebpageGraph, webpageGraphNodesById, webpageLayoutKey])

  const baseFrameNodes = useMemo(() => {
    if (webpageLayoutGraphData?.nodes && webpageLayoutGraphData.nodes.length > 0) {
      const out: FrameNode[] = []
      for (let i = 0; i < webpageLayoutGraphData.nodes.length; i += 1) {
        const n = webpageLayoutGraphData.nodes[i] as GraphNode
        const props = (n.properties || {}) as Record<string, unknown>
        const tag = typeof props['dom:tag'] === 'string' ? String(props['dom:tag'] || '').trim() : ''
        const id = String(n.id || '').trim()
        if (!id) continue
        const label = String(n.label || n.id || '').trim() || id
        out.push({ id, label, ...(tag ? { type: tag } : {}) })
      }
      return out
    }
    if (documentUrl) return []
    return coerceFrameNodes(designGraphDataForDisplay?.nodes as never)
  }, [designGraphDataForDisplay, documentUrl, webpageLayoutGraphData, webpageLayoutStatus])

  const FRAME_W = 320
  const FRAME_H = 240
  const GAP = 48

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

  const positions = useMemo(() => {
    const overrides = snapshot.designFramePosById || {}
    const out: Record<string, { x: number; y: number; w: number; h: number }> = {}
    if (webpageLayoutGraphData?.nodes && webpageLayoutGraphData.nodes.length > 0) {
      const byId = new Map<string, GraphNode>()
      for (let i = 0; i < webpageLayoutGraphData.nodes.length; i += 1) {
        const n = webpageLayoutGraphData.nodes[i] as GraphNode
        byId.set(String(n.id), n)
      }
      for (let i = 0; i < visibleNodes.length; i += 1) {
        const n = visibleNodes[i]
        const base = byId.get(n.id)
        if (!base) continue
        const props = (base.properties || {}) as Record<string, unknown>
        const w = typeof props['visual:width'] === 'number' ? (props['visual:width'] as number) : FRAME_W
        const h = typeof props['visual:height'] === 'number' ? (props['visual:height'] as number) : FRAME_H
        const cx = typeof base.x === 'number' && Number.isFinite(base.x) ? base.x : 0
        const cy = typeof base.y === 'number' && Number.isFinite(base.y) ? base.y : 0
        const basePos = { x: cx - w / 2, y: cy - h / 2, w, h }
        const o = overrides[n.id]
        if (o && Number.isFinite(o.x) && Number.isFinite(o.y)) out[n.id] = { x: o.x, y: o.y, w: basePos.w, h: basePos.h }
        else out[n.id] = basePos
      }
      return out
    }
    const viewportW = Math.max(1, dims.width)
    const maxCols = Math.max(1, Math.floor((viewportW + GAP) / (FRAME_W + GAP)))
    const colCount = Math.max(1, Math.min(10, maxCols || 4))
    const grid = computeGridPositions({ nodes: visibleNodes, colCount, colW: FRAME_W, rowH: FRAME_H, pad: GAP })
    for (let i = 0; i < visibleNodes.length; i += 1) {
      const n = visibleNodes[i]
      const base = grid[n.id]
      if (!base) continue
      const o = overrides[n.id]
      if (o && Number.isFinite(o.x) && Number.isFinite(o.y)) {
        out[n.id] = { x: o.x, y: o.y, w: base.w, h: base.h }
      } else {
        out[n.id] = base
      }
    }
    return out
  }, [dims.width, snapshot.designFramePosById, visibleNodes, webpageLayoutGraphData])

  const localGraphData: GraphData = useMemo(() => {
    if (webpageLayoutGraphData?.nodes && webpageLayoutGraphData.nodes.length > 0) {
      const byId = new Map<string, GraphNode>()
      for (let i = 0; i < webpageLayoutGraphData.nodes.length; i += 1) {
        const n = webpageLayoutGraphData.nodes[i] as GraphNode
        byId.set(String(n.id), n)
      }
      return {
        type: 'Graph',
        context: webpageLayoutGraphData.context,
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
        metadata: webpageLayoutGraphData.metadata,
      }
    }
    return {
      type: 'Graph',
      nodes: visibleNodes.map(n => {
        const p = positions[n.id]
        if (!p) return { id: n.id, label: n.label, type: 'Frame', properties: {}, x: 0, y: 0 }
        return {
          id: n.id,
          label: n.label,
          type: 'Frame',
          properties: {
            'visual:width': p.w,
            'visual:height': p.h,
            'visual:shape': 'rect',
          },
          x: p.x + p.w / 2,
          y: p.y + p.h / 2,
        }
      }),
      edges: [],
      metadata: snapshot.graphData?.metadata,
    }
  }, [positions, snapshot.graphData?.metadata, visibleNodes, webpageLayoutGraphData])

  const localGraphDataRef = useRef<GraphData>(localGraphData)
  useEffect(() => {
    localGraphDataRef.current = localGraphData
  }, [localGraphData])

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
      const total = Array.isArray(webpageLayoutGraphData?.nodes) ? webpageLayoutGraphData!.nodes.length : 0
      if (total > 0) {
        const hidden = snapshot.designLayerState?.hiddenById || {}
        let hiddenCount = 0
        for (let i = 0; i < webpageLayoutGraphData!.nodes.length; i += 1) {
          const id = String((webpageLayoutGraphData!.nodes[i] as GraphNode)?.id || '').trim()
          if (!id) continue
          if (hidden[id] === true) hiddenCount += 1
        }
        if (hiddenCount >= total) {
          const ids: string[] = []
          for (let i = 0; i < webpageLayoutGraphData!.nodes.length; i += 1) {
            const id = String((webpageLayoutGraphData!.nodes[i] as GraphNode)?.id || '').trim()
            if (id) ids.push(id)
          }
          try {
            useGraphStore.getState().setDesignLayerState({ order: ids, hiddenById: {} })
          } catch {
            void 0
          }
          setWebpageLayoutMessage('All wireframe layers were hidden. Reset visibility.')
          lastAutoFitWireframeKeyRef.current = ''
          return
        }
      }
      setWebpageLayoutStatus('error')
      const elCount = Array.isArray(webpageLayout?.elements) ? webpageLayout!.elements.length : 0
      setWebpageLayoutMessage(`Wireframe is empty (0 nodes). elements=${elCount}, convertedNodes=${total}. Click Retry.`)
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
  }, [active, dims.height, dims.width, documentUrl, snapshot.designLayerState?.hiddenById, snapshot.schema, webpageLayout?.meta?.ts, webpageLayoutGraphData, webpageLayoutStatus])

  const setDesignFramePosMany = snapshot.setDesignFramePosMany

  const frameElByIdRef = useRef<Map<string, SVGGElement>>(new Map())
  const dragRef = useRef<null | { id: string; startWorld: { x: number; y: number }; startPos: { x: number; y: number } }>(null)
  const dragRafRef = useRef<number | null>(null)
  const dragPendingRef = useRef<null | { id: string; nextPos: { x: number; y: number } }>(null)
  const lastInitKeyRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (dragRafRef.current != null) {
        try {
          window.cancelAnimationFrame(dragRafRef.current)
        } catch {
          void 0
        }
        dragRafRef.current = null
      }
      dragPendingRef.current = null
      dragRef.current = null
    }
  }, [])

  const scheduleDragVisual = useMemo(() => {
    return () => {
      if (dragRafRef.current != null) return
      dragRafRef.current = window.requestAnimationFrame(() => {
        dragRafRef.current = null
        const pending = dragPendingRef.current
        if (!pending) return
        const el = frameElByIdRef.current.get(pending.id)
        if (!el) return
        try {
          el.setAttribute('transform', `translate(${pending.nextPos.x},${pending.nextPos.y})`)
        } catch {
          void 0
        }
      })
    }
  }, [])

  const pointerToWorld = useMemo(() => {
    return (ev: React.PointerEvent, svgEl: SVGSVGElement): { x: number; y: number } | null => {
      const local = readElementLocalPoint({ el: svgEl, event: ev })
      if (!local) return null
      const t = d3.zoomTransform(svgEl)
      return invertZoomPoint(t, local)
    }
  }, [])

  const dimsRef = useRef({ width: dims.width, height: dims.height })
  useEffect(() => {
    dimsRef.current = { width: dims.width, height: dims.height }
  }, [dims.width, dims.height])

  const zoomCommitRafRef = useRef<number | null>(null)
  const pendingZoomTransformRef = useRef<{ k: number; x: number; y: number } | null>(null)

  const zoomViewKey = useMemo(() => {
    const base = buildActive2dZoomViewKey({
      canvasRenderMode: snapshot.canvasRenderMode,
      canvas2dRenderer: snapshot.canvas2dRenderer,
      schema: snapshot.schema,
      graphData: snapshot.graphData,
      documentSemanticMode: snapshot.documentSemanticMode,
      frontmatterModeEnabled: snapshot.frontmatterModeEnabled,
      documentStructureBaselineLock: snapshot.documentStructureBaselineLock,
      renderMediaAsNodes: snapshot.renderMediaAsNodes,
      mediaPanelDensity: snapshot.mediaPanelDensity,
      collapsedGroupIds: snapshot.collapsedGroupIds,
    })
    const url = String(documentUrl || '').trim()
    if (!url) return base
    return `${base}::webpage:${url}`
  }, [
    snapshot.canvas2dRenderer,
    snapshot.canvasRenderMode,
    snapshot.collapsedGroupIds,
    snapshot.documentSemanticMode,
    snapshot.documentStructureBaselineLock,
    snapshot.frontmatterModeEnabled,
    snapshot.graphData,
    snapshot.mediaPanelDensity,
    snapshot.renderMediaAsNodes,
    snapshot.schema,
    documentUrl,
  ])

  const zoomViewKeyRef = useRef<string | null>(null)
  useEffect(() => {
    zoomViewKeyRef.current = zoomViewKey
  }, [zoomViewKey])

  useZoomEffects({
    svgRef,
    zoomRef,
    width: dims.width,
    height: dims.height,
    paused: !active,
    graphDataOverride: localGraphData,
  })

  useAutoZoomModes2d({
    viewportW: dims.width,
    viewportH: dims.height,
    paused: !active,
    getGraph: () => ({ graphData: localGraphData, graphDataRevision: snapshot.graphDataRevision || 0 }),
  })

  useEffect(() => {
    if (!active) return
    if (!svgRef.current || !gRef.current) return
    const svgEl = svgRef.current
    const gEl = gRef.current

    const svg = d3.select(svgEl)
    const g = d3.select(gEl)

    const zoom = createZoom(svg, g, labelsSelRef, snapshot.schema, snapshot.viewportControlsPreset, t => {
      if (!active) return
      pendingZoomTransformRef.current = { k: t.k, x: t.x, y: t.y }
      if (zoomCommitRafRef.current != null) return
      zoomCommitRafRef.current = requestAnimationFrame(() => {
        zoomCommitRafRef.current = null
        const pending = pendingZoomTransformRef.current
        pendingZoomTransformRef.current = null
        if (!pending) return
        const store = useGraphStore.getState()
        const key = zoomViewKeyRef.current
        if (!key) return
        const d = dimsRef.current
        commitZoomTransformToStore({
          state: {
            viewPinned: store.viewPinned,
            zoomState: store.zoomState,
            zoomStateByKey: store.zoomStateByKey,
            setZoomState: store.setZoomState,
            setZoomStateForKey: store.setZoomStateForKey,
          },
          zoomViewKey: key,
          transform: { k: pending.k, x: pending.x, y: pending.y },
          viewportW: d.width,
          viewportH: d.height,
          graphDataRevision: store.graphDataRevision,
        })
      })
    })

    zoomRef.current = zoom

    const store = useGraphStore.getState()
    const initialZoomState = pickZoomStateForView({
      zoomViewKey,
      zoomStateByKey: store.zoomStateByKey,
      viewPinned: store.viewPinned,
      fitToScreenMode: store.fitToScreenMode,
      zoomToSelectionMode: store.zoomToSelectionMode,
    })

    const initial = pickInitialZoomTransform({
      zoomState: initialZoomState,
      pinned: store.viewPinned,
      graphDataRevision: store.graphDataRevision,
      nextViewportW: dims.width,
      nextViewportH: dims.height,
    })

    const initKey = zoomViewKey
    const alreadyInitialized = lastInitKeyRef.current === initKey
    const t0 = d3.zoomTransform(svgEl)
    const hasNonIdentityTransform = t0.k !== 1 || t0.x !== 0 || t0.y !== 0

    const autoZoomActive = store.viewPinned !== true && (store.fitToScreenMode || store.zoomToSelectionMode)

    if (!alreadyInitialized || !hasNonIdentityTransform) {
      if (!alreadyInitialized && !autoZoomActive && hasNonIdentityTransform && !initial) {
        if (zoomViewKey && !store.zoomStateByKey?.[zoomViewKey]) {
          commitZoomTransformToStore({
            state: {
              viewPinned: store.viewPinned,
              zoomState: store.zoomState,
              zoomStateByKey: store.zoomStateByKey,
              setZoomState: store.setZoomState,
              setZoomStateForKey: store.setZoomStateForKey,
            },
            zoomViewKey,
            transform: { k: t0.k, x: t0.x, y: t0.y },
            viewportW: dims.width,
            viewportH: dims.height,
            graphDataRevision: store.graphDataRevision,
          })
        }
      } else if (initial) {
        svg.call(zoom.transform as never, d3.zoomIdentity.translate(initial.x, initial.y).scale(initial.k))
      } else if (store.viewPinned !== true && dims.width > 80 && dims.height > 80) {
        const g0 = localGraphDataRef.current
        const nodes0 = Array.isArray(g0.nodes) ? (g0.nodes as GraphNode[]) : ([] as GraphNode[])
        if (nodes0.length > 0) {
          const mode = readLayoutMode(snapshot.schema)
          const intent = store.fitToScreenMode ? 'fitToScreen' : 'initialFit'
          const opts = readFitAllOptions({ schema: snapshot.schema, mode, intent })
          const t = fitAllTransform(nodes0, Math.max(1, dims.width), Math.max(1, dims.height), {
            ...opts,
            graphData: g0,
          })
          svg.call(zoom.transform as never, d3.zoomIdentity.translate(t.x, t.y).scale(t.k))
        } else {
          svg.call(zoom.transform as never, d3.zoomIdentity)
        }
      } else {
        svg.call(zoom.transform as never, d3.zoomIdentity)
      }
      if (initKey) lastInitKeyRef.current = initKey
    }

    return () => {
      try {
        svg.on('.zoom', null)
        svg.on('.kgPointerPan', null)
        svg.on('.kgPointerPanMove', null)
        svg.on('.kgPointerPanUp', null)
        svg.on('.kgWheelZoom', null)
        svg.on('.kgWheelZoomGuard', null)
        svg.on('.kgZoomWheelLastPointer', null)
        svg.on('.kgTouch', null)
        svg.on('.kgPanOnScroll', null)
        svg.on('.kgDesignViewport', null)
      } catch {
        void 0
      }
      zoomRef.current = null
      if (zoomCommitRafRef.current != null) {
        cancelAnimationFrame(zoomCommitRafRef.current)
        zoomCommitRafRef.current = null
      }
      pendingZoomTransformRef.current = null
    }
  }, [active, dims.height, dims.width, snapshot.schema, snapshot.viewportControlsPreset, zoomViewKey])

  const handleSelectNode = useMemo(() => {
    return (id: string) => {
      const store = useGraphStore.getState()
      store.setSelectionSource('canvas')
      store.selectNode(id)
    }
  }, [])

  const styleById = useMemo(() => {
    if (!webpageLayoutGraphData?.nodes || webpageLayoutGraphData.nodes.length === 0) return null
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
        boxShadow?: string
      }
    >()
    for (let i = 0; i < webpageLayoutGraphData.nodes.length; i += 1) {
      const n = webpageLayoutGraphData.nodes[i] as GraphNode
      const props = (n.properties || {}) as Record<string, unknown>
      const fill = typeof props['visual:fill'] === 'string' ? String(props['visual:fill'] || '').trim() : ''
      const stroke = typeof props['visual:stroke'] === 'string' ? String(props['visual:stroke'] || '').trim() : ''
      const strokeWidth = typeof props['visual:strokeWidth'] === 'number' ? (props['visual:strokeWidth'] as number) : undefined
      const borderRadius = typeof props['visual:borderRadius'] === 'number' ? (props['visual:borderRadius'] as number) : undefined
      const opacity = typeof props['visual:opacity'] === 'number' ? (props['visual:opacity'] as number) : undefined
      const kind = typeof props['dom:kind'] === 'string' ? String(props['dom:kind'] || '').trim() : ''
      const zIndex = (() => {
        const raw = typeof props['css:zIndex'] === 'string' ? String(props['css:zIndex'] || '').trim() : ''
        if (!raw || raw === 'auto') return 0
        const n = Number(raw)
        return Number.isFinite(n) ? n : 0
      })()
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
        ...(Number.isFinite(zIndex) ? { zIndex } : {}),
        ...(boxShadow ? { boxShadow } : {}),
      })
    }
    return map
  }, [webpageLayoutGraphData])

  const denseRender = visibleNodes.length > 450
  const renderNodes = useMemo(() => {
    if (!styleById) return visibleNodes
    const kindRank = (k: string): number => {
      if (k === 'container') return 0
      if (k === 'element') return 1
      if (k === 'media') return 2
      if (k === 'interactive') return 3
      return 4
    }
    const nodes = visibleNodes.slice()
    nodes.sort((a, b) => {
      const sa = styleById.get(a.id)
      const sb = styleById.get(b.id)
      const za = sa?.zIndex ?? 0
      const zb = sb?.zIndex ?? 0
      if (za !== zb) return za - zb
      const ka = kindRank(sa?.kind || '')
      const kb = kindRank(sb?.kind || '')
      if (ka !== kb) return ka - kb
      const pa = positions[a.id]
      const pb = positions[b.id]
      const aa = pa ? pa.w * pa.h : 0
      const ab = pb ? pb.w * pb.h : 0
      if (aa !== ab) return ab - aa
      return a.id.localeCompare(b.id)
    })
    return nodes
  }, [positions, styleById, visibleNodes])

  const BG_SIZE = 100000

  return (
    <section
      ref={containerRef}
      className={`${CANVAS_SURFACE_CLASS} relative h-full w-full overflow-hidden bg-[var(--kg-canvas-bg)]`}
      aria-label="Design Canvas"
    >
      {documentUrl ? (
        <div className="pointer-events-none absolute left-3 top-3 z-50 max-w-[min(720px,calc(100%-24px))] rounded-md border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] px-3 py-2 text-xs text-[var(--kg-text)] shadow">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold">Webpage Wireframe</div>
              <div className="truncate opacity-80">{documentUrl}</div>
            </div>
            {webpageLayoutStatus === 'loading' ? (
              <div className="shrink-0 tabular-nums">{Math.max(0, Math.min(100, Math.floor(webpageLayoutProgress)))}%</div>
            ) : null}
          </div>
          {webpageLayoutStatus === 'loading' ? (
            <div className="mt-2">
              <div className="h-2 w-full overflow-hidden rounded bg-[var(--kg-border)]/40">
                <div
                  className="h-full bg-[var(--kg-canvas-accent)]"
                  style={{ width: `${Math.max(0, Math.min(100, Math.floor(webpageLayoutProgress)))}%` }}
                />
              </div>
              {webpageLayoutMessage ? <div className="mt-1 opacity-80">{webpageLayoutMessage}</div> : null}
            </div>
          ) : webpageLayoutStatus === 'error' ? (
            <div className="mt-2">
              <div className="text-[var(--kg-danger,#c0392b)]">{webpageLayoutMessage || 'Export failed'}</div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="pointer-events-auto rounded border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] px-2 py-1 text-xs"
                  onClick={() => {
                    setWebpageLayout(null)
                    setWebpageLayoutStatus('loading')
                    setWebpageLayoutProgress(0)
                    setWebpageLayoutMessage('Retrying…')
                    setWebpageLayoutRetryNonce(n => n + 1)
                  }}
                >
                  Retry
                </button>
                <button
                  type="button"
                  className="pointer-events-auto rounded border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] px-2 py-1 text-xs opacity-80"
                  onClick={() => {
                    setDocumentUrl(null)
                  }}
                >
                  Hide Webpage Mode
                </button>
              </div>
            </div>
          ) : webpageLayoutStatus === 'ready' ? (
            webpageLayoutMessage ? <div className="mt-2 opacity-70">{webpageLayoutMessage}</div> : null
          ) : null}
        </div>
      ) : null}
      <svg
        ref={svgRef}
        className={`${CANVAS_INTERACTIVE_CLASS} block h-full w-full select-none`}
        role="img"
        aria-label="Design renderer"
      >
        <defs>
          <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--kg-border)" opacity="0.5" />
          </pattern>
          <filter id="shadow-sm" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1" />
          </filter>
          <filter id="shadow-md" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.1" />
          </filter>
        </defs>

        <g ref={gRef}>
          <rect x={-BG_SIZE} y={-BG_SIZE} width={BG_SIZE * 2} height={BG_SIZE * 2} fill="url(#grid-pattern)" />

          {renderNodes.map(n => {
            const p = positions[n.id]
            if (!p) return null
            const selected = snapshot.selectedNodeId === n.id
            const style = styleById ? styleById.get(n.id) || null : null
            const kind = style?.kind || ''
            const fill = (() => {
              if (!styleById) return 'var(--kg-panel-bg)'
              if (style?.fill) return style.fill
              if (kind === 'container' || kind === 'interactive') return 'var(--kg-panel-bg)'
              return 'transparent'
            })()
            const stroke = selected ? 'var(--kg-canvas-accent)' : style?.stroke || 'var(--kg-border)'
            const strokeWidth = selected ? 2 : (style?.strokeWidth ?? (kind === 'interactive' ? 2 : 1))
            const strokeDasharray = !selected && kind === 'container' ? '6 4' : undefined
            const rx = typeof style?.borderRadius === 'number' && Number.isFinite(style.borderRadius) ? style.borderRadius : 8
            const rectOpacity = (() => {
              const baseOpacity = typeof style?.opacity === 'number' && Number.isFinite(style.opacity) ? style.opacity : 1
              if (!styleById) return baseOpacity
              if (style?.fill) return baseOpacity
              if (kind === 'container') return baseOpacity * 0.18
              if (kind === 'interactive') return baseOpacity * 0.22
              return baseOpacity
            })()
            const showDecor = !styleById && !denseRender
            const hasShadow = !!(styleById && style?.boxShadow && style.boxShadow !== 'none')
            const filter = selected ? 'url(#shadow-md)' : hasShadow ? 'url(#shadow-md)' : 'url(#shadow-sm)'

            return (
              <g
                key={n.id}
                ref={el => {
                  const map = frameElByIdRef.current
                  if (el) map.set(n.id, el)
                  else map.delete(n.id)
                }}
                transform={`translate(${p.x},${p.y})`}
                onPointerDown={e => {
                  e.stopPropagation()
                  if (!active) return
                  const svgEl = svgRef.current
                  if (!svgEl) return
                  const world = pointerToWorld(e, svgEl)
                  if (!world) return
                  try {
                    ;(e.currentTarget as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId)
                  } catch {
                    void 0
                  }
                  handleSelectNode(n.id)
                  dragRef.current = { id: n.id, startWorld: world, startPos: { x: p.x, y: p.y } }
                }}
                onPointerMove={e => {
                  const drag = dragRef.current
                  if (!drag) return
                  if (!active) return
                  const svgEl = svgRef.current
                  if (!svgEl) return
                  const world = pointerToWorld(e, svgEl)
                  if (!world) return
                  const dx = world.x - drag.startWorld.x
                  const dy = world.y - drag.startWorld.y
                  const nextX = drag.startPos.x + dx
                  const nextY = drag.startPos.y + dy
                  if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) return
                  dragPendingRef.current = { id: drag.id, nextPos: { x: nextX, y: nextY } }
                  scheduleDragVisual()
                }}
                onPointerUp={() => {
                  if (!active) {
                    dragRef.current = null
                    return
                  }
                  const drag = dragRef.current
                  dragRef.current = null
                  const pending = dragPendingRef.current
                  dragPendingRef.current = null
                  if (dragRafRef.current != null) {
                    try {
                      window.cancelAnimationFrame(dragRafRef.current)
                    } catch {
                      void 0
                    }
                    dragRafRef.current = null
                  }
                  const updates: Record<string, { x: number; y: number }> = {}
                  if (pending) updates[pending.id] = pending.nextPos

                  if (webpageLayoutGraphData?.nodes && webpageLayoutGraphData.nodes.length > 0) {
                    if (Object.keys(updates).length > 0) setDesignFramePosMany(updates)
                    return
                  }

                  const schema = snapshot.schema
                  if (!schema) {
                    if (Object.keys(updates).length > 0) setDesignFramePosMany(updates)
                    return
                  }

                  const workPos: Record<string, { x: number; y: number; w: number; h: number }> = {}
                  for (let i = 0; i < visibleNodes.length; i += 1) {
                    const vn = visibleNodes[i]
                    const base = positions[vn.id]
                    if (!base) continue
                    workPos[vn.id] = { x: base.x, y: base.y, w: base.w, h: base.h }
                  }
                  if (pending && workPos[pending.id]) {
                    workPos[pending.id] = { ...workPos[pending.id]!, x: pending.nextPos.x, y: pending.nextPos.y }
                  }

                  const estimateOverlapPressure = (): number => {
                    const ids = Object.keys(workPos)
                    if (ids.length < 3) return 0
                    let cell = 0
                    for (let i = 0; i < ids.length; i += 1) {
                      const p = workPos[ids[i]!]!
                      cell = Math.max(cell, Math.floor(Math.max(p.w, p.h) * 0.75))
                    }
                    cell = Math.max(8, cell)
                    const counts = new Map<string, number>()
                    for (let i = 0; i < ids.length; i += 1) {
                      const p = workPos[ids[i]!]!
                      const gx = Math.floor(p.x / cell)
                      const gy = Math.floor(p.y / cell)
                      const key = `${gx}:${gy}`
                      counts.set(key, (counts.get(key) || 0) + 1)
                    }
                    let collisions = 0
                    for (const c of counts.values()) {
                      if (c > 1) collisions += c - 1
                    }
                    return collisions / Math.max(1, ids.length)
                  }
                  const overlapPressure = estimateOverlapPressure()
                  if (overlapPressure < 0.02) {
                    if (Object.keys(updates).length > 0) setDesignFramePosMany(updates)
                    return
                  }

                  const nodes: GraphNode[] = []
                  for (let i = 0; i < visibleNodes.length; i += 1) {
                    const vn = visibleNodes[i]
                    const p = workPos[vn.id]
                    if (!p) continue
                    const cx = p.x + p.w / 2
                    const cy = p.y + p.h / 2
                    const node: GraphNode = {
                      id: vn.id,
                      label: vn.label,
                      type: 'Frame',
                      properties: {
                        'visual:width': p.w,
                        'visual:height': p.h,
                        'visual:shape': 'rect',
                      },
                      x: cx,
                      y: cy,
                      vx: 0,
                      vy: 0,
                    }
                    nodes.push(node)
                  }

                  const pinnedId = pending?.id || drag?.id || null
                  if (pinnedId) {
                    for (let i = 0; i < nodes.length; i += 1) {
                      const n0 = nodes[i]
                      if (String(n0.id) !== pinnedId) continue
                      ;(n0 as unknown as { fx?: number; fy?: number }).fx = n0.x
                      ;(n0 as unknown as { fx?: number; fy?: number }).fy = n0.y
                      break
                    }
                  }

                  relaxNodesWithCollision({
                    nodes,
                    edges: [],
                    schema,
                    defaultSteps: 12,
                  })

                  for (let i = 0; i < nodes.length; i += 1) {
                    const n0 = nodes[i]
                    const id = String(n0.id || '')
                    const w = typeof (n0.properties as Record<string, unknown>)['visual:width'] === 'number' ? ((n0.properties as Record<string, unknown>)['visual:width'] as number) : FRAME_W
                    const h = typeof (n0.properties as Record<string, unknown>)['visual:height'] === 'number' ? ((n0.properties as Record<string, unknown>)['visual:height'] as number) : FRAME_H
                    const x = (typeof n0.x === 'number' && Number.isFinite(n0.x) ? n0.x : 0) - w / 2
                    const y = (typeof n0.y === 'number' && Number.isFinite(n0.y) ? n0.y : 0) - h / 2
                    const prev = workPos[id]
                    if (!prev) continue
                    if (Math.abs(prev.x - x) < 0.5 && Math.abs(prev.y - y) < 0.5) continue
                    updates[id] = { x, y }
                  }
                  if (Object.keys(updates).length > 0) setDesignFramePosMany(updates)
                }}
                onPointerCancel={() => {
                  dragRef.current = null
                  dragPendingRef.current = null
                  if (dragRafRef.current != null) {
                    try {
                      window.cancelAnimationFrame(dragRafRef.current)
                    } catch {
                      void 0
                    }
                    dragRafRef.current = null
                  }
                  const el = frameElByIdRef.current.get(n.id)
                  if (el) {
                    try {
                      el.setAttribute('transform', `translate(${p.x},${p.y})`)
                    } catch {
                      void 0
                    }
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={0}
                  y={0}
                  width={p.w}
                  height={p.h}
                  rx={rx}
                  fill={fill}
                  fillOpacity={rectOpacity}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  filter={filter}
                />
                {showDecor ? (
                  <path
                    d={`M 0 8 Q 0 0 8 0 L ${p.w - 8} 0 Q ${p.w} 0 ${p.w} 8 L ${p.w} 32 L 0 32 Z`}
                    fill="var(--kg-statusbar-bg)"
                    opacity={0.5}
                  />
                ) : null}

                <text
                  x={12}
                  y={22}
                  fill="var(--kg-text-primary)"
                  fontSize={12}
                  fontWeight={600}
                  style={{ pointerEvents: 'none' }}
                >
                  {n.label}
                </text>

                {showDecor ? (
                  <g transform="translate(16, 48)" opacity={0.3}>
                    <rect width={p.w - 32} height={12} rx={2} fill="var(--kg-text-tertiary)" />
                    <rect y={20} width={(p.w - 32) * 0.6} height={12} rx={2} fill="var(--kg-text-tertiary)" />
                    <rect y={40} width={p.w - 32} height={p.h - 100} rx={4} fill="var(--kg-border)" />
                  </g>
                ) : null}

                <text
                  x={p.w - 12}
                  y={22}
                  textAnchor="end"
                  fill="var(--kg-text-tertiary)"
                  fontSize={10}
                  style={{ pointerEvents: 'none' }}
                >
                  {n.type || n.id}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
    </section>
  )
}
