export type MermaidNodeDefinition = {
  name: string
  label: string | null
  className?: string
  shape?: string | null
}

export const parseMermaidStyleString = (styleStr: string): Record<string, unknown> => {
  const styles: Record<string, unknown> = {}
  const normalized = styleStr.trim().replace(/;$/, '')
  const parts = normalized.split(',')
  for (const part of parts) {
    const idx = part.indexOf(':')
    if (idx < 0) continue
    const key = part.slice(0, idx).trim()
    const val = part.slice(idx + 1).trim().replace(/;$/, '')
    if (!key || !val) continue
    if (key === 'fill') styles['visual:fill'] = val
    if (key === 'stroke') styles['visual:stroke'] = val
    if (key === 'stroke-width') {
      const w = parseFloat(val.replace('px', ''))
      if (Number.isFinite(w)) styles['visual:strokeWidth'] = w
      if (Number.isFinite(w)) styles['stroke-width'] = w
    }
    if (key === 'color') styles['visual:color'] = val
  }
  return styles
}

export const mergeMermaidNamedStyles = (
  target: Map<string, Record<string, unknown>>,
  name: string,
  styles: Record<string, unknown>,
) => {
  const key = String(name || '').trim()
  if (!key || Object.keys(styles).length === 0) return
  const prev = target.get(key) || {}
  target.set(key, { ...prev, ...styles })
}

export const normalizeMermaidLinkStyle = (style: Record<string, unknown>): Record<string, unknown> => {
  if (Object.keys(style).length === 0) return {}
  const out = { ...style }
  const strokeWidth = out['visual:strokeWidth']
  if (typeof strokeWidth === 'number' && Number.isFinite(strokeWidth) && strokeWidth > 0) {
    out['visual:width'] = strokeWidth
  }
  return out
}

export const mapMermaidShapeToPrimitive = (shape: string | null | undefined): 'node' | 'edge' | 'cluster' => {
  const v = String(shape || '').trim().toLowerCase()
  if (v === 'circle') return 'cluster'
  if (v === 'hex') return 'edge'
  return 'node'
}

export const readMermaidEdgeRelationProps = (token: string): Record<string, unknown> | undefined => {
  const raw = String(token || '').trim()
  if (!raw) return undefined
  const props: Record<string, unknown> = {}
  const displayLabel = readMermaidEdgeDisplayLabel(raw)
  if (displayLabel) props['frontmatter:displayLabel'] = displayLabel
  if (Object.keys(props).length === 0) return undefined
  return props
}

const readMermaidEdgeDisplayLabel = (edgeToken: string): string => {
  const token = String(edgeToken || '').trim()
  if (!token) return ''
  const piped = /\|([^|]+)\|/.exec(token)
  if (piped) return String(piped[1] || '').trim()
  const compact = token.replace(/\s+/g, ' ').trim()
  const fullArrowWithText = /^(?:--+|-\.-+|==+)\s+(.+?)\s+(?:--+|-\.-+|==+)>?$/.exec(compact)
  if (fullArrowWithText) return String(fullArrowWithText[1] || '').trim()
  const inlineArrowWithText = /^(?:--+|-\.-+|==+)([^><|]+?)(?:--+|-\.-+|==+)>?$/.exec(compact)
  if (inlineArrowWithText) return String(inlineArrowWithText[1] || '').trim()
  return ''
}

export const parseMermaidNodeString = (str: string): MermaidNodeDefinition | null => {
  const s = str.trim()
  if (!s) return null

  let m: RegExpExecArray | null

  let className: string | undefined
  const classMatch = /:::([a-zA-Z0-9_-]+)$/.exec(s)
  let cleanStr = s
  if (classMatch) {
    className = classMatch[1]
    cleanStr = s.substring(0, classMatch.index).trim()
  }

  const finish = (n: string, l: string | null, shape?: string | null) => ({ name: n, label: l, className, shape })
  const atSyntax = parseMermaidAtShapeSyntax(cleanStr, finish)
  if (atSyntax) return atSyntax

  m = /^([A-Za-z0-9_.-]+)\s*\[\[([^\]]+)\]\]$/.exec(cleanStr)
  if (m) return finish(m[1], m[2], 'rect')

  m = /^([A-Za-z0-9_.-]+)\s*\[\(([^)]+)\)\]$/.exec(cleanStr)
  if (m) return finish(m[1], m[2], 'rect')

  m = /^([A-Za-z0-9_.-]+)\s*\(\(([^)]+)\)\)$/.exec(cleanStr)
  if (m) return finish(m[1], m[2], 'circle')

  m = /^([A-Za-z0-9_.-]+)\s*\(\[([^\]]+)\]\)$/.exec(cleanStr)
  if (m) return finish(m[1], m[2], 'rect')

  m = /^([A-Za-z0-9_.-]+)\s*>\s*([^\]]+)\]$/.exec(cleanStr)
  if (m) return finish(m[1], m[2], 'rect')

  m = /^([A-Za-z0-9_.-]+)\s*\{\{([^}]+)\}\}$/.exec(cleanStr)
  if (m) return finish(m[1], m[2], 'hex')

  m = /^([A-Za-z0-9_.-]+)\s*\[\/([^/]+)\/\]$/.exec(cleanStr)
  if (m) return finish(m[1], m[2], 'rect')

  m = /^([A-Za-z0-9_.-]+)\s*\[\\([^\\]+)\\\]$/.exec(cleanStr)
  if (m) return finish(m[1], m[2], 'rect')

  m = /^([A-Za-z0-9_.-]+)\s*\[\/([^\]]+)\\\]$/.exec(cleanStr)
  if (m) return finish(m[1], m[2], 'rect')

  m = /^([A-Za-z0-9_.-]+)\s*\[\\([^/]+)\/\]$/.exec(cleanStr)
  if (m) return finish(m[1], m[2], 'rect')

  m = /^([A-Za-z0-9_.-]+)\s*\(\(\(([^)]+)\)\)\)$/.exec(cleanStr)
  if (m) return finish(m[1], m[2], 'circle')

  m = /^([A-Za-z0-9_.-]+)\s*\(\((.+)\)\)$/.exec(cleanStr)
  if (m) {
    const raw = String(m[2] || '').trim()
    const unquoted =
      raw.length >= 2 && ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
        ? raw.slice(1, -1)
        : raw
    return finish(m[1], unquoted, 'circle')
  }

  m = /^([A-Za-z0-9_.-]+)\s*\["(.+)"\]$/.exec(cleanStr)
  if (m) return finish(m[1], m[2], 'rect')

  m = /^([A-Za-z0-9_.-]+)\s*\[([^\]]+)\]$/.exec(cleanStr)
  if (m) return finish(m[1], m[2], 'rect')

  m = /^([A-Za-z0-9_.-]+)\s*\(([^)]+)\)$/.exec(cleanStr)
  if (m) return finish(m[1], m[2], 'rect')

  m = /^([A-Za-z0-9_.-]+)\s*\{([^}]+)\}$/.exec(cleanStr)
  if (m) return finish(m[1], m[2], 'diamond')

  if (/^[A-Za-z0-9_.-]+$/.test(cleanStr)) return finish(cleanStr, null, null)

  return null
}

const parseMermaidAtShapeSyntax = (
  cleanStr: string,
  finish: (name: string, label: string | null, shape?: string | null) => MermaidNodeDefinition,
) => {
  const idx = cleanStr.indexOf('@{')
  if (idx <= 0) return null
  if (!cleanStr.trimEnd().endsWith('}')) return null
  const name = cleanStr.slice(0, idx).trim()
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) return null
  const body = cleanStr.slice(idx + 2, cleanStr.lastIndexOf('}')).trim()
  const shapeMatch = /(?:^|,)\s*shape\s*:\s*([A-Za-z0-9_-]+|"[^"]*"|'[^']*')\s*(?:,|$)/i.exec(body)
  const rawShape = shapeMatch ? String(shapeMatch[1] || '').trim() : ''
  const shapeValue = unquoteMermaidValue(rawShape)
  const labelMatch = /(?:^|,)\s*(?:label|text)\s*:\s*("[^"]*"|'[^']*'|`[^`]*`|[^,}]+)\s*(?:,|$)/i.exec(body)
  const rawLabel = labelMatch ? String(labelMatch[1] || '').trim() : ''
  const labelValue = (() => {
    if (!rawLabel) return null
    const v = rawLabel.startsWith('`') && rawLabel.endsWith('`') ? rawLabel.slice(1, -1) : unquoteMermaidValue(rawLabel)
    const out = unescapeMermaidQuoted(v)
    return out.trim() ? out : null
  })()
  const mapped = shapeValue ? mapMermaidShape(shapeValue) : null
  return finish(name, labelValue, mapped)
}

const mapMermaidShape = (raw: string): 'circle' | 'rect' | 'diamond' | 'hex' | null => {
  const v = String(raw || '').trim().toLowerCase()
  if (!v) return null
  if (v === 'circle' || v === 'circ' || v === 'doublecircle') return 'circle'
  if (v === 'diamond' || v === 'rhombus') return 'diamond'
  if (v === 'hex' || v === 'hexagon') return 'hex'
  if (
    v === 'rect' ||
    v === 'rectangle' ||
    v === 'round-rect' ||
    v === 'stadium' ||
    v === 'pill' ||
    v === 'subroutine' ||
    v === 'cyl' ||
    v === 'cylinder' ||
    v === 'parallelogram' ||
    v === 'trapezoid' ||
    v === 'trap' ||
    v === 'lean-right' ||
    v === 'lean-left'
  ) {
    return 'rect'
  }
  return 'rect'
}

const unquoteMermaidValue = (raw: string): string => {
  const v = String(raw || '').trim()
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1)
  }
  return v
}

const unescapeMermaidQuoted = (raw: string): string => {
  const s = String(raw || '')
  return s.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\')
}
