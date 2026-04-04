import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => fs.readFileSync(absPath, { encoding: 'utf8' })

export const testMarkdownViewerInlineEditConfigSupportsImagesTasksHrTable = () => {
  const root = process.cwd()

  const blockPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownBlockContainer.tsx')
  const blockText = readUtf8(blockPath)
  if (!blockText.includes('includeImages: true')) {
    throw new Error('expected html→md conversion to include images (includeImages: true)')
  }
  if (!blockText.includes('taskPrefixMatch')) {
    throw new Error('expected task list prefix preservation logic in buildReplacementLinesFromDraft')
  }
  if (!blockText.includes('hasAnyList')) {
    throw new Error('expected html list edit normalization to handle multi-root list sequences')
  }
  if (!blockText.includes("querySelectorAll('ol, ul')")) {
    throw new Error('expected html list edit normalization to enforce list spacing parity across ordered/unordered roots')
  }
  if (!blockText.includes('unwrapSingleListWrappers')) {
    throw new Error('expected html list edit normalization to unwrap list wrappers before sibling-gap cleanup')
  }
  if (!blockText.includes("className={editInlineFlow ? 'relative inline min-w-0 align-baseline'")) {
    throw new Error('expected block container to support inline edit-flow host wrapping for list marker baseline parity')
  }
  if (!blockText.includes('normalizeListAncestorSpacing')) {
    throw new Error('expected html list edit normalization to reset wrapper ancestor spacing around list roots')
  }
  if (blockText.includes('if (editListMode) return')) {
    throw new Error('expected list edit mode to participate in edge trim burst scheduling (no special-case disable)')
  }
  if (!blockText.includes('[&_code]:align-baseline')) {
    throw new Error('expected inline code to align with surrounding text baseline in html edit surfaces')
  }
  if (!blockText.includes('[&_code]:leading-[var(--kg-inline-code-line-height,inherit)]')) {
    throw new Error('expected inline code to inherit surrounding line-height via css var in html edit surfaces')
  }
  if (!blockText.includes('[&_code]:text-[length:var(--kg-inline-code-font-size,inherit)]')) {
    throw new Error('expected inline code to inherit surrounding font-size via css var in html edit surfaces')
  }
  if (!blockText.includes('[&_code]:ring-1') || !blockText.includes('[&_code]:ring-inset')) {
    throw new Error('expected inline code to use ring styling to avoid border layout mutation in html edit surfaces')
  }
  if (blockText.includes("'[_&code]:border'")) {
    throw new Error('expected html edit surfaces to avoid inline-code border styling that mutates layout')
  }
  if (blockText.includes('[&_code]:border-[color:var(--kg-code-border)]')) {
    throw new Error('expected html edit surfaces to avoid inline-code border styling that mutates layout')
  }
  if (!blockText.includes('[&_code]:py-0')) {
    throw new Error('expected inline code to avoid vertical padding in html edit surfaces to reduce line-box mutation')
  }
  if (blockText.includes('[&_code]:py-0.5')) {
    throw new Error('expected html edit surfaces to avoid inline-code vertical padding that mutates spacing')
  }
  if (blockText.includes('[&_code]:text-sm')) {
    throw new Error('expected html edit surfaces to avoid hardcoded inline-code text size mutation')
  }

  const rendererPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownTokenRenderer.tsx')
  const rendererText = readUtf8(rendererPath)
  if (!rendererText.includes("case 'hr':") || !rendererText.includes('editPresentation="html"')) {
    throw new Error('expected hr blocks to be editable via MarkdownBlockContainer html presentation')
  }

  const inlinePath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownInlineRenderer.tsx')
  const inlineText = readUtf8(inlinePath)
  if (!inlineText.includes('ring-[color:var(--kg-code-border)]') || !inlineText.includes('bg-[color:var(--kg-code-bg)]')) {
    throw new Error('expected read inline code to reuse css-var-backed code surface styling for view/edit parity')
  }
  if (!inlineText.includes('px-1.5 py-0 rounded')) {
    throw new Error('expected read inline code to match edit surface padding contract')
  }
  if (!inlineText.includes('text-[length:var(--kg-inline-code-font-size,inherit)]')) {
    throw new Error('expected read inline code to match edit surface font-size contract via css var')
  }
  if (!inlineText.includes('leading-[var(--kg-inline-code-line-height,inherit)]')) {
    throw new Error('expected read inline code to match edit surface line-height contract via css var')
  }
  if (inlineText.includes('py-0.5') || inlineText.includes('text-sm')) {
    throw new Error('expected read inline code to avoid hardcoded spacing/size that would break parity')
  }

  const tablePath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownTableBlock.tsx')
  const tableText = readUtf8(tablePath)
  if (!tableText.includes('inlineEditable={false}')) {
    throw new Error('expected table/data-view blocks to forbid inline text-edit surface entry')
  }
  if (tableText.includes('inlineEditable={blockControlsAllowed && !!opts.onReplaceLineRange}')) {
    throw new Error('expected table/data-view blocks to avoid toggling into generic contentEditable surface')
  }

  const codePath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownCodeBlock.tsx')
  const codeText = readUtf8(codePath)
  if (!codeText.includes('editDisableRichUi')) {
    throw new Error('expected code blocks to disable rich inline-edit UI')
  }
  if (!codeText.includes('editLineRange')) {
    throw new Error('expected code blocks to compute an inner editLineRange for fenced code')
  }
  if (!codeText.includes('editStaticChildren')) {
    throw new Error('expected code blocks to preserve header layout during inline edit (editStaticChildren)')
  }
  if (!codeText.includes('editTypographyMode="none"')) {
    throw new Error('expected code blocks to opt out of inherited typography to preserve monospace')
  }
  if (!codeText.includes('editPreserveWhitespace')) {
    throw new Error('expected code blocks to preserve indentation whitespace during inline edit')
  }
  if (!codeText.includes("'p-4'")) {
    throw new Error('expected code block inline editor to reuse p-4 spacing for edit-as-is surface parity')
  }
  if (codeText.includes('min-h-[96px]')) {
    throw new Error('expected code block inline editor to avoid hardcoded min height that changes layout')
  }
  if (!codeText.includes('w-full m-0 whitespace-pre outline-none bg-transparent overflow-auto')) {
    throw new Error('expected code block inline editor root to reset margins and preserve edit-as-is spacing')
  }

  const listPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownListBlock.tsx')
  const listText = readUtf8(listPath)
  if (!listText.includes('getMarkdownListSurfaceClass(!!list.ordered)')) {
    throw new Error('expected list renderer to keep ordered/unordered marker semantics through shared surface class builder')
  }
  if (!listText.includes('const listItemRowRanges = React.useMemo(() =>')) {
    throw new Error('expected list inline editor to compute separate row token line ranges')
  }
  if (!listText.includes('data-kg-list-item-start-line={resolvedRowRange.startLine}') || !listText.includes('data-kg-list-item-end-line={resolvedRowRange.endLine}')) {
    throw new Error('expected list inline renderer to expose per-row token line metadata')
  }
  if (!listText.includes('editLineRange={resolvedRowRange}')) {
    throw new Error('expected list row inline editor to edit one row token range at a time')
  }
  if (!listText.includes('const resolvedRowRange = rowRange || {')) {
    throw new Error('expected list row inline editor to resolve fallback row range per item token without mutating SSOT')
  }
  if (!listText.includes('inlineEditable={rowEditingEnabled}')) {
    throw new Error('expected list row inline editor to stay enabled per-row using resolved row range fallback')
  }
  if (!listText.includes('rowControlsEnabled={gutterEnabled}') || !listText.includes('const rowCanInsert = rowControlsEnabled && !!opts.onInsertLineAfter')) {
    throw new Error('expected each list row token to own insert control eligibility')
  }
  if (!listText.includes('const rowCanReorder = rowControlsEnabled && !!opts.onReorderLineBlock')) {
    throw new Error('expected each list row token to own reorder control eligibility')
  }
  if (!listText.includes('onInsertLine={() => opts.onInsertLineAfter?.(rowEndLine)}')) {
    throw new Error('expected row insert action to target current row end line')
  }
  if (!listText.includes('rowControlsEnabled ? MARKDOWN_LIST_ROW_GUTTER_GROUP_CLASS : \'\'')) {
    throw new Error('expected list row controls to use shared row gutter group class SSOT')
  }
  if (!listText.includes('containerClassName={MARKDOWN_BLOCK_GUTTER_CONTROLS_LIST_ROW_ALIGNMENT_CLASS}')) {
    throw new Error('expected list row controls to reuse shared gutter alignment constant for headings/normal text parity')
  }
  if (!listText.includes('revealClassName="group-hover/list-row:opacity-100"')) {
    throw new Error('expected list row controls to reveal only for hovered row scope (no cross-row control reveal)')
  }
  const gutterPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownBlockGutter.tsx')
  const gutterText = readUtf8(gutterPath)
  if (!gutterText.includes("MARKDOWN_BLOCK_GUTTER_CONTROLS_LIST_ROW_ALIGNMENT_CLASS = ''")) {
    throw new Error('expected list row controls to fully reuse shared heading/paragraph gutter X alignment (no extra row-only offset)')
  }
  if (!listText.includes('rowControlsEnabled ? MARKDOWN_LIST_ROW_GUTTER_PADDING_CLASS : \'\'')) {
    throw new Error('expected list rows to reuse shared gutter padding SSOT used by headings and normal text')
  }
  if (!listText.includes('inlineEditable={false}')) {
    throw new Error('expected outer list container to stay view-surface while row editor is active')
  }
  if (!listText.includes('editStripLinePrefix={stripListLinePrefix}')) {
    throw new Error('expected list row inline editor to strip/reapply list prefixes for row editing parity')
  }
  if (!listText.includes('renderInlineTokens(onlyParagraph')) {
    throw new Error('expected list row view renderer to inline-render paragraph-only items to keep marker/first-character baseline alignment')
  }
  if (!listText.includes('as="span"') || !listText.includes('className={MARKDOWN_LIST_ROW_VIEW_INLINE_CLASS}')) {
    throw new Error('expected list row container to stay inline-level in view mode to avoid first-character dropping below marker baseline')
  }
  if (!listText.includes('editInlineFlow')) {
    throw new Error('expected list row inline editor to force inline edit flow to avoid first-character dropping below list marker baseline')
  }
  if (!listText.includes('const rowDefaultLinePrefix = React.useMemo(() =>') || !listText.includes("return ' '.repeat((marker[1] || '').length)")) {
    throw new Error('expected row editor to preserve list indentation width instead of mutating marker indentation')
  }
  if (!listText.includes('const isContinuationLine = (line: string): boolean =>')) {
    throw new Error('expected list inline editor range expansion to include continuation-line semantics')
  }
  if (!listText.includes('const isBlank = (line: string): boolean =>')) {
    throw new Error('expected list inline editor range expansion to bridge blank separators in contiguous list sequences')
  }
  if (!listText.includes('MARKDOWN_LIST_ROW_EDITOR_CLASS')) {
    throw new Error('expected list row inline editor root to follow normal text edit-surface behavior')
  }
  if (!listText.includes('getMarkdownListSurfaceClass(!!list.ordered)')) {
    throw new Error('expected list read/view surface to use centralized marker/indent SSOT class builder')
  }
  if (!listText.includes("'m-0'")) {
    throw new Error('expected list renderer to keep list baseline margins reset')
  }
  if (!listText.includes('className={MARKDOWN_LIST_TASK_CHECKBOX_CLASS}')) {
    throw new Error('expected checklist inline editor to use centralized checkbox spacing/alignment SSOT class')
  }
  const listLayoutPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'markdownListLayout.ts')
  const listLayoutText = readUtf8(listLayoutPath)
  if (!listLayoutText.includes("MARKDOWN_LIST_ROW_EDITOR_CLASS = 'inline whitespace-pre-wrap break-words align-baseline outline-none bg-transparent'")) {
    throw new Error('expected list row editor baseline class contract to be centralized in markdownListLayout SSOT')
  }
  if (!listLayoutText.includes("MARKDOWN_LIST_ROW_GUTTER_GROUP_CLASS = 'relative group/list-row'")) {
    throw new Error('expected list row hover grouping scope to be centralized and row-local in markdownListLayout SSOT')
  }
  if (!listLayoutText.includes("MARKDOWN_LIST_MARKER_FIRST_CHARACTER_ALIGN_CLASS = 'list-inside pl-0'")) {
    throw new Error('expected list marker/first-character alignment class to be centralized in markdownListLayout SSOT')
  }
  if (!listLayoutText.includes('export const getMarkdownListSurfaceClass = (ordered: boolean): string =>')) {
    throw new Error('expected list read/view surface class composition to be centralized in markdownListLayout SSOT')
  }
  if (listText.includes('editPresentation="html"')) {
    throw new Error('expected list row inline editor to avoid block-level html list edit mode')
  }

  const blockquotePath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownBlockquoteBlock.tsx')
  const blockquoteText = readUtf8(blockquotePath)
  if (!blockquoteText.includes('editLeftRailClassName="bg-blue-400 dark:bg-blue-600"')) {
    throw new Error('expected blockquote inline editor to preserve left rail surface parity in gutter mode')
  }
  if (!blockquoteText.includes('pl-4 py-2 rounded-r text-left italic')) {
    throw new Error('expected blockquote inline editor to preserve quote padding and typography parity')
  }

  const dataViewPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownDataViewBlock.tsx')
  const dataViewText = readUtf8(dataViewPath)
  if (!dataViewText.includes('if (!canMutate) return')) {
    throw new Error('expected markdown data-view handlers to guard read-only mutation paths')
  }

  const kanbanPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'kanban', 'KanbanCard.tsx')
  const kanbanText = readUtf8(kanbanPath)
  if (!kanbanText.includes('disabled={!props.canMutate}')) {
    throw new Error('expected kanban card action menu trigger to be disabled in read-only mode')
  }
}
