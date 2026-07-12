import React from 'react'
import type { TokensFootnoteBlock } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { renderInlineTokens } from '@/lib/markdown-core/ui/MarkdownInlineRenderer.impl'
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
import { MARKDOWN_NORMAL_TEXT_EDIT_SURFACE_CLASS } from './markdownEditSurfaceLayout'

type MarkdownFootnoteBlockProps = {
  token: TokenWithLines
  highlightClass: string
  highlightStyle?: React.CSSProperties
  opts: RenderOpts
}

export const MarkdownFootnoteBlock = React.memo(function MarkdownFootnoteBlock({
  token: t,
  highlightClass,
  highlightStyle,
  opts,
}: MarkdownFootnoteBlockProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  const fb = t as unknown as TokensFootnoteBlock
  const startLine = t.startLine
  const endLine = t.endLine || t.startLine

  const blockControlsAllowed =
    !opts.markdownPresentationMode &&
    !!opts.viewerBlockEditingEnabled &&
    opts.markdownBlockControlsEnabled !== false
  const canInsertLine = blockControlsAllowed && !!opts.onInsertLineAfter && Number.isFinite(endLine)
  const canReorder = blockControlsAllowed && !!opts.onReorderLineBlock && Number.isFinite(startLine)
  const gutterEnabled = (canInsertLine || canReorder) && opts.markdownBlockGutterEnabled !== false

  const dnd = useMarkdownLineBlockDnD({
    enabled: canReorder,
    targetStartLine: startLine,
    targetEndLine: endLine,
    onReorder: (source, target, position) => opts.onReorderLineBlock?.(source, target, position),
  })

  const stripFootnotePrefix = React.useCallback((line: string) => {
    const m = line.match(/^(\s*\[\^[^\]]+\]:\s*)([\s\S]*)$/)
    if (m) return { prefix: m[1] || '', content: m[2] || '' }
    const ind = line.match(/^(\s{2,}|\t+)([\s\S]*)$/)
    if (ind) return { prefix: ind[1] || '', content: ind[2] || '' }
    return { prefix: '', content: line }
  }, [])

  return (
    <MarkdownBlockContainer
      as="aside"
      className={[
        `mt-8 pt-4 border-t border-slate-200 text-sm text-slate-500 ${opts.uiPanelTextFontClass}`,
        `relative group ${gutterEnabled ? `${MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS} ${MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS}` : ''}`,
        dnd.isDragging ? 'opacity-60' : '',
      ].join(' ')}
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={startLine}
      endLine={endLine}
      inlineEditable={blockControlsAllowed && !!opts.onReplaceLineRange}
      sourceLines={opts.markdownSourceLines}
      onReplaceLineRange={opts.onReplaceLineRange}
      onInlineEditStateChange={opts.onInlineEditStateChange}
        onInlineDraftTextChange={opts.onInlineDraftTextChange}
      forbidCopy={!!opts.forbidCopy}
      editorClassName={MARKDOWN_NORMAL_TEXT_EDIT_SURFACE_CLASS}
      editPresentation="html"
      editHtmlRender="block"
      editHtmlDisableDefaultBlockFlow
      editStripLinePrefix={stripFootnotePrefix}
      editDefaultLinePrefix="    "
      onDragOver={dnd.handleDragOver}
      onDragLeave={dnd.handleDragLeave}
      onDrop={dnd.handleDrop}
    >
      {gutterEnabled && (
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
      )}
      <ol className="list-decimal list-inside space-y-2">
        {fb.items.map((item, idx) => (
          <li key={idx} id={`fn${item.label}`} className="pl-2">
            <span className="inline-block">
              {renderInlineTokens(item.tokens, {
                activeDocumentPath: opts.activeDocumentPath,
                uiPanelTextFontClass: opts.uiPanelTextFontClass,
                uiPanelMonospaceTextClass: opts.uiPanelMonospaceTextClass,
                markdownPresentationMode: opts.markdownPresentationMode,
                markdownCardPreviewMode: opts.markdownCardPreviewMode,
                markdownViewerMediaMode: opts.markdownViewerMediaMode,
                markdownVariablePreviewByKey: opts.markdownVariablePreviewByKey,
              })}
              <a
                href={`#fnref${item.label}`}
                className="ml-1 text-blue-600 hover:text-blue-800 no-underline"
                aria-label="Back to content"
              >
                ↩
              </a>
            </span>
          </li>
        ))}
      </ol>
    </MarkdownBlockContainer>
  )
})
