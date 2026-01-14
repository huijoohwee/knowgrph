import type { GraphSchema } from '@/lib/graph/schema'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function parseLayoutMode(raw: unknown): NonNullable<NonNullable<GraphSchema['layout']>['mode']> | null {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) return null
  const normalized = text.toLowerCase()
  if (normalized === 'force') return 'force'
  if (normalized === 'radial' || normalized === 'radial-cluster' || normalized === 'cluster') return 'radial'
  if (normalized === 'tree' || normalized === 'tidy-tree' || normalized === 'tidytree' || normalized === 'tidy') return 'tree'
  return null
}

function parseEdgeLabels(raw: unknown): string[] | null {
  if (typeof raw === 'string') {
    const parts = raw
      .split(/[,;\n]+/g)
      .map(x => x.trim())
      .filter(Boolean)
    const unique = Array.from(new Set(parts))
    return unique.length > 0 ? unique : null
  }
  if (Array.isArray(raw)) {
    const parts = raw
      .map(x => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean)
    const unique = Array.from(new Set(parts))
    return unique.length > 0 ? unique : null
  }
  return null
}

export function parseTreeMetadata(raw: unknown): Partial<NonNullable<NonNullable<GraphSchema['layout']>['tree']>> | null {
  if (!isRecord(raw)) return null
  const out: Partial<NonNullable<NonNullable<GraphSchema['layout']>['tree']>> = {}
  if ('edgeLabels' in raw) {
    const parsed = parseEdgeLabels(raw.edgeLabels)
    if (parsed) out.edgeLabels = parsed
  }
  if ('direction' in raw) {
    const dir = typeof raw.direction === 'string' ? raw.direction.trim() : ''
    if (dir === 'auto' || dir === 'source-target' || dir === 'target-source') out.direction = dir
  }
  if ('orientation' in raw) {
    const ori = typeof raw.orientation === 'string' ? raw.orientation.trim() : ''
    if (ori === 'horizontal' || ori === 'vertical') out.orientation = ori
  }
  if ('nodeSize' in raw && isRecord(raw.nodeSize)) {
    const x = typeof raw.nodeSize.x === 'number' && Number.isFinite(raw.nodeSize.x) ? raw.nodeSize.x : undefined
    const y = typeof raw.nodeSize.y === 'number' && Number.isFinite(raw.nodeSize.y) ? raw.nodeSize.y : undefined
    if (x != null || y != null) out.nodeSize = { x, y }
  }
  if ('separation' in raw) {
    const sep = typeof raw.separation === 'number' && Number.isFinite(raw.separation) ? raw.separation : undefined
    if (sep != null) out.separation = sep
  }
  if ('sortBy' in raw) {
    const s = typeof raw.sortBy === 'string' ? raw.sortBy.trim() : ''
    if (s === 'none' || s === 'label' || s === 'id' || s === 'type') out.sortBy = s
  }
  if ('curve' in raw) {
    const c = typeof raw.curve === 'string' ? raw.curve.trim() : ''
    if (c === 'bump' || c === 'linear' || c === 'step') out.curve = c
  }
  if ('colorMode' in raw) {
    const cm = typeof raw.colorMode === 'string' ? raw.colorMode.trim() : ''
    if (cm === 'observable' || cm === 'schema') out.colorMode = cm
  }
  if ('stroke' in raw && typeof raw.stroke === 'string' && raw.stroke.trim()) {
    out.linkStroke = raw.stroke.trim()
  } else if ('linkStroke' in raw && typeof raw.linkStroke === 'string' && raw.linkStroke.trim()) {
    out.linkStroke = raw.linkStroke.trim()
  }
  if ('strokeOpacity' in raw && typeof raw.strokeOpacity === 'number' && Number.isFinite(raw.strokeOpacity)) {
    out.linkOpacity = raw.strokeOpacity
  } else if ('linkOpacity' in raw && typeof raw.linkOpacity === 'number' && Number.isFinite(raw.linkOpacity)) {
    out.linkOpacity = raw.linkOpacity
  }
  if ('strokeWidth' in raw && typeof raw.strokeWidth === 'number' && Number.isFinite(raw.strokeWidth)) {
    out.linkWidth = raw.strokeWidth
  } else if ('linkWidth' in raw && typeof raw.linkWidth === 'number' && Number.isFinite(raw.linkWidth)) {
    out.linkWidth = raw.linkWidth
  }
  if ('r' in raw && typeof raw.r === 'number' && Number.isFinite(raw.r)) {
    out.nodeRadius = raw.r
  } else if ('nodeRadius' in raw && typeof raw.nodeRadius === 'number' && Number.isFinite(raw.nodeRadius)) {
    out.nodeRadius = raw.nodeRadius
  }
  if ('internalFill' in raw && typeof raw.internalFill === 'string' && raw.internalFill.trim()) {
    out.internalFill = raw.internalFill.trim()
  }
  if ('fill' in raw && typeof raw.fill === 'string' && raw.fill.trim()) {
    out.leafFill = raw.fill.trim()
  } else if ('leafFill' in raw && typeof raw.leafFill === 'string' && raw.leafFill.trim()) {
    out.leafFill = raw.leafFill.trim()
  }
  if ('labelFontSize' in raw && typeof raw.labelFontSize === 'number' && Number.isFinite(raw.labelFontSize)) {
    out.labelFontSize = raw.labelFontSize
  }
  if ('fontSize' in raw && typeof raw.fontSize === 'number' && Number.isFinite(raw.fontSize)) {
    out.labelFontSize = raw.fontSize
  }
  if ('labelFontFamily' in raw && typeof raw.labelFontFamily === 'string' && raw.labelFontFamily.trim()) {
    out.labelFontFamily = raw.labelFontFamily.trim()
  }
  if ('fontFamily' in raw && typeof raw.fontFamily === 'string' && raw.fontFamily.trim()) {
    out.labelFontFamily = raw.fontFamily.trim()
  }
  return Object.keys(out).length > 0 ? out : null
}
