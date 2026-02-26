import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'

import type { WebpageLayoutSnapshot, WebpageLayoutElement } from './webpageLayoutExport'

export type WebpageLayoutToGraphOptions = {
  maxNodes?: number
  minAreaPx?: number
}

const clampInt = (n: unknown, fallback: number, min: number, max: number): number => {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.max(min, Math.min(max, Math.floor(v)))
}

const safeNum = (n: unknown, fallback: number): number => {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return fallback
  return v
}

const parseFirstPx = (v: string): number | null => {
  const s = String(v || '').trim()
  if (!s) return null
  const m = s.match(/-?\d+(\.\d+)?/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

const isTransparentColor = (c: string): boolean => {
  const s = String(c || '').trim().toLowerCase()
  if (!s) return true
  if (s === 'transparent') return true
  if (s === 'rgba(0, 0, 0, 0)' || s === 'rgba(0,0,0,0)') return true
  if (s === 'rgb(0, 0, 0)' || s === 'rgb(0,0,0)') return false
  return false
}

const shouldKeepElement = (el: WebpageLayoutElement, minAreaPx: number): boolean => {
  const tag = String(el.tag || '').toUpperCase()
  const w = safeNum(el.rect?.w, 0)
  const h = safeNum(el.rect?.h, 0)
  const area = w * h
  if (!(area > 0)) return false
  if (area >= minAreaPx) return true

  if (tag === 'IMG' || tag === 'SVG' || tag === 'VIDEO' || tag === 'CANVAS') return true
  if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true

  const role = String(el.attrs?.role || '').trim()
  if (role) return true
  const id = String(el.attrs?.id || '').trim()
  if (id) return true

  const bg = String(el.style?.backgroundColor || '').trim()
  const border = String(el.style?.borderWidth || '').trim()
  if (bg && !isTransparentColor(bg)) return true
  if (border && border !== '0px' && border !== '0') return true

  return false
}

export function convertWebpageLayoutToGraphData(
  snapshot: WebpageLayoutSnapshot,
  opts?: WebpageLayoutToGraphOptions,
): GraphData {
  const maxNodes = clampInt(opts?.maxNodes, 1200, 100, 5000)
  const minAreaPx = clampInt(opts?.minAreaPx, 9000, 1, 2_000_000)
  const elements = Array.isArray(snapshot?.elements) ? snapshot.elements : []

  const kept: WebpageLayoutElement[] = []
  for (let i = 0; i < elements.length; i += 1) {
    const el = elements[i]
    if (!el || typeof el !== 'object') continue
    if (!String(el.id || '').trim()) continue
    if (!el.rect || typeof el.rect !== 'object') continue
    if (!shouldKeepElement(el, minAreaPx)) continue
    kept.push(el)
    if (kept.length >= maxNodes) break
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < kept.length; i += 1) {
    const r = kept[i].rect
    const x = safeNum(r.x, 0)
    const y = safeNum(r.y, 0)
    const w = safeNum(r.w, 0)
    const h = safeNum(r.h, 0)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w)
    maxY = Math.max(maxY, y + h)
  }
  if (!Number.isFinite(minX)) {
    minX = 0
    minY = 0
    maxX = 0
    maxY = 0
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  const nodes: GraphNode[] = []
  for (let i = 0; i < kept.length; i += 1) {
    const el = kept[i]
    const r = el.rect
    const w = Math.max(1, safeNum(r.w, 1))
    const h = Math.max(1, safeNum(r.h, 1))
    const x = safeNum(r.x, 0) - cx + w / 2
    const y = safeNum(r.y, 0) - cy + h / 2

    const label =
      String(el.text || '').trim() ||
      String(el.attrs?.id || '').trim() ||
      String(el.tag || '').trim() ||
      String(el.id || '').trim()

    const borderRadius = parseFirstPx(String(el.style?.borderRadius || ''))
    const borderWidth = parseFirstPx(String(el.style?.borderWidth || ''))
    const opacity = (() => {
      const raw = String(el.style?.opacity || '').trim()
      if (!raw) return null
      const n = Number(raw)
      return Number.isFinite(n) ? n : null
    })()
    const fill = String(el.style?.backgroundColor || '').trim()
    const stroke = String(el.style?.borderColor || '').trim()
    const css = el.style

    const properties: Record<string, JSONValue> = {
      'visual:width': w as unknown as JSONValue,
      'visual:height': h as unknown as JSONValue,
      'visual:shape': 'rect' as unknown as JSONValue,
      'dom:tag': String(el.tag || '').toUpperCase() as unknown as JSONValue,
      'dom:text': String(el.text || '') as unknown as JSONValue,
      'dom:attrs:id': String(el.attrs?.id || '') as unknown as JSONValue,
      'dom:attrs:class': String(el.attrs?.class || '') as unknown as JSONValue,
      'dom:attrs:role': String(el.attrs?.role || '') as unknown as JSONValue,
      'dom:attrs:href': String(el.attrs?.href || '') as unknown as JSONValue,
      'dom:attrs:src': String(el.attrs?.src || '') as unknown as JSONValue,
      'dom:attrs:alt': String(el.attrs?.alt || '') as unknown as JSONValue,
    }
    if (css) {
      const display = String(css.display || '').trim()
      const position = String(css.position || '').trim()
      const zIndex = String(css.zIndex || '').trim()
      const backgroundColor = String(css.backgroundColor || '').trim()
      const color = String(css.color || '').trim()
      const borderRadiusCss = String(css.borderRadius || '').trim()
      const borderColorCss = String(css.borderColor || '').trim()
      const borderWidthCss = String(css.borderWidth || '').trim()
      const fontSize = String(css.fontSize || '').trim()
      const fontWeight = String(css.fontWeight || '').trim()
      const lineHeight = String(css.lineHeight || '').trim()
      const opacityCss = String(css.opacity || '').trim()
      if (display) properties['css:display'] = display as unknown as JSONValue
      if (position) properties['css:position'] = position as unknown as JSONValue
      if (zIndex) properties['css:zIndex'] = zIndex as unknown as JSONValue
      if (backgroundColor) properties['css:backgroundColor'] = backgroundColor as unknown as JSONValue
      if (color) properties['css:color'] = color as unknown as JSONValue
      if (borderRadiusCss) properties['css:borderRadius'] = borderRadiusCss as unknown as JSONValue
      if (borderColorCss) properties['css:borderColor'] = borderColorCss as unknown as JSONValue
      if (borderWidthCss) properties['css:borderWidth'] = borderWidthCss as unknown as JSONValue
      if (fontSize) properties['css:fontSize'] = fontSize as unknown as JSONValue
      if (fontWeight) properties['css:fontWeight'] = fontWeight as unknown as JSONValue
      if (lineHeight) properties['css:lineHeight'] = lineHeight as unknown as JSONValue
      if (opacityCss) properties['css:opacity'] = opacityCss as unknown as JSONValue
    }
    if (borderRadius != null && Number.isFinite(borderRadius)) properties['visual:borderRadius'] = borderRadius as unknown as JSONValue
    if (borderWidth != null && Number.isFinite(borderWidth)) properties['visual:strokeWidth'] = borderWidth as unknown as JSONValue
    if (opacity != null && Number.isFinite(opacity)) properties['visual:opacity'] = opacity as unknown as JSONValue
    if (fill && !isTransparentColor(fill)) properties['visual:fill'] = fill as unknown as JSONValue
    if (stroke && !isTransparentColor(stroke)) properties['visual:stroke'] = stroke as unknown as JSONValue

    nodes.push({
      id: String(el.id),
      label,
      type: 'WebpageElement',
      properties,
      x,
      y,
      metadata: {
        domParentId: String(el.pid || '') as unknown as JSONValue,
      },
    })
  }

  const metadata: Record<string, JSONValue> = {
    webpageLayout: {
      kind: snapshot.meta?.kind || 'layout',
      href: String(snapshot.meta?.href || ''),
      title: String(snapshot.meta?.title || ''),
      viewport: snapshot.meta?.viewport || null,
      scroll: snapshot.meta?.scroll || null,
      ts: typeof snapshot.meta?.ts === 'number' ? snapshot.meta.ts : null,
      minAreaPx,
    } as unknown as JSONValue,
  }

  return {
    type: 'Graph',
    context: 'webpageLayout' as unknown as JSONValue,
    nodes,
    edges: [],
    metadata,
  }
}
