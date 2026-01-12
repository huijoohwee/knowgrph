import React from 'react'
import { buildFsUrlForRelPath } from '@/features/panels/hooks/markdownPipelineActions'
import { normalizeGitHubBlobLikeUrl, applyMediaProxySrc as applyMediaProxySrcCore } from '@/lib/url'
import { uiPrimaryLinkClassName } from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles'

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
  if (trimmed.startsWith('/')) return true
  if (trimmed.startsWith('./') || trimmed.startsWith('../')) return true
  if (isAbsoluteWebUrl(trimmed)) return true
  return SAFE_RELATIVE_PATH_RE.test(trimmed)
}

export const isSafeMediaSrc = (href: string): boolean => {
  const trimmed = String(href || '').trim()
  if (!trimmed) return false
  if (/^(javascript|data):/i.test(trimmed)) return false
  if (trimmed.startsWith('#')) return false
  if (/^mailto:/i.test(trimmed)) return false
  if (trimmed.startsWith('/')) return true
  if (trimmed.startsWith('./') || trimmed.startsWith('../')) return true
  if (isAbsoluteWebUrl(trimmed)) return true
  return SAFE_RELATIVE_PATH_RE.test(trimmed)
}

export const applyMediaProxySrc = (src: string): string => applyMediaProxySrcCore(src)

export const resolveHref = (href: string, activeDocumentPath: string): string => {
  const raw = String(href || '').trim()
  if (!raw) return ''
  if (raw.startsWith('#')) return raw
  if (isAbsoluteWebUrl(raw)) {
    const normalizedAbs = normalizeGitHubBlobLikeUrl(raw) ?? raw
    return normalizedAbs
  }
  const basePath = String(activeDocumentPath || '').split('#')[0].trim()
  if (basePath && isAbsoluteWebUrl(basePath)) {
    try {
      const resolved = new URL(raw, basePath).toString()
      const normalized = normalizeGitHubBlobLikeUrl(resolved) ?? resolved
      return normalized
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

const sanitizeHtmlClassName = (raw: string): string => {
  const value = String(raw || '').trim()
  if (!value) return ''
  const safe = value.replace(/[^]a-zA-Z0-9 _:[/[\].%-]/g, ' ').replace(/\s+/g, ' ').trim()
  return safe
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

    const fragmentOpts = opts.fragmentOptions
    const fragmentEnabled = !!fragmentOpts && !!fragmentOpts.enabled
    const fragmentClassNames = fragmentOpts?.classNames || []
    const fragmentTags = fragmentOpts?.tags || []
    let fragmentIndex = 0

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

      let isFragmentTag = false
      let isFragmentClass = false
      let shouldUnwrapAfterFragmentGate = false
      if (fragmentEnabled) {
        const tagMatch = fragmentTags.some(name => name.toLowerCase() === tag)
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
        const current = Number.isFinite(fragmentOpts?.currentStep)
          ? Math.max(0, fragmentOpts?.currentStep || 0)
          : 0
        const visibleCount = fragmentEnabled ? Math.min(items.length, current) : items.length
        const ListTag = (ordered ? 'ol' : 'ul') as 'ol' | 'ul'
        const listClass = ordered ? 'list-decimal' : 'list-disc'
        return (
          <div key={key} className={['mt-2 mb-2', opts.uiPanelTextFontClass].filter(Boolean).join(' ')}>
            <ListTag className={[listClass, 'pl-5'].join(' ')}>
              {items.slice(0, visibleCount).map((text, idx) => (
                <li key={idx}>{text}</li>
              ))}
            </ListTag>
          </div>
        )
      }

      if (tag === 'a') {
        const hrefRaw = el.getAttribute('href') || ''
        if (!hrefRaw || !isSafeHref(hrefRaw)) return <React.Fragment key={key}>{children}</React.Fragment>
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

      if (tag === 'img') {
        const srcRaw = el.getAttribute('src') || ''
        if (!srcRaw || !isSafeHref(srcRaw) || !isSafeMediaSrc(srcRaw)) return <React.Fragment key={key}>{''}</React.Fragment>
        const resolved = resolveHref(srcRaw, opts.activeDocumentPath)
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
            style={Object.keys(style).length ? style : undefined}
            className="inline-block max-w-full h-auto rounded border border-gray-200"
          />
        )
      }

      if (tag === 'video') {
        const srcRaw = el.getAttribute('src') || ''
        const srcCandidate = srcRaw || (el.querySelector('source')?.getAttribute('src') || '')
        if (!srcCandidate || !isSafeHref(srcCandidate) || !isSafeMediaSrc(srcCandidate)) return <React.Fragment key={key}>{''}</React.Fragment>
        const resolved = resolveHref(srcCandidate, opts.activeDocumentPath)
        const src = applyMediaProxySrc(resolved)
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
        const align = (el.getAttribute('align') || '').toLowerCase()
        const cls = ['mt-2 mb-2', opts.uiPanelTextFontClass]
        if (align === 'center') cls.push('text-center')
        const safeClass = sanitizeHtmlClassName(el.getAttribute('class') || '')
        if (safeClass) cls.push(safeClass)
        return (
          <p key={key} className={cls.join(' ')}>
            {children}
          </p>
        )
      }

      if (tag === 'center') {
        return (
          <div key={key} className="text-center">
            {children}
          </div>
        )
      }

      if (tag === 'div') {
        const align = (el.getAttribute('align') || '').toLowerCase()
        const cls = [opts.uiPanelTextFontClass]
        if (align === 'center') cls.push('text-center')
        const safeClass = sanitizeHtmlClassName(el.getAttribute('class') || '')
        if (safeClass) cls.push(safeClass)
        const className = cls.filter(Boolean).join(' ')
        return <div key={key} className={className || undefined}>{children}</div>
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
        const safeClass = sanitizeHtmlClassName(el.getAttribute('class') || '')
        return <span key={key} className={safeClass || undefined}>{children}</span>
      }

      if (shouldUnwrapAfterFragmentGate) {
        return <React.Fragment key={key}>{children}</React.Fragment>
      }

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
