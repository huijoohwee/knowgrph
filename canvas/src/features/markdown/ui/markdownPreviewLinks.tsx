import React from 'react'
import { buildFsUrlForRelPath } from '@/features/panels/hooks/markdownPipelineActions'

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

export const isAbsoluteWebUrl = (href: string): boolean =>
  /^https?:\/\//i.test(href) || /^mailto:/i.test(href)

export const isSafeHref = (href: string): boolean => {
  const trimmed = String(href || '').trim()
  if (!trimmed) return false
  if (trimmed.startsWith('#')) return true
  if (trimmed.startsWith('/')) return true
  if (trimmed.startsWith('./') || trimmed.startsWith('../')) return true
  if (isAbsoluteWebUrl(trimmed)) return true
  return /^[a-zA-Z0-9._-]+(\/[a-zA-Z0-9._-]+)*(\.[a-zA-Z0-9]+)?([?#].*)?$/.test(trimmed)
}

export const isSafeMediaSrc = (href: string): boolean => {
  const trimmed = String(href || '').trim()
  if (!trimmed) return false
  if (trimmed.startsWith('/')) return true
  if (trimmed.startsWith('./') || trimmed.startsWith('../')) return true
  return /^https?:\/\//i.test(trimmed)
}

export const resolveHref = (href: string, activeDocumentPath: string): string => {
  const raw = String(href || '').trim()
  if (!raw) return ''
  if (raw.startsWith('#') || isAbsoluteWebUrl(raw)) return raw
  const basePath = String(activeDocumentPath || '').split('#')[0].trim()
  if (basePath && isAbsoluteWebUrl(basePath)) {
    try {
      return new URL(raw, basePath).toString()
    } catch {
      return raw
    }
  }
  const baseDir = basePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/')
  const asRel = raw.startsWith('/') ? raw.replace(/^\/+/, '') : joinRelPaths(baseDir, raw)
  const fsUrl = buildFsUrlForRelPath(asRel)
  return fsUrl || raw
}

export const getYouTubeId = (href: string): string | null => {
  try {
    const url = new URL(href)
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.replace(/^\/+/, '').trim()
      return id || null
    }
    if (url.hostname.endsWith('youtube.com')) {
      const id = url.searchParams.get('v') || ''
      return id.trim() || null
    }
  } catch {
    return null
  }
  return null
}

export const getVimeoId = (href: string): string | null => {
  try {
    const url = new URL(href)
    if (!url.hostname.endsWith('vimeo.com')) return null
    const parts = url.pathname.split('/').filter(Boolean)
    const last = parts[parts.length - 1] || ''
    return /^\d+$/.test(last) ? last : null
  } catch {
    return null
  }
}

export const isVideoUrl = (href: string): boolean =>
  /\.(mp4|webm|ogg)(\?|#|$)/i.test(href)

export const looksLikeSingleTagBlock = (html: string, tag: 'iframe' | 'video' | 'img'): boolean => {
  const raw = String(html || '').trim()
  if (!raw) return false
  if (tag === 'img') return new RegExp(`^<${tag}\\b[^>]*\\/?>$`, 'i').test(raw)
  return new RegExp(`^<${tag}\\b[\\s\\S]*>(?:[\\s\\S]*<\\/${tag}>\\s*)?$`, 'i').test(raw)
}

export const extractAttr = (html: string, attr: string): string => {
  const re = new RegExp(`${attr}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^\\s>]+))`, 'i')
  const m = String(html || '').match(re)
  return String(m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim()
}

export const parseHtmlNumberAttr = (raw: string): number | null => {
  const s = String(raw || '').trim()
  if (!s) return null
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export const renderSafeHtmlBlock = (
  html: string,
  opts: {
    activeDocumentPath: string
    uiPanelMonospaceTextClass: string
    markdownPresentationMode: boolean
    renderNodeText: (text: string, key: React.Key) => React.ReactNode
  },
): React.ReactNode | null => {
  if (typeof window === 'undefined') return null
  if (typeof DOMParser === 'undefined') return null
  const raw = String(html || '').trim()
  if (!raw) return null
  if (!raw.includes('<')) return null
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div>${raw}</div>`, 'text/html')
    const root = doc.body.firstElementChild
    if (!root) return null

    const renderNode = (node: ChildNode, key: React.Key): React.ReactNode => {
      if (node.nodeType === Node.TEXT_NODE) {
        return opts.renderNodeText(node.textContent || '', key)
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return <React.Fragment key={key}>{''}</React.Fragment>
      }
      const el = node as Element
      const tag = el.tagName.toLowerCase()
      const children = Array.from(el.childNodes).map((n, i) => renderNode(n, `${key}-${i}`))

      if (tag === 'a') {
        const hrefRaw = el.getAttribute('href') || ''
        if (!hrefRaw || !isSafeHref(hrefRaw)) return <React.Fragment key={key}>{children}</React.Fragment>
        const href = resolveHref(hrefRaw, opts.activeDocumentPath)
        return (
          <a
            key={key}
            href={href || undefined}
            target={href && href.startsWith('#') ? undefined : '_blank'}
            rel={href && href.startsWith('#') ? undefined : 'noreferrer'}
            className="text-blue-600 hover:underline break-words"
          >
            {children}
          </a>
        )
      }

      if (tag === 'img') {
        const srcRaw = el.getAttribute('src') || ''
        if (!srcRaw || !isSafeHref(srcRaw) || !isSafeMediaSrc(srcRaw)) return <React.Fragment key={key}>{''}</React.Fragment>
        const src = resolveHref(srcRaw, opts.activeDocumentPath)
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
            style={Object.keys(style).length ? style : undefined}
            className="inline-block max-w-full h-auto rounded border border-gray-200"
          />
        )
      }

      if (tag === 'video') {
        const srcRaw = el.getAttribute('src') || ''
        const srcCandidate = srcRaw || (el.querySelector('source')?.getAttribute('src') || '')
        if (!srcCandidate || !isSafeHref(srcCandidate) || !isSafeMediaSrc(srcCandidate)) return <React.Fragment key={key}>{''}</React.Fragment>
        const src = resolveHref(srcCandidate, opts.activeDocumentPath)
        return (
          <video key={key} controls className="w-full max-w-2xl rounded border border-gray-200" src={src} />
        )
      }

      if (tag === 'iframe') {
        const srcRaw = el.getAttribute('src') || ''
        if (!srcRaw || !isSafeHref(srcRaw) || !isSafeMediaSrc(srcRaw)) return <React.Fragment key={key}>{''}</React.Fragment>
        const src = resolveHref(srcRaw, opts.activeDocumentPath)
        return (
          <div key={key} className={opts.markdownPresentationMode ? 'aspect-video w-full' : 'aspect-video w-full max-w-xl'}>
            <iframe
              src={src}
              title={el.getAttribute('title') || 'Embedded content'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation"
              className="w-full h-full rounded border border-gray-200"
            />
          </div>
        )
      }

      if (tag === 'p') {
        return (
          <p key={key} className="mt-2 mb-2">
            {children}
          </p>
        )
      }

      if (tag === 'div') return <div key={key}>{children}</div>
      if (tag === 'span') return <span key={key}>{children}</span>

      return <React.Fragment key={key}>{el.textContent || ''}</React.Fragment>
    }

    return (
      <div className="space-y-1">
        {Array.from(root.childNodes).map((n, i) => renderNode(n, i))}
      </div>
    )
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
