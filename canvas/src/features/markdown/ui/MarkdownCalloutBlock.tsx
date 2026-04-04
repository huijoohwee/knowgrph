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
import { resolveContiguousQuoteLineRangeOnOpen } from './markdownEditParitySsot'
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
  if (t === 'tip' || t === 'hint') return 'border-emerald-400 dark:border-emerald-600'
  if (t === 'warning' || t === 'caution') return 'border-amber-400 dark:border-amber-600'
  if (t === 'danger' || t === 'error' || t === 'fail') return 'border-red-400 dark:border-red-600'
  if (t === 'example') return 'border-indigo-400 dark:border-indigo-600'
  if (t === 'note' || t === 'info') return 'border-blue-400 dark:border-blue-600'
  return 'border-slate-300 dark:border-slate-600'
}
const getCalloutAccentClass = (calloutType: string): string => {
  const t = String(calloutType || '').trim().toLowerCase()
  if (t === 'tip' || t === 'hint') return 'bg-emerald-400 dark:bg-emerald-600'
  if (t === 'warning' || t === 'caution') return 'bg-amber-400 dark:bg-amber-600'
  if (t === 'danger' || t === 'error' || t === 'fail') return 'bg-red-400 dark:bg-red-600'
  if (t === 'example') return 'bg-indigo-400 dark:bg-indigo-600'
  if (t === 'note' || t === 'info') return 'bg-blue-400 dark:bg-blue-600'
  return 'bg-slate-300 dark:bg-slate-600'
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
  const innerClassName = [
    `py-2 border-l-4 ${borderClass} ${UI_THEME_TOKENS.table.rowRelated} rounded-r`,
    'text-left',
    baseTextClass,
    commonBlockClass,
    'pl-4',
  ].filter(Boolean).join(' ')
  const gutterInnerClassName = [
    `py-2 border-l-4 ${borderClass} ${UI_THEME_TOKENS.table.rowRelated} rounded-r`,
    'text-left',
    baseTextClass,
    commonBlockClass,
    'pl-4',
  ].filter(Boolean).join(' ')

  const wrapperClassName = [
    'mt-4 mb-4',
    `py-2 border-l-4 ${borderClass} ${UI_THEME_TOKENS.table.rowRelated} rounded-r`,
    'text-left',
    baseTextClass,
    commonBlockClass,
    gutterLayoutEnabled ? MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS : 'pl-4',
    gutterLayoutEnabled ? MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS : '',
  ].filter(Boolean).join(' ')

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
    '[&_p]:m-0',
    '[&_p]:leading-normal',
    '[&_ul]:m-0',
    '[&_ol]:m-0',
    '[&_blockquote]:m-0',
    '[&_blockquote]:pl-0',
    '[&_blockquote]:py-0',
    '[&_blockquote]:border-l-0',
    '[&_blockquote]:rounded-none',
    '[&_blockquote]:bg-transparent',
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
          'w-full min-h-[1lh] whitespace-pre-wrap break-words outline-none bg-transparent',
          baseTextClass,
          commonBlockClass,
          'text-left',
          '[&>*:first-child]:mt-0',
          '[&>*:last-child]:mb-0',
          '[&_p]:font-inherit',
          '[&_p]:text-inherit',
          '[&_p]:m-0',
          '[&_p]:leading-normal',
          '[&_p]:whitespace-pre-wrap',
          '[&_ul]:m-0',
          '[&_ol]:m-0',
        ].filter(Boolean).join(' ')}
        editPresentation="html"
        editHtmlRender="block"
        editHtmlDisableDefaultBlockFlow
        editStripLinePrefix={stripQuotePrefix}
        editDefaultLinePrefix="> "
        editPreserveWhitespace
        editLeftRailClassName={accentClass}
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
      'mt-4 mb-4 relative group',
      MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS,
      MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS,
      `border-l-4 ${borderClass} rounded-r`,
      dnd.isDragging ? 'opacity-60' : '',
    ]
      .filter(Boolean)
      .join(' ')

    const calloutNode = callout.foldable ? (
      <details className={`${gutterInnerClassName} relative`} open={!callout.collapsed || undefined}>
        <span aria-hidden className={`pointer-events-none absolute left-[44px] top-0 bottom-0 w-1 z-20 ${accentClass}`} />
        <summary className={[UI_THEME_TOKENS.text.primary, 'font-semibold cursor-pointer select-none'].join(' ')}>
          {callout.title}
        </summary>
        {calloutBodyNode}
      </details>
    ) : (
      <aside className={`${gutterInnerClassName} relative`} aria-label={callout.title}>
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
        editorClassName="w-full whitespace-pre-wrap break-words outline-none bg-transparent"
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
        editorClassName="w-full whitespace-pre-wrap break-words outline-none bg-transparent"
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
      editorClassName="w-full whitespace-pre-wrap break-words outline-none bg-transparent"
      aria-label={callout.title}
    >
      <span aria-hidden className={`pointer-events-none absolute left-0 top-0 bottom-0 w-1 ${accentClass}`} />
      <header className={[UI_THEME_TOKENS.text.primary, 'font-semibold'].join(' ')}>{callout.title}</header>
      {calloutBodyNode}
    </MarkdownBlockContainer>
  )
})
