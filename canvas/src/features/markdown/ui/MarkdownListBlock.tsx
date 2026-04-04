import React from 'react'
import type { TokensList, Token } from './MarkdownTokens'
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

type MarkdownListBlockProps = {
  token: TokenWithLines
  highlightClass: string
  opts: RenderOpts
  baseTextClass: string
  wrapClass: string
  highlightStyle?: React.CSSProperties
  fragmentsEnabled?: boolean
  fragmentStep?: number
  fragmentClassNames?: string[]
  fragmentTags?: string[]
}

import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export const MarkdownListBlock = React.memo(function MarkdownListBlock({
  token: t,
  highlightClass,
  opts,
  baseTextClass,
  wrapClass,
  highlightStyle,
  fragmentsEnabled,
  fragmentStep,
  fragmentClassNames,
  fragmentTags,
}: MarkdownListBlockProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  const list = t as unknown as TokensList
  const endLine = t.endLine || t.startLine
  const blockControlsAllowed =
    !opts.markdownPresentationMode &&
    !!opts.viewerBlockEditingEnabled &&
    opts.markdownBlockControlsEnabled !== false
  const canInsertLine = blockControlsAllowed && !!opts.onInsertLineAfter && Number.isFinite(endLine)
  const canReorder = blockControlsAllowed && !!opts.onReorderLineBlock && Number.isFinite(t.startLine)
  const gutterEnabled = (canInsertLine || canReorder) && opts.markdownBlockGutterEnabled !== false

  const dnd = useMarkdownLineBlockDnD({
    enabled: canReorder,
    targetStartLine: t.startLine,
    targetEndLine: endLine,
    onReorder: (source, target, position) => opts.onReorderLineBlock?.(source, target, position),
  })
  const editLineRange = React.useMemo(() => {
    const src = opts.markdownSourceLines
    if (!Array.isArray(src) || src.length === 0) return null
    let start = Math.max(1, Math.floor(t.startLine || 1))
    let end = Math.max(start, Math.floor(t.endLine || t.startLine || 1))
    while (start <= end && !String(src[start - 1] || '').trim()) start += 1
    while (end >= start && !String(src[end - 1] || '').trim()) end -= 1
    if (start > end) return null
    return { startLine: start, endLine: end }
  }, [opts.markdownSourceLines, t.endLine, t.startLine])
  const ListTag = (list.ordered ? 'ol' : 'ul') as 'ol' | 'ul'
  const listClass = list.ordered ? 'list-decimal' : 'list-disc'
  const listSurfaceClass = `${listClass} pl-5 space-y-1.5 marker:${UI_THEME_TOKENS.text.tertiary}`
  const listEditFlowClass = list.ordered
    ? `[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_ol]:marker:${UI_THEME_TOKENS.text.tertiary} [&_li]:list-item`
    : `[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:marker:${UI_THEME_TOKENS.text.tertiary} [&_li]:list-item`
  const listReadInnerClassName = [
    listSurfaceClass,
    baseTextClass,
    opts.uiPanelTextFontClass,
    'm-0',
  ]
    .filter(Boolean)
    .join(' ')
  const editorListClassName = [
    'block w-full m-0 whitespace-pre-wrap break-words outline-none bg-transparent',
    listEditFlowClass,
    baseTextClass,
    opts.uiPanelTextFontClass,
  ]
    .filter(Boolean)
    .join(' ')
  const listNode = React.useMemo(() => (
    <ListTag className={listReadInnerClassName}>
      {list.items.map((item, j) => {
        const task = item.task ? (
          <input
            type="checkbox"
            checked={!!item.checked}
            readOnly
            className="mr-2 translate-y-[1px]"
          />
        ) : null
        return (
          <li key={j} data-kg-list-item-index={j} className={[opts.uiPanelTextFontClass, wrapClass].filter(Boolean).join(' ')}>
            {task}
            <MarkdownTokenRenderer
              tokens={addLineRangesToTokens(item.tokens as unknown as Token[], 0)}
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
          </li>
        )
      })}
    </ListTag>
  ), [
    ListTag,
    fragmentClassNames,
    fragmentStep,
    fragmentTags,
    fragmentsEnabled,
    list.items,
    listReadInnerClassName,
    opts.activeDocumentPath,
    opts.markdownPresentationMode,
    opts.markdownWordWrap,
    opts.mermaidFrontmatterConfig,
    opts.previewOverlayPortalTarget,
    opts.previewOverlayScope,
    opts.rootThemeMode,
    opts.uiPanelMonospaceTextClass,
    opts.uiPanelTextFontClass,
    wrapClass,
  ])

  if (!gutterEnabled) {
    return (
      <MarkdownBlockContainer
        as="section"
        className={['mt-3 mb-3', baseTextClass, opts.uiPanelTextFontClass].filter(Boolean).join(' ')}
        highlightClass={highlightClass}
        highlightStyle={highlightStyle}
        startLine={t.startLine}
        endLine={t.endLine}
        editLineRange={editLineRange || undefined}
        inlineEditable={blockControlsAllowed && !!opts.onReplaceLineRange}
        sourceLines={opts.markdownSourceLines}
        onReplaceLineRange={opts.onReplaceLineRange}
        onInlineEditStateChange={opts.onInlineEditStateChange}
        forbidCopy={!!opts.forbidCopy}
        editorClassName={editorListClassName}
        editPresentation="html"
        editHtmlRender="block"
        editHtmlDisableDefaultBlockFlow
        editTrimEmptyBlockEdges
        editEnforceSingleListRoot
        editListMode={list.ordered ? 'ordered' : 'unordered'}
      >
        {listNode}
      </MarkdownBlockContainer>
    )
  }

  const wrapperClassName = [
    'mt-3 mb-3 relative group',
    MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS,
    MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS,
    baseTextClass,
    opts.uiPanelTextFontClass,
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
      editLineRange={editLineRange || undefined}
      inlineEditable={blockControlsAllowed && !!opts.onReplaceLineRange}
      sourceLines={opts.markdownSourceLines}
      onReplaceLineRange={opts.onReplaceLineRange}
      onInlineEditStateChange={opts.onInlineEditStateChange}
      forbidCopy={!!opts.forbidCopy}
      editorClassName={editorListClassName}
      editPresentation="html"
      editHtmlRender="block"
      editHtmlDisableDefaultBlockFlow
      editTrimEmptyBlockEdges
      editEnforceSingleListRoot
      editListMode={list.ordered ? 'ordered' : 'unordered'}
      onDragOver={dnd.handleDragOver}
      onDragLeave={dnd.handleDragLeave}
      onDrop={dnd.handleDrop}
    >
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
      {listNode}
    </MarkdownBlockContainer>
  )
})
