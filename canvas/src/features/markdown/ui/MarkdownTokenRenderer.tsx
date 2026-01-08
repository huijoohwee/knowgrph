import React from 'react'
import type { TokensGeneric } from './MarkdownTokens'
import type { MermaidInitConfig } from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { MarkdownHeadingBlock } from './MarkdownHeadingBlock'
import { MarkdownTableBlock } from './MarkdownTableBlock'
import { MarkdownCodeBlock } from './MarkdownCodeBlock'
import { MarkdownBlockquoteBlock } from './MarkdownBlockquoteBlock'
import { MarkdownListBlock } from './MarkdownListBlock'
import { MarkdownHtmlBlock } from './MarkdownHtmlBlock'
import { MarkdownParagraphBlock } from './MarkdownParagraphBlock'
import type { RenderOpts } from './MarkdownRendererTypes'

type MarkdownTokenRendererProps = {
  tokens: TokenWithLines[]
  activeDocumentPath: string
  highlightedLineRange: { start: number; end: number } | null
  markdownWordWrap: boolean
  markdownPresentationMode: boolean
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  mermaidFrontmatterConfig: MermaidInitConfig | null
  rootThemeMode: 'light' | 'dark'
  previewOverlayScope: 'viewport' | 'container'
  previewOverlayPortalTarget?: HTMLElement | null
}

const MarkdownTokenRenderer = React.memo(function MarkdownTokenRenderer(props: MarkdownTokenRendererProps) {
  const {
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
  } = props

  const opts: RenderOpts = {
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
  }

  const baseTextClass = markdownPresentationMode ? 'text-lg leading-relaxed' : 'text-sm leading-normal'
  const commonBlockClass = uiPanelTextFontClass

  const renderBlockTokens = (list: TokenWithLines[]) => {
    return list.map((t, i) => {
      const tt = t as unknown as TokensGeneric
      const key = `${tt.type}:${i}`

      // Highlighting logic
      let highlightClass = ''
      if (highlightedLineRange) {
        // Simple overlap check
        const tStart = t.startLine
        const tEnd = t.endLine || t.startLine
        const hStart = highlightedLineRange.start
        const hEnd = highlightedLineRange.end
        const overlap = Math.max(tStart, hStart) <= Math.min(tEnd, hEnd)
        if (overlap) {
          highlightClass = 'bg-yellow-100/50 -mx-1 px-1 rounded transition-colors duration-300'
        }
      }

      switch (tt.type) {
        case 'heading':
          return (
            <MarkdownHeadingBlock
              key={key}
              token={t}
              highlightClass={highlightClass}
              opts={opts}
            />
          )
        case 'hr':
          return <hr key={key} className="my-6 border-gray-200" />
        case 'blockquote':
          return (
            <MarkdownBlockquoteBlock
              key={key}
              token={t}
              highlightClass={highlightClass}
              opts={opts}
              baseTextClass={baseTextClass}
              commonBlockClass={commonBlockClass}
            />
          )
        case 'code':
          return (
            <MarkdownCodeBlock
              key={key}
              token={t}
              highlightClass={highlightClass}
              opts={opts}
              wrapClass={markdownWordWrap ? 'whitespace-pre-wrap break-words' : ''}
            />
          )
        case 'table':
          return (
            <MarkdownTableBlock
              key={key}
              token={t}
              highlightClass={highlightClass}
              opts={opts}
            />
          )
        case 'list':
          return (
            <MarkdownListBlock
              key={key}
              token={t}
              highlightClass={highlightClass}
              opts={opts}
              baseTextClass={baseTextClass}
              wrapClass={markdownWordWrap ? 'whitespace-pre-wrap' : ''}
            />
          )
        case 'html':
          return (
            <MarkdownHtmlBlock
              key={key}
              token={t}
              highlightClass={highlightClass}
              opts={opts}
            />
          )
        case 'paragraph':
          return (
            <MarkdownParagraphBlock
              key={key}
              token={t}
              highlightClass={highlightClass}
              opts={opts}
              baseTextClass={baseTextClass}
              commonBlockClass={commonBlockClass}
            />
          )
        default:
          return (
            <div
              key={key}
              className={['mt-2 mb-2', baseTextClass, commonBlockClass, highlightClass].filter(Boolean).join(' ')}
            >
              {String((t as unknown as { raw?: unknown }).raw || '')}
            </div>
          )
      }
    })
  }

  return <>{renderBlockTokens(tokens)}</>
})

export default MarkdownTokenRenderer
