import React from 'react'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import type { Token, TokensCallout } from './MarkdownTokens'
import { addLineRangesToTokens } from '@/features/markdown/ui/markdownPreviewLex'
import MarkdownTokenRenderer from './MarkdownTokenRenderer'
import type { RenderOpts } from './MarkdownRendererTypes'
import { MarkdownBlockContainer } from './MarkdownBlockContainer'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_COPY } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_INTENT_TOKENS } from 'grph-shared/ui/intentTokens'
import { resolveContiguousQuoteLineRangeOnOpen } from './markdownEditParitySsot'
import {
  getMarkdownQuoteLikeEditorClass,
  MARKDOWN_BLOCKQUOTE_READ_FRAME_CLASS,
  MARKDOWN_BLOCKQUOTE_READ_SPACING_CLASS,
  MARKDOWN_NORMAL_TEXT_EDIT_SURFACE_CLASS,
  MARKDOWN_NORMAL_TEXT_READ_SURFACE_BASE_CLASS,
  MARKDOWN_QUOTE_LIKE_CONTENT_RESET_CLASS,
} from './markdownEditSurfaceLayout'
import {
  MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS,
  MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS,
  MarkdownBlockDropMarkers,
  MarkdownBlockGutterControls,
  useMarkdownLineBlockDnD,
} from './MarkdownBlockGutter'

type MarkdownCalloutBlockProps = {
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

const getCalloutBorderClass = (calloutType: string): string => {
  const t = String(calloutType || '').trim().toLowerCase()
  if (t === 'tip' || t === 'hint') return UI_INTENT_TOKENS.success.border
  if (t === 'warning' || t === 'caution') return UI_INTENT_TOKENS.warning.border
  if (t === 'danger' || t === 'error' || t === 'fail') return UI_INTENT_TOKENS.danger.border
  if (t === 'example') return UI_INTENT_TOKENS.example.border
  if (t === 'note' || t === 'info') return UI_INTENT_TOKENS.info.border
  return UI_INTENT_TOKENS.neutral.border
}
const getCalloutAccentClass = (calloutType: string): string => {
  const t = String(calloutType || '').trim().toLowerCase()
  if (t === 'tip' || t === 'hint') return UI_INTENT_TOKENS.success.accentBg
  if (t === 'warning' || t === 'caution') return UI_INTENT_TOKENS.warning.accentBg
  if (t === 'danger' || t === 'error' || t === 'fail') return UI_INTENT_TOKENS.danger.accentBg
  if (t === 'example') return UI_INTENT_TOKENS.example.accentBg
  if (t === 'note' || t === 'info') return UI_INTENT_TOKENS.info.accentBg
  return UI_INTENT_TOKENS.neutral.accentBg
}

export const MarkdownCalloutBlock = React.memo(function MarkdownCalloutBlock({
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
}: MarkdownCalloutBlockProps) {
  const callout = t as unknown as TokensCallout
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)
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

  const borderClass = getCalloutBorderClass(callout.calloutType)
  const accentClass = getCalloutAccentClass(callout.calloutType)
  const contentTokens = addLineRangesToTokens((callout.tokens || []) as unknown as Token[], 0)
  const calloutFrameClassName = [
    MARKDOWN_NORMAL_TEXT_READ_SURFACE_BASE_CLASS,
    MARKDOWN_BLOCKQUOTE_READ_FRAME_CLASS,
    borderClass,
    UI_THEME_TOKENS.table.rowRelated,
    baseTextClass,
    commonBlockClass,
  ]
    .filter(Boolean)
    .join(' ')
  const innerClassName = [
    calloutFrameClassName,
    'pl-4',
  ].filter(Boolean).join(' ')

  const wrapperClassName = [
    MARKDOWN_BLOCKQUOTE_READ_SPACING_CLASS,
    calloutFrameClassName,
    gutterLayoutEnabled ? MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS : 'pl-4',
    gutterLayoutEnabled ? MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS : '',
  ].filter(Boolean).join(' ')
  const calloutContainerEditorClassName = MARKDOWN_NORMAL_TEXT_EDIT_SURFACE_CLASS

  const inner = (
    <MarkdownTokenRenderer
      tokens={contentTokens}
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
  )
  const stripQuotePrefix = React.useCallback((line: string) => {
    const m = line.match(/^(\s*(?:>\s*)+)?([\s\S]*)$/)
    const prefix = m?.[1] || ''
    const content = m?.[2] ?? line
    return { prefix, content }
  }, [])
  const calloutBodyStartLine = Math.floor(t.startLine) + 1
  const calloutBodyEndLine = Math.floor(endLine)
  const calloutBodyContentClassName = [
    'w-full',
    MARKDOWN_QUOTE_LIKE_CONTENT_RESET_CLASS,
    '[&_blockquote]:not-italic',
  ].join(' ')
  const calloutBodyEditable =
    blockControlsAllowed &&
    !!opts.onReplaceLineRange &&
    Array.isArray(opts.markdownSourceLines) &&
    Number.isFinite(calloutBodyStartLine) &&
    Number.isFinite(calloutBodyEndLine) &&
    calloutBodyStartLine <= calloutBodyEndLine
  const resolveCalloutBodyEditLineRange = React.useCallback((eventTarget: HTMLElement | null) => {
    return resolveContiguousQuoteLineRangeOnOpen({
      eventTarget,
      sourceLines: opts.markdownSourceLines,
      fallbackStartLine: Math.max(1, calloutBodyStartLine),
      minStartLine: Math.max(1, calloutBodyStartLine),
    })
  }, [calloutBodyStartLine, opts.markdownSourceLines])
  const calloutBodyNode = calloutBodyEditable ? (
    <section className="mt-2 relative pl-4">
      <span aria-hidden className={`pointer-events-none absolute left-0 top-0 bottom-0 w-1 z-30 ${accentClass}`} />
      <MarkdownBlockContainer
        as="section"
        className={calloutBodyContentClassName}
        highlightClass=""
        startLine={calloutBodyStartLine}
        endLine={calloutBodyEndLine}
        resolveEditLineRangeOnOpen={resolveCalloutBodyEditLineRange}
        inlineEditable={true}
        sourceLines={opts.markdownSourceLines}
        onReplaceLineRange={opts.onReplaceLineRange}
        onInlineEditStateChange={opts.onInlineEditStateChange}
        forbidCopy={!!opts.forbidCopy}
        editorClassName={[
          getMarkdownQuoteLikeEditorClass({
            baseTextClass,
            commonBlockClass,
          }),
          '[&>*:first-child]:mt-0',
          '[&>*:last-child]:mb-0',
        ].filter(Boolean).join(' ')}
        editPresentation="html"
        editHtmlRender="block"
        editHtmlDisableDefaultBlockFlow
        editStripLinePrefix={stripQuotePrefix}
        editDefaultLinePrefix="> "
        editPreserveWhitespace
      >
        {inner}
      </MarkdownBlockContainer>
    </section>
  ) : (
    <section className="mt-2 relative pl-4">
      <span aria-hidden className={`pointer-events-none absolute left-0 top-0 bottom-0 w-1 z-30 ${accentClass}`} />
      <section className={calloutBodyContentClassName}>{inner}</section>
    </section>
  )

  if (gutterLayoutEnabled) {
    const outerClassName = [
      MARKDOWN_BLOCKQUOTE_READ_SPACING_CLASS,
      'relative group',
      MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS,
      MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS,
      `border-l-4 ${borderClass} rounded-r`,
      dnd.isDragging ? 'opacity-60' : '',
    ]
      .filter(Boolean)
      .join(' ')

    const calloutNode = callout.foldable ? (
      <details className={`${innerClassName} relative`} open={!callout.collapsed || undefined}>
        <span aria-hidden className={`pointer-events-none absolute left-[44px] top-0 bottom-0 w-1 z-20 ${accentClass}`} />
        <summary className={[UI_THEME_TOKENS.text.primary, 'font-semibold cursor-pointer select-none'].join(' ')}>
          {callout.title}
        </summary>
        {calloutBodyNode}
      </details>
    ) : (
      <aside className={`${innerClassName} relative`} aria-label={callout.title}>
        <span aria-hidden className={`pointer-events-none absolute left-[44px] top-0 bottom-0 w-1 z-20 ${accentClass}`} />
        <header className={[UI_THEME_TOKENS.text.primary, 'font-semibold'].join(' ')}>{callout.title}</header>
        {calloutBodyNode}
      </aside>
    )

    return (
      <MarkdownBlockContainer
        as="section"
        className={outerClassName}
        highlightClass={highlightClass}
        highlightStyle={highlightStyle}
        startLine={t.startLine}
        endLine={t.endLine}
        inlineEditable={false}
        sourceLines={opts.markdownSourceLines}
        onReplaceLineRange={opts.onReplaceLineRange}
        onInlineEditStateChange={opts.onInlineEditStateChange}
        editorClassName={calloutContainerEditorClassName}
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
        {calloutNode}
      </MarkdownBlockContainer>
    )
  }

  if (callout.foldable) {
    return (
      <MarkdownBlockContainer
        as="details"
        className={`${wrapperClassName} relative`}
        highlightClass={highlightClass}
        highlightStyle={highlightStyle}
        startLine={t.startLine}
        endLine={t.endLine}
        inlineEditable={false}
        sourceLines={opts.markdownSourceLines}
        onReplaceLineRange={opts.onReplaceLineRange}
        onInlineEditStateChange={opts.onInlineEditStateChange}
        editorClassName={calloutContainerEditorClassName}
        defaultOpen={!callout.collapsed}
      >
        <span aria-hidden className={`pointer-events-none absolute left-0 top-0 bottom-0 w-1 ${accentClass}`} />
        <summary className={[UI_THEME_TOKENS.text.primary, 'font-semibold cursor-pointer select-none'].join(' ')}>
          {callout.title}
        </summary>
        {calloutBodyNode}
      </MarkdownBlockContainer>
    )
  }

  return (
    <MarkdownBlockContainer
      as="aside"
      className={`${wrapperClassName} relative`}
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={t.startLine}
      endLine={t.endLine}
      inlineEditable={false}
      sourceLines={opts.markdownSourceLines}
      onReplaceLineRange={opts.onReplaceLineRange}
      onInlineEditStateChange={opts.onInlineEditStateChange}
      editorClassName={calloutContainerEditorClassName}
      aria-label={callout.title}
    >
      <span aria-hidden className={`pointer-events-none absolute left-0 top-0 bottom-0 w-1 ${accentClass}`} />
      <header className={[UI_THEME_TOKENS.text.primary, 'font-semibold'].join(' ')}>{callout.title}</header>
      {calloutBodyNode}
    </MarkdownBlockContainer>
  )
})
