import React from 'react'
import { applyMediaProxySrc, normalizeWebpageLikeUrl } from '@/lib/url'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  extractHtmlAttr,
  extractScriptEmbedAnchorHref,
  looksLikeSingleTagBlock,
  normalizeHtmlHrefLikeValue,
  pickFirstSrcsetUrl,
} from 'grph-shared/markdown/mediaHtml'
import {
  buildYouTubeEmbedUrl as buildSharedYouTubeEmbedUrl,
  getYouTubeId as getSharedYouTubeId,
} from 'grph-shared/rich-media/providers'
import { renderSafeHtmlBlockImpl } from './markdownPreviewLinks.safeHtml.render'
import { deriveSafeLayoutStyleFromClassAttrImpl } from './markdownPreviewLinks.layoutStyle.derive'
import { normalizeMarkdownLocalProxyUrl } from './mediaProxyUrl'

export { applyMediaProxySrc, extractScriptEmbedAnchorHref, looksLikeSingleTagBlock, normalizeHtmlHrefLikeValue, pickFirstSrcsetUrl }

export const extractAttr = (html: string, attrName: string): string =>
  extractHtmlAttr(String(html || ''), String(attrName || ''))

export const isAbsoluteWebUrl = (href: string): boolean => {
  const raw = String(href || '').trim()
  if (!raw) return false
  if (raw.startsWith('//')) return true
  return /^https?:\/\//i.test(raw)
}

export const isSafeHref = (href: string): boolean => {
  const raw = String(href || '').trim()
  if (!raw) return false
  if (raw.startsWith('#')) return true
  if (raw.startsWith('/__') || raw.startsWith('/@')) return true
  if (raw.startsWith('/')) return true
  if (raw.startsWith('./') || raw.startsWith('../')) return true
  if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) return true
  if (/^mailto:/i.test(raw) || /^tel:/i.test(raw)) return true
  if (/^(data:|blob:|javascript:)/i.test(raw)) return false
  return /^[^\s<>"']+$/u.test(raw)
}

export const isSafeMediaSrc = (href: string): boolean => {
  const raw = String(href || '').trim()
  if (!raw) return false
  if (raw.startsWith('/__') || raw.startsWith('/@')) return true
  if (raw.startsWith('/')) return true
  if (raw.startsWith('./') || raw.startsWith('../')) return true
  if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) return true
  if (/^data:image\//i.test(raw)) return true
  if (/^blob:/i.test(raw)) return true
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return false
  return /^[^\s<>"']+$/u.test(raw)
}

const toCssPropName = (name: string): keyof React.CSSProperties | null => {
  const raw = String(name || '').trim().toLowerCase()
  if (!raw) return null
  if (raw.includes('(') || raw.includes(')') || raw.includes('{') || raw.includes('}')) return null
  const camel = raw.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())
  return camel as keyof React.CSSProperties
}

export const parseSafeInlineStyle = (raw: string): React.CSSProperties | undefined => {
  const input = String(raw || '').trim()
  if (!input) return undefined
  if (/url\s*\(/i.test(input)) return undefined
  if (/expression\s*\(/i.test(input)) return undefined
  const entries = input.split(';')
  let out: React.CSSProperties | undefined
  for (const part of entries) {
    const seg = String(part || '').trim()
    if (!seg) continue
    const idx = seg.indexOf(':')
    if (idx <= 0) continue
    const keyRaw = seg.slice(0, idx).trim()
    const valueRaw = seg.slice(idx + 1).trim().replace(/\s*!important\s*$/i, '').trim()
    const prop = toCssPropName(keyRaw)
    if (!prop) continue
    if (!valueRaw || valueRaw.length > 200) continue
    if (/[\n\r<>]/.test(valueRaw)) continue
    if (!out) out = {}
    ;(out as Record<string, unknown>)[prop as string] = valueRaw
  }
  return out
}

export const parseHtmlNumberAttr = (raw: string): number | null => {
  const value = String(raw || '').trim()
  if (!value) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return n
}

export const buildMarkdownPreviewMediaKey = (kind: string, startLine: number, idHint: string): string => {
  const k = String(kind || '').trim() || 'unknown'
  const line = Number.isFinite(startLine) ? Math.max(0, Math.floor(startLine)) : 0
  const hint = String(idHint || '')
  return `markdown-media:${k}:${line}:${hint}`
}

export const getYouTubeId = (href: string): string => {
  const raw = String(href || '').trim()
  if (!raw) return ''
  return getSharedYouTubeId(normalizeWebpageLikeUrl(raw)) || ''
}

export const buildYouTubeEmbedUrl = (href: string): string => {
  return buildSharedYouTubeEmbedUrl(normalizeWebpageLikeUrl(href), { includeOrigin: false }) || ''
}

export const shouldRenderStandaloneMediaForLine = (args: {
  href: string
  startLine: number
  markdownLargeDocumentMode?: boolean
  standaloneMediaRenderLineSet?: ReadonlySet<number> | null
}): boolean => {
  if (!String(args.href || '').trim()) return false
  if (!args.markdownLargeDocumentMode) return true
  if (!buildYouTubeEmbedUrl(args.href)) return false
  const lineSet = args.standaloneMediaRenderLineSet || null
  return !lineSet || lineSet.has(Math.max(1, Math.floor(args.startLine || 1)))
}

export const isVideoUrl = (href: string): boolean => {
  const raw = String(href || '').trim()
  if (!raw) return false
  if (/\.(mp4|webm|mov|ogg)(\?|#|$)/i.test(raw)) return true
  if (getYouTubeId(raw)) return true
  const url = normalizeWebpageLikeUrl(raw)
  return /\/(embed|watch)\b/i.test(url) && (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com'))
}

const isInternalRouteHref = (href: string): boolean => {
  const raw = String(href || '').trim()
  if (!raw) return false
  if (raw.startsWith('/__')) return true
  if (raw.startsWith('/@')) return true
  return false
}

const normalizeRelPath = (raw: string): string => {
  const value = String(raw || '').trim().replace(/\\/g, '/').replace(/^\/+/, '')
  const parts = value.split('/').filter(Boolean)
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

const dirnameRel = (path: string): string => {
  const normalized = normalizeRelPath(path)
  if (!normalized) return ''
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return ''
  return normalized.slice(0, idx)
}

const collapseDuplicatePrefix = (path: string, prefix: string): string => {
  const normalizedPath = normalizeRelPath(path)
  const normalizedPrefix = normalizeRelPath(prefix)
  if (!normalizedPath || !normalizedPrefix) return normalizedPath
  const doubled = `${normalizedPrefix}/${normalizedPrefix}/`
  if (normalizedPath.startsWith(doubled)) {
    return `${normalizedPrefix}/${normalizedPath.slice(doubled.length)}`
  }
  return normalizedPath
}

const resolveDocsRootPrefix = (path: string): string => {
  const normalized = normalizeRelPath(path)
  if (!normalized) return ''
  const lowered = normalized.toLowerCase()
  if (lowered === 'docs' || lowered.startsWith('docs/')) return 'docs'
  if (lowered.endsWith('/docs')) return normalized
  const marker = '/docs/'
  const markerIndex = lowered.indexOf(marker)
  if (markerIndex < 0) return ''
  return normalizeRelPath(normalized.slice(0, markerIndex + marker.length - 1))
}

const resolveDocsAwareJoinedPath = (activeRelPath: string, rawHref: string): string => {
  const activeRel = normalizeRelPath(activeRelPath)
  const rawRel = normalizeRelPath(rawHref)
  if (!rawRel) return ''
  const baseDir = dirnameRel(activeRel)
  const docsRootPrefix = resolveDocsRootPrefix(activeRel || baseDir)
  if (!docsRootPrefix) {
    return normalizeRelPath(baseDir ? `${baseDir}/${rawHref}` : rawHref)
  }
  if (rawRel === docsRootPrefix || rawRel.startsWith(`${docsRootPrefix}/`)) {
    return rawRel
  }
  if (rawRel.startsWith('docs/')) {
    const docsRootParent = dirnameRel(docsRootPrefix)
    return normalizeRelPath(docsRootParent ? `${docsRootParent}/${rawRel}` : rawRel)
  }
  if (rawRel.includes(`/${docsRootPrefix}/`)) {
    const repeatedIndex = rawRel.indexOf(`${docsRootPrefix}/`)
    if (repeatedIndex >= 0) return rawRel.slice(repeatedIndex)
  }
  return collapseDuplicatePrefix(normalizeRelPath(baseDir ? `${baseDir}/${rawHref}` : rawHref), docsRootPrefix)
}

export const resolveHref = (href: string, activeDocumentPath: string): string => {
  const raw = String(href || '').trim()
  if (!raw) return ''
  const normalizedLocalProxy = normalizeMarkdownLocalProxyUrl(raw)
  if (normalizedLocalProxy && normalizedLocalProxy !== raw) return normalizedLocalProxy
  if (raw.startsWith('#')) return raw
  if (isInternalRouteHref(raw)) return normalizedLocalProxy || raw
  if (/^(data:|blob:|mailto:|tel:|javascript:)/i.test(raw)) return raw
  if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) return raw

  const activeRaw = String(activeDocumentPath || '').trim().replace(/\\/g, '/')
  const anyImportMeta = import.meta as unknown as { env?: { VITE_CODEBASE_ROOT?: string } }
  const processEnv = typeof process !== 'undefined' ? process.env : undefined
  const codebaseRoot = String(anyImportMeta?.env?.VITE_CODEBASE_ROOT || processEnv?.VITE_CODEBASE_ROOT || '').trim().replace(/\\/g, '/')
  const activeRel = (() => {
    if (!activeRaw) return ''
    if (activeRaw.startsWith('/') && codebaseRoot && (activeRaw === codebaseRoot || activeRaw.startsWith(`${codebaseRoot}/`))) {
      return activeRaw.slice(codebaseRoot.length).replace(/^\/+/, '')
    }
    return activeRaw.replace(/^\/+/, '')
  })()
  const joined = resolveDocsAwareJoinedPath(activeRel, raw)
  if (!joined) return ''
  return `/__codebase_asset?path=${encodeURIComponent(joined)}`
}

export const deriveSafeLayoutStyleFromClassAttr = (rawClass: string): React.CSSProperties | undefined =>
  deriveSafeLayoutStyleFromClassAttrImpl(rawClass)

export const buildAnchorAttrs = (href: string): { target?: string; rel?: string; className: string } => {
  const value = String(href || '').trim()
  const external = isAbsoluteWebUrl(value)
  return {
    target: external ? '_blank' : undefined,
    rel: external ? 'noopener noreferrer' : undefined,
    className: `${UI_THEME_TOKENS.text.secondary} underline decoration-dotted underline-offset-2`,
  }
}

export const renderSafeHtmlBlock = (
  rawHtml: string,
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
): React.ReactNode => {
  const SAFE_HTML_ID_RE = /^[A-Za-z0-9^][A-Za-z0-9^:._-]{0,255}$/
  const sanitizeHtmlId = (idRaw: string): string => {
    const value = String(idRaw || '').trim()
    if (!value) return ''
    if (SAFE_HTML_ID_RE.test(value)) return value
    const cleaned = value.replace(/[^A-Za-z0-9^:._-]/g, '').slice(0, 256)
    if (SAFE_HTML_ID_RE.test(cleaned)) return cleaned
    return ''
  }
  const filterHtmlPreviewClassName = (classRaw: string): string => {
    const raw = String(classRaw || '').trim()
    if (!raw) return ''
    const parts = raw.split(/\s+/).filter(Boolean)
    const kept: string[] = []
    for (const p of parts) {
      if (kept.length >= 32) break
      if (!/^[A-Za-z0-9:_-]{1,64}$/.test(p)) continue
      kept.push(p)
    }
    return kept.join(' ')
  }
  const mergeSafeStyles = (base: React.CSSProperties | undefined, override: React.CSSProperties | undefined): React.CSSProperties | undefined => {
    if (!base) return override
    if (!override) return base
    return { ...base, ...override }
  }
  const sanitizeSrcDocCached = (() => {
    const cache = new Map<string, string>()
    return (srcDoc: string): string => {
      const raw = String(srcDoc || '')
      if (!raw) return ''
      const cached = cache.get(raw)
      if (typeof cached === 'string') return cached
      let cleaned = raw
      cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '')
      cleaned = cleaned.replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
      cleaned = cleaned.replace(/\son\w+\s*=\s*'[^']*'/gi, '')
      cleaned = cleaned.replace(/javascript:/gi, '')
      if (cleaned.length > 20000) cleaned = cleaned.slice(0, 20000)
      if (cache.size >= 50) cache.clear()
      cache.set(raw, cleaned)
      return cleaned
    }
  })()
  return renderSafeHtmlBlockImpl(rawHtml, opts, {
    isSafeHref,
    isSafeMediaSrc,
    resolveHref,
    applyMediaProxySrc,
    buildAnchorAttrs,
    sanitizeHtmlId,
    filterHtmlPreviewClassName,
    mergeSafeStyles,
    deriveSafeLayoutStyleFromClassAttr,
    parseSafeInlineStyle,
    parseHtmlNumberAttr,
    pickFirstSrcsetUrl,
    sanitizeSrcDocCached,
  })
}
