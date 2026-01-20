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
import { MarkdownFootnoteBlock } from './MarkdownFootnoteBlock'
import type { RenderOpts } from './MarkdownRendererTypes'

type MarkdownTokenRendererProps = {
  tokens: TokenWithLines[]
  activeDocumentPath: string
  highlightedLineRange: { start: number; end: number } | null
  markdownWordWrap: boolean
  markdownPresentationMode: boolean
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  stickyHeadingTopClass?: string
  stickyHeadingTopPx?: number
  mermaidFrontmatterConfig: MermaidInitConfig | null
  rootThemeMode: 'light' | 'dark'
  previewOverlayScope: 'viewport' | 'container'
  previewOverlayPortalTarget?: HTMLElement | null
  markdownTextHighlight?: boolean
  selectionKind?: 'node' | 'edge' | null
  highlightBackgroundColor?: string | null
  highlightUnderlineColor?: string | null
  fragmentsEnabled?: boolean
  fragmentStep?: number
  fragmentClassNames?: string[]
  fragmentTags?: string[]
  collapsedIds?: Set<string>
  onToggleCollapse?: (id: string) => void
  codeAnnotations?: Record<string, string> | null
  annotateDisplayMode?: 'inline' | 'beside'
  flashLine?: number | null
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
    stickyHeadingTopClass,
    stickyHeadingTopPx,
    mermaidFrontmatterConfig,
    rootThemeMode,
    previewOverlayScope,
    previewOverlayPortalTarget,
    markdownTextHighlight,
    selectionKind,
    highlightBackgroundColor,
    highlightUnderlineColor,
    fragmentsEnabled,
    fragmentStep,
    fragmentClassNames,
    fragmentTags,
    collapsedIds,
    onToggleCollapse,
    codeAnnotations,
    annotateDisplayMode,
    flashLine,
  } = props

  let stickyHeadingCascadeBaseDepth = 7
  for (const t of tokens) {
    if (t.type !== 'heading') continue
    const depth = Math.min(6, Math.max(1, t.depth || 1))
    stickyHeadingCascadeBaseDepth = Math.min(stickyHeadingCascadeBaseDepth, depth)
    if (stickyHeadingCascadeBaseDepth === 1) break
  }
  if (stickyHeadingCascadeBaseDepth === 7) stickyHeadingCascadeBaseDepth = 1

  const opts: RenderOpts = {
    activeDocumentPath,
    highlightedLineRange,
    markdownWordWrap,
    markdownPresentationMode,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    stickyHeadingTopClass,
    stickyHeadingTopPx,
    stickyHeadingCascadeBaseDepth,
    mermaidFrontmatterConfig,
    rootThemeMode,
    previewOverlayScope,
    previewOverlayPortalTarget,
    codeAnnotations,
    collapsedIds,
    onToggleCollapse,
  }

  const baseTextClass = markdownPresentationMode ? 'text-2xl leading-relaxed' : 'text-sm leading-normal'
  
  // In presentation mode, we want to override the default panel text size (usually text-xs/text-sm)
  // but keep the font family.
  const commonBlockClass = markdownPresentationMode 
    ? uiPanelTextFontClass.replace(/text-(xs|sm|base|lg|xl)/g, '').trim() 
    : uiPanelTextFontClass

  const renderBlockTokens = (list: TokenWithLines[]) => {
    return list.map((t, i) => {
      const tt = t as unknown as TokensGeneric
      const key = `${tt.type}:${i}`

      let highlightClass = ''
      let highlightStyle: React.CSSProperties | undefined

      if (markdownTextHighlight && highlightedLineRange) {
        const tStart = t.startLine
        const tEnd = t.endLine || t.startLine
        const hStart = highlightedLineRange.start
        const hEnd = highlightedLineRange.end
        const overlap = Math.max(tStart, hStart) <= Math.min(tEnd, hEnd)
        if (overlap) {
          highlightClass = '-mx-1 px-1 rounded transition-colors duration-1000'
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

      if (flashLine) {
        const tStart = t.startLine
        const tEnd = t.endLine || t.startLine
        if (tStart <= flashLine && flashLine <= tEnd) {
          highlightClass = `${highlightClass} markdown-flash-highlight -mx-1 px-1 rounded`.trim()
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
          return <hr key={key} className="my-8 border-t-2 border-slate-100" />
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
              annotateDisplayMode={annotateDisplayMode}
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
        case 'footnote_block':
          return (
            <MarkdownFootnoteBlock
              key={key}
              token={t}
              highlightClass={highlightClass}
              highlightStyle={highlightStyle}
              opts={opts}
            />
          )
        default: {
          const className = ['mt-2 mb-2', baseTextClass, commonBlockClass].filter(Boolean).join(' ')
          return (
            <MarkdownBlockContainer
              key={key}
              as="section"
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
