import React from 'react'
import {
  createWebpageStatusUiStore,
  type WebpageStatusUiState,
  type WebpageStatusUiStore,
} from '@/components/DesignCanvas/webpageStatusStore'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { normalizeWorkspacePath, workspaceDocumentKey } from '@/features/workspace-fs/path'
import { hashText } from '@/features/parsers/hash'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { parseWebpageFrontmatterMeta, upsertWebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'
import type { WebpageFidelityLevel, WebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'
import { createProgressTicker } from '@/lib/progress/progressTicker'
import { tryExtractDesignDocumentUrl } from '@/lib/render/designDocumentUrl'
import type { WebpageDomProbeResult } from '@/lib/websites/webpageDomExport'
import { getCachedWebpageLayoutSnapshot, setCachedWebpageLayoutSnapshot } from '@/lib/websites/webpageLayoutCache'
import type { WebpageLayoutSnapshot } from '@/lib/websites/webpageLayoutExport'
import { convertWebpageLayoutToGraphData } from '@/lib/websites/webpageLayoutToGraph'

type WebpageSourceState = {
  workspacePath: string
  frontmatter: WebpageFrontmatterMeta | null
}

type UseDesignCanvasWebpageWireframeArgs = {
  active: boolean
  graphData: GraphData | null
  activeRenderGraphData: GraphData | null
  designWireframeCacheEpoch: number
  documentSemanticMode: string
  frontmatterModeEnabled: boolean
  markdownDocumentName: string | null
  markdownDocumentText: string
  setDesignRendererWebpageGraph: (next: { key: string | null; nodesById: Record<string, GraphNode> }) => void
}

type UseDesignCanvasWebpageWireframeResult = {
  documentUrl: string | null
  webpageFrontmatter: WebpageFrontmatterMeta | null
  webpageWorkspacePath: string
  webpageLayout: WebpageLayoutSnapshot | null
  webpageLayoutStatus: 'idle' | 'loading' | 'ready' | 'error'
  setWebpageLayoutStatus: React.Dispatch<React.SetStateAction<'idle' | 'loading' | 'ready' | 'error'>>
  setWebpageStatusUi: (patch: Partial<WebpageStatusUiState>) => void
  webpageStatusStore: WebpageStatusUiStore
  activeWebpageLayoutGraphData: GraphData | null
  webpageLayoutKey: string | null
  webpageGraphNodesById: Record<string, GraphNode> | null
  decreaseWebpageFidelity: () => void
  increaseWebpageFidelity: () => void
  retryWebpageLayout: () => void
}

function readFidelityLevel(frontmatter: WebpageFrontmatterMeta | null | undefined): WebpageFidelityLevel {
  return frontmatter?.fidelityLevel === 1 || frontmatter?.fidelityLevel === 2 || frontmatter?.fidelityLevel === 3 || frontmatter?.fidelityLevel === 4
    ? frontmatter.fidelityLevel
    : 3
}

function cacheWebpageLayoutGraph(
  cacheKey: string | null,
  graphData: GraphData | null,
  cacheRef: React.MutableRefObject<Map<string, GraphData>>,
  cacheOrderRef: React.MutableRefObject<string[]>,
): GraphData | null {
  if (!cacheKey || !graphData) return graphData
  const order = cacheOrderRef.current
  const map = cacheRef.current
  if (!map.has(cacheKey)) {
    order.push(cacheKey)
    if (order.length > 8) {
      const drop = order.shift()
      if (drop) map.delete(drop)
    }
  }
  map.set(cacheKey, graphData)
  return graphData
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
  const nodes = Array.isArray(graphData?.nodes) ? (graphData.nodes as unknown as Array<Record<string, unknown>>) : []
  for (let i = 0; i < Math.min(80, nodes.length); i += 1) {
    const node = nodes[i]
    const metadata =
      node && typeof node === 'object' && 'metadata' in node ? ((node as { metadata?: unknown }).metadata as Record<string, unknown> | null) : null
    if (!metadata) continue
    const path = typeof metadata.documentPath === 'string' ? metadata.documentPath.trim() : ''
    if (path) out.push(path)
  }
  const unique = new Set<string>()
  const cleaned: string[] = []
  for (let i = 0; i < out.length; i += 1) {
    const raw = String(out[i] || '').trim()
    if (!raw) continue
    const noHash = raw.split('#')[0] || raw
    const noQuery = noHash.split('?')[0] || noHash
    const key = noQuery.replace(/^\/+/, '').trim()
    if (!key || unique.has(key)) continue
    unique.add(key)
    cleaned.push(key)
  }
  return cleaned.slice(0, 6)
}

export function useDesignCanvasWebpageWireframe(args: UseDesignCanvasWebpageWireframeArgs): UseDesignCanvasWebpageWireframeResult {
  const {
    active,
    graphData,
    activeRenderGraphData,
    designWireframeCacheEpoch,
    documentSemanticMode,
    frontmatterModeEnabled,
    markdownDocumentName,
    markdownDocumentText,
    setDesignRendererWebpageGraph,
  } = args
  const directDocumentUrl = React.useMemo(() => tryExtractDesignDocumentUrl(graphData), [graphData])
  const [webpageSource, setWebpageSource] = React.useState<WebpageSourceState>({ workspacePath: '', frontmatter: null })
  const webpageWorkspacePath = webpageSource.workspacePath
  const webpageFrontmatter = webpageSource.frontmatter
  const documentUrl = React.useMemo(() => {
    const frontmatterUrl = String(webpageFrontmatter?.url || '').trim()
    if (frontmatterUrl && /^https?:\/\//i.test(frontmatterUrl)) return frontmatterUrl
    const fallbackUrl = String(directDocumentUrl || '').trim()
    return fallbackUrl && /^https?:\/\//i.test(fallbackUrl) ? fallbackUrl : null
  }, [directDocumentUrl, webpageFrontmatter?.url])
  const [webpageLayout, setWebpageLayout] = React.useState<WebpageLayoutSnapshot | null>(null)
  const [webpageLayoutStatus, setWebpageLayoutStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [webpageLayoutRetryNonce, setWebpageLayoutRetryNonce] = React.useState<number>(0)
  const webpageStatusStoreRef = React.useRef<WebpageStatusUiStore | null>(null)
  if (!webpageStatusStoreRef.current) webpageStatusStoreRef.current = createWebpageStatusUiStore()
  const setWebpageStatusUi = React.useCallback((patch: Partial<WebpageStatusUiState>) => {
    webpageStatusStoreRef.current?.setState(patch)
  }, [])
  const lastWebpageLayoutUrlRef = React.useRef<string>('')
  const lastWebpageLayoutReqRef = React.useRef<number>(0)
  const webpageLayoutGraphCacheRef = React.useRef<Map<string, GraphData>>(new Map())
  const webpageLayoutGraphCacheOrderRef = React.useRef<string[]>([])

  React.useEffect(() => {
    if (!active) return
    const workspacePath = tryExtractWebpageWorkspacePath(graphData)
    let cancelled = false
    void (async () => {
      const fs = await getWorkspaceFs()
      const candidates: string[] = []
      if (workspacePath) candidates.push(workspacePath)
      if (candidates.length === 0) {
        const docKeys = tryExtractDocumentPaths(graphData)
        if (docKeys.length > 0) {
          const entries = await fs.listEntries().catch(() => [])
          const byDocKey = new Map<string, string>()
          for (let i = 0; i < entries.length; i += 1) {
            const entry = entries[i] as { kind?: unknown; path?: unknown } | null
            if (!entry || entry.kind !== 'file') continue
            const normalizedPath = normalizeWorkspacePath(entry.path)
            const docKey = workspaceDocumentKey(normalizedPath)
            if (!docKey || byDocKey.has(docKey)) continue
            byDocKey.set(docKey, normalizedPath)
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
        const frontmatter = parseWebpageFrontmatterMeta(text)
        const url = String(frontmatter?.url || '').trim()
        if (!url || !/^https?:\/\//i.test(url)) continue
        if (!cancelled) setWebpageSource({ workspacePath: String(candidates[i] || ''), frontmatter })
        return
      }
      if (!cancelled) setWebpageSource({ workspacePath: '', frontmatter: null })
    })()
    return () => {
      cancelled = true
    }
  }, [active, graphData, webpageLayoutRetryNonce])

  React.useEffect(() => {
    if (!active) return
    const url = String(documentUrl || '').trim()
    if (!url) {
      lastWebpageLayoutUrlRef.current = ''
      setWebpageLayout(null)
      setWebpageLayoutStatus('idle')
      setWebpageStatusUi({ progress: 0, message: '' })
      return
    }
    const prevUrl = lastWebpageLayoutUrlRef.current
    lastWebpageLayoutUrlRef.current = url
    const requestId = (lastWebpageLayoutReqRef.current += 1)
    let cancelled = false
    const allowCache = webpageLayoutRetryNonce <= 0
    const fidelity = readFidelityLevel(webpageFrontmatter)
    const maxElements = fidelity === 4 ? 3200 : fidelity === 3 ? 2400 : fidelity === 2 ? 1800 : 1400
    const viewportW = (() => {
      try {
        const width = typeof window !== 'undefined' ? window.innerWidth : 0
        if (!Number.isFinite(width) || width <= 0) return 1200
        return Math.max(900, Math.min(1400, Math.floor(width * 0.9)))
      } catch {
        return 1200
      }
    })()
    const viewportH = (() => {
      try {
        const height = typeof window !== 'undefined' ? window.innerHeight : 0
        if (!Number.isFinite(height) || height <= 0) return 800
        return Math.max(650, Math.min(1000, Math.floor(height * 0.84)))
      } catch {
        return 800
      }
    })()
    const networkIdleMs = fidelity >= 3 ? 1100 : 900
    const domQuietMs = fidelity >= 3 ? 900 : 650
    const minWaitAfterLoadMs = fidelity >= 3 ? 1600 : 1200
    const epoch = Number.isFinite(designWireframeCacheEpoch) ? designWireframeCacheEpoch : 0
    const layoutCacheKey = `layout:v2:e=${epoch}:maxEl=${maxElements}:vp=${viewportW}x${viewportH}:scroll=1:faq=1:netIdle=1:netIdleMs=${networkIdleMs}:domQuietMs=${domQuietMs}:minAfter=${minWaitAfterLoadMs}`
    if (allowCache) {
      const cached = getCachedWebpageLayoutSnapshot(url, layoutCacheKey)
      if (cached) {
        setWebpageLayout(cached)
        setWebpageLayoutStatus('ready')
        setWebpageStatusUi({ progress: 100, message: 'Loaded from cache' })
        return
      }
    }
    if (prevUrl && prevUrl !== url) setWebpageLayout(null)
    setWebpageLayoutStatus('loading')
    setWebpageStatusUi({ progress: 0, message: 'Loading webpage for wireframe…' })
    const ticker = createProgressTicker({
      onProgress: progress => setWebpageStatusUi({ progress }),
      intervalMs: 280,
      maxPercentage: 92,
      maxStepPercentage: 12,
    })
    const abortController = new AbortController()
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
          signal: abortController.signal,
        })
        if (cancelled || requestId !== lastWebpageLayoutReqRef.current) return
        if (!probe.ok) {
          const fail = probe as Extract<WebpageDomProbeResult, { ok: false }>
          ticker.stop()
          setWebpageLayout(null)
          setWebpageLayoutStatus('error')
          setWebpageStatusUi({ message: `Export failed (${fail.stage}): ${fail.error}` })
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
        const resultText = probe.result?.text
        if (!resultText) {
          ticker.stop()
          setWebpageLayout(null)
          setWebpageLayoutStatus('error')
          setWebpageStatusUi({ message: 'Export failed: empty result' })
          return
        }
        const snapshot = (() => {
          try {
            const parsed = JSON.parse(resultText) as unknown
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
            const objectValue = parsed as Record<string, unknown>
            const meta = objectValue.meta as Record<string, unknown> | null
            const elements = objectValue.elements as unknown
            if (!meta || typeof meta !== 'object' || !Array.isArray(elements) || meta.kind !== 'layout') return null
            return parsed as WebpageLayoutSnapshot
          } catch {
            return null
          }
        })()
        if (!snapshot) {
          ticker.stop()
          setWebpageLayout(null)
          setWebpageLayoutStatus('error')
          setWebpageStatusUi({ message: 'Export failed: invalid snapshot payload' })
          return
        }
        setCachedWebpageLayoutSnapshot(url, snapshot, layoutCacheKey)
        setWebpageLayout(snapshot)
        setWebpageLayoutStatus('ready')
        ticker.stop(100)
        const count = Array.isArray(snapshot.elements) ? snapshot.elements.length : 0
        setWebpageStatusUi({ progress: 100, message: `Wireframe ready — elements=${count}` })
      } catch (error) {
        if (cancelled || requestId !== lastWebpageLayoutReqRef.current) return
        ticker.stop()
        const message =
          error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message || '') : ''
        setWebpageLayout(null)
        setWebpageLayoutStatus('error')
        setWebpageStatusUi({ message: `Export failed: ${message || 'Request failed'}` })
        try {
          useGraphStore.getState().pushUiToast({
            id: 'design-webpage-layout-failed',
            kind: 'warning',
            message: `Webpage wireframe export failed: ${message || 'Request failed'}`,
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
        abortController.abort()
      } catch {
        void 0
      }
      try {
        ticker.stop()
      } catch {
        void 0
      }
    }
  }, [active, designWireframeCacheEpoch, documentUrl, setWebpageStatusUi, webpageFrontmatter, webpageLayoutRetryNonce])

  const webpageLayoutGraphData = React.useMemo(() => {
    if (!webpageLayout) return null
    const fidelity = readFidelityLevel(webpageFrontmatter)
    const url = String(documentUrl || '').trim()
    const timestamp = typeof webpageLayout.meta?.ts === 'number' && Number.isFinite(webpageLayout.meta.ts) ? webpageLayout.meta.ts : null
    const elementCountKey = Array.isArray(webpageLayout.elements) ? webpageLayout.elements.length : null
    const epoch = Number.isFinite(designWireframeCacheEpoch) ? designWireframeCacheEpoch : 0
    const cacheKey = url && timestamp != null && elementCountKey != null ? `${url}#${timestamp}#${elementCountKey}::f${fidelity}::e${epoch}` : null
    if (cacheKey) {
      const cached = webpageLayoutGraphCacheRef.current.get(cacheKey) || null
      if (cached) return cached
    }
    const areaScale = fidelity === 4 ? 0.55 : fidelity === 3 ? 0.75 : fidelity === 2 ? 1 : 1.25
    const nodeScale = fidelity === 4 ? 1.7 : fidelity === 3 ? 1.35 : fidelity === 2 ? 1 : 0.75
    const viewportW = typeof webpageLayout.meta?.viewport?.w === 'number' ? webpageLayout.meta.viewport.w : null
    const viewportH = typeof webpageLayout.meta?.viewport?.h === 'number' ? webpageLayout.meta.viewport.h : null
    const viewportArea = viewportW != null && viewportH != null && Number.isFinite(viewportW) && Number.isFinite(viewportH) ? viewportW * viewportH : null
    const baseMinAreaPx = (() => {
      if (viewportArea != null && viewportArea > 0) {
        const scaled = Math.round(viewportArea * 0.012)
        return Math.max(6000, Math.min(30_000, scaled))
      }
      return 9000
    })()
    const minAreaPx0 = Math.max(1, Math.round(baseMinAreaPx * areaScale))
    const elementCount = Array.isArray(webpageLayout.elements) ? webpageLayout.elements.length : 0
    const baseMaxNodes = (() => {
      const base = elementCount > 0 ? Math.max(900, Math.min(2600, Math.round(elementCount * 0.55))) : 1400
      return Math.max(200, Math.min(5000, Math.round(base * nodeScale)))
    })()
    const primary = { minAreaPx: minAreaPx0, maxNodes: baseMaxNodes }
    const secondary = {
      minAreaPx: Math.max(1, Math.round(minAreaPx0 * 0.82)),
      maxNodes: Math.max(200, Math.min(5000, Math.round(baseMaxNodes * 1.3))),
    }
    const tertiary = {
      minAreaPx: 1,
      maxNodes: Math.max(2000, Math.min(5000, Math.round(3400 * nodeScale))),
    }
    const graph1 = convertWebpageLayoutToGraphData(webpageLayout, {
      maxNodes: primary.maxNodes,
      minAreaPx: primary.minAreaPx,
      fidelityLevel: fidelity,
    })
    const nodeCount1 = Array.isArray(graph1?.nodes) ? graph1.nodes.length : 0
    if (nodeCount1 >= 18) return cacheWebpageLayoutGraph(cacheKey, graph1, webpageLayoutGraphCacheRef, webpageLayoutGraphCacheOrderRef)
    const graph2 = convertWebpageLayoutToGraphData(webpageLayout, {
      maxNodes: secondary.maxNodes,
      minAreaPx: secondary.minAreaPx,
      fidelityLevel: fidelity,
    })
    const nodeCount2 = Array.isArray(graph2?.nodes) ? graph2.nodes.length : 0
    const bestGraph = nodeCount2 > nodeCount1 ? graph2 : graph1
    const bestCount = Math.max(nodeCount1, nodeCount2)
    if (bestCount >= 8) return cacheWebpageLayoutGraph(cacheKey, bestGraph, webpageLayoutGraphCacheRef, webpageLayoutGraphCacheOrderRef)
    const graph3 = convertWebpageLayoutToGraphData(webpageLayout, {
      maxNodes: tertiary.maxNodes,
      minAreaPx: tertiary.minAreaPx,
      fidelityLevel: fidelity,
    })
    const nodeCount3 = Array.isArray(graph3?.nodes) ? graph3.nodes.length : 0
    return cacheWebpageLayoutGraph(cacheKey, nodeCount3 > bestCount ? graph3 : bestGraph, webpageLayoutGraphCacheRef, webpageLayoutGraphCacheOrderRef)
  }, [designWireframeCacheEpoch, documentUrl, webpageFrontmatter, webpageLayout])

  const useWebpageLayoutGraph = React.useMemo(() => {
    const graphForMode = activeRenderGraphData || graphData
    const effectiveFrontmatter = computeEffectiveFrontmatterMode({
      frontmatterModeEnabled,
      documentSemanticMode,
      graphData: graphForMode,
    })
    return documentSemanticMode === 'document' && !effectiveFrontmatter
  }, [activeRenderGraphData, documentSemanticMode, frontmatterModeEnabled, graphData])

  const activeWebpageLayoutGraphData = React.useMemo(
    () => (useWebpageLayoutGraph ? webpageLayoutGraphData : null),
    [useWebpageLayoutGraph, webpageLayoutGraphData],
  )

  React.useEffect(() => {
    if (!documentUrl || webpageLayoutStatus !== 'ready') return
    const elementCount = Array.isArray(webpageLayout?.elements) ? webpageLayout.elements.length : 0
    const nodeCount = Array.isArray(activeWebpageLayoutGraphData?.nodes) ? activeWebpageLayoutGraphData.nodes.length : 0
    setWebpageStatusUi({ message: `Wireframe ready — elements=${elementCount}, nodes=${nodeCount}` })
  }, [activeWebpageLayoutGraphData, documentUrl, setWebpageStatusUi, webpageLayout, webpageLayoutStatus])

  const webpageLayoutKey = React.useMemo(() => {
    const url = String(documentUrl || '').trim()
    if (!url) return null
    const timestamp = typeof webpageLayout?.meta?.ts === 'number' && Number.isFinite(webpageLayout.meta.ts) ? webpageLayout.meta.ts : null
    const elementCount = Array.isArray(webpageLayout?.elements) ? webpageLayout.elements.length : null
    if (timestamp == null || elementCount == null) return null
    const fidelity = readFidelityLevel(webpageFrontmatter)
    const base = `${url}#${timestamp}#${elementCount}::f${fidelity}`
    const nodes = Array.isArray(activeWebpageLayoutGraphData?.nodes) ? activeWebpageLayoutGraphData.nodes : null
    if (!nodes || nodes.length === 0) return base
    const ids: string[] = []
    for (let i = 0; i < nodes.length && ids.length < 240; i += 1) {
      const id = String(nodes[i]?.id || '').trim()
      if (id) ids.push(id)
    }
    ids.sort()
    return `${base}::g${hashText(`${ids.join('|')}|${nodes.length}`)}`
  }, [activeWebpageLayoutGraphData, documentUrl, webpageFrontmatter, webpageLayout])

  const webpageGraphNodesById = React.useMemo(() => {
    if (!activeWebpageLayoutGraphData?.nodes || activeWebpageLayoutGraphData.nodes.length === 0) return null
    const out: Record<string, GraphNode> = {}
    for (let i = 0; i < activeWebpageLayoutGraphData.nodes.length; i += 1) {
      const node = activeWebpageLayoutGraphData.nodes[i] as GraphNode
      const id = String(node.id || '').trim()
      if (id) out[id] = node
    }
    return out
  }, [activeWebpageLayoutGraphData])

  const markdownOverlayKey = React.useMemo(() => {
    const name = String(markdownDocumentName || '').trim()
    const text = String(markdownDocumentText || '')
    if (!name || !text.trim()) return null
    return `md:${name}::${hashText(text)}`
  }, [markdownDocumentName, markdownDocumentText])

  React.useEffect(() => {
    if (!active) {
      setDesignRendererWebpageGraph({ key: null, nodesById: {} })
      return
    }
    if (markdownOverlayKey) {
      setDesignRendererWebpageGraph({ key: markdownOverlayKey, nodesById: {} })
      return
    }
    if (webpageLayoutKey && webpageGraphNodesById) setDesignRendererWebpageGraph({ key: webpageLayoutKey, nodesById: webpageGraphNodesById })
    else setDesignRendererWebpageGraph({ key: null, nodesById: {} })
  }, [active, markdownOverlayKey, setDesignRendererWebpageGraph, webpageGraphNodesById, webpageLayoutKey])

  const adjustWebpageFidelity = React.useCallback(
    (delta: -1 | 1) => {
      const workspacePath = String(webpageWorkspacePath || '').trim()
      if (!workspacePath) return
      void (async () => {
        const fs = await getWorkspaceFs()
        const text = await fs.readFileText(workspacePath).catch(() => '')
        const frontmatter = parseWebpageFrontmatterMeta(text)
        if (!frontmatter) return
        const current = readFidelityLevel(frontmatter)
        const next = (delta < 0 ? (current > 1 ? current - 1 : 1) : (current < 4 ? current + 1 : 4)) as WebpageFidelityLevel
        const nextText = upsertWebpageFrontmatterMeta(text, { ...frontmatter, fidelityLevel: next })
        await fs.writeFileText(workspacePath, nextText).catch(() => void 0)
        setWebpageSource(prev => ({ ...prev, frontmatter: { ...frontmatter, fidelityLevel: next } }))
        setWebpageLayoutRetryNonce(value => value + 1)
      })()
    },
    [webpageWorkspacePath],
  )

  const retryWebpageLayout = React.useCallback(() => {
    setWebpageLayout(null)
    setWebpageLayoutStatus('loading')
    setWebpageStatusUi({ progress: 0, message: 'Retrying…' })
    setWebpageLayoutRetryNonce(value => value + 1)
  }, [setWebpageStatusUi])

  return {
    documentUrl,
    webpageFrontmatter,
    webpageWorkspacePath,
    webpageLayout,
    webpageLayoutStatus,
    setWebpageLayoutStatus,
    setWebpageStatusUi,
    webpageStatusStore: webpageStatusStoreRef.current,
    activeWebpageLayoutGraphData,
    webpageLayoutKey,
    webpageGraphNodesById,
    decreaseWebpageFidelity: () => adjustWebpageFidelity(-1),
    increaseWebpageFidelity: () => adjustWebpageFidelity(1),
    retryWebpageLayout,
  }
}
