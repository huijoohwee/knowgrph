import React from 'react'
import { buildCodebaseAssetUrlForRelPath, buildFsUrlForRelPath } from '@/features/panels/hooks/markdownPipelineActions'
import { normalizeGitHubBlobLikeUrl, applyMediaProxySrc as applyMediaProxySrcCore } from '@/lib/url'
import { uiPrimaryLinkClassName } from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles'
import { coerceCodebaseRelPath } from '@/lib/codebase/relPath'
import { parseAsciiBoxTable } from './codeblock/asciiBoxTable'
import {
  buildYouTubeEmbedUrl as buildYouTubeEmbedUrlShared,
  getTwitterStatusId as getTwitterStatusIdShared,
  getVimeoId as getVimeoIdShared,
  getYouTubeId as getYouTubeIdShared,
} from 'grph-shared/rich-media/providers'
import {
  extractHtmlAttr,
  looksLikeSingleTagBlock as looksLikeSingleTagBlockShared,
  parseHtmlNumberAttr as parseHtmlNumberAttrShared,
  pickFirstSrcsetUrl as pickFirstSrcsetUrlShared,
} from 'grph-shared/markdown/mediaHtml'

const SANITIZED_SRCDOC_CACHE = new Map<string, string>()
const SANITIZED_SRCDOC_CACHE_MAX = 32

const hash32 = (s: string): string => {
  const str = String(s || '')
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

const sanitizeSrcDocCached = (srcDoc: string): string => {
  const clipped = srcDoc.length > 50_000 ? srcDoc.slice(0, 50_000) : srcDoc
  const key = `${clipped.length}:${hash32(clipped)}`
  const cached = SANITIZED_SRCDOC_CACHE.get(key)
  if (cached) return cached
  const sanitized = (() => {
    try {
      const parser = new DOMParser()
      const d = parser.parseFromString(String(clipped || ''), 'text/html')
      const root = d.documentElement
      const all = root ? root.querySelectorAll('*') : []
      for (const node of Array.from(all)) {
        const tagName = node.tagName.toLowerCase()
        if (tagName === 'script') {
          node.remove()
          continue
        }
        for (const name of node.getAttributeNames()) {
          if (name.toLowerCase().startsWith('on')) node.removeAttribute(name)
        }
      }
      const out = d.documentElement?.outerHTML || clipped
      return out.length > 50_000 ? out.slice(0, 50_000) : out
    } catch {
      return clipped
    }
  })()
  SANITIZED_SRCDOC_CACHE.set(key, sanitized)
  if (SANITIZED_SRCDOC_CACHE.size > SANITIZED_SRCDOC_CACHE_MAX) {
    const oldest = SANITIZED_SRCDOC_CACHE.keys().next().value as string | undefined
    if (oldest) SANITIZED_SRCDOC_CACHE.delete(oldest)
  }
  return sanitized
}

export const buildAnchorAttrs = (
  href: string,
): { target?: string; rel?: string; className: string } => {
  const isHash = String(href || '').startsWith('#')
  return {
    target: isHash ? undefined : '_blank',
    rel: isHash ? undefined : 'noreferrer',
    className: `${uiPrimaryLinkClassName} break-words`,
  }
}

const normalizeRelPath = (raw: string): string => {
  const input = String(raw || '').replace(/\\/g, '/')
  const parts = input.split('/').filter(Boolean)
  const out: string[] = []
  for (const part of parts) {
    if (part === '.') continue
    if (part === '..') {
      out.pop()
      continue
    }
    out.push(part)
  }
  return out.join('/')
}

const joinRelPaths = (baseDir: string, rel: string): string => {
  const a = String(baseDir || '').replace(/\\/g, '/').replace(/\/+$/, '')
  const b = String(rel || '').replace(/\\/g, '/')
  const combined = a ? `${a}/${b}` : b
  return normalizeRelPath(combined)
}

const SAFE_RELATIVE_PATH_RE = /^[a-zA-Z0-9._-]+(\/[a-zA-Z0-9._-]+)*(\.[a-zA-Z0-9]+)?([?#].*)?$/

export const isAbsoluteWebUrl = (href: string): boolean =>
  /^https?:\/\//i.test(href) || /^mailto:/i.test(href)

export const isSafeHref = (href: string): boolean => {
  const trimmed = String(href || '').trim()
  if (!trimmed) return false
  if (trimmed.startsWith('#')) return true
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(trimmed)) return true
  if (/^data:image\/svg\+xml;base64,/i.test(trimmed)) return true
  if (trimmed.startsWith('//')) return true
  if (trimmed.startsWith('/')) return true
  if (trimmed.startsWith('./') || trimmed.startsWith('../')) return true
  if (isAbsoluteWebUrl(trimmed)) return true
  return SAFE_RELATIVE_PATH_RE.test(trimmed)
}

export const isSafeMediaSrc = (href: string): boolean => {
  const trimmed = String(href || '').trim()
  if (!trimmed) return false
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(trimmed)) return true
  if (/^data:image\/svg\+xml;base64,/i.test(trimmed)) return true
  if (/^(javascript|data):/i.test(trimmed)) return false
  if (trimmed.startsWith('#')) return false
  if (/^mailto:/i.test(trimmed)) return false
  if (trimmed.startsWith('//')) return true
  if (trimmed.startsWith('/')) return true
  if (trimmed.startsWith('./') || trimmed.startsWith('../')) return true
  if (isAbsoluteWebUrl(trimmed)) return true
  return SAFE_RELATIVE_PATH_RE.test(trimmed)
}

export const applyMediaProxySrc = (src: string): string => applyMediaProxySrcCore(src)

export const resolveHref = (href: string, activeDocumentPath: string): string => {
  const raw = String(href || '').trim()
  if (!raw) return ''
  const normalizedHtmlEntities = raw
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&#x26;/gi, '&')
  const input = normalizedHtmlEntities
  if (/^data:image\//i.test(input)) return input
  if (raw.startsWith('#')) return raw
  if (input.startsWith('//')) return `https:${input}`
  if (input.startsWith('/__webpage_asset_proxy') || input.startsWith('/__fetch_remote')) {
    try {
      if (typeof window === 'undefined' || !window.location?.origin) return raw
      const u = new URL(input, window.location.origin)
      const innerUrl = u.searchParams.get('url')
      if (!innerUrl) return raw
      const normalizedInnerUrl = innerUrl
        .replace(/&amp;/g, '&')
        .replace(/&#38;/g, '&')
        .replace(/&#x26;/gi, '&')
      if (normalizedInnerUrl === innerUrl) return raw
      u.searchParams.set('url', normalizedInnerUrl)
      return `${u.pathname}?${u.searchParams.toString()}${u.hash || ''}`
    } catch {
      return raw
    }
  }
  if (input.startsWith('/__') || input.startsWith('/@')) return input
  if (isAbsoluteWebUrl(input)) {
    const normalizedAbs = normalizeGitHubBlobLikeUrl(input) ?? input
    try {
      if (typeof window !== 'undefined' && window.location?.origin) {
        const u = new URL(normalizedAbs)
        if (u.pathname.startsWith('/__webpage_asset_path/')) {
          return `${u.pathname}${u.search || ''}${u.hash || ''}`
        }
        if (u.pathname === '/__webpage_asset_proxy' || u.pathname === '/__fetch_remote') {
          const innerUrl = u.searchParams.get('url')
          if (innerUrl) {
            const normalizedInnerUrl = innerUrl
              .replace(/&amp;/g, '&')
              .replace(/&#38;/g, '&')
              .replace(/&#x26;/gi, '&')
            if (normalizedInnerUrl !== innerUrl) u.searchParams.set('url', normalizedInnerUrl)
          }
          return `${u.pathname}?${u.searchParams.toString()}${u.hash || ''}`
        }
      }
    } catch {
      void 0
    }
    return normalizedAbs
  }
  const baseRaw = String(activeDocumentPath || '').split('#')[0].trim()
  const basePath = isAbsoluteWebUrl(baseRaw) ? baseRaw : coerceCodebaseRelPath(baseRaw) || baseRaw
  if (basePath && isAbsoluteWebUrl(basePath)) {
    try {
      const resolved = new URL(input, basePath).toString()
      const normalized = normalizeGitHubBlobLikeUrl(resolved) ?? resolved
      return normalized
    } catch {
      return input
    }
  }
  const baseDir = basePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/')
  const asRel = input.startsWith('/') ? input.replace(/^\/+/, '') : joinRelPaths(baseDir, input)
  const codebaseUrl = buildCodebaseAssetUrlForRelPath(asRel)
  const fsUrl = buildFsUrlForRelPath(asRel)
  return codebaseUrl || fsUrl || input
}

export const getYouTubeId = (href: string): string | null => getYouTubeIdShared(href)

export const buildYouTubeEmbedUrl = (href: string): string | null => {
  const origin = (() => {
    try {
      return typeof window !== 'undefined' && window.location?.origin ? window.location.origin : null
    } catch {
      return null
    }
  })()
  return buildYouTubeEmbedUrlShared(href, { noCookie: true, includeOrigin: true, origin })
}

export const getTwitterStatusId = (href: string): string | null => getTwitterStatusIdShared(href)

export const getVimeoId = (href: string): string | null => getVimeoIdShared(href)

export const isVideoUrl = (href: string): boolean =>
  /\.(mp4|webm|ogg)(\?|#|$)/i.test(href)

export const looksLikeSingleTagBlock = looksLikeSingleTagBlockShared
export const extractAttr = extractHtmlAttr
export const pickFirstSrcsetUrl = pickFirstSrcsetUrlShared
export const parseHtmlNumberAttr = parseHtmlNumberAttrShared

const sanitizeHtmlClassName = (raw: string): string => {
  const value = String(raw || '').trim()
  if (!value) return ''
  const safe = value.replace(/[^]a-zA-Z0-9 _:[/[\].%-]/g, ' ').replace(/\s+/g, ' ').trim()
  return safe
}

const filterHtmlPreviewClassName = (raw: string): string => {
  const safe = sanitizeHtmlClassName(raw)
  if (!safe) return ''
  const out: string[] = []
  const hidden = new Set([
    'hidden',
    'invisible',
    'sr-only',
    'opacity-0',
    'text-transparent',
    'pointer-events-none',
    'select-none',
  ])
  const layoutHazards = new Set([
    'absolute',
    'fixed',
    'sticky',
  ])
  const allowedTextUtilities = new Set([
    'text-left',
    'text-right',
    'text-center',
    'text-justify',
    'text-start',
    'text-end',
    'text-xs',
    'text-sm',
    'text-base',
    'text-lg',
    'text-xl',
    'text-2xl',
    'text-3xl',
    'text-4xl',
    'text-5xl',
    'text-6xl',
    'text-7xl',
    'text-8xl',
    'text-9xl',
    'text-wrap',
    'text-nowrap',
    'text-balance',
    'text-pretty',
    'text-ellipsis',
    'text-clip',
  ])
  for (const token of safe.split(/\s+/).filter(Boolean)) {
    const parts = token.split(':').filter(Boolean)
    const util = parts.length ? parts[parts.length - 1] : token
    if (hidden.has(util)) continue
    if (layoutHazards.has(util)) continue
    if (/^z-\d+$/.test(util)) continue
    if (/^(?:inset|top|right|bottom|left)-0$/.test(util)) continue
    if (/^(?:w|h|min-w|min-h|max-w|max-h)-0$/.test(util)) continue
    if (util.startsWith('text-') && !allowedTextUtilities.has(util)) continue
    if (util.startsWith('bg-') && util !== 'bg-transparent') continue
    if (util.startsWith('from-') || util.startsWith('to-') || util.startsWith('via-')) continue
    if (util.startsWith('fill-') || util.startsWith('stroke-')) continue
    out.push(token)
  }
  return out.join(' ')
}

const SAFE_HTML_ID_RE = /^[A-Za-z0-9^][A-Za-z0-9^:._-]*$/

const sanitizeHtmlId = (raw: string): string => {
  const value = String(raw || '').trim()
  if (!value) return ''
  const clipped = value.length > 256 ? value.slice(0, 256) : value
  if (!SAFE_HTML_ID_RE.test(clipped)) return ''
  return clipped
}

const SAFE_INLINE_STYLE_VALUE_RE = /^[a-zA-Z0-9\s().,%:/_+-]+$/

export const parseSafeInlineStyle = (raw: string): React.CSSProperties | undefined => {
  const input = String(raw || '').trim()
  if (!input) return undefined
  if (input.length > 400) return undefined
  if (/url\s*\(|expression\s*\(|@import/i.test(input)) return undefined
  const out: Record<string, string> = {}
  const allowed: Record<string, string> = {
    display: 'display',
    gap: 'gap',
    'row-gap': 'rowGap',
    'column-gap': 'columnGap',
    'table-layout': 'tableLayout',
    'border-collapse': 'borderCollapse',
    'border-spacing': 'borderSpacing',
    'grid-template-columns': 'gridTemplateColumns',
    'grid-template-rows': 'gridTemplateRows',
    'grid-auto-flow': 'gridAutoFlow',
    'grid-auto-columns': 'gridAutoColumns',
    'grid-auto-rows': 'gridAutoRows',
    'grid-column': 'gridColumn',
    'grid-row': 'gridRow',
    'column-count': 'columnCount',
    'column-width': 'columnWidth',
    'justify-items': 'justifyItems',
    'align-items': 'alignItems',
    'justify-content': 'justifyContent',
    'align-content': 'alignContent',
    'flex-direction': 'flexDirection',
    'flex-wrap': 'flexWrap',
    flex: 'flex',
    'flex-basis': 'flexBasis',
    'flex-grow': 'flexGrow',
    'flex-shrink': 'flexShrink',
    'min-width': 'minWidth',
    'min-height': 'minHeight',
    width: 'width',
    height: 'height',
    'max-width': 'maxWidth',
    'max-height': 'maxHeight',
    'aspect-ratio': 'aspectRatio',
  }
  const coerceValue = (value: string): string | null => {
    const v = value.replace(/\s*!important\s*$/i, '').trim()
    if (!v) return null
    if (v.length > 200) return null
    if (!SAFE_INLINE_STYLE_VALUE_RE.test(v)) return null
    const lower = v.toLowerCase()
    if (/javascript:|data:/.test(lower)) return null
    return v
  }
  for (const chunk of input.split(';')) {
    const part = chunk.trim()
    if (!part) continue
    const idx = part.indexOf(':')
    if (idx <= 0) continue
    const name = part.slice(0, idx).trim().toLowerCase()
    const value = part.slice(idx + 1).trim()
    const prop = allowed[name]
    if (!prop) continue
    const safeValue = coerceValue(value)
    if (!safeValue) continue
    if (name === 'display') {
      const d = safeValue.toLowerCase()
      if (
        d !== 'grid' &&
        d !== 'inline-grid' &&
        d !== 'flex' &&
        d !== 'inline-flex' &&
        d !== 'block' &&
        d !== 'inline-block' &&
        d !== 'table' &&
        d !== 'inline-table' &&
        d !== 'table-row' &&
        d !== 'table-cell' &&
        d !== 'table-row-group' &&
        d !== 'table-header-group' &&
        d !== 'table-footer-group' &&
        d !== 'table-column' &&
        d !== 'table-column-group' &&
        d !== 'table-caption'
      ) {
        continue
      }
      out[prop] = d
      continue
    }
    if (name === 'grid-auto-flow') {
      const v = safeValue.toLowerCase()
      if (v !== 'row' && v !== 'column' && v !== 'dense' && v !== 'row dense' && v !== 'column dense') continue
      out[prop] = v
      continue
    }
    if (name === 'table-layout') {
      const v = safeValue.toLowerCase()
      if (v !== 'auto' && v !== 'fixed') continue
      out[prop] = v
      continue
    }
    if (name === 'border-collapse') {
      const v = safeValue.toLowerCase()
      if (v !== 'collapse' && v !== 'separate') continue
      out[prop] = v
      continue
    }
    if (name === 'column-count') {
      const n = Number.parseInt(safeValue, 10)
      if (!Number.isFinite(n) || n < 1 || n > 6) continue
      out[prop] = String(n)
      continue
    }
    if (name === 'flex-grow' || name === 'flex-shrink') {
      const n = Number.parseFloat(safeValue)
      if (!Number.isFinite(n) || n < 0 || n > 10) continue
      out[prop] = String(n)
      continue
    }
    out[prop] = safeValue
  }
  return Object.keys(out).length ? (out as unknown as React.CSSProperties) : undefined
}

export const deriveSafeLayoutStyleFromClassAttr = (rawClass: string): React.CSSProperties | undefined => {
  const input = String(rawClass || '').trim()
  if (!input) return undefined
  const tokens = input.split(/\s+/).filter(Boolean)
  if (!tokens.length) return undefined

  const bpRank: Record<string, number> = { '': 0, sm: 1, md: 2, lg: 3, xl: 4, '2xl': 5 }
  const pickBreakpoint = (full: string): { bp: string; util: string } => {
    const parts = full.split(':').filter(Boolean)
    if (parts.length <= 1) return { bp: '', util: full }
    const util = parts[parts.length - 1] || ''
    for (let i = parts.length - 2; i >= 0; i -= 1) {
      const p = parts[i] || ''
      if (p in bpRank) return { bp: p, util }
    }
    return { bp: '', util }
  }

  const best = <T,>(current: { rank: number; value: T } | null, rank: number, value: T) => {
    if (!current) return { rank, value }
    if (rank >= current.rank) return { rank, value }
    return current
  }

  let display: { rank: number; value: string } | null = null
  let tableLayout: { rank: number; value: string } | null = null
  let borderCollapse: { rank: number; value: string } | null = null
  let gridCols: { rank: number; value: number } | null = null
  let gridRows: { rank: number; value: number } | null = null
  let gap: { rank: number; value: number } | null = null
  let gapX: { rank: number; value: number } | null = null
  let gapY: { rank: number; value: number } | null = null
  let columns: { rank: number; value: number } | null = null
  let flexDir: { rank: number; value: string } | null = null
  let flexWrap: { rank: number; value: string } | null = null
  let alignItems: { rank: number; value: string } | null = null
  let justifyItems: { rank: number; value: string } | null = null
  let justifyContent: { rank: number; value: string } | null = null
  let alignContent: { rank: number; value: string } | null = null
  let gridAutoFlow: { rank: number; value: string } | null = null
  let gridAutoRows: { rank: number; value: string } | null = null
  let gridAutoCols: { rank: number; value: string } | null = null
  let colSpan: { rank: number; value: number } | null = null
  let rowSpan: { rank: number; value: number } | null = null
  let colStart: { rank: number; value: number } | null = null
  let colEnd: { rank: number; value: number } | null = null
  let rowStart: { rank: number; value: number } | null = null
  let rowEnd: { rank: number; value: number } | null = null
  let gridColsArb: { rank: number; value: string } | null = null
  let gridRowsArb: { rank: number; value: string } | null = null
  let gapArb: { rank: number; value: string } | null = null
  let gapXArb: { rank: number; value: string } | null = null
  let gapYArb: { rank: number; value: string } | null = null
  let gridAutoRowsArb: { rank: number; value: string } | null = null
  let gridAutoColsArb: { rank: number; value: string } | null = null
  let width: { rank: number; value: string } | null = null
  let height: { rank: number; value: string } | null = null
  let minWidth: { rank: number; value: string } | null = null
  let minHeight: { rank: number; value: string } | null = null
  let maxWidth: { rank: number; value: string } | null = null
  let maxHeight: { rank: number; value: string } | null = null
  let aspectRatio: { rank: number; value: string } | null = null
  let colSpanFull: { rank: number; value: true } | null = null
  let rowSpanFull: { rank: number; value: true } | null = null
  let flex: { rank: number; value: string } | null = null
  let padT: { rank: number; value: string } | null = null
  let padR: { rank: number; value: string } | null = null
  let padB: { rank: number; value: string } | null = null
  let padL: { rank: number; value: string } | null = null
  let marT: { rank: number; value: string } | null = null
  let marR: { rank: number; value: string } | null = null
  let marB: { rank: number; value: string } | null = null
  let marL: { rank: number; value: string } | null = null
  let borderWidth: { rank: number; value: string } | null = null
  let borderColor: { rank: number; value: string } | null = null
  let borderRadius: { rank: number; value: string } | null = null
  let boxShadow: { rank: number; value: string } | null = null
  let overflow: { rank: number; value: string } | null = null
  let overflowX: { rank: number; value: string } | null = null
  let overflowY: { rank: number; value: string } | null = null

  const parseTailwindSpace = (raw: string): number | null => {
    const s = String(raw || '').trim()
    if (!s) return null
    const n = Number.parseFloat(s)
    if (!Number.isFinite(n) || n < 0 || n > 64) return null
    return n * 0.25
  }

  const parseTailwindArbitraryValue = (raw: string): string | null => {
    const input = String(raw || '').trim()
    if (!input) return null
    if (input.length > 160) return null
    const decoded = input.replace(/_/g, ' ').trim()
    if (!decoded) return null
    if (/url\s*\(|expression\s*\(|@import/i.test(decoded)) return null
    if (!SAFE_INLINE_STYLE_VALUE_RE.test(decoded)) return null
    const lower = decoded.toLowerCase()
    if (/javascript:|data:/.test(lower)) return null
    return decoded
  }

  const parseSafeGridLine = (raw: string): number | null => {
    const s = String(raw || '').trim()
    if (!s) return null
    const n = Number.parseInt(s, 10)
    if (!Number.isFinite(n)) return null
    const v = Math.floor(n)
    if (v < -1 || v > 48 || v === 0) return null
    return v
  }

  const toRem = (n: number): string => `${n}rem`
  const activeRank = (() => {
    try {
      const w = (globalThis as unknown as { window?: Window }).window
      const hinted = w && typeof (w as unknown as { __kgMarkdownViewerWidthPx?: unknown }).__kgMarkdownViewerWidthPx === 'number'
        ? Number((w as unknown as { __kgMarkdownViewerWidthPx?: unknown }).__kgMarkdownViewerWidthPx)
        : NaN
      const raw = Number.isFinite(hinted) && hinted > 0 ? hinted : w && typeof w.innerWidth === 'number' ? w.innerWidth : NaN
      const width = Number.isFinite(raw) && raw > 0 ? raw : 1024
      if (width >= 1536) return 5
      if (width >= 1280) return 4
      if (width >= 1024) return 3
      if (width >= 768) return 2
      if (width >= 640) return 1
      return 0
    } catch {
      return 3
    }
  })()

  for (const token of tokens) {
    const { bp, util } = pickBreakpoint(token)
    const rank = bpRank[bp] ?? 0
    if (rank > activeRank) continue
    const u = util.trim()
    if (!u) continue

    if (u === 'grid' || u === 'inline-grid') {
      display = best(display, rank, u === 'grid' ? 'grid' : 'inline-grid')
      continue
    }
    if (u === 'flex' || u === 'inline-flex') {
      display = best(display, rank, u === 'flex' ? 'flex' : 'inline-flex')
      continue
    }
    if (u === 'flex-1') {
      flex = best(flex, rank, '1 1 0%')
      continue
    }
    if (u === 'flex-auto') {
      flex = best(flex, rank, '1 1 auto')
      continue
    }
    if (u === 'flex-initial') {
      flex = best(flex, rank, '0 1 auto')
      continue
    }
    if (u === 'flex-none') {
      flex = best(flex, rank, 'none')
      continue
    }
    if (u === 'overflow-hidden' || u === 'overflow-auto' || u === 'overflow-scroll' || u === 'overflow-visible') {
      overflow = best(overflow, rank, u === 'overflow-hidden' ? 'hidden' : u === 'overflow-auto' ? 'auto' : u === 'overflow-scroll' ? 'scroll' : 'visible')
      continue
    }
    if (u === 'overflow-x-hidden' || u === 'overflow-x-auto' || u === 'overflow-x-scroll' || u === 'overflow-x-visible') {
      overflowX = best(
        overflowX,
        rank,
        u === 'overflow-x-hidden' ? 'hidden' : u === 'overflow-x-auto' ? 'auto' : u === 'overflow-x-scroll' ? 'scroll' : 'visible',
      )
      continue
    }
    if (u === 'overflow-y-hidden' || u === 'overflow-y-auto' || u === 'overflow-y-scroll' || u === 'overflow-y-visible') {
      overflowY = best(
        overflowY,
        rank,
        u === 'overflow-y-hidden' ? 'hidden' : u === 'overflow-y-auto' ? 'auto' : u === 'overflow-y-scroll' ? 'scroll' : 'visible',
      )
      continue
    }
    if (u === 'border') {
      borderWidth = best(borderWidth, rank, '1px')
      continue
    }
    if (u === 'border-0') {
      borderWidth = best(borderWidth, rank, '0px')
      continue
    }
    if (u === 'border-border') {
      borderColor = best(borderColor, rank, 'hsl(var(--border))')
      continue
    }
    if (u === 'rounded-full') {
      borderRadius = best(borderRadius, rank, '9999px')
      continue
    }
    if (u === 'rounded-none') {
      borderRadius = best(borderRadius, rank, '0px')
      continue
    }
    if (u === 'rounded-sm') {
      borderRadius = best(borderRadius, rank, '0.125rem')
      continue
    }
    if (u === 'rounded') {
      borderRadius = best(borderRadius, rank, '0.25rem')
      continue
    }
    if (u === 'rounded-md') {
      borderRadius = best(borderRadius, rank, '0.375rem')
      continue
    }
    if (u === 'rounded-lg') {
      borderRadius = best(borderRadius, rank, '0.5rem')
      continue
    }
    if (u === 'rounded-xl') {
      borderRadius = best(borderRadius, rank, '0.75rem')
      continue
    }
    if (u === 'rounded-2xl') {
      borderRadius = best(borderRadius, rank, '1rem')
      continue
    }
    if (u === 'rounded-3xl') {
      borderRadius = best(borderRadius, rank, '1.5rem')
      continue
    }
    if (u === 'shadow-none') {
      boxShadow = best(boxShadow, rank, 'none')
      continue
    }
    if (u === 'shadow-sm') {
      boxShadow = best(boxShadow, rank, '0 1px 2px 0 rgba(0,0,0,0.05)')
      continue
    }
    if (u === 'shadow') {
      boxShadow = best(boxShadow, rank, '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)')
      continue
    }
    if (u === 'shadow-md') {
      boxShadow = best(boxShadow, rank, '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)')
      continue
    }
    if (u === 'shadow-lg') {
      boxShadow = best(boxShadow, rank, '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)')
      continue
    }
    if (u === 'shadow-xl') {
      boxShadow = best(boxShadow, rank, '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)')
      continue
    }
    if (u === 'shadow-2xl') {
      boxShadow = best(boxShadow, rank, '0 25px 50px -12px rgba(0,0,0,0.25)')
      continue
    }
    if (u === 'shadow-elevation-1') {
      boxShadow = best(boxShadow, rank, '0 1px 2px 0 rgba(0,0,0,0.08), 0 1px 1px 0 rgba(0,0,0,0.04)')
      continue
    }
    if (
      u === 'table' ||
      u === 'inline-table' ||
      u === 'table-row' ||
      u === 'table-cell' ||
      u === 'table-row-group' ||
      u === 'table-header-group' ||
      u === 'table-footer-group' ||
      u === 'table-column' ||
      u === 'table-column-group' ||
      u === 'table-caption'
    ) {
      display = best(display, rank, u)
      continue
    }

    const mPad = u.match(/^p(?:-(\d+(?:\.\d+)?))$/)
    if (mPad) {
      const v = parseTailwindSpace(mPad[1] || '')
      if (v != null) {
        const s = toRem(v)
        padT = best(padT, rank, s)
        padR = best(padR, rank, s)
        padB = best(padB, rank, s)
        padL = best(padL, rank, s)
      }
      continue
    }
    const mPx = u.match(/^px-(\d+(?:\.\d+)?)$/)
    if (mPx) {
      const v = parseTailwindSpace(mPx[1] || '')
      if (v != null) {
        const s = toRem(v)
        padL = best(padL, rank, s)
        padR = best(padR, rank, s)
      }
      continue
    }
    const mPy = u.match(/^py-(\d+(?:\.\d+)?)$/)
    if (mPy) {
      const v = parseTailwindSpace(mPy[1] || '')
      if (v != null) {
        const s = toRem(v)
        padT = best(padT, rank, s)
        padB = best(padB, rank, s)
      }
      continue
    }
    const mPt = u.match(/^pt-(\d+(?:\.\d+)?)$/)
    if (mPt) {
      const v = parseTailwindSpace(mPt[1] || '')
      if (v != null) padT = best(padT, rank, toRem(v))
      continue
    }
    const mPr = u.match(/^pr-(\d+(?:\.\d+)?)$/)
    if (mPr) {
      const v = parseTailwindSpace(mPr[1] || '')
      if (v != null) padR = best(padR, rank, toRem(v))
      continue
    }
    const mPb = u.match(/^pb-(\d+(?:\.\d+)?)$/)
    if (mPb) {
      const v = parseTailwindSpace(mPb[1] || '')
      if (v != null) padB = best(padB, rank, toRem(v))
      continue
    }
    const mPl = u.match(/^pl-(\d+(?:\.\d+)?)$/)
    if (mPl) {
      const v = parseTailwindSpace(mPl[1] || '')
      if (v != null) padL = best(padL, rank, toRem(v))
      continue
    }
    const mMar = u.match(/^m(?:-(\d+(?:\.\d+)?))$/)
    if (mMar) {
      const v = parseTailwindSpace(mMar[1] || '')
      if (v != null) {
        const s = toRem(v)
        marT = best(marT, rank, s)
        marR = best(marR, rank, s)
        marB = best(marB, rank, s)
        marL = best(marL, rank, s)
      }
      continue
    }
    const mMx = u.match(/^mx-(\d+(?:\.\d+)?)$/)
    if (mMx) {
      const v = parseTailwindSpace(mMx[1] || '')
      if (v != null) {
        const s = toRem(v)
        marL = best(marL, rank, s)
        marR = best(marR, rank, s)
      }
      continue
    }
    const mMy = u.match(/^my-(\d+(?:\.\d+)?)$/)
    if (mMy) {
      const v = parseTailwindSpace(mMy[1] || '')
      if (v != null) {
        const s = toRem(v)
        marT = best(marT, rank, s)
        marB = best(marB, rank, s)
      }
      continue
    }
    const mMt = u.match(/^mt-(\d+(?:\.\d+)?)$/)
    if (mMt) {
      const v = parseTailwindSpace(mMt[1] || '')
      if (v != null) marT = best(marT, rank, toRem(v))
      continue
    }
    const mMr = u.match(/^mr-(\d+(?:\.\d+)?)$/)
    if (mMr) {
      const v = parseTailwindSpace(mMr[1] || '')
      if (v != null) marR = best(marR, rank, toRem(v))
      continue
    }
    const mMb = u.match(/^mb-(\d+(?:\.\d+)?)$/)
    if (mMb) {
      const v = parseTailwindSpace(mMb[1] || '')
      if (v != null) marB = best(marB, rank, toRem(v))
      continue
    }
    const mMl = u.match(/^ml-(\d+(?:\.\d+)?)$/)
    if (mMl) {
      const v = parseTailwindSpace(mMl[1] || '')
      if (v != null) marL = best(marL, rank, toRem(v))
      continue
    }
    if (u === 'table-auto' || u === 'table-fixed') {
      tableLayout = best(tableLayout, rank, u === 'table-fixed' ? 'fixed' : 'auto')
      continue
    }
    if (u === 'border-collapse' || u === 'border-separate') {
      borderCollapse = best(borderCollapse, rank, u === 'border-collapse' ? 'collapse' : 'separate')
      continue
    }
    if (u === 'flex-row' || u === 'flex-col') {
      flexDir = best(flexDir, rank, u === 'flex-row' ? 'row' : 'column')
      continue
    }
    if (u === 'flex-wrap' || u === 'flex-nowrap' || u === 'flex-wrap-reverse') {
      flexWrap = best(
        flexWrap,
        rank,
        u === 'flex-wrap' ? 'wrap' : u === 'flex-wrap-reverse' ? 'wrap-reverse' : 'nowrap',
      )
      continue
    }
    if (u === 'items-start' || u === 'items-center' || u === 'items-end' || u === 'items-baseline' || u === 'items-stretch') {
      alignItems = best(
        alignItems,
        rank,
        u === 'items-start'
          ? 'flex-start'
          : u === 'items-end'
            ? 'flex-end'
            : u === 'items-center'
              ? 'center'
              : u === 'items-baseline'
                ? 'baseline'
                : 'stretch',
      )
      continue
    }
    if (
      u === 'justify-start' ||
      u === 'justify-center' ||
      u === 'justify-end' ||
      u === 'justify-between' ||
      u === 'justify-around' ||
      u === 'justify-evenly'
    ) {
      justifyContent = best(
        justifyContent,
        rank,
        u === 'justify-start'
          ? 'flex-start'
          : u === 'justify-end'
            ? 'flex-end'
            : u === 'justify-center'
              ? 'center'
              : u === 'justify-between'
                ? 'space-between'
                : u === 'justify-around'
                  ? 'space-around'
                  : 'space-evenly',
      )
      continue
    }
    if (u === 'justify-items-start' || u === 'justify-items-center' || u === 'justify-items-end' || u === 'justify-items-stretch') {
      justifyItems = best(
        justifyItems,
        rank,
        u === 'justify-items-start'
          ? 'start'
          : u === 'justify-items-end'
            ? 'end'
            : u === 'justify-items-center'
              ? 'center'
              : 'stretch',
      )
      continue
    }
    if (
      u === 'content-start' ||
      u === 'content-center' ||
      u === 'content-end' ||
      u === 'content-between' ||
      u === 'content-around' ||
      u === 'content-evenly'
    ) {
      alignContent = best(
        alignContent,
        rank,
        u === 'content-start'
          ? 'flex-start'
          : u === 'content-end'
            ? 'flex-end'
            : u === 'content-center'
              ? 'center'
              : u === 'content-between'
                ? 'space-between'
                : u === 'content-around'
                  ? 'space-around'
                  : 'space-evenly',
      )
      continue
    }
    if (
      u === 'grid-flow-row' ||
      u === 'grid-flow-col' ||
      u === 'grid-flow-dense' ||
      u === 'grid-flow-row-dense' ||
      u === 'grid-flow-col-dense'
    ) {
      gridAutoFlow = best(
        gridAutoFlow,
        rank,
        u === 'grid-flow-row'
          ? 'row'
          : u === 'grid-flow-col'
            ? 'column'
            : u === 'grid-flow-dense'
              ? 'dense'
              : u === 'grid-flow-row-dense'
                ? 'row dense'
                : 'column dense',
      )
      continue
    }
    if (u === 'auto-rows-auto' || u === 'auto-rows-min' || u === 'auto-rows-max' || u === 'auto-rows-fr') {
      gridAutoRows = best(
        gridAutoRows,
        rank,
        u === 'auto-rows-auto' ? 'auto' : u === 'auto-rows-min' ? 'min-content' : u === 'auto-rows-max' ? 'max-content' : 'minmax(0, 1fr)',
      )
      continue
    }
    const mAutoRowsArb = u.match(/^auto-rows-\[(.+)\]$/)
    if (mAutoRowsArb) {
      const v = parseTailwindArbitraryValue(mAutoRowsArb[1] || '')
      if (v) gridAutoRowsArb = best(gridAutoRowsArb, rank, v)
      continue
    }
    if (u === 'auto-cols-auto' || u === 'auto-cols-min' || u === 'auto-cols-max' || u === 'auto-cols-fr') {
      gridAutoCols = best(
        gridAutoCols,
        rank,
        u === 'auto-cols-auto' ? 'auto' : u === 'auto-cols-min' ? 'min-content' : u === 'auto-cols-max' ? 'max-content' : 'minmax(0, 1fr)',
      )
      continue
    }
    const mAutoColsArb = u.match(/^auto-cols-\[(.+)\]$/)
    if (mAutoColsArb) {
      const v = parseTailwindArbitraryValue(mAutoColsArb[1] || '')
      if (v) gridAutoColsArb = best(gridAutoColsArb, rank, v)
      continue
    }

    if (u === 'w-full') {
      width = best(width, rank, '100%')
      continue
    }
    if (u === 'h-full') {
      height = best(height, rank, '100%')
      continue
    }
    if (u === 'w-auto') {
      width = best(width, rank, 'auto')
      continue
    }
    if (u === 'h-auto') {
      height = best(height, rank, 'auto')
      continue
    }
    if (u === 'min-w-0') {
      minWidth = best(minWidth, rank, '0')
      continue
    }
    if (u === 'min-h-0') {
      minHeight = best(minHeight, rank, '0')
      continue
    }
    if (u === 'max-w-full') {
      maxWidth = best(maxWidth, rank, '100%')
      continue
    }
    if (u === 'max-w-min') {
      maxWidth = best(maxWidth, rank, 'min-content')
      continue
    }
    if (u === 'max-w-max') {
      maxWidth = best(maxWidth, rank, 'max-content')
      continue
    }
    if (u === 'max-w-fit') {
      maxWidth = best(maxWidth, rank, 'fit-content')
      continue
    }
    if (u === 'max-w-prose') {
      maxWidth = best(maxWidth, rank, '65ch')
      continue
    }
    if (u === 'max-w-xs') {
      maxWidth = best(maxWidth, rank, '20rem')
      continue
    }
    if (u === 'max-w-sm') {
      maxWidth = best(maxWidth, rank, '24rem')
      continue
    }
    if (u === 'max-w-md') {
      maxWidth = best(maxWidth, rank, '28rem')
      continue
    }
    if (u === 'max-w-lg') {
      maxWidth = best(maxWidth, rank, '32rem')
      continue
    }
    if (u === 'max-w-xl') {
      maxWidth = best(maxWidth, rank, '36rem')
      continue
    }
    if (u === 'max-w-2xl') {
      maxWidth = best(maxWidth, rank, '42rem')
      continue
    }
    if (u === 'max-w-3xl') {
      maxWidth = best(maxWidth, rank, '48rem')
      continue
    }
    if (u === 'max-w-4xl') {
      maxWidth = best(maxWidth, rank, '56rem')
      continue
    }
    if (u === 'max-w-5xl') {
      maxWidth = best(maxWidth, rank, '64rem')
      continue
    }
    if (u === 'max-w-6xl') {
      maxWidth = best(maxWidth, rank, '72rem')
      continue
    }
    if (u === 'max-w-7xl') {
      maxWidth = best(maxWidth, rank, '80rem')
      continue
    }
    if (u === 'max-w-screen-sm') {
      maxWidth = best(maxWidth, rank, '640px')
      continue
    }
    if (u === 'max-w-screen-md') {
      maxWidth = best(maxWidth, rank, '768px')
      continue
    }
    if (u === 'max-w-screen-lg') {
      maxWidth = best(maxWidth, rank, '1024px')
      continue
    }
    if (u === 'max-w-screen-xl') {
      maxWidth = best(maxWidth, rank, '1280px')
      continue
    }
    if (u === 'max-w-screen-2xl') {
      maxWidth = best(maxWidth, rank, '1536px')
      continue
    }
    if (u === 'max-h-full') {
      maxHeight = best(maxHeight, rank, '100%')
      continue
    }
    if (u === 'w-screen') {
      width = best(width, rank, '100vw')
      continue
    }
    if (u === 'h-screen') {
      height = best(height, rank, '100vh')
      continue
    }
    const mWArb = u.match(/^w-\[(.+)\]$/)
    if (mWArb) {
      const v = parseTailwindArbitraryValue(mWArb[1] || '')
      if (v) width = best(width, rank, v)
      continue
    }
    const mHArb = u.match(/^h-\[(.+)\]$/)
    if (mHArb) {
      const v = parseTailwindArbitraryValue(mHArb[1] || '')
      if (v) height = best(height, rank, v)
      continue
    }
    const mMinWArb = u.match(/^min-w-\[(.+)\]$/)
    if (mMinWArb) {
      const v = parseTailwindArbitraryValue(mMinWArb[1] || '')
      if (v) minWidth = best(minWidth, rank, v)
      continue
    }
    const mMinHArb = u.match(/^min-h-\[(.+)\]$/)
    if (mMinHArb) {
      const v = parseTailwindArbitraryValue(mMinHArb[1] || '')
      if (v) minHeight = best(minHeight, rank, v)
      continue
    }
    const mMaxWArb = u.match(/^max-w-\[(.+)\]$/)
    if (mMaxWArb) {
      const v = parseTailwindArbitraryValue(mMaxWArb[1] || '')
      if (v) maxWidth = best(maxWidth, rank, v)
      continue
    }
    const mMaxHArb = u.match(/^max-h-\[(.+)\]$/)
    if (mMaxHArb) {
      const v = parseTailwindArbitraryValue(mMaxHArb[1] || '')
      if (v) maxHeight = best(maxHeight, rank, v)
      continue
    }

    if (u === 'aspect-video') {
      aspectRatio = best(aspectRatio, rank, '16 / 9')
      continue
    }
    if (u === 'aspect-square') {
      aspectRatio = best(aspectRatio, rank, '1 / 1')
      continue
    }
    const mAspectArb = u.match(/^aspect-\[(.+)\]$/)
    if (mAspectArb) {
      const v = parseTailwindArbitraryValue(mAspectArb[1] || '')
      if (v) aspectRatio = best(aspectRatio, rank, v)
      continue
    }

    const mGridCols = u.match(/^grid-cols-(\d+)$/)
    if (mGridCols) {
      const n = Number.parseInt(mGridCols[1] || '', 10)
      if (Number.isFinite(n) && n >= 1 && n <= 12) gridCols = best(gridCols, rank, n)
      continue
    }
    const mGridColsArb = u.match(/^grid-cols-\[(.+)\]$/)
    if (mGridColsArb) {
      const v = parseTailwindArbitraryValue(mGridColsArb[1] || '')
      if (v) gridColsArb = best(gridColsArb, rank, v)
      continue
    }
    const mGridRows = u.match(/^grid-rows-(\d+)$/)
    if (mGridRows) {
      const n = Number.parseInt(mGridRows[1] || '', 10)
      if (Number.isFinite(n) && n >= 1 && n <= 12) gridRows = best(gridRows, rank, n)
      continue
    }
    const mGridRowsArb = u.match(/^grid-rows-\[(.+)\]$/)
    if (mGridRowsArb) {
      const v = parseTailwindArbitraryValue(mGridRowsArb[1] || '')
      if (v) gridRowsArb = best(gridRowsArb, rank, v)
      continue
    }

    const mGap = u.match(/^gap-([0-9]+(?:\.[0-9]+)?)$/)
    if (mGap) {
      const v = parseTailwindSpace(mGap[1] || '')
      if (v != null) gap = best(gap, rank, v)
      continue
    }
    const mGapArb = u.match(/^gap-\[(.+)\]$/)
    if (mGapArb) {
      const v = parseTailwindArbitraryValue(mGapArb[1] || '')
      if (v) gapArb = best(gapArb, rank, v)
      continue
    }
    const mGapX = u.match(/^gap-x-([0-9]+(?:\.[0-9]+)?)$/)
    if (mGapX) {
      const v = parseTailwindSpace(mGapX[1] || '')
      if (v != null) gapX = best(gapX, rank, v)
      continue
    }
    const mGapXArb = u.match(/^gap-x-\[(.+)\]$/)
    if (mGapXArb) {
      const v = parseTailwindArbitraryValue(mGapXArb[1] || '')
      if (v) gapXArb = best(gapXArb, rank, v)
      continue
    }
    const mGapY = u.match(/^gap-y-([0-9]+(?:\.[0-9]+)?)$/)
    if (mGapY) {
      const v = parseTailwindSpace(mGapY[1] || '')
      if (v != null) gapY = best(gapY, rank, v)
      continue
    }
    const mGapYArb = u.match(/^gap-y-\[(.+)\]$/)
    if (mGapYArb) {
      const v = parseTailwindArbitraryValue(mGapYArb[1] || '')
      if (v) gapYArb = best(gapYArb, rank, v)
      continue
    }

    const mColumns = u.match(/^columns-(\d+)$/)
    if (mColumns) {
      const n = Number.parseInt(mColumns[1] || '', 10)
      if (Number.isFinite(n) && n >= 1 && n <= 6) columns = best(columns, rank, n)
      continue
    }

    if (u === 'col-span-full') {
      colSpanFull = best(colSpanFull, rank, true)
      continue
    }
    if (u === 'row-span-full') {
      rowSpanFull = best(rowSpanFull, rank, true)
      continue
    }
    const mColSpan = u.match(/^col-span-(\d+)$/)
    if (mColSpan) {
      const n = Number.parseInt(mColSpan[1] || '', 10)
      if (Number.isFinite(n) && n >= 1 && n <= 12) colSpan = best(colSpan, rank, n)
      continue
    }
    const mRowSpan = u.match(/^row-span-(\d+)$/)
    if (mRowSpan) {
      const n = Number.parseInt(mRowSpan[1] || '', 10)
      if (Number.isFinite(n) && n >= 1 && n <= 12) rowSpan = best(rowSpan, rank, n)
      continue
    }

    const mColStart = u.match(/^col-start-(\d+)$/)
    if (mColStart) {
      const v = parseSafeGridLine(mColStart[1] || '')
      if (v != null) colStart = best(colStart, rank, v)
      continue
    }
    const mColEnd = u.match(/^col-end-(\d+)$/)
    if (mColEnd) {
      const v = parseSafeGridLine(mColEnd[1] || '')
      if (v != null) colEnd = best(colEnd, rank, v)
      continue
    }
    const mColEndArb = u.match(/^col-end-\[(-?\d+)\]$/)
    if (mColEndArb) {
      const v = parseSafeGridLine(mColEndArb[1] || '')
      if (v != null) colEnd = best(colEnd, rank, v)
      continue
    }
    const mRowStart = u.match(/^row-start-(\d+)$/)
    if (mRowStart) {
      const v = parseSafeGridLine(mRowStart[1] || '')
      if (v != null) rowStart = best(rowStart, rank, v)
      continue
    }
    const mRowEnd = u.match(/^row-end-(\d+)$/)
    if (mRowEnd) {
      const v = parseSafeGridLine(mRowEnd[1] || '')
      if (v != null) rowEnd = best(rowEnd, rank, v)
      continue
    }
    const mRowEndArb = u.match(/^row-end-\[(-?\d+)\]$/)
    if (mRowEndArb) {
      const v = parseSafeGridLine(mRowEndArb[1] || '')
      if (v != null) rowEnd = best(rowEnd, rank, v)
      continue
    }
  }

  const out: React.CSSProperties = {}
  const computedDisplay =
    display?.value ??
    (gridCols ||
    gridRows ||
    gridAutoFlow ||
    gridAutoRows ||
    gridAutoRowsArb ||
    gridAutoCols ||
    gridAutoColsArb ||
    gridColsArb ||
    gridRowsArb ||
    gap ||
    gapArb ||
    gapX ||
    gapXArb ||
    gapY ||
    gapYArb
      ? ('grid' as const)
      : tableLayout || borderCollapse
        ? ('table' as const)
        : null)
  if (computedDisplay) out.display = computedDisplay as React.CSSProperties['display']
  if (tableLayout) (out as unknown as { tableLayout?: string }).tableLayout = tableLayout.value
  if (borderCollapse) (out as unknown as { borderCollapse?: string }).borderCollapse = borderCollapse.value
  if (flexDir) out.flexDirection = flexDir.value as React.CSSProperties['flexDirection']
  if (flexWrap) out.flexWrap = flexWrap.value as React.CSSProperties['flexWrap']
  if (alignItems) out.alignItems = alignItems.value as React.CSSProperties['alignItems']
  if (justifyItems) out.justifyItems = justifyItems.value as React.CSSProperties['justifyItems']
  if (justifyContent) out.justifyContent = justifyContent.value as React.CSSProperties['justifyContent']
  if (alignContent) out.alignContent = alignContent.value as React.CSSProperties['alignContent']
  const isGridDisplay = computedDisplay === 'grid' || computedDisplay === 'inline-grid'
  if (isGridDisplay && gridCols) out.gridTemplateColumns = `repeat(${gridCols.value}, minmax(0, 1fr))`
  if (isGridDisplay && gridColsArb) out.gridTemplateColumns = gridColsArb.value
  if (isGridDisplay && gridRows) out.gridTemplateRows = `repeat(${gridRows.value}, minmax(0, 1fr))`
  if (isGridDisplay && gridRowsArb) out.gridTemplateRows = gridRowsArb.value
  if (isGridDisplay && gridAutoFlow) out.gridAutoFlow = gridAutoFlow.value as React.CSSProperties['gridAutoFlow']
  if (isGridDisplay && gridAutoRows) out.gridAutoRows = gridAutoRows.value as React.CSSProperties['gridAutoRows']
  if (isGridDisplay && gridAutoRowsArb) out.gridAutoRows = gridAutoRowsArb.value as React.CSSProperties['gridAutoRows']
  if (isGridDisplay && gridAutoCols) out.gridAutoColumns = gridAutoCols.value as React.CSSProperties['gridAutoColumns']
  if (isGridDisplay && gridAutoColsArb) out.gridAutoColumns = gridAutoColsArb.value as React.CSSProperties['gridAutoColumns']
  if (width) out.width = width.value as React.CSSProperties['width']
  if (height) out.height = height.value as React.CSSProperties['height']
  if (minWidth) out.minWidth = minWidth.value as React.CSSProperties['minWidth']
  if (minHeight) out.minHeight = minHeight.value as React.CSSProperties['minHeight']
  if (maxWidth) out.maxWidth = maxWidth.value as React.CSSProperties['maxWidth']
  if (maxHeight) out.maxHeight = maxHeight.value as React.CSSProperties['maxHeight']
  if (aspectRatio) (out as unknown as { aspectRatio?: string }).aspectRatio = aspectRatio.value
  if (gap) out.gap = `${gap.value}rem`
  if (gapArb) out.gap = gapArb.value
  if (gapX) out.columnGap = `${gapX.value}rem`
  if (gapXArb) out.columnGap = gapXArb.value
  if (gapY) out.rowGap = `${gapY.value}rem`
  if (gapYArb) out.rowGap = gapYArb.value
  if (columns) out.columnCount = columns.value
  if (flex) out.flex = flex.value as React.CSSProperties['flex']
  if (padT) out.paddingTop = padT.value as React.CSSProperties['paddingTop']
  if (padR) out.paddingRight = padR.value as React.CSSProperties['paddingRight']
  if (padB) out.paddingBottom = padB.value as React.CSSProperties['paddingBottom']
  if (padL) out.paddingLeft = padL.value as React.CSSProperties['paddingLeft']
  if (marT) out.marginTop = marT.value as React.CSSProperties['marginTop']
  if (marR) out.marginRight = marR.value as React.CSSProperties['marginRight']
  if (marB) out.marginBottom = marB.value as React.CSSProperties['marginBottom']
  if (marL) out.marginLeft = marL.value as React.CSSProperties['marginLeft']
  if (borderWidth) {
    out.borderWidth = borderWidth.value as React.CSSProperties['borderWidth']
    out.borderStyle = 'solid'
  }
  if (borderColor) out.borderColor = borderColor.value as React.CSSProperties['borderColor']
  if (borderRadius) out.borderRadius = borderRadius.value as React.CSSProperties['borderRadius']
  if (boxShadow) out.boxShadow = boxShadow.value as React.CSSProperties['boxShadow']
  if (overflow) out.overflow = overflow.value as React.CSSProperties['overflow']
  if (overflowX) out.overflowX = overflowX.value as React.CSSProperties['overflowX']
  if (overflowY) out.overflowY = overflowY.value as React.CSSProperties['overflowY']
  if (colSpanFull) {
    out.gridColumn = '1 / -1'
  } else if (colStart || colEnd) {
    const start = colStart?.value
    const end = colEnd?.value
    if (start != null && end != null) out.gridColumn = `${start} / ${end}`
    else if (start != null && colSpan) out.gridColumn = `${start} / span ${colSpan.value}`
    else if (start != null) out.gridColumn = `${start}`
    else if (end != null) out.gridColumn = `auto / ${end}`
  } else if (colSpan) {
    out.gridColumn = `span ${colSpan.value} / span ${colSpan.value}`
  }
  if (rowSpanFull) {
    out.gridRow = '1 / -1'
  } else if (rowStart || rowEnd) {
    const start = rowStart?.value
    const end = rowEnd?.value
    if (start != null && end != null) out.gridRow = `${start} / ${end}`
    else if (start != null && rowSpan) out.gridRow = `${start} / span ${rowSpan.value}`
    else if (start != null) out.gridRow = `${start}`
    else if (end != null) out.gridRow = `auto / ${end}`
  } else if (rowSpan) {
    out.gridRow = `span ${rowSpan.value} / span ${rowSpan.value}`
  }
  return Object.keys(out).length ? out : undefined
}

const mergeSafeStyles = (
  base: React.CSSProperties | undefined,
  override: React.CSSProperties | undefined,
): React.CSSProperties | undefined => {
  if (!base && !override) return undefined
  if (!base) return override
  if (!override) return base
  const merged: React.CSSProperties = { ...base, ...override }
  return Object.keys(merged).length ? merged : undefined
}

export const renderSafeHtmlBlock = (
  html: string,
  opts: {
    activeDocumentPath: string
    uiPanelTextFontClass: string
    uiPanelMonospaceTextClass: string
    markdownPresentationMode: boolean
    renderNodeText: (text: string, key: React.Key) => React.ReactNode
    fragmentOptions?: {
      enabled: boolean
      currentStep: number
      classNames: string[]
      tags: string[]
    } | null
  },
): React.ReactNode | null => {
  const win = (globalThis as unknown as { window?: Window }).window
  if (!win) return null
  const DomParserCtor = (globalThis as unknown as { DOMParser?: typeof DOMParser }).DOMParser
  if (!DomParserCtor) return null
  const raw = String(html || '').trim()
  if (!raw) return null
  if (!raw.includes('<')) return null
  try {
    const NodeRef = (globalThis as unknown as { Node?: typeof Node }).Node || (win as unknown as { Node?: typeof Node }).Node
    const parser = new DomParserCtor()
    const doc = parser.parseFromString(`<body>${raw}</body>`, 'text/html')
    const root = doc.body

    const fragmentOpts = opts.fragmentOptions
    const fragmentEnabled = !!fragmentOpts && !!fragmentOpts.enabled
    const fragmentClassNames = fragmentOpts?.classNames || []
    const fragmentTags = fragmentOpts?.tags || []
    let fragmentIndex = 0

    const renderNode = (node: ChildNode, key: React.Key): React.ReactNode => {
      if (node.nodeType === NodeRef.TEXT_NODE) {
        const text = node.textContent || ''
        if (!text) return <React.Fragment key={key}>{''}</React.Fragment>
        if (text.trim() === '' && /[\r\n]/.test(text)) {
          return <React.Fragment key={key}>{''}</React.Fragment>
        }
        return opts.renderNodeText(text, key)
      }
      if (node.nodeType !== NodeRef.ELEMENT_NODE) {
        return <React.Fragment key={key}>{''}</React.Fragment>
      }
      const el = node as Element
      const tag = el.tagName.toLowerCase()
      if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'template') {
        return <React.Fragment key={key}>{''}</React.Fragment>
      }
      const children = Array.from(el.childNodes).map((n, i) => renderNode(n, `${key}-${i}`))

      let isFragmentTag = false
      let isFragmentClass = false
      let shouldUnwrapAfterFragmentGate = false
      if (fragmentEnabled) {
        const tagMatch = tag !== 'v-clicks' && fragmentTags.some(name => name.toLowerCase() === tag)
        const classMatch =
          fragmentClassNames.length > 0 && (el.classList?.length || 0) > 0
            ? fragmentClassNames.some(name => el.classList.contains(name))
            : false
        isFragmentTag = tagMatch
        isFragmentClass = classMatch
      }

      if (fragmentEnabled && (isFragmentTag || isFragmentClass)) {
        const explicitIndexAttr =
          el.getAttribute('data-fragment-index') ||
          (tag === 'v-click' ? el.getAttribute('at') : null)
        let idx: number
        if (explicitIndexAttr != null && explicitIndexAttr.trim()) {
          const parsed = Number.parseInt(explicitIndexAttr.trim(), 10)
          idx = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
        } else {
          fragmentIndex += 1
          idx = fragmentIndex
        }
        const current = Number.isFinite(fragmentOpts?.currentStep)
          ? Math.max(0, fragmentOpts?.currentStep || 0)
          : 0
        if (idx <= 0 || current < idx) {
          return <React.Fragment key={key}>{''}</React.Fragment>
        }
        if (isFragmentTag) shouldUnwrapAfterFragmentGate = true
      }

      if (tag === 'v-click') {
        return <React.Fragment key={key}>{children}</React.Fragment>
      }

      if (tag === 'v-mark') {
        const type = String(el.getAttribute('type') || '').trim().toLowerCase()
        const color = String(el.getAttribute('color') || '').trim().toLowerCase()
        const cls: string[] = []
        if (type === 'circle') cls.push('inline-block border border-current rounded-full px-1')
        if (type === 'underline') cls.push('underline decoration-2 underline-offset-2')
        if (type === 'strike-through') cls.push('line-through')
        if (color === 'red') cls.push('bg-red-200 text-red-900 px-1 rounded-sm')
        if (color === 'yellow') cls.push('bg-yellow-200 text-yellow-900 px-1 rounded-sm')
        if (cls.length) {
          return (
            <span key={key} className={cls.join(' ')}>
              {children}
            </span>
          )
        }
        return <span key={key}>{children}</span>
      }

      if (tag === 'v-clicks') {
        const rawText = String(el.textContent || '')
        const lines = rawText.split(/\r?\n/)
        const items: string[] = []
        let ordered = false
        for (const line of lines) {
          const mUn = line.match(/^\s*[-*+]\s+(.*)$/)
          if (mUn) {
            items.push(mUn[1] || '')
            continue
          }
          const mOrd = line.match(/^\s*(\d+)\.\s+(.*)$/)
          if (mOrd) {
            ordered = true
            items.push(mOrd[2] || '')
            continue
          }
        }
        if (!items.length) {
          return <React.Fragment key={key}>{children}</React.Fragment>
        }
        const current = Number.isFinite(fragmentOpts?.currentStep) ? Math.max(0, fragmentOpts?.currentStep || 0) : 0
        const explicitAt = el.getAttribute('at')
        const explicitStart = explicitAt && explicitAt.trim() ? Number.parseInt(explicitAt.trim(), 10) : NaN
        const startIndex =
          fragmentEnabled && Number.isFinite(explicitStart) && explicitStart > 0
            ? explicitStart
            : fragmentEnabled
              ? fragmentIndex + 1
              : 1
        if (fragmentEnabled) {
          const nextEnd = startIndex + items.length - 1
          fragmentIndex = Math.max(fragmentIndex, nextEnd)
        }
        const visibleCount = fragmentEnabled
          ? Math.max(0, Math.min(items.length, current - startIndex + 1))
          : items.length
        const ListTag = (ordered ? 'ol' : 'ul') as 'ol' | 'ul'
        const listClass = ordered ? 'list-decimal' : 'list-disc'
        return (
          <section key={key} className={['mt-2 mb-2', opts.uiPanelTextFontClass].filter(Boolean).join(' ')}>
            <ListTag className={[listClass, 'pl-5'].join(' ')}>
              {items.slice(0, visibleCount).map((text, idx) => (
                <li key={idx}>{text}</li>
              ))}
            </ListTag>
          </section>
        )
      }

      if (tag === 'a') {
        const hrefRaw = el.getAttribute('href') || ''
        if (hrefRaw && isSafeHref(hrefRaw)) {
          const href = resolveHref(hrefRaw, opts.activeDocumentPath)
          const anchor = buildAnchorAttrs(href)
          return (
            <a
              key={key}
              href={href || undefined}
              target={anchor.target}
              rel={anchor.rel}
              className={anchor.className}
            >
              {children}
            </a>
          )
        }
        const id = sanitizeHtmlId(el.getAttribute('id') || '')
        if (!id) return <React.Fragment key={key}>{children}</React.Fragment>
        return (
          <a
            key={key}
            id={id}
            className="block h-0 scroll-mt-16"
            aria-hidden={children.length ? undefined : true}
          >
            {children}
          </a>
        )
      }

      if (tag === 'img') {
        const srcRaw = el.getAttribute('src') || el.getAttribute('data-src') || ''
        const srcsetRaw = el.getAttribute('srcset') || el.getAttribute('data-srcset') || ''
        const srcCandidate = srcRaw || pickFirstSrcsetUrl(srcsetRaw)
        if (!srcCandidate || !isSafeHref(srcCandidate) || !isSafeMediaSrc(srcCandidate)) return <React.Fragment key={key}>{''}</React.Fragment>
        const resolved = resolveHref(srcCandidate, opts.activeDocumentPath)
        const src = applyMediaProxySrc(resolved)
        const alt = el.getAttribute('alt') || ''
        const width = parseHtmlNumberAttr(el.getAttribute('width') || '')
        const height = parseHtmlNumberAttr(el.getAttribute('height') || '')
        const style: React.CSSProperties = {}
        if (width) {
          style.width = `${Math.round(width)}px`
          style.maxWidth = '100%'
        }
        if (height) style.height = `${Math.round(height)}px`
        return (
          <img
            key={key}
            src={src || undefined}
            alt={alt}
            loading="lazy"
            decoding="async"
            style={style && Object.keys(style).length ? style : undefined}
            className="inline-block max-w-full h-auto rounded border border-gray-200"
          />
        )
      }

      if (tag === 'picture') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )

        const sources = Array.from(el.querySelectorAll('source')) as HTMLSourceElement[]
        const renderedSources = sources
          .map((s, i) => {
            const srcsetRaw = s.getAttribute('srcset') || s.getAttribute('data-srcset') || ''
            const picked = pickFirstSrcsetUrl(srcsetRaw)
            if (!picked || !isSafeHref(picked) || !isSafeMediaSrc(picked)) return null
            const resolved = applyMediaProxySrc(resolveHref(picked, opts.activeDocumentPath))
            const typeRaw = String(s.getAttribute('type') || '').trim()
            const type = typeRaw && typeRaw.length <= 80 ? typeRaw : undefined
            return <source key={`${key}-src-${i}`} srcSet={resolved} type={type} />
          })
          .filter(Boolean)

        const img = el.querySelector('img') as HTMLImageElement | null
        const imgSrcRaw = img?.getAttribute('src') || img?.getAttribute('data-src') || ''
        const imgSrcsetRaw = img?.getAttribute('srcset') || img?.getAttribute('data-srcset') || ''
        const imgCandidate = imgSrcRaw || pickFirstSrcsetUrl(imgSrcsetRaw)
        if (!imgCandidate || !isSafeHref(imgCandidate) || !isSafeMediaSrc(imgCandidate)) return <React.Fragment key={key}>{''}</React.Fragment>
        const imgResolved = applyMediaProxySrc(resolveHref(imgCandidate, opts.activeDocumentPath))
        const alt = img?.getAttribute('alt') || ''
        const width = parseHtmlNumberAttr(img?.getAttribute('width') || '')
        const height = parseHtmlNumberAttr(img?.getAttribute('height') || '')
        const imgStyle: React.CSSProperties = {}
        if (width) {
          imgStyle.width = `${Math.round(width)}px`
          imgStyle.maxWidth = '100%'
        }
        if (height) imgStyle.height = `${Math.round(height)}px`

        return (
          <picture key={key} className={safeClass || undefined} style={style}>
            {renderedSources as unknown as React.ReactNode}
            <img
              src={imgResolved || undefined}
              alt={alt}
              loading="lazy"
              decoding="async"
              style={Object.keys(imgStyle).length ? imgStyle : undefined}
              className="inline-block max-w-full h-auto rounded border border-gray-200"
            />
          </picture>
        )
      }

      if (tag === 'figure') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const cls = ['mx-0', safeClass].filter(Boolean).join(' ')
        return <figure key={key} className={cls || undefined}>{children}</figure>
      }

      if (tag === 'figcaption') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        return <figcaption key={key} className={safeClass || undefined}>{children}</figcaption>
      }

      if (tag === 'video') {
        const sources = Array.from(el.querySelectorAll('source')) as HTMLSourceElement[]
        const directSrc = el.getAttribute('src') || el.getAttribute('data-src') || ''
        const sourceCandidates = sources
          .map(s => s.getAttribute('src') || s.getAttribute('data-src') || '')
          .map(s => s.trim())
          .filter(Boolean)
        const srcCandidate = directSrc.trim() || sourceCandidates[0] || ''
        if (!srcCandidate || !isSafeHref(srcCandidate) || !isSafeMediaSrc(srcCandidate)) return <React.Fragment key={key}>{''}</React.Fragment>
        const resolved = resolveHref(srcCandidate, opts.activeDocumentPath)
        const src = applyMediaProxySrc(resolved)

        const posterRaw = el.getAttribute('poster') || el.getAttribute('data-poster') || ''
        const poster = posterRaw && isSafeHref(posterRaw) && isSafeMediaSrc(posterRaw)
          ? applyMediaProxySrc(resolveHref(posterRaw, opts.activeDocumentPath))
          : undefined

        const autoPlay = el.hasAttribute('autoplay')
        const loop = el.hasAttribute('loop')
        const muted = el.hasAttribute('muted')
        const playsInline = el.hasAttribute('playsinline')
        const controls = el.hasAttribute('controls') ? true : autoPlay || loop ? false : true

        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        const width = parseHtmlNumberAttr(el.getAttribute('width') || '')
        const height = parseHtmlNumberAttr(el.getAttribute('height') || '')
        if (width) (style as Record<string, unknown>).width = `${Math.round(width)}px`
        if (height) (style as Record<string, unknown>).height = `${Math.round(height)}px`

        const renderedSources = sources
          .map((s, i) => {
            const raw = s.getAttribute('src') || s.getAttribute('data-src') || ''
            if (!raw || !isSafeHref(raw) || !isSafeMediaSrc(raw)) return null
            const resolved = applyMediaProxySrc(resolveHref(raw, opts.activeDocumentPath))
            const typeRaw = String(s.getAttribute('type') || '').trim()
            const type = typeRaw && typeRaw.length <= 80 ? typeRaw : undefined
            return <source key={`${key}-src-${i}`} src={resolved} type={type} />
          })
          .filter(Boolean)

        return (
          <video
            key={key}
            src={src}
            poster={poster}
            controls={controls}
            autoPlay={autoPlay || undefined}
            muted={muted || undefined}
            loop={loop || undefined}
            playsInline={playsInline || undefined}
            className={['max-w-full rounded border border-gray-200', safeClass].filter(Boolean).join(' ') || undefined}
            style={style && Object.keys(style).length ? style : undefined}
          >
            {renderedSources as unknown as React.ReactNode}
          </video>
        )
      }

      if (tag === 'audio') {
        const sources = Array.from(el.querySelectorAll('source')) as HTMLSourceElement[]
        const directSrc = el.getAttribute('src') || el.getAttribute('data-src') || ''
        const sourceCandidates = sources
          .map(s => s.getAttribute('src') || s.getAttribute('data-src') || '')
          .map(s => s.trim())
          .filter(Boolean)
        const srcCandidate = directSrc.trim() || sourceCandidates[0] || ''
        if (!srcCandidate || !isSafeHref(srcCandidate) || !isSafeMediaSrc(srcCandidate)) return <React.Fragment key={key}>{''}</React.Fragment>
        const resolved = resolveHref(srcCandidate, opts.activeDocumentPath)
        const src = applyMediaProxySrc(resolved)

        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )

        const renderedSources = sources
          .map((s, i) => {
            const raw = s.getAttribute('src') || s.getAttribute('data-src') || ''
            if (!raw || !isSafeHref(raw) || !isSafeMediaSrc(raw)) return null
            const resolved = applyMediaProxySrc(resolveHref(raw, opts.activeDocumentPath))
            const typeRaw = String(s.getAttribute('type') || '').trim()
            const type = typeRaw && typeRaw.length <= 80 ? typeRaw : undefined
            return <source key={`${key}-src-${i}`} src={resolved} type={type} />
          })
          .filter(Boolean)

        return (
          <audio
            key={key}
            controls
            src={src}
            className={['w-full max-w-2xl', safeClass].filter(Boolean).join(' ') || undefined}
            style={style && Object.keys(style).length ? style : undefined}
          >
            {renderedSources as unknown as React.ReactNode}
          </audio>
        )
      }

      if (tag === 'details') {
        const open = el.hasAttribute('open')
        const className = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        return (
          <details key={key} open={open || undefined} className={className || undefined}>
            {children}
          </details>
        )
      }

      if (tag === 'summary') {
        const className = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        return (
          <summary key={key} className={className || undefined}>
            {children}
          </summary>
        )
      }

      if (tag === 'iframe') {
        const srcRaw = el.getAttribute('src') || el.getAttribute('data-src') || ''
        if (srcRaw && isSafeHref(srcRaw) && isSafeMediaSrc(srcRaw)) {
          const src = resolveHref(srcRaw, opts.activeDocumentPath)
          const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
          const style = mergeSafeStyles(
            deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
            parseSafeInlineStyle(el.getAttribute('style') || ''),
          )
          return (
            <section key={key} className={opts.markdownPresentationMode ? 'aspect-video w-full' : 'aspect-video w-full max-w-xl'}>
              <iframe
                src={src}
                title={el.getAttribute('title') || 'Embedded content'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-presentation"
                referrerPolicy="no-referrer"
                loading="lazy"
                className={['w-full h-full rounded border border-gray-200', safeClass].filter(Boolean).join(' ') || undefined}
                style={style && Object.keys(style).length ? style : undefined}
              />
            </section>
          )
        }

        const srcDocRaw = el.getAttribute('srcdoc') || ''
        const srcDoc = String(srcDocRaw || '').trim()
        if (!srcDoc) return <React.Fragment key={key}>{''}</React.Fragment>

        const sanitizedSrcDoc = sanitizeSrcDocCached(srcDoc)

        const heightClass = opts.markdownPresentationMode ? 'h-[220px]' : 'h-[140px]'
        return (
          <section key={key} className={`w-full ${heightClass}`}>
            <iframe
              title={el.getAttribute('title') || 'Embedded content'}
              sandbox=""
              referrerPolicy="no-referrer"
              srcDoc={sanitizedSrcDoc}
              className="w-full h-full rounded border border-gray-200"
            />
          </section>
        )
      }

      if (
        tag === 'svg' ||
        tag === 'g' ||
        tag === 'path' ||
        tag === 'circle' ||
        tag === 'rect' ||
        tag === 'line' ||
        tag === 'polyline' ||
        tag === 'polygon' ||
        tag === 'defs' ||
        tag === 'lineargradient' ||
        tag === 'radialgradient' ||
        tag === 'stop' ||
        tag === 'clippath' ||
        tag === 'mask' ||
        tag === 'symbol' ||
        tag === 'use' ||
        tag === 'title' ||
        tag === 'desc' ||
        tag === 'text'
      ) {
        const allowed = new Set([
          'xmlns',
          'xmlns:xlink',
          'viewbox',
          'width',
          'height',
          'preserveaspectratio',
          'fill',
          'fill-rule',
          'stroke',
          'stroke-width',
          'stroke-linecap',
          'stroke-linejoin',
          'stroke-miterlimit',
          'stroke-dasharray',
          'stroke-dashoffset',
          'opacity',
          'd',
          'points',
          'x',
          'y',
          'x1',
          'y1',
          'x2',
          'y2',
          'cx',
          'cy',
          'r',
          'rx',
          'ry',
          'transform',
          'role',
          'aria-hidden',
          'focusable',
          'href',
          'xlink:href',
          'id',
          'class',
        ])
        const attrToProp = (name: string): string => {
          const n = name.toLowerCase()
          if (n === 'viewbox') return 'viewBox'
          if (n === 'preserveaspectratio') return 'preserveAspectRatio'
          if (n === 'aria-hidden') return 'aria-hidden'
          if (n === 'xmlns:xlink') return 'xmlnsXlink'
          if (n === 'xlink:href') return 'xlinkHref'
          return n.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())
        }
        const props: Record<string, unknown> = { key }
        for (const name of el.getAttributeNames()) {
          const rawName = String(name || '')
          const low = rawName.toLowerCase()
          if (!allowed.has(low)) continue
          if (low.startsWith('on')) continue
          if (low === 'style') continue
          if (low === 'id') {
            const v = sanitizeHtmlId(el.getAttribute(rawName) || '')
            if (v) props.id = v
            continue
          }
          if (low === 'class') {
            const v = filterHtmlPreviewClassName(el.getAttribute(rawName) || '')
            if (v) props.className = v
            continue
          }
          if (low === 'href' || low === 'xlink:href') {
            const v = String(el.getAttribute(rawName) || '').trim()
            if (v.startsWith('#')) {
              props[attrToProp(rawName)] = v
            }
            continue
          }
          const v = el.getAttribute(rawName)
          if (v == null) continue
          props[attrToProp(rawName)] = v
        }
        const SvgTag = tag as keyof JSX.IntrinsicElements
        return React.createElement(SvgTag, props, children)
      }

      if (tag === 'p') {
        const align = (el.getAttribute('align') || '').toLowerCase()
        const cls = ['mt-2 mb-2', opts.uiPanelTextFontClass]
        if (align === 'center') cls.push('text-center')
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        if (safeClass) cls.push(safeClass)
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        return (
          <p key={key} className={cls.join(' ')} style={style}>
            {children}
          </p>
        )
      }

      if (tag === 'center') {
        return (
          <section key={key} className="text-center">
            {children}
          </section>
        )
      }

      if (
        tag === 'article' ||
        tag === 'aside' ||
        tag === 'nav' ||
        tag === 'header' ||
        tag === 'footer' ||
        tag === 'figure'
      ) {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        const Tag = tag as 'article' | 'aside' | 'nav' | 'header' | 'footer' | 'figure'
        return <Tag key={key} className={safeClass || undefined} style={style}>{children}</Tag>
      }

      if (tag === 'section') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        return <section key={key} className={safeClass || undefined} style={style}>{children}</section>
      }

      if (tag === 'main') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        return <main key={key} className={safeClass || undefined} style={style}>{children}</main>
      }

      if (tag === 'button') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        return (
          <button key={key} type="button" className={safeClass || undefined}>
            {children}
          </button>
        )
      }

      if (tag === 'div') {
        const align = (el.getAttribute('align') || '').toLowerCase()
        const cls = [opts.uiPanelTextFontClass]
        if (align === 'center') cls.push('text-center')
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        if (safeClass) cls.push(safeClass)
        const className = cls.filter(Boolean).join(' ')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        return <section key={key} className={className || undefined} style={style}>{children}</section>
      }
      if (tag === 'ul' || tag === 'ol') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        const Tag = tag as 'ul' | 'ol'
        return <Tag key={key} className={safeClass || undefined} style={style}>{children}</Tag>
      }
      if (tag === 'li') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        return <li key={key} className={safeClass || undefined} style={style}>{children}</li>
      }
      if (tag === 'dl') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        return <dl key={key} className={safeClass || undefined} style={style}>{children}</dl>
      }
      if (tag === 'dt' || tag === 'dd') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        const Tag = tag as 'dt' | 'dd'
        return <Tag key={key} className={safeClass || undefined} style={style}>{children}</Tag>
      }
      if (tag === 'pre') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const preText = el.textContent || ''
        const asciiTable = /[┌┐└┘┬┴┼├┤│─╔╗╚╝╦╩╬║═]/.test(preText) || /(^|\n)\s*\+[-+]{3,}\+\s*(\n|$)/.test(preText)
          ? parseAsciiBoxTable(preText)
          : null
        if (asciiTable) {
          return (
            <section key={key} className="mt-4 mb-4 overflow-auto max-h-[80vh] rounded-lg border border-gray-200 shadow-sm">
              <table className={['min-w-full border-collapse table-auto text-xs', safeClass].filter(Boolean).join(' ') || undefined}>
                {asciiTable.header ? (
                  <thead className="bg-gray-50 text-gray-900">
                    <tr>
                      {asciiTable.header.map((cell, j) => (
                        <th key={`${key}-h-${j}`} className="px-3 py-2 text-left font-semibold border-b border-gray-200 align-top sticky top-0 z-10 bg-gray-50">
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                ) : null}
                <tbody className="text-gray-900">
                  {asciiTable.rows.map((row, rIdx) => (
                    <tr key={`${key}-r-${rIdx}`} className="odd:bg-white even:bg-gray-50 hover:bg-amber-50 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={`${key}-c-${rIdx}-${cIdx}`} className="px-3 py-2 border-b border-gray-200 align-top">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )
        }
        return (
          <pre
            key={key}
            className={['mt-3 mb-3 overflow-x-auto p-3 rounded border border-gray-200', opts.uiPanelMonospaceTextClass, safeClass]
              .filter(Boolean)
              .join(' ')}
          >
            {preText}
          </pre>
        )
      }
      if (tag === 'code') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        return (
          <code key={key} className={[opts.uiPanelMonospaceTextClass, safeClass].filter(Boolean).join(' ') || undefined}>
            {children}
          </code>
        )
      }
      if (tag === 'table') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        const table = (
          <table
            key={`${key}-table`}
            className={['min-w-full text-sm', safeClass].filter(Boolean).join(' ') || undefined}
            style={style}
          >
            {children}
          </table>
        )
        return (
          <section
            key={key}
            className="mt-4 mb-4 overflow-auto max-h-[80vh] rounded-lg border border-gray-200 shadow-sm"
          >
            {table}
          </section>
        )
      }
      if (tag === 'thead') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        return (
          <thead key={key} className={['bg-gray-50 text-gray-900', safeClass].filter(Boolean).join(' ')} style={style}>
            {children}
          </thead>
        )
      }
      if (tag === 'tbody') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        return (
          <tbody key={key} className={['text-gray-900', safeClass].filter(Boolean).join(' ')} style={style}>
            {children}
          </tbody>
        )
      }
      if (tag === 'tfoot') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        return (
          <tfoot key={key} className={['bg-gray-50 text-gray-900', safeClass].filter(Boolean).join(' ')} style={style}>
            {children}
          </tfoot>
        )
      }
      if (tag === 'tr') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        return (
          <tr
            key={key}
            className={['odd:bg-white even:bg-gray-50 hover:bg-amber-50 transition-colors', safeClass].filter(Boolean).join(' ')}
            style={style}
          >
            {children}
          </tr>
        )
      }
      if (tag === 'th' || tag === 'td') {
        const colSpanRaw = el.getAttribute('colspan') || ''
        const rowSpanRaw = el.getAttribute('rowspan') || ''
        const colSpanN = colSpanRaw ? Number(colSpanRaw) : NaN
        const rowSpanN = rowSpanRaw ? Number(rowSpanRaw) : NaN
        const colSpan = Number.isFinite(colSpanN) && colSpanN > 1 ? Math.floor(colSpanN) : undefined
        const rowSpan = Number.isFinite(rowSpanN) && rowSpanN > 1 ? Math.floor(rowSpanN) : undefined
        const base = tag === 'th' ? 'px-4 py-2 text-left font-semibold border-b border-gray-200 align-top' : 'px-4 py-2 border-b border-gray-200 align-top'
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        const Cell = tag as 'th' | 'td'
        return (
          <Cell key={key} colSpan={colSpan} rowSpan={rowSpan} className={[base, safeClass].filter(Boolean).join(' ')} style={style}>
            {children}
          </Cell>
        )
      }
      if (tag === 'caption') {
        return <caption key={key} className="text-sm text-gray-600 p-2">{children}</caption>
      }
      if (tag === 'colgroup') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        return <colgroup key={key} className={safeClass || undefined} style={style}>{children}</colgroup>
      }
      if (tag === 'col') {
        const spanRaw = el.getAttribute('span') || ''
        const spanN = spanRaw ? Number(spanRaw) : NaN
        const span = Number.isFinite(spanN) && spanN >= 1 && spanN <= 24 ? Math.floor(spanN) : undefined
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        return <col key={key} span={span} className={safeClass || undefined} style={style} />
      }
      if (tag === 'br') {
        return <br key={key} />
      }
      if (tag === 'abbr') {
        const title = el.getAttribute('title') || ''
        const text = el.textContent || ''
        return (
          <abbr
            key={key}
            title={title || undefined}
            className="bg-yellow-100 border-b border-dotted border-yellow-400 cursor-help px-0.5 rounded-sm"
          >
            {text}
          </abbr>
        )
      }
      if (tag === 'span') {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        return <span key={key} className={safeClass || undefined} style={style}>{children}</span>
      }

      if (shouldUnwrapAfterFragmentGate) {
        return <React.Fragment key={key}>{children}</React.Fragment>
      }

      if (tag.includes('-')) {
        const safeClass = filterHtmlPreviewClassName(el.getAttribute('class') || '')
        const style = mergeSafeStyles(
          deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
          parseSafeInlineStyle(el.getAttribute('style') || ''),
        )
        return (
          <section key={key} className={safeClass || undefined} style={style}>
            {children}
          </section>
        )
      }

      return <React.Fragment key={key}>{el.textContent || ''}</React.Fragment>
    }

    const renderedRootChildren = Array.from(root.childNodes).map((n, i) => renderNode(n, i))

    const shouldWrapRootAsImplicitGrid = (() => {
      const elementChildren = Array.from(root.childNodes).filter(n => n.nodeType === NodeRef.ELEMENT_NODE) as Element[]
      const meaningful = elementChildren.filter(el => {
        const tag = el.tagName.toLowerCase()
        if (tag === 'br') return false
        if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'template') return false
        return true
      })
      if (meaningful.length < 2) return false
      if (meaningful.length === 1) return false
      if (meaningful.some(el => {
        const tag = el.tagName.toLowerCase()
        if (tag === 'table') return true
        const cls = String(el.getAttribute('class') || '')
        const style = String(el.getAttribute('style') || '')
        if (/\bgrid\b/.test(cls) || /\binline-grid\b/.test(cls)) return true
        if (/display\s*:\s*(grid|inline-grid)/i.test(style)) return true
        return false
      })) return false

      const gridItemHint = (el: Element): boolean => {
        const cls = String(el.getAttribute('class') || '')
        const style = String(el.getAttribute('style') || '')
        if (/\b(col|row)-(span|start|end)-/.test(cls)) return true
        if (/grid-(column|row)\s*:/i.test(style)) return true
        if (/grid-column\s*:|grid-row\s*:/i.test(style)) return true
        return false
      }

      const hinted = meaningful.filter(gridItemHint)
      if (hinted.length < 2) return false
      const ratio = hinted.length / meaningful.length
      return ratio >= 0.8
    })()

    if (shouldWrapRootAsImplicitGrid) {
      return (
        <section
          className={opts.uiPanelTextFontClass}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '0.75rem', alignItems: 'start' }}
        >
          {renderedRootChildren}
        </section>
      )
    }

    return <section className="space-y-1">{renderedRootChildren}</section>
  } catch {
    return null
  }
}

export const buildMarkdownPreviewMediaKey = (kind: string, startLine: number, idHint: string): string => {
  const k = String(kind || 'media').trim() || 'media'
  const line = Number.isFinite(startLine) && startLine > 0 ? Math.floor(startLine) : 0
  const rawId = String(idHint || '').trim()
  const shortened = rawId.length > 96 ? rawId.slice(0, 96) : rawId
  const normalizedId = shortened.replace(/\s+/g, ' ')
  return `${k}:${line}:${normalizedId}`
}
