import React from 'react'
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
} from './MarkdownTokens'
import { isAbsoluteWebUrl, isSafeHref, resolveHref } from '@/features/markdown/ui/markdownPreviewLinks'
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
  const list = Array.isArray(tokens) ? tokens : []
  const { activeDocumentPath, uiPanelMonospaceTextClass } = opts

  const renderOne = (t: Token, i: number): React.ReactNode => {
    const key = `${t.type}:${i}`
    const tt = t as unknown as TokensGeneric
    if (tt.type === 'text') {
      const text = String((t as unknown as TokensText).text || '')
      const parts = splitPlainUrls(text)
      return (
        <span key={key}>
          {parts.map((p, j) => {
            const k = `${key}:${j}`
            if (p.kind !== 'url') return <React.Fragment key={k}>{p.value}</React.Fragment>
            const hrefRaw = p.value.trim()
            if (!hrefRaw || !isAbsoluteWebUrl(hrefRaw) || !isSafeHref(hrefRaw)) {
              return <React.Fragment key={k}>{p.value}</React.Fragment>
            }
            return (
              <a
                key={k}
                href={hrefRaw}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline break-words"
              >
                {hrefRaw}
              </a>
            )
          })}
        </span>
      )
    }
    if (tt.type === 'strong') {
      return <strong key={key}>{renderInlineTokens((t as unknown as TokensStrong).tokens, opts)}</strong>
    }
    if (tt.type === 'em') {
      return <em key={key}>{renderInlineTokens((t as unknown as TokensEm).tokens, opts)}</em>
    }
    if (tt.type === 'del') {
      return <del key={key}>{renderInlineTokens((t as unknown as TokensDel).tokens, opts)}</del>
    }
    if (tt.type === 'br') return <br key={key} />
    if (tt.type === 'link') {
      const link = t as unknown as TokensLink
      const href = isSafeHref(link.href) ? resolveHref(link.href, activeDocumentPath) : ''
      return (
        <a
          key={key}
          href={href || undefined}
          target={href && href.startsWith('#') ? undefined : '_blank'}
          rel={href && href.startsWith('#') ? undefined : 'noreferrer'}
          className="text-blue-600 hover:underline break-words"
        >
          {renderInlineTokens(link.tokens, opts)}
        </a>
      )
    }
    if (tt.type === 'image') {
      const img = t as unknown as TokensImage
      const src = isSafeHref(img.href) ? resolveHref(img.href, activeDocumentPath) : ''
      const alt = String(img.text || '')
      return (
        <img
          key={key}
          src={src || undefined}
          alt={alt}
          loading="lazy"
          className="max-w-full h-auto rounded border border-gray-200"
        />
      )
    }
    if (tt.type === 'code') {
      return (
        <code key={key} className={uiPanelMonospaceTextClass}>
          {(t as unknown as TokensCode).text}
        </code>
      )
    }
    if ((t as unknown as { tokens?: unknown }).tokens) {
      return (
        <React.Fragment key={key}>
          {renderInlineTokens((t as unknown as { tokens?: Token[] }).tokens, opts)}
        </React.Fragment>
      )
    }
    return <React.Fragment key={key}>{(t as unknown as { raw?: string }).raw || ''}</React.Fragment>
  }

  return <>{list.map((t, i) => renderOne(t, i))}</>
}
