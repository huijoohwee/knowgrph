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
  MARKDOWN_BLOCK_GUTTER_CONTENT_START_LEFT_CLASS,
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
import { resolveContiguousQuoteLineRangeOnOpen } from './markdownEditParitySsot'
import {
  getMarkdownQuoteLikeEditorClass,
  MARKDOWN_BLOCKQUOTE_READ_CONTENT_RESET_CLASS,
  MARKDOWN_BLOCKQUOTE_READ_FRAME_CLASS,
  MARKDOWN_BLOCKQUOTE_READ_SPACING_CLASS,
  MARKDOWN_BLOCKQUOTE_READ_TEXT_PADDING_CLASS,
  MARKDOWN_NORMAL_TEXT_READ_SURFACE_BASE_CLASS,
} from './markdownEditSurfaceLayout'

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

  const quoteFrameClassName = [
    MARKDOWN_NORMAL_TEXT_READ_SURFACE_BASE_CLASS,
    MARKDOWN_BLOCKQUOTE_READ_FRAME_CLASS,
    `border-blue-400 dark:border-blue-600 ${UI_THEME_TOKENS.table.rowRelated} ${UI_THEME_TOKENS.text.secondary} italic`,
    baseTextClass,
    commonBlockClass,
  ]
    .filter(Boolean)
    .join(' ')
  const quoteClassName = [MARKDOWN_BLOCKQUOTE_READ_SPACING_CLASS, quoteFrameClassName, MARKDOWN_BLOCKQUOTE_READ_CONTENT_RESET_CLASS]
    .filter(Boolean)
    .join(' ')
  const quoteGutterShellClassName = [
    MARKDOWN_NORMAL_TEXT_READ_SURFACE_BASE_CLASS,
    'py-2 rounded-r',
    `${UI_THEME_TOKENS.table.rowRelated} ${UI_THEME_TOKENS.text.secondary} italic`,
    'before:content-[\'\'] before:absolute before:inset-y-0 before:border-l-4 before:border-blue-400 dark:before:border-blue-600 before:pointer-events-none',
    `before:${MARKDOWN_BLOCK_GUTTER_CONTENT_START_LEFT_CLASS}`,
    baseTextClass,
    commonBlockClass,
  ]
    .filter(Boolean)
    .join(' ')
  const stripQuotePrefix = React.useCallback((line: string) => {
    const m = line.match(/^(\s*(?:>\s*)+)?([\s\S]*)$/)
    const prefix = m?.[1] || ''
    const content = m?.[2] ?? line
    return { prefix, content }
  }, [])
  const resolveQuoteEditLineRange = React.useCallback((eventTarget: HTMLElement | null) => {
    return resolveContiguousQuoteLineRangeOnOpen({
      eventTarget,
      sourceLines: opts.markdownSourceLines,
      fallbackStartLine: Math.max(1, Math.floor(t.startLine)),
    })
  }, [opts.markdownSourceLines, t.startLine])
  const editorQuoteClassNameNoInset = getMarkdownQuoteLikeEditorClass({
    baseTextClass,
    commonBlockClass,
    uiPanelTextFontClass: opts.uiPanelTextFontClass,
    stripNestedBlockquoteInset: true,
  })
  const editorQuoteClassNameNoInsetWithPadding = [
    editorQuoteClassNameNoInset,
    MARKDOWN_BLOCKQUOTE_READ_TEXT_PADDING_CLASS,
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
        inlineEditable={blockControlsAllowed && !!opts.onReplaceLineRange}
        sourceLines={opts.markdownSourceLines}
        onReplaceLineRange={opts.onReplaceLineRange}
        onInlineEditStateChange={opts.onInlineEditStateChange}
        onInlineDraftTextChange={opts.onInlineDraftTextChange}
        forbidCopy={!!opts.forbidCopy}
        editorClassName={editorQuoteClassNameNoInset}
        resolveEditLineRangeOnOpen={resolveQuoteEditLineRange}
        editPresentation="html"
        editHtmlRender="block"
        editHtmlDisableDefaultBlockFlow
        editSigilRenderMode="plain"
        editStripLinePrefix={stripQuotePrefix}
        editPreserveWhitespace
        editTrimEdgeNewlines
        editTrimEmptyBlockEdges
        editCaptureLayoutSpacing
        editPreserveBlockHeight={false}
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
    MARKDOWN_BLOCKQUOTE_READ_SPACING_CLASS,
    'relative group',
    MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS,
    MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS,
    quoteGutterShellClassName,
    dnd.isDragging ? 'opacity-60' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <MarkdownBlockContainer
      as="section"
      className={wrapperClassName}
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={t.startLine}
      endLine={t.endLine}
      inlineEditable={blockControlsAllowed && !!opts.onReplaceLineRange}
      sourceLines={opts.markdownSourceLines}
      onReplaceLineRange={opts.onReplaceLineRange}
      onInlineEditStateChange={opts.onInlineEditStateChange}
        onInlineDraftTextChange={opts.onInlineDraftTextChange}
      forbidCopy={!!opts.forbidCopy}
      editorClassName={editorQuoteClassNameNoInsetWithPadding}
      resolveEditLineRangeOnOpen={resolveQuoteEditLineRange}
      editPresentation="html"
      editHtmlRender="block"
      editHtmlDisableDefaultBlockFlow
      editSigilRenderMode="plain"
      editStripLinePrefix={stripQuotePrefix}
      editPreserveWhitespace
      editTrimEdgeNewlines
      editTrimEmptyBlockEdges
      editCaptureLayoutSpacing
      editPreserveBlockHeight={false}
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
      <blockquote className={[MARKDOWN_BLOCKQUOTE_READ_TEXT_PADDING_CLASS, MARKDOWN_BLOCKQUOTE_READ_CONTENT_RESET_CLASS].filter(Boolean).join(' ')}>
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
