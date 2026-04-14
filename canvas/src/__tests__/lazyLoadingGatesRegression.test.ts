import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testHeavyFeatureSurfacesUseTargetedLazyLoadingGates() {
  const root = process.cwd()
  const mainText = readFileSync(resolve(root, 'src', 'main.tsx'), 'utf8')
  if (mainText.includes("import 'monaco-editor/dev/vs/style.css'")) {
    throw new Error('expected monaco styles to be lazy-loaded instead of eagerly imported in main.tsx')
  }
  if (mainText.includes("import 'maplibre-gl/dist/maplibre-gl.css'")) {
    throw new Error('expected maplibre styles to be lazy-loaded instead of eagerly imported in main.tsx')
  }

  const monacoTextEditorText = readFileSync(resolve(root, 'src', 'lib', 'monaco', 'MonacoTextEditor.impl.tsx'), 'utf8')
  if (!monacoTextEditorText.includes('ensureMonacoStyles')) {
    throw new Error('expected MonacoTextEditor to gate style loading via ensureMonacoStyles')
  }
  if (monacoTextEditorText.includes("stickyScrollContribution")) {
    throw new Error('expected MonacoTextEditor to avoid eagerly importing sticky scroll contrib')
  }
  if (monacoTextEditorText.includes('stickyScroll: { enabled: true }')) {
    throw new Error('expected MonacoTextEditor to avoid enabling sticky scroll unconditionally on the slim Monaco path')
  }
  if (!monacoTextEditorText.includes("const resolvedLanguage = resolveConfiguredMonacoLanguage(language, monacoSettings)")) {
    throw new Error('expected MonacoTextEditor to resolve Monaco language support from MainPanel Monaco capability settings')
  }
  if (!monacoTextEditorText.includes("await loadMonacoLanguageContribution(resolvedLanguage)")) {
    throw new Error('expected MonacoTextEditor to lazy-load Monaco language contributions per active language')
  }
  if (!monacoTextEditorText.includes("await import('monaco-editor/esm/vs/language/json/monaco.contribution')")) {
    throw new Error('expected MonacoTextEditor to lazy-load JSON language support only when needed')
  }
  if (!monacoTextEditorText.includes("await import('monaco-editor/esm/vs/basic-languages/sql/sql.contribution')")) {
    throw new Error('expected MonacoTextEditor to lazy-load SQL language support only when needed')
  }

  const monacoEnvironmentText = readFileSync(resolve(root, 'src', 'features', 'monaco', 'monacoEnvironment.ts'), 'utf8')
  if (monacoEnvironmentText.includes("html.worker?worker")) {
    throw new Error('expected Monaco environment to avoid bundling the unused HTML worker')
  }
  if (monacoEnvironmentText.includes("label === 'html'")) {
    throw new Error('expected Monaco environment to avoid routing unused HTML-family labels to a dedicated worker')
  }
  if (!monacoEnvironmentText.includes("import('monaco-editor/esm/vs/language/json/json.worker?worker')")) {
    throw new Error('expected Monaco environment to lazy-load the JSON worker module')
  }

  const monacoSettingsRegistryText = readFileSync(resolve(root, 'src', 'features', 'settings', 'registry-ui.monaco.ts'), 'utf8')
  if (!monacoSettingsRegistryText.includes("key: 'monacoLanguageJsonEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco JSON capability controls')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoWorkerJsonLoadMode'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco JSON worker load-mode control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoLinksEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco links toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoSuggestOnTriggerCharactersEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco suggest-on-trigger toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoSelectionHighlightEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco selection highlight toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoOccurrencesHighlightEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco occurrences highlight toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoGuidesEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco guides toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoBracketPairColorizationEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco bracket pair colorization toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoCodeLensEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco code lens toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoLightbulbEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco lightbulb toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoInlayHintsEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco inlay hints toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoWordBasedSuggestionsEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco word-based suggestions toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoInlineSuggestEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco inline suggest toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoAcceptSuggestionOnEnterEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco accept-suggestion-on-enter toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoDragAndDropEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco drag-and-drop toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoDropIntoEditorEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco drop-into-editor toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoColorDecoratorsEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco color decorators toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoUnicodeHighlightEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco unicode highlight toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoMatchBracketsEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco match-brackets toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoRenderLineHighlightEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco render-line-highlight toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoGlyphMarginEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco glyph-margin toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoOverviewRulerLanesEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco overview-ruler-lanes toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoLineDecorationsWidthEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco line-decorations-width toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoRenderWhitespaceEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco render-whitespace toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoRenderControlCharactersEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco render-control-characters toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoSmoothScrollingEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco smooth-scrolling toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoScrollBeyondLastLineEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco scroll-beyond-last-line toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoMouseWheelZoomEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco mouse-wheel-zoom toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoCursorBlinkingEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco cursor-blinking toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoCursorSmoothCaretAnimationEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco cursor smooth caret animation toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoWordWrapEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco word-wrap toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoWrappingIndentEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco wrapping-indent toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoWrappingStrategyEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco wrapping-strategy toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoCursorWidthEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco cursor-width toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoCursorStyleEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco cursor-style toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoCursorSurroundingLinesEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco cursor-surrounding-lines toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoCursorSurroundingLinesStyleEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco cursor-surrounding-lines-style toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoCursorHeightEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco cursor-height toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoStickyScrollEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco sticky-scroll toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoSelectionClipboardEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco selection-clipboard toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoCopyWithSyntaxHighlightingEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco copy-with-syntax-highlighting toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoOccurrencesHighlightDelayEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco occurrences-highlight-delay toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoFormatOnPasteEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco format-on-paste toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoFormatOnTypeEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco format-on-type toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoAutoClosingBracketsEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco auto-closing-brackets toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoAutoClosingQuotesEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco auto-closing-quotes toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoAutoIndentEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco auto-indent toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoAutoSurroundEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco auto-surround toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoMatchOnWordStartOnlyEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco match-on-word-start-only toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoFindSeedSearchStringFromSelectionEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco find seed-from-selection toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoFindCursorMoveOnTypeEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco find cursor-move-on-type toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoFindFindOnTypeEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco find-on-type toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoFindLoopEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco find-loop toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoAutoClosingDeleteEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco auto-closing-delete toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoAutoClosingCommentsEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco auto-closing-comments toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoEmptySelectionClipboardEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco empty-selection-clipboard toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoColumnSelectionEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco column-selection toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoWordSeparatorsEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco word-separators toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoMultiCursorModifierEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco multi-cursor-modifier toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoMultiCursorMergeOverlappingEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco multi-cursor-merge-overlapping toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoMultiCursorPasteEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco multi-cursor-paste toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoAutoClosingOvertypeEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco auto-closing-overtype toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoMouseStyleEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco mouse-style toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoRenderFinalNewlineEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco render-final-newline toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoAccessibilitySupportEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco accessibility-support toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoScrollbarUseShadowsEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco scrollbar-use-shadows toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoScrollbarAlwaysConsumeMouseWheelEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco scrollbar-always-consume-mouse-wheel toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoHorizontalScrollbarSizeEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco horizontal-scrollbar-size toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoVerticalScrollbarSizeEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco vertical-scrollbar-size toggle control')
  }
  if (!monacoSettingsRegistryText.includes("key: 'monacoMouseWheelScrollSensitivityEnabled'")) {
    throw new Error('expected MainPanel settings registry to expose Monaco mouse-wheel-scroll-sensitivity toggle control')
  }
  if (!monacoTextEditorText.includes('links: settings.monacoLinksEnabled')) {
    throw new Error('expected MonacoTextEditor to wire Monaco links through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('suggestOnTriggerCharacters: settings.monacoSuggestOnTriggerCharactersEnabled')) {
    throw new Error('expected MonacoTextEditor to wire suggestOnTriggerCharacters through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('selectionHighlight: settings.monacoSelectionHighlightEnabled')) {
    throw new Error('expected MonacoTextEditor to wire selection highlight through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("occurrencesHighlight: settings.monacoOccurrencesHighlightEnabled ? 'singleFile' : 'off'")) {
    throw new Error('expected MonacoTextEditor to wire occurrences highlight through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('indentation: settings.monacoGuidesEnabled')) {
    throw new Error('expected MonacoTextEditor to wire Monaco guides through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('bracketPairColorization: { enabled: settings.monacoBracketPairColorizationEnabled }')) {
    throw new Error('expected MonacoTextEditor to wire bracket pair colorization through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("import('monaco-editor/esm/vs/editor/contrib/codelens/browser/codelensController')")) {
    throw new Error('expected MonacoTextEditor to lazy-load code lens contrib only when enabled')
  }
  if (!monacoTextEditorText.includes("import('monaco-editor/esm/vs/editor/contrib/codeAction/browser/codeActionContributions')")) {
    throw new Error('expected MonacoTextEditor to lazy-load lightbulb contrib only when enabled')
  }
  if (!monacoTextEditorText.includes("import('monaco-editor/esm/vs/editor/contrib/inlayHints/browser/inlayHintsContribution')")) {
    throw new Error('expected MonacoTextEditor to lazy-load inlay hints contrib only when enabled')
  }
  if (!monacoTextEditorText.includes('codeLens: settings.monacoCodeLensEnabled')) {
    throw new Error('expected MonacoTextEditor to wire code lens through MainPanel capability settings')
  }
  if (
    !monacoTextEditorText.includes("lightbulb: { enabled: settings.monacoLightbulbEnabled ? 'onCode' : 'off' }") &&
    !monacoTextEditorText.includes("enabled: (settings.monacoLightbulbEnabled ? 'onCode' : 'off') as Monaco.editor.IEditorLightbulbOptions['enabled']")
  ) {
    throw new Error('expected MonacoTextEditor to wire lightbulb through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("inlayHints: { enabled: settings.monacoInlayHintsEnabled ? 'on' : 'off' }")) {
    throw new Error('expected MonacoTextEditor to wire inlay hints through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("wordBasedSuggestions: settings.monacoWordBasedSuggestionsEnabled ? 'currentDocument' : 'off'")) {
    throw new Error('expected MonacoTextEditor to wire word-based suggestions through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('inlineSuggest: { enabled: settings.monacoInlineSuggestEnabled }')) {
    throw new Error('expected MonacoTextEditor to wire inline suggest through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("acceptSuggestionOnEnter: settings.monacoAcceptSuggestionOnEnterEnabled ? 'on' : 'off'")) {
    throw new Error('expected MonacoTextEditor to wire acceptSuggestionOnEnter through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('dragAndDrop: settings.monacoDragAndDropEnabled')) {
    throw new Error('expected MonacoTextEditor to wire dragAndDrop through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('dropIntoEditor: { enabled: settings.monacoDropIntoEditorEnabled }')) {
    throw new Error('expected MonacoTextEditor to wire dropIntoEditor through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('colorDecorators: settings.monacoColorDecoratorsEnabled')) {
    throw new Error('expected MonacoTextEditor to wire color decorators through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('unicodeHighlight: settings.monacoUnicodeHighlightEnabled ? {} : { nonBasicASCII: false, invisibleCharacters: false, ambiguousCharacters: false }')) {
    throw new Error('expected MonacoTextEditor to wire unicode highlight through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("matchBrackets: settings.monacoMatchBracketsEnabled ? 'always' : 'never'")) {
    throw new Error('expected MonacoTextEditor to wire matchBrackets through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("renderLineHighlight: settings.monacoRenderLineHighlightEnabled ? 'line' : 'none'")) {
    throw new Error('expected MonacoTextEditor to wire renderLineHighlight through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('glyphMargin: settings.monacoGlyphMarginEnabled')) {
    throw new Error('expected MonacoTextEditor to wire glyphMargin through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('overviewRulerLanes: settings.monacoOverviewRulerLanesEnabled ? 2 : 0')) {
    throw new Error('expected MonacoTextEditor to wire overviewRulerLanes through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('lineDecorationsWidth: settings.monacoLineDecorationsWidthEnabled ? 10 : 0')) {
    throw new Error('expected MonacoTextEditor to wire lineDecorationsWidth through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("renderWhitespace: settings.monacoRenderWhitespaceEnabled ? 'selection' : 'none'")) {
    throw new Error('expected MonacoTextEditor to wire renderWhitespace through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('renderControlCharacters: settings.monacoRenderControlCharactersEnabled')) {
    throw new Error('expected MonacoTextEditor to wire renderControlCharacters through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('smoothScrolling: settings.monacoSmoothScrollingEnabled')) {
    throw new Error('expected MonacoTextEditor to wire smoothScrolling through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('scrollBeyondLastLine: settings.monacoScrollBeyondLastLineEnabled')) {
    throw new Error('expected MonacoTextEditor to wire scrollBeyondLastLine through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('mouseWheelZoom: settings.monacoMouseWheelZoomEnabled')) {
    throw new Error('expected MonacoTextEditor to wire mouseWheelZoom through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("cursorBlinking: settings.monacoCursorBlinkingEnabled ? 'blink' : 'solid'")) {
    throw new Error('expected MonacoTextEditor to wire cursorBlinking through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("cursorSmoothCaretAnimation: settings.monacoCursorSmoothCaretAnimationEnabled ? 'on' : 'off'")) {
    throw new Error('expected MonacoTextEditor to wire cursorSmoothCaretAnimation through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("wordWrap: settings.monacoWordWrapEnabled || args.wordWrap ? 'on' : 'off'")) {
    throw new Error('expected MonacoTextEditor to wire wordWrap override through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("wrappingIndent: settings.monacoWrappingIndentEnabled ? 'indent' : 'none'")) {
    throw new Error('expected MonacoTextEditor to wire wrappingIndent through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("wrappingStrategy: settings.monacoWrappingStrategyEnabled ? 'advanced' : 'simple'")) {
    throw new Error('expected MonacoTextEditor to wire wrappingStrategy through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('cursorWidth: settings.monacoCursorWidthEnabled ? 2 : 1')) {
    throw new Error('expected MonacoTextEditor to wire cursorWidth through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("cursorStyle: settings.monacoCursorStyleEnabled ? 'block' : 'line'")) {
    throw new Error('expected MonacoTextEditor to wire cursorStyle through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('cursorSurroundingLines: settings.monacoCursorSurroundingLinesEnabled ? 3 : 0')) {
    throw new Error('expected MonacoTextEditor to wire cursorSurroundingLines through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("cursorSurroundingLinesStyle: settings.monacoCursorSurroundingLinesStyleEnabled ? 'all' : 'default'")) {
    throw new Error('expected MonacoTextEditor to wire cursorSurroundingLinesStyle through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('cursorHeight: settings.monacoCursorHeightEnabled ? 1.2 : 1')) {
    throw new Error('expected MonacoTextEditor to wire cursorHeight through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('stickyScroll: { enabled: settings.monacoStickyScrollEnabled }')) {
    throw new Error('expected MonacoTextEditor to wire stickyScroll through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('selectionClipboard: settings.monacoSelectionClipboardEnabled')) {
    throw new Error('expected MonacoTextEditor to wire selectionClipboard through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('copyWithSyntaxHighlighting: settings.monacoCopyWithSyntaxHighlightingEnabled')) {
    throw new Error('expected MonacoTextEditor to wire copyWithSyntaxHighlighting through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('occurrencesHighlightDelay: settings.monacoOccurrencesHighlightDelayEnabled ? 400 : 250')) {
    throw new Error('expected MonacoTextEditor to wire occurrencesHighlightDelay through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('formatOnPaste: settings.monacoFormatOnPasteEnabled')) {
    throw new Error('expected MonacoTextEditor to wire formatOnPaste through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('formatOnType: settings.monacoFormatOnTypeEnabled')) {
    throw new Error('expected MonacoTextEditor to wire formatOnType through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("autoClosingBrackets: settings.monacoAutoClosingBracketsEnabled ? 'always' : 'never'")) {
    throw new Error('expected MonacoTextEditor to wire autoClosingBrackets through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("autoClosingQuotes: settings.monacoAutoClosingQuotesEnabled ? 'always' : 'never'")) {
    throw new Error('expected MonacoTextEditor to wire autoClosingQuotes through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("autoIndent: settings.monacoAutoIndentEnabled ? 'full' : 'none'")) {
    throw new Error('expected MonacoTextEditor to wire autoIndent through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("autoSurround: settings.monacoAutoSurroundEnabled ? 'languageDefined' : 'never'")) {
    throw new Error('expected MonacoTextEditor to wire autoSurround through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('matchOnWordStartOnly: settings.monacoMatchOnWordStartOnlyEnabled')) {
    throw new Error('expected MonacoTextEditor to wire matchOnWordStartOnly through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("seedSearchStringFromSelection: settings.monacoFindSeedSearchStringFromSelectionEnabled ? 'selection' : 'never'")) {
    throw new Error('expected MonacoTextEditor to wire find.seedSearchStringFromSelection through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('cursorMoveOnType: settings.monacoFindCursorMoveOnTypeEnabled')) {
    throw new Error('expected MonacoTextEditor to wire find.cursorMoveOnType through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('findOnType: settings.monacoFindFindOnTypeEnabled')) {
    throw new Error('expected MonacoTextEditor to wire find.findOnType through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('loop: settings.monacoFindLoopEnabled')) {
    throw new Error('expected MonacoTextEditor to wire find.loop through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("autoClosingDelete: settings.monacoAutoClosingDeleteEnabled ? 'always' : 'never'")) {
    throw new Error('expected MonacoTextEditor to wire autoClosingDelete through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("autoClosingComments: settings.monacoAutoClosingCommentsEnabled ? 'always' : 'never'")) {
    throw new Error('expected MonacoTextEditor to wire autoClosingComments through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('emptySelectionClipboard: settings.monacoEmptySelectionClipboardEnabled')) {
    throw new Error('expected MonacoTextEditor to wire emptySelectionClipboard through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('columnSelection: settings.monacoColumnSelectionEnabled')) {
    throw new Error('expected MonacoTextEditor to wire columnSelection through MainPanel capability settings')
  }
  if (
    !monacoTextEditorText.includes('wordSeparators: settings.monacoWordSeparatorsEnabled ?') ||
    !monacoTextEditorText.includes("`~!@#$%^&*()-=+[{]}\\\\|;:\\'\",.<>/?'")
  ) {
    throw new Error('expected MonacoTextEditor to wire wordSeparators through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("multiCursorModifier: settings.monacoMultiCursorModifierEnabled ? 'ctrlCmd' : 'alt'")) {
    throw new Error('expected MonacoTextEditor to wire multiCursorModifier through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('multiCursorMergeOverlapping: settings.monacoMultiCursorMergeOverlappingEnabled')) {
    throw new Error('expected MonacoTextEditor to wire multiCursorMergeOverlapping through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("multiCursorPaste: settings.monacoMultiCursorPasteEnabled ? 'spread' : 'full'")) {
    throw new Error('expected MonacoTextEditor to wire multiCursorPaste through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("autoClosingOvertype: settings.monacoAutoClosingOvertypeEnabled ? 'always' : 'never'")) {
    throw new Error('expected MonacoTextEditor to wire autoClosingOvertype through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("mouseStyle: settings.monacoMouseStyleEnabled ? 'default' : 'text'")) {
    throw new Error('expected MonacoTextEditor to wire mouseStyle through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("renderFinalNewline: settings.monacoRenderFinalNewlineEnabled ? 'dimmed' : 'off'")) {
    throw new Error('expected MonacoTextEditor to wire renderFinalNewline through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes("accessibilitySupport: settings.monacoAccessibilitySupportEnabled ? 'on' : 'off'")) {
    throw new Error('expected MonacoTextEditor to wire accessibilitySupport through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('useShadows: settings.monacoScrollbarUseShadowsEnabled')) {
    throw new Error('expected MonacoTextEditor to wire scrollbar.useShadows through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('alwaysConsumeMouseWheel: settings.monacoScrollbarAlwaysConsumeMouseWheelEnabled')) {
    throw new Error('expected MonacoTextEditor to wire scrollbar.alwaysConsumeMouseWheel through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('horizontalScrollbarSize: settings.monacoHorizontalScrollbarSizeEnabled ? 16 : 12')) {
    throw new Error('expected MonacoTextEditor to wire horizontalScrollbarSize through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('verticalScrollbarSize: settings.monacoVerticalScrollbarSizeEnabled ? 18 : 14')) {
    throw new Error('expected MonacoTextEditor to wire verticalScrollbarSize through MainPanel capability settings')
  }
  if (!monacoTextEditorText.includes('mouseWheelScrollSensitivity: settings.monacoMouseWheelScrollSensitivityEnabled ? 1.5 : 1')) {
    throw new Error('expected MonacoTextEditor to wire mouseWheelScrollSensitivity through MainPanel capability settings')
  }

  const markdownCodeBlockText = readFileSync(resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownCodeBlock.tsx'), 'utf8')
  if (!markdownCodeBlockText.includes('MermaidDiagramLazy') || !markdownCodeBlockText.includes('React.Suspense')) {
    throw new Error('expected MarkdownCodeBlock to lazy-load MermaidDiagram behind suspense')
  }

  const mdxComponentsText = readFileSync(resolve(root, 'src', 'features', 'markdown', 'ui', 'mdxComponents.tsx'), 'utf8')
  if (!mdxComponentsText.includes('MermaidDiagramLazy') || !mdxComponentsText.includes('React.Suspense')) {
    throw new Error('expected mdxComponents Mermaid renderer to lazy-load MermaidDiagram')
  }

  const mermaidRuntimeText = readFileSync(resolve(root, 'src', 'lib', 'mermaid', 'mermaidRuntime.ts'), 'utf8')
  if (!mermaidRuntimeText.includes("return header.startsWith('graph ') || header.startsWith('flowchart ')")) {
    throw new Error('expected mermaid runtime to constrain elk support to graph or flowchart families')
  }
  if (!mermaidRuntimeText.includes("const layout = String((config as Record<string, unknown>)?.layout || '').trim().toLowerCase()")) {
    throw new Error('expected mermaid runtime to branch standard vs elk by explicit layout config')
  }
  if (!mermaidRuntimeText.includes("await import('@/lib/mermaid/mermaidElkRuntime')")) {
    throw new Error('expected mermaid runtime to lazy-load elk registration only for explicit elk layouts')
  }

  const threeGraphText = readFileSync(resolve(root, 'src', 'lib', 'three', 'ThreeGraph.impl.tsx'), 'utf8')
  if (!threeGraphText.includes("await import('three/examples/jsm/exporters/GLTFExporter.js')")) {
    throw new Error('expected ThreeGraph GLTF export path to lazy-load GLTFExporter')
  }

  const activeGraphDataText = readFileSync(resolve(root, 'src', 'hooks', 'useActiveGraphData.ts'), 'utf8')
  if (activeGraphDataText.includes("from '@/lib/mermaid/mermaidFrontmatterGeometry'")) {
    throw new Error('expected useActiveGraphData to avoid static mermaidFrontmatterGeometry import on startup path')
  }
  if (!activeGraphDataText.includes("import('@/lib/mermaid/mermaidFrontmatterGeometry')")) {
    throw new Error('expected useActiveGraphData to lazy-load mermaidFrontmatterGeometry for frontmatter geometry application')
  }

  const inlineMarkdownGeoJsonText = readFileSync(resolve(root, 'src', 'features', 'geospatial', 'InlineMarkdownGeoJsonLayerMap.tsx'), 'utf8')
  if (!inlineMarkdownGeoJsonText.includes("from 'gympgrph/map-preview'")) {
    throw new Error('expected inline markdown GeoJSON preview to import the narrow gympgrph map-preview entry')
  }
  if (
    inlineMarkdownGeoJsonText.includes("colorForDataset, useMapLibreBasemap } from 'gympgrph'") ||
    inlineMarkdownGeoJsonText.includes("computeBoundsFromCollections, useMapLibreBasemap } from 'gympgrph'")
  ) {
    throw new Error('expected inline markdown GeoJSON preview to avoid routing preview helpers through the heavy gympgrph root entry')
  }

  const viteConfigText = readFileSync(resolve(root, 'vite.config.ts'), 'utf8')
  if (!viteConfigText.includes("nodeRequire.resolve('three/src/Three.js')")) {
    throw new Error('expected vite config to resolve three through its source barrel so coarse subchunks can split cleanly')
  }
  if (!viteConfigText.includes("nodeRequire.resolve('maplibre-gl')")) {
    throw new Error('expected vite config to resolve maplibre through its stable package entry')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/three/examples/')) return 'three-examples'")) {
    throw new Error('expected vite config to split three examples into a separate coarse lazy chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/@react-three/fiber/')) return 'three-fiber'")) {
    throw new Error('expected vite config to split react-three-fiber from three core')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/three/src/renderers/')) return 'three-renderers'")) {
    throw new Error('expected vite config to split three renderers into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/three/src/math/')) return 'three-math'")) {
    throw new Error('expected vite config to split three math internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/three/src/materials/')) return 'three-materials'")) {
    throw new Error('expected vite config to split three materials into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/three/src/geometries/')) return 'three-geometries'")) {
    throw new Error('expected vite config to split three geometries into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/three/src/core/')) return 'three-scene-core'")) {
    throw new Error('expected vite config to split three scene core internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/three/')) return 'three-core'")) {
    throw new Error('expected vite config to keep the remaining three internals isolated from feature chunks')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/maplibre-gl/src/render/')) return 'maplibre-render'")) {
    throw new Error('expected vite config to split maplibre render internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/maplibre-gl/src/source/')) return 'maplibre-source'")) {
    throw new Error('expected vite config to split maplibre source internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/maplibre-gl/src/shaders/')) return 'maplibre-shaders'")) {
    throw new Error('expected vite config to split maplibre shader internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/maplibre-gl/')) return 'maplibre-core'")) {
    throw new Error('expected vite config to keep maplibre core isolated from render/source subchunks')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/browser/')) return 'monaco-editor-browser'")) {
    throw new Error('expected vite config to split monaco browser editor internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/browser/widget/')) return 'monaco-editor-widget'")) {
    throw new Error('expected vite config to split monaco editor widget internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/browser/viewParts/')) return 'monaco-editor-viewparts'")) {
    throw new Error('expected vite config to split monaco editor view parts into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/browser/view/')) return 'monaco-editor-view'")) {
    throw new Error('expected vite config to split monaco editor view internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/browser/controller/')) return 'monaco-editor-controller'")) {
    throw new Error('expected vite config to split monaco editor controller internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/browser/services/')) return 'monaco-editor-browser-services'")) {
    throw new Error('expected vite config to split monaco editor browser services into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/common/model/')) return 'monaco-editor-model'")) {
    throw new Error('expected vite config to split monaco editor model internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/common/languages/')) return 'monaco-editor-languages'")) {
    throw new Error('expected vite config to split monaco editor language internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/common/services/')) return 'monaco-editor-services'")) {
    throw new Error('expected vite config to split monaco editor services into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/common/')) return 'monaco-editor-common'")) {
    throw new Error('expected vite config to split monaco common editor internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/contrib/')) return 'monaco-contrib'")) {
    throw new Error('expected vite config to split monaco editor contrib internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/platform/')) return 'monaco-platform'")) {
    throw new Error('expected vite config to split monaco platform internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/base/browser/')) return 'monaco-base-browser'")) {
    throw new Error('expected vite config to split monaco browser base internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/base/common/')) return 'monaco-base-common'")) {
    throw new Error('expected vite config to split monaco common base internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/mermaid/')) return 'mermaid'")) {
    throw new Error('expected vite config to keep the Mermaid standard runtime in one coarse lazy chunk')
  }
  if (!viteConfigText.includes("name: 'knowgrph-strip-mermaid-architecture-detector'")) {
    throw new Error('expected vite config to strip the stock mermaid architecture detector from the standard runtime path')
  }
  if (!viteConfigText.includes("registerLazyLoadedDiagrams(detector_default, detector_default3);")) {
    throw new Error('expected vite config to patch mermaid core so architecture is not registered by default')
  }
  if (!viteConfigText.includes("(?:assets\\/)?mermaid-[^/]+\\.(?:js|css)$")) {
    throw new Error('expected vite modulePreload filtering to exclude relative and assets-prefixed mermaid chunk deps')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/@mermaid-js/layout-elk/dist/chunks/mermaid-layout-elk.esm.min/render-')) return 'mermaid-elk-render'")) {
    throw new Error('expected vite config to split mermaid elk render internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/@mermaid-js/layout-elk/')) return 'mermaid-elk-core'")) {
    throw new Error('expected vite config to keep mermaid elk core isolated from its render internals')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/maplibre-gl/src/ui/')) return 'maplibre-ui'")) {
    throw new Error('expected vite config to split maplibre ui internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/maplibre-gl/src/style/')) return 'maplibre-style'")) {
    throw new Error('expected vite config to split maplibre style internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/maplibre-gl/src/geo/')) return 'maplibre-geo'")) {
    throw new Error('expected vite config to split maplibre geo internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/maplibre-gl/src/util/')) return 'maplibre-util'")) {
    throw new Error('expected vite config to split maplibre util internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/maplibre-gl/src/data/')) return 'maplibre-data'")) {
    throw new Error('expected vite config to split maplibre data internals into a separate coarse chunk')
  }
}
