export type HtmlViewerInitialView = { k: number; x: number; y: number }

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const parseZoomTransform = (raw: string): HtmlViewerInitialView | null => {
  const s = String(raw || '').trim()
  if (!s) return null

  const m1 = s.match(/translate\(\s*([-0-9.]+)(?:\s*,\s*|\s+)([-0-9.]+)\s*\)\s*scale\(\s*([-0-9.]+)\s*\)/i)
  if (m1) {
    const x = Number.parseFloat(m1[1] || 'NaN')
    const y = Number.parseFloat(m1[2] || 'NaN')
    const k = Number.parseFloat(m1[3] || 'NaN')
    if (isFiniteNum(x) && isFiniteNum(y) && isFiniteNum(k) && k > 0) return { k, x, y }
  }

  const m2 = s.match(/scale\(\s*([-0-9.]+)\s*\)\s*translate\(\s*([-0-9.]+)(?:\s*,\s*|\s+)([-0-9.]+)\s*\)/i)
  if (m2) {
    const k = Number.parseFloat(m2[1] || 'NaN')
    const x = Number.parseFloat(m2[2] || 'NaN')
    const y = Number.parseFloat(m2[3] || 'NaN')
    if (isFiniteNum(x) && isFiniteNum(y) && isFiniteNum(k) && k > 0) return { k, x, y }
  }

  return null
}

export function normalizeInteractiveSvgForHtmlViewer(svgMarkup: string): {
  svgMarkup: string
  initialView: HtmlViewerInitialView | null
} {
  const src = String(svgMarkup || '')
  if (!src.trim()) return { svgMarkup: '', initialView: null }

  const svgOpenIx = src.indexOf('<svg')
  if (svgOpenIx < 0) return { svgMarkup: src, initialView: null }

  const firstGIx = src.indexOf('<g', svgOpenIx)
  if (firstGIx < 0) return { svgMarkup: src, initialView: null }

  const gTagEndIx = src.indexOf('>', firstGIx)
  if (gTagEndIx < 0) return { svgMarkup: src, initialView: null }

  const gOpenTag = src.slice(firstGIx, gTagEndIx + 1)
  const transformAttrMatch = gOpenTag.match(/\stransform=("[^"]*"|'[^']*')/i)
  if (!transformAttrMatch) return { svgMarkup: src, initialView: null }

  const rawAttr = transformAttrMatch[1] || ''
  const rawValue = rawAttr.startsWith('"') || rawAttr.startsWith("'") ? rawAttr.slice(1, -1) : rawAttr
  const initialView = parseZoomTransform(rawValue)
  if (!initialView) return { svgMarkup: src, initialView: null }

  const gOpenTagNormalized = gOpenTag.replace(/\stransform=("[^"]*"|'[^']*')/i, '')
  const out = src.slice(0, firstGIx) + gOpenTagNormalized + src.slice(gTagEndIx + 1)
  return { svgMarkup: out, initialView }
}

