export type NodePos2d = { x: number; y: number }

function parseNumber(v: string | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function readTranslateFromTransform(tr: string): { x: number; y: number } | null {
  const s = String(tr || '').trim()
  if (!s) return null
  const m = s.match(/translate\(\s*([-0-9.]+)\s*(?:[, ]\s*([-0-9.]+)\s*)?\)/i)
  if (m) {
    const x = Number(m[1])
    const y = Number(m[2])
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y }
    if (Number.isFinite(x)) return { x, y: 0 }
  }
  const mm = s.match(/matrix\(\s*([-0-9.]+)\s*[ ,]\s*([-0-9.]+)\s*[ ,]\s*([-0-9.]+)\s*[ ,]\s*([-0-9.]+)\s*[ ,]\s*([-0-9.]+)\s*[ ,]\s*([-0-9.]+)\s*\)/i)
  if (mm) {
    const e = Number(mm[5])
    const f = Number(mm[6])
    if (Number.isFinite(e) && Number.isFinite(f)) return { x: e, y: f }
  }
  return null
}

function readCenterFromEl(el: Element): NodePos2d | null {
  if (!el || !(el as any).getAttribute) return null
  const tag = String((el as any).tagName || '').toLowerCase()
  if (tag === 'circle') {
    const cx = parseNumber(el.getAttribute('cx'))
    const cy = parseNumber(el.getAttribute('cy'))
    if (Number.isFinite(cx) && Number.isFinite(cy)) return { x: cx, y: cy }
    return null
  }
  if (tag === 'rect') {
    const x = parseNumber(el.getAttribute('x'))
    const y = parseNumber(el.getAttribute('y'))
    const w = parseNumber(el.getAttribute('width'))
    const h = parseNumber(el.getAttribute('height'))
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      return { x: x + w / 2, y: y + h / 2 }
    }
    return null
  }

  const tr = readTranslateFromTransform(String(el.getAttribute('transform') || ''))
  if (tag === 'g' && (el as any).querySelector) {
    let base: NodePos2d | null = null
    try {
      const c = el.querySelector('circle[data-role="node-circle"], circle[cx][cy]') as SVGCircleElement | null
      if (c) {
        const cx = parseNumber(c.getAttribute('cx'))
        const cy = parseNumber(c.getAttribute('cy'))
        if (Number.isFinite(cx) && Number.isFinite(cy)) base = { x: cx, y: cy }
      }
    } catch {
      void 0
    }
    if (!base) {
      try {
        const r = el.querySelector('rect[x][y][width][height]') as SVGRectElement | null
        if (r) {
          const x = parseNumber(r.getAttribute('x'))
          const y = parseNumber(r.getAttribute('y'))
          const w = parseNumber(r.getAttribute('width'))
          const h = parseNumber(r.getAttribute('height'))
          if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
            base = { x: x + w / 2, y: y + h / 2 }
          }
        }
      } catch {
        void 0
      }
    }

    if (base && tr) return { x: base.x + tr.x, y: base.y + tr.y }
    if (base) return base
    if (tr) return tr
    return null
  }

  if (tr) return tr
  return null
}

function isPortHandleEl(el: Element): boolean {
  try {
    if (el.hasAttribute('data-port-key')) return true
    if (el.hasAttribute('data-port-dir')) return true
    return false
  } catch {
    return false
  }
}

export function extractNodePosByIdFromSvgMarkup(svgMarkup: string): Record<string, NodePos2d> {
  const raw = String(svgMarkup || '').trim()
  if (!raw) return {}
  const noXml = raw.replace(/^<\?xml[^>]*>\s*/i, '')
  try {
    const doc = new DOMParser().parseFromString(noXml, 'image/svg+xml')
    const svg = doc.querySelector('svg')
    if (!svg) return {}

    const out: Record<string, NodePos2d> = {}
    const nodeEls = svg.querySelectorAll('[data-node-id]')
    for (let i = 0; i < nodeEls.length; i += 1) {
      const el = nodeEls[i]!
      if (isPortHandleEl(el)) continue
      const id = String(el.getAttribute('data-node-id') || '').trim()
      if (!id) continue
      if (out[id]) continue

      const p = readCenterFromEl(el)
      if (p) {
        out[id] = p
        continue
      }
    }

    const edgeLines = svg.querySelectorAll('line[data-source-id][data-target-id]')
    for (let i = 0; i < edgeLines.length; i += 1) {
      const el = edgeLines[i] as SVGLineElement
      const sid = String(el.getAttribute('data-source-id') || '').trim()
      const tid = String(el.getAttribute('data-target-id') || '').trim()
      if (!sid && !tid) continue
      const x1 = parseNumber(el.getAttribute('x1'))
      const y1 = parseNumber(el.getAttribute('y1'))
      const x2 = parseNumber(el.getAttribute('x2'))
      const y2 = parseNumber(el.getAttribute('y2'))
      if (sid && !out[sid] && Number.isFinite(x1) && Number.isFinite(y1)) out[sid] = { x: x1, y: y1 }
      if (tid && !out[tid] && Number.isFinite(x2) && Number.isFinite(y2)) out[tid] = { x: x2, y: y2 }
    }

    return out
  } catch {
    return {}
  }
}
