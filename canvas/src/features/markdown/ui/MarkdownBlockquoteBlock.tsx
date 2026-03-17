import React from 'react'
import type { TokensBlockquote, Token } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { addLineRangesToTokens } from '@/features/markdown/ui/markdownPreviewLex'
import MarkdownTokenRenderer from './MarkdownTokenRenderer'
import type { RenderOpts } from './MarkdownRendererTypes'
import { MarkdownBlockContainer } from './MarkdownBlockContainer'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_COPY } from '@/lib/config'
import {
  MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS,
  MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS,
  MarkdownBlockDropMarkers,
  MarkdownBlockGutterControls,
  useMarkdownLineBlockDnD,
} from './MarkdownBlockGutter'

type MarkdownBlockquoteBlockProps = {
  token: TokenWithLines
  highlightClass: string
  highlightStyle?: React.CSSProperties
  opts: RenderOpts
  baseTextClass: string
  commonBlockClass: string
  fragmentsEnabled?: boolean
  fragmentStep?: number
  fragmentClassNames?: string[]
  fragmentTags?: string[]
}

import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export const MarkdownBlockquoteBlock = React.memo(function MarkdownBlockquoteBlock({
  token: t,
  highlightClass,
  highlightStyle,
  opts,
  baseTextClass,
  commonBlockClass,
  fragmentsEnabled,
  fragmentStep,
  fragmentClassNames,
  fragmentTags,
}: MarkdownBlockquoteBlockProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  const bq = t as unknown as TokensBlockquote
  const endLine = t.endLine || t.startLine
  const blockControlsAllowed =
    !opts.markdownPresentationMode &&
    !!opts.viewerBlockEditingEnabled &&
    opts.markdownBlockControlsEnabled !== false
  const canInsertLine = blockControlsAllowed && !!opts.onInsertLineAfter && Number.isFinite(endLine)
  const canReorder = blockControlsAllowed && !!opts.onReorderLineBlock && Number.isFinite(t.startLine)
  const gutterEnabled = (canInsertLine || canReorder) && opts.markdownBlockGutterEnabled !== false
  const gutterLayoutEnabled = opts.markdownBlockGutterEnabled !== false

  const dnd = useMarkdownLineBlockDnD({
    enabled: canReorder,
    targetStartLine: t.startLine,
    targetEndLine: endLine,
    onReorder: (source, target, position) => opts.onReorderLineBlock?.(source, target, position),
  })

  const quoteClassName = [
    'mt-4 mb-4',
    `pl-4 py-2 border-l-4 border-blue-400 dark:border-blue-600 ${UI_THEME_TOKENS.table.rowRelated} rounded-r ${UI_THEME_TOKENS.text.secondary} italic`,
    'text-left',
    baseTextClass,
    commonBlockClass,
  ]
    .filter(Boolean)
    .join(' ')

  if (!gutterLayoutEnabled) {
    return (
      <MarkdownBlockContainer
        as="blockquote"
        className={quoteClassName}
        highlightClass={highlightClass}
        highlightStyle={highlightStyle}
        startLine={t.startLine}
        endLine={t.endLine}
      >
        <MarkdownTokenRenderer
          tokens={addLineRangesToTokens(bq.tokens as unknown as Token[], 0)}
          blockNestingLevel={1}
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
          fragmentsEnabled={fragmentsEnabled}
          fragmentStep={fragmentStep}
          fragmentClassNames={fragmentClassNames}
          fragmentTags={fragmentTags}
        />
      </MarkdownBlockContainer>
    )
  }

  const wrapperClassName = [
    'mt-4 mb-4 relative group',
    MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS,
    MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS,
    dnd.isDragging ? 'opacity-60' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const quoteInnerClassName = quoteClassName
    .replace(/^mt-4 mb-4\s+/, '')

  return (
    <MarkdownBlockContainer
      as="section"
      className={wrapperClassName}
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={t.startLine}
      endLine={t.endLine}
      onDragOver={gutterEnabled ? dnd.handleDragOver : undefined}
      onDragLeave={gutterEnabled ? dnd.handleDragLeave : undefined}
      onDrop={gutterEnabled ? dnd.handleDrop : undefined}
    >
      {gutterEnabled ? (
        <>
          <MarkdownBlockDropMarkers dragState={dnd.dragState} />
          <MarkdownBlockGutterControls
            canInsertLine={canInsertLine}
            onInsertLine={() => opts.onInsertLineAfter?.(endLine)}
            canReorder={canReorder}
            onDragStart={dnd.handleDragStart}
            onDragEnd={dnd.handleDragEnd}
            iconSizeClass={iconSizeClass}
            iconStrokeWidth={uiIconStrokeWidth}
            labelReorder={UI_COPY.markdownBlockReorderLineLabel}
            labelInsert={UI_COPY.markdownBlockInsertLineLabel}
          />
        </>
      ) : null}
      <blockquote className={quoteInnerClassName}>
        <MarkdownTokenRenderer
          tokens={addLineRangesToTokens(bq.tokens as unknown as Token[], 0)}
          blockNestingLevel={1}
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
          fragmentsEnabled={fragmentsEnabled}
          fragmentStep={fragmentStep}
          fragmentClassNames={fragmentClassNames}
          fragmentTags={fragmentTags}
        />
      </blockquote>
    </MarkdownBlockContainer>
  )
})
