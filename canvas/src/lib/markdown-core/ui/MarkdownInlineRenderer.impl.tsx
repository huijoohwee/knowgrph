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
  TokensMath,
  TokensHTML,
  TokensSub,
  TokensSup,
  TokensMark,
  TokensFootnoteRef,
} from '@/features/markdown/ui/MarkdownTokens'
import {
  applyMediaProxySrc,
  isAbsoluteWebUrl,
  isSafeHref,
  isSafeMediaSrc,
  resolveHref,
  buildAnchorAttrs,
  renderSafeHtmlBlock,
} from '@/features/markdown/ui/markdownPreviewLinks'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { InlineRenderOpts } from '@/features/markdown/ui/MarkdownRendererTypes'
import { resolveIframeEmbed } from 'grph-shared/rich-media/iframe'
import { buildYouTubeTimestampPreviewDescriptor } from 'grph-shared/rich-media/providers'
import { MediaIframe, MediaVideo, MediaWebpageSnapshot } from '@/features/markdown/ui/MarkdownMediaUi'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MARKDOWN_INLINE_CODE_VIEW_CLASS } from '@/features/markdown/ui/markdownInlineCodeParity'
import { parseMarkdownInlineCodeSemantic, parseMarkdownSigil, readMarkdownSigilInlineStyle } from '@/features/markdown/ui/markdownSigil'
import {
  buildMarkdownVariableSsotAnchorId,
  parseMarkdownVariableTokens,
} from '@/features/markdown/ui/markdownVariableReferences'
import { renderInlineHtmlElement, renderInlineHtmlToken } from './markdownInlineHtmlToken'
import { renderInlineMediaWithDownload } from './MarkdownInlineMediaDownload'
import { YouTubeTimestampPreviewLink } from './MarkdownYouTubeTimestampPreviewLink'
const SVG_DATA_URI_BASE64_PREFIX = 'data:image/svg+xml;base64,'
type KatexModule = typeof import('katex')
let katexModulePromise: Promise<KatexModule> | null = null

const loadKatexModule = async (): Promise<KatexModule> => {
  if (!katexModulePromise) {
    katexModulePromise = import('katex')
      .then(mod => mod)
      .catch(err => {
        katexModulePromise = null
        throw err
      })
  }
  return katexModulePromise
}

function InlineMathRenderer({ tex, display }: { tex: string; display: boolean }) {
  const [html, setHtml] = React.useState<string>(display ? tex : tex)

  React.useEffect(() => {
    let cancelled = false
    void loadKatexModule()
      .then(katex => {
        if (cancelled) return
        let nextHtml = ''
        try {
          nextHtml = katex.renderToString(tex, {
            throwOnError: false,
            displayMode: display,
            strict: 'warn',
          })
        } catch {
          nextHtml = tex
        }
        setHtml(nextHtml)
      })
      .catch(() => {
        if (cancelled) return
        setHtml(tex)
      })
    return () => {
      cancelled = true
    }
  }, [display, tex])

  if (display) {
    return <span className="block my-3 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
  }
  return <span className="inline-block" dangerouslySetInnerHTML={{ __html: html }} />
}

const padBase64 = (raw: string): string => {
  const s = String(raw || '').trim()
  if (!s) return ''
  const mod = s.length % 4
  if (mod === 0) return s
  return `${s}${'='.repeat(4 - mod)}`
}

const decodeBase64ToUtf8 = (b64: string): string => {
  const raw = padBase64(String(b64 || ''))
  if (!raw) return ''
  const anyGlobal = globalThis as unknown as {
    Buffer?: { from: (input: string, enc: string) => { toString: (enc: string) => string } }
  }
  if (anyGlobal.Buffer && typeof anyGlobal.Buffer.from === 'function') {
    return anyGlobal.Buffer.from(raw, 'base64').toString('utf8')
  }
  try {
    const binary = atob(raw)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}

const encodeUtf8ToBase64 = (text: string): string => {
  const raw = String(text ?? '')
  const anyGlobal = globalThis as unknown as {
    Buffer?: { from: (input: string, enc: string) => { toString: (enc: string) => string } }
  }
  if (anyGlobal.Buffer && typeof anyGlobal.Buffer.from === 'function') {
    return anyGlobal.Buffer.from(raw, 'utf8').toString('base64')
  }
  const encoder = new TextEncoder()
  const bytes = encoder.encode(raw)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(bytes.length, i + chunk))
    binary += String.fromCharCode(...Array.from(slice))
  }
  return btoa(binary)
}
const INLINE_HTML_WRAPPER_TAGS = new Set([
  'a',
  'abbr',
  'button',
  'code',
  'span',
  'u',
  'strong',
  'b',
  'em',
  'i',
  's',
  'del',
  'sub',
  'sup',
  'mark',
  'v-click',
  'v-mark',
])

const readInlineHtmlWrapperToken = (token: Token): { tag: string; kind: 'open' | 'close'; raw: string } | null => {
  const generic = token as unknown as TokensGeneric
  if (generic.type !== 'html') return null
  const raw = String((token as unknown as TokensHTML).text || '').trim()
  if (!raw) return null
  const closeMatch = raw.match(/^<\s*\/\s*([A-Za-z0-9-]+)\s*>$/)
  if (closeMatch) {
    const tag = String(closeMatch[1] || '').toLowerCase()
    if (INLINE_HTML_WRAPPER_TAGS.has(tag)) return { tag, kind: 'close', raw }
    return null
  }
  if (/\/\s*>$/.test(raw)) return null
  const openMatch = raw.match(/^<\s*([A-Za-z0-9-]+)\b[^>]*>$/)
  if (!openMatch) return null
  const tag = String(openMatch[1] || '').toLowerCase()
  if (!INLINE_HTML_WRAPPER_TAGS.has(tag)) return null
  return { tag, kind: 'open', raw }
}

const normalizeSvgDataUriForImg = (src: string): string => {
  const raw = String(src || '').trim()
  if (!raw.toLowerCase().startsWith(SVG_DATA_URI_BASE64_PREFIX)) return raw
  const b64Raw = raw.slice(SVG_DATA_URI_BASE64_PREFIX.length)
  const b64 = padBase64(b64Raw)
  if (!b64) return raw
  if (b64.length > 50_000) return raw
  const decoded = decodeBase64ToUtf8(b64)
  if (!decoded) return raw
  const m = decoded.match(/<svg\b([^>]*)>/i)
  if (!m) return raw
  const attrs = String(m[1] || '')
  if (/xmlns\s*=/.test(attrs)) return raw
  const replacement = `<svg xmlns="http://www.w3.org/2000/svg"${attrs}>`
  const injected = decoded.replace(m[0], replacement)
  const nextB64 = encodeUtf8ToBase64(injected)
  if (!nextB64) return raw
  return `${SVG_DATA_URI_BASE64_PREFIX}${nextB64}`
}

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

const splitVariableRefs = (text: string): Array<
  | { kind: 'text'; value: string }
  | { kind: 'var'; value: string; key: string }
> => {
  const raw = String(text || '')
  if (!raw) return [{ kind: 'text', value: '' }]
  const tokens = parseMarkdownVariableTokens(raw)
  if (!tokens.length) return [{ kind: 'text', value: raw }]
  const out: Array<{ kind: 'text'; value: string } | { kind: 'var'; value: string; key: string }> = []
  let cursor = 0
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i]
    if (!t) continue
    if (t.start > cursor) out.push({ kind: 'text', value: raw.slice(cursor, t.start) })
    out.push({ kind: 'var', value: t.raw, key: t.key })
    cursor = t.end
  }
  if (cursor < raw.length) out.push({ kind: 'text', value: raw.slice(cursor) })
  return out
}

const INLINE_SEMANTIC_BADGE_CLASS = [
  'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 align-baseline leading-none',
  'border-slate-300/70 bg-slate-100/80 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200',
].join(' ')

const INLINE_SEMANTIC_LABEL_CLASS = [
  'uppercase tracking-wide text-[10px] font-semibold',
  UI_THEME_TOKENS.text.secondary,
].join(' ')

const INLINE_SEMANTIC_VALUE_CLASS = 'font-medium'
const INLINE_COMMENT_RANGE_CLASS = [
  'cursor-pointer underline decoration-dotted underline-offset-2',
  UI_THEME_TOKENS.status.warning,
].join(' ')

const readCommentReferenceCodeToken = (token: Token): { code: string; commentId: string } | null => {
  const generic = token as unknown as TokensGeneric
  if (generic.type !== 'code') return null
  const codeToken = token as unknown as TokensCode
  const semantic = parseMarkdownInlineCodeSemantic(codeToken.text)
  if (!semantic || semantic.kind !== 'reference' || semantic.referenceKind !== 'comment') return null
  const commentId = String(semantic.value || '').trim()
  if (!commentId) return null
  return {
    code: semantic.code,
    commentId,
  }
}

const getInlineSemanticToneClassName = (badgeLabel: string): string => {
  const label = String(badgeLabel || '').trim().toLowerCase()
  if (label === 'comment') return `${UI_THEME_TOKENS.status.warning} border-amber-300/70 dark:border-amber-700/70`
  if (label === 'callout') return `${UI_THEME_TOKENS.status.info} border-sky-300/70 dark:border-sky-700/70`
  if (label === 'node' || label === 'edge' || label === 'media' || label === 'media-row') {
    return `${UI_THEME_TOKENS.status.info} border-sky-300/70 dark:border-sky-700/70`
  }
  if (label === 'url') return `${UI_THEME_TOKENS.status.success} border-emerald-300/70 dark:border-emerald-700/70`
  if (label === 'date' || label === 'hash') return `${UI_THEME_TOKENS.status.warning} border-amber-300/70 dark:border-amber-700/70`
  return ''
}

const renderInlineCodeSemanticToken = (
  rawText: string,
  key: string,
  activeDocumentPath: string | undefined,
): React.ReactNode | null => {
  const semantic = parseMarkdownInlineCodeSemantic(rawText)
  if (!semantic) return null
  if (semantic.kind === 'annotation') {
    return (
      <span
        key={key}
        data-kg-sigil="1"
        style={readMarkdownSigilInlineStyle({
          text: semantic.displayText,
          color: semantic.color,
          background: semantic.background,
        })}
      >
        {semantic.displayText}
      </span>
    )
  }
  const className = [INLINE_SEMANTIC_BADGE_CLASS, getInlineSemanticToneClassName(semantic.badgeLabel)].filter(Boolean).join(' ')
  const valueNode =
    semantic.kind === 'value' && semantic.valueKind === 'url' && isAbsoluteWebUrl(semantic.value) && isSafeHref(semantic.value)
      ? (() => {
          const href = resolveHref(semantic.value, activeDocumentPath)
          const anchor = buildAnchorAttrs(href)
          return (
            <a href={href || undefined} target={anchor.target} rel={anchor.rel} className={anchor.className}>
              {semantic.displayText}
            </a>
          )
        })()
      : <span className={INLINE_SEMANTIC_VALUE_CLASS}>{semantic.displayText}</span>
  return (
    <span
      key={key}
      data-kg-inline-code-token="1"
      data-kg-inline-code-kind={semantic.kind}
      data-kg-inline-code-badge={semantic.badgeLabel}
      data-kg-inline-code-raw={semantic.code}
      className={className}
    >
      <span className={INLINE_SEMANTIC_LABEL_CLASS}>{semantic.badgeLabel}</span>
      {valueNode}
    </span>
  )
}

export const renderInlineTokens = (tokens: Token[] | undefined, opts: InlineRenderOpts): React.ReactNode => {
  const { activeDocumentPath, uiPanelTextFontClass, uiPanelMonospaceTextClass, markdownPresentationMode } = opts
  const fragmentOpts = opts.fragmentOptions || null
  const fragmentIndexRef = { current: 0 }
  const inlineCodeClassName = MARKDOWN_INLINE_CODE_VIEW_CLASS

  const renderTokens = (subTokens: Token[] | undefined, insideLink: boolean): React.ReactNode => {
    const list = Array.isArray(subTokens) ? subTokens : []
    const out: React.ReactNode[] = []
    for (let i = 0; i < list.length; i += 1) {
      const token = list[i]!
      const commentRangeStart = readCommentReferenceCodeToken(token)
      if (commentRangeStart) {
        let closeIndex = -1
        for (let j = i + 2; j < list.length; j += 1) {
          const commentRangeEnd = readCommentReferenceCodeToken(list[j]!)
          if (!commentRangeEnd) continue
          if (commentRangeEnd.commentId !== commentRangeStart.commentId) continue
          closeIndex = j
          break
        }
        if (closeIndex > i) {
          const childTokens = list.slice(i + 1, closeIndex)
          const childNodes = renderTokens(childTokens, insideLink)
          const previewText = childTokens
            .map(child => {
              const childToken = child as unknown as { raw?: unknown; text?: unknown }
              return String(childToken.raw ?? childToken.text ?? '')
            })
            .join('')
            .trim()
          out.push(
            <span
              key={`${commentRangeStart.commentId}:${i}`}
              data-kg-comment="1"
              data-kg-comment-range="1"
              data-kg-comment-id={commentRangeStart.commentId}
              data-kg-comment-text={previewText}
              data-kg-comment-raw-start={`\`${commentRangeStart.code}\``}
              data-kg-comment-raw-end={`\`${commentRangeStart.code}\``}
              className={INLINE_COMMENT_RANGE_CLASS}
              role="note"
              tabIndex={0}
              title={previewText || 'Comment range'}
            >
              {childNodes}
            </span>,
          )
          i = closeIndex
          continue
        }
      }
      const wrapper = readInlineHtmlWrapperToken(token)
      if (wrapper?.kind === 'open') {
        let depth = 1
        let closeIndex = -1
        for (let j = i + 1; j < list.length; j += 1) {
          const nextWrapper = readInlineHtmlWrapperToken(list[j]!)
          if (!nextWrapper || nextWrapper.tag !== wrapper.tag) continue
          depth += nextWrapper.kind === 'open' ? 1 : -1
          if (depth === 0) {
            closeIndex = j
            break
          }
        }
        if (closeIndex > i) {
          const wrapperChildren = renderTokens(list.slice(i + 1, closeIndex), insideLink || wrapper.tag === 'a')
          out.push(renderInlineHtmlElement({
            raw: wrapper.raw,
            key: `${wrapper.tag}:${i}`,
            opts,
            uiPanelTextFontClass,
            uiPanelMonospaceTextClass,
            inlineCodeClassName,
            fragmentIndexRef,
            children: wrapperChildren,
          }))
          i = closeIndex
          continue
        }
      }
      if (wrapper?.kind === 'close') continue
      out.push(renderOne(token, i, insideLink))
    }
    return out
  }

  const renderOne = (t: Token, i: number, insideLink: boolean): React.ReactNode => {
    const key = `${t.type}:${i}`
    const tt = t as unknown as TokensGeneric
    if (tt.type === 'text') {
      const text = String((t as unknown as TokensText).text || '')
      if (insideLink) {
        return <React.Fragment key={key}>{text}</React.Fragment>
      }
      return (
        <React.Fragment key={key}>
          {splitVariableRefs(text).map((segment, segmentIndex) => {
            const baseKey = `${key}:seg:${segmentIndex}`
            if (segment.kind === 'var') {
              const ssotAnchorId = buildMarkdownVariableSsotAnchorId(segment.key)
              return (
                <a
                  key={baseKey}
                  href={`#${ssotAnchorId}`}
                  data-kg-var-key={segment.key}
                  data-kg-var-raw={segment.value}
                  className={`${UI_THEME_TOKENS.text.secondary} underline decoration-dotted underline-offset-2`}
                >
                  {segment.value}
                </a>
              )
            }
            const parts = splitPlainUrls(segment.value)
            return parts.map((p, j) => {
              const k = `${baseKey}:${j}`
              if (p.kind !== 'url') return <React.Fragment key={k}>{p.value}</React.Fragment>
              const hrefRaw = p.value.trim()
              if (!hrefRaw || !isAbsoluteWebUrl(hrefRaw) || !isSafeHref(hrefRaw)) {
                return <React.Fragment key={k}>{p.value}</React.Fragment>
              }
              const anchor = buildAnchorAttrs(hrefRaw)
              const preview = buildYouTubeTimestampPreviewDescriptor(hrefRaw)
              if (preview) {
                return (
                  <YouTubeTimestampPreviewLink key={k} href={hrefRaw} anchor={anchor} preview={preview}>
                    {hrefRaw}
                  </YouTubeTimestampPreviewLink>
                )
              }
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
            })
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
      const footnoteLabel = String(ref.label || ref.id || '').trim() || String(ref.id || '')
      const footnoteTitle = String(ref.caption || '').trim() || `Footnote ${footnoteLabel}`
      return (
        <sup key={key} id={`fnref${ref.id}`} className="scroll-mt-16">
          <a
            href={`#fn${ref.id}`}
            className={`${UI_THEME_TOKENS.icon.active} no-underline font-medium px-0.5`}
            aria-describedby={`fn${ref.id}`}
            aria-label={footnoteTitle}
            title={footnoteTitle}
          >
            {footnoteLabel}
          </a>
        </sup>
      )
    }
    if (tt.type === 'br') return <br key={key} />
    if (tt.type === 'link') {
      const link = t as unknown as TokensLink
      const href = isSafeHref(link.href) ? resolveHref(link.href, activeDocumentPath) : ''
      const anchor = buildAnchorAttrs(href)
      const rawHashHref = (() => {
        if (!href.startsWith('#')) return href
        const raw = href.slice(1)
        const decoded = (() => {
          try {
            return decodeURIComponent(raw)
          } catch {
            return raw
          }
        })()
        return decoded.startsWith('^') ? `#${decoded}` : href
      })()
      const enforceRawHashCaretHref = rawHashHref.startsWith('#^')
      const preview = buildYouTubeTimestampPreviewDescriptor(href)
      if (preview) {
        return (
          <YouTubeTimestampPreviewLink key={key} href={href} anchor={anchor} preview={preview}>
            {renderTokens(link.tokens, true)}
          </YouTubeTimestampPreviewLink>
        )
      }
      return (
        <a
          key={key}
          href={href || undefined}
          target={anchor.target}
          rel={anchor.rel}
          className={anchor.className}
          ref={
            enforceRawHashCaretHref
              ? (el) => {
                  if (!el) return
                  try {
                    el.setAttribute('href', rawHashHref)
                  } catch {
                    void 0
                  }
                }
              : undefined
          }
        >
          {renderTokens(link.tokens, true)}
        </a>
      )
    }
    if (tt.type === 'image') {
      const img = t as unknown as TokensImage
      const resolved = isSafeHref(img.href) ? resolveHref(img.href, activeDocumentPath) : ''
      const srcRaw = applyMediaProxySrc(resolved)
      const src = normalizeSvgDataUriForImg(srcRaw)
      const alt = String(img.text || '')
      const altNorm = alt.trim().toLowerCase()
      const isVideo = altNorm.startsWith('video') || /\.(mp4|webm|mov|ogg)(\?|#|$)/i.test(src)
      const isAudio = altNorm.startsWith('audio') || /\.(mp3|wav|m4a|aac|flac|ogg)(\?|#|$)/i.test(src)
      const isIframe = altNorm.startsWith('iframe')
      if (isIframe && resolved && isSafeMediaSrc(resolved)) {
        const embed = resolveIframeEmbed({ url: resolved })
        return (
          embed.direct ? (
            <MediaIframe
              key={key}
              src={resolved}
              title={alt || 'Embedded content'}
              presentationMode={opts.markdownPresentationMode}
            />
          ) : (
            <MediaWebpageSnapshot
              key={key}
              url={resolved}
              title={alt || 'Embedded content'}
              presentationMode={opts.markdownPresentationMode}
            />
          )
        )
      }
      if (isVideo && src && isSafeMediaSrc(src)) {
        return renderInlineMediaWithDownload({ children: <MediaVideo src={src} controls />, insideLink, kind: 'video', nodeKey: key, src: resolved || src })
      }
      if (isAudio && src && isSafeMediaSrc(src)) {
        return (
          <audio
            key={key}
            controls
            src={src || undefined}
            className={[
              'w-full max-w-xl rounded border',
              UI_THEME_TOKENS.panel.border,
            ]
              .filter(Boolean)
              .join(' ')}
          />
        )
      }
      const isPdfAsset = src.startsWith('/__pdf_assets/') || /^data:image\//i.test(src)
      const isSvgImage = /^data:image\/svg\+xml;base64,/i.test(src) || /\.svg(\?|#|$)/i.test(src)
      const imageNode = (
        <img
          key={`${key}-image`}
          src={src || undefined}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={[
            'max-w-full h-auto rounded border object-contain',
            isPdfAsset ? 'max-h-[80vh]' : '',
            isSvgImage ? 'bg-black/5 dark:bg-white/5' : '',
            UI_THEME_TOKENS.panel.border,
          ]
            .filter(Boolean)
            .join(' ')}
        />
      )
      return renderInlineMediaWithDownload({ children: imageNode, insideLink, kind: 'image', nodeKey: key, src: resolved || src })
    }
    if (tt.type === 'code') {
      const semanticToken = renderInlineCodeSemanticToken((t as unknown as TokensCode).text, key, activeDocumentPath)
      if (semanticToken) return semanticToken
      const sigil = parseMarkdownSigil((t as unknown as TokensCode).text)
      if (sigil) {
        return (
          <span
            key={key}
            data-kg-sigil="1"
            style={readMarkdownSigilInlineStyle(sigil)}
          >
            {sigil.text}
          </span>
        )
      }
      return (
        <code key={key} className={inlineCodeClassName}>
          {(t as unknown as TokensCode).text}
        </code>
      )
    }
    if (tt.type === 'math') {
      const m = t as unknown as TokensMath
      return <InlineMathRenderer key={key} tex={m.tex} display={!!m.display} />
    }
    if (tt.type === 'html') {
      return renderInlineHtmlToken({
        token: t as TokensHTML,
        key,
        opts,
        uiPanelTextFontClass,
        uiPanelMonospaceTextClass,
        inlineCodeClassName,
        fragmentIndexRef,
      })
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
