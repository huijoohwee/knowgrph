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
  if (
    !blockText.includes('className={effectiveInlineFlow') ||
    !blockText.includes("hostInlineFlow ? 'relative inline-block w-full min-w-0 align-baseline' : 'relative inline min-w-0 align-baseline'")
  ) {
    throw new Error('expected block container to support inline edit-flow host wrapping for list marker baseline parity')
  }
  if (!blockText.includes('normalizeListAncestorSpacing')) {
    throw new Error('expected html list edit normalization to reset wrapper ancestor spacing around list roots')
  }
  if (blockText.includes('if (editListMode) return')) {
    throw new Error('expected list edit mode to participate in edge trim burst scheduling (no special-case disable)')
  }
  if (!blockText.includes('MARKDOWN_INLINE_CODE_EDIT_DESCENDANT_CLASSES')) {
    throw new Error('expected html edit surfaces to reuse shared inline-code parity SSOT classes')
  }
  if (blockText.includes("'[_&code]:border'")) {
    throw new Error('expected html edit surfaces to avoid inline-code border styling that mutates layout')
  }
  if (blockText.includes('[&_code]:border-[color:var(--kg-code-border)]')) {
    throw new Error('expected html edit surfaces to avoid inline-code border styling that mutates layout')
  }
  if (!blockText.includes('MARKDOWN_INLINE_CODE_EDIT_DESCENDANT_CLASSES')) {
    throw new Error('expected inline code edit-surface spacing contract to be centralized in shared parity SSOT')
  }
  if (!blockText.includes('editTypographySnapshotRef') || !blockText.includes('window.getComputedStyle')) {
    throw new Error('expected markdown block editor to snapshot read-surface computed typography for strict view/edit font parity')
  }
  if (!blockText.includes('MARKDOWN_EDIT_TYPOGRAPHY_SOURCE_SELECTOR') || !blockText.includes('h1,h2,h3,h4,h5,h6')) {
    throw new Error('expected typography source selector to include heading tags for strict heading view/edit parity')
  }
  if (!blockText.includes('editSpacingSnapshotRef') || !blockText.includes('editCaptureLayoutSpacing') || !blockText.includes('__KG_EDIT_PARITY_PROBE__')) {
    throw new Error('expected markdown block editor to provide gated spacing parity capture and runtime parity probe switch')
  }
  if (!blockText.includes('editCaptureLayoutSpacing = false')) {
    throw new Error('expected generic inline edit surfaces to default layout-spacing capture off to avoid rightward indent drift')
  }
  if (!blockText.includes('__KG_EDIT_PARITY_LAST_PAYLOAD__') || !blockText.includes('kg-edit-parity-probe-json')) {
    throw new Error('expected runtime parity probe to expose visible payload via window global and json console line')
  }
  if (!blockText.includes('buildMarkdownSigil') || !blockText.includes('parseMarkdownSigil')) {
    throw new Error('expected inline highlight/text color actions to reuse markdown sigil SSOT helpers')
  }
  if (!blockText.includes('readSelectionOffsetsForFormatting')) {
    throw new Error('expected inline highlight/text color actions to use selection fallback when toolbar interaction collapses native selection')
  }
  if (!blockText.includes('lastNonCollapsedSelectionOffsetsRef')) {
    throw new Error('expected markdown block editor to retain last non-collapsed selection while using floating color/highlight menus')
  }
  if (!blockText.includes('lastNonCollapsedDomRangeRef')) {
    throw new Error('expected html editing path to retain a non-collapsed DOM Range for toolbar actions')
  }
  if (!blockText.includes('sel.removeAllRanges()') || !blockText.includes('sel.addRange(last)')) {
    throw new Error('expected html highlight/text color actions to rehydrate selection from cached DOM Range when native selection collapses')
  }
  if (!blockText.includes('data-kg-sigil') || !blockText.includes('rewriteSigilSpansToInlineCodeHtml')) {
    throw new Error('expected html inline editor to render sigil highlights as spans and rewrite them to inline code on commit')
  }
  if (!blockText.includes('captureSelectionForFloatingToolbar')) {
    throw new Error('expected floating selection toolbar to reuse shared interaction capture SSOT helper')
  }
  if (!blockText.includes('title="Highlight"') || !blockText.includes('onPointerDown={preventDefaultPointerDown}')) {
    throw new Error('expected highlight menu summary to preserve editor focus/selection on pointer down')
  }
  if (!blockText.includes('title="Text color"') || !blockText.includes('onPointerDown={preventDefaultPointerDown}')) {
    throw new Error('expected text color menu summary to preserve editor focus/selection on pointer down')
  }
  if (blockText.includes('<span style="color:')) {
    throw new Error('expected text color action to avoid html span style insertion and emit markdown sigil instead')
  }
  if (blockText.includes('<mark style="background-color:')) {
    throw new Error('expected highlight action to avoid html mark style insertion and emit markdown sigil instead')
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
  if (!inlineText.includes('MARKDOWN_INLINE_CODE_VIEW_CLASS')) {
    throw new Error('expected read inline code to reuse centralized view/edit parity SSOT class')
  }
  if (inlineText.includes('py-0.5') || inlineText.includes('text-sm')) {
    throw new Error('expected read inline code to avoid hardcoded spacing/size that would break parity')
  }
  if (!inlineText.includes('parseMarkdownSigil')) {
    throw new Error('expected inline code renderer to parse markdown sigil annotations before code rendering')
  }
  if (!inlineText.includes('backgroundColor: sigil.background')) {
    throw new Error('expected sigil rendering to map bg# annotations into read-surface background color')
  }
  const codeParityPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'markdownInlineCodeParity.ts')
  const codeParityText = readUtf8(codeParityPath)
  if (!codeParityText.includes('MARKDOWN_INLINE_CODE_VIEW_CLASS') || !codeParityText.includes('MARKDOWN_INLINE_CODE_EDIT_DESCENDANT_CLASSES')) {
    throw new Error('expected inline-code view/edit parity classes to be centralized in markdownInlineCodeParity SSOT')
  }
  if (!codeParityText.includes('ring-1 ring-inset ring-[color:var(--kg-code-border)]') || !codeParityText.includes('[&_code]:ring-[color:var(--kg-code-border)]')) {
    throw new Error('expected inline-code ring parity contracts to be centralized for both read and edit surfaces')
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
  if (!listText.includes('const editRange = rowRange || undefined')) {
    throw new Error('expected list row inline editor to isolate edit mode to source-mapped row ranges only')
  }
  if (!listText.includes('editLineRange={editRange}')) {
    throw new Error('expected list row inline editor to edit one row token range at a time')
  }
  if (!listText.includes('const resolvedRowRange = rowRange || {')) {
    throw new Error('expected list row inline editor to resolve fallback row range per item token without mutating SSOT')
  }
  if (!listText.includes('inlineEditable={rowEditingEnabled && !!editRange}')) {
    throw new Error('expected list row inline editor to stay enabled only for source-mapped row ranges')
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
  if (!listText.includes('const useHtmlInlineRow = !!onlyParagraph && rowStartLine === rowEndLine')) {
    throw new Error('expected list row inline editor to enable html-inline mode only for single-line paragraph rows')
  }
  if (!listText.includes("editPresentation={useHtmlInlineRow ? 'html' : 'markdown'}") || !listText.includes("editHtmlRender={useHtmlInlineRow ? 'inline' : undefined}")) {
    throw new Error('expected list row inline editor to use html-inline editing only for safe single-line paragraph rows and keep markdown mode for complex rows')
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
  if (listText.includes('editHtmlRender="block"')) {
    throw new Error('expected list row inline editor to avoid block-level html list edit mode')
  }

  const blockquotePath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownBlockquoteBlock.tsx')
  const blockquoteText = readUtf8(blockquotePath)
  if (!blockquoteText.includes('editLeftRailClassName="bg-blue-400 dark:bg-blue-600"')) {
    throw new Error('expected blockquote inline editor to preserve left rail surface parity in gutter mode')
  }
  const gutterBlockquoteEditRootOk =
    blockquoteText.includes('pl-4 py-2 rounded-r text-left italic')
    || blockquoteText.includes('pl-4 py-2 border-l-4')
  if (!gutterBlockquoteEditRootOk) {
    throw new Error('expected blockquote inline editor to preserve quote padding/border and typography parity')
  }
  if (!blockquoteText.includes('pl-4 py-2 border-l-4')) {
    throw new Error('expected gutter-mode blockquote inline editor to apply quote border/padding on edit root to prevent spacing drift')
  }
  if (!blockquoteText.includes('editorQuoteClassNameNoInset') || !blockquoteText.includes('editorClassName={editorQuoteClassNameNoInset}')) {
    throw new Error('expected non-gutter blockquote inline editor to avoid duplicate inset padding/margin layering')
  }
  if (!blockquoteText.includes('editCaptureLayoutSpacing')) {
    throw new Error('expected blockquote inline editor to explicitly enable layout spacing capture parity')
  }
  if (!blockquoteText.includes('editTrimEdgeNewlines')) {
    throw new Error('expected blockquote inline editor to trim edge newlines to avoid extra-row mutations')
  }
  if (!blockquoteText.includes('editPreserveBlockHeight={false}')) {
    throw new Error('expected blockquote inline editor to avoid min-height preservation that can double-apply inset spacing and cause jump drift')
  }
  if (!blockquoteText.includes('resolveEditLineRangeOnOpen={resolveQuoteEditLineRange}') || !blockquoteText.includes('const resolveQuoteEditLineRange = React.useCallback')) {
    throw new Error('expected blockquote inline editor to clamp edit ranges to contiguous quote lines and avoid extra-row mutation')
  }
  if (!blockquoteText.includes('[&_p]:whitespace-pre-wrap')) {
    throw new Error('expected blockquote inline editor to preserve per-line paragraph wrapping parity for callout edit surface')
  }
  if (!blockquoteText.includes('[&_p]:font-inherit') || !blockquoteText.includes('[&_p]:text-inherit')) {
    throw new Error('expected blockquote inline editor paragraphs to inherit read-surface typography without font mutation')
  }
  if (!blockquoteText.includes('opts.uiPanelTextFontClass')) {
    throw new Error('expected blockquote inline editor to keep shared ui panel font class for typography parity')
  }
  if (!blockquoteText.includes('editPreserveWhitespace')) {
    throw new Error('expected blockquote inline editor to preserve raw line breaks during inline edit')
  }
  const calloutPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownCalloutBlock.tsx')
  const calloutText = readUtf8(calloutPath)
  if (!calloutText.includes("line.match(/^(\\s*(?:>\\s*)+)?([\\s\\S]*)$/)")) {
    throw new Error('expected callout body prefix stripping to preserve multi-level quote marker prefixes')
  }
  if (!calloutText.includes("editHtmlRender=\"block\"")) {
    throw new Error('expected callout body inline editor to use block html render for per-line paragraph parity')
  }
  if (!calloutText.includes('editHtmlDisableDefaultBlockFlow')) {
    throw new Error('expected callout body inline editor to disable default block flow spacing mutations')
  }
  if (!calloutText.includes('editPreserveWhitespace')) {
    throw new Error('expected callout body inline editor to preserve raw line breaks during edit')
  }
  if (!calloutText.includes('[&_p]:whitespace-pre-wrap')) {
    throw new Error('expected callout body inline editor paragraphs to preserve line wrapping parity')
  }
  if (!calloutText.includes('[&_p]:font-inherit') || !calloutText.includes('[&_p]:text-inherit')) {
    throw new Error('expected callout body inline editor paragraphs to inherit read-surface typography without font mutation')
  }
  if (!calloutText.includes('resolveEditLineRangeOnOpen={resolveCalloutBodyEditLineRange}') || !calloutText.includes('const resolveCalloutBodyEditLineRange = React.useCallback')) {
    throw new Error('expected callout body inline editor to clamp edit ranges to contiguous quote lines and avoid extra-row mutation')
  }

  const dataViewPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownDataViewBlock.tsx')
  const dataViewText = readUtf8(dataViewPath)
  if (!dataViewText.includes('if (!canMutate) return')) {
    throw new Error('expected markdown data-view handlers to guard read-only mutation paths')
  }
  const dataViewSettingsPropsPath = path.resolve(
    root,
    'src',
    'components',
    'BottomPanel',
    'markdownWorkspace',
    'main',
    'viewer',
    'WorkspaceDataViewSettingsPropertiesSection.tsx',
  )
  const dataViewSettingsPropsText = readUtf8(dataViewSettingsPropsPath)
  if (!dataViewSettingsPropsText.includes('UI_TEXT_TRUNCATE')) {
    throw new Error('expected data-view property name view surfaces to reuse shared truncation SSOT class')
  }
  if (
    !dataViewSettingsPropsText.includes('overflow-x-auto whitespace-nowrap [text-overflow:clip]') ||
    !dataViewSettingsPropsText.includes('COLUMN_NAME_EDIT_INPUT_CLASS')
  ) {
    throw new Error('expected data-view property name edit surface to reveal full text on focus while keeping truncated rest-state contract')
  }

  const kanbanPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'kanban', 'KanbanCard.tsx')
  const kanbanText = readUtf8(kanbanPath)
  if (!kanbanText.includes('disabled={!props.canMutate}')) {
    throw new Error('expected kanban card action menu trigger to be disabled in read-only mode')
  }
}
