import type { RefObject } from 'react'
import type { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types'
import { getNodeRadiusFromSchema, getNodeRenderRadius, getThreeConfig } from '@/lib/graph/schema'
import type { GraphSchema } from '@/lib/graph/schemaTypes'
import { getAdjacencyMap } from '@/components/GraphCanvas/adjacency'
import { coerceMediaUrl, isLikelyImageUrl, isLikelySvgUrl, isLikelyVideoUrl } from '@/lib/url'
import { IFRAME_ALLOWED_HOSTS } from '@/lib/config'
import { getEdgeBaseStroke as getEdgeBaseStrokeRaw, getNodeBaseFill as getNodeBaseFillRaw } from '@/lib/graph/visualStyles'

export function create2dSvgSnapshotFns(
  svgRef: RefObject<SVGSVGElement | null>,
): {
  captureSvg: () => Promise<string | null>
  capturePng: (pixelRatio?: number) => Promise<Blob | null>
} {
  const captureSvg = async (): Promise<string | null> => {
    try {
      const el = svgRef.current
      if (!el) return null
      const clone = el.cloneNode(true) as SVGSVGElement
      clone.removeAttribute('style')
      const serializer = new XMLSerializer()
      const markup = serializer.serializeToString(clone)
      if (!markup || !markup.trim()) return null
      return markup
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
        const viewBox = el.viewBox && el.viewBox.baseVal ? el.viewBox.baseVal : null
        const w = viewBox && viewBox.width ? viewBox.width : el.clientWidth || 800
        const h = viewBox && viewBox.height ? viewBox.height : el.clientHeight || 600
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

  return { captureSvg, capturePng }
}

export function getNodeRadius(d: GraphNode, schema: GraphSchema): number {
  return getNodeRadiusFromSchema(d, schema)
}

function isKeywordItem(props: Record<string, unknown> | null | undefined): boolean {
  const kind = props ? props['keyword:kind'] : undefined
  return typeof kind === 'string' && kind.trim() !== ''
}

function getKeywordEdgeWidthScale(schema: GraphSchema): number {
  const v = schema.three?.keywordEdgeWidthScale
  if (typeof v !== 'number' || !Number.isFinite(v)) return 1
  return Math.max(0.2, Math.min(5, v))
}

export function getRenderNodeRadius2d(node: GraphNode, schema: GraphSchema): number {
  return getNodeRenderRadius(node, schema)
}

export function getEdgeStrokeWidth(edge: GraphEdge, schema: GraphSchema): number {
  const styles = schema.edgeStyles[edge.label] || {}
  const baseFromSchema =
    typeof styles.width === 'number' && Number.isFinite(styles.width) && styles.width > 0
      ? styles.width
      : 2
  const props = edge.properties || {}
  const isKeyword = isKeywordItem(props as Record<string, unknown>)
  const scale = isKeyword ? getKeywordEdgeWidthScale(schema) : 1
  const threeCfg = getThreeConfig(schema)
  const formula = threeCfg.edgeWidthFormula || 'schema'
  const propWidth = props['visual:width']
  let width = baseFromSchema
  if (isKeyword && typeof propWidth === 'number' && Number.isFinite(propWidth) && propWidth > 0) {
    width = propWidth
  } else if (formula !== 'weight' && typeof propWidth === 'number' && Number.isFinite(propWidth) && propWidth > 0) {
    width = propWidth
  } else if (formula === 'weight') {
    const rawWeight = (() => {
      const w1 = props['weight']
      const w2 = props['visual:weight']
      if (typeof w1 === 'number' && Number.isFinite(w1)) return w1 as number
      if (typeof w2 === 'number' && Number.isFinite(w2)) return w2 as number
      return null
    })()
    if (rawWeight != null && rawWeight > 0) {
      const computed = rawWeight / 3
      const clamped = Math.max(1, Math.min(5, computed))
      width = clamped
    } else if (typeof propWidth === 'number' && Number.isFinite(propWidth) && propWidth > 0) {
      width = propWidth
    }
  } else if (typeof propWidth === 'number' && Number.isFinite(propWidth) && propWidth > 0) {
    width = propWidth
  }
  return width * scale
}

export function getEdgeBaseStroke(edge: GraphEdge, schema: GraphSchema): string {
  return getEdgeBaseStrokeRaw(edge, schema)
}

export function getLayerOpacity(d: GraphNode, schema: GraphSchema): number {
  const props = d.properties || {}
  const raw = props['visual:layer']
  let layer: number | null = null
  if (typeof raw === 'number') {
    layer = raw
  } else if (typeof raw === 'string') {
    const n = Number(raw)
    if (Number.isFinite(n)) layer = n
  }
  const layerKey = layer != null ? String(layer) : null
  const layerOpacityByLayer = getThreeConfig(schema).layerOpacityByLayer || {}
  if (layerKey && Object.prototype.hasOwnProperty.call(layerOpacityByLayer, layerKey)) {
    const v = layerOpacityByLayer[layerKey]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  if (layer === 1) return 1
  if (layer === 2) return 0.9
  if (layer === 3) return 0.8
  return 1
}

export function getVisualOpacity(d: GraphNode): number {
  const props = d.properties || {}
  const raw = props['visual:opacity']
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number(raw)
        : null
  if (typeof n === 'number' && Number.isFinite(n)) {
    if (n < 0) return 0
    if (n > 1) return 1
    return n
  }
  return 1
}

export function getNodeBaseFill(d: GraphNode, schema: GraphSchema): string {
  return getNodeBaseFillRaw(d, schema)
}

export type NodeMediaKind = 'image' | 'svg' | 'video' | 'iframe'

export type NodeMediaSpec = {
  kind: NodeMediaKind
  url: string
  interactive: boolean
}

function inferMediaKindFromUrl(url: string): NodeMediaKind {
  const raw = String(url || '').trim()
  if (isLikelyVideoUrl(raw)) return 'video'
  if (isLikelySvgUrl(raw)) return 'svg'
  if (isLikelyImageUrl(raw)) return 'image'
  return 'image'
}

function isSafeIframeUrl(value: string): boolean {
  try {
    const u = new URL(value)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const host = u.hostname.toLowerCase()

    if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be' || host.endsWith('.youtu.be')) {
      return false
    }

    const allowed = String(IFRAME_ALLOWED_HOSTS || '')
      .split(/[,\s]+/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
    if (allowed.length === 0) return true
    return allowed.some(h => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

function normalizeIframeUrl(value: string): string {
  try {
    const u = new URL(value)
    const host = u.hostname.toLowerCase()

    if (host === 'vimeo.com' || host.endsWith('.vimeo.com')) {
      const m = u.pathname.match(/^\/(\d+)(\/|$)/)
      if (m && m[1]) {
        return `https://player.vimeo.com/video/${m[1]}`
      }
    }

    return value
  } catch {
    return value
  }
}

export function getNodeMediaSpec(node: GraphNode): NodeMediaSpec | null {
  const props = node.properties || {}
  const kindRaw = typeof props.media_kind === 'string' ? props.media_kind.trim().toLowerCase() : ''
  const kindForced: NodeMediaKind | null =
    kindRaw === 'iframe' || kindRaw === 'video' || kindRaw === 'image' || kindRaw === 'svg'
      ? (kindRaw as NodeMediaKind)
      : null

  const iframeUrl = coerceMediaUrl((props as Record<string, unknown>).iframe_url)
  const mediaUrl = coerceMediaUrl((props as Record<string, unknown>).media_url)
  const imageUrl = coerceMediaUrl((props as Record<string, unknown>).image)
  const videoUrl = coerceMediaUrl((props as Record<string, unknown>).video)
  const generic = coerceMediaUrl((props as Record<string, unknown>).media)

  const url =
    iframeUrl ||
    mediaUrl ||
    imageUrl ||
    videoUrl ||
    generic

  if (!url) return null

  const kind: NodeMediaKind = kindForced
    ? kindForced
    : iframeUrl
      ? 'iframe'
      : videoUrl
        ? 'video'
        : inferMediaKindFromUrl(url)

  const rawInteractive = (props as Record<string, unknown>).media_interactive
  const explicitInteractive =
    rawInteractive === true ? true : rawInteractive === false ? false : null
  const interactive =
    explicitInteractive != null ? explicitInteractive : kind === 'video' || kind === 'iframe'

  if (kind === 'iframe') {
    const normalized = normalizeIframeUrl(url)
    if (!isSafeIframeUrl(normalized)) return null
    return { kind, url: normalized, interactive }
  }

  return { kind, url, interactive }
}

export function hasNodeMedia(node: GraphNode): boolean {
  return getNodeMediaSpec(node) != null
}

export type FlowKind = 'input' | 'compute'

export type FlowOp = 'sum' | 'avg'

export type FlowState = {
  valuesByNodeId: Record<string, number>
  kindsByNodeId: Record<string, FlowKind>
  opsByNodeId: Record<string, FlowOp>
}

export function coerceFlowNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function computeFlowState(graphData: GraphData | null): FlowState {
  const valuesByNodeId: Record<string, number> = {}
  const kindsByNodeId: Record<string, FlowKind> = {}
  const opsByNodeId: Record<string, FlowOp> = {}
  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return { valuesByNodeId, kindsByNodeId, opsByNodeId }
  }
  const adj = getAdjacencyMap(graphData as { nodes: GraphNode[]; edges: GraphEdge[] })
  for (let i = 0; i < graphData.nodes.length; i += 1) {
    const node = graphData.nodes[i]
    const props = node.properties || {}
    const kindRaw = props['flow:kind']
    const kind: FlowKind | null = kindRaw === 'input' || kindRaw === 'compute' ? kindRaw : null
    if (!kind) continue
    kindsByNodeId[node.id] = kind
    const opRaw = props['flow:op']
    const op: FlowOp = opRaw === 'avg' ? 'avg' : 'sum'
    if (kind === 'compute') {
      opsByNodeId[node.id] = op
    }
    if (kind === 'input') {
      const rawValue = props['flow:value']
      const n = coerceFlowNumber(rawValue)
      if (n != null) {
        valuesByNodeId[node.id] = n
      }
    }
  }
  for (let i = 0; i < graphData.nodes.length; i += 1) {
    const node = graphData.nodes[i]
    if (kindsByNodeId[node.id] !== 'compute') continue
    const neighbors = adj.get(node.id)
    if (!neighbors || neighbors.size === 0) continue
    let sum = 0
    let count = 0
    neighbors.forEach(id => {
      const v = valuesByNodeId[id]
      if (typeof v === 'number' && Number.isFinite(v)) {
        sum += v
        count += 1
      }
    })
    if (!count) continue
    const op: FlowOp = opsByNodeId[node.id] || 'sum'
    const value = op === 'avg' ? sum / count : sum
    if (Number.isFinite(value)) {
      valuesByNodeId[node.id] = value
    }
  }
  return { valuesByNodeId, kindsByNodeId, opsByNodeId }
}
