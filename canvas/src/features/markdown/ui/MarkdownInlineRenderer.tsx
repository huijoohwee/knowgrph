import React from 'react'
import type { Tokens, Token } from 'marked'
import { isSafeHref, resolveHref } from '@/features/markdown/ui/markdownPreviewLinks'
import type { InlineRenderOpts } from './MarkdownRendererTypes'

export const renderInlineTokens = (tokens: Token[] | undefined, opts: InlineRenderOpts): React.ReactNode => {
  const list = Array.isArray(tokens) ? tokens : []
  const { activeDocumentPath, uiPanelMonospaceTextClass } = opts

  const renderOne = (t: Token, i: number): React.ReactNode => {
    const key = `${t.type}:${i}`
    const tt = t as unknown as Tokens.Generic
    if (tt.type === 'text') return <span key={key}>{(t as unknown as Tokens.Text).text}</span>
    if (tt.type === 'strong') {
      return <strong key={key}>{renderInlineTokens((t as unknown as Tokens.Strong).tokens, opts)}</strong>
    }
    if (tt.type === 'em') {
      return <em key={key}>{renderInlineTokens((t as unknown as Tokens.Em).tokens, opts)}</em>
    }
    if (tt.type === 'del') {
      return <del key={key}>{renderInlineTokens((t as unknown as Tokens.Del).tokens, opts)}</del>
    }
    if (tt.type === 'br') return <br key={key} />
    if (tt.type === 'link') {
      const link = t as unknown as Tokens.Link
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
      const img = t as unknown as Tokens.Image
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
          {(t as unknown as Tokens.Code).text}
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
