import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { truncateTextWithWordEllipsis, wrapTextByMaxChars, estimateMaxCharsForWidthPx, estimateLabelCharWidthPx } from '@/components/GraphCanvas/layout/utils'
import { getNodeRectDimensions2d, getNodeRenderShape2d } from '@/components/GraphCanvas/nodeSizing2d'
import { readLabelPresentation2d } from '@/lib/canvas/labelPresentation2d'

export type VisibleLabelLines2d = {
  fullText: string
  wrappedText: string
  visibleLines: string[]
  lineHeightPx: number
  fontSizePx: number
  dx: number
  dy: number
  anchor: 'start' | 'end' | 'middle'
}

const getLabelFontSizePx = (schema: GraphSchema, args?: { documentSemanticMode?: 'document' | 'keyword' }): number => {
  return readLabelPresentation2d({ schema, documentSemanticMode: args?.documentSemanticMode }).nodeFontSizePx
}

export const readNodeLabelFontSize2d = (node: GraphNode | null | undefined, fallbackPx: number): number => {
  const fallback = typeof fallbackPx === 'number' && Number.isFinite(fallbackPx) ? fallbackPx : 16
  const props = (node?.properties || {}) as Record<string, unknown>
  const raw = props['visual:fontSize'] ?? props['visual:labelFontSize']
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : Number.NaN
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.max(10, Math.min(54, n))
}

export const readNodeLabelRotation2d = (node: GraphNode | null | undefined, fallbackDeg = 0): number => {
  const fallback = typeof fallbackDeg === 'number' && Number.isFinite(fallbackDeg) ? fallbackDeg : 0
  const props = (node?.properties || {}) as Record<string, unknown>
  const raw = props['visual:labelRotation'] ?? props['visual:rotation']
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : Number.NaN
  if (!Number.isFinite(n)) return fallback
  return Math.max(-70, Math.min(70, n))
}

export const isWordCloudLabelNode2d = (node: GraphNode | null | undefined): boolean => {
  const props = (node?.properties || {}) as Record<string, unknown>
  return props['visual:wordCloud'] === true
}

const getLabelOffsets2d = (node: GraphNode, schema: GraphSchema): { dx: number; dy: number; anchor: 'start' | 'end' | 'middle' } => {
  if (isWordCloudLabelNode2d(node)) return { dx: 0, dy: 0, anchor: 'middle' }
  const shape = getNodeRenderShape2d(node, schema)
  if (shape !== 'circle') return { dx: 0, dy: 0, anchor: 'middle' }
  const dxRaw = schema.labelStyles?.offset?.dx
  const dyRaw = schema.labelStyles?.offset?.dy
  const dx = typeof dxRaw === 'number' && Number.isFinite(dxRaw) ? dxRaw : 12
  const dy = typeof dyRaw === 'number' && Number.isFinite(dyRaw) ? dyRaw : 4
  return { dx, dy, anchor: dx >= 0 ? 'start' : 'end' }
}

export const getNodeLabelFullText2d = (node: GraphNode): string => {
  const props = (node.properties || {}) as Record<string, unknown>
  const raw = props['visual:label']
  if (typeof raw === 'string') return raw
  const base = typeof node.label === 'string' ? node.label : String(node.id || '')
  return base
}

export const computeVisibleLabelLines2d = (node: GraphNode, schema: GraphSchema, args?: { documentSemanticMode?: 'document' | 'keyword' }): VisibleLabelLines2d => {
  const fontSizePx = readNodeLabelFontSize2d(node, getLabelFontSizePx(schema, args))
  const lineHeightPx = fontSizePx * 1.2
  const { dx, dy, anchor } = getLabelOffsets2d(node, schema)

  const fullText = String(getNodeLabelFullText2d(node) || '')
  const base = truncateTextWithWordEllipsis(fullText, 20)

  const shape = getNodeRenderShape2d(node, schema)
  const isInline = shape === 'circle'
  const maxCharsPerLine = Math.max(8, Math.min(34, estimateMaxCharsForWidthPx(180, fontSizePx)))

  if (isInline) {
    const wrappedText = wrapTextByMaxChars(base, maxCharsPerLine)
    const rawLines = String(wrappedText).replace(/\r\n?/g, '\n').split('\n')
    const maxLines = 3
    const visibleLines =
      rawLines.length > maxLines
        ? (() => {
            const v = rawLines.slice(0, maxLines)
            const last = v[v.length - 1] || ''
            v[v.length - 1] = last.endsWith('…') ? last : `${last}…`
            return v
          })()
        : rawLines
    return { fullText, wrappedText: rawLines.length > maxLines ? visibleLines.join('\n') : wrappedText, visibleLines, lineHeightPx, fontSizePx, dx, dy, anchor }
  }

  const { width, height } = getNodeRectDimensions2d(node, schema)
  const padX = 8
  const padY = 4
  const availW = Math.max(8, width - padX * 2)
  const availH = Math.max(8, height - padY * 2)
  const maxChars = Math.max(4, Math.min(80, estimateMaxCharsForWidthPx(availW, fontSizePx)))
  const wrappedText = wrapTextByMaxChars(base, maxChars)
  const rawLines = String(wrappedText).replace(/\r\n?/g, '\n').split('\n')
  const maxLines = Math.max(1, Math.floor(availH / Math.max(1, lineHeightPx)))
  const visibleLines =
    rawLines.length > maxLines
      ? (() => {
          const v = rawLines.slice(0, maxLines)
          const last = v[v.length - 1] || ''
          v[v.length - 1] = last.endsWith('…') ? last : `${last}…`
          return v
        })()
      : rawLines
  return { fullText, wrappedText: rawLines.length > maxLines ? visibleLines.join('\n') : wrappedText, visibleLines, lineHeightPx, fontSizePx, dx, dy, anchor }
}

export const estimateVisibleLabelBounds2d = (node: GraphNode, schema: GraphSchema, args?: { documentSemanticMode?: 'document' | 'keyword' }): { halfW: number; halfH: number } => {
  const layout = computeVisibleLabelLines2d(node, schema, args)
  const lines = layout.visibleLines
  if (!lines || lines.length === 0) return { halfW: 0, halfH: 0 }
  let maxLen = 0
  for (let i = 0; i < lines.length; i += 1) {
    const len = String(lines[i] || '').length
    if (len > maxLen) maxLen = len
  }
  const charW = estimateLabelCharWidthPx(layout.fontSizePx)
  const w = Math.min(600, maxLen * charW)
  const h = Math.min(400, Math.max(1, lines.length) * layout.lineHeightPx)
  return { halfW: w / 2, halfH: h / 2 }
}

export const estimateNodeLabelAabbHalfExtents2d = (
  node: GraphNode,
  schema: GraphSchema,
  nodeHalfExtents: { halfW: number; halfH: number },
  args?: { documentSemanticMode?: 'document' | 'keyword' },
): { halfW: number; halfH: number } => {
  const { dx, dy, anchor } = getLabelOffsets2d(node, schema)
  const bounds = estimateVisibleLabelBounds2d(node, schema, args)
  const halfW = (() => {
    if (anchor === 'middle') return Math.max(nodeHalfExtents.halfW, bounds.halfW)
    return nodeHalfExtents.halfW + Math.abs(dx) + bounds.halfW
  })()
  const halfH = Math.max(nodeHalfExtents.halfH, bounds.halfH + Math.abs(dy))
  return { halfW, halfH }
}
