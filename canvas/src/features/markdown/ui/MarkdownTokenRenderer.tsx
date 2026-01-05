import React from 'react'
import type { Tokens, Token } from 'marked'
import { addLineRangesToTokens, type TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import {
  extractAttr,
  getVimeoId,
  getYouTubeId,
  isAbsoluteWebUrl,
  isSafeHref,
  isSafeMediaSrc,
  isVideoUrl,
  looksLikeSingleTagBlock,
  parseHtmlNumberAttr,
  renderSafeHtmlBlock,
  resolveHref,
  buildMarkdownPreviewMediaKey,
} from '@/features/markdown/ui/markdownPreviewLinks'
import { MermaidDiagram } from '@/features/panels/views/preview-panel/ui/MermaidDiagram'
import type { MermaidInitConfig } from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { useGraphStore } from '@/hooks/useGraphStore'

type HighlightedLineRange = { start: number; end: number } | null

type InlineRenderOpts = {
  activeDocumentPath: string
  uiPanelMonospaceTextClass: string
}

type RenderOpts = InlineRenderOpts & {
  highlightedLineRange: HighlightedLineRange
  markdownWordWrap: boolean
  markdownPresentationMode: boolean
  uiPanelTextFontClass: string
  mermaidFrontmatterConfig: MermaidInitConfig | null
  rootThemeMode: 'light' | 'dark'
  previewOverlayScope: 'viewport' | 'container'
  previewOverlayPortalTarget?: HTMLElement | null
}

type MarkdownTokenRendererProps = {
  tokens: TokenWithLines[]
} & RenderOpts

const renderInlineTokens = (tokens: Token[] | undefined, opts: InlineRenderOpts): React.ReactNode => {
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

const isStandaloneLinkParagraph = (token: Token): string | null => {
  const p = token as unknown as Tokens.Paragraph
  const inner = Array.isArray(p.tokens) ? p.tokens : []
  if (inner.length !== 1) return null
  const only = inner[0] as unknown as Tokens.Generic
  if (only.type !== 'link') return null
  const link = only as unknown as Tokens.Link
  const href = String(link.href || '').trim()
  return href || null
}

const MarkdownTokenRenderer = React.memo(function MarkdownTokenRenderer({
  tokens,
  activeDocumentPath,
  highlightedLineRange,
  markdownWordWrap,
  markdownPresentationMode,
  uiPanelTextFontClass,
  uiPanelMonospaceTextClass,
  mermaidFrontmatterConfig,
  rootThemeMode,
  previewOverlayScope,
  previewOverlayPortalTarget,
}: MarkdownTokenRendererProps) {
  const wrapClass = markdownWordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
  const baseTextClass = markdownPresentationMode ? 'text-base leading-relaxed' : 'text-sm'

  const setMarkdownPreviewActiveMediaKey = useGraphStore(s => s.setMarkdownPreviewActiveMediaKey)

  const renderBlockTokens = (blockTokens: TokenWithLines[], opts: RenderOpts): React.ReactNode[] => {
    const out: React.ReactNode[] = []
    for (let i = 0; i < blockTokens.length; i += 1) {
      const t = blockTokens[i]
      const highlight =
        opts.highlightedLineRange != null &&
        t.startLine <= opts.highlightedLineRange.end &&
        t.endLine >= opts.highlightedLineRange.start
      const highlightClass = highlight ? 'bg-yellow-100 rounded' : ''

      const commonBlockClass = [opts.uiPanelTextFontClass, wrapClass, highlightClass].filter(Boolean).join(' ')

      const tt = t as unknown as Tokens.Generic
      if (tt.type === 'space') continue

      if (tt.type === 'heading') {
        const h = t as unknown as Tokens.Heading
        const depth = Math.min(6, Math.max(1, h.depth || 1))
        const size =
          depth === 1
            ? opts.markdownPresentationMode
              ? 'text-3xl'
              : 'text-base'
            : depth === 2
            ? opts.markdownPresentationMode
              ? 'text-2xl'
              : 'text-sm'
            : opts.markdownPresentationMode
            ? 'text-xl'
            : 'text-xs'
        const cls = ['font-semibold mt-5 mb-2', size, opts.uiPanelTextFontClass, highlightClass].filter(Boolean).join(' ')
        const content = renderInlineTokens(h.tokens, { activeDocumentPath: opts.activeDocumentPath, uiPanelMonospaceTextClass: opts.uiPanelMonospaceTextClass })
        if (depth === 1) out.push(<h1 key={i} className={cls}>{content}</h1>)
        else if (depth === 2) out.push(<h2 key={i} className={cls}>{content}</h2>)
        else if (depth === 3) out.push(<h3 key={i} className={cls}>{content}</h3>)
        else if (depth === 4) out.push(<h4 key={i} className={cls}>{content}</h4>)
        else if (depth === 5) out.push(<h5 key={i} className={cls}>{content}</h5>)
        else out.push(<h6 key={i} className={cls}>{content}</h6>)
        continue
      }

      if (tt.type === 'hr') {
        out.push(<hr key={i} className={['my-4 border-gray-200', highlightClass].filter(Boolean).join(' ')} />)
        continue
      }

      if (tt.type === 'blockquote') {
        const bq = t as unknown as Tokens.Blockquote
        out.push(
          <blockquote
            key={i}
            className={[
              'mt-3 mb-3 pl-3 border-l-4 border-gray-200 text-gray-700',
              baseTextClass,
              commonBlockClass,
            ].filter(Boolean).join(' ')}
          >
            <MarkdownTokenRenderer
              tokens={addLineRangesToTokens(bq.tokens as unknown as Token[], 0)}
              activeDocumentPath={opts.activeDocumentPath}
              highlightedLineRange={null}
              markdownWordWrap={opts.markdownWordWrap}
              markdownPresentationMode={opts.markdownPresentationMode}
              uiPanelTextFontClass={opts.uiPanelTextFontClass}
              uiPanelMonospaceTextClass={opts.uiPanelMonospaceTextClass}
              mermaidFrontmatterConfig={opts.mermaidFrontmatterConfig}
              rootThemeMode={opts.rootThemeMode}
              previewOverlayScope={opts.previewOverlayScope}
              previewOverlayPortalTarget={opts.previewOverlayPortalTarget}
            />
          </blockquote>,
        )
        continue
      }

      if (tt.type === 'code') {
        const c = t as unknown as Tokens.Code
        const lang = String((c as unknown as { lang?: unknown }).lang || '').trim().toLowerCase()
        if (lang === 'mermaid' || lang === 'mmd') {
          out.push(
            <MermaidDiagram
              key={i}
              code={c.text}
              highlightClass={highlightClass}
              frontmatterConfig={opts.mermaidFrontmatterConfig}
              rootThemeMode={opts.rootThemeMode}
              overlayScope={opts.previewOverlayScope}
              overlayPortalTarget={opts.previewOverlayPortalTarget}
            />,
          )
          continue
        }
        out.push(
          <pre
            key={i}
            className={[
              'mt-3 mb-3 p-3 rounded border border-gray-200 bg-gray-50 overflow-auto',
              highlightClass,
            ].filter(Boolean).join(' ')}
          >
            <code className={[opts.uiPanelMonospaceTextClass, wrapClass].filter(Boolean).join(' ')}>
              {c.text}
            </code>
          </pre>,
        )
        continue
      }

      if (tt.type === 'table') {
        const tbl = t as unknown as Tokens.Table
        out.push(
          <div
            key={i}
            className={[
              'mt-3 mb-3 overflow-auto rounded border border-gray-200',
              highlightClass,
            ].filter(Boolean).join(' ')}
          >
            <table className={['min-w-full', opts.markdownPresentationMode ? 'text-sm' : 'text-xs'].join(' ')}>
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  {tbl.header.map((cell, j) => (
                    <th key={j} className="px-2 py-1 text-left font-semibold border-b border-gray-200 align-top">
                      {renderInlineTokens(cell.tokens as unknown as Token[] | undefined, { activeDocumentPath: opts.activeDocumentPath, uiPanelMonospaceTextClass: opts.uiPanelMonospaceTextClass })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-gray-900">
                {tbl.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="odd:bg-white even:bg-gray-50">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-2 py-1 border-b border-gray-100 align-top">
                        {renderInlineTokens(cell.tokens as unknown as Token[] | undefined, { activeDocumentPath: opts.activeDocumentPath, uiPanelMonospaceTextClass: opts.uiPanelMonospaceTextClass })}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        )
        continue
      }

      if (tt.type === 'list') {
        const list = t as unknown as Tokens.List
        const ListTag = (list.ordered ? 'ol' : 'ul') as 'ol' | 'ul'
        const listClass = list.ordered ? 'list-decimal' : 'list-disc'
        out.push(
          <div key={i} className={['mt-3 mb-3', highlightClass].filter(Boolean).join(' ')}>
            <ListTag className={[listClass, 'pl-5', baseTextClass, opts.uiPanelTextFontClass].join(' ')}>
              {list.items.map((item, j) => {
                const task = item.task ? (
                  <input
                    type="checkbox"
                    checked={!!item.checked}
                    readOnly
                    className="mr-2 translate-y-[1px]"
                  />
                ) : null
                return (
                  <li key={j} className={[opts.uiPanelTextFontClass, wrapClass].filter(Boolean).join(' ')}>
                    {task}
                    <MarkdownTokenRenderer
                      tokens={addLineRangesToTokens(item.tokens as unknown as Token[], 0)}
                      activeDocumentPath={opts.activeDocumentPath}
                      highlightedLineRange={null}
                      markdownWordWrap={opts.markdownWordWrap}
                      markdownPresentationMode={opts.markdownPresentationMode}
                      uiPanelTextFontClass={opts.uiPanelTextFontClass}
                      uiPanelMonospaceTextClass={opts.uiPanelMonospaceTextClass}
                      mermaidFrontmatterConfig={opts.mermaidFrontmatterConfig}
                      rootThemeMode={opts.rootThemeMode}
                      previewOverlayScope={opts.previewOverlayScope}
                      previewOverlayPortalTarget={opts.previewOverlayPortalTarget}
                    />
                  </li>
                )
              })}
            </ListTag>
          </div>,
        )
        continue
      }

      if (tt.type === 'html') {
        const html = String((t as unknown as Tokens.HTML).text || '').trim()
        if (looksLikeSingleTagBlock(html, 'iframe')) {
          const srcRaw = extractAttr(html, 'src')
          if (srcRaw && isSafeHref(srcRaw) && isSafeMediaSrc(srcRaw)) {
            const src = resolveHref(srcRaw, opts.activeDocumentPath)
            out.push(
              <div
                key={i}
                className={['mt-4 mb-4', highlightClass].filter(Boolean).join(' ')}
                onClick={() => {
                  if (opts.previewOverlayScope === 'container') return
                  try {
                    const key = buildMarkdownPreviewMediaKey('iframe', t.startLine, srcRaw)
                    setMarkdownPreviewActiveMediaKey(key)
                  } catch {
                    void 0
                  }
                  try {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(
                        new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'preview' as const } }),
                      )
                    }
                  } catch {
                    void 0
                  }
                }}
              >
                <div className={opts.markdownPresentationMode ? 'aspect-video w-full' : 'aspect-video w-full max-w-xl'}>
                  <iframe
                    src={src}
                    title="Embedded content"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    className="w-full h-full rounded border border-gray-200"
                  />
                </div>
              </div>,
            )
            continue
          }
        }
        if (looksLikeSingleTagBlock(html, 'video')) {
          const srcRaw = extractAttr(html, 'src')
          if (srcRaw && isSafeHref(srcRaw) && isSafeMediaSrc(srcRaw)) {
            const src = resolveHref(srcRaw, opts.activeDocumentPath)
            out.push(
              <div
                key={i}
                className={['mt-4 mb-4', highlightClass].filter(Boolean).join(' ')}
                onClick={() => {
                  if (opts.previewOverlayScope === 'container') return
                  try {
                    const key = buildMarkdownPreviewMediaKey('video', t.startLine, srcRaw)
                    setMarkdownPreviewActiveMediaKey(key)
                  } catch {
                    void 0
                  }
                  try {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(
                        new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'preview' as const } }),
                      )
                    }
                  } catch {
                    void 0
                  }
                }}
              >
                <video controls className="w-full max-w-2xl rounded border border-gray-200" src={src} />
              </div>,
            )
            continue
          }
        }
        if (looksLikeSingleTagBlock(html, 'img')) {
          const srcRaw = extractAttr(html, 'src')
          if (srcRaw && isSafeHref(srcRaw) && isSafeMediaSrc(srcRaw)) {
            const src = resolveHref(srcRaw, opts.activeDocumentPath)
            const alt = extractAttr(html, 'alt')
            const width = parseHtmlNumberAttr(extractAttr(html, 'width'))
            const height = parseHtmlNumberAttr(extractAttr(html, 'height'))
            const style: React.CSSProperties = {}
            if (width) {
              style.width = `${Math.round(width)}px`
              style.maxWidth = '100%'
            }
            if (height) style.height = `${Math.round(height)}px`
            out.push(
              <div
                key={i}
                className={['mt-4 mb-4', highlightClass].filter(Boolean).join(' ')}
                onClick={() => {
                  if (opts.previewOverlayScope === 'container') return
                  try {
                    const key = buildMarkdownPreviewMediaKey('image', t.startLine, srcRaw)
                    setMarkdownPreviewActiveMediaKey(key)
                  } catch {
                    void 0
                  }
                  try {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(
                        new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'preview' as const } }),
                      )
                    }
                  } catch {
                    void 0
                  }
                }}
              >
                <img
                  src={src || undefined}
                  alt={alt}
                  loading="lazy"
                  style={Object.keys(style).length ? style : undefined}
                  className="max-w-full h-auto rounded border border-gray-200"
                />
              </div>,
            )
            continue
          }
        }
        const safeHtml = renderSafeHtmlBlock(html, {
          activeDocumentPath: opts.activeDocumentPath,
          uiPanelMonospaceTextClass: opts.uiPanelMonospaceTextClass,
          markdownPresentationMode: opts.markdownPresentationMode,
          renderNodeText: (text, key) => <React.Fragment key={key}>{text}</React.Fragment>,
        })
        if (safeHtml) {
          out.push(
            <div key={i} className={['mt-3 mb-3', highlightClass].filter(Boolean).join(' ')}>
              {safeHtml}
            </div>,
          )
          continue
        }
        out.push(
          <pre
            key={i}
            className={[
              'mt-3 mb-3 p-3 rounded border border-gray-200 bg-gray-50 overflow-auto',
              highlightClass,
            ].filter(Boolean).join(' ')}
          >
            <code className={opts.uiPanelMonospaceTextClass}>{String((t as unknown as Tokens.HTML).text || '')}</code>
          </pre>,
        )
        continue
      }

      if (tt.type === 'paragraph') {
        const standaloneHref = isStandaloneLinkParagraph(t)
        if (standaloneHref && isSafeHref(standaloneHref) && isAbsoluteWebUrl(standaloneHref)) {
          const yt = getYouTubeId(standaloneHref)
          if (yt) {
            out.push(
              <div
                key={i}
                className={['mt-4 mb-4', highlightClass].filter(Boolean).join(' ')}
                onClick={() => {
                  if (opts.previewOverlayScope === 'container') return
                  try {
                    const key = buildMarkdownPreviewMediaKey('youtube', t.startLine, standaloneHref)
                    setMarkdownPreviewActiveMediaKey(key)
                  } catch {
                    void 0
                  }
                  try {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(
                        new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'preview' as const } }),
                      )
                    }
                  } catch {
                    void 0
                  }
                }}
              >
                <div className={opts.markdownPresentationMode ? 'aspect-video w-full' : 'aspect-video w-full max-w-xl'}>
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${yt}`}
                    title="YouTube"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    className="w-full h-full rounded border border-gray-200"
                  />
                </div>
              </div>,
            )
            continue
          }
          const vimeo = getVimeoId(standaloneHref)
          if (vimeo) {
            out.push(
              <div
                key={i}
                className={['mt-4 mb-4', highlightClass].filter(Boolean).join(' ')}
                onClick={() => {
                  if (opts.previewOverlayScope === 'container') return
                  try {
                    const key = buildMarkdownPreviewMediaKey('vimeo', t.startLine, standaloneHref)
                    setMarkdownPreviewActiveMediaKey(key)
                  } catch {
                    void 0
                  }
                  try {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(
                        new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'preview' as const } }),
                      )
                    }
                  } catch {
                    void 0
                  }
                }}
              >
                <div className={opts.markdownPresentationMode ? 'aspect-video w-full' : 'aspect-video w-full max-w-xl'}>
                  <iframe
                    src={`https://player.vimeo.com/video/${vimeo}`}
                    title="Vimeo"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    className="w-full h-full rounded border border-gray-200"
                  />
                </div>
              </div>,
            )
            continue
          }
          if (isVideoUrl(standaloneHref)) {
            const src = resolveHref(standaloneHref, opts.activeDocumentPath)
            out.push(
              <div
                key={i}
                className={['mt-4 mb-4', highlightClass].filter(Boolean).join(' ')}
                onClick={() => {
                  if (opts.previewOverlayScope === 'container') return
                  try {
                    const key = buildMarkdownPreviewMediaKey('video', t.startLine, standaloneHref)
                    setMarkdownPreviewActiveMediaKey(key)
                  } catch {
                    void 0
                  }
                  try {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(
                        new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'preview' as const } }),
                      )
                    }
                  } catch {
                    void 0
                  }
                }}
              >
                <video controls className="w-full max-w-2xl rounded border border-gray-200" src={src} />
              </div>,
            )
            continue
          }
        }

        const p = t as unknown as Tokens.Paragraph
        out.push(
          <p
            key={i}
            className={[
              'mt-2 mb-2',
              baseTextClass,
              commonBlockClass,
            ].filter(Boolean).join(' ')}
          >
            {renderInlineTokens(p.tokens, { activeDocumentPath: opts.activeDocumentPath, uiPanelMonospaceTextClass: opts.uiPanelMonospaceTextClass })}
          </p>,
        )
        continue
      }

      out.push(
        <div key={i} className={['mt-2 mb-2', baseTextClass, commonBlockClass].filter(Boolean).join(' ')}>
          {String((t as unknown as { raw?: unknown }).raw || '')}
        </div>,
      )
    }
    return out
  }

  return (
    <>
      {renderBlockTokens(tokens, {
        activeDocumentPath,
        highlightedLineRange,
        markdownWordWrap,
        markdownPresentationMode,
        uiPanelTextFontClass,
        uiPanelMonospaceTextClass,
        mermaidFrontmatterConfig,
        rootThemeMode,
        previewOverlayScope,
        previewOverlayPortalTarget,
      })}
    </>
  )
})

export default MarkdownTokenRenderer
