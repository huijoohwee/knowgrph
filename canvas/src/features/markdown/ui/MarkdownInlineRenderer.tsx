import React from 'react'
import katex from 'katex'
import type {
  Token,
  TokensGeneric,
  TokensText,
  TokensStrong,
  TokensEm,
  TokensDel,
  TokensLink,
  TokensImage,
  TokensCode,
  TokensMath,
  TokensHTML,
  TokensSub,
  TokensSup,
  TokensMark,
  TokensFootnoteRef,
} from './MarkdownTokens'
import { applyMediaProxySrc, isAbsoluteWebUrl, isSafeHref, resolveHref, buildAnchorAttrs } from '@/features/markdown/ui/markdownPreviewLinks'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { InlineRenderOpts } from './MarkdownRendererTypes'

const splitPlainUrls = (text: string): Array<{ kind: 'text' | 'url'; value: string }> => {
  const raw = String(text || '')
  if (!raw) return [{ kind: 'text', value: '' }]
  const re = /https?:\/\/[^\s<>()]+/g
  const out: Array<{ kind: 'text' | 'url'; value: string }> = []
  let last = 0
  for (;;) {
    const m = re.exec(raw)
    if (!m) break
    const start = m.index
    const end = start + m[0].length
    if (start > last) out.push({ kind: 'text', value: raw.slice(last, start) })
    out.push({ kind: 'url', value: m[0] })
    last = end
  }
  if (last < raw.length) out.push({ kind: 'text', value: raw.slice(last) })
  return out.length ? out : [{ kind: 'text', value: raw }]
}

export const renderInlineTokens = (tokens: Token[] | undefined, opts: InlineRenderOpts): React.ReactNode => {
  const { activeDocumentPath, uiPanelMonospaceTextClass } = opts
  const fragmentOpts = opts.fragmentOptions || null
  let fragmentIndex = 0

  const renderTokens = (subTokens: Token[] | undefined, insideLink: boolean): React.ReactNode => {
    const list = Array.isArray(subTokens) ? subTokens : []
    return list.map((t, i) => renderOne(t, i, insideLink))
  }

  const renderOne = (t: Token, i: number, insideLink: boolean): React.ReactNode => {
    const key = `${t.type}:${i}`
    const tt = t as unknown as TokensGeneric
    if (tt.type === 'text') {
      const text = String((t as unknown as TokensText).text || '')
      if (insideLink) {
        return <React.Fragment key={key}>{text}</React.Fragment>
      }
      const parts = splitPlainUrls(text)
      if (parts.length === 1 && parts[0]?.kind === 'text') {
        return <React.Fragment key={key}>{parts[0].value}</React.Fragment>
      }
      return (
        <React.Fragment key={key}>
          {parts.map((p, j) => {
            const k = `${key}:${j}`
            if (p.kind !== 'url') return <React.Fragment key={k}>{p.value}</React.Fragment>
            const hrefRaw = p.value.trim()
            if (!hrefRaw || !isAbsoluteWebUrl(hrefRaw) || !isSafeHref(hrefRaw)) {
              return <React.Fragment key={k}>{p.value}</React.Fragment>
            }
            const anchor = buildAnchorAttrs(hrefRaw)
            return (
              <a
                key={k}
                href={hrefRaw}
                target={anchor.target}
                rel={anchor.rel}
                className={anchor.className}
              >
                {hrefRaw}
              </a>
            )
          })}
        </React.Fragment>
      )
    }
    if (tt.type === 'strong') {
      return <strong key={key}>{renderTokens((t as unknown as TokensStrong).tokens, insideLink)}</strong>
    }
    if (tt.type === 'em') {
      return <em key={key}>{renderTokens((t as unknown as TokensEm).tokens, insideLink)}</em>
    }
    if (tt.type === 'del') {
      return <del key={key}>{renderTokens((t as unknown as TokensDel).tokens, insideLink)}</del>
    }
    if (tt.type === 'sub') {
      return <sub key={key}>{renderTokens((t as unknown as TokensSub).tokens, insideLink)}</sub>
    }
    if (tt.type === 'sup') {
      return <sup key={key}>{renderTokens((t as unknown as TokensSup).tokens, insideLink)}</sup>
    }
    if (tt.type === 'mark') {
      return (
        <mark key={key} className={`${UI_THEME_TOKENS.status.warning} px-0.5 rounded-sm`}>
          {renderTokens((t as unknown as TokensMark).tokens, insideLink)}
        </mark>
      )
    }
    if (tt.type === 'footnote_ref') {
      const ref = t as unknown as TokensFootnoteRef
      return (
        <sup key={key} id={`fnref${ref.id}`} className="scroll-mt-16">
          <a
            href={`#fn${ref.id}`}
            className={`${UI_THEME_TOKENS.icon.active} no-underline font-medium px-0.5`}
            aria-describedby={`fn${ref.id}`}
          >
            {ref.label}
          </a>
        </sup>
      )
    }
    if (tt.type === 'br') return <br key={key} />
    if (tt.type === 'link') {
      const link = t as unknown as TokensLink
      const href = isSafeHref(link.href) ? resolveHref(link.href, activeDocumentPath) : ''
      const anchor = buildAnchorAttrs(href)
      return (
        <a
          key={key}
          href={href || undefined}
          target={anchor.target}
          rel={anchor.rel}
          className={anchor.className}
        >
          {renderTokens(link.tokens, true)}
        </a>
      )
    }
    if (tt.type === 'image') {
      const img = t as unknown as TokensImage
      const resolved = isSafeHref(img.href) ? resolveHref(img.href, activeDocumentPath) : ''
      const src = applyMediaProxySrc(resolved)
      const alt = String(img.text || '')
      return (
        <img
          key={key}
          src={src || undefined}
          alt={alt}
          loading="lazy"
          className={`max-w-full h-auto rounded border ${UI_THEME_TOKENS.panel.border}`}
        />
      )
    }
    if (tt.type === 'code') {
      return (
        <code key={key} className={[uiPanelMonospaceTextClass, UI_THEME_TOKENS.code.bg, UI_THEME_TOKENS.code.text, 'border', UI_THEME_TOKENS.code.border, 'px-1.5 py-0.5 rounded text-sm'].filter(Boolean).join(' ')}>
          {(t as unknown as TokensCode).text}
        </code>
      )
    }
    if (tt.type === 'math') {
      const m = t as unknown as TokensMath
      let html = ''
      try {
        html = katex.renderToString(m.tex, {
          throwOnError: false,
          displayMode: !!m.display,
          strict: 'warn',
        })
      } catch {
        html = m.tex
      }
      if (m.display) {
        return (
          <span
            key={key}
            className="block my-3 overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
      }
      return (
        <span
          key={key}
          className="inline-block"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )
    }
    if (tt.type === 'html') {
      const raw = String((t as unknown as TokensHTML).text || '').trim()
      if (!raw) {
        return <React.Fragment key={key}>{''}</React.Fragment>
      }
      const rawLower = raw.toLowerCase()
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
        if (isStandalone) {
          return <React.Fragment key={key}>{''}</React.Fragment>
        }
      }
      if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
        try {
          const parser = new DOMParser()
          const doc = parser.parseFromString(raw, 'text/html')
          const el = doc.body.firstElementChild
          if (!el) {
            return <React.Fragment key={key}>{raw}</React.Fragment>
          }
          const tag = el.tagName.toLowerCase()
          if (fragmentOpts?.enabled) {
            const tagMatch = fragmentOpts.tags.some(name => name.toLowerCase() === tag)
            const classMatch =
              fragmentOpts.classNames.length > 0 && (el.classList?.length || 0) > 0
                ? fragmentOpts.classNames.some(name => el.classList.contains(name))
                : false
            if (tagMatch || classMatch) {
              const explicitIndexAttr =
                el.getAttribute('data-fragment-index') || el.getAttribute('at') || null
              let idx: number
              if (explicitIndexAttr != null && explicitIndexAttr.trim()) {
                const parsed = Number.parseInt(explicitIndexAttr.trim(), 10)
                idx = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
              } else {
                fragmentIndex += 1
                idx = fragmentIndex
              }
              const current = Number.isFinite(fragmentOpts.currentStep)
                ? Math.max(0, fragmentOpts.currentStep || 0)
                : 0
              if (idx <= 0 || current < idx) {
                return <React.Fragment key={key}>{''}</React.Fragment>
              }
            }
          }
          if (tag === 'v-click') {
            return <React.Fragment key={key}>{el.textContent || ''}</React.Fragment>
          }
          if (tag === 'v-mark') {
            const type = String(el.getAttribute('type') || '').trim().toLowerCase()
            const color = String(el.getAttribute('color') || '').trim().toLowerCase()
            const cls: string[] = []
            if (type === 'circle') cls.push('inline-block border border-current rounded-full px-1')
            if (type === 'underline') cls.push('underline decoration-2 underline-offset-2')
            if (type === 'strike-through') cls.push('line-through')
            if (color === 'red') cls.push(`${UI_THEME_TOKENS.status.error} px-1 rounded-sm`)
            if (color === 'yellow') cls.push(`${UI_THEME_TOKENS.status.warning} px-1 rounded-sm`)
            if (cls.length) {
              return (
                <span key={key} className={cls.join(' ')}>
                  {el.textContent || ''}
                </span>
              )
            }
            return <span key={key}>{el.textContent || ''}</span>
          }
          if (tag === 'abbr') {
            const title = el.getAttribute('title') || ''
            const text = el.textContent || ''
            return (
              <abbr
                key={key}
                title={title || undefined}
                className={`${UI_THEME_TOKENS.status.warning} border-b border-dotted cursor-help px-0.5 rounded-sm`}
              >
                {text}
              </abbr>
            )
          }
          if (tag === 'span') {
            const className = el.getAttribute('class') || undefined
            const text = el.textContent || ''
            return (
              <span key={key} className={className}>
                {text}
              </span>
            )
          }
          if (tag === 'br') {
            return <br key={key} />
          }
          if (tag === 'code') {
            const text = el.textContent || ''
            return (
              <code key={key} className={uiPanelMonospaceTextClass}>
                {text}
              </code>
            )
          }
          if (tag === 'pre') {
            const codeEl = el.querySelector('code')
            const text = codeEl ? codeEl.textContent || '' : el.textContent || ''
            return (
              <pre
                key={key}
                className={`inline-block align-top max-w-full overflow-auto rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} px-2 py-1`}
              >
                <code className={uiPanelMonospaceTextClass}>{text}</code>
              </pre>
            )
          }
          const fallbackText = el && el.textContent ? el.textContent : raw
          return <React.Fragment key={key}>{fallbackText}</React.Fragment>
        } catch {
          return <React.Fragment key={key}>{raw}</React.Fragment>
        }
      }
      return <React.Fragment key={key}>{raw}</React.Fragment>
    }
    if ((t as unknown as { tokens?: unknown }).tokens) {
      return (
        <React.Fragment key={key}>
          {renderTokens((t as unknown as { tokens?: Token[] }).tokens, insideLink)}
        </React.Fragment>
      )
    }
    return <React.Fragment key={key}>{(t as unknown as { raw?: string }).raw || ''}</React.Fragment>
  }

  return <>{renderTokens(tokens, false)}</>
}
