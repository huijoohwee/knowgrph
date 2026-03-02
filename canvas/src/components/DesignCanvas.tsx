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
import { computeEvenlyDistributedPositions } from '@/lib/canvas/evenDistribute'
import { isEditableTarget, readArrangeShortcut, readNudgeDelta } from '@/lib/canvas/arrangeShortcuts'
import { shouldStartSelectionDragForPreset } from '@/lib/canvas/viewport-controls'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import type { WebpageLayoutSnapshot } from '@/lib/websites/webpageLayoutExport'
import { getCachedWebpageLayoutSnapshot, setCachedWebpageLayoutSnapshot } from '@/lib/websites/webpageLayoutCache'
import { convertWebpageLayoutToGraphData } from '@/lib/websites/webpageLayoutToGraph'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { normalizeWorkspacePath, workspaceDocumentKey } from '@/features/workspace-fs/path'
import { parseWebpageFrontmatterMeta, upsertWebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'
import type { WebpageFrontmatterMeta, WebpageFidelityLevel } from '@/lib/markdown/frontmatter'
import { createProgressTicker } from '@/lib/progress/progressTicker'
import type { WebpageDomProbeResult } from '@/lib/websites/webpageDomExport'
import { hashText } from '@/features/parsers/hash'

import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { estimateLabelCharWidthPx, estimateMaxCharsForWidthPx, truncateTextWithEllipsis, wrapTextByMaxChars } from '@/lib/ui/text/labelText'
import { relaxAabbLabels, type AabbLabelParticle } from '@/lib/ui/labels/relaxAabbLabels'
import { readDesignWireframeSettings } from '@/lib/render/designWireframeSettings'
import { tryExtractDesignDocumentUrl } from '@/lib/render/designDocumentUrl'
import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'
import { applyMediaProxySrc, resolveUrlAgainstBase } from '@/lib/url'
import { DesignRichMediaPreview } from '@/components/DesignRichMedia'

type FrameNode = {
  id: string
  label: string
  type?: string
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
      selectedNodeIds: s.selectedNodeIds,
      viewportControlsPreset: s.viewportControlsPreset,
      canvasPointerMode2d: s.canvasPointerMode2d,
      designLayerState: s.designLayerState,
      designFramePosById: s.designFramePosById,
      designFrameSizeById: s.designFrameSizeById,
      setDesignFramePosMany: s.setDesignFramePosMany,
      setDesignFrameSizeMany: s.setDesignFrameSizeMany,
      setDesignRendererNodes: s.setDesignRendererNodes,
      setDesignRendererWebpageGraph: s.setDesignRendererWebpageGraph,
    })),
  )

  const directDocumentUrl = useMemo(() => tryExtractDesignDocumentUrl(snapshot.graphData as GraphData | null), [snapshot.graphData])
  const [documentUrl, setDocumentUrl] = React.useState<string | null>(directDocumentUrl)
  const [webpageWorkspacePath, setWebpageWorkspacePath] = React.useState<string>('')
  const [webpageFrontmatter, setWebpageFrontmatter] = React.useState<WebpageFrontmatterMeta | null>(null)
  const [webpageLayout, setWebpageLayout] = React.useState<WebpageLayoutSnapshot | null>(null)
  const [webpageLayoutStatus, setWebpageLayoutStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [webpageLayoutProgress, setWebpageLayoutProgress] = React.useState<number>(0)
  const [webpageLayoutMessage, setWebpageLayoutMessage] = React.useState<string>('')
  const [webpageLayoutRetryNonce, setWebpageLayoutRetryNonce] = React.useState<number>(0)
  const lastWebpageLayoutUrlRef = useRef<string>('')
  const lastWebpageLayoutReqRef = useRef<number>(0)
  const webpageLayoutGraphCacheRef = useRef<Map<string, GraphData>>(new Map())
  const webpageLayoutGraphCacheOrderRef = useRef<string[]>([])

  useEffect(() => {
    const fmUrl = String(webpageFrontmatter?.url || '').trim()
    if (fmUrl && /^https?:\/\//i.test(fmUrl)) {
      setDocumentUrl(fmUrl)
      return
    }
    setDocumentUrl(directDocumentUrl)
  }, [directDocumentUrl, webpageFrontmatter?.url, webpageWorkspacePath])

  useEffect(() => {
    if (!active) return
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
        if (!cancelled) {
          setWebpageWorkspacePath(String(candidates[i] || ''))
          setWebpageFrontmatter(fm)
          setDocumentUrl(url)
        }
        return
      }

      if (!cancelled) {
        setWebpageWorkspacePath('')
        setWebpageFrontmatter(null)
        const fallbackUrl = String(directDocumentUrl || '').trim()
        setDocumentUrl(fallbackUrl && /^https?:\/\//i.test(fallbackUrl) ? fallbackUrl : null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [active, directDocumentUrl, snapshot.graphData, webpageLayoutRetryNonce])

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
    const prevUrl = lastWebpageLayoutUrlRef.current
    lastWebpageLayoutUrlRef.current = url
    const reqId = (lastWebpageLayoutReqRef.current += 1)
    let cancelled = false
    const allowCache = webpageLayoutRetryNonce <= 0
    const fidelity: WebpageFidelityLevel =
      webpageFrontmatter?.fidelityLevel === 1 || webpageFrontmatter?.fidelityLevel === 2 || webpageFrontmatter?.fidelityLevel === 3 || webpageFrontmatter?.fidelityLevel === 4
        ? webpageFrontmatter.fidelityLevel
        : 3
    const maxElements = fidelity === 4 ? 3200 : fidelity === 3 ? 2400 : fidelity === 2 ? 1800 : 1400
    const viewportW = (() => {
      try {
        const w = typeof window !== 'undefined' ? window.innerWidth : 0
        if (!Number.isFinite(w) || w <= 0) return 1200
        return Math.max(900, Math.min(1400, Math.floor(w * 0.9)))
      } catch {
        return 1200
      }
    })()
    const viewportH = (() => {
      try {
        const h = typeof window !== 'undefined' ? window.innerHeight : 0
        if (!Number.isFinite(h) || h <= 0) return 800
        return Math.max(650, Math.min(1000, Math.floor(h * 0.84)))
      } catch {
        return 800
      }
    })()
    const networkIdleMs = fidelity >= 3 ? 1100 : 900
    const domQuietMs = fidelity >= 3 ? 900 : 650
    const minWaitAfterLoadMs = fidelity >= 3 ? 1600 : 1200
    const layoutCacheKey = `layout:v2:maxEl=${maxElements}:vp=${viewportW}x${viewportH}:scroll=1:faq=1:netIdle=1:netIdleMs=${networkIdleMs}:domQuietMs=${domQuietMs}:minAfter=${minWaitAfterLoadMs}`
    if (allowCache) {
      const cached = getCachedWebpageLayoutSnapshot(url, layoutCacheKey)
      if (cached) {
        setWebpageLayout(cached)
        setWebpageLayoutStatus('ready')
        setWebpageLayoutProgress(100)
        setWebpageLayoutMessage('Loaded from cache')
        return
      }
    }
    if (prevUrl && prevUrl !== url) setWebpageLayout(null)
    setWebpageLayoutStatus('loading')
    setWebpageLayoutProgress(0)
    setWebpageLayoutMessage('Loading webpage for wireframe…')
    const ticker = createProgressTicker({
      onProgress: (p) => setWebpageLayoutProgress(p),
      intervalMs: 280,
      maxPercentage: 92,
      maxStepPercentage: 12,
    })
    const ac = new AbortController()
    void (async () => {
      try {
        ticker.start()
        const { probeWebpageDomViaHiddenIframe } = await import('@/lib/websites/webpageDomExport')
        const probe = await probeWebpageDomViaHiddenIframe({
          url,
          mode: 'layout',
          maxElements,
          scrollCrawl: true,
          expandFaq: true,
          timeoutMs: 45_000,
          waitForNetworkIdle: true,
          networkIdleMs,
          domQuietMs,
          minWaitAfterLoadMs,
          viewportW,
          viewportH,
          signal: ac.signal,
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
        setCachedWebpageLayoutSnapshot(url, snap, layoutCacheKey)
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
        ac.abort()
      } catch {
        void 0
      }
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
    const fidelity: WebpageFidelityLevel = webpageFrontmatter?.fidelityLevel === 1 || webpageFrontmatter?.fidelityLevel === 2 || webpageFrontmatter?.fidelityLevel === 3 || webpageFrontmatter?.fidelityLevel === 4 ? webpageFrontmatter.fidelityLevel : 3
    const url = String(documentUrl || '').trim()
    const ts = typeof webpageLayout.meta?.ts === 'number' && Number.isFinite(webpageLayout.meta.ts) ? webpageLayout.meta.ts : null
    const elCountKey = Array.isArray(webpageLayout?.elements) ? webpageLayout.elements.length : null
    const cacheKey = url && ts != null && elCountKey != null ? `${url}#${ts}#${elCountKey}::f${fidelity}` : null
    if (cacheKey) {
      const cached = webpageLayoutGraphCacheRef.current.get(cacheKey) || null
      if (cached) return cached
    }
    const areaScale = fidelity === 4 ? 0.55 : fidelity === 3 ? 0.75 : fidelity === 2 ? 1 : 1.25
    const nodeScale = fidelity === 4 ? 1.7 : fidelity === 3 ? 1.35 : fidelity === 2 ? 1 : 0.75
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
    const minAreaPx0 = Math.max(1, Math.round(baseMinAreaPx * areaScale))
    const elementCount = Array.isArray(webpageLayout?.elements) ? webpageLayout.elements.length : 0
    const baseMaxNodes = (() => {
      const base = elementCount > 0 ? Math.max(900, Math.min(2600, Math.round(elementCount * 0.55))) : 1400
      return Math.max(200, Math.min(5000, Math.round(base * nodeScale)))
    })()
    const primary = {
      minAreaPx: minAreaPx0,
      maxNodes: baseMaxNodes,
    }
    const secondary = {
      minAreaPx: Math.max(1, Math.round(minAreaPx0 * 0.82)),
      maxNodes: Math.max(200, Math.min(5000, Math.round(baseMaxNodes * 1.3))),
    }
    const tertiary = {
      minAreaPx: 1,
      maxNodes: Math.max(2000, Math.min(5000, Math.round(3400 * nodeScale))),
    }
    const g1 = convertWebpageLayoutToGraphData(webpageLayout, { maxNodes: primary.maxNodes, minAreaPx: primary.minAreaPx, fidelityLevel: fidelity })
    const n1 = Array.isArray(g1?.nodes) ? g1.nodes.length : 0
    if (n1 >= 18) {
      if (cacheKey && g1) {
        const order = webpageLayoutGraphCacheOrderRef.current
        const map = webpageLayoutGraphCacheRef.current
        if (!map.has(cacheKey)) {
          order.push(cacheKey)
          if (order.length > 8) {
            const drop = order.shift()
            if (drop) map.delete(drop)
          }
        }
        map.set(cacheKey, g1)
      }
      return g1
    }
    const g2 = convertWebpageLayoutToGraphData(webpageLayout, { maxNodes: secondary.maxNodes, minAreaPx: secondary.minAreaPx, fidelityLevel: fidelity })
    const n2 = Array.isArray(g2?.nodes) ? g2.nodes.length : 0
    const best = n2 > n1 ? g2 : g1
    const bestN = Math.max(n1, n2)
    if (bestN >= 8) {
      if (cacheKey && best) {
        const order = webpageLayoutGraphCacheOrderRef.current
        const map = webpageLayoutGraphCacheRef.current
        if (!map.has(cacheKey)) {
          order.push(cacheKey)
          if (order.length > 8) {
            const drop = order.shift()
            if (drop) map.delete(drop)
          }
        }
        map.set(cacheKey, best)
      }
      return best
    }
    const g3 = convertWebpageLayoutToGraphData(webpageLayout, { maxNodes: tertiary.maxNodes, minAreaPx: tertiary.minAreaPx, fidelityLevel: fidelity })
    const n3 = Array.isArray(g3?.nodes) ? g3.nodes.length : 0
    const final = n3 > bestN ? g3 : best
    if (cacheKey && final) {
      const order = webpageLayoutGraphCacheOrderRef.current
      const map = webpageLayoutGraphCacheRef.current
      if (!map.has(cacheKey)) {
        order.push(cacheKey)
        if (order.length > 8) {
          const drop = order.shift()
          if (drop) map.delete(drop)
        }
      }
      map.set(cacheKey, final)
    }
    return final
  }, [documentUrl, webpageFrontmatter?.fidelityLevel, webpageLayout])

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
    const fidelity: WebpageFidelityLevel = webpageFrontmatter?.fidelityLevel === 1 || webpageFrontmatter?.fidelityLevel === 2 || webpageFrontmatter?.fidelityLevel === 3 || webpageFrontmatter?.fidelityLevel === 4 ? webpageFrontmatter.fidelityLevel : 3
    const base = `${url}#${ts}#${n}::f${fidelity}`
    const nodes = Array.isArray(webpageLayoutGraphData?.nodes) ? (webpageLayoutGraphData!.nodes as GraphNode[]) : null
    if (!nodes || nodes.length === 0) return base
    const ids: string[] = []
    for (let i = 0; i < nodes.length && ids.length < 240; i += 1) {
      const id = String(nodes[i]?.id || '').trim()
      if (id) ids.push(id)
    }
    ids.sort()
    const sig = hashText(`${ids.join('|')}|${nodes.length}`)
    return `${base}::g${sig}`
  }, [documentUrl, webpageFrontmatter?.fidelityLevel, webpageLayout?.elements, webpageLayout?.meta?.ts, webpageLayoutGraphData?.nodes])

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
    return []
  }, [documentUrl, webpageLayoutGraphData, webpageLayoutStatus])

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
    return out
  }, [dims.height, dims.width, documentUrl, snapshot.designFramePosById, snapshot.designFrameSizeById, visibleNodes, webpageLayoutGraphData])

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
      nodes: [],
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
  const setDesignFrameSizeMany = snapshot.setDesignFrameSizeMany

  const frameElByIdRef = useRef<Map<string, SVGGElement>>(new Map())
  const frameRectElByIdRef = useRef<Map<string, SVGRectElement>>(new Map())
  const frameStatusElByIdRef = useRef<Map<string, SVGPathElement>>(new Map())
  const resizeOverlayElRef = useRef<SVGGElement | null>(null)
  const dragRef = useRef<
    null | { id: string; startWorld: { x: number; y: number }; startPos: { x: number; y: number }; ids: string[]; startPosById: Record<string, { x: number; y: number }> }
  >(null)
  const dragRafRef = useRef<number | null>(null)
  const dragPendingRef = useRef<null | { ids: string[]; nextPosById: Record<string, { x: number; y: number }> }>(null)
  const resizeRef = useRef<
    null | {
      id: string
      handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
      startWorld: { x: number; y: number }
      startRect: { x: number; y: number; w: number; h: number }
      aspect: number
      pointerId: number
    }
  >(null)
  const resizeRafRef = useRef<number | null>(null)
  const resizePendingRef = useRef<null | { id: string; x: number; y: number; w: number; h: number }>(null)
  const marqueeRef = useRef<null | { start: { x: number; y: number }; end: { x: number; y: number }; mode: 'replace' | 'add'; pointerId: number }>(
    null,
  )
  const [marqueeBox, setMarqueeBox] = React.useState<null | { x: number; y: number; w: number; h: number }>(null)
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
      if (resizeRafRef.current != null) {
        try {
          window.cancelAnimationFrame(resizeRafRef.current)
        } catch {
          void 0
        }
        resizeRafRef.current = null
      }
      resizePendingRef.current = null
      resizeRef.current = null
    }
  }, [])

  const scheduleDragVisual = useMemo(() => {
    return () => {
      if (dragRafRef.current != null) return
      dragRafRef.current = window.requestAnimationFrame(() => {
        dragRafRef.current = null
        const pending = dragPendingRef.current
        if (!pending) return
        const ids = pending.ids || []
        for (let i = 0; i < ids.length; i += 1) {
          const id = String(ids[i] || '').trim()
          if (!id) continue
          const pos = pending.nextPosById?.[id]
          if (!pos) continue
          const el = frameElByIdRef.current.get(id)
          if (!el) continue
          try {
            el.setAttribute('transform', `translate(${pos.x},${pos.y})`)
          } catch {
            void 0
          }
        }
      })
    }
  }, [])

  const scheduleResizeVisual = useMemo(() => {
    return () => {
      if (resizeRafRef.current != null) return
      resizeRafRef.current = window.requestAnimationFrame(() => {
        resizeRafRef.current = null
        const pending = resizePendingRef.current
        if (!pending) return
        const id = String(pending.id || '').trim()
        if (!id) return
        const el = frameElByIdRef.current.get(id)
        if (el) {
          try {
            el.setAttribute('transform', `translate(${pending.x},${pending.y})`)
          } catch {
            void 0
          }
        }
        const rectEl = frameRectElByIdRef.current.get(id)
        if (rectEl) {
          try {
            rectEl.setAttribute('width', String(Math.max(1, pending.w)))
            rectEl.setAttribute('height', String(Math.max(1, pending.h)))
          } catch {
            void 0
          }
        }
        const statusEl = frameStatusElByIdRef.current.get(id)
        if (statusEl) {
          try {
            const w = Math.max(1, pending.w)
            statusEl.setAttribute('d', `M 0 8 Q 0 0 8 0 L ${w - 8} 0 Q ${w} 0 ${w} 8 L ${w} 32 L 0 32 Z`)
          } catch {
            void 0
          }
        }
        const overlay = resizeOverlayElRef.current
        if (overlay) {
          try {
            overlay.setAttribute('transform', `translate(${pending.x},${pending.y})`)
          } catch {
            void 0
          }
          const outline = overlay.querySelector('rect[data-kg-resize-outline="1"]') as SVGRectElement | null
          if (outline) {
            try {
              outline.setAttribute('width', String(Math.max(0, pending.w + 2)))
              outline.setAttribute('height', String(Math.max(0, pending.h + 2)))
            } catch {
              void 0
            }
          }
          const hs = 9
          const o = hs / 2
          const sx = Math.max(1, pending.w)
          const sy = Math.max(1, pending.h)
          const pts: Array<{ k: string; x: number; y: number }> = [
            { k: 'nw', x: 0, y: 0 },
            { k: 'n', x: sx / 2, y: 0 },
            { k: 'ne', x: sx, y: 0 },
            { k: 'e', x: sx, y: sy / 2 },
            { k: 'se', x: sx, y: sy },
            { k: 's', x: sx / 2, y: sy },
            { k: 'sw', x: 0, y: sy },
            { k: 'w', x: 0, y: sy / 2 },
          ]
          for (let i = 0; i < pts.length; i += 1) {
            const pt = pts[i]!
            const h = overlay.querySelector(`rect[data-kg-resize-handle="${pt.k}"]`) as SVGRectElement | null
            if (!h) continue
            try {
              h.setAttribute('x', String(pt.x - o))
              h.setAttribute('y', String(pt.y - o))
            } catch {
              void 0
            }
          }
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

  const beginResize = useMemo(() => {
    return (
      e: React.PointerEvent,
      args: { id: string; handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'; rect: { x: number; y: number; w: number; h: number } },
    ) => {
      if (!active) return
      if (isSpacePanHeld()) return
      if (snapshot.canvasPointerMode2d === 'pan') return
      if (e.button !== 0) return
      const svgEl = svgRef.current
      if (!svgEl) return
      const world = pointerToWorld(e, svgEl)
      if (!world) return
      e.stopPropagation()
      try {
        ;(e.currentTarget as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId)
      } catch {
        void 0
      }
      const id = String(args.id || '').trim()
      if (!id) return
      try {
        const store = useGraphStore.getState()
        store.setSelectionSource('canvas')
        if (store.selectedNodeId !== id) store.selectNodesExpanded({ nodeIds: [id], activeNodeId: id })
      } catch {
        void 0
      }
      const w = Math.max(1, args.rect.w)
      const h = Math.max(1, args.rect.h)
      resizeRef.current = {
        id,
        handle: args.handle,
        startWorld: world,
        startRect: { x: args.rect.x, y: args.rect.y, w, h },
        aspect: w / h,
        pointerId: e.pointerId,
      }
      resizePendingRef.current = { id, x: args.rect.x, y: args.rect.y, w, h }
    }
  }, [active, pointerToWorld, snapshot.canvasPointerMode2d])

  const dimsRef = useRef({ width: dims.width, height: dims.height })
  useEffect(() => {
    dimsRef.current = { width: dims.width, height: dims.height }
  }, [dims.width, dims.height])

  const zoomCommitRafRef = useRef<number | null>(null)
  const pendingZoomTransformRef = useRef<{ k: number; x: number; y: number } | null>(null)

  const zoomViewKey = useMemo(() => {
    return buildActive2dZoomViewKey({
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
      designRendererWebpageLayoutKey: webpageLayoutKey,
    })
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
    webpageLayoutKey,
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
        stackKey?: string
        xIndex?: number
        yIndex?: number
        boxShadow?: string
        position?: string
        tag?: string
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

      const base = webpageGraphNodesById ? webpageGraphNodesById[n.id] : null
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
  }, [positions, snapshot.selectedNodeId, snapshot.selectedNodeIds, styleById, visibleNodes, webpageGraphNodesById])

  const domDepthById = useMemo(() => {
    const out = new Map<string, number>()
    if (!webpageGraphNodesById) return out
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
        const node = webpageGraphNodesById[cur]
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
  }, [visibleNodes, webpageGraphNodesById])

  const wireframeSettings = useMemo(() => readDesignWireframeSettings(snapshot.schema), [snapshot.schema])

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
        const fontSize = 12
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
        const fontSize = 10
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
    if (!styleById) return [] as Array<{ id: string; x1: number; y1: number; x2: number; y2: number; opacity: number }>
    if (!wireframeSettings.showEdges) return [] as Array<{ id: string; x1: number; y1: number; x2: number; y2: number; opacity: number }>
    const edges = Array.isArray(webpageLayoutGraphData?.edges) ? (webpageLayoutGraphData!.edges as unknown as GraphEdge[]) : []
    if (edges.length === 0) return []
    const out: Array<{ id: string; x1: number; y1: number; x2: number; y2: number; opacity: number }> = []
    const maxEdges = Math.max(0, Math.min(5000, Math.floor(wireframeSettings.maxEdges)))
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
      out.push({ id, x1, y1, x2, y2, opacity })
    }
    return out
  }, [domDepthById, positions, snapshot.selectedNodeId, styleById, webpageLayoutGraphData?.edges, wireframeSettings.maxEdges, wireframeSettings.showEdges])

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
    if (!webpageGraphNodesById) return map
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

      const base = webpageGraphNodesById[n.id]
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
    webpageGraphNodesById,
    wireframeSettings.showMediaPreview,
    wireframeSettings.showTextPreview,
  ])

  const selectedIds = useMemo(() => {
    const ids = Array.isArray(snapshot.selectedNodeIds) ? snapshot.selectedNodeIds : []
    const out: string[] = []
    const seen = new Set<string>()
    for (let i = 0; i < ids.length; i += 1) {
      const id = String(ids[i] || '').trim()
      if (!id) continue
      if (seen.has(id)) continue
      seen.add(id)
      if (!positions[id]) continue
      out.push(id)
    }
    return out
  }, [positions, snapshot.selectedNodeIds])

  const applyArrange = useMemo(() => {
    type Action =
      | 'align-left'
      | 'align-center-x'
      | 'align-right'
      | 'align-top'
      | 'align-center-y'
      | 'align-bottom'
      | 'distribute-x'
      | 'distribute-y'
    return (action: Action) => {
      if (!active) return
      if (selectedIds.length < 2) return
      const refId = (() => {
        const a = String(snapshot.selectedNodeId || '').trim()
        if (a && selectedIds.includes(a)) return a
        return selectedIds[0] || ''
      })()
      const ref = refId ? positions[refId] : null
      if (!ref) return
      const updates: Record<string, { x: number; y: number }> = {}
      const grid = snapshot.schema?.behavior?.snapGrid
      const gridSize = grid && grid.enabled && typeof grid.size === 'number' && Number.isFinite(grid.size) ? Math.max(4, Math.floor(grid.size)) : 0
      const snap = (v: number) => (gridSize ? Math.round(v / gridSize) * gridSize : v)

      if (action === 'distribute-x' || action === 'distribute-y') {
        const pts = selectedIds.map((id) => {
          const p = positions[id]!
          return { id, x: p.x + p.w / 2, y: p.y + p.h / 2 }
        })
        const nextCenters = computeEvenlyDistributedPositions({ nodes: pts, axis: action === 'distribute-x' ? 'x' : 'y', minSpacing: gridSize || 24 })
        for (let i = 0; i < selectedIds.length; i += 1) {
          const id = selectedIds[i]!
          const p = positions[id]!
          const c = nextCenters[id]
          if (!c) continue
          const nextX = action === 'distribute-x' ? c.x - p.w / 2 : p.x
          const nextY = action === 'distribute-y' ? c.y - p.h / 2 : p.y
          updates[id] = { x: snap(nextX), y: snap(nextY) }
        }
        if (Object.keys(updates).length > 0) setDesignFramePosMany(updates)
        return
      }

      for (let i = 0; i < selectedIds.length; i += 1) {
        const id = selectedIds[i]!
        const p = positions[id]!
        let x = p.x
        let y = p.y
        if (action === 'align-left') x = ref.x
        if (action === 'align-right') x = ref.x + ref.w - p.w
        if (action === 'align-center-x') x = ref.x + ref.w / 2 - p.w / 2
        if (action === 'align-top') y = ref.y
        if (action === 'align-bottom') y = ref.y + ref.h - p.h
        if (action === 'align-center-y') y = ref.y + ref.h / 2 - p.h / 2
        updates[id] = { x: snap(x), y: snap(y) }
      }
      if (Object.keys(updates).length > 0) setDesignFramePosMany(updates)
    }
  }, [active, positions, selectedIds, setDesignFramePosMany, snapshot.schema?.behavior?.snapGrid, snapshot.selectedNodeId])

  useEffect(() => {
    if (!active) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      const arrange = readArrangeShortcut(e)
      if (arrange) {
        e.preventDefault()
        applyArrange(arrange)
        return
      }
      if (selectedIds.length === 0) return
      const grid = snapshot.schema?.behavior?.snapGrid
      const gridSize =
        grid && grid.enabled && typeof grid.size === 'number' && Number.isFinite(grid.size) ? Math.max(4, Math.floor(grid.size)) : 1
      const delta = readNudgeDelta({ e, snapGridEnabled: !!grid?.enabled, snapGridSize: gridSize })
      if (!delta) return
      e.preventDefault()
      const updates: Record<string, { x: number; y: number }> = {}
      for (let i = 0; i < selectedIds.length; i += 1) {
        const id = selectedIds[i]!
        const p = positions[id]
        if (!p) continue
        updates[id] = { x: p.x + delta.dx, y: p.y + delta.dy }
      }
      if (Object.keys(updates).length > 0) setDesignFramePosMany(updates)
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true } as AddEventListenerOptions)
    }
  }, [active, applyArrange, positions, selectedIds, setDesignFramePosMany, snapshot.schema?.behavior?.snapGrid])

  return (
    <section
      ref={containerRef}
      className={`${CANVAS_SURFACE_CLASS} relative h-full w-full overflow-hidden bg-[var(--kg-panel-bg)]`}
      aria-label="Design Canvas"
    >
      {active ? (
        <div className="pointer-events-none absolute left-3 top-3 z-50 max-w-[min(720px,calc(100%-24px))] rounded-md border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] px-3 py-2 text-xs text-[var(--kg-text)] shadow">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold">Webpage Wireframe</div>
              {documentUrl ? <div className="truncate opacity-80">{documentUrl}</div> : <div className="opacity-80">No webpage URL found for this graph</div>}
              {documentUrl ? (
                <div className="mt-1 flex items-center gap-2 opacity-80">
                  <div>Fidelity: {webpageFrontmatter?.fidelityLevel || 3}</div>
                  {webpageWorkspacePath ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-0.5 text-xs"
                      onClick={() => {
                        const p = String(webpageWorkspacePath || '').trim()
                        if (!p) return
                        void (async () => {
                          const fs = await getWorkspaceFs()
                          const text = await fs.readFileText(p).catch(() => '')
                          const fm = parseWebpageFrontmatterMeta(text)
                          if (!fm) return
                          const cur = fm.fidelityLevel === 1 || fm.fidelityLevel === 2 || fm.fidelityLevel === 3 || fm.fidelityLevel === 4 ? fm.fidelityLevel : 3
                          const next = (cur > 1 ? cur - 1 : 1) as WebpageFidelityLevel
                          const nextText = upsertWebpageFrontmatterMeta(text, { ...fm, fidelityLevel: next })
                          await fs.writeFileText(p, nextText).catch(() => void 0)
                          setWebpageFrontmatter({ ...fm, fidelityLevel: next })
                          setWebpageLayoutRetryNonce(n => n + 1)
                        })()
                      }}
                    >
                      -
                    </button>
                    <button
                      type="button"
                      className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-0.5 text-xs"
                      onClick={() => {
                        const p = String(webpageWorkspacePath || '').trim()
                        if (!p) return
                        void (async () => {
                          const fs = await getWorkspaceFs()
                          const text = await fs.readFileText(p).catch(() => '')
                          const fm = parseWebpageFrontmatterMeta(text)
                          if (!fm) return
                          const cur = fm.fidelityLevel === 1 || fm.fidelityLevel === 2 || fm.fidelityLevel === 3 || fm.fidelityLevel === 4 ? fm.fidelityLevel : 3
                          const next = (cur < 4 ? cur + 1 : 4) as WebpageFidelityLevel
                          const nextText = upsertWebpageFrontmatterMeta(text, { ...fm, fidelityLevel: next })
                          await fs.writeFileText(p, nextText).catch(() => void 0)
                          setWebpageFrontmatter({ ...fm, fidelityLevel: next })
                          setWebpageLayoutRetryNonce(n => n + 1)
                        })()
                      }}
                    >
                      +
                    </button>
                  </div>
                ) : null}
                </div>
              ) : (
                <div className="mt-2 opacity-70">Import a URL-based document or add kgWebpageUrl frontmatter.</div>
              )}
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
              </div>
            </div>
          ) : webpageLayoutStatus === 'ready' ? (
            webpageLayoutMessage ? <div className="mt-2 opacity-70">{webpageLayoutMessage}</div> : null
          ) : null}
        </div>
      ) : null}
      {active && selectedIds.length >= 2 ? (
        <div className="pointer-events-none absolute right-3 top-3 z-50 flex flex-wrap gap-1 rounded-md border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] p-2 text-xs text-[var(--kg-text)] shadow">
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-left')}>
            Align L
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-center-x')}>
            Align CX
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-right')}>
            Align R
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-top')}>
            Align T
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-center-y')}>
            Align CY
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-bottom')}>
            Align B
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('distribute-x')}>
            Dist X
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('distribute-y')}>
            Dist Y
          </button>
        </div>
      ) : null}
      <svg
        ref={svgRef}
        className={`${CANVAS_INTERACTIVE_CLASS} block h-full w-full select-none`}
        role="img"
        aria-label="Design renderer"
        onPointerDown={e => {
          if (!active) return
          const selectionOnDrag = snapshot.canvasPointerMode2d !== 'pan'
          const allowSelectionDrag = shouldStartSelectionDragForPreset({
            preset: snapshot.viewportControlsPreset,
            button: e.button,
            shiftKey: e.shiftKey,
            spacePanHeld: isSpacePanHeld(),
            selectionOnDrag,
          })
          if (!allowSelectionDrag) return
          if (e.button !== 0) return
          const svgEl = svgRef.current
          if (!svgEl) return
          const world = pointerToWorld(e, svgEl)
          if (!world) return
          try {
            ;(e.currentTarget as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId)
          } catch {
            void 0
          }
          const mode: 'replace' | 'add' = e.shiftKey ? 'add' : 'replace'
          marqueeRef.current = { start: world, end: world, mode, pointerId: e.pointerId }
          setMarqueeBox({ x: world.x, y: world.y, w: 0, h: 0 })
        }}
        onPointerMove={e => {
          const r = resizeRef.current
          if (r && e.pointerId === r.pointerId) {
            if (!active) return
            const svgEl = svgRef.current
            if (!svgEl) return
            const world = pointerToWorld(e, svgEl)
            if (!world) return
            const dx = world.x - r.startWorld.x
            const dy = world.y - r.startWorld.y
            const minW = 24
            const minH = 18
            let x = r.startRect.x
            let y = r.startRect.y
            let w = r.startRect.w
            let h = r.startRect.h
            if (r.handle.includes('e')) w = r.startRect.w + dx
            if (r.handle.includes('s')) h = r.startRect.h + dy
            if (r.handle.includes('w')) {
              w = r.startRect.w - dx
              x = r.startRect.x + dx
            }
            if (r.handle.includes('n')) {
              h = r.startRect.h - dy
              y = r.startRect.y + dy
            }
            if (e.shiftKey && Number.isFinite(r.aspect) && r.aspect > 0.001) {
              const aspect = r.aspect
              if (r.handle.length === 2) {
                const wFromH = h * aspect
                const hFromW = w / aspect
                if (Math.abs(w - wFromH) > Math.abs(h - hFromW)) h = w / aspect
                else w = h * aspect
              } else if (r.handle === 'e' || r.handle === 'w') {
                h = w / aspect
              } else if (r.handle === 'n' || r.handle === 's') {
                w = h * aspect
              }
              if (r.handle.includes('w')) x = r.startRect.x + (r.startRect.w - w)
              if (r.handle.includes('n')) y = r.startRect.y + (r.startRect.h - h)
            }
            w = Math.max(minW, w)
            h = Math.max(minH, h)
            if (r.handle.includes('w')) x = r.startRect.x + (r.startRect.w - w)
            if (r.handle.includes('n')) y = r.startRect.y + (r.startRect.h - h)

            const grid = snapshot.schema?.behavior?.snapGrid
            const gridEnabled = !!(grid && grid.enabled && typeof grid.size === 'number' && Number.isFinite(grid.size) && grid.size > 2)
            const allowSnap = gridEnabled && !e.altKey
            if (allowSnap) {
              const size = Math.max(4, Math.floor(grid!.size))
              const nx = Math.round(x / size) * size
              const ny = Math.round(y / size) * size
              const nw = Math.round(w / size) * size
              const nh = Math.round(h / size) * size
              if (Number.isFinite(nx) && Number.isFinite(ny) && Number.isFinite(nw) && Number.isFinite(nh)) {
                x = nx
                y = ny
                w = Math.max(minW, nw)
                h = Math.max(minH, nh)
              }
            }

            resizePendingRef.current = { id: r.id, x, y, w, h }
            scheduleResizeVisual()
            return
          }
          const m = marqueeRef.current
          if (!m) return
          if (e.pointerId !== m.pointerId) return
          const svgEl = svgRef.current
          if (!svgEl) return
          const world = pointerToWorld(e, svgEl)
          if (!world) return
          marqueeRef.current = { ...m, end: world }
          const x0 = Math.min(m.start.x, world.x)
          const y0 = Math.min(m.start.y, world.y)
          const x1 = Math.max(m.start.x, world.x)
          const y1 = Math.max(m.start.y, world.y)
          setMarqueeBox({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 })
        }}
        onPointerUp={e => {
          const r = resizeRef.current
          if (r && e.pointerId === r.pointerId) {
            resizeRef.current = null
            const pending = resizePendingRef.current
            resizePendingRef.current = null
            if (resizeRafRef.current != null) {
              try {
                window.cancelAnimationFrame(resizeRafRef.current)
              } catch {
                void 0
              }
              resizeRafRef.current = null
            }
            if (!active) return
            if (!pending) return
            const id = String(pending.id || '').trim()
            if (!id) return
            if (Number.isFinite(pending.x) && Number.isFinite(pending.y)) {
              setDesignFramePosMany({ [id]: { x: pending.x, y: pending.y } })
            }
            if (Number.isFinite(pending.w) && Number.isFinite(pending.h)) {
              setDesignFrameSizeMany({ [id]: { w: pending.w, h: pending.h } })
            }
            return
          }
          const m = marqueeRef.current
          marqueeRef.current = null
          setMarqueeBox(null)
          if (!active) return
          if (!m || e.pointerId !== m.pointerId) return
          const x0 = Math.min(m.start.x, m.end.x)
          const y0 = Math.min(m.start.y, m.end.y)
          const x1 = Math.max(m.start.x, m.end.x)
          const y1 = Math.max(m.start.y, m.end.y)
          const box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
          if (!box || box.w < 6 || box.h < 6) return
          const hits: string[] = []
          for (let i = 0; i < visibleNodes.length; i += 1) {
            const id = String(visibleNodes[i]?.id || '').trim()
            if (!id) continue
            const p = positions[id]
            if (!p) continue
            const ix = p.x < box.x + box.w && p.x + p.w > box.x
            const iy = p.y < box.y + box.h && p.y + p.h > box.y
            if (ix && iy) hits.push(id)
          }
          const store = useGraphStore.getState()
          store.setSelectionSource('canvas')
          const prev = (m.mode === 'add' ? store.selectedNodeIds || [] : []).map(v => String(v || '').trim()).filter(Boolean)
          const set = new Set<string>(prev)
          for (let i = 0; i < hits.length; i += 1) set.add(hits[i]!)
          const nodeIds = Array.from(set)
          store.selectNodesExpanded({ nodeIds, activeNodeId: nodeIds.length > 0 ? nodeIds[nodeIds.length - 1] : null })
        }}
        onPointerCancel={() => {
          const r = resizeRef.current
          if (r) {
            resizeRef.current = null
            resizePendingRef.current = { id: r.id, x: r.startRect.x, y: r.startRect.y, w: r.startRect.w, h: r.startRect.h }
            scheduleResizeVisual()
            resizePendingRef.current = null
            if (resizeRafRef.current != null) {
              try {
                window.cancelAnimationFrame(resizeRafRef.current)
              } catch {
                void 0
              }
              resizeRafRef.current = null
            }
          }
          marqueeRef.current = null
          setMarqueeBox(null)
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
          {styleById && wireframeEdges.length > 0 ? (
            <g data-kg-layer="wireframe-edges" style={{ pointerEvents: 'none' }}>
              {wireframeEdges.map(e => (
                <line
                  key={e.id}
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  stroke="var(--kg-border)"
                  strokeWidth={1}
                  opacity={e.opacity}
                />
              ))}
            </g>
          ) : null}

          {renderNodes.map(n => {
            const p = positions[n.id]
            if (!p) return null
            const selected = snapshot.selectedNodeId === n.id
            const style = styleById ? styleById.get(n.id) || null : null
            const base = webpageGraphNodesById ? webpageGraphNodesById[n.id] : null
            const baseProps = (base?.properties || {}) as Record<string, unknown>
            const domTag = typeof baseProps['dom:tag'] === 'string' ? String(baseProps['dom:tag'] || '').trim().toUpperCase() : ''
            const domClass = typeof baseProps['dom:attrs:class'] === 'string' ? String(baseProps['dom:attrs:class'] || '').trim() : ''
            const isSynthSection = domTag === 'SECTION' && domClass.includes('kg-synth-section')
            const kind = style?.kind || ''
            const depth = wireframeSettings.depthFade ? (domDepthById.get(n.id) ?? 0) : 0
            const isWebpageOverlay = !!(webpageLayoutGraphData?.nodes && webpageLayoutGraphData.nodes.length > 0)
            const fill = (() => {
              const hasFill = !!(styleById && style?.fill && style.fill !== 'transparent')
              if (isWebpageOverlay) {
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
              if (isWebpageOverlay) {
                const hasWireFill = !!(styleById && style?.fill && style.fill !== 'transparent') || isSynthSection
                if (hasWireFill) {
                  const area = p.w * p.h
                  if (area < 3200) return 0
                  const k = isSynthSection ? 0.08 : kind === 'interactive' ? 0.22 : kind === 'container' ? 0.18 : kind === 'media' ? 0.12 : 0.1
                  const selBoost = selected ? 1.25 : 1
                  return baseOpacity * (k * selBoost) / (1 + depth * 0.35)
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
              const base = kind === 'container' ? 0.55 : kind === 'interactive' ? 0.75 : kind === 'media' ? 0.65 : 0.22
              return Math.max(0.08, base / (1 + depth * 0.35))
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
                  if (!active) return
                  if (isSpacePanHeld()) return
                  if (snapshot.canvasPointerMode2d === 'pan') return
                  e.stopPropagation()
                  const svgEl = svgRef.current
                  if (!svgEl) return
                  const world = pointerToWorld(e, svgEl)
                  if (!world) return
                  try {
                    ;(e.currentTarget as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId)
                  } catch {
                    void 0
                  }
                  const store = useGraphStore.getState()
                  store.setSelectionSource('canvas')
                  const mode = store.schema?.behavior?.selectMode || 'single'
                  const clickedId = String(n.id || '').trim()
                  if (clickedId) {
                    if (mode === 'multi' || mode === 'lasso') {
                      if (e.shiftKey) store.selectNode(clickedId)
                      else store.selectNodesExpanded({ nodeIds: [clickedId], activeNodeId: clickedId })
                    } else {
                      store.selectNode(clickedId)
                    }
                  }
                  const selIds = (store.selectedNodeIds || []).map(v => String(v || '').trim()).filter(Boolean)
                  const ids = clickedId && selIds.includes(clickedId) ? selIds : clickedId ? [clickedId] : []
                  const startPosById: Record<string, { x: number; y: number }> = {}
                  for (let i = 0; i < ids.length; i += 1) {
                    const id = ids[i]!
                    const base = positions[id]
                    if (!base) continue
                    startPosById[id] = { x: base.x, y: base.y }
                  }
                  dragRef.current = { id: n.id, startWorld: world, startPos: { x: p.x, y: p.y }, ids, startPosById }
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
                  let sx = dx
                  let sy = dy
                  const schema = snapshot.schema
                  const grid = schema?.behavior?.snapGrid
                  const gridEnabled = !!(grid && grid.enabled && typeof grid.size === 'number' && Number.isFinite(grid.size) && grid.size > 2)
                  const allowSnap = gridEnabled && !e.altKey
                  if (allowSnap) {
                    const size = Math.max(4, Math.floor(grid!.size))
                    const nx = drag.startPos.x + dx
                    const ny = drag.startPos.y + dy
                    const snappedX = Math.round(nx / size) * size
                    const snappedY = Math.round(ny / size) * size
                    if (Number.isFinite(snappedX) && Number.isFinite(snappedY)) {
                      sx = snappedX - drag.startPos.x
                      sy = snappedY - drag.startPos.y
                    }
                  }
                  const nextPosById: Record<string, { x: number; y: number }> = {}
                  const ids = drag.ids || []
                  for (let i = 0; i < ids.length; i += 1) {
                    const id = ids[i] || ''
                    const start = drag.startPosById[id]
                    if (!start) continue
                    const nextX = start.x + sx
                    const nextY = start.y + sy
                    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) continue
                    nextPosById[id] = { x: nextX, y: nextY }
                  }
                  dragPendingRef.current = { ids: ids.slice(), nextPosById }
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
                  if (pending) {
                    const ids = pending.ids || []
                    for (let i = 0; i < ids.length; i += 1) {
                      const id = String(ids[i] || '').trim()
                      const pos = id ? pending.nextPosById?.[id] : null
                      if (id && pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) updates[id] = { x: pos.x, y: pos.y }
                    }
                  }

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
                  if (pending) {
                    const ids = pending.ids || []
                    for (let i = 0; i < ids.length; i += 1) {
                      const id = String(ids[i] || '').trim()
                      const next = id ? pending.nextPosById?.[id] : null
                      if (id && next && workPos[id]) workPos[id] = { ...workPos[id]!, x: next.x, y: next.y }
                    }
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

                  const pinnedId = (drag && String(drag.id || '').trim()) || null
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
                  ref={el => {
                    const map = frameRectElByIdRef.current
                    if (el) map.set(n.id, el)
                    else map.delete(n.id)
                  }}
                  data-kg-frame-rect="1"
                  x={0}
                  y={0}
                  width={p.w}
                  height={p.h}
                  rx={rx}
                  fill={fill}
                  fillOpacity={rectOpacity}
                  stroke={stroke}
                  strokeOpacity={strokeOpacity}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  filter={filter}
                />
                {styleById ? null : (() => {
                  const preview = designMediaPreviewById.get(n.id) || null
                  if (!preview) return null
                  const padX = 14
                  const topY = 44
                  const innerX = padX
                  const innerY = topY
                  const innerW = Math.max(1, p.w - padX * 2)
                  const innerH = Math.max(1, p.h - topY - 12)
                  return (
                    <DesignRichMediaPreview
                      tag={preview.tag}
                      url={preview.url}
                      titleChip={preview.titleChip}
                      clipId={preview.clipId}
                      innerX={innerX}
                      innerY={innerY}
                      innerW={innerW}
                      innerH={innerH}
                      opacity={0.92}
                      interactive={false}
                    />
                  )
                })()}
                {showDecor ? (
                  <path
                    ref={el => {
                      const map = frameStatusElByIdRef.current
                      if (el) map.set(n.id, el)
                      else map.delete(n.id)
                    }}
                    data-kg-frame-status="1"
                    d={`M 0 8 Q 0 0 8 0 L ${p.w - 8} 0 Q ${p.w} 0 ${p.w} 8 L ${p.w} 32 L 0 32 Z`}
                    fill="var(--kg-statusbar-bg)"
                    opacity={0.5}
                  />
                ) : null}
                {styleById ? null : (
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
                )}

                {showDecor ? (
                  <g transform="translate(16, 48)" opacity={0.3}>
                    <rect width={p.w - 32} height={12} rx={2} fill="var(--kg-text-tertiary)" />
                    <rect y={20} width={(p.w - 32) * 0.6} height={12} rx={2} fill="var(--kg-text-tertiary)" />
                    <rect y={40} width={p.w - 32} height={p.h - 100} rx={4} fill="var(--kg-border)" />
                  </g>
                ) : null}

                {styleById ? null : (
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
                )}
              </g>
            )
          })}

          {styleById ? (
            <g data-kg-layer="wireframe-text" style={{ pointerEvents: 'none' }}>
              {renderNodes.map(n => {
                const p = positions[n.id]
                if (!p) return null
                const preview = wireframePreviewById.get(n.id) || null
                if (!preview) return null
                return (
                  <g key={`txt:${n.id}`} transform={`translate(${p.x},${p.y})`}>
                    {preview.kind === 'media' ? (
                      preview.tag === 'IMG' || preview.tag === 'VIDEO' || preview.tag === 'IFRAME' ? (
                        <DesignRichMediaPreview
                          tag={preview.tag}
                          url={preview.src}
                          titleChip={preview.titleChip}
                          clipId={preview.clipId}
                          innerX={preview.innerX}
                          innerY={preview.innerY}
                          innerW={preview.innerW}
                          innerH={preview.innerH}
                          opacity={0.92}
                          interactive={false}
                        />
                      ) : (
                        <g opacity={0.92}>
                          <rect
                            x={preview.innerX}
                            y={preview.innerY}
                            width={preview.innerW}
                            height={preview.innerH}
                            rx={6}
                            fill="rgba(0,0,0,0)"
                            stroke="var(--kg-border)"
                            strokeWidth={1}
                            strokeDasharray="5 4"
                          />
                          <rect
                            x={preview.innerX}
                            y={preview.innerY}
                            width={Math.min(preview.innerW, Math.max(64, (preview.titleChip.length + 6) * 6))}
                            height={18}
                            rx={5}
                            fill="var(--kg-panel-bg)"
                            stroke="var(--kg-border)"
                            strokeWidth={1}
                            strokeOpacity={0.7}
                          />
                          <text x={preview.innerX + 10} y={preview.innerY + 13} fill="var(--kg-text-tertiary)" fontSize={10} fontWeight={600}>
                            {preview.titleChip}
                          </text>
                          {preview.tag === 'SVG' ? (
                            <g opacity={0.22}>
                              <path
                                d={`M ${preview.innerX + preview.innerW / 2 - 18} ${preview.innerY + preview.innerH / 2 - 12} Q ${preview.innerX + preview.innerW / 2 - 30} ${preview.innerY + preview.innerH / 2} ${preview.innerX + preview.innerW / 2 - 18} ${preview.innerY + preview.innerH / 2 + 12}`}
                                fill="none"
                                stroke="var(--kg-text-tertiary)"
                                strokeWidth={2}
                                strokeLinecap="round"
                              />
                              <path
                                d={`M ${preview.innerX + preview.innerW / 2 + 18} ${preview.innerY + preview.innerH / 2 - 12} Q ${preview.innerX + preview.innerW / 2 + 30} ${preview.innerY + preview.innerH / 2} ${preview.innerX + preview.innerW / 2 + 18} ${preview.innerY + preview.innerH / 2 + 12}`}
                                fill="none"
                                stroke="var(--kg-text-tertiary)"
                                strokeWidth={2}
                                strokeLinecap="round"
                              />
                              <path
                                d={`M ${preview.innerX + preview.innerW / 2 - 4} ${preview.innerY + preview.innerH / 2 + 14} L ${preview.innerX + preview.innerW / 2 + 4} ${preview.innerY + preview.innerH / 2 - 14}`}
                                fill="none"
                                stroke="var(--kg-text-tertiary)"
                                strokeWidth={2}
                                strokeLinecap="round"
                              />
                            </g>
                          ) : null}
                        </g>
                      )
                    ) : (
                      <g opacity={0.82}>
                        {preview.title ? (
                          <text x={14} y={34} fill="var(--kg-text-tertiary)" fontSize={10} fontWeight={600}>
                            {truncateTextWithEllipsis(preview.title, preview.titleMaxChars)}
                          </text>
                        ) : null}
                        <text
                          x={preview.x}
                          y={preview.y}
                          fill={preview.fill || 'var(--kg-text-primary)'}
                          fontSize={preview.fontSize}
                          fontWeight={preview.fontWeight}
                          fontFamily={preview.fontFamily}
                          textAnchor={preview.textAnchor}
                        >
                          {preview.lines.map((t, idx) => (
                            <tspan key={idx} x={preview.x} dy={idx === 0 ? 0 : preview.lineH}>
                              {t}
                            </tspan>
                          ))}
                        </text>
                      </g>
                    )}
                  </g>
                )
              })}
            </g>
          ) : null}

          {styleById ? (
            <g style={{ pointerEvents: 'none' }}>
              {renderNodes.map(n => {
                const p = positions[n.id]
                if (!p) return null
                const layout = labelLayoutById.get(n.id) || null
                if (!layout) return null
                return (
                  <g key={`lbl:${n.id}`} transform={`translate(${p.x},${p.y})`}>
                    {layout.label ? (
                      <g>
                        <rect
                          x={layout.label.boxX}
                          y={layout.label.boxY}
                          width={layout.label.boxW}
                          height={layout.label.boxH}
                          rx={4}
                          fill={layout.label.bgFill}
                          opacity={layout.label.bgOpacity}
                          stroke={layout.label.stroke}
                          strokeOpacity={layout.label.strokeOpacity}
                          strokeWidth={1}
                        />
                        <text
                          x={layout.label.textX}
                          y={layout.label.textY}
                          textAnchor={layout.label.textAnchor}
                          fill={layout.label.fill}
                          fontSize={layout.label.fontSize}
                          fontWeight={layout.label.fontWeight}
                        >
                          {layout.label.text}
                        </text>
                      </g>
                    ) : null}
                    {layout.meta ? (
                      <g>
                        <rect
                          x={layout.meta.boxX}
                          y={layout.meta.boxY}
                          width={layout.meta.boxW}
                          height={layout.meta.boxH}
                          rx={4}
                          fill={layout.meta.bgFill}
                          opacity={layout.meta.bgOpacity}
                          stroke={layout.meta.stroke}
                          strokeOpacity={layout.meta.strokeOpacity}
                          strokeWidth={1}
                        />
                        <text
                          x={layout.meta.textX}
                          y={layout.meta.textY}
                          textAnchor={layout.meta.textAnchor}
                          fill={layout.meta.fill}
                          fontSize={layout.meta.fontSize}
                        >
                          {layout.meta.text}
                        </text>
                      </g>
                    ) : null}
                  </g>
                )
              })}
            </g>
          ) : null}

          {active && snapshot.selectedNodeId ? (() => {
            const id = String(snapshot.selectedNodeId || '').trim()
            if (!id) return null
            const p = positions[id]
            if (!p) return null
            const hs = 9
            const o = hs / 2
            const fill = 'var(--kg-canvas-accent)'
            const stroke = 'var(--kg-panel-bg)'
            const sx = p.w
            const sy = p.h
            const handles: Array<{ k: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'; x: number; y: number; cursor: string }> = [
              { k: 'nw', x: 0, y: 0, cursor: 'nwse-resize' },
              { k: 'n', x: sx / 2, y: 0, cursor: 'ns-resize' },
              { k: 'ne', x: sx, y: 0, cursor: 'nesw-resize' },
              { k: 'e', x: sx, y: sy / 2, cursor: 'ew-resize' },
              { k: 'se', x: sx, y: sy, cursor: 'nwse-resize' },
              { k: 's', x: sx / 2, y: sy, cursor: 'ns-resize' },
              { k: 'sw', x: 0, y: sy, cursor: 'nesw-resize' },
              { k: 'w', x: 0, y: sy / 2, cursor: 'ew-resize' },
            ]
            return (
              <g
                ref={el => {
                  resizeOverlayElRef.current = el
                }}
                data-kg-layer="wireframe-resize"
                transform={`translate(${p.x},${p.y})`}
              >
                <rect
                  data-kg-resize-outline="1"
                  x={-1}
                  y={-1}
                  width={p.w + 2}
                  height={p.h + 2}
                  fill="rgba(0,0,0,0)"
                  stroke="var(--kg-canvas-accent)"
                  strokeWidth={1}
                  opacity={0.45}
                  style={{ pointerEvents: 'none' }}
                />
                {handles.map(h => (
                  <rect
                    key={`${id}:${h.k}`}
                    data-kg-resize-handle={h.k}
                    x={h.x - o}
                    y={h.y - o}
                    width={hs}
                    height={hs}
                    rx={2}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1}
                    style={{ cursor: h.cursor }}
                    onPointerDown={e => beginResize(e, { id, handle: h.k, rect: { x: p.x, y: p.y, w: p.w, h: p.h } })}
                  />
                ))}
              </g>
            )
          })() : null}

          {marqueeBox ? (
            <rect
              x={marqueeBox.x}
              y={marqueeBox.y}
              width={Math.max(0, marqueeBox.w)}
              height={Math.max(0, marqueeBox.h)}
              fill="var(--kg-canvas-accent)"
              opacity="0.08"
              stroke="var(--kg-canvas-accent)"
              strokeWidth={1}
              strokeDasharray="4 3"
              style={{ pointerEvents: 'none' }}
            />
          ) : null}
        </g>
      </svg>
    </section>
  )
}
