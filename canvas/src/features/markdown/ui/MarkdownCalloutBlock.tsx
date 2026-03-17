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
  const contentTokens = addLineRangesToTokens((callout.tokens || []) as unknown as Token[], 0)
  const innerClassName = [
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

  if (gutterLayoutEnabled) {
    const outerClassName = [
      'mt-4 mb-4 relative group',
      MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS,
      MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS,
      dnd.isDragging ? 'opacity-60' : '',
    ]
      .filter(Boolean)
      .join(' ')

    const calloutNode = callout.foldable ? (
      <details className={innerClassName} open={!callout.collapsed || undefined}>
        <summary className={[UI_THEME_TOKENS.text.primary, 'font-semibold cursor-pointer select-none'].join(' ')}>
          {callout.title}
        </summary>
        <section className="mt-2">{inner}</section>
      </details>
    ) : (
      <aside className={innerClassName} aria-label={callout.title}>
        <header className={[UI_THEME_TOKENS.text.primary, 'font-semibold'].join(' ')}>{callout.title}</header>
        <section className="mt-2">{inner}</section>
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
        className={wrapperClassName}
        highlightClass={highlightClass}
        highlightStyle={highlightStyle}
        startLine={t.startLine}
        endLine={t.endLine}
        defaultOpen={!callout.collapsed}
      >
        <summary className={[UI_THEME_TOKENS.text.primary, 'font-semibold cursor-pointer select-none'].join(' ')}>
          {callout.title}
        </summary>
        <section className="mt-2">{inner}</section>
      </MarkdownBlockContainer>
    )
  }

  return (
    <MarkdownBlockContainer
      as="aside"
      className={wrapperClassName}
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={t.startLine}
      endLine={t.endLine}
      aria-label={callout.title}
    >
      <header className={[UI_THEME_TOKENS.text.primary, 'font-semibold'].join(' ')}>{callout.title}</header>
      <section className="mt-2">{inner}</section>
    </MarkdownBlockContainer>
  )
})
