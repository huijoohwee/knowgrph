import { listMediaOverlayNodes } from '@/lib/render/mediaOverlayPool'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { inferMediaKindFromUrl } from 'grph-shared/rich-media/mediaKind'
import { ensureKgTokensInstalled, resolveCssVarWithKgFallback } from '@/lib/ui/tokens-ssot'
import { safeScaleExtent } from '@/lib/zoom/scaleExtent'
import { buildHtmlViewerRuntimeScript } from './runtimeScript'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import { filterGroupsByCollapsedAncestors } from '@/lib/graph/groupVisibility'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'
import { extractNodePosByIdFromSvgMarkup } from '@/lib/graph/svgNodePos'
import { ensureSvgHasEdgeGeometry } from '@/lib/graph/svgEdgeGeometry'
import { deriveMarkdownDesignLayoutFromGraphBlocks } from '@/features/markdown-edgeless/markdownDesignLayout'
import { computeMarkdownAnchorNodeIdByBlockId } from '@/lib/render/markdownPanelOverlayPool'
import { readDocumentViewModeContext } from '@/lib/graph/documentViewMode'
import type { OverlayDensitySizingConfigInput } from '@/lib/render/overlaySizing2d'
import { readOverlaySizingConfigForDensity } from '@/lib/render/overlaySizing2d'
import {
  decodeRepoFileUrlToRelPath,
  inlineStandaloneAssetUrlToDataUrl,
  inlineRepoFileUrlToDataUrl,
  unwrapStandaloneProxyUrl,
} from '@/lib/graph/htmlViewer/standaloneAssetRewrite'
import { normalizeSemanticHtmlContainers } from '@/lib/html/semanticHtml'

type HtmlViewerMediaNode = {
  id: string
  title: string
  url: string
  openUrl?: string
  interactive: boolean
  kind: 'iframe' | 'image' | 'svg' | 'video' | 'audio'
}

type HtmlViewerMarkdownSeed = {
  id: string
  anchorNodeId?: string
  title: string
  summary: string
  preview: { kind: 'other' }
  x: number
  y: number
  w: number
  h: number
}

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const escapeHtml = (s: string): string => {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const readNumAttr = (el: Element, name: string): number | null => {
  const raw = String(el.getAttribute(name) || '').trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

const readRichMediaPanelTitle = (el: Element): string => {
  const titleAttr = String(el.getAttribute('data-kg-title') || '').trim()
  if (titleAttr) return titleAttr
  const labeledLink = el.querySelector('a[aria-label]') as HTMLElement | null
  const linkLabel = String(labeledLink?.getAttribute('aria-label') || '').trim()
  if (linkLabel) return linkLabel
  const titledFrame = el.querySelector('iframe[title]') as HTMLElement | null
  const frameTitle = String(titledFrame?.getAttribute('title') || '').trim()
  if (frameTitle) return frameTitle
  const titledMedia = el.querySelector('video[title],audio[title],img[alt]') as HTMLElement | null
  const mediaTitle = String(
    titledMedia?.getAttribute('title') || titledMedia?.getAttribute('alt') || '',
  ).trim()
  if (mediaTitle) return mediaTitle
  return ''
}

const readMarkdownOverlayIdFromElement = (el: Element): string => {
  return String(el.getAttribute('data-md-id') || '').trim()
}

const readMarkdownOverlayAnchorNodeIdFromElement = (el: Element): string => {
  return String(el.getAttribute('data-kg-anchor-node-id') || '').trim()
}

const canonicalizeMarkdownOverlayElement = (el: Element, args: { id: string; anchorNodeId?: string }): void => {
  try {
    el.setAttribute('data-md-id', args.id)
  } catch {
    void 0
  }
  try {
    if (args.anchorNodeId) el.setAttribute('data-kg-anchor-node-id', args.anchorNodeId)
    else el.removeAttribute('data-kg-anchor-node-id')
  } catch {
    void 0
  }
}

const inferMediaKind = (rawUrl: string): HtmlViewerMediaNode['kind'] => {
  const inferred = inferMediaKindFromUrl(rawUrl)
  if (inferred === 'image' || inferred === 'svg' || inferred === 'video' || inferred === 'audio') return inferred
  return 'iframe'
}

const tryReadCssVar = (name: string, fallback: string): string => {
  try {
    if (typeof document === 'undefined') return fallback
    const raw = String(getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim()
    return raw || fallback
  } catch {
    return fallback
  }
}

const buildGraphNodeIdentity = (args: { graph: GraphData | null | undefined; svgMarkup: string }): {
  nodeIdSet: Set<string>
  edgeLinkedNodeIdSet: Set<string>
  resolveNodeId: (raw: string) => string
} => {
  const graph = args.graph
  const svgMarkup = String(args.svgMarkup || '')
  const nodes = Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
  const nodeIdSet = new Set<string>()
  for (let i = 0; i < nodes.length; i += 1) {
    const rawId = String(nodes[i]?.id || '').trim()
    if (!rawId) continue
    nodeIdSet.add(rawId)
  }

  if (svgMarkup.trim()) {
    const re = /\bdata-node-id\s*=\s*(?:"([^"]+)"|'([^']+)')/gi
    let m: RegExpExecArray | null = null
    while ((m = re.exec(svgMarkup))) {
      const rawId = String(m[1] || m[2] || '').trim()
      if (!rawId) continue
      nodeIdSet.add(rawId)
    }
  }

  const nodeIdBySuffix: Record<string, string> = {}
  for (const rawId of nodeIdSet) {
    const suffix = rawId.split('::').pop() || ''
    if (suffix && !nodeIdBySuffix[suffix]) nodeIdBySuffix[suffix] = rawId
  }

  const shouldSkipSuffixResolve = (id: string): boolean => {
    const s = String(id || '').trim()
    if (!s) return true
    const lower = s.toLowerCase()
    if (lower.includes('::blk:')) return true
    if (lower.includes('::block:')) return true
    if (lower.startsWith('blk:')) return true
    return false
  }

  const resolveNodeId = (raw: string): string => {
    const id = String(raw || '').trim()
    if (!id) return ''
    if (nodeIdSet.has(id)) return id
    if (shouldSkipSuffixResolve(id)) return id
    const suffix = id.split('::').pop() || ''
    if (!suffix) return id
    return nodeIdBySuffix[suffix] || id
  }
  const edges = Array.isArray(graph?.edges) ? (graph!.edges as GraphEdge[]) : []
  const edgeLinkedNodeIdSet = new Set<string>()

  const readEdgeEndpointId = (raw: unknown): string => {
    if (typeof raw === 'string') return String(raw || '').trim()
    if (raw && typeof raw === 'object') {
      const maybeId = (raw as { id?: unknown }).id
      if (typeof maybeId === 'string') return String(maybeId || '').trim()
    }
    return String(raw || '').trim()
  }

  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]
    const rawSource = (e as unknown as { source?: unknown; sourceId?: unknown; source_id?: unknown }).source
    const rawTarget = (e as unknown as { target?: unknown; targetId?: unknown; target_id?: unknown }).target
    const rawSourceAlt = (e as unknown as { sourceId?: unknown; source_id?: unknown }).sourceId ?? (e as unknown as { source_id?: unknown }).source_id
    const rawTargetAlt = (e as unknown as { targetId?: unknown; target_id?: unknown }).targetId ?? (e as unknown as { target_id?: unknown }).target_id
    const s = resolveNodeId(readEdgeEndpointId(rawSource ?? rawSourceAlt))
    const t = resolveNodeId(readEdgeEndpointId(rawTarget ?? rawTargetAlt))
    if (s && nodeIdSet.has(s)) edgeLinkedNodeIdSet.add(s)
    if (t && nodeIdSet.has(t)) edgeLinkedNodeIdSet.add(t)
  }

  if (svgMarkup.trim()) {
    const epRe = /\bdata-(?:source-id|source|target-id|target)\s*=\s*(?:"([^"]+)"|'([^']+)')/gi
    let mm: RegExpExecArray | null = null
    while ((mm = epRe.exec(svgMarkup))) {
      const raw = String(mm[1] || mm[2] || '').trim()
      if (!raw) continue
      const id = resolveNodeId(raw)
      if (id && nodeIdSet.has(id)) edgeLinkedNodeIdSet.add(id)
    }
  }
  return { nodeIdSet, edgeLinkedNodeIdSet, resolveNodeId }
}

const filterStandaloneOverlayHtml = (args: {
  overlayHtml: string
  hasGraphNodeIdentity: boolean
  resolveOverlayNodeId: (raw: string) => string
  shouldKeepOverlayLinkedToGraph: (args0: { nodeId?: string; anchorNodeId?: string }) => boolean
}): string => {
  const raw = String(args.overlayHtml || '')
  if (!raw.trim()) return ''
  if (!args.hasGraphNodeIdentity) return raw
  const buildMarkdownOverlayKey = (args0: {
    idRaw?: string
    idNorm?: string
    anchorRaw?: string
    anchorNorm?: string
  }): string => {
    const anchor = String(args0.anchorNorm || args0.anchorRaw || '').trim()
    if (anchor) return `md:${anchor}`
    const id = String(args0.idNorm || args0.idRaw || '').trim()
    if (id) return `md:${id}`
    return ''
  }
  const readStyleScore = (styleRaw: string): number => {
    const style = String(styleRaw || '').toLowerCase()
    if (!style) return 0
    if (/(?:^|;)\s*display\s*:\s*none\b/i.test(style)) return -200
    if (/(?:^|;)\s*visibility\s*:\s*hidden\b/i.test(style)) return -180
    if (/(?:^|;)\s*opacity\s*:\s*0(?:\D|$)/i.test(style)) return -160
    const isFixed = /(?:^|;)\s*position\s*:\s*(?:fixed|sticky)\b/i.test(style)
    const hasExplicitAnchor = /(?:^|;)\s*(?:left|top|right|bottom|inset)\s*:/i.test(style)
    if (isFixed && hasExplicitAnchor) return -40
    if (isFixed) return -20
    return 0
  }
  const filterByRegex = (src: string): string => {
    const text = String(src || '')
    if (!text.trim()) return ''
    const upsertAttr = (tag: string, name: string, value: string): string => {
      if (!value) return tag
      const cleaned = String(tag || '').replace(new RegExp(`\\s${name}=(?:"[^"]*"|'[^']*')`, 'i'), '')
      return cleaned.replace(/>$/, ` ${name}="${value}">`)
    }
    const stripAttr = (tag: string, name: string): string => {
      return String(tag || '').replace(new RegExp(`\\s${name}=(?:"[^"]*"|'[^']*')`, 'ig'), '')
    }
    const readAttr = (tag: string, name: string): string => {
      const s = String(tag || '')
      const key1 = `${name}="`
      const key2 = `${name}='`
      const i1 = s.indexOf(key1)
      if (i1 >= 0) {
        const start = i1 + key1.length
        const end = s.indexOf('"', start)
        return end > start ? s.slice(start, end).trim() : ''
      }
      const i2 = s.indexOf(key2)
      if (i2 >= 0) {
        const start = i2 + key2.length
        const end = s.indexOf("'", start)
        return end > start ? s.slice(start, end).trim() : ''
      }
      return ''
    }
    const canonicalizeMarkdownOverlayTag = (tag: string, id: string, anchorNodeId: string): string => {
      let nextTag = tag
      nextTag = stripAttr(nextTag, 'data-kg-anchor-node-id')
      nextTag = upsertAttr(nextTag, 'data-md-id', id)
      if (anchorNodeId) nextTag = upsertAttr(nextTag, 'data-kg-anchor-node-id', anchorNodeId)
      return nextTag
    }
    const out: string[] = []
    let sawOverlayCandidate = false
    const mediaBestByKey = new Map<string, { chunk: string; score: number }>()
    const mdBestByKey = new Map<string, { chunk: string; score: number }>()
    const mediaRe = /<article\b[^>]*data-kg-rich-media-panel=(?:"1"|'1')[^>]*>[\s\S]*?<\/article>/gi
    let mm: RegExpExecArray | null = null
    while ((mm = mediaRe.exec(text))) {
      sawOverlayCandidate = true
      const chunk = mm[0] || ''
      const tag = chunk.match(/<article\b[^>]*>/i)?.[0] || ''
      const nodeId = args.resolveOverlayNodeId(readAttr(tag, 'data-node-id'))
      const key = nodeId ? `media:${nodeId}` : ''
      if (!nodeId || !key) continue
      if (!args.shouldKeepOverlayLinkedToGraph({ nodeId })) continue
      const normalized = chunk.replace(tag, upsertAttr(tag, 'data-node-id', nodeId))
      const score = readStyleScore(readAttr(tag, 'style'))
      const prev = mediaBestByKey.get(key)
      if (!prev || score > prev.score) {
        mediaBestByKey.set(key, { chunk: normalized, score })
      }
    }
    const mdRe = /<article\b[^>]*data-md-id[^>]*>[\s\S]*?<\/article>/gi
    let mdm: RegExpExecArray | null = null
    while ((mdm = mdRe.exec(text))) {
      sawOverlayCandidate = true
      const chunk = mdm[0] || ''
      const tag = chunk.match(/<article\b[^>]*>/i)?.[0] || ''
      const idRaw = readAttr(tag, 'data-md-id')
      const anchorRaw = readAttr(tag, 'data-kg-anchor-node-id')
      const idNorm = args.resolveOverlayNodeId(idRaw)
      const anchorNorm = args.resolveOverlayNodeId(anchorRaw)
      const key = buildMarkdownOverlayKey({ idRaw, idNorm, anchorRaw, anchorNorm })
      if (!key) continue
      if (!args.shouldKeepOverlayLinkedToGraph({ nodeId: idNorm || idRaw, anchorNodeId: anchorNorm || anchorRaw })) continue
      const nextTag = canonicalizeMarkdownOverlayTag(tag, idNorm || idRaw, anchorNorm || anchorRaw)
      const normalized = chunk.replace(tag, nextTag)
      const score = readStyleScore(readAttr(tag, 'style'))
      const prev = mdBestByKey.get(key)
      if (!prev || score > prev.score) {
        mdBestByKey.set(key, { chunk: normalized, score })
      }
    }
    for (const item of mediaBestByKey.values()) {
      if (item.score <= -100) continue
      out.push(item.chunk)
    }
    for (const item of mdBestByKey.values()) {
      if (item.score <= -100) continue
      out.push(item.chunk)
    }
    if (out.length <= 0) return sawOverlayCandidate ? '' : text
    return out.join('')
  }
  try {
    if (typeof DOMParser === 'undefined') return filterByRegex(raw)
    const doc = new DOMParser().parseFromString(
      `<!doctype html><html><body><section id="kg-overlay-filter-root">${raw}</section></body></html>`,
      'text/html',
    )
    const root = doc.querySelector('#kg-overlay-filter-root')
    if (!root) return raw
    const mediaBestByKey = new Map<string, { el: Element; score: number }>()
    const mediaEls = root.querySelectorAll('[data-kg-rich-media-panel="1"][data-kg-rich-media-render-surface="1"][data-node-id]')
    for (let i = 0; i < mediaEls.length; i += 1) {
      const el = mediaEls[i] as Element
      const rawId = String(el.getAttribute('data-node-id') || '').trim()
      const nodeId = args.resolveOverlayNodeId(rawId)
      const key = nodeId ? `media:${nodeId}` : ''
      const keep = !!nodeId && args.shouldKeepOverlayLinkedToGraph({ nodeId })
      if (!keep || !key) {
        el.remove()
        continue
      }
      const score = readStyleScore(String(el.getAttribute('style') || '').trim())
      const prev = mediaBestByKey.get(key)
      if (!prev || score > prev.score) {
        mediaBestByKey.set(key, { el, score })
      }
      try {
        el.setAttribute('data-node-id', nodeId)
      } catch {
        void 0
      }
    }
    for (let i = 0; i < mediaEls.length; i += 1) {
      const el = mediaEls[i] as Element
      if (!el || !el.isConnected) continue
      const nodeId = args.resolveOverlayNodeId(String(el.getAttribute('data-node-id') || '').trim())
      const key = nodeId ? `media:${nodeId}` : ''
      const keep = key ? mediaBestByKey.get(key) : null
      const keepEl = keep?.el || null
      if (!keepEl || keepEl !== el) {
        el.remove()
        continue
      }
      if ((keep?.score ?? 0) <= -100) el.remove()
    }
    const mdBestByKey = new Map<string, { el: Element; score: number }>()
    const mdEls = root.querySelectorAll('article[data-md-id]')
    for (let i = 0; i < mdEls.length; i += 1) {
      const el = mdEls[i] as Element
      const idRaw = readMarkdownOverlayIdFromElement(el)
      const anchorRaw = readMarkdownOverlayAnchorNodeIdFromElement(el)
      const idNorm = args.resolveOverlayNodeId(idRaw)
      const anchorNorm = args.resolveOverlayNodeId(anchorRaw)
      const key = buildMarkdownOverlayKey({ idRaw, idNorm, anchorRaw, anchorNorm })
      const keep = args.shouldKeepOverlayLinkedToGraph({ nodeId: idNorm || idRaw, anchorNodeId: anchorNorm || anchorRaw })
      if (!keep || !key) {
        el.remove()
        continue
      }
      const score = readStyleScore(String(el.getAttribute('style') || '').trim())
      const prev = mdBestByKey.get(key)
      if (!prev || score > prev.score) {
        mdBestByKey.set(key, { el, score })
      }
      canonicalizeMarkdownOverlayElement(el, { id: idNorm || idRaw, anchorNodeId: anchorNorm || anchorRaw })
    }
    for (let i = 0; i < mdEls.length; i += 1) {
      const el = mdEls[i] as Element
      if (!el || !el.isConnected) continue
      const idRaw = readMarkdownOverlayIdFromElement(el)
      const anchorRaw = readMarkdownOverlayAnchorNodeIdFromElement(el)
      const idNorm = args.resolveOverlayNodeId(idRaw)
      const anchorNorm = args.resolveOverlayNodeId(anchorRaw)
      const key = buildMarkdownOverlayKey({ idRaw, idNorm, anchorRaw, anchorNorm })
      const keep = key ? mdBestByKey.get(key) : null
      const keepEl = keep?.el || null
      if (!keepEl || keepEl !== el) {
        el.remove()
        continue
      }
      if ((keep?.score ?? 0) <= -100) el.remove()
    }
    return root.innerHTML
  } catch {
    return filterByRegex(raw)
  }
}

export async function buildGraphHtmlViewerMarkup(args: {
  title?: string
  svgMarkup?: string | null
  graphData?: GraphData | null
  includeRichMediaOverlays?: boolean
  mediaOverlayPoolMax?: number
  mediaPanelDensity?: 'default' | 'compact'
  viewportWidthPx?: number
  viewportHeightPx?: number
  viewportScaleToFit?: boolean
  enableDecorativeAnimation?: boolean
  overlaySizing?: OverlayDensitySizingConfigInput | null
  zoomMinK?: number
  zoomMaxK?: number
  wheelBehavior?: 'pan' | 'zoom' | 'preset'
  viewportControlsPreset?: 'map' | 'design'
  panSpeed?: number
  zoomSpeed?: number
  flowWheelZoomSpeedMultiplier?: number
  flowWheelZoomIncrementMultiplier?: number
  flowWheelZoomSmoothMinDurationMs?: number
  flowWheelZoomSmoothMaxDurationMs?: number
  wheelZoomCtrlMetaBoostMultiplier?: number
  canvasInteractionSpeedMultiplier?: number
  canvasPanSpeedMultiplier?: number
  snapGridEnabled?: boolean
  snapGridSize?: number
  dragConstraint?: 'free' | 'axis-x' | 'axis-y' | 'none'
  allowNodeDrag?: boolean
  allowEdgeDrag?: boolean
  allowGroupDrag?: boolean
  initialFrontmatterEnabled?: boolean
  preferWebgl3d?: boolean
  initialView?: { k: number; x: number; y: number }
  zoomLabelScaleMode2d?: 'clampAt1' | 'smooth' | 'power'
  zoomLabelScaleExponent2d?: number
  zoomLabelScaleClampMin2d?: number
  zoomLabelScaleClampMax2d?: number
  zoomStrokeScaleMode2d?: 'zoomScaled' | 'screenConstant' | 'power'
  zoomStrokeScaleExponent2d?: number
  zoomStrokeScaleClampMin2d?: number
  zoomStrokeScaleClampMax2d?: number
  hideLabelsBelowScale?: number
  overlayHtml?: string
  inlineRemoteMediaAssets?: boolean
  allowRuntimeNetwork?: boolean
  proxyOrigin?: string | null
}): Promise<string | null> {
  try {
    ensureKgTokensInstalled()
  } catch {
    void 0
  }

  const title = String(args.title || '').trim() || 'Graph viewer'
  const svgMarkupRaw = String(args.svgMarkup || '').trim()

  const initialView =
    args.initialView && isFiniteNum(args.initialView.k) && isFiniteNum(args.initialView.x) && isFiniteNum(args.initialView.y)
      ? args.initialView
      : null
  const fixedViewport =
    isFiniteNum(args.viewportWidthPx) && isFiniteNum(args.viewportHeightPx)
      ? { w: Math.max(1, Math.floor(args.viewportWidthPx)), h: Math.max(1, Math.floor(args.viewportHeightPx)) }
      : null

  const overlayHtml = String(args.overlayHtml || '')
  const graphNodeIdentity = buildGraphNodeIdentity({ graph: args.graphData, svgMarkup: svgMarkupRaw })

  const resolveOverlayNodeId = (() => {
    return (raw: string): string => {
      return graphNodeIdentity.resolveNodeId(raw)
    }
  })()
  const shouldKeepOverlayLinkedToGraph = (args0: { nodeId?: string; anchorNodeId?: string }): boolean => {
    if (graphNodeIdentity.nodeIdSet.size === 0) return true
    const nodeId = resolveOverlayNodeId(String(args0.nodeId || '').trim())
    const anchorNodeId = resolveOverlayNodeId(String(args0.anchorNodeId || '').trim())
    const linkedToGraph =
      (nodeId && graphNodeIdentity.nodeIdSet.has(nodeId)) ||
      (anchorNodeId && graphNodeIdentity.nodeIdSet.has(anchorNodeId))
    if (!linkedToGraph) return false
    if (graphNodeIdentity.edgeLinkedNodeIdSet.size <= 0) return true
    return (
      (nodeId && graphNodeIdentity.edgeLinkedNodeIdSet.has(nodeId)) ||
      (anchorNodeId && graphNodeIdentity.edgeLinkedNodeIdSet.has(anchorNodeId))
    )
  }

  const overlayHtmlFilteredRaw = filterStandaloneOverlayHtml({
    overlayHtml,
    hasGraphNodeIdentity: graphNodeIdentity.nodeIdSet.size > 0,
    resolveOverlayNodeId,
    shouldKeepOverlayLinkedToGraph,
  })
  const overlayHtmlFiltered = normalizeSemanticHtmlContainers(overlayHtmlFilteredRaw)

  const overlaySeedsRaw = (() => {
    const mediaNodes: HtmlViewerMediaNode[] = []
    const markdownBlocks: HtmlViewerMarkdownSeed[] = []
    if (!overlayHtmlFiltered.trim()) return { mediaNodes, markdownBlocks }
    const parseByRegex = () => {
      const readAttr = (tag: string, name: string): string => {
        const s = String(tag || '')
        const key1 = `${name}="`
        const key2 = `${name}='`
        const i1 = s.indexOf(key1)
        if (i1 >= 0) {
          const start = i1 + key1.length
          const end = s.indexOf('"', start)
          return end > start ? s.slice(start, end).trim() : ''
        }
        const i2 = s.indexOf(key2)
        if (i2 >= 0) {
          const start = i2 + key2.length
          const end = s.indexOf("'", start)
          return end > start ? s.slice(start, end).trim() : ''
        }
        return ''
      }
      const mediaTagRe = /<article\b[^>]*data-kg-rich-media-panel=(?:"1"|'1')[^>]*>/gi
      let mm: RegExpExecArray | null = null
      while ((mm = mediaTagRe.exec(overlayHtmlFiltered))) {
        const tag = mm[0] || ''
        const id = resolveOverlayNodeId(readAttr(tag, 'data-node-id'))
        if (!id) continue
        const url = readAttr(tag, 'data-kg-url') || readAttr(tag, 'data-kg-open-url')
        if (!url) continue
        const kindRaw = readAttr(tag, 'data-kg-kind').toLowerCase()
        const kind = kindRaw === 'image' || kindRaw === 'svg' || kindRaw === 'video' || kindRaw === 'audio' || kindRaw === 'iframe'
          ? (kindRaw as HtmlViewerMediaNode['kind'])
          : inferMediaKind(url)
        mediaNodes.push({
          id,
          title: id,
          url,
          openUrl: readAttr(tag, 'data-kg-open-url') || url,
          interactive: true,
          kind,
        })
      }

      const mdTagRe = /<article\b[^>]*data-md-id[^>]*>/gi
      let mdm: RegExpExecArray | null = null
      while ((mdm = mdTagRe.exec(overlayHtmlFiltered))) {
        const tag = mdm[0] || ''
        const id = readAttr(tag, 'data-md-id')
        if (!id) continue
        const x = Number(readAttr(tag, 'data-kg-world-x'))
        const y = Number(readAttr(tag, 'data-kg-world-y'))
        const w = Number(readAttr(tag, 'data-kg-world-w'))
        const h = Number(readAttr(tag, 'data-kg-world-h'))
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h) || !(w > 0) || !(h > 0)) continue
        const anchorNodeId = resolveOverlayNodeId(readAttr(tag, 'data-kg-anchor-node-id'))
        markdownBlocks.push({
          id,
          anchorNodeId: anchorNodeId || undefined,
          title: id,
          summary: '',
          preview: { kind: 'other' },
          x,
          y,
          w,
          h,
        })
      }
    }
    try {
      if (typeof DOMParser === 'undefined') {
        parseByRegex()
        return { mediaNodes, markdownBlocks }
      }
      const doc = new DOMParser().parseFromString(
        `<!doctype html><html><body><section id="kg-overlay-seed">${overlayHtmlFiltered}</section></body></html>`,
        'text/html',
      )
      const root = doc.querySelector('#kg-overlay-seed')
      if (!root) {
        parseByRegex()
        return { mediaNodes, markdownBlocks }
      }

      const mediaEls = root.querySelectorAll('[data-kg-rich-media-panel="1"][data-kg-rich-media-render-surface="1"][data-node-id]')
      for (let i = 0; i < mediaEls.length; i += 1) {
        const el = mediaEls[i] as Element
        const idRaw = String(el.getAttribute('data-node-id') || '').trim()
        const id = resolveOverlayNodeId(idRaw)
        if (!id) continue
        const urlAttr = String(el.getAttribute('data-kg-url') || '').trim()
        const openUrlAttr = String(el.getAttribute('data-kg-open-url') || '').trim()
        const mediaEl = el.querySelector('iframe[src],img[src],video[src],audio[src],source[src]') as Element | null
        const srcUrl = mediaEl ? String(mediaEl.getAttribute('src') || '').trim() : ''
        const url = urlAttr || srcUrl || openUrlAttr
        if (!url) continue
        const kindAttr = String(el.getAttribute('data-kg-kind') || '').trim().toLowerCase()
        const kind = kindAttr === 'image' || kindAttr === 'svg' || kindAttr === 'video' || kindAttr === 'audio' || kindAttr === 'iframe'
          ? (kindAttr as HtmlViewerMediaNode['kind'])
          : inferMediaKind(url)
        const title = readRichMediaPanelTitle(el) || id
        mediaNodes.push({
          id,
          title,
          url,
          openUrl: openUrlAttr || url,
          interactive: true,
          kind,
        })
      }

      const mdEls = root.querySelectorAll('[data-md-id]')
      for (let i = 0; i < mdEls.length; i += 1) {
        const el = mdEls[i] as Element
        const id = String(el.getAttribute('data-md-id') || '').trim()
        if (!id) continue
        const x = readNumAttr(el, 'data-kg-world-x')
        const y = readNumAttr(el, 'data-kg-world-y')
        const w = readNumAttr(el, 'data-kg-world-w')
        const h = readNumAttr(el, 'data-kg-world-h')
        if (!isFiniteNum(x) || !isFiniteNum(y) || !isFiniteNum(w) || !isFiniteNum(h) || !(w > 0) || !(h > 0)) continue
        const anchorRaw = String(el.getAttribute('data-kg-anchor-node-id') || '').trim()
        const anchorNodeId = resolveOverlayNodeId(anchorRaw)
        const title =
          String((el.querySelector('.kg-mdTitle') as HTMLElement | null)?.textContent || '').trim() ||
          readRichMediaPanelTitle(el) ||
          id
        markdownBlocks.push({
          id,
          anchorNodeId: anchorNodeId || undefined,
          title,
          summary: '',
          preview: { kind: 'other' },
          x,
          y,
          w,
          h,
        })
      }
      if (mediaNodes.length === 0 && markdownBlocks.length === 0) parseByRegex()
    } catch {
      parseByRegex()
    }
    return { mediaNodes, markdownBlocks }
  })()
  const overlaySeeds = {
    mediaNodes: overlaySeedsRaw.mediaNodes.filter(n => shouldKeepOverlayLinkedToGraph({ nodeId: n.id })),
    markdownBlocks: overlaySeedsRaw.markdownBlocks.filter(b =>
      shouldKeepOverlayLinkedToGraph({ nodeId: b.id, anchorNodeId: b.anchorNodeId }),
    ),
  }

  const preferredOverlayNodeIds = (() => {
    if (!initialView) return []
    const graph = args.graphData
    const nodes = Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
    if (nodes.length === 0) return []

    const nodePosById: Record<string, { x: number; y: number }> = {}
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const id = String(n?.id || '').trim()
      if (!id) continue
      const x = (n as unknown as { x?: unknown }).x
      const y = (n as unknown as { y?: unknown }).y
      if (!isFiniteNum(x) || !isFiniteNum(y)) continue
      nodePosById[id] = { x, y }
    }
    const fromSvg = extractNodePosByIdFromSvgMarkup(svgMarkupRaw)
    for (const id of Object.keys(fromSvg)) nodePosById[id] = fromSvg[id]!

    const vpW = fixedViewport ? fixedViewport.w : 1920
    const vpH = fixedViewport ? fixedViewport.h : 1080
    const pad = 800
    const k = Math.max(0.00001, Number(initialView.k))
    const tx = Number(initialView.x)
    const ty = Number(initialView.y)

    const out: string[] = []
    for (const id of Object.keys(nodePosById)) {
      if (!shouldKeepOverlayLinkedToGraph({ nodeId: id })) continue
      const p = nodePosById[id]
      if (!p) continue
      const sx = p.x * k + tx
      const sy = p.y * k + ty
      if (sx < -pad || sx > vpW + pad) continue
      if (sy < -pad || sy > vpH + pad) continue
      out.push(id)
      if (out.length >= 800) break
    }
    return out
  })()

  const hasSvg = !!svgMarkupRaw
  if (!hasSvg) return null

  const canvasBg = resolveCssVarWithKgFallback('--kg-canvas-bg') || '#ffffff'
  const panelBg = resolveCssVarWithKgFallback('--kg-panel-bg') || 'rgba(255,255,255,0.92)'
  const border = resolveCssVarWithKgFallback('--kg-border') || 'rgba(0,0,0,0.12)'
  const text = resolveCssVarWithKgFallback('--kg-text-primary') || 'rgba(0,0,0,0.86)'
  const textSecondary = resolveCssVarWithKgFallback('--kg-text-secondary') || 'rgba(0,0,0,0.7)'
  const textTertiary = resolveCssVarWithKgFallback('--kg-text-tertiary') || 'rgba(0,0,0,0.55)'
  const panelActionBg = resolveCssVarWithKgFallback('--kg-panel-action-bg') || 'rgba(0,0,0,0.04)'
  const panelActionBgHover = resolveCssVarWithKgFallback('--kg-panel-action-bg-hover') || 'rgba(0,0,0,0.06)'

  const canvasEdgeStroke = resolveCssVarWithKgFallback('--kg-canvas-edge-stroke') || '#9ca3af'
  const canvasNodeStroke = resolveCssVarWithKgFallback('--kg-canvas-node-stroke') || '#ffffff'
  const canvasAccent = resolveCssVarWithKgFallback('--kg-canvas-accent') || '#3b82f6'
  const canvasLabelFill = resolveCssVarWithKgFallback('--kg-canvas-label-fill') || text
  const canvasLabelHalo = resolveCssVarWithKgFallback('--kg-canvas-label-halo') || canvasBg
  const markdownHeaderBg = resolveCssVarWithKgFallback('--kg-media-panel-header-bg') || 'rgba(0,0,0,0.04)'

  const density = args.mediaPanelDensity === 'compact' ? 'compact' : 'default'

  const markdownPanelHeaderH = density === 'compact' ? 22 : 28
  const mediaPanelRadius = density === 'compact' ? 9 : 10
  const mediaPanelPadding = density === 'compact' ? 6 : 8
  const mediaPanelTitleSize = density === 'compact' ? 11 : 12
  const overlaySizingDefault = readOverlaySizingConfigForDensity({ density: 'default', sizing: args.overlaySizing || null })
  const overlaySizingCompact = readOverlaySizingConfigForDensity({ density: 'compact', sizing: args.overlaySizing || null })
  const widthRatioDefault = overlaySizingDefault.widthRatio
  const widthRatioCompact = overlaySizingCompact.widthRatio
  const widthMinDefault = overlaySizingDefault.widthMinPx
  const widthMinCompact = overlaySizingCompact.widthMinPx
  const widthMaxDefault = overlaySizingDefault.widthMaxPx
  const widthMaxCompact = overlaySizingCompact.widthMaxPx

  const mediaNodesBase = (() => {
    if (args.includeRichMediaOverlays !== true) return []
    const graph = args.graphData
    const nodes = Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
    const poolMaxRaw = isFiniteNum(args.mediaOverlayPoolMax) ? Math.max(0, Math.floor(args.mediaOverlayPoolMax)) : 0
    const poolMax = poolMaxRaw > 0 ? poolMaxRaw : Math.min(2000, Math.max(24, nodes.length))
    return listMediaOverlayNodes({ enabled: true, nodes, poolMax, preferredNodeIds: preferredOverlayNodeIds })
  })()

  const inlineStandaloneMedia = async (nodes: HtmlViewerMediaNode[]): Promise<HtmlViewerMediaNode[]> => {
    if (!nodes || nodes.length === 0) return []
    const MAX_BYTES = 2_400_000
    const out: HtmlViewerMediaNode[] = []
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const url0 = String(n.url || '').trim()
      const url = unwrapStandaloneProxyUrl(url0)
      const openUrl = unwrapStandaloneProxyUrl(String(n.openUrl || url || '').trim())
      const relPath = decodeRepoFileUrlToRelPath(url)
      const canInlineRemote = args.inlineRemoteMediaAssets === true && (n.kind === 'image' || n.kind === 'svg' || n.kind === 'video' || n.kind === 'audio')

      const inlined = canInlineRemote
        ? await inlineStandaloneAssetUrlToDataUrl(url0 || url, { maxBytes: MAX_BYTES, allowRemote: true })
        : (relPath ? await inlineRepoFileUrlToDataUrl(url, { maxBytes: MAX_BYTES }) : null)
      if (!inlined) {
        out.push({ ...n, url, openUrl })
        continue
      }
      out.push({ ...n, url: inlined, openUrl })
    }
    return out
  }

  const mediaNodesMerged = (() => {
    const out: HtmlViewerMediaNode[] = []
    const seen = new Set<string>()
    const push = (n: HtmlViewerMediaNode) => {
      const id = resolveOverlayNodeId(String(n.id || '').trim())
      if (!shouldKeepOverlayLinkedToGraph({ nodeId: id })) return
      if (!id || seen.has(id)) return
      seen.add(id)
      out.push({ ...n, id })
    }
    for (let i = 0; i < mediaNodesBase.length; i += 1) push(mediaNodesBase[i] as unknown as HtmlViewerMediaNode)
    for (let i = 0; i < overlaySeeds.mediaNodes.length; i += 1) push(overlaySeeds.mediaNodes[i]!)
    return out
  })()
  const mediaNodes = await inlineStandaloneMedia(mediaNodesMerged)

  const mediaNodesJson = JSON.stringify(mediaNodes)

  const nodeLabelByIdJson = (() => {
    const out: Record<string, { label: string }> = {}
    const graph = args.graphData
    const nodes = Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const id = String(n?.id || '').trim()
      if (!id) continue
      const label = String((n as unknown as { label?: unknown }).label || '').trim()
      out[id] = { label: label || id }
    }
    return JSON.stringify(out)
  })()

  const nodeIdNormalizer = (() => {
    return (raw: string): string => {
      return graphNodeIdentity.resolveNodeId(raw)
    }
  })()

  const edgeMetaByIdJson = (() => {
    const out: Record<string, { label: string; s: string; t: string }> = {}
    const graph = args.graphData
    const edges = Array.isArray(graph?.edges) ? (graph!.edges as GraphEdge[]) : []
    for (let i = 0; i < edges.length; i += 1) {
      const e = edges[i]
      const id = String(e?.id || '').trim()
      if (!id) continue
      const label = String((e as unknown as { label?: unknown }).label || '').trim()
      const s0 = String((e as unknown as { source?: unknown }).source || '').trim()
      const t0 = String((e as unknown as { target?: unknown }).target || '').trim()
      const s = nodeIdNormalizer(s0)
      const t = nodeIdNormalizer(t0)
      out[id] = { label: label || '', s, t }
    }
    return JSON.stringify(out)
  })()

  const frontmatterVisibilityJson = (() => {
    const graph = args.graphData
    if (!graph) return JSON.stringify({ nodeIds: [], edgeIds: [] })
    const fm = filterGraphToFrontmatterMermaid(graph)
    const nodes = Array.isArray(fm.nodes) ? (fm.nodes as GraphNode[]) : []
    const edges = Array.isArray(fm.edges) ? (fm.edges as GraphEdge[]) : []
    const nodeIds = nodes.map(n => String(n?.id || '').trim()).filter(Boolean)
    const edgeIds = edges.map(e => String(e?.id || '').trim()).filter(Boolean)
    return JSON.stringify({ nodeIds, edgeIds })
  })()

  const groupMembersByIdJson = (() => {
    const graph = args.graphData
    if (!graph) return JSON.stringify({})
    const nodes = Array.isArray((graph as unknown as { nodes?: unknown }).nodes)
      ? ((graph as unknown as { nodes: GraphNode[] }).nodes as GraphNode[])
      : []
    const nodeIdSet = new Set<string>()
    const nodeIdBySuffix: Record<string, string> = {}
    for (let i = 0; i < nodes.length; i += 1) {
      const rawId = String(nodes[i]?.id || '').trim()
      if (!rawId) continue
      nodeIdSet.add(rawId)
      const suffix = rawId.split('::').pop() || ''
      if (suffix && !nodeIdBySuffix[suffix]) nodeIdBySuffix[suffix] = rawId
    }
    const normalizeMemberId = (raw: string): string => {
      const id = String(raw || '').trim()
      if (!id) return ''
      if (nodeIdSet.has(id)) return id
      const suffix = id.split('::').pop() || ''
      if (!suffix) return ''
      const full = nodeIdBySuffix[suffix]
      return full || id
    }
    const meta = (graph.metadata || {}) as Record<string, unknown>
    const isKeywordGraph = meta.kind === 'keyword'
    const forceDocumentStructure = readDocumentViewModeContext({
      frontmatterModeEnabled: false,
      multiDimTableModeEnabled: false,
      documentSemanticMode: isKeywordGraph ? 'keyword' : 'document',
      documentStructureBaselineLock: false,
    }).forceDocumentStructureGroups
    const view = meta['kg:view'] && typeof meta['kg:view'] === 'object' && !Array.isArray(meta['kg:view']) ? (meta['kg:view'] as Record<string, unknown>) : null
    const collapsedIds = view && Array.isArray(view.collapsedGroupIds) ? (view.collapsedGroupIds as unknown[]) : []
    const collapsedSet = new Set<string>(collapsedIds.map(x => String(x || '').trim()).filter(Boolean))
    const groups = filterGroupsByCollapsedAncestors({
      groups: deriveGraphGroups(graph, { forceDocumentStructure }),
      collapsedGroupIdSet: collapsedSet,
    })
    const out: Record<string, string[]> = {}
    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i]
      const id = String((g as unknown as { id?: unknown }).id || '').trim()
      if (!id) continue
      const membersRaw = (g as unknown as { memberNodeIds?: unknown }).memberNodeIds
      const members = Array.isArray(membersRaw) ? membersRaw.map(v => String(v)).filter(Boolean) : []
      if (members.length === 0) continue
      const normalized = members.map(normalizeMemberId).filter(m => m && nodeIdSet.has(m))
      if (normalized.length === 0) continue
      out[id] = normalized
    }
    return JSON.stringify(out)
  })()

  const nodePosByIdObj = (() => {
    const graph = args.graphData
    const nodes = Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
    const out: Record<string, { x: number; y: number }> = {}
    const explicitNodePosIdSet = new Set<string>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const id = String(n?.id || '').trim()
      if (!id) continue
      const x = (n as unknown as { x?: unknown }).x
      const y = (n as unknown as { y?: unknown }).y
      if (!isFiniteNum(x) || !isFiniteNum(y)) continue
      explicitNodePosIdSet.add(id)
      out[id] = { x, y }
    }
    const fromSvg = extractNodePosByIdFromSvgMarkup(svgMarkupRaw)
    for (const id of Object.keys(fromSvg)) out[id] = fromSvg[id]!
    for (let i = 0; i < overlaySeeds.markdownBlocks.length; i += 1) {
      const b = overlaySeeds.markdownBlocks[i]!
      const x = Number(b.x)
      const y = Number(b.y)
      const w = Number(b.w)
      const h = Number(b.h)
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h) || !(w > 0) || !(h > 0)) continue
      const cx = x + w * 0.5
      const cy = y + h * 0.5
      const bid = String(b.id || '').trim()
      if (bid && !explicitNodePosIdSet.has(bid)) out[bid] = { x: cx, y: cy }
      const anchor = resolveOverlayNodeId(String(b.anchorNodeId || '').trim())
      if (anchor && !explicitNodePosIdSet.has(anchor)) out[anchor] = { x: cx, y: cy }
    }
    return out
  })()
  const nodePosByIdJson = JSON.stringify(nodePosByIdObj)

  const markdownBlocksJson = (() => {
    try {
      const graph = args.graphData
      if (!graph && overlaySeeds.markdownBlocks.length === 0) return '[]'
      const layout = deriveMarkdownDesignLayoutFromGraphBlocks({ graphData: graph, nodePosById: nodePosByIdObj })
      const blocks = layout && Array.isArray(layout.blocks) ? layout.blocks : []
      const nodes = Array.isArray((graph as any)?.nodes) ? ((graph as any).nodes as any[]) : []
      const anchorNodeIdByBlockId = computeMarkdownAnchorNodeIdByBlockId({ layout, nodes })
      const blocksWithAnchor = blocks.map(b => {
        const id = String((b as any)?.id || '').trim()
        const anchorNodeId = id ? resolveOverlayNodeId(String((anchorNodeIdByBlockId as any)?.[id] || '').trim()) : ''
        return anchorNodeId ? ({ ...(b as any), anchorNodeId } as any) : b
      })
      const out = [...blocksWithAnchor]
      const byId = new Map<string, any>()
      for (let i = 0; i < out.length; i += 1) {
        const id = String((out[i] as any)?.id || '').trim()
        if (id) byId.set(id, out[i] as any)
      }
      for (let i = 0; i < overlaySeeds.markdownBlocks.length; i += 1) {
        const seed = overlaySeeds.markdownBlocks[i]!
        const existing = byId.get(seed.id)
        if (!existing) {
          out.push(seed as any)
          byId.set(seed.id, seed as any)
          continue
        }
        const anchor = resolveOverlayNodeId(String((existing.anchorNodeId || seed.anchorNodeId || '') as string))
        if (anchor) existing.anchorNodeId = anchor
        const exW = Number(existing.w)
        const exH = Number(existing.h)
        if (!(Number.isFinite(exW) && exW > 0 && Number.isFinite(exH) && exH > 0)) {
          existing.x = seed.x
          existing.y = seed.y
          existing.w = seed.w
          existing.h = seed.h
        }
      }
      const filtered = out.filter(b =>
        shouldKeepOverlayLinkedToGraph({
          nodeId: String((b as any)?.id || ''),
          anchorNodeId: String((b as any)?.anchorNodeId || ''),
        }),
      )
      const deduped: any[] = []
      const seen = new Set<string>()
      for (let i = 0; i < filtered.length; i += 1) {
        const b = filtered[i] as any
        const anchor = resolveOverlayNodeId(String((b?.anchorNodeId || b?.anchorId || '') as string))
        const id = String((b?.id || '') as string).trim()
        const key = (anchor ? `md:${anchor}` : id ? `md:${id}` : '').trim()
        if (!key) continue
        if (seen.has(key)) continue
        seen.add(key)
        deduped.push(b)
      }
      return JSON.stringify(deduped)
    } catch {
      return '[]'
    }
  })()

  const svgMarkupWithEdgeGeometry = ensureSvgHasEdgeGeometry({
    svgMarkup: svgMarkupRaw,
    graphData: args.graphData || ({ nodes: [], edges: [] } as any),
    nodePosById: nodePosByIdObj,
  })

  const interactionCfgJson = JSON.stringify({
    scaleExtent: safeScaleExtent({ minK: args.zoomMinK, maxK: args.zoomMaxK }),
    wheelBehavior: args.wheelBehavior,
    viewportControlsPreset: args.viewportControlsPreset,
    panSpeed: args.panSpeed,
    zoomSpeed: args.zoomSpeed,
    flowWheelZoomSpeedMultiplier: args.flowWheelZoomSpeedMultiplier,
    flowWheelZoomIncrementMultiplier: args.flowWheelZoomIncrementMultiplier,
    flowWheelZoomSmoothMinDurationMs: args.flowWheelZoomSmoothMinDurationMs,
    flowWheelZoomSmoothMaxDurationMs: args.flowWheelZoomSmoothMaxDurationMs,
    wheelZoomCtrlMetaBoostMultiplier: args.wheelZoomCtrlMetaBoostMultiplier,
    canvasInteractionSpeedMultiplier: args.canvasInteractionSpeedMultiplier,
    canvasPanSpeedMultiplier: args.canvasPanSpeedMultiplier,
    snapGridEnabled: args.snapGridEnabled,
    snapGridSize: args.snapGridSize,
    dragConstraint: args.dragConstraint,
    allowNodeDrag: args.allowNodeDrag !== false,
    allowEdgeDrag: args.allowEdgeDrag !== false,
    allowGroupDrag: args.allowGroupDrag !== false,
    preferWebgl3d: args.preferWebgl3d === true,
    initialView: initialView || null,
    fixedViewport: fixedViewport ? { widthPx: fixedViewport.w, heightPx: fixedViewport.h, scaleToFit: args.viewportScaleToFit === true } : null,
    enableDecorativeAnimation: args.enableDecorativeAnimation === true,
    zoomLabelScaleMode2d: args.zoomLabelScaleMode2d,
    zoomLabelScaleExponent2d: args.zoomLabelScaleExponent2d,
    zoomLabelScaleClampMin2d: args.zoomLabelScaleClampMin2d,
    zoomLabelScaleClampMax2d: args.zoomLabelScaleClampMax2d,
    zoomStrokeScaleMode2d: args.zoomStrokeScaleMode2d,
    zoomStrokeScaleExponent2d: args.zoomStrokeScaleExponent2d,
    zoomStrokeScaleClampMin2d: args.zoomStrokeScaleClampMin2d,
    zoomStrokeScaleClampMax2d: args.zoomStrokeScaleClampMax2d,
    hideLabelsBelowScale: args.hideLabelsBelowScale,
  })

  const proxyOrigin = (() => {
    try {
      const origin = String(args.proxyOrigin || '').trim()
      if (!origin) return ''
      const host = new URL(origin).hostname.toLowerCase()
      if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return origin
      return ''
    } catch {
      return ''
    }
  })()

  const svgPlaceholder = svgMarkupWithEdgeGeometry
  const runtimeScript = buildHtmlViewerRuntimeScript({
    interactionCfgJson,
    mediaNodesJson,
    markdownBlocksJson,
    nodeLabelByIdJson,
    edgeMetaByIdJson,
    frontmatterVisibilityJson,
    initialFrontmatterEnabled: args.initialFrontmatterEnabled === true,
    nodePosByIdJson,
    groupMembersByIdJson,
    density,
    widthRatioDefault,
    widthRatioCompact,
    widthMinDefault,
    widthMinCompact,
    widthMaxDefault,
    widthMaxCompact,
    proxyOrigin,
    allowRuntimeNetwork: args.allowRuntimeNetwork === true,
  })

  const fontFamily = tryReadCssVar('--kg-font-family', 'ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial')

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root{
      --kg-canvas-bg:${escapeHtml(canvasBg)};
      --kg-panel-bg:${escapeHtml(panelBg)};
      --kg-media-panel-bg:${escapeHtml(panelBg)};
      --kg-border:${escapeHtml(border)};
      --kg-text:${escapeHtml(text)};
      --kg-text-primary:${escapeHtml(text)};
      --kg-text-secondary:${escapeHtml(textSecondary)};
      --kg-text-tertiary:${escapeHtml(textTertiary)};
      --kg-panel-action-bg:${escapeHtml(panelActionBg)};
      --kg-panel-action-bg-hover:${escapeHtml(panelActionBgHover)};
      --kg-canvas-edge-stroke:${escapeHtml(canvasEdgeStroke)};
      --kg-canvas-node-stroke:${escapeHtml(canvasNodeStroke)};
      --kg-canvas-accent:${escapeHtml(canvasAccent)};
      --kg-canvas-label-fill:${escapeHtml(canvasLabelFill)};
      --kg-canvas-label-halo:${escapeHtml(canvasLabelHalo)};
      --kg-md-panel-header-bg:${escapeHtml(markdownHeaderBg)};
      --kg-md-panel-header-h:${markdownPanelHeaderH}px;
      --kg-media-panel-border-w:1px;
      --kg-media-panel-radius:${mediaPanelRadius}px;
      --kg-media-panel-padding:${mediaPanelPadding}px;
      --kg-media-panel-title-size:${mediaPanelTitleSize}px;
      --kg-media-pointer-events:auto;
    }
    html,body{height:100%;width:100%;margin:0;background:var(--kg-canvas-bg);color:var(--kg-text);font-family:${escapeHtml(fontFamily)};-webkit-user-select:none;user-select:none;-webkit-text-size-adjust:100%;text-size-adjust:100%;overscroll-behavior:none}
    #kg-root{position:fixed;inset:0;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;cursor:grab;overscroll-behavior:none}
    #kg-root.kg-dragging{cursor:grabbing}
    #kg-root.kg-fixedViewport{inset:auto;left:50%;top:50%;width:var(--kg-fixed-w,1920px);height:var(--kg-fixed-h,1080px);transform:translate(-50%,-50%) scale(var(--kg-fixed-scale,1));transform-origin:center}
    #kg-root *{-webkit-user-select:none;user-select:none}
    #kg-stage{position:absolute;inset:0}
    #kg-webgl{position:absolute;inset:0;width:100%;height:100%;display:none;touch-action:none;outline:none}
    #kg-root.kg-canvas3d #kg-webgl{display:block}
    #kg-root.kg-canvas3d #kg-svgWrap{display:none}
    #kg-svgWrap{position:absolute;inset:0}
    #kg-svgWrap svg{display:block;width:100%;height:100%;overflow:visible;shape-rendering:geometricPrecision;text-rendering:geometricPrecision}
    #kg-svgWrap text{user-select:none;-webkit-user-select:none}
    #kg-svgWrap [data-kg-layer="markdown-design-blocks"]{display:block}
    #kg-overlay{position:fixed;inset:0;pointer-events:none}
    .kg-media{position:absolute;left:0;top:0;box-sizing:border-box;overflow:hidden;contain:layout paint;isolation:isolate;border-radius:var(--kg-media-panel-radius, 10px);border:var(--kg-media-panel-border-w, 1px) solid var(--kg-border);background:var(--kg-media-panel-bg, var(--kg-panel-bg, rgba(255,255,255,0.92)));box-shadow:0 10px 30px rgba(0,0,0,0.18);backface-visibility:hidden;-webkit-backface-visibility:hidden;will-change:left, top, transform, width, height;display:flex;flex-direction:column;pointer-events:auto}
    .kg-mediaBody{flex:1;padding:var(--kg-media-panel-padding, 6px);box-sizing:border-box;min-height:0;position:relative}
    .kg-mediaBody iframe,.kg-mediaBody img,.kg-mediaBody video,.kg-mediaBody audio{display:block;width:100%;height:100%;border:0;border-radius:calc(var(--kg-media-panel-radius) * 0.8);background:rgba(0,0,0,0.02);pointer-events:var(--kg-media-pointer-events);box-sizing:border-box}
    [data-kg-rich-media-floating-toolbar="1"]{position:absolute;top:50%;left:100%;margin-left:12px;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px;pointer-events:auto;z-index:10}
    [data-kg-rich-media-open-source="1"]{border:1px solid var(--kg-border);background:var(--kg-panel-bg);color:var(--kg-text);border-radius:10px;padding:8px 10px;font-size:12px;cursor:pointer;min-width:32px;min-height:32px;line-height:1.2;box-shadow:0 10px 30px rgba(0,0,0,0.12)}
    [data-kg-rich-media-open-source="1"]:hover{background:rgba(0,0,0,0.04)}
    .kg-mediaSnap{position:absolute;inset:var(--kg-media-panel-padding, 6px);border-radius:calc(var(--kg-media-panel-radius) * 0.8);overflow:hidden;background:linear-gradient(135deg, rgba(15,23,42,0.06), rgba(148,163,184,0.10));border:1px solid rgba(0,0,0,0.06);display:flex;align-items:stretch;justify-content:stretch;pointer-events:none}
    .kg-mediaSnapImg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(1.05) contrast(1.02);opacity:0;transition:opacity 220ms ease}
    .kg-mediaSnapMeta{position:absolute;left:0;right:0;bottom:0;padding:10px 10px 9px;background:linear-gradient(180deg, rgba(15,23,42,0), rgba(15,23,42,0.66));color:#fff;display:flex;flex-direction:column;gap:2px}
    .kg-mediaSnapTitle{font-size:12px;line-height:1.25;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .kg-mediaSnapHost{font-size:11px;line-height:1.25;opacity:0.84;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .kg-md{position:absolute;left:0;top:0;display:flex;flex-direction:column;pointer-events:none;background:var(--kg-panel-bg);border:var(--kg-media-panel-border-w) solid var(--kg-border);border-radius:var(--kg-media-panel-radius);box-shadow:0 10px 30px rgba(0,0,0,.12);overflow:hidden;box-sizing:border-box}
    .kg-mdHeader{height:var(--kg-md-panel-header-h);display:flex;align-items:center;gap:8px;padding:0 10px;background:var(--kg-md-panel-header-bg, rgba(0,0,0,0.04));border-bottom:var(--kg-media-panel-border-w) solid var(--kg-border)}
    .kg-mdTitle{font-size:var(--kg-media-panel-title-size);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--kg-text-tertiary)}
    .kg-mdBody{position:relative;flex:1;padding:var(--kg-media-panel-padding);box-sizing:border-box}
    .kg-mdTable{width:100%;border-collapse:collapse;font-size:11px;line-height:1.25;color:var(--kg-text)}
    .kg-mdTable th{ text-align:left; border:1px solid var(--kg-border); padding:2px 4px; background:rgba(0,0,0,0.04); font-weight:600 }
    .kg-mdTable td{ border:1px solid var(--kg-border); padding:2px 4px; vertical-align:top }
    .kg-mdCode{margin:0;padding:6px;border-radius:8px;background:rgba(0,0,0,0.06);font-size:11px;line-height:1.35;overflow:hidden;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;white-space:pre;color:var(--kg-text)}
    .kg-mdQuote{border-left:3px solid var(--kg-border);padding-left:8px;color:var(--kg-text);font-size:12px;line-height:1.35;white-space:pre-wrap}
    .kg-mdText{font-size:12px;line-height:1.35;color:var(--kg-text);white-space:pre-wrap}
    .kg-mdCallout{border-left:3px solid var(--kg-canvas-accent);padding-left:8px;color:var(--kg-text);font-size:12px;line-height:1.35}
    .kg-mdCalloutTitle{font-weight:700;margin-bottom:4px}
    #kg-hud{position:absolute;left:max(12px, env(safe-area-inset-left));top:max(12px, env(safe-area-inset-top));display:flex;gap:8px;flex-wrap:wrap;align-items:center;z-index:1000;max-width:calc(100vw - 24px)}
    .kg-btn{border:1px solid var(--kg-border);background:var(--kg-panel-bg);color:var(--kg-text);border-radius:10px;padding:8px 10px;font-size:12px;cursor:pointer;min-width:32px;min-height:32px;line-height:1.2}
    .kg-btn.kg-active{outline:2px solid rgba(59,130,246,0.6);outline-offset:0}
    .kg-tip{display:block;position:absolute;left:0;top:0;transform:translate3d(-99999px,-99999px,0);max-width:min(420px,calc(100vw - 24px));padding:8px 10px;border-radius:12px;background:rgba(17,24,39,.9);color:#fff;font-size:12px;line-height:1.25;pointer-events:none;z-index:9999;backdrop-filter: blur(10px);-webkit-backdrop-filter: blur(10px);border:1px solid rgba(255,255,255,0.08)}
    .kg-tip strong{font-weight:600}
    @media (max-width:520px){.kg-btn{padding:10px 12px;font-size:14px;border-radius:12px;min-width:40px;min-height:40px}}
    @media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
    @keyframes kgNodeBob{0%{transform:translateY(0)}50%{transform:translateY(calc(var(--kg-bob-amp,2px) * -1))}100%{transform:translateY(0)}}
  </style>
</head>
<body>
  <main id="kg-root">
    <section id="kg-stage" aria-label="Graph canvas stage">
      <canvas id="kg-webgl" aria-label="3D canvas" tabindex="-1"></canvas>
      <figure id="kg-svgWrap">${svgPlaceholder}</figure>
    </section>
    <section id="kg-overlay" aria-label="Graph overlay">${overlayHtmlFiltered}</section>
    <nav id="kg-hud" aria-label="Canvas controls" data-kg-canvas-wheel-ignore="true" data-kg-canvas-pointer-ignore="true">
      <button class="kg-btn" id="kg-fit" type="button">Fit</button>
      <button class="kg-btn" id="kg-reset" type="button">Reset</button>
    </nav>
  </main>
  <output id="kg-tooltip" class="kg-tip" aria-hidden="true"></output>
  <script>
${runtimeScript}
  </script>
</body>
</html>`

  return html
}
