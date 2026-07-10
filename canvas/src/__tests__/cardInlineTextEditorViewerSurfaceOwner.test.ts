import { readFileSync } from 'node:fs'

const readUtf8 = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

export function testCardInlineTextEditorViewerSurfaceReusesMarkdownViewerWysiwygOwner() {
  const cardInlineEditor = readUtf8('../lib/cards/CardInlineTextEditor.tsx')
  const cardInlineEditingSurface = readUtf8('../lib/cards/CardInlineTextEditingSurface.tsx')
  const cardInlineEditorSupport = readUtf8('../lib/cards/CardInlineTextEditorSupport.ts')
  const viewerSurface = readUtf8('../lib/markdown-core/ui/MarkdownInlineTextEditSurface.tsx')
  const sharedContentEditableSurface = readUtf8('../lib/markdown-core/ui/markdownContentEditableSurface.ts')
  const markdownBlockEditSurface = readUtf8('../lib/markdown-core/ui/markdownBlockContainerCore.editSurfaceView.tsx')
  const markdownCaretProbe = readUtf8('../lib/markdown-core/ui/markdownBlockContainerCore.editOpenCaretProbe.ts')
  const markdownInlineEditHtml = readUtf8('../lib/markdown-core/ui/markdownBlockContainerCore.inlineMediaEditHtml.ts')
  const invocationTokens = readUtf8('../lib/markdown/invocationTokens.ts')
  const storyboardOverlay = readUtf8('../components/StoryboardWidgetCanvas/StoryboardCardOverlayLayer2d.tsx')
  const storyboardValueEditor = readUtf8('../components/StoryboardWidget/StoryboardWidgetInlineValueEditor.tsx')
  const richMediaTextSurface = readUtf8('../components/RichMediaPanelTextSurface.tsx')
  for (const snippet of [
    'MarkdownInlineTextEditSurface',
    'displaySourceValue',
    'editorSurface = \'viewer\'',
    "const useViewerEditSurface = editorSurface === 'viewer'",
    'focusMarkdownInlineTextSelectionSoon',
  ]) {
    if (!cardInlineEditor.includes(snippet)) {
      throw new Error(`expected CardInlineTextEditor to route the shared default edit path through the Viewer WYSIWYG surface: ${snippet}`)
    }
  }
  if (!cardInlineEditingSurface.includes('useViewerEditSurface ? draft : projectedEditorDisplayValue')) {
    throw new Error('expected CardInlineTextEditingSurface to preserve Viewer draft vs textarea display command-menu routing')
  }
  for (const snippet of [
    "editorSurface?: 'control' | 'viewer'",
    'displayValue?: string',
    'export const isElementEventTarget',
  ]) {
    if (!cardInlineEditorSupport.includes(snippet)) {
      throw new Error(`expected CardInlineTextEditorSupport to own shared Viewer WYSIWYG support snippet: ${snippet}`)
    }
  }
  for (const snippet of [
    'rewriteRenderedInlineMediaForEditorHtml',
    'readFastInlineMarkdownDraft',
    'aria-multiline={props.multiline',
    'readInlineMediaEditorMarkdownText',
    'MARKDOWN_NORMAL_TEXT_EDIT_SURFACE_CLASS',
    'MARKDOWN_TEXT_EDIT_SURFACE_MIN_LINE_HEIGHT_CLASS',
    'data-kg-card-inline-wysiwyg-virtual-media-chip',
    'data-kg-card-inline-wysiwyg-media-markdown',
    'data-kg-card-inline-wysiwyg-media-thumbnail',
    'INLINE_MARKDOWN_ZERO_LENGTH_TOKEN_ATTR',
    'pendingViewerSelections',
  ]) {
    if (!viewerSurface.includes(snippet)) {
      throw new Error(`expected MarkdownInlineTextEditSurface to reuse Viewer edit initialization/serialization helpers: ${snippet}`)
    }
  }
  if (!markdownInlineEditHtml.includes('if (!segments.some(segment => segment.kind === \'token\')) return')) {
    throw new Error('expected shared Viewer inline-edit token rewriting to chip valid /, #, and @ tokens without requiring local card renderers')
  }
  if (!invocationTokens.includes('normalizeInvocationTokenSpacing') || !invocationTokens.includes('startsAfterAcceptedToken')) {
    throw new Error('expected shared invocation grammar to accept compact adjacent token runs while serializing canonical / # @ spacing')
  }
  for (const [surfaceName, sourceText] of [
    ['Storyboard card summary', storyboardOverlay],
    ['Storyboard Widget value', storyboardValueEditor],
    ['Rich Media text', richMediaTextSurface],
  ] as const) {
    if (!sourceText.includes('editorSurface="viewer"')) {
      throw new Error(`expected ${surfaceName} editing to reuse the shared Viewer WYSIWYG surface`)
    }
  }
  for (const snippet of [
    'readMarkdownContentEditableCaretRangeFromPoint',
    'applyMarkdownContentEditableSelection',
    'MARKDOWN_EDIT_SURFACE_INTERACTION_PARITY_CLASS',
    'MARKDOWN_CONTENT_EDITABLE_PLACEHOLDER_CLASS',
  ]) {
    if (!sharedContentEditableSurface.includes(snippet)) {
      throw new Error(`expected neutral Markdown contenteditable owner to expose ${snippet}`)
    }
  }
  if (!markdownBlockEditSurface.includes("from './markdownContentEditableSurface'")) {
    throw new Error('expected Editor Workspace Viewer blocks to reuse the neutral contenteditable interaction owner')
  }
  if (!markdownCaretProbe.includes('readMarkdownContentEditableCaretRangeFromPoint')) {
    throw new Error('expected Editor Workspace caret placement to reuse the neutral point-selection helper')
  }
  if (!storyboardOverlay.includes('value={textModel.primaryRaw || card.slugline || \'\'}') || !storyboardOverlay.includes('displayValue={textModel.primaryDisplay || card.slugline || \'\'}')) {
    throw new Error('expected Storyboard card summary edit mode to keep raw source value separate from read-view display projection')
  }
  if (!storyboardOverlay.includes("const STORYBOARD_CARD_SUMMARY_TEXT_CLASS_NAME = 'text-[10px] font-medium leading-4 text-[color:var(--kg-text-secondary)] [scrollbar-gutter:stable]'") || !storyboardOverlay.includes("editorClassName={cn('h-full min-h-[3rem] overflow-auto', STORYBOARD_CARD_SUMMARY_TEXT_CLASS_NAME)}")) {
    throw new Error('expected Storyboard card summary edit mode to reuse read-view typography and inherit Viewer WYSIWYG chrome')
  }
  if (/editorClassName=\{cn\('h-full min-h-\[3rem\] overflow-auto (?:border|bg-)/.test(storyboardOverlay)) {
    throw new Error('expected Storyboard card summary edit mode not to add local textarea border/background styling')
  }
}
