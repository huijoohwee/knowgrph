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
import { MarkdownBlockContainer } from './MarkdownBlockContainer'
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
  markdownTextHighlight?: boolean
  selectionKind?: 'node' | 'edge' | null
  highlightBackgroundColor?: string | null
  highlightUnderlineColor?: string | null
  alwaysOnHighlightMode?: boolean
  alwaysOnTokenHighlights?: {
    textColor: string | null
    underlineColor: string | null
    backgroundColor: string | null
  }[] | null
  fragmentsEnabled?: boolean
  fragmentStep?: number
  fragmentClassNames?: string[]
  fragmentTags?: string[]
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
    markdownTextHighlight,
    selectionKind,
    highlightBackgroundColor,
    highlightUnderlineColor,
    alwaysOnHighlightMode,
    alwaysOnTokenHighlights,
    fragmentsEnabled,
    fragmentStep,
    fragmentClassNames,
    fragmentTags,
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

      let highlightClass = ''
      let highlightStyle: React.CSSProperties | undefined

      const alwaysOnSpec =
        alwaysOnHighlightMode &&
        Array.isArray(alwaysOnTokenHighlights) &&
        alwaysOnTokenHighlights[i]
          ? alwaysOnTokenHighlights[i] || null
          : null

      if (alwaysOnSpec && (alwaysOnSpec.textColor || alwaysOnSpec.underlineColor || alwaysOnSpec.backgroundColor)) {
        highlightClass = '-mx-1 px-1 rounded transition-colors duration-300'
        const bg = alwaysOnSpec.backgroundColor || null
        const textColor = alwaysOnSpec.textColor || null
        const underlineColor = alwaysOnSpec.underlineColor || null
        highlightStyle = {
          backgroundColor: bg || undefined,
          color: textColor || undefined,
          textDecorationLine: underlineColor ? 'underline' : undefined,
          textDecorationColor: underlineColor || undefined,
          textDecorationThickness: underlineColor ? '1px' : undefined,
          textUnderlineOffset: underlineColor ? '1px' : undefined,
        }
      }

      if (markdownTextHighlight && highlightedLineRange) {
        const tStart = t.startLine
        const tEnd = t.endLine || t.startLine
        const hStart = highlightedLineRange.start
        const hEnd = highlightedLineRange.end
        const overlap = Math.max(tStart, hStart) <= Math.min(tEnd, hEnd)
        if (overlap) {
          highlightClass = '-mx-1 px-1 rounded transition-colors duration-300'
          const bg = highlightBackgroundColor || null
          const baseColor = highlightUnderlineColor || null
          if (selectionKind === 'edge') {
            highlightStyle = {
              backgroundColor: bg || undefined,
              textDecorationLine: 'underline',
              textDecorationColor: baseColor || undefined,
              textDecorationThickness: baseColor ? '2px' : undefined,
              textUnderlineOffset: baseColor ? '2px' : undefined,
            }
          } else {
            highlightStyle = {
              backgroundColor: bg || undefined,
              color: baseColor || undefined,
            }
          }
        }
      }

      switch (tt.type) {
        case 'heading':
          return (
            <MarkdownHeadingBlock
              key={key}
              token={t}
              highlightClass={highlightClass}
              highlightStyle={highlightStyle}
              opts={opts}
              fragmentsEnabled={!!fragmentsEnabled}
              fragmentStep={fragmentStep || 0}
              fragmentClassNames={fragmentClassNames}
              fragmentTags={fragmentTags}
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
              highlightStyle={highlightStyle}
              opts={opts}
              baseTextClass={baseTextClass}
              commonBlockClass={commonBlockClass}
              fragmentsEnabled={!!fragmentsEnabled}
              fragmentStep={fragmentStep || 0}
              fragmentClassNames={fragmentClassNames}
              fragmentTags={fragmentTags}
            />
          )
        case 'code':
          return (
            <MarkdownCodeBlock
              key={key}
              token={t}
              highlightClass={highlightClass}
              highlightStyle={highlightStyle}
              opts={opts}
              wrapClass={markdownWordWrap ? 'whitespace-pre-wrap break-words' : ''}
              fragmentStep={fragmentStep}
            />
          )
        case 'table':
          return (
            <MarkdownTableBlock
              key={key}
              token={t}
              highlightClass={highlightClass}
              highlightStyle={highlightStyle}
              opts={opts}
              fragmentsEnabled={!!fragmentsEnabled}
              fragmentStep={fragmentStep || 0}
              fragmentClassNames={fragmentClassNames}
              fragmentTags={fragmentTags}
            />
          )
        case 'list':
          return (
            <MarkdownListBlock
              key={key}
              token={t}
              highlightClass={highlightClass}
              highlightStyle={highlightStyle}
              opts={opts}
              baseTextClass={baseTextClass}
              wrapClass={markdownWordWrap ? 'whitespace-pre-wrap' : ''}
              fragmentsEnabled={!!fragmentsEnabled}
              fragmentStep={fragmentStep || 0}
              fragmentClassNames={fragmentClassNames}
              fragmentTags={fragmentTags}
            />
          )
        case 'html':
          return (
            <MarkdownHtmlBlock
              key={key}
              token={t}
              highlightClass={highlightClass}
              highlightStyle={highlightStyle}
              opts={opts}
              fragmentsEnabled={!!fragmentsEnabled}
              fragmentStep={fragmentStep || 0}
              fragmentClassNames={fragmentClassNames}
              fragmentTags={fragmentTags}
            />
          )
        case 'paragraph':
          return (
            <MarkdownParagraphBlock
              key={key}
              token={t}
              highlightClass={highlightClass}
              highlightStyle={highlightStyle}
              opts={opts}
              baseTextClass={baseTextClass}
              commonBlockClass={commonBlockClass}
              fragmentsEnabled={!!fragmentsEnabled}
              fragmentStep={fragmentStep || 0}
              fragmentClassNames={fragmentClassNames}
              fragmentTags={fragmentTags}
            />
          )
        default: {
          const className = ['mt-2 mb-2', baseTextClass, commonBlockClass].filter(Boolean).join(' ')
          return (
            <MarkdownBlockContainer
              key={key}
              as="div"
              className={className}
              highlightClass={highlightClass}
              highlightStyle={highlightStyle}
              startLine={t.startLine}
              endLine={t.endLine}
            >
              {String((t as unknown as { raw?: unknown }).raw || '')}
            </MarkdownBlockContainer>
          )
        }
      }
    })
  }

  return <>{renderBlockTokens(tokens)}</>
})

export default MarkdownTokenRenderer
