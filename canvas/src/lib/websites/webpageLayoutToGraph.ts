import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { patchNodeMediaProperties } from '@/lib/canvas/graph-elements/mediaSpec'

import { buildWebpageAssetPathProxyUrl, isWeChatHotlinkProtectedAssetUrl } from '@/lib/url'

import type { WebpageLayoutSnapshot, WebpageLayoutElement } from './webpageLayoutExport'
import { looksLikeWebpageShellText } from './webpageShellHeuristics'

export type WebpageLayoutToGraphOptions = {
  maxNodes?: number
  minAreaPx?: number
  fidelityLevel?: 1 | 2 | 3 | 4
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
  if (/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(\.0+)?\s*\)$/.test(s)) return true
  if (/^hsla\([\s\S]*,\s*0(\.0+)?\s*\)$/.test(s)) return true
  return false
}

const safeStr = (v: unknown): string => String(v ?? '').trim()

const applyAliasedMediaProperties = (args: {
  properties: Record<string, JSONValue>
  kind: 'image' | 'video' | 'audio' | 'iframe'
  url: string
  interactive?: boolean
}): void => {
  const next = patchNodeMediaProperties({
    properties: args.properties as Record<string, unknown>,
    kind: args.kind,
    url: args.url,
    interactive: args.interactive === true,
  }) as Record<string, JSONValue>
  Object.assign(args.properties, next)
  args.properties.media = args.url as unknown as JSONValue
  const aliasKey = args.kind === 'video' ? 'video' : args.kind === 'audio' ? 'audio' : args.kind === 'iframe' ? 'iframe_url' : 'image'
  args.properties[aliasKey] = args.url as unknown as JSONValue
}

const basenameFromUrl = (raw: string): string => {
  const s = String(raw || '').trim()
  if (!s) return ''
  try {
    const u = new URL(s, 'https://example.invalid')
    const p = String(u.pathname || '')
    const parts = p.split('/').filter(Boolean)
    const last = parts[parts.length - 1] || ''
    return decodeURIComponent(last || '').slice(0, 80)
  } catch {
    const noHash = s.split('#')[0] || s
    const noQuery = noHash.split('?')[0] || noHash
    const parts = noQuery.split('/').filter(Boolean)
    return (parts[parts.length - 1] || '').slice(0, 80)
  }
}

const isInteractiveTag = (tag: string): boolean => {
  const t = String(tag || '').toUpperCase()
  return t === 'BUTTON' || t === 'A' || t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || t === 'SUMMARY' || t === 'DETAILS'
}

const isMediaTag = (tag: string): boolean => {
  const t = String(tag || '').toUpperCase()
  return t === 'IMG' || t === 'SVG' || t === 'VIDEO' || t === 'AUDIO' || t === 'CANVAS' || t === 'IFRAME'
}

const isContainerTag = (tag: string): boolean => {
  const t = String(tag || '').toUpperCase()
  return (
    t === 'HEADER' ||
    t === 'NAV' ||
    t === 'MAIN' ||
    t === 'FOOTER' ||
    t === 'SECTION' ||
    t === 'ARTICLE' ||
    t === 'ASIDE' ||
    t === 'FORM' ||
    t === 'UL' ||
    t === 'OL' ||
    t === 'LI'
  )
}

const isWrapperTag = (tag: string): boolean => {
  const t = String(tag || '').toUpperCase()
  return t === 'DIV' || t === 'SPAN' || isContainerTag(t)
}

const clampNum = (n: unknown, fallback: number, min: number, max: number): number => {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.max(min, Math.min(max, v))
}

const derivePruneParams = (snapshot: WebpageLayoutSnapshot, minAreaPx: number, fidelityLevel: 1 | 2 | 3 | 4) => {
  const vpW = safeNum(snapshot?.meta?.viewport?.w, 0)
  const vpH = safeNum(snapshot?.meta?.viewport?.h, 0)
  const vpArea = vpW > 0 && vpH > 0 ? vpW * vpH : 0
  const areaBase = vpArea > 0 ? vpArea : Math.max(1, minAreaPx / 0.012)
  const pruneScale = fidelityLevel === 4 ? 0.65 : fidelityLevel === 3 ? 0.82 : fidelityLevel === 2 ? 1 : 1.25
  const wrapperScale = fidelityLevel === 4 ? 1.25 : fidelityLevel === 3 ? 1.1 : fidelityLevel === 2 ? 1 : 0.85
  const leafMinArea = Math.round(clampNum(areaBase * 0.0018 * pruneScale, 2200, 220, 7400))
  const leafMinDim = Math.round(clampNum(Math.sqrt(areaBase) * 0.02 * Math.sqrt(pruneScale), 24, 12, 40))
  const wrapperKidsThreshold = Math.round(clampNum((Math.sqrt(areaBase) / 170) * wrapperScale, 6, 4, 10))
  return { vpW, vpH, vpArea, leafMinArea, leafMinDim, wrapperKidsThreshold }
}

const rectNearEq = (a: WebpageLayoutElement['rect'] | null | undefined, b: WebpageLayoutElement['rect'] | null | undefined): boolean => {
  if (!a || !b) return false
  const ax = safeNum(a.x, 0)
  const ay = safeNum(a.y, 0)
  const aw = safeNum(a.w, 0)
  const ah = safeNum(a.h, 0)
  const bx = safeNum(b.x, 0)
  const by = safeNum(b.y, 0)
  const bw = safeNum(b.w, 0)
  const bh = safeNum(b.h, 0)
  const tol = 2
  if (Math.abs(ax - bx) > tol) return false
  if (Math.abs(ay - by) > tol) return false
  if (Math.abs(aw - bw) > tol) return false
  if (Math.abs(ah - bh) > tol) return false
  return true
}

const rectContains = (outer: WebpageLayoutElement['rect'] | null | undefined, inner: WebpageLayoutElement['rect'] | null | undefined): boolean => {
  if (!outer || !inner) return false
  const ox = safeNum(outer.x, 0)
  const oy = safeNum(outer.y, 0)
  const ow = safeNum(outer.w, 0)
  const oh = safeNum(outer.h, 0)
  const ix = safeNum(inner.x, 0)
  const iy = safeNum(inner.y, 0)
  const iw = safeNum(inner.w, 0)
  const ih = safeNum(inner.h, 0)
  if (!(ow > 0 && oh > 0 && iw > 0 && ih > 0)) return false
  const tol = 2
  return (
    ix >= ox - tol &&
    iy >= oy - tol &&
    ix + iw <= ox + ow + tol &&
    iy + ih <= oy + oh + tol
  )
}

const rectArea = (r: WebpageLayoutElement['rect'] | null | undefined): number => {
  if (!r) return 0
  const w = safeNum(r.w, 0)
  const h = safeNum(r.h, 0)
  return w > 0 && h > 0 ? w * h : 0
}

const rectIntersectionArea = (
  a: WebpageLayoutElement['rect'] | null | undefined,
  b: WebpageLayoutElement['rect'] | null | undefined,
): number => {
  if (!a || !b) return 0
  const ax0 = safeNum(a.x, 0)
  const ay0 = safeNum(a.y, 0)
  const ax1 = ax0 + safeNum(a.w, 0)
  const ay1 = ay0 + safeNum(a.h, 0)
  const bx0 = safeNum(b.x, 0)
  const by0 = safeNum(b.y, 0)
  const bx1 = bx0 + safeNum(b.w, 0)
  const by1 = by0 + safeNum(b.h, 0)
  const ix0 = Math.max(ax0, bx0)
  const iy0 = Math.max(ay0, by0)
  const ix1 = Math.min(ax1, bx1)
  const iy1 = Math.min(ay1, by1)
  const iw = Math.max(0, ix1 - ix0)
  const ih = Math.max(0, iy1 - iy0)
  return iw > 0 && ih > 0 ? iw * ih : 0
}

const stableHash32 = (s: string): string => {
  const str = String(s || '')
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

const clampRectWithin = (
  child: WebpageLayoutElement['rect'] | null | undefined,
  parent: WebpageLayoutElement['rect'] | null | undefined,
  tol: number,
): WebpageLayoutElement['rect'] | null => {
  if (!child || !parent) return null
  const px = safeNum(parent.x, 0)
  const py = safeNum(parent.y, 0)
  const pw = safeNum(parent.w, 0)
  const ph = safeNum(parent.h, 0)
  if (!(pw > 0 && ph > 0)) return null

  const cx0 = safeNum(child.x, 0)
  const cy0 = safeNum(child.y, 0)
  const cw0 = safeNum(child.w, 0)
  const ch0 = safeNum(child.h, 0)
  if (!(cw0 > 0 && ch0 > 0)) return null

  const maxAdjust = 60
  const leftOverflow = Math.max(0, (px - tol) - cx0)
  const topOverflow = Math.max(0, (py - tol) - cy0)
  const rightOverflow = Math.max(0, (cx0 + cw0) - (px + pw + tol))
  const bottomOverflow = Math.max(0, (cy0 + ch0) - (py + ph + tol))
  const overflow = Math.max(leftOverflow, topOverflow, rightOverflow, bottomOverflow)
  if (!(overflow > 0)) return null
  if (overflow > maxAdjust) return null

  let cx = cx0
  let cy = cy0
  let cw = cw0
  let ch = ch0

  if (cx < px) cx = px
  if (cy < py) cy = py

  if (cx + cw > px + pw) {
    const shiftLeft = (px + pw) - (cx + cw)
    cx += shiftLeft
  }
  if (cy + ch > py + ph) {
    const shiftUp = (py + ph) - (cy + ch)
    cy += shiftUp
  }

  cx = Math.max(px, cx)
  cy = Math.max(py, cy)

  if (cw > pw) {
    cw = pw
    cx = px
  } else if (cx + cw > px + pw) {
    cw = Math.max(1, (px + pw) - cx)
  }

  if (ch > ph) {
    ch = ph
    cy = py
  } else if (cy + ch > py + ph) {
    ch = Math.max(1, (py + ph) - cy)
  }

  if (!(cw > 0 && ch > 0)) return null
  if (cx === cx0 && cy === cy0 && cw === cw0 && ch === ch0) return null
  return { x: cx, y: cy, w: cw, h: ch }
}

const enforceGeometricNesting = (els: WebpageLayoutElement[]): WebpageLayoutElement[] => {
  const byId = new Map<string, WebpageLayoutElement>()
  const list: WebpageLayoutElement[] = []
  for (let i = 0; i < els.length; i += 1) {
    const el = els[i]
    const id = safeStr(el.id)
    if (!id) continue
    byId.set(id, el)
    list.push(el)
  }

  const candidates: { id: string; area: number; tag: string }[] = []
  for (let i = 0; i < list.length; i += 1) {
    const el = list[i]
    const id = safeStr(el.id)
    if (!id) continue
    const tag = safeStr(el.tag).toUpperCase()
    if (isInteractiveTag(tag) || isMediaTag(tag)) continue
    const area = rectArea(el.rect)
    if (!(area > 0)) continue
    candidates.push({ id, area, tag })
  }
  candidates.sort((a, b) => a.area - b.area)

  const tol = 2
  const parentSlack = 16
  const nextById = new Map<string, WebpageLayoutElement>()
  for (let i = 0; i < list.length; i += 1) {
    const el = list[i]
    const id = safeStr(el.id)
    if (!id) continue
    const selfArea = rectArea(el.rect)
    const tag = safeStr(el.tag).toUpperCase()
    const originalPid = safeStr(el.pid)
    const originalParent = originalPid ? byId.get(originalPid) : null
    const originalParentContains = originalParent ? rectContains(originalParent.rect, el.rect) : false
    let bestParent: string | null = null
    let bestArea = Infinity
    for (let j = 0; j < candidates.length; j += 1) {
      const cand = candidates[j]
      if (cand.id === id) continue
      if (!(cand.area > selfArea + 3)) continue
      if (cand.area >= bestArea) break
      const parentEl = byId.get(cand.id)
      if (!parentEl) continue
      if (rectContains(parentEl.rect, el.rect)) {
        bestParent = cand.id
        bestArea = cand.area
        continue
      }
      const pr = parentEl.rect
      const cr = el.rect
      if (!pr || !cr) continue
      const softParent = {
        x: safeNum(pr.x, 0) - parentSlack,
        y: safeNum(pr.y, 0) - parentSlack,
        w: safeNum(pr.w, 0) + parentSlack * 2,
        h: safeNum(pr.h, 0) + parentSlack * 2,
      }
      if (!rectContains(softParent, cr)) continue
      bestParent = cand.id
      bestArea = cand.area
    }

    const pickParentId = (() => {
      if (originalParentContains) return originalPid
      if (originalParent && el.rect && originalParent.rect) {
        const clamped = clampRectWithin(el.rect, originalParent.rect, tol)
        if (clamped) return originalPid
        const softParent = {
          x: safeNum(originalParent.rect.x, 0) - parentSlack,
          y: safeNum(originalParent.rect.y, 0) - parentSlack,
          w: safeNum(originalParent.rect.w, 0) + parentSlack * 2,
          h: safeNum(originalParent.rect.h, 0) + parentSlack * 2,
        }
        if (rectContains(softParent, el.rect)) return originalPid
      }
      return bestParent || ''
    })()

    const nextPid = pickParentId && pickParentId !== id ? pickParentId : ''
    const parent = nextPid ? byId.get(nextPid) : null
    const rectClamped = parent ? clampRectWithin(el.rect, parent.rect, tol) : null

    const next: WebpageLayoutElement = {
      ...el,
      pid: nextPid,
      ...(rectClamped ? { rect: rectClamped } : {}),
    }

    if (next.pid === originalPid && !rectClamped) {
      nextById.set(id, el)
    } else {
      nextById.set(id, next)
    }
  }
  return Array.from(nextById.values())
}

const hasVisualDecoration = (el: WebpageLayoutElement): boolean => {
  const css = el.style
  if (!css) return false
  const bg = String(css.backgroundColor || '').trim()
  if (bg && !isTransparentColor(bg)) return true
  const border = String(css.borderWidth || '').trim()
  if (border && border !== '0px' && border !== '0') return true
  const shadow = String((css as Record<string, unknown>).boxShadow || '').trim()
  if (shadow && shadow !== 'none') return true
  const pos = String(css.position || '').trim().toLowerCase()
  if (pos === 'fixed' || pos === 'sticky') return true
  const z = String(css.zIndex || '').trim()
  if (z && z !== 'auto' && z !== '0') return true
  return false
}

const normText = (raw: string): string => String(raw || '').replace(/\s+/g, ' ').trim()

const truncateForPreview = (raw: string, maxChars: number): string => {
  const s = normText(raw)
  const limit = Math.max(8, Math.min(2000, Math.floor(maxChars)))
  if (s.length <= limit) return s
  return `${s.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
}

const isHeadingTag = (tag: string): boolean => {
  const t = String(tag || '').toUpperCase()
  return t === 'H1' || t === 'H2' || t === 'H3' || t === 'H4' || t === 'H5' || t === 'H6'
}

const WEBPAGE_LAYOUT_CHROME_CONTROL_TEXT_RE =
  /^(?:get|open|download|install|launch|continue)\s+app$|^(?:sign\s*in|sign\s*up|log\s*in|log\s*on|visit\s+website|visit\s+site|new\s+chat|copy)$/i

const WEBPAGE_LAYOUT_CHROME_CONTROL_CUE_RE =
  /\b(?:get|open|download|install|launch|continue)\s+app\b|\b(?:sign\s*in|sign\s*up|log\s*in|log\s*on|visit\s+website|visit\s+site|new\s+chat|copy)\b/gi

const WEBPAGE_LAYOUT_CHROME_CLASS_RE =
  /(nav|menu|header|footer|toolbar|tabbar|sidebar|drawer|modal|dialog|auth|login|signin|signup|appbar|topbar|bottombar|controls?|actions?)/i

const WEBPAGE_LAYOUT_LOW_VALUE_SECTION_TITLE_RE =
  /\b(?:what'?s new|other improvements?|improvements?|release notes?|changelog|product updates?|login(?:\s*&\s*account)?|account|pricing|plans|security|settings|integrations?|extensions?|announcements?)\b/i

const isChromeLandmarkRole = (role: string): boolean => {
  const r = String(role || '').trim().toLowerCase()
  return r === 'banner' || r === 'navigation' || r === 'contentinfo' || r === 'complementary' || r === 'search'
}

const isChromeLandmarkTag = (tag: string): boolean => {
  const t = String(tag || '').trim().toUpperCase()
  return t === 'HEADER' || t === 'NAV' || t === 'FOOTER' || t === 'ASIDE'
}

const buildChromeProbeText = (el: WebpageLayoutElement): string =>
  [
    normText(safeStr(el.text)),
    safeStr(el.attrs?.ariaLabel),
    safeStr(el.attrs?.placeholder),
  ]
    .filter(Boolean)
    .join(' ')
    .trim()

const looksLikeChromeCueElement = (el: WebpageLayoutElement): boolean => {
  const probe = buildChromeProbeText(el)
  if (!probe) return false
  if (looksLikeWebpageShellText(probe)) return true
  if (WEBPAGE_LAYOUT_CHROME_CONTROL_TEXT_RE.test(probe)) return true
  const cueCount = (probe.match(WEBPAGE_LAYOUT_CHROME_CONTROL_CUE_RE) || []).length
  return cueCount >= 2
}

const scoreElementForKeep = (el: WebpageLayoutElement, minAreaPx: number): number => {
  const tag = safeStr(el.tag).toUpperCase()
  const r = el.rect
  const w = safeNum(r?.w, 0)
  const h = safeNum(r?.h, 0)
  const area = w > 0 && h > 0 ? w * h : 0
  const minDim = Math.min(w, h)
  const text = normText(safeStr(el.text))
  const cls = safeStr(el.attrs?.class)
  const role = safeStr(el.attrs?.role)
  const aria = safeStr(el.attrs?.ariaLabel)
  const id = safeStr(el.attrs?.id)

  let s = 0
  if (isMediaTag(tag)) s += 90
  if (isInteractiveTag(tag)) s += 85
  if (isHeadingTag(tag)) s += 80
  if (tag === 'P' || tag === 'LI') s += text ? 25 : 0
  if (isContainerTag(tag)) s += 35
  if (role === 'main') s += 40
  if (tag === 'HEADER' || tag === 'NAV' || tag === 'MAIN' || tag === 'FOOTER') s += 30
  if (hasVisualDecoration(el)) s += 20

  if (text) s += Math.min(30, 8 + Math.floor(text.length / 18))
  if (aria) s += 10
  if (role) s += 8
  if (id) s += 6
  if (cls && /(hero|card|feature|tile|pricing|testimonial|reviews?|faq|accordion|banner|cta|navbar|header|footer|modal|dialog|drawer|popover|tooltip|toast|sidebar|carousel|slider|swiper|gallery|tabs?|menu|table|list)/i.test(cls)) {
    s += 12
  }

  const areaRatio = minAreaPx > 0 ? area / minAreaPx : 0
  if (areaRatio > 0) s += Math.min(40, Math.max(0, Math.round(Math.log2(1 + areaRatio) * 16)))
  if (minDim > 0) s += Math.min(10, Math.floor(minDim / 40))
  return s
}

const scoreElementForPrune = (el: WebpageLayoutElement, preserveClassRe: RegExp): number => {
  const tag = safeStr(el.tag).toUpperCase()
  if (isInteractiveTag(tag) || isMediaTag(tag)) return 1000
  let s = 0
  const text = normText(safeStr(el.text))
  if (text) s += Math.min(40, 10 + Math.floor(text.length / 12))
  if (hasVisualDecoration(el)) s += 30
  const cls = safeStr(el.attrs?.class)
  if (cls && preserveClassRe.test(cls)) s += 25
  const role = safeStr(el.attrs?.role)
  const aria = safeStr(el.attrs?.ariaLabel)
  const id = safeStr(el.attrs?.id)
  if (role) s += 8
  if (aria) s += 8
  if (id) s += 8
  return s
}

const pruneOverlappedSiblings = (kept: WebpageLayoutElement[]): WebpageLayoutElement[] => {
  const preserveClassRe =
    /(hero|card|feature|tile|pricing|testimonial|reviews?|faq|accordion|banner|cta|navbar|header|footer|modal|dialog|drawer|popover|tooltip|toast|sidebar|carousel|slider|swiper|gallery|tabs?|menu|table|list)/i

  const byId = new Map<string, WebpageLayoutElement>()
  for (let i = 0; i < kept.length; i += 1) {
    const el = kept[i]
    const id = safeStr(el.id)
    if (!id) continue
    byId.set(id, el)
  }

  const buildChildren = () => {
    const childrenById = new Map<string, string[]>()
    for (const el of byId.values()) {
      const pid = safeStr(el.pid)
      const id = safeStr(el.id)
      if (!pid || !id) continue
      const list = childrenById.get(pid)
      if (list) list.push(id)
      else childrenById.set(pid, [id])
    }
    return childrenById
  }

  const shouldConsiderDropping = (el: WebpageLayoutElement): boolean => {
    const tag = safeStr(el.tag).toUpperCase()
    if (isInteractiveTag(tag) || isMediaTag(tag)) return false
    if (isContainerTag(tag)) return false
    if (safeStr(el.text)) return false
    if (hasVisualDecoration(el)) return false
    const cls = safeStr(el.attrs?.class)
    if (preserveClassRe.test(cls)) return false
    const role = safeStr(el.attrs?.role)
    const aria = safeStr(el.attrs?.ariaLabel)
    const id = safeStr(el.attrs?.id)
    if (role || aria || id) return false
    return true
  }

  let pass = 0
  while (pass < 4) {
    pass += 1
    let changed = false
    const childrenById = buildChildren()
    for (const [pid, kids] of childrenById.entries()) {
      if (!kids || kids.length < 2) continue
      for (let i = 0; i < kids.length; i += 1) {
        const aId = kids[i] || ''
        const a = byId.get(aId)
        if (!a) continue
        for (let j = i + 1; j < kids.length; j += 1) {
          const bId = kids[j] || ''
          const b = byId.get(bId)
          if (!b) continue

          const aArea = rectArea(a.rect)
          const bArea = rectArea(b.rect)
          if (!(aArea > 0 && bArea > 0)) continue

          if (rectNearEq(a.rect, b.rect)) {
            const sa = scoreElementForPrune(a, preserveClassRe)
            const sb = scoreElementForPrune(b, preserveClassRe)
            const da = shouldConsiderDropping(a)
            const db = shouldConsiderDropping(b)
            if (da && db && sa === 0 && sb === 0) {
              byId.delete(aId)
              byId.delete(bId)
            } else if (sa === sb) {
              if (a.id > b.id) byId.delete(aId)
              else byId.delete(bId)
            } else if (sa < sb) {
              byId.delete(aId)
            } else {
              byId.delete(bId)
            }
            changed = true
            break
          }

          const aInB = rectContains(b.rect, a.rect)
          const bInA = rectContains(a.rect, b.rect)
          if (!aInB && !bInA) continue

          const smaller = aInB ? a : b
          const larger = aInB ? b : a
          const smallerId = aInB ? aId : bId
          const smallerArea = aInB ? aArea : bArea
          const largerArea = aInB ? bArea : aArea

          if (smallerArea >= largerArea * 0.92) continue
          if (!shouldConsiderDropping(smaller)) continue

          byId.delete(smallerId)
          changed = true
          break
        }
        if (changed) break
      }
      if (changed) break
    }
    if (!changed) break
  }

  {
    const childrenById = buildChildren()
    for (const [pid, kids] of childrenById.entries()) {
      if (!kids || kids.length < 2) continue
      for (let i = 0; i < kids.length; i += 1) {
        const aId = kids[i] || ''
        const a = byId.get(aId)
        if (!a) continue
        for (let j = i + 1; j < kids.length; j += 1) {
          const bId = kids[j] || ''
          const b = byId.get(bId)
          if (!b) continue
          const aArea = rectArea(a.rect)
          const bArea = rectArea(b.rect)
          if (!(aArea > 0 && bArea > 0)) continue
          const inter = rectIntersectionArea(a.rect, b.rect)
          if (!(inter > 0)) continue
          const ratio = inter / Math.min(aArea, bArea)
          if (ratio < 0.92) continue
          const aDrop = shouldConsiderDropping(a)
          const bDrop = shouldConsiderDropping(b)
          if (!(aDrop || bDrop)) continue
          const sa = scoreElementForPrune(a, preserveClassRe)
          const sb = scoreElementForPrune(b, preserveClassRe)
          if (aDrop && (!bDrop || sa <= sb)) byId.delete(aId)
          else if (bDrop) byId.delete(bId)
          break
        }
      }
    }
  }

  return Array.from(byId.values())
}

const pruneSmallNoisyLeaves = (
  kept: WebpageLayoutElement[],
  params: { leafMinArea: number; leafMinDim: number },
): WebpageLayoutElement[] => {
  const preserveClassRe =
    /(hero|card|feature|tile|pricing|testimonial|reviews?|faq|accordion|banner|cta|navbar|header|footer|modal|dialog|drawer|popover|tooltip|toast|sidebar|carousel|slider|swiper|gallery|tabs?|menu|table|list)/i
  const byId = new Map<string, WebpageLayoutElement>()
  for (let i = 0; i < kept.length; i += 1) {
    const el = kept[i]
    const id = safeStr(el.id)
    if (!id) continue
    byId.set(id, el)
  }
  const childCountById = new Map<string, number>()
  for (const el of byId.values()) {
    const pid = safeStr(el.pid)
    if (!pid) continue
    childCountById.set(pid, (childCountById.get(pid) || 0) + 1)
  }

  const LEAF_MIN_AREA = Math.max(60, Math.floor(params.leafMinArea))
  const LEAF_MIN_DIM = Math.max(6, Math.floor(params.leafMinDim))

  for (const el of byId.values()) {
    const id = safeStr(el.id)
    if (!id) continue
    if ((childCountById.get(id) || 0) > 0) continue
    const tag = safeStr(el.tag).toUpperCase()
    const isPrunableBoxTag = tag === 'DIV' || tag === 'SPAN'
    const isPrunableSvgIcon = tag === 'SVG'
    if (!isPrunableBoxTag && !isPrunableSvgIcon) continue
    if (isInteractiveTag(tag)) continue
    if (safeStr(el.text)) continue
    if (hasVisualDecoration(el)) continue
    const cls = safeStr(el.attrs?.class)
    if (cls && preserveClassRe.test(cls)) continue
    const role = safeStr(el.attrs?.role)
    const aria = safeStr(el.attrs?.ariaLabel)
    const domId = safeStr(el.attrs?.id)
    if (role || aria || domId) continue
    if (isPrunableSvgIcon) {
      const pid = safeStr(el.pid)
      const parent = pid ? byId.get(pid) : null
      const parentTag = safeStr(parent?.tag).toUpperCase()
      const parentCls = safeStr(parent?.attrs?.class)
      const parentIsInteractive = isInteractiveTag(parentTag)
      const parentSuggestsControl = preserveClassRe.test(parentCls) || safeStr(parent?.attrs?.role) || safeStr(parent?.attrs?.ariaLabel)
      if (!(parentIsInteractive || parentSuggestsControl)) continue
    } else {
      if (isMediaTag(tag)) continue
    }

    const w = safeNum(el.rect?.w, 0)
    const h = safeNum(el.rect?.h, 0)
    const area = w * h
    const minDim = Math.min(w, h)
    const effMinArea = isPrunableSvgIcon ? Math.min(900, LEAF_MIN_AREA) : LEAF_MIN_AREA
    const effMinDim = isPrunableSvgIcon ? Math.min(20, LEAF_MIN_DIM) : LEAF_MIN_DIM
    if (area < effMinArea || minDim < effMinDim) {
      byId.delete(id)
    }
  }

  return Array.from(byId.values())
}

const pruneShellChromeElements = (
  kept: WebpageLayoutElement[],
  params: { vpArea: number },
): WebpageLayoutElement[] => {
  const byId = new Map<string, WebpageLayoutElement>()
  for (let i = 0; i < kept.length; i += 1) {
    const el = kept[i]
    const id = safeStr(el.id)
    if (!id) continue
    byId.set(id, el)
  }

  const rebuildChildren = () => {
    const childrenById = new Map<string, string[]>()
    for (const el of byId.values()) {
      const pid = safeStr(el.pid)
      const id = safeStr(el.id)
      if (!pid || !id) continue
      const list = childrenById.get(pid)
      if (list) list.push(id)
      else childrenById.set(pid, [id])
    }
    return childrenById
  }

  const shouldPrune = (el: WebpageLayoutElement, childrenById: Map<string, string[]>): boolean => {
    const id = safeStr(el.id)
    if (!id) return false
    const tag = safeStr(el.tag).toUpperCase()
    const role = safeStr(el.attrs?.role)
    const cls = safeStr(el.attrs?.class)
    const domId = safeStr(el.attrs?.id)
    const probe = buildChromeProbeText(el)
    const cue = looksLikeChromeCueElement(el)
    const chromeSemantic =
      isChromeLandmarkTag(tag) || isChromeLandmarkRole(role) || WEBPAGE_LAYOUT_CHROME_CLASS_RE.test(cls) || WEBPAGE_LAYOUT_CHROME_CLASS_RE.test(domId)
    if (!(cue || chromeSemantic)) return false

    const kids = childrenById.get(id) || []
    const area = rectArea(el.rect)
    const probeLen = probe.length
    const sentenceCount = (probe.match(/[.!?](?:\s|$)/g) || []).length
    const narrativeLike = probeLen >= 180 || sentenceCount >= 3

    if (isInteractiveTag(tag)) {
      if (!cue) return false
      if (narrativeLike) return false
      return true
    }
    if (!(cue && chromeSemantic)) return false
    if (narrativeLike) return false
    if (kids.length > 12 && area >= Math.max(80_000, params.vpArea * 0.12)) return false
    return true
  }

  let pass = 0
  while (pass < 4) {
    pass += 1
    let changed = false
    const childrenById = rebuildChildren()
    const ids = Array.from(byId.keys())
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i] || ''
      const el = byId.get(id)
      if (!el) continue
      if (!shouldPrune(el, childrenById)) continue
      const pid = safeStr(el.pid)
      const kids = childrenById.get(id) || []
      byId.delete(id)
      for (let j = 0; j < kids.length; j += 1) {
        const childId = kids[j] || ''
        const child = byId.get(childId)
        if (!child) continue
        if (safeStr(child.pid) === pid) continue
        byId.set(childId, { ...child, pid })
      }
      changed = true
      break
    }
    if (!changed) break
  }

  return Array.from(byId.values())
}

const pruneCompetingLowValueSections = (
  kept: WebpageLayoutElement[],
  params: { vpArea: number },
): WebpageLayoutElement[] => {
  const byId = new Map<string, WebpageLayoutElement>()
  for (let i = 0; i < kept.length; i += 1) {
    const el = kept[i]
    const id = safeStr(el.id)
    if (!id) continue
    byId.set(id, el)
  }

  const childrenByPid = new Map<string, string[]>()
  for (const el of byId.values()) {
    const id = safeStr(el.id)
    const pid = safeStr(el.pid)
    if (!id) continue
    const list = childrenByPid.get(pid)
    if (list) list.push(id)
    else childrenByPid.set(pid, [id])
  }

  const collectDescendants = (rootId: string): WebpageLayoutElement[] => {
    const out: WebpageLayoutElement[] = []
    const queue = (childrenByPid.get(rootId) || []).slice()
    const seen = new Set<string>()
    while (queue.length > 0) {
      const id = queue.shift() || ''
      if (!id || seen.has(id)) continue
      seen.add(id)
      const el = byId.get(id)
      if (!el) continue
      out.push(el)
      const kids = childrenByPid.get(id) || []
      for (let i = 0; i < kids.length; i += 1) queue.push(kids[i] || '')
    }
    return out
  }

  const summarizeNarrativeContainer = (el: WebpageLayoutElement) => {
    const descendants = collectDescendants(safeStr(el.id))
    const title = normText(safeStr(el.attrs?.ariaLabel) || safeStr(el.text))
    let longTextChars = 0
    let paragraphChars = 0
    let citationCount = 0
    let tableCount = 0
    let blockquoteCount = 0
    let listItemCount = 0
    let shortListItemCount = 0
    let interactiveCount = 0
    let chromeCueCount = looksLikeChromeCueElement(el) ? 1 : 0
    for (let i = 0; i < descendants.length; i += 1) {
      const child = descendants[i]!
      const tag = safeStr(child.tag).toUpperCase()
      const text = normText(safeStr(child.text))
      if (looksLikeChromeCueElement(child)) chromeCueCount += 1
      if (isInteractiveTag(tag)) interactiveCount += 1
      if (tag === 'TABLE') tableCount += 1
      if (tag === 'BLOCKQUOTE') blockquoteCount += 1
      if (tag === 'LI') {
        listItemCount += 1
        if (text && text.length < 72) shortListItemCount += 1
      }
      if (text) {
        if (text.length >= 80) longTextChars += text.length
        if (tag === 'P' || tag === 'BLOCKQUOTE' || tag === 'TD' || (tag === 'LI' && text.length >= 80)) {
          paragraphChars += text.length
        }
        citationCount += (text.match(/\[[0-9]+\]|https?:\/\//g) || []).length
      }
    }
    const narrativeScore =
      longTextChars + paragraphChars * 1.2 + citationCount * 36 + tableCount * 220 + blockquoteCount * 120
    const titleCue = WEBPAGE_LAYOUT_LOW_VALUE_SECTION_TITLE_RE.test(title) || looksLikeWebpageShellText(title)
    const listHeavy = listItemCount >= 6 && shortListItemCount >= Math.max(5, Math.ceil(listItemCount * 0.75))
    const chromeHeavy = chromeCueCount >= 2 || interactiveCount >= 4
    return {
      id: safeStr(el.id),
      title,
      descendants,
      narrativeScore,
      titleCue,
      listHeavy,
      chromeHeavy,
      citationCount,
      tableCount,
      longTextChars,
      paragraphChars,
      area: rectArea(el.rect),
    }
  }

  const narrativeContainers = Array.from(byId.values())
    .filter((el) => {
      const tag = safeStr(el.tag).toUpperCase()
      return tag === 'MAIN' || tag === 'ARTICLE' || tag === 'SECTION'
    })
    .map(summarizeNarrativeContainer)

  let bestNarrativeScore = 0
  for (let i = 0; i < narrativeContainers.length; i += 1) {
    bestNarrativeScore = Math.max(bestNarrativeScore, narrativeContainers[i]!.narrativeScore)
  }
  if (!(bestNarrativeScore >= 900)) return kept

  const idsToDrop = new Set<string>()
  for (let i = 0; i < narrativeContainers.length; i += 1) {
    const summary = narrativeContainers[i]!
    const el = byId.get(summary.id)
    if (!el) continue
    const tag = safeStr(el.tag).toUpperCase()
    const cls = safeStr(el.attrs?.class)
    if (tag !== 'SECTION' || !/\bkg-synth-section\b/i.test(cls)) continue
    const lowNarrative = summary.narrativeScore <= Math.max(260, bestNarrativeScore * 0.28)
    const weakContent = summary.paragraphChars < 220 && summary.longTextChars < 320
    const productLike = summary.titleCue || (summary.listHeavy && summary.chromeHeavy)
    const keepForEvidence = summary.citationCount > 0 || summary.tableCount > 0
    if (!lowNarrative || !weakContent || !productLike || keepForEvidence) continue
    idsToDrop.add(summary.id)
    for (let j = 0; j < summary.descendants.length; j += 1) {
      idsToDrop.add(safeStr(summary.descendants[j]!.id))
    }
  }

  if (idsToDrop.size === 0) return kept
  return kept.filter(el => !idsToDrop.has(safeStr(el.id)))
}

const pruneWrapperElements = (
  kept: WebpageLayoutElement[],
  params: { vpW: number; vpH: number; vpArea: number; wrapperKidsThreshold: number },
): WebpageLayoutElement[] => {
  const preserveClassRe =
    /(hero|card|feature|tile|pricing|testimonial|reviews?|faq|accordion|banner|cta|navbar|header|footer|modal|dialog|drawer|popover|tooltip|toast|sidebar|carousel|slider|swiper|gallery|tabs?|menu|table|list)/i
  const glueClassRe =
    /(container|wrapper|inner|content|stack|row|col|columns|layout|shell|page|grid|flex|mx-|my-|px-|py-|gap-|space-|w-|h-|max-w-|min-h-|grid-cols-|grid-rows-|col-span-|row-span-|items-|justify-|content-|place-|basis-|grow|shrink|self-)/i

  const isLandmarkRole = (role: string): boolean => {
    const r = String(role || '').trim().toLowerCase()
    if (!r) return false
    return (
      r === 'banner' ||
      r === 'navigation' ||
      r === 'main' ||
      r === 'contentinfo' ||
      r === 'complementary' ||
      r === 'region' ||
      r === 'search'
    )
  }

  const isMajorSectionCandidate = (id: string, childrenById: Map<string, string[]>, byId: Map<string, WebpageLayoutElement>): boolean => {
    const el = byId.get(id)
    if (!el) return false
    if (!(params.vpW > 0 && params.vpH > 0 && params.vpArea > 0)) return false
    const r = el.rect
    if (!r) return false
    const w = safeNum(r.w, 0)
    const h = safeNum(r.h, 0)
    if (!(w > 0 && h > 0)) return false
    const area = w * h
    if (area < params.vpArea * 0.06) return false
    if (w < params.vpW * 0.7) return false
    if (h < Math.min(params.vpH * 0.12, 120)) return false

    const y = safeNum(r.y, 0)
    const nearTop = y <= params.vpH * 0.22
    const nearBottom = y + h >= params.vpH * 0.78
    if (!(nearTop || nearBottom || area >= params.vpArea * 0.14)) return false

    const q: string[] = [id]
    let scanned = 0
    while (q.length > 0 && scanned < 140) {
      const cur = q.shift()!
      scanned += 1
      const node = byId.get(cur)
      if (node) {
        const tag = safeStr(node.tag).toUpperCase()
        if (tag === 'H1' || tag === 'H2' || tag === 'H3') return true
        if (isInteractiveTag(tag) || isMediaTag(tag)) return true
        const t = safeStr(node.text)
        if (t && t.replace(/\s+/g, ' ').trim().length >= 4) return true
      }
      const kids = childrenById.get(cur) || []
      for (let i = 0; i < kids.length && q.length < 220; i += 1) q.push(kids[i]!)
    }
    return false
  }

  const looksUtilityHeavy = (cls: string): boolean => {
    const raw = String(cls || '').trim()
    if (!raw) return false
    const tokens = raw.split(/\s+/).slice(0, 40)
    if (tokens.length < 4) return false
    let ok = 0
    for (let i = 0; i < tokens.length; i += 1) {
      const t = tokens[i] || ''
      if (!t) continue
      if (preserveClassRe.test(t)) return false
      if (/^[a-z]+:/.test(t) || /-/.test(t)) {
        if (/^[a-z0-9:_-]+$/i.test(t)) ok += 1
      }
    }
    return ok / Math.max(1, tokens.length) >= 0.8
  }

  const byId = new Map<string, WebpageLayoutElement>()
  for (let i = 0; i < kept.length; i += 1) {
    const el = kept[i]
    const id = safeStr(el.id)
    if (!id) continue
    byId.set(id, el)
  }

  const rebuildChildren = () => {
    const childrenById = new Map<string, string[]>()
    for (const el of byId.values()) {
      const pid = safeStr(el.pid)
      const id = safeStr(el.id)
      if (!pid || !id) continue
      const list = childrenById.get(pid)
      if (list) list.push(id)
      else childrenById.set(pid, [id])
    }
    return childrenById
  }

  let pass = 0
  while (pass < 6) {
    pass += 1
    let changed = false
    const childrenById = rebuildChildren()
    const ids = Array.from(byId.keys())
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i] || ''
      const el = byId.get(id)
      if (!el) continue
      const tag = safeStr(el.tag).toUpperCase()
      if (tag !== 'DIV' && tag !== 'SPAN') continue
      if (isInteractiveTag(tag) || isMediaTag(tag)) continue
      if (safeStr(el.text)) continue
      if (hasVisualDecoration(el)) continue
      const kids = childrenById.get(id) || []
      if (kids.length !== 1) continue
      const childId = kids[0] || ''
      if (!childId) continue
      const child = byId.get(childId)
      if (!child) continue
      if (!rectNearEq(el.rect, child.rect)) continue
      const pid = safeStr(el.pid)
      if (pid && pid === childId) continue
      byId.delete(id)
      const nextPid = pid
      const nextChild: WebpageLayoutElement = nextPid === safeStr(child.pid) ? child : { ...child, pid: nextPid }
      byId.set(childId, nextChild)
      changed = true
      break
    }
    if (!changed) break
  }

  {
    let pass = 0
    while (pass < 6) {
      pass += 1
      let changed = false
      const childrenById = rebuildChildren()
      const ids = Array.from(byId.keys())
      for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i] || ''
        const el = byId.get(id)
        if (!el) continue
        const tag = safeStr(el.tag).toUpperCase()
        if (tag !== 'DIV' && tag !== 'SPAN') continue
        if (isInteractiveTag(tag) || isMediaTag(tag)) continue
        if (safeStr(el.text)) continue
        if (hasVisualDecoration(el)) continue
        const cls = safeStr(el.attrs?.class)
        if (preserveClassRe.test(cls)) continue
        const role = safeStr(el.attrs?.role)
        if (isLandmarkRole(role)) continue
        const kids = childrenById.get(id) || []
        if (kids.length !== 1) continue
        const childId = kids[0] || ''
        if (!childId) continue
        const child = byId.get(childId)
        if (!child || !child.rect || !el.rect) continue
        if (safeStr(child.pid) === safeStr(el.pid)) continue
        const display = safeStr(el.style?.display).toLowerCase()
        const gap = safeStr(el.style?.gap).toLowerCase()
        const padding = safeStr(el.style?.padding).toLowerCase()
        const margin = safeStr(el.style?.margin).toLowerCase()
        const hasLayoutSpacing =
          (gap && gap !== '0px' && gap !== '0' && gap !== 'normal') ||
          (padding && padding !== '0px' && padding !== '0' && padding !== 'normal') ||
          (margin && margin !== '0px' && margin !== '0' && margin !== 'normal')
        const isLayoutDisplay = display === 'flex' || display === 'grid' || display === 'inline-flex' || display === 'inline-grid'
        if (!(isLayoutDisplay || hasLayoutSpacing || glueClassRe.test(cls) || looksUtilityHeavy(cls))) continue
        if (isMajorSectionCandidate(id, childrenById, byId)) continue
        if (!rectContains(el.rect, child.rect)) continue

        const pid = safeStr(el.pid)
        byId.delete(id)
        byId.set(childId, pid === safeStr(child.pid) ? child : { ...child, pid })
        changed = true
        break
      }
      if (!changed) break
    }
  }

  {
    const CHILD_COUNT_THRESHOLD = Math.max(4, Math.min(12, Math.floor(params.wrapperKidsThreshold)))
    let pass = 0
    while (pass < 6) {
      pass += 1
      let changed = false
      const childrenById = rebuildChildren()
      const ids = Array.from(byId.keys())
      for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i] || ''
        const el = byId.get(id)
        if (!el) continue
        const tag = safeStr(el.tag).toUpperCase()
        if (tag !== 'DIV' && tag !== 'SPAN') continue
        if (isInteractiveTag(tag) || isMediaTag(tag)) continue
        if (safeStr(el.text)) continue
        if (hasVisualDecoration(el)) continue
        const cls = safeStr(el.attrs?.class)
        if (preserveClassRe.test(cls)) continue
        const role = safeStr(el.attrs?.role)
        if (isLandmarkRole(role)) continue
        const kids = childrenById.get(id) || []
        const display = safeStr(el.style?.display).toLowerCase()
        const isLayoutDisplay = display === 'flex' || display === 'grid' || display === 'inline-flex' || display === 'inline-grid'
        const gap = safeStr(el.style?.gap).toLowerCase()
        const padding = safeStr(el.style?.padding).toLowerCase()
        const hasLayoutSpacing =
          (gap && gap !== '0px' && gap !== '0' && gap !== 'normal') ||
          (padding && padding !== '0px' && padding !== '0' && padding !== 'normal')
        const isGlue = isLayoutDisplay || hasLayoutSpacing || glueClassRe.test(cls) || looksUtilityHeavy(cls)
        if (!isGlue) continue
        const utilityHeavy = looksUtilityHeavy(cls) || glueClassRe.test(cls)
        const effectiveThreshold = utilityHeavy ? Math.max(3, Math.floor(CHILD_COUNT_THRESHOLD * 0.5)) : CHILD_COUNT_THRESHOLD
        if (kids.length < effectiveThreshold) continue

        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        const childIds: string[] = []
        for (let k = 0; k < kids.length; k += 1) {
          const cid = kids[k] || ''
          if (!cid) continue
          const child = byId.get(cid)
          if (!child) continue
          childIds.push(cid)
          const r = child.rect
          minX = Math.min(minX, safeNum(r?.x, 0))
          minY = Math.min(minY, safeNum(r?.y, 0))
          maxX = Math.max(maxX, safeNum(r?.x, 0) + safeNum(r?.w, 0))
          maxY = Math.max(maxY, safeNum(r?.y, 0) + safeNum(r?.h, 0))
        }
        if (childIds.length < effectiveThreshold) continue
        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) continue
        const bbox = { x: minX, y: minY, w: Math.max(0, maxX - minX), h: Math.max(0, maxY - minY) }
        const tol = 6
        const r0 = el.rect
        if (
          !r0 ||
          Math.abs(safeNum(r0.x, 0) - bbox.x) > tol ||
          Math.abs(safeNum(r0.y, 0) - bbox.y) > tol ||
          Math.abs(safeNum(r0.w, 0) - bbox.w) > tol ||
          Math.abs(safeNum(r0.h, 0) - bbox.h) > tol
        ) {
          continue
        }
        if (isMajorSectionCandidate(id, childrenById, byId)) continue

        const pid = safeStr(el.pid)
        byId.delete(id)
        for (let k = 0; k < childIds.length; k += 1) {
          const cid = childIds[k] || ''
          const child = byId.get(cid)
          if (!child) continue
          if (safeStr(child.pid) === pid) continue
          byId.set(cid, { ...child, pid })
        }
        changed = true
        break
      }
      if (!changed) break
    }
  }

  return Array.from(byId.values())
}

const shouldKeepElement = (el: WebpageLayoutElement, minAreaPx: number): boolean => {
  const tag = String(el.tag || '').toUpperCase()
  const w = safeNum(el.rect?.w, 0)
  const h = safeNum(el.rect?.h, 0)
  const area = w * h
  if (!(area > 0)) return false
  const minDim = Math.min(w, h)
  if (!(minDim > 2)) return false
  if (area < 60) return false
  if (area >= minAreaPx) return true

  const text = normText(safeStr(el.text))
  if (text) {
    if (isHeadingTag(tag)) return area >= Math.max(280, minAreaPx * 0.04) && minDim >= 12
    if (tag === 'P' || tag === 'LI') return text.length >= 18 && area >= Math.max(360, minAreaPx * 0.06) && minDim >= 12
  }

  if (isMediaTag(tag)) return true
  if (isInteractiveTag(tag)) return !looksLikeChromeCueElement(el)
  if (isContainerTag(tag) && area >= Math.max(3500, minAreaPx * 0.28) && minDim >= 30) return true

  const role = String(el.attrs?.role || '').trim()
  if (role) {
    if (isContainerTag(tag)) return area >= Math.max(2200, minAreaPx * 0.22)
    return area >= Math.max(1200, minAreaPx * 0.14) && minDim >= 18
  }
  const ariaLabel = String(el.attrs?.ariaLabel || '').trim()
  if (ariaLabel) return area >= Math.max(1200, minAreaPx * 0.14) && minDim >= 18
  const id = String(el.attrs?.id || '').trim()
  if (id) {
    if (isContainerTag(tag)) return area >= Math.max(2000, minAreaPx * 0.2)
    return area >= Math.max(900, minAreaPx * 0.12) && minDim >= 16
  }
  const cls = String(el.attrs?.class || '').trim()
  if (cls && /(card|feature|tile|pricing|testimonial|review|faq|accordion|navbar|header|footer|hero|banner|cta|button|input|search|menu|nav|tabs|tab|modal|dialog|drawer|sidebar)/i.test(cls)) {
    return area >= Math.max(2200, minAreaPx * 0.22) && minDim >= 24
  }

  const bg = String(el.style?.backgroundColor || '').trim()
  const border = String(el.style?.borderWidth || '').trim()
  if (bg && !isTransparentColor(bg)) return area >= Math.max(360, minAreaPx * 0.06) && minDim >= 14
  if (border && border !== '0px' && border !== '0') return area >= Math.max(420, minAreaPx * 0.06) && minDim >= 14
  const shadow = String(el.style?.boxShadow || '').trim()
  if (shadow && shadow !== 'none') return area >= Math.max(520, minAreaPx * 0.07) && minDim >= 16
  const display = String(el.style?.display || '').trim().toLowerCase()
  if ((display === 'flex' || display === 'grid') && area >= Math.max(3000, minAreaPx * 0.28) && minDim >= 28) return true

  return false
}

const synthesizeLayoutSections = (
  els: WebpageLayoutElement[],
  params: { vpW: number; vpH: number; vpArea: number },
): WebpageLayoutElement[] => {
  const vpW = safeNum(params.vpW, 0)
  const vpH = safeNum(params.vpH, 0)
  const vpArea = safeNum(params.vpArea, 0)
  if (!(vpW > 0 && vpH > 0 && vpArea > 0)) return els

  const byId = new Map<string, WebpageLayoutElement>()
  for (let i = 0; i < els.length; i += 1) {
    const el = els[i]
    const id = safeStr(el.id)
    if (!id) continue
    byId.set(id, el)
  }

  const buildChildren = () => {
    const childrenByPid = new Map<string, string[]>()
    for (const el of byId.values()) {
      const id = safeStr(el.id)
      const pid = safeStr(el.pid)
      if (!id) continue
      const list = childrenByPid.get(pid)
      if (list) list.push(id)
      else childrenByPid.set(pid, [id])
    }
    return childrenByPid
  }

  const childrenByPid = buildChildren()
  const siblingIdsSorted = (pid: string): string[] => {
    const kids = (childrenByPid.get(pid) || []).slice()
    kids.sort((a, b) => {
      const ea = byId.get(a)
      const eb = byId.get(b)
      const ay = safeNum(ea?.rect?.y, 0)
      const by = safeNum(eb?.rect?.y, 0)
      if (ay !== by) return ay - by
      const ax = safeNum(ea?.rect?.x, 0)
      const bx = safeNum(eb?.rect?.x, 0)
      if (ax !== bx) return ax - bx
      return a.localeCompare(b)
    })
    return kids
  }

  const classIndicatesGridOrList = (cls: string): boolean => {
    const raw = String(cls || '').trim()
    if (!raw) return false
    if (/\b(grid|grid-cols-\d+|grid-rows-\d+|col-span-\d+|row-span-\d+)\b/i.test(raw)) return true
    if (/\b(space-y-\d+|divide-y|list|cards?)\b/i.test(raw)) return true
    return false
  }

  const computeMedian = (nums: number[]): number => {
    if (nums.length === 0) return 0
    const sorted = nums.slice().sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)] || 0
  }

  const computeMinMax = (nums: number[]): { min: number; max: number } => {
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < nums.length; i += 1) {
      const v = nums[i]!
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 0 }
    return { min, max }
  }

  const siblingContainerCovers = (pid: string, bbox: { x: number; y: number; w: number; h: number }, ignoreIds: Set<string>): boolean => {
    const siblings = siblingIdsSorted(pid)
    const tol = 8
    for (let i = 0; i < siblings.length; i += 1) {
      const id = siblings[i] || ''
      if (!id || ignoreIds.has(id)) continue
      const el = byId.get(id)
      if (!el) continue
      const tag = safeStr(el.tag).toUpperCase()
      if (!isContainerTag(tag)) continue
      if (safeStr(el.text)) continue
      if (hasVisualDecoration(el)) continue
      const r = el.rect
      if (!r) continue
      if (
        Math.abs(safeNum(r.x, 0) - bbox.x) <= tol &&
        Math.abs(safeNum(r.y, 0) - bbox.y) <= tol &&
        Math.abs(safeNum(r.w, 0) - bbox.w) <= tol &&
        Math.abs(safeNum(r.h, 0) - bbox.h) <= tol
      ) {
        return true
      }
    }
    return false
  }

  const nextById = new Map<string, WebpageLayoutElement>(byId)

  for (const [pid] of childrenByPid.entries()) {
    const siblings = siblingIdsSorted(pid)
    const parent = pid ? byId.get(pid) : null
    const parentCls = safeStr(parent?.attrs?.class)
    const parentDisplay = safeStr(parent?.style?.display).toLowerCase()
    const parentLooksGridOrList = classIndicatesGridOrList(parentCls) || parentDisplay === 'grid' || parentDisplay === 'inline-grid'
    const MIN_ITEMS = parentLooksGridOrList ? 4 : 6
    if (siblings.length < MIN_ITEMS) continue

    const items: { id: string; x: number; y: number; w: number; h: number; cx: number; cy: number; tag: string }[] = []
    for (let i = 0; i < siblings.length; i += 1) {
      const id = siblings[i] || ''
      const el = id ? byId.get(id) : null
      if (!el || !el.rect) continue
      const tag = safeStr(el.tag).toUpperCase()
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue
      if (isHeadingTag(tag)) continue
      const r = el.rect
      const w = safeNum(r.w, 0)
      const h = safeNum(r.h, 0)
      const area = w * h
      const looksLikeWholeSection = (w >= vpW * 0.92 && h >= vpH * 0.28) || area >= vpArea * 0.45
      if (looksLikeWholeSection) continue
      if (!(w > 8 && h > 8 && area >= Math.max(2500, vpArea * 0.006))) continue
      const x = safeNum(r.x, 0)
      const y = safeNum(r.y, 0)
      items.push({ id, x, y, w, h, cx: x + w / 2, cy: y + h / 2, tag })
    }
    if (items.length < MIN_ITEMS) continue

    const segments: { ids: string[] }[] = []
    {
      const sorted = items.slice().sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
      let cur: string[] = []
      let prevY = -Infinity
      for (let i = 0; i < sorted.length; i += 1) {
        const it = sorted[i]!
        if (cur.length > 0) {
          const gapY = it.y - prevY
          if (gapY > Math.max(140, vpH * 0.18)) {
            if (cur.length >= MIN_ITEMS) segments.push({ ids: cur })
            cur = []
          }
        }
        cur.push(it.id)
        prevY = Math.max(prevY, it.y + it.h)
      }
      if (cur.length >= MIN_ITEMS) segments.push({ ids: cur })
    }
    if (segments.length === 0) continue

    let synthesized = 0
    const maxSynthesized = pid ? (parentLooksGridOrList ? 3 : 4) : 6
    for (let s = 0; s < segments.length; s += 1) {
      if (synthesized >= maxSynthesized) break
      const segIds = segments[s]!.ids
      const segItems = segIds.map(id => items.find(it => it.id === id)!).filter(Boolean)
      if (segItems.length < MIN_ITEMS) continue

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      let medW = 0
      let medH = 0
      {
        medW = computeMedian(segItems.map(it => it.w))
        medH = computeMedian(segItems.map(it => it.h))
      }
      for (let i = 0; i < segItems.length; i += 1) {
        const it = segItems[i]!
        minX = Math.min(minX, it.x)
        minY = Math.min(minY, it.y)
        maxX = Math.max(maxX, it.x + it.w)
        maxY = Math.max(maxY, it.y + it.h)
      }
      if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) continue
      const bbox = { x: minX, y: minY, w: Math.max(0, maxX - minX), h: Math.max(0, maxY - minY) }
      if (bbox.w < vpW * 0.45 || bbox.h < Math.min(120, vpH * 0.12)) continue

      const colTol = Math.max(18, Math.min(90, medW * 0.35))
      const centersX = segItems.map(it => it.cx).sort((a, b) => a - b)
      let cols = 0
      {
        let cur = -Infinity
        for (let i = 0; i < centersX.length; i += 1) {
          const x = centersX[i]!
          if (x > cur + colTol) {
            cols += 1
            cur = x
          } else {
            cur = (cur + x) / 2
          }
        }
      }
      const rowTol = Math.max(18, Math.min(110, medH * 0.6))
      const centersY = segItems.map(it => it.cy).sort((a, b) => a - b)
      let rows = 0
      {
        let cur = -Infinity
        for (let i = 0; i < centersY.length; i += 1) {
          const y = centersY[i]!
          if (y > cur + rowTol) {
            rows += 1
            cur = y
          } else {
            cur = (cur + y) / 2
          }
        }
      }
      const looksGrid = cols >= 2 && rows >= 2
      const looksList = cols <= 2 && rows >= 4 && bbox.w <= vpW * 0.98
      if (!(looksGrid || looksList)) continue
      const { min: minW, max: maxW } = computeMinMax(segItems.map(it => it.w))
      const { min: minH, max: maxH } = computeMinMax(segItems.map(it => it.h))
      const strongRepetition =
        segItems.length >= 6 ||
        (segItems.length >= 4 &&
          (parentLooksGridOrList || looksGrid || looksList) &&
          (minW > 0 ? maxW / minW <= 1.65 : true) &&
          (minH > 0 ? maxH / minH <= 1.85 : true))
      if (!strongRepetition) continue

      const ignoreSet = new Set<string>(segIds)
      if (siblingContainerCovers(pid, bbox, ignoreSet)) continue

      let heading: WebpageLayoutElement | null = null
      {
        let bestDy = Infinity
        for (let i = 0; i < siblings.length; i += 1) {
          const sid = siblings[i] || ''
          const el = sid ? byId.get(sid) : null
          if (!el || !el.rect) continue
          const tag = safeStr(el.tag).toUpperCase()
          if (!isHeadingTag(tag)) continue
          const t = safeStr(el.text)
          if (!t) continue
          const r = el.rect
          const bottom = safeNum(r.y, 0) + safeNum(r.h, 0)
          const dy = bbox.y - bottom
          if (dy < -8 || dy > 160) continue
          const overlapsX = safeNum(r.x, 0) + safeNum(r.w, 0) > bbox.x + 10 && safeNum(r.x, 0) < bbox.x + bbox.w - 10
          if (!overlapsX) continue
          if (dy < bestDy) {
            bestDy = dy
            heading = el
          }
        }
      }

      const memberIds = segIds.slice()
      if (heading) memberIds.unshift(safeStr(heading.id))

      let secMinX = bbox.x
      let secMinY = bbox.y
      let secMaxX = bbox.x + bbox.w
      let secMaxY = bbox.y + bbox.h
      if (heading?.rect) {
        secMinX = Math.min(secMinX, safeNum(heading.rect.x, 0))
        secMinY = Math.min(secMinY, safeNum(heading.rect.y, 0))
        secMaxX = Math.max(secMaxX, safeNum(heading.rect.x, 0) + safeNum(heading.rect.w, 0))
      }
      const margin = Math.max(8, Math.min(18, Math.round(vpW * 0.012)))
      secMinX -= margin
      secMinY -= margin
      secMaxX += margin
      secMaxY += margin
      const secRect = { x: secMinX, y: secMinY, w: Math.max(1, secMaxX - secMinX), h: Math.max(1, secMaxY - secMinY) }

      const title = heading ? safeStr(heading.text) : ''
      const memberKey = `${memberIds.slice(0, 32).join(',')}|${memberIds.length}|${Math.round(secRect.x)}|${Math.round(secRect.y)}|${Math.round(secRect.w)}|${Math.round(secRect.h)}`
      const synthId = `kg:sec:${pid || 'root'}:${stableHash32(memberKey)}`
      if (nextById.has(synthId)) continue

      const sectionEl: WebpageLayoutElement = {
        id: synthId,
        pid: pid,
        tag: 'SECTION',
        rect: secRect,
        text: '',
        attrs: {
          id: '',
          class: 'kg-synth-section',
          role: 'region',
          ariaLabel: title,
          placeholder: '',
          href: '',
          src: '',
          alt: '',
        },
        style: {
          display: looksGrid ? 'grid' : 'block',
          position: 'static',
          zIndex: '-1',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          color: '',
          borderRadius: '0px',
          borderColor: 'rgba(0, 0, 0, 0)',
          borderWidth: '0px',
          padding: '0px',
          margin: '0px',
          gap: '0px',
          rowGap: '0px',
          columnGap: '0px',
          justifyContent: 'normal',
          justifyItems: 'normal',
          alignItems: 'normal',
          alignContent: 'normal',
          justifySelf: 'auto',
          alignSelf: 'auto',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          flexGrow: '0',
          flexShrink: '1',
          flexBasis: 'auto',
          order: '0',
          gridTemplateColumns: looksGrid ? 'auto' : '',
          gridTemplateRows: looksGrid ? 'auto' : '',
          gridAutoFlow: looksGrid ? 'row' : '',
          fontSize: '',
          fontWeight: '',
          fontFamily: '',
          lineHeight: '',
          letterSpacing: '',
          textTransform: '',
          textAlign: '',
          boxShadow: 'none',
          opacity: '1',
        },
      }
      nextById.set(synthId, sectionEl)
      synthesized += 1

      for (let i = 0; i < memberIds.length; i += 1) {
        const mid = memberIds[i] || ''
        if (!mid) continue
        const el = nextById.get(mid)
        if (!el) continue
        if (safeStr(el.pid) === synthId) continue
        nextById.set(mid, { ...el, pid: synthId })
      }
    }
  }

  return Array.from(nextById.values())
}

export function convertWebpageLayoutToGraphData(
  snapshot: WebpageLayoutSnapshot,
  opts?: WebpageLayoutToGraphOptions,
): GraphData {
  const maxNodes = clampInt(opts?.maxNodes, 1200, 100, 5000)
  const minAreaPx = clampInt(opts?.minAreaPx, 9000, 1, 2_000_000)
  const fidelityParsed = opts?.fidelityLevel
  const fidelityLevel: 1 | 2 | 3 | 4 = fidelityParsed === 1 || fidelityParsed === 2 || fidelityParsed === 3 || fidelityParsed === 4 ? fidelityParsed : 3
  const pruneParams = derivePruneParams(snapshot, minAreaPx, fidelityLevel)
  const elements = Array.isArray(snapshot?.elements) ? snapshot.elements : []

  const candidates: Array<{ el: WebpageLayoutElement; score: number; idx: number }> = []
  for (let i = 0; i < elements.length; i += 1) {
    const el = elements[i]
    if (!el || typeof el !== 'object') continue
    if (!String(el.id || '').trim()) continue
    if (!el.rect || typeof el.rect !== 'object') continue
    if (!shouldKeepElement(el, minAreaPx)) continue
    candidates.push({ el, score: scoreElementForKeep(el, minAreaPx), idx: i })
  }
  candidates.sort((a, b) => b.score - a.score || a.idx - b.idx)
  const kept: WebpageLayoutElement[] = []
  for (let i = 0; i < candidates.length && kept.length < maxNodes; i += 1) kept.push(candidates[i]!.el)

  if (kept.length === 0 && elements.length > 0) {
    const ranked: { el: WebpageLayoutElement; area: number; minDim: number }[] = []
    for (let i = 0; i < elements.length; i += 1) {
      const el = elements[i]
      if (!el || typeof el !== 'object') continue
      if (!String(el.id || '').trim()) continue
      const r = el.rect
      if (!r || typeof r !== 'object') continue
      const w = safeNum(r.w, 0)
      const h = safeNum(r.h, 0)
      const area = w * h
      if (!(area > 0)) continue
      const minDim = Math.min(w, h)
      if (!(minDim > 2)) continue
      if (area < 20) continue
      ranked.push({ el, area, minDim })
    }
    ranked.sort((a, b) => b.area - a.area)
    const limit = Math.max(100, Math.min(maxNodes, 1200))
    for (let i = 0; i < ranked.length && kept.length < limit; i += 1) {
      kept.push(ranked[i]!.el)
    }
  }

  let pruned = enforceGeometricNesting(
    pruneSmallNoisyLeaves(
      pruneShellChromeElements(pruneOverlappedSiblings(pruneWrapperElements(kept, pruneParams)), pruneParams),
      pruneParams,
    ),
  )
  if (pruned.length === 0 && kept.length > 0) {
    pruned = enforceGeometricNesting(kept.slice(0, Math.max(100, Math.min(maxNodes, 1200))))
  }
  pruned = pruneCompetingLowValueSections(synthesizeLayoutSections(pruned, pruneParams), pruneParams)

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < pruned.length; i += 1) {
    const r = pruned[i].rect
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
  const keptIds = new Set<string>()
  for (let i = 0; i < pruned.length; i += 1) keptIds.add(String(pruned[i].id))
  for (let i = 0; i < pruned.length; i += 1) {
    const el = pruned[i]
    const r = el.rect
    const w = Math.max(1, safeNum(r.w, 1))
    const h = Math.max(1, safeNum(r.h, 1))
    const x = safeNum(r.x, 0) - cx + w / 2
    const y = safeNum(r.y, 0) - cy + h / 2

    const tag = String(el.tag || '').toUpperCase()
    const text = normText(safeStr(el.text))
    const ariaLabel = safeStr(el.attrs?.ariaLabel)
    const domId = safeStr(el.attrs?.id)
    const domClass = safeStr(el.attrs?.class)
    const role = safeStr(el.attrs?.role)
    const href = safeStr(el.attrs?.href)
    const src = safeStr(el.attrs?.src)
    const alt = safeStr(el.attrs?.alt)
    const placeholder = safeStr(el.attrs?.placeholder)

    const label = (() => {
      if (tag === 'IMG') return alt || basenameFromUrl(src) || 'IMG'
      if (tag === 'A') return text || ariaLabel || basenameFromUrl(href) || domId || 'Link'
      if (tag === 'BUTTON') return text || ariaLabel || domId || 'Button'
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return text || placeholder || ariaLabel || domId || tag
      if (isContainerTag(tag)) {
        const hint = domId || ariaLabel || (domClass ? domClass.split(/\s+/)[0] : '') || role
        return hint ? `${tag} ${hint}`.slice(0, 80) : tag
      }
      if (text && text.length <= 60) return text
      if (ariaLabel) return ariaLabel
      if (domId) return domId
      if (domClass) return domClass.split(/\s+/)[0] || tag || String(el.id)
      return tag || String(el.id)
    })()

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
      'visual:label': label as unknown as JSONValue,
      'dom:tag': tag as unknown as JSONValue,
      'dom:text': text as unknown as JSONValue,
      'dom:attrs:id': domId as unknown as JSONValue,
      'dom:attrs:class': domClass as unknown as JSONValue,
      'dom:attrs:role': role as unknown as JSONValue,
      'dom:attrs:ariaLabel': ariaLabel as unknown as JSONValue,
      'dom:attrs:placeholder': placeholder as unknown as JSONValue,
      'dom:attrs:href': href as unknown as JSONValue,
      'dom:attrs:src': src as unknown as JSONValue,
      'dom:attrs:alt': alt as unknown as JSONValue,
    }
    const normalizedSrc0 = src.startsWith('//') ? `https:${src}` : src
    const normalizedSrc = isWeChatHotlinkProtectedAssetUrl(normalizedSrc0) ? buildWebpageAssetPathProxyUrl(normalizedSrc0) : normalizedSrc0
    if (tag === 'IMG' && normalizedSrc) {
      applyAliasedMediaProperties({ properties, kind: 'image', url: normalizedSrc })
    } else if ((tag === 'VIDEO' || tag === 'AUDIO') && normalizedSrc) {
      applyAliasedMediaProperties({ properties, kind: tag === 'VIDEO' ? 'video' : 'audio', url: normalizedSrc, interactive: true })
    } else if (tag === 'IFRAME' && normalizedSrc) {
      applyAliasedMediaProperties({ properties, kind: 'iframe', url: normalizedSrc, interactive: true })
    }
    if (text) properties['dom:textPreview'] = truncateForPreview(text, 360) as unknown as JSONValue
    const kind = isMediaTag(tag) ? 'media' : isInteractiveTag(tag) ? 'interactive' : isContainerTag(tag) ? 'container' : 'element'
    properties['dom:kind'] = kind as unknown as JSONValue
    if (css) {
      const display = String(css.display || '').trim()
      const position = String(css.position || '').trim()
      const zIndex = String(css.zIndex || '').trim()
      const transformCss = String((css as Record<string, unknown>).transform || '').trim()
      const filterCss = String((css as Record<string, unknown>).filter || '').trim()
      const isolationCss = String((css as Record<string, unknown>).isolation || '').trim()
      const willChangeCss = String((css as Record<string, unknown>).willChange || '').trim()
      const backgroundColor = String(css.backgroundColor || '').trim()
      const color = String(css.color || '').trim()
      const borderRadiusCss = String(css.borderRadius || '').trim()
      const borderColorCss = String(css.borderColor || '').trim()
      const borderWidthCss = String(css.borderWidth || '').trim()
      const paddingCss = String((css as Record<string, unknown>).padding || '').trim()
      const marginCss = String((css as Record<string, unknown>).margin || '').trim()
      const gapCss = String((css as Record<string, unknown>).gap || '').trim()
      const rowGapCss = String((css as Record<string, unknown>).rowGap || '').trim()
      const columnGapCss = String((css as Record<string, unknown>).columnGap || '').trim()
      const justifyContentCss = String((css as Record<string, unknown>).justifyContent || '').trim()
      const justifyItemsCss = String((css as Record<string, unknown>).justifyItems || '').trim()
      const alignItemsCss = String((css as Record<string, unknown>).alignItems || '').trim()
      const alignContentCss = String((css as Record<string, unknown>).alignContent || '').trim()
      const justifySelfCss = String((css as Record<string, unknown>).justifySelf || '').trim()
      const alignSelfCss = String((css as Record<string, unknown>).alignSelf || '').trim()
      const flexDirectionCss = String((css as Record<string, unknown>).flexDirection || '').trim()
      const flexWrapCss = String((css as Record<string, unknown>).flexWrap || '').trim()
      const flexGrowCss = String((css as Record<string, unknown>).flexGrow || '').trim()
      const flexShrinkCss = String((css as Record<string, unknown>).flexShrink || '').trim()
      const flexBasisCss = String((css as Record<string, unknown>).flexBasis || '').trim()
      const orderCss = String((css as Record<string, unknown>).order || '').trim()
      const gridTemplateColumnsCss = String((css as Record<string, unknown>).gridTemplateColumns || '').trim()
      const gridTemplateRowsCss = String((css as Record<string, unknown>).gridTemplateRows || '').trim()
      const gridAutoFlowCss = String((css as Record<string, unknown>).gridAutoFlow || '').trim()
      const fontSize = String(css.fontSize || '').trim()
      const fontWeight = String(css.fontWeight || '').trim()
      const fontFamilyCss = String((css as Record<string, unknown>).fontFamily || '').trim()
      const lineHeight = String(css.lineHeight || '').trim()
      const letterSpacingCss = String((css as Record<string, unknown>).letterSpacing || '').trim()
      const textTransformCss = String((css as Record<string, unknown>).textTransform || '').trim()
      const textAlignCss = String((css as Record<string, unknown>).textAlign || '').trim()
      const boxShadowCss = String((css as Record<string, unknown>).boxShadow || '').trim()
      const opacityCss = String(css.opacity || '').trim()
      if (display) properties['css:display'] = display as unknown as JSONValue
      if (position) properties['css:position'] = position as unknown as JSONValue
      if (zIndex) properties['css:zIndex'] = zIndex as unknown as JSONValue
      if (transformCss && transformCss.toLowerCase() !== 'none') properties['css:transform'] = transformCss as unknown as JSONValue
      if (filterCss && filterCss.toLowerCase() !== 'none') properties['css:filter'] = filterCss as unknown as JSONValue
      if (isolationCss) properties['css:isolation'] = isolationCss as unknown as JSONValue
      if (willChangeCss) properties['css:willChange'] = willChangeCss as unknown as JSONValue
      if (backgroundColor) properties['css:backgroundColor'] = backgroundColor as unknown as JSONValue
      if (color) properties['css:color'] = color as unknown as JSONValue
      if (borderRadiusCss) properties['css:borderRadius'] = borderRadiusCss as unknown as JSONValue
      if (borderColorCss) properties['css:borderColor'] = borderColorCss as unknown as JSONValue
      if (borderWidthCss) properties['css:borderWidth'] = borderWidthCss as unknown as JSONValue
      if (paddingCss) properties['css:padding'] = paddingCss as unknown as JSONValue
      if (marginCss) properties['css:margin'] = marginCss as unknown as JSONValue
      if (gapCss) properties['css:gap'] = gapCss as unknown as JSONValue
      if (justifyContentCss) properties['css:justifyContent'] = justifyContentCss as unknown as JSONValue
      if (justifyItemsCss) properties['css:justifyItems'] = justifyItemsCss as unknown as JSONValue
      if (alignItemsCss) properties['css:alignItems'] = alignItemsCss as unknown as JSONValue
      if (alignContentCss) properties['css:alignContent'] = alignContentCss as unknown as JSONValue
      if (justifySelfCss) properties['css:justifySelf'] = justifySelfCss as unknown as JSONValue
      if (alignSelfCss) properties['css:alignSelf'] = alignSelfCss as unknown as JSONValue
      if (flexDirectionCss) properties['css:flexDirection'] = flexDirectionCss as unknown as JSONValue
      if (flexWrapCss) properties['css:flexWrap'] = flexWrapCss as unknown as JSONValue
      if (flexGrowCss) properties['css:flexGrow'] = flexGrowCss as unknown as JSONValue
      if (flexShrinkCss) properties['css:flexShrink'] = flexShrinkCss as unknown as JSONValue
      if (flexBasisCss) properties['css:flexBasis'] = flexBasisCss as unknown as JSONValue
      if (orderCss) properties['css:order'] = orderCss as unknown as JSONValue
      if (rowGapCss) properties['css:rowGap'] = rowGapCss as unknown as JSONValue
      if (columnGapCss) properties['css:columnGap'] = columnGapCss as unknown as JSONValue
      if (gridTemplateColumnsCss && gridTemplateColumnsCss.toLowerCase() !== 'none') properties['css:gridTemplateColumns'] = gridTemplateColumnsCss as unknown as JSONValue
      if (gridTemplateRowsCss && gridTemplateRowsCss.toLowerCase() !== 'none') properties['css:gridTemplateRows'] = gridTemplateRowsCss as unknown as JSONValue
      if (gridAutoFlowCss) properties['css:gridAutoFlow'] = gridAutoFlowCss as unknown as JSONValue
      if (fontSize) properties['css:fontSize'] = fontSize as unknown as JSONValue
      if (fontWeight) properties['css:fontWeight'] = fontWeight as unknown as JSONValue
      if (fontFamilyCss) properties['css:fontFamily'] = fontFamilyCss as unknown as JSONValue
      if (lineHeight) properties['css:lineHeight'] = lineHeight as unknown as JSONValue
      if (letterSpacingCss) properties['css:letterSpacing'] = letterSpacingCss as unknown as JSONValue
      if (textTransformCss) properties['css:textTransform'] = textTransformCss as unknown as JSONValue
      if (textAlignCss) properties['css:textAlign'] = textAlignCss as unknown as JSONValue
      if (boxShadowCss) properties['css:boxShadow'] = boxShadowCss as unknown as JSONValue
      if (opacityCss) properties['css:opacity'] = opacityCss as unknown as JSONValue

      const layoutKind = (() => {
        const d = display.toLowerCase()
        const gtCols = gridTemplateColumnsCss.toLowerCase()
        const gtRows = gridTemplateRowsCss.toLowerCase()
        if (d === 'grid' || d === 'inline-grid') return 'grid'
        if (gtCols && gtCols !== 'none') return 'grid'
        if (gtRows && gtRows !== 'none') return 'grid'
        if (d === 'flex' || d === 'inline-flex') return flexDirectionCss ? `flex:${flexDirectionCss}` : 'flex'
        if (d.startsWith('table')) return 'table'
        if (d) return d
        return ''
      })()
      if (layoutKind) properties['layout:kind'] = layoutKind as unknown as JSONValue
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

  const nodeById = new Map<string, GraphNode>()
  const pidById = new Map<string, string>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n.id || '').trim()
    if (!id) continue
    nodeById.set(id, n)
    const pid = String((n.metadata as unknown as { domParentId?: unknown })?.domParentId || '').trim()
    if (pid) pidById.set(id, pid)
  }
  const indexById = new Map<string, number>()
  const rectById = new Map<string, { cx: number; cy: number; w: number; h: number }>()
  for (let i = 0; i < pruned.length; i += 1) {
    const el = pruned[i]
    const id = safeStr(el.id)
    if (!id) continue
    indexById.set(id, i)
    const r = el.rect
    const w = Math.max(0, safeNum(r.w, 0))
    const h = Math.max(0, safeNum(r.h, 0))
    const cx = safeNum(r.x, 0) + w / 2
    const cy = safeNum(r.y, 0) + h / 2
    rectById.set(id, { cx, cy, w, h })
  }

  const readCssNumber = (props: Record<string, JSONValue>, key: string): number | null => {
    const raw = props[key]
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw
    const s = typeof raw === 'string' ? raw.trim() : ''
    if (!s) return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }
  const readCssString = (props: Record<string, JSONValue>, key: string): string => {
    const raw = props[key]
    return typeof raw === 'string' ? raw.trim() : ''
  }
  const ownOpacityById = new Map<string, number>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n.id || '').trim()
    if (!id) continue
    const props = (n.properties || {}) as Record<string, JSONValue>
    const own = (() => {
      const fromVisual = typeof props['visual:opacity'] === 'number' && Number.isFinite(props['visual:opacity']) ? (props['visual:opacity'] as number) : null
      const fromCss = readCssNumber(props, 'css:opacity')
      const v = fromVisual ?? fromCss ?? 1
      if (v < 0) return 0
      if (v > 1) return 1
      return v
    })()
    ownOpacityById.set(id, own)
  }
  const effectiveOpacityById = new Map<string, number>()
  const computeEffectiveOpacity = (id: string): number => {
    const cached = effectiveOpacityById.get(id)
    if (cached != null) return cached
    const seen = new Set<string>()
    let cur = id
    let o = 1
    let steps = 0
    while (cur && steps < 32) {
      if (seen.has(cur)) break
      seen.add(cur)
      o *= ownOpacityById.get(cur) ?? 1
      const pid = pidById.get(cur) || ''
      if (!pid) break
      cur = pid
      steps += 1
    }
    const out = Math.max(0, Math.min(1, o))
    effectiveOpacityById.set(id, out)
    return out
  }
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n.id || '').trim()
    if (!id) continue
    const props = (n.properties || {}) as Record<string, JSONValue>
    const eff = computeEffectiveOpacity(id)
    props['visual:opacity'] = eff as unknown as JSONValue
  }

  const formatZPart = (n: number): string => {
    const z = Number.isFinite(n) ? Math.max(-999_999, Math.min(999_999, Math.floor(n))) : 0
    const sign = z < 0 ? '-' : '+'
    const abs = Math.abs(z).toString().padStart(6, '0')
    return `${sign}${abs}`
  }
  const createsStackContext = (id: string, props: Record<string, JSONValue>): boolean => {
    const position = readCssString(props, 'css:position').toLowerCase()
    const zIndexRaw = readCssString(props, 'css:zIndex')
    const zIndexNum = zIndexRaw && zIndexRaw !== 'auto' ? Number(zIndexRaw) : Number.NaN
    if (position && position !== 'static' && Number.isFinite(zIndexNum)) return true
    const ownOpacity = ownOpacityById.get(id) ?? null
    if (ownOpacity != null && ownOpacity < 1) return true
    const transform = readCssString(props, 'css:transform')
    if (transform && transform.toLowerCase() !== 'none') return true
    const filter = readCssString(props, 'css:filter')
    if (filter && filter.toLowerCase() !== 'none') return true
    const isolation = readCssString(props, 'css:isolation').toLowerCase()
    if (isolation === 'isolate') return true
    const willChange = readCssString(props, 'css:willChange').toLowerCase()
    if (willChange && (willChange.includes('transform') || willChange.includes('opacity') || willChange.includes('filter'))) return true
    return false
  }
  const stackKeyById = new Map<string, string>()
  const computeStackKey = (id: string): string => {
    const cached = stackKeyById.get(id)
    if (cached != null) return cached
    const chain: string[] = []
    const seen = new Set<string>()
    let cur = id
    let steps = 0
    while (cur && steps < 64) {
      if (seen.has(cur)) break
      seen.add(cur)
      chain.push(cur)
      const pid = pidById.get(cur) || ''
      if (!pid) break
      cur = pid
      steps += 1
    }
    chain.reverse()
    const parts: string[] = []
    for (let i = 0; i < chain.length; i += 1) {
      const n = nodeById.get(chain[i]!)
      if (!n) continue
      const nid = String(n.id || '').trim()
      if (!nid) continue
      const props = (n.properties || {}) as Record<string, JSONValue>
      if (!createsStackContext(nid, props)) continue
      const zRaw = readCssString(props, 'css:zIndex')
      const z = zRaw && zRaw !== 'auto' ? Number(zRaw) : 0
      parts.push(`z${formatZPart(Number.isFinite(z) ? z : 0)}`)
    }
    if (parts.length === 0) parts.push(`z${formatZPart(0)}`)
    const idx = indexById.get(id) ?? 0
    parts.push(`i${String(Math.max(0, Math.min(9_999_999, idx))).padStart(7, '0')}`)
    const out = parts.join('.')
    stackKeyById.set(id, out)
    return out
  }
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n.id || '').trim()
    if (!id) continue
    const props = (n.properties || {}) as Record<string, JSONValue>
    props['css:stackKey'] = computeStackKey(id) as unknown as JSONValue
    const zRaw = readCssString(props, 'css:zIndex')
    const z = zRaw && zRaw !== 'auto' ? Number(zRaw) : 0
    if (Number.isFinite(z)) props['visual:zIndex'] = Math.floor(z) as unknown as JSONValue
  }

  const childrenByPid = new Map<string, string[]>()
  pidById.forEach((pid, id) => {
    const arr = childrenByPid.get(pid) || []
    arr.push(id)
    childrenByPid.set(pid, arr)
  })
  const assignChildGridIndices = (childIds: string[]) => {
    const items = childIds
      .map(id => {
        const r = rectById.get(id)
        return r ? { id, cx: r.cx, cy: r.cy, w: r.w, h: r.h } : null
      })
      .filter(Boolean) as Array<{ id: string; cx: number; cy: number; w: number; h: number }>
    if (items.length < 2) return
    items.sort((a, b) => a.cy - b.cy || a.cx - b.cx || a.id.localeCompare(b.id))
    const heights = items.map(i => i.h).filter(h => Number.isFinite(h) && h > 0).sort((a, b) => a - b)
    const medianH = heights.length ? heights[Math.floor(heights.length / 2)]! : 24
    const rowThreshold = Math.max(10, Math.min(140, medianH * 0.65))
    let row = 0
    let rowCy = items[0]!.cy
    let rowItems: Array<{ id: string; cx: number }> = []
    const flush = () => {
      rowItems.sort((a, b) => a.cx - b.cx || a.id.localeCompare(b.id))
      for (let col = 0; col < rowItems.length; col += 1) {
        const id = rowItems[col]!.id
        const n = nodeById.get(id)
        if (!n) continue
        const props = (n.properties || {}) as Record<string, JSONValue>
        props['visual:yIndex'] = row as unknown as JSONValue
        props['visual:xIndex'] = col as unknown as JSONValue
      }
      rowItems = []
    }
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i]!
      if (it.cy - rowCy > rowThreshold && rowItems.length > 0) {
        flush()
        row += 1
        rowCy = it.cy
      } else {
        rowCy = (rowCy * 0.7) + (it.cy * 0.3)
      }
      rowItems.push({ id: it.id, cx: it.cx })
    }
    flush()
  }
  childrenByPid.forEach((childIds, pid) => {
    const parent = nodeById.get(pid)
    if (!parent) return
    const props = (parent.properties || {}) as Record<string, JSONValue>
    const layoutKind = readCssString(props, 'layout:kind').toLowerCase()
    const display = readCssString(props, 'css:display').toLowerCase()
    const isGrid = layoutKind === 'grid' || display === 'grid' || display === 'inline-grid'
    const isFlex = layoutKind.startsWith('flex') || display === 'flex' || display === 'inline-flex'
    if (!isGrid && !isFlex) return
    assignChildGridIndices(childIds)
  })

  const edges = (() => {
    const out: GraphEdge[] = []
    for (let i = 0; i < pruned.length; i += 1) {
      const el = pruned[i]
      const id = safeStr(el.id)
      const pid = safeStr(el.pid)
      if (!id || !pid) continue
      if (!keptIds.has(pid)) continue
      out.push({
        id: `dom:${pid}->${id}`,
        source: pid,
        target: id,
        label: 'contains',
        type: 'dom',
        properties: {},
      })
    }
    return out
  })()

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
    edges,
    metadata,
  }
}
