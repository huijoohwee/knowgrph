import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'

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
  if (/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(\.0+)?\s*\)$/.test(s)) return true
  if (/^hsla\([\s\S]*,\s*0(\.0+)?\s*\)$/.test(s)) return true
  return false
}

const safeStr = (v: unknown): string => String(v ?? '').trim()

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
  return t === 'IMG' || t === 'SVG' || t === 'VIDEO' || t === 'CANVAS' || t === 'IFRAME'
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

const scoreElementForPrune = (el: WebpageLayoutElement, preserveClassRe: RegExp): number => {
  const tag = safeStr(el.tag).toUpperCase()
  if (isInteractiveTag(tag) || isMediaTag(tag)) return 1000
  let s = 0
  const text = safeStr(el.text)
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
    /(hero|card|feature|tile|pricing|testimonial|reviews?|faq|accordion|banner|cta|navbar|header|footer|modal|dialog|drawer|popover|tooltip|toast|sidebar)/i

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

  return Array.from(byId.values())
}

const pruneSmallNoisyLeaves = (kept: WebpageLayoutElement[]): WebpageLayoutElement[] => {
  const preserveClassRe =
    /(hero|card|feature|tile|pricing|testimonial|reviews?|faq|accordion|banner|cta|navbar|header|footer|modal|dialog|drawer|popover|tooltip|toast|sidebar)/i
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

  const LEAF_MIN_AREA = 2200
  const LEAF_MIN_DIM = 24

  for (const el of byId.values()) {
    const id = safeStr(el.id)
    if (!id) continue
    if ((childCountById.get(id) || 0) > 0) continue
    const tag = safeStr(el.tag).toUpperCase()
    if (tag !== 'DIV' && tag !== 'SPAN') continue
    if (isInteractiveTag(tag) || isMediaTag(tag)) continue
    if (safeStr(el.text)) continue
    if (hasVisualDecoration(el)) continue
    const cls = safeStr(el.attrs?.class)
    if (cls && preserveClassRe.test(cls)) continue
    const role = safeStr(el.attrs?.role)
    const aria = safeStr(el.attrs?.ariaLabel)
    const domId = safeStr(el.attrs?.id)
    if (role || aria || domId) continue

    const w = safeNum(el.rect?.w, 0)
    const h = safeNum(el.rect?.h, 0)
    const area = w * h
    const minDim = Math.min(w, h)
    if (area < LEAF_MIN_AREA || minDim < LEAF_MIN_DIM) {
      byId.delete(id)
    }
  }

  return Array.from(byId.values())
}

const pruneWrapperElements = (kept: WebpageLayoutElement[]): WebpageLayoutElement[] => {
  const preserveClassRe =
    /(hero|card|feature|tile|pricing|testimonial|reviews?|faq|accordion|banner|cta|navbar|header|footer|modal|dialog|drawer|popover|tooltip|toast|sidebar)/i
  const glueClassRe =
    /(container|wrapper|inner|content|stack|row|col|columns|layout|shell|page|grid|flex|mx-|my-|px-|py-|gap-|space-|w-|h-|max-w-|min-h-)/i

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
      if (!isWrapperTag(tag)) continue
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
    const CHILD_COUNT_THRESHOLD = 6
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
        const kids = childrenById.get(id) || []
        if (kids.length < CHILD_COUNT_THRESHOLD) continue
        if (!(glueClassRe.test(cls) || looksUtilityHeavy(cls))) continue

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
        if (childIds.length < CHILD_COUNT_THRESHOLD) continue
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

  if (isMediaTag(tag)) return true
  if (isInteractiveTag(tag)) return true
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

  let pruned = enforceGeometricNesting(pruneSmallNoisyLeaves(pruneOverlappedSiblings(pruneWrapperElements(kept))))
  if (pruned.length === 0 && kept.length > 0) {
    pruned = enforceGeometricNesting(kept.slice(0, Math.max(100, Math.min(maxNodes, 1200))))
  }

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
    const text = safeStr(el.text)
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
    const kind = isMediaTag(tag) ? 'media' : isInteractiveTag(tag) ? 'interactive' : isContainerTag(tag) ? 'container' : 'element'
    properties['dom:kind'] = kind as unknown as JSONValue
    if (css) {
      const display = String(css.display || '').trim()
      const position = String(css.position || '').trim()
      const zIndex = String(css.zIndex || '').trim()
      const backgroundColor = String(css.backgroundColor || '').trim()
      const color = String(css.color || '').trim()
      const borderRadiusCss = String(css.borderRadius || '').trim()
      const borderColorCss = String(css.borderColor || '').trim()
      const borderWidthCss = String(css.borderWidth || '').trim()
      const paddingCss = String((css as Record<string, unknown>).padding || '').trim()
      const marginCss = String((css as Record<string, unknown>).margin || '').trim()
      const gapCss = String((css as Record<string, unknown>).gap || '').trim()
      const justifyContentCss = String((css as Record<string, unknown>).justifyContent || '').trim()
      const alignItemsCss = String((css as Record<string, unknown>).alignItems || '').trim()
      const flexDirectionCss = String((css as Record<string, unknown>).flexDirection || '').trim()
      const flexWrapCss = String((css as Record<string, unknown>).flexWrap || '').trim()
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
      if (backgroundColor) properties['css:backgroundColor'] = backgroundColor as unknown as JSONValue
      if (color) properties['css:color'] = color as unknown as JSONValue
      if (borderRadiusCss) properties['css:borderRadius'] = borderRadiusCss as unknown as JSONValue
      if (borderColorCss) properties['css:borderColor'] = borderColorCss as unknown as JSONValue
      if (borderWidthCss) properties['css:borderWidth'] = borderWidthCss as unknown as JSONValue
      if (paddingCss) properties['css:padding'] = paddingCss as unknown as JSONValue
      if (marginCss) properties['css:margin'] = marginCss as unknown as JSONValue
      if (gapCss) properties['css:gap'] = gapCss as unknown as JSONValue
      if (justifyContentCss) properties['css:justifyContent'] = justifyContentCss as unknown as JSONValue
      if (alignItemsCss) properties['css:alignItems'] = alignItemsCss as unknown as JSONValue
      if (flexDirectionCss) properties['css:flexDirection'] = flexDirectionCss as unknown as JSONValue
      if (flexWrapCss) properties['css:flexWrap'] = flexWrapCss as unknown as JSONValue
      if (fontSize) properties['css:fontSize'] = fontSize as unknown as JSONValue
      if (fontWeight) properties['css:fontWeight'] = fontWeight as unknown as JSONValue
      if (fontFamilyCss) properties['css:fontFamily'] = fontFamilyCss as unknown as JSONValue
      if (lineHeight) properties['css:lineHeight'] = lineHeight as unknown as JSONValue
      if (letterSpacingCss) properties['css:letterSpacing'] = letterSpacingCss as unknown as JSONValue
      if (textTransformCss) properties['css:textTransform'] = textTransformCss as unknown as JSONValue
      if (textAlignCss) properties['css:textAlign'] = textAlignCss as unknown as JSONValue
      if (boxShadowCss) properties['css:boxShadow'] = boxShadowCss as unknown as JSONValue
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
