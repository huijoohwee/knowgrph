export type HtmlViewerInitialView = { k: number; x: number; y: number }

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const NUM_RE = String.raw`([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)`

const parseZoomTransform = (raw: string): HtmlViewerInitialView | null => {
  const s = String(raw || '').trim()
  if (!s) return null

  const matrixRe = new RegExp(
    String.raw`matrix\(\s*${NUM_RE}\s*[ ,]\s*${NUM_RE}\s*[ ,]\s*${NUM_RE}\s*[ ,]\s*${NUM_RE}\s*[ ,]\s*${NUM_RE}\s*[ ,]\s*${NUM_RE}\s*\)`,
    'i',
  )
  const mm = s.match(matrixRe)
  if (mm) {
    const a = Number.parseFloat(mm[1] || 'NaN')
    const b = Number.parseFloat(mm[2] || 'NaN')
    const x = Number.parseFloat(mm[5] || 'NaN')
    const y = Number.parseFloat(mm[6] || 'NaN')
    const k = Math.sqrt(a * a + b * b)
    if (isFiniteNum(x) && isFiniteNum(y) && isFiniteNum(k) && k > 0) return { k, x, y }
  }

  const m1 = s.match(new RegExp(String.raw`translate\(\s*${NUM_RE}(?:\s*,\s*|\s+)${NUM_RE}\s*\)\s*scale\(\s*${NUM_RE}\s*\)`, 'i'))
  if (m1) {
    const x = Number.parseFloat(m1[1] || 'NaN')
    const y = Number.parseFloat(m1[2] || 'NaN')
    const k = Number.parseFloat(m1[3] || 'NaN')
    if (isFiniteNum(x) && isFiniteNum(y) && isFiniteNum(k) && k > 0) return { k, x, y }
  }

  const m2 = s.match(new RegExp(String.raw`scale\(\s*${NUM_RE}\s*\)\s*translate\(\s*${NUM_RE}(?:\s*,\s*|\s+)${NUM_RE}\s*\)`, 'i'))
  if (m2) {
    const k = Number.parseFloat(m2[1] || 'NaN')
    const x = Number.parseFloat(m2[2] || 'NaN')
    const y = Number.parseFloat(m2[3] || 'NaN')
    if (isFiniteNum(x) && isFiniteNum(y) && isFiniteNum(k) && k > 0) return { k, x, y }
  }

  return null
}

const normalizeInteractiveSvgByString = (src: string): {
  svgMarkup: string
  initialView: HtmlViewerInitialView | null
} => {
  const svgOpenIx = src.indexOf('<svg')
  if (svgOpenIx < 0) return { svgMarkup: src, initialView: null }
  const re = /<g\b[^>]*\stransform=("[^"]*"|'[^']*')[^>]*>/gi
  re.lastIndex = svgOpenIx
  let m: RegExpExecArray | null = null
  while ((m = re.exec(src))) {
    const tag = m[0] || ''
    const whole = m[1] || ''
    const rawValue = whole.startsWith('"') || whole.startsWith("'") ? whole.slice(1, -1) : whole
    const initialView = parseZoomTransform(rawValue)
    if (!initialView) continue
    const tagStart = m.index
    const tagEnd = tagStart + tag.length
    const normalizedTag = tag.replace(/\stransform=("[^"]*"|'[^']*')/i, '')
    const out = src.slice(0, tagStart) + normalizedTag + src.slice(tagEnd)
    return { svgMarkup: out, initialView }
  }
  return { svgMarkup: src, initialView: null }
}

export function normalizeInteractiveSvgForHtmlViewer(svgMarkup: string): {
  svgMarkup: string
  initialView: HtmlViewerInitialView | null
} {
  const src = String(svgMarkup || '')
  if (!src.trim()) return { svgMarkup: '', initialView: null }
  try {
    const DomParserCtor =
      typeof DOMParser !== 'undefined'
        ? DOMParser
        : typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined'
          ? window.DOMParser
          : null
    const XmlSerializerCtor =
      typeof XMLSerializer !== 'undefined'
        ? XMLSerializer
        : typeof window !== 'undefined' && typeof window.XMLSerializer !== 'undefined'
          ? window.XMLSerializer
          : null
    if (DomParserCtor && XmlSerializerCtor) {
      const doc = new DomParserCtor().parseFromString(src.replace(/^<\?xml[^>]*>\s*/i, ''), 'image/svg+xml')
      const svg = doc.querySelector('svg')
      if (svg) {
        const groups = Array.from(svg.querySelectorAll('g[transform]'))
        let chosen: SVGGElement | null = null
        let chosenView: HtmlViewerInitialView | null = null
        let chosenScore = -1
        for (let i = 0; i < groups.length; i += 1) {
          const g = groups[i] as SVGGElement
          const rawTr = String(g.getAttribute('transform') || '').trim()
          if (!rawTr) continue
          const parsed = parseZoomTransform(rawTr)
          if (!parsed) continue
          const hasNodeDescendant = !!g.querySelector('[data-node-id]')
          const hasNestedTransformedNodeDescendant = Array.from(g.querySelectorAll('g[transform]')).some(x => !!x.querySelector('[data-node-id]'))
          let depth = 0
          let p: Element | null = g
          while (p && p !== svg) {
            depth += 1
            p = p.parentElement
          }
          const score = (hasNodeDescendant ? 100 : 0) + (hasNestedTransformedNodeDescendant ? 0 : 10) + depth
          if (score > chosenScore) {
            chosen = g
            chosenView = parsed
            chosenScore = score
          }
        }
        if (chosen && chosenView) {
          chosen.removeAttribute('transform')
          const out = new XmlSerializerCtor().serializeToString(svg)
          return { svgMarkup: String(out || '').trim() || src, initialView: chosenView }
        }
      }
    }
  } catch {
    void 0
  }
  return normalizeInteractiveSvgByString(src)
}
