import type { GraphSchema } from '@/lib/graph/schema'

export type LabelPresentation2d = {
  nodeFontSizePx: number
  groupFontSizePx: number
  edgeFontSizePx: number
  color: string
  haloColor: string
  haloWidthPx: number
}

export const readLabelPresentation2d = (args: { schema: GraphSchema | null; documentSemanticMode?: 'document' | 'keyword' }): LabelPresentation2d => {
  const s = args.schema

  const baseRaw = s?.labelStyles?.fontSize
  const base = typeof baseRaw === 'number' && Number.isFinite(baseRaw) ? Math.max(10, Math.min(26, baseRaw)) : 12
  const semanticBoost = args.documentSemanticMode === 'document' ? 4 : 3
  const nodeFontSizePx = Math.max(14, Math.min(22, Math.round(base + semanticBoost)))
  const groupFontSizePx = Math.max(12, Math.min(26, Math.round(nodeFontSizePx + 2)))
  const edgeFontSizePx = Math.max(10, Math.min(18, Math.round(base + 0)))

  const haloWidthRaw = s?.labelStyles?.halo?.width
  const haloWidthPx = typeof haloWidthRaw === 'number' && Number.isFinite(haloWidthRaw) && haloWidthRaw > 0 ? haloWidthRaw : 3

  const color = typeof s?.labelStyles?.color === 'string' ? String(s?.labelStyles?.color || '').trim() : ''
  const haloColor = typeof s?.labelStyles?.halo?.color === 'string' ? String(s?.labelStyles?.halo?.color || '').trim() : ''

  return { nodeFontSizePx, groupFontSizePx, edgeFontSizePx, color, haloColor, haloWidthPx }
}

