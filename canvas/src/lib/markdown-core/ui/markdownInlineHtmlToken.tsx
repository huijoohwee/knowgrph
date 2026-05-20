import React from 'react'
import type { TokensHTML } from '@/features/markdown/ui/MarkdownTokens'
import {
  buildAnchorAttrs,
  isSafeHref,
  isSafeMediaSrc,
  renderSafeHtmlBlock,
  resolveHref,
} from '@/features/markdown/ui/markdownPreviewLinks'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { InlineRenderOpts } from '@/features/markdown/ui/MarkdownRendererTypes'
import { MediaIframe, MediaWebpageSnapshot } from '@/features/markdown/ui/MarkdownMediaUi'
import { useGraphStore } from '@/hooks/useGraphStore'
import { parseHtmlFragmentCached } from './markdownHtmlParseCache'

const SAFE_HTML_ID_RE = /^[A-Za-z0-9^][A-Za-z0-9^:._-]{0,255}$/

const BLOCK_TAGS = new Set([
  'div',
  'section',
  'main',
  'article',
  'aside',
  'nav',
  'header',
  'footer',
  'ul',
  'ol',
  'table',
  'details',
  'figure',
  'img',
  'picture',
  'iframe',
  'video',
  'audio',
  'svg',
])

export const renderInlineHtmlToken = (args: {
  token: TokensHTML
  key: string
  opts: InlineRenderOpts
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  inlineCodeClassName: string
  fragmentIndexRef: React.MutableRefObject<number>
}): React.ReactNode => {
  const raw = String(args.token.text || '').trim()
  if (!raw) return <React.Fragment key={args.key}>{''}</React.Fragment>
  const rawLower = raw.toLowerCase()
  if (/^<\s*!--[\s\S]*?--\s*>$/.test(rawLower)) return <React.Fragment key={args.key}>{''}</React.Fragment>
  if (/^<\s*\/\s*a\b[^>]*>$/.test(rawLower)) return <React.Fragment key={args.key}>{''}</React.Fragment>
  if (
    rawLower.startsWith('<v-click') ||
    rawLower.startsWith('</v-click') ||
    rawLower.startsWith('<v-mark') ||
    rawLower.startsWith('</v-mark')
  ) {
    const isStandalone =
      (rawLower.startsWith('<v-click') && !rawLower.includes('</v-click>')) ||
      (rawLower.startsWith('</v-click') && !rawLower.includes('<v-click')) ||
      (rawLower.startsWith('<v-mark') && !rawLower.includes('</v-mark>')) ||
      (rawLower.startsWith('</v-mark') && !rawLower.includes('<v-mark'))
    if (isStandalone) return <React.Fragment key={args.key}>{''}</React.Fragment>
  }
  if (typeof window === 'undefined') return <React.Fragment key={args.key}>{raw}</React.Fragment>
  try {
    const parsed = parseHtmlFragmentCached(raw)
    const el = parsed?.firstElement || null
    if (!el) return <React.Fragment key={args.key}>{raw}</React.Fragment>
    const tag = el.tagName.toLowerCase()
    if (BLOCK_TAGS.has(tag)) {
      const hasClose = rawLower.includes(`</${tag}`) || /\/\s*>$/.test(rawLower)
      if (hasClose) {
        if (tag === 'iframe') {
          const srcRaw = el.getAttribute('src') || el.getAttribute('data-src') || ''
          if (srcRaw && isSafeHref(srcRaw) && isSafeMediaSrc(srcRaw)) {
            const src = resolveHref(srcRaw, args.opts.activeDocumentPath)
            const preferEmbed = useGraphStore.getState().richMediaPanelMode === 'embed'
            if (!preferEmbed && /^https?:/i.test(src)) {
              return (
                <MediaWebpageSnapshot
                  key={args.key}
                  url={src}
                  title={el.getAttribute('title') || 'Embedded content'}
                  presentationMode={args.opts.markdownPresentationMode}
                />
              )
            }
            return (
              <MediaIframe
                key={args.key}
                src={src}
                title={el.getAttribute('title') || 'Embedded content'}
                presentationMode={args.opts.markdownPresentationMode}
              />
            )
          }
        }
        const rendered = renderSafeHtmlBlock(raw, {
          activeDocumentPath: args.opts.activeDocumentPath,
          uiPanelTextFontClass: args.uiPanelTextFontClass,
          uiPanelMonospaceTextClass: args.uiPanelMonospaceTextClass,
          markdownPresentationMode: args.opts.markdownPresentationMode,
          renderNodeText: (text, key) => <React.Fragment key={key}>{text}</React.Fragment>,
          fragmentOptions: args.opts.fragmentOptions || null,
        })
        if (rendered) return <React.Fragment key={args.key}>{rendered}</React.Fragment>
      }
    }
    if (args.opts.fragmentOptions?.enabled) {
      const tagMatch = args.opts.fragmentOptions.tags.some(name => name.toLowerCase() === tag)
      const classMatch =
        args.opts.fragmentOptions.classNames.length > 0 && (el.classList?.length || 0) > 0
          ? args.opts.fragmentOptions.classNames.some(name => el.classList.contains(name))
          : false
      if (tagMatch || classMatch) {
        const explicitIndexAttr = el.getAttribute('data-fragment-index') || el.getAttribute('at') || null
        let idx: number
        if (explicitIndexAttr != null && explicitIndexAttr.trim()) {
          const parsedIndex = Number.parseInt(explicitIndexAttr.trim(), 10)
          idx = Number.isFinite(parsedIndex) && parsedIndex > 0 ? parsedIndex : 0
        } else {
          args.fragmentIndexRef.current += 1
          idx = args.fragmentIndexRef.current
        }
        const current = Number.isFinite(args.opts.fragmentOptions.currentStep)
          ? Math.max(0, args.opts.fragmentOptions.currentStep || 0)
          : 0
        if (idx <= 0 || current < idx) return <React.Fragment key={args.key}>{''}</React.Fragment>
      }
    }
    if (tag === 'v-click') return <React.Fragment key={args.key}>{el.textContent || ''}</React.Fragment>
    if (tag === 'v-mark') {
      const type = String(el.getAttribute('type') || '').trim().toLowerCase()
      const color = String(el.getAttribute('color') || '').trim().toLowerCase()
      const cls: string[] = []
      if (type === 'circle') cls.push('inline-block border border-current rounded-full px-1')
      if (type === 'underline') cls.push('underline decoration-2 underline-offset-2')
      if (type === 'strike-through') cls.push('line-through')
      if (color === 'red') cls.push(`${UI_THEME_TOKENS.status.error} px-1 rounded-sm`)
      if (color === 'yellow') cls.push(`${UI_THEME_TOKENS.status.warning} px-1 rounded-sm`)
      return <span key={args.key} className={cls.join(' ') || undefined}>{el.textContent || ''}</span>
    }
    if (tag === 'abbr') {
      const title = el.getAttribute('title') || ''
      return (
        <abbr
          key={args.key}
          title={title || undefined}
          className={`${UI_THEME_TOKENS.status.warning} border-b border-dotted cursor-help px-0.5 rounded-sm`}
        >
          {el.textContent || ''}
        </abbr>
      )
    }
    if (tag === 'span') {
      return <span key={args.key} className={el.getAttribute('class') || undefined}>{el.textContent || ''}</span>
    }
    if (tag === 'u') {
      return <u key={args.key}>{el.textContent || ''}</u>
    }
    if (tag === 'strong' || tag === 'b') {
      return <strong key={args.key}>{el.textContent || ''}</strong>
    }
    if (tag === 'em' || tag === 'i') {
      return <em key={args.key}>{el.textContent || ''}</em>
    }
    if (tag === 's' || tag === 'del') {
      return <del key={args.key}>{el.textContent || ''}</del>
    }
    if (tag === 'sub') {
      return <sub key={args.key}>{el.textContent || ''}</sub>
    }
    if (tag === 'sup') {
      return <sup key={args.key}>{el.textContent || ''}</sup>
    }
    if (tag === 'mark') {
      return (
        <mark key={args.key} className={`${UI_THEME_TOKENS.status.warning} px-0.5 rounded-sm`}>
          {el.textContent || ''}
        </mark>
      )
    }
    if (tag === 'a') {
      const hrefRaw = String(el.getAttribute('href') || el.getAttribute('xlink:href') || '').trim()
      if (hrefRaw && isSafeHref(hrefRaw)) {
        const href = resolveHref(hrefRaw, args.opts.activeDocumentPath)
        const anchor = buildAnchorAttrs(href)
        return (
          <a key={args.key} href={href || undefined} target={anchor.target} rel={anchor.rel} className={anchor.className}>
            {el.textContent || href}
          </a>
        )
      }
      const idRaw = String(el.getAttribute('id') || '').trim()
      if (idRaw && SAFE_HTML_ID_RE.test(idRaw)) {
        return <a key={args.key} id={idRaw} className="block h-0 scroll-mt-16" aria-hidden />
      }
      return <React.Fragment key={args.key}>{raw}</React.Fragment>
    }
    if (tag === 'br') return <br key={args.key} />
    if (tag === 'code') return <code key={args.key} className={args.inlineCodeClassName}>{el.textContent || ''}</code>
    if (tag === 'pre') {
      const codeEl = el.querySelector('code')
      const text = codeEl ? codeEl.textContent || '' : el.textContent || ''
      return (
        <pre
          key={args.key}
          className={`inline-block align-top max-w-full overflow-auto rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} px-2 py-1`}
        >
          <code className={args.uiPanelMonospaceTextClass}>{text}</code>
        </pre>
      )
    }
    return <React.Fragment key={args.key}>{el.textContent || raw}</React.Fragment>
  } catch {
    return <React.Fragment key={args.key}>{raw}</React.Fragment>
  }
}
