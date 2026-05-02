import type { RefObject } from 'react'
import type { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types'
import { getNodeRadiusFromSchema, getNodeRenderRadius, getThreeConfig } from '@/lib/graph/schema'
import type { GraphSchema } from '@/lib/graph/schemaTypes'
import { getAdjacencyMap } from '@/components/GraphCanvas/adjacency'
import {
  getEdgeBaseStroke as getEdgeBaseStrokeRaw,
  getEdgeLabelColor as getEdgeLabelColorRaw,
  getNodeBaseFill as getNodeBaseFillRaw,
  getNodeBaseStroke as getNodeBaseStrokeRaw,
  getNodeLabelColor as getNodeLabelColorRaw,
} from '@/lib/graph/visualStyles'
import { readGlobalEdgeThicknessPx } from '@/lib/graph/edgeTypes'
import { buildViewportSvgMarkupFromElement } from '@/lib/graph/svgSnapshot'
export {
  DEFAULT_NODE_MEDIA_KIND,
  NODE_MEDIA_KINDS,
  buildNodeMediaInventory,
  getNodeImagePreviewUrls,
  getNodeMediaSpec,
  hasNodeMedia,
  type NodeMediaInventory,
  type NodeMediaInventoryRow,
  type NodeMediaKind,
  type NodeMediaSpec,
} from '@/lib/canvas/graph-elements/mediaSpec'

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
      const markup =
        buildViewportSvgMarkupFromElement(el, {
          includeXmlDeclaration: true,
          inlineComputedStyles: true,
          removeCssClasses: true,
          removeDataAttributes: false,
        }) || ''
      if (!markup || !markup.trim()) return null
      const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      try {
        const img = new Image()
        const rect = (() => {
          try {
            return el.getBoundingClientRect()
          } catch {
            return null
          }
        })()
        const w = rect && Number.isFinite(rect.width) && rect.width > 0 ? Math.floor(rect.width) : el.clientWidth || 800
        const h = rect && Number.isFinite(rect.height) && rect.height > 0 ? Math.floor(rect.height) : el.clientHeight || 600
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
  const safeEdge = (edge && typeof edge === 'object' ? edge : null) as
    | { label?: unknown; properties?: unknown }
    | null
  const label = typeof safeEdge?.label === 'string' ? safeEdge.label : ''
  const styles = schema.edgeStyles?.[label] || {}
  const baseFromSchema =
    typeof styles.width === 'number' && Number.isFinite(styles.width) && styles.width > 0
      ? styles.width
      : readGlobalEdgeThicknessPx(schema)
  const rawProps = safeEdge?.properties
  const props =
    rawProps && typeof rawProps === 'object' && !Array.isArray(rawProps)
      ? (rawProps as Record<string, unknown>)
      : {}
  const isKeyword = isKeywordItem(props)
  const scale = isKeyword ? getKeywordEdgeWidthScale(schema) : 1
  const threeCfg = getThreeConfig(schema)
  const formula = threeCfg.edgeWidthFormula || 'schema'
  const propWidth = props['visual:width']
  const propStrokeWidth = props['visual:strokeWidth'] ?? props['stroke-width']
  const explicitStrokeWidth =
    typeof propStrokeWidth === 'number'
      ? propStrokeWidth
      : typeof propStrokeWidth === 'string' && propStrokeWidth.trim()
        ? Number(propStrokeWidth)
        : null
  let width = baseFromSchema
  if (isKeyword && typeof propWidth === 'number' && Number.isFinite(propWidth) && propWidth > 0) {
    width = propWidth
  } else if (typeof explicitStrokeWidth === 'number' && Number.isFinite(explicitStrokeWidth) && explicitStrokeWidth > 0) {
    width = explicitStrokeWidth
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

export function getNodeBaseStroke(d: GraphNode, schema: GraphSchema): string {
  return getNodeBaseStrokeRaw(d, schema)
}

export function getNodeLabelColor(d: GraphNode, schema: GraphSchema): string {
  return getNodeLabelColorRaw(d, schema)
}

export function getEdgeLabelColor(e: GraphEdge, schema: GraphSchema): string {
  return getEdgeLabelColorRaw(e, schema)
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
