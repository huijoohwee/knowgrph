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
import { resolveContiguousQuoteLineRangeOnOpen } from './markdownEditParitySsot'
import { MARKDOWN_NORMAL_TEXT_EDIT_SURFACE_CLASS } from './markdownEditSurfaceLayout'

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
    `pl-4 py-2 border-l-4 border-solid border-blue-400 dark:border-blue-600 ${UI_THEME_TOKENS.table.rowRelated} rounded-r ${UI_THEME_TOKENS.text.secondary} italic`,
    'text-left',
    '[&_p]:m-0',
    '[&_p]:leading-normal',
    '[&_ul]:m-0',
    '[&_ol]:m-0',
    baseTextClass,
    commonBlockClass,
  ]
    .filter(Boolean)
    .join(' ')
  const quoteInnerClassName = quoteClassName
    .replace(/^mt-4 mb-4\s+/, '')
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
  const editorQuoteClassName = [
    MARKDOWN_NORMAL_TEXT_EDIT_SURFACE_CLASS,
    'min-h-[1lh] leading-normal',
    baseTextClass,
    commonBlockClass,
    opts.uiPanelTextFontClass,
    '[&_div]:font-inherit',
    '[&_div]:text-inherit',
    '[&_div]:m-0',
    '[&_div]:leading-normal',
    '[&_div]:whitespace-pre-wrap',
    '[&_p]:font-inherit',
    '[&_p]:text-inherit',
    '[&_p]:m-0',
    '[&_p]:leading-normal',
    '[&_p]:whitespace-pre-wrap',
    '[&_ul]:m-0',
    '[&_ol]:m-0',
  ]
    .filter(Boolean)
    .join(' ')
  const editorQuoteClassNameNoInset = [
    MARKDOWN_NORMAL_TEXT_EDIT_SURFACE_CLASS,
    'min-h-[1lh] leading-normal',
    baseTextClass,
    commonBlockClass,
    opts.uiPanelTextFontClass,
    '[&_div]:font-inherit',
    '[&_div]:text-inherit',
    '[&_div]:m-0',
    '[&_div]:leading-normal',
    '[&_div]:whitespace-pre-wrap',
    '[&_p]:font-inherit',
    '[&_p]:text-inherit',
    '[&_p]:m-0',
    '[&_p]:leading-normal',
    '[&_p]:whitespace-pre-wrap',
    '[&_ul]:m-0',
    '[&_ol]:m-0',
    '[&_blockquote]:m-0',
    '[&_blockquote]:pl-0',
    '[&_blockquote]:py-0',
    '[&_blockquote]:border-l-0',
    '[&_blockquote]:rounded-none',
    '[&_blockquote]:bg-transparent',
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
    'mt-4 mb-4 relative group',
    MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS,
    MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS,
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
      forbidCopy={!!opts.forbidCopy}
      editorClassName={editorQuoteClassName}
      resolveEditLineRangeOnOpen={resolveQuoteEditLineRange}
      editPresentation="html"
      editHtmlRender="block"
      editHtmlDisableDefaultBlockFlow
      editSigilRenderMode="plain"
      editStripLinePrefix={stripQuotePrefix}
      editPreserveWhitespace
      editTrimEdgeNewlines
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
