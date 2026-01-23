import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { truncateTextWithWordEllipsis, wrapTextByMaxChars, estimateMaxCharsForWidthPx, estimateLabelCharWidthPx } from '@/components/GraphCanvas/layout/utils'
import { getNodeRectDimensions2d, getNodeRenderShape2d } from '@/components/GraphCanvas/nodeSizing2d'

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

const getLabelFontSizePx = (schema: GraphSchema): number => {
  const raw = schema.labelStyles?.fontSize
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  return 12
}

const getLabelOffsets2d = (node: GraphNode, schema: GraphSchema): { dx: number; dy: number; anchor: 'start' | 'end' | 'middle' } => {
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

export const computeVisibleLabelLines2d = (node: GraphNode, schema: GraphSchema): VisibleLabelLines2d => {
  const fontSizePx = getLabelFontSizePx(schema)
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

export const estimateVisibleLabelBounds2d = (node: GraphNode, schema: GraphSchema): { halfW: number; halfH: number } => {
  const layout = computeVisibleLabelLines2d(node, schema)
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

export const estimateNodeLabelAabbHalfExtents2d = (node: GraphNode, schema: GraphSchema, nodeHalfExtents: { halfW: number; halfH: number }): { halfW: number; halfH: number } => {
  const { dx, dy, anchor } = getLabelOffsets2d(node, schema)
  const bounds = estimateVisibleLabelBounds2d(node, schema)
  const halfW = (() => {
    if (anchor === 'middle') return Math.max(nodeHalfExtents.halfW, bounds.halfW)
    return nodeHalfExtents.halfW + Math.abs(dx) + bounds.halfW
  })()
  const halfH = Math.max(nodeHalfExtents.halfH, bounds.halfH + Math.abs(dy))
  return { halfW, halfH }
}
