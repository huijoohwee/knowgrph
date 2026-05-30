
import type { StoreApi } from 'zustand'
import type { GraphState } from './types'
import { LS_KEYS } from '@/lib/config.ls.keys'
import { lsSetBool } from '@/lib/persistence'
import type { UiStorageReaders } from './uiSliceStorage'
import { TIMELINE_ENABLED_DEFAULT, resolveTimelineEnabled } from '@/lib/timeline/timelineVisibility'

type SetGraph = StoreApi<GraphState>['setState']

export const createUiSettingsMonacoSlice = (set: SetGraph, readers: UiStorageReaders)=> {
  const { lsBool, readMonacoLoadMode, writeLsString } = readers
  return {
  renderMediaAsNodes: true,
  setRenderMediaAsNodes: (v: boolean) => set({ renderMediaAsNodes: v }),
  timelineEnabled: lsBool(LS_KEYS.timelineEnabled, TIMELINE_ENABLED_DEFAULT),
  setTimelineEnabled: (v: boolean) => set({ timelineEnabled: lsSetBool(LS_KEYS.timelineEnabled, resolveTimelineEnabled(v)) }),
  mediaNodeOpacity: 0.9,
  setMediaNodeOpacity: (v: number) => {
    const n = Number.isFinite(v) ? Number(v) : 0.9;
    const clamped = n < 0 ? 0 : n > 1 ? 1 : n;
    set({ mediaNodeOpacity: clamped });
  },
  mediaPanelDensity: 'default' as const,
  setMediaPanelDensity: (v: 'default' | 'compact') => set({ mediaPanelDensity: v }),
  monacoLanguageJsonEnabled: lsBool(LS_KEYS.monacoLanguageJsonEnabled, true),
  setMonacoLanguageJsonEnabled: (v: boolean) => set({ monacoLanguageJsonEnabled: lsSetBool(LS_KEYS.monacoLanguageJsonEnabled, !!v) }),
  monacoLanguageJsonLoadMode: readMonacoLoadMode(LS_KEYS.monacoLanguageJsonLoadMode, 'lazy'),
  setMonacoLanguageJsonLoadMode: (v: 'lazy' | 'eager') => {
    const next = writeLsString(LS_KEYS.monacoLanguageJsonLoadMode, v === 'eager' ? 'eager' : 'lazy') as 'lazy' | 'eager'
    set({ monacoLanguageJsonLoadMode: next })
  },
  monacoLanguageSqlEnabled: lsBool(LS_KEYS.monacoLanguageSqlEnabled, true),
  setMonacoLanguageSqlEnabled: (v: boolean) => set({ monacoLanguageSqlEnabled: lsSetBool(LS_KEYS.monacoLanguageSqlEnabled, !!v) }),
  monacoLanguageSqlLoadMode: readMonacoLoadMode(LS_KEYS.monacoLanguageSqlLoadMode, 'lazy'),
  setMonacoLanguageSqlLoadMode: (v: 'lazy' | 'eager') => {
    const next = writeLsString(LS_KEYS.monacoLanguageSqlLoadMode, v === 'eager' ? 'eager' : 'lazy') as 'lazy' | 'eager'
    set({ monacoLanguageSqlLoadMode: next })
  },
  monacoLanguageYamlEnabled: lsBool(LS_KEYS.monacoLanguageYamlEnabled, true),
  setMonacoLanguageYamlEnabled: (v: boolean) => set({ monacoLanguageYamlEnabled: lsSetBool(LS_KEYS.monacoLanguageYamlEnabled, !!v) }),
  monacoLanguageYamlLoadMode: readMonacoLoadMode(LS_KEYS.monacoLanguageYamlLoadMode, 'lazy'),
  setMonacoLanguageYamlLoadMode: (v: 'lazy' | 'eager') => {
    const next = writeLsString(LS_KEYS.monacoLanguageYamlLoadMode, v === 'eager' ? 'eager' : 'lazy') as 'lazy' | 'eager'
    set({ monacoLanguageYamlLoadMode: next })
  },
  monacoWorkerJsonEnabled: lsBool(LS_KEYS.monacoWorkerJsonEnabled, true),
  setMonacoWorkerJsonEnabled: (v: boolean) => set({ monacoWorkerJsonEnabled: lsSetBool(LS_KEYS.monacoWorkerJsonEnabled, !!v) }),
  monacoWorkerJsonLoadMode: readMonacoLoadMode(LS_KEYS.monacoWorkerJsonLoadMode, 'lazy'),
  setMonacoWorkerJsonLoadMode: (v: 'lazy' | 'eager') => {
    const next = writeLsString(LS_KEYS.monacoWorkerJsonLoadMode, v === 'eager' ? 'eager' : 'lazy') as 'lazy' | 'eager'
    set({ monacoWorkerJsonLoadMode: next })
  },
  monacoHoverEnabled: lsBool(LS_KEYS.monacoHoverEnabled, false),
  setMonacoHoverEnabled: (v: boolean) => set({ monacoHoverEnabled: lsSetBool(LS_KEYS.monacoHoverEnabled, !!v) }),
  monacoLinksEnabled: lsBool(LS_KEYS.monacoLinksEnabled, false),
  setMonacoLinksEnabled: (v: boolean) => set({ monacoLinksEnabled: lsSetBool(LS_KEYS.monacoLinksEnabled, !!v) }),
  monacoQuickSuggestionsEnabled: lsBool(LS_KEYS.monacoQuickSuggestionsEnabled, false),
  setMonacoQuickSuggestionsEnabled: (v: boolean) => set({ monacoQuickSuggestionsEnabled: lsSetBool(LS_KEYS.monacoQuickSuggestionsEnabled, !!v) }),
  monacoSuggestOnTriggerCharactersEnabled: lsBool(LS_KEYS.monacoSuggestOnTriggerCharactersEnabled, false),
  setMonacoSuggestOnTriggerCharactersEnabled: (v: boolean) =>
    set({ monacoSuggestOnTriggerCharactersEnabled: lsSetBool(LS_KEYS.monacoSuggestOnTriggerCharactersEnabled, !!v) }),
  monacoParameterHintsEnabled: lsBool(LS_KEYS.monacoParameterHintsEnabled, false),
  setMonacoParameterHintsEnabled: (v: boolean) => set({ monacoParameterHintsEnabled: lsSetBool(LS_KEYS.monacoParameterHintsEnabled, !!v) }),
  monacoLineNumbersEnabled: lsBool(LS_KEYS.monacoLineNumbersEnabled, true),
  setMonacoLineNumbersEnabled: (v: boolean) => set({ monacoLineNumbersEnabled: lsSetBool(LS_KEYS.monacoLineNumbersEnabled, !!v) }),
  monacoFoldingEnabled: lsBool(LS_KEYS.monacoFoldingEnabled, false),
  setMonacoFoldingEnabled: (v: boolean) => set({ monacoFoldingEnabled: lsSetBool(LS_KEYS.monacoFoldingEnabled, !!v) }),
  monacoMinimapEnabled: lsBool(LS_KEYS.monacoMinimapEnabled, false),
  setMonacoMinimapEnabled: (v: boolean) => set({ monacoMinimapEnabled: lsSetBool(LS_KEYS.monacoMinimapEnabled, !!v) }),
  monacoSelectionHighlightEnabled: lsBool(LS_KEYS.monacoSelectionHighlightEnabled, false),
  setMonacoSelectionHighlightEnabled: (v: boolean) =>
    set({ monacoSelectionHighlightEnabled: lsSetBool(LS_KEYS.monacoSelectionHighlightEnabled, !!v) }),
  monacoOccurrencesHighlightEnabled: lsBool(LS_KEYS.monacoOccurrencesHighlightEnabled, false),
  setMonacoOccurrencesHighlightEnabled: (v: boolean) =>
    set({ monacoOccurrencesHighlightEnabled: lsSetBool(LS_KEYS.monacoOccurrencesHighlightEnabled, !!v) }),
  monacoGuidesEnabled: lsBool(LS_KEYS.monacoGuidesEnabled, false),
  setMonacoGuidesEnabled: (v: boolean) => set({ monacoGuidesEnabled: lsSetBool(LS_KEYS.monacoGuidesEnabled, !!v) }),
  monacoBracketPairColorizationEnabled: lsBool(LS_KEYS.monacoBracketPairColorizationEnabled, false),
  setMonacoBracketPairColorizationEnabled: (v: boolean) =>
    set({ monacoBracketPairColorizationEnabled: lsSetBool(LS_KEYS.monacoBracketPairColorizationEnabled, !!v) }),
  monacoCodeLensEnabled: lsBool(LS_KEYS.monacoCodeLensEnabled, false),
  setMonacoCodeLensEnabled: (v: boolean) => set({ monacoCodeLensEnabled: lsSetBool(LS_KEYS.monacoCodeLensEnabled, !!v) }),
  monacoLightbulbEnabled: lsBool(LS_KEYS.monacoLightbulbEnabled, false),
  setMonacoLightbulbEnabled: (v: boolean) => set({ monacoLightbulbEnabled: lsSetBool(LS_KEYS.monacoLightbulbEnabled, !!v) }),
  monacoInlayHintsEnabled: lsBool(LS_KEYS.monacoInlayHintsEnabled, false),
  setMonacoInlayHintsEnabled: (v: boolean) => set({ monacoInlayHintsEnabled: lsSetBool(LS_KEYS.monacoInlayHintsEnabled, !!v) }),
  monacoWordBasedSuggestionsEnabled: lsBool(LS_KEYS.monacoWordBasedSuggestionsEnabled, false),
  setMonacoWordBasedSuggestionsEnabled: (v: boolean) =>
    set({ monacoWordBasedSuggestionsEnabled: lsSetBool(LS_KEYS.monacoWordBasedSuggestionsEnabled, !!v) }),
  monacoInlineSuggestEnabled: lsBool(LS_KEYS.monacoInlineSuggestEnabled, false),
  setMonacoInlineSuggestEnabled: (v: boolean) => set({ monacoInlineSuggestEnabled: lsSetBool(LS_KEYS.monacoInlineSuggestEnabled, !!v) }),
  monacoAcceptSuggestionOnEnterEnabled: lsBool(LS_KEYS.monacoAcceptSuggestionOnEnterEnabled, false),
  setMonacoAcceptSuggestionOnEnterEnabled: (v: boolean) =>
    set({ monacoAcceptSuggestionOnEnterEnabled: lsSetBool(LS_KEYS.monacoAcceptSuggestionOnEnterEnabled, !!v) }),
  monacoDragAndDropEnabled: lsBool(LS_KEYS.monacoDragAndDropEnabled, false),
  setMonacoDragAndDropEnabled: (v: boolean) =>
    set({ monacoDragAndDropEnabled: lsSetBool(LS_KEYS.monacoDragAndDropEnabled, !!v) }),
  monacoDropIntoEditorEnabled: lsBool(LS_KEYS.monacoDropIntoEditorEnabled, false),
  setMonacoDropIntoEditorEnabled: (v: boolean) =>
    set({ monacoDropIntoEditorEnabled: lsSetBool(LS_KEYS.monacoDropIntoEditorEnabled, !!v) }),
  monacoColorDecoratorsEnabled: lsBool(LS_KEYS.monacoColorDecoratorsEnabled, false),
  setMonacoColorDecoratorsEnabled: (v: boolean) =>
    set({ monacoColorDecoratorsEnabled: lsSetBool(LS_KEYS.monacoColorDecoratorsEnabled, !!v) }),
  monacoUnicodeHighlightEnabled: lsBool(LS_KEYS.monacoUnicodeHighlightEnabled, false),
  setMonacoUnicodeHighlightEnabled: (v: boolean) =>
    set({ monacoUnicodeHighlightEnabled: lsSetBool(LS_KEYS.monacoUnicodeHighlightEnabled, !!v) }),
  monacoMatchBracketsEnabled: lsBool(LS_KEYS.monacoMatchBracketsEnabled, false),
  setMonacoMatchBracketsEnabled: (v: boolean) =>
    set({ monacoMatchBracketsEnabled: lsSetBool(LS_KEYS.monacoMatchBracketsEnabled, !!v) }),
  monacoRenderLineHighlightEnabled: lsBool(LS_KEYS.monacoRenderLineHighlightEnabled, false),
  setMonacoRenderLineHighlightEnabled: (v: boolean) =>
    set({ monacoRenderLineHighlightEnabled: lsSetBool(LS_KEYS.monacoRenderLineHighlightEnabled, !!v) }),
  monacoGlyphMarginEnabled: lsBool(LS_KEYS.monacoGlyphMarginEnabled, false),
  setMonacoGlyphMarginEnabled: (v: boolean) =>
    set({ monacoGlyphMarginEnabled: lsSetBool(LS_KEYS.monacoGlyphMarginEnabled, !!v) }),
  monacoOverviewRulerLanesEnabled: lsBool(LS_KEYS.monacoOverviewRulerLanesEnabled, false),
  setMonacoOverviewRulerLanesEnabled: (v: boolean) =>
    set({ monacoOverviewRulerLanesEnabled: lsSetBool(LS_KEYS.monacoOverviewRulerLanesEnabled, !!v) }),
  monacoLineDecorationsWidthEnabled: lsBool(LS_KEYS.monacoLineDecorationsWidthEnabled, false),
  setMonacoLineDecorationsWidthEnabled: (v: boolean) =>
    set({ monacoLineDecorationsWidthEnabled: lsSetBool(LS_KEYS.monacoLineDecorationsWidthEnabled, !!v) }),
  monacoRenderWhitespaceEnabled: lsBool(LS_KEYS.monacoRenderWhitespaceEnabled, false),
  setMonacoRenderWhitespaceEnabled: (v: boolean) =>
    set({ monacoRenderWhitespaceEnabled: lsSetBool(LS_KEYS.monacoRenderWhitespaceEnabled, !!v) }),
  monacoRenderControlCharactersEnabled: lsBool(LS_KEYS.monacoRenderControlCharactersEnabled, false),
  setMonacoRenderControlCharactersEnabled: (v: boolean) =>
    set({ monacoRenderControlCharactersEnabled: lsSetBool(LS_KEYS.monacoRenderControlCharactersEnabled, !!v) }),
  monacoSmoothScrollingEnabled: lsBool(LS_KEYS.monacoSmoothScrollingEnabled, false),
  setMonacoSmoothScrollingEnabled: (v: boolean) =>
    set({ monacoSmoothScrollingEnabled: lsSetBool(LS_KEYS.monacoSmoothScrollingEnabled, !!v) }),
  monacoScrollBeyondLastLineEnabled: lsBool(LS_KEYS.monacoScrollBeyondLastLineEnabled, false),
  setMonacoScrollBeyondLastLineEnabled: (v: boolean) =>
    set({ monacoScrollBeyondLastLineEnabled: lsSetBool(LS_KEYS.monacoScrollBeyondLastLineEnabled, !!v) }),
  monacoMouseWheelZoomEnabled: lsBool(LS_KEYS.monacoMouseWheelZoomEnabled, false),
  setMonacoMouseWheelZoomEnabled: (v: boolean) =>
    set({ monacoMouseWheelZoomEnabled: lsSetBool(LS_KEYS.monacoMouseWheelZoomEnabled, !!v) }),
  monacoCursorBlinkingEnabled: lsBool(LS_KEYS.monacoCursorBlinkingEnabled, false),
  setMonacoCursorBlinkingEnabled: (v: boolean) =>
    set({ monacoCursorBlinkingEnabled: lsSetBool(LS_KEYS.monacoCursorBlinkingEnabled, !!v) }),
  monacoCursorSmoothCaretAnimationEnabled: lsBool(LS_KEYS.monacoCursorSmoothCaretAnimationEnabled, false),
  setMonacoCursorSmoothCaretAnimationEnabled: (v: boolean) =>
    set({
      monacoCursorSmoothCaretAnimationEnabled: lsSetBool(LS_KEYS.monacoCursorSmoothCaretAnimationEnabled, !!v),
    }),
  monacoWordWrapEnabled: lsBool(LS_KEYS.monacoWordWrapEnabled, false),
  setMonacoWordWrapEnabled: (v: boolean) =>
    set({ monacoWordWrapEnabled: lsSetBool(LS_KEYS.monacoWordWrapEnabled, !!v) }),
  monacoWrappingIndentEnabled: lsBool(LS_KEYS.monacoWrappingIndentEnabled, false),
  setMonacoWrappingIndentEnabled: (v: boolean) =>
    set({ monacoWrappingIndentEnabled: lsSetBool(LS_KEYS.monacoWrappingIndentEnabled, !!v) }),
  monacoWrappingStrategyEnabled: lsBool(LS_KEYS.monacoWrappingStrategyEnabled, false),
  setMonacoWrappingStrategyEnabled: (v: boolean) =>
    set({ monacoWrappingStrategyEnabled: lsSetBool(LS_KEYS.monacoWrappingStrategyEnabled, !!v) }),
  monacoCursorWidthEnabled: lsBool(LS_KEYS.monacoCursorWidthEnabled, false),
  setMonacoCursorWidthEnabled: (v: boolean) =>
    set({ monacoCursorWidthEnabled: lsSetBool(LS_KEYS.monacoCursorWidthEnabled, !!v) }),
  monacoCursorStyleEnabled: lsBool(LS_KEYS.monacoCursorStyleEnabled, false),
  setMonacoCursorStyleEnabled: (v: boolean) =>
    set({ monacoCursorStyleEnabled: lsSetBool(LS_KEYS.monacoCursorStyleEnabled, !!v) }),
  monacoCursorSurroundingLinesEnabled: lsBool(LS_KEYS.monacoCursorSurroundingLinesEnabled, false),
  setMonacoCursorSurroundingLinesEnabled: (v: boolean) =>
    set({ monacoCursorSurroundingLinesEnabled: lsSetBool(LS_KEYS.monacoCursorSurroundingLinesEnabled, !!v) }),
  monacoCursorSurroundingLinesStyleEnabled: lsBool(LS_KEYS.monacoCursorSurroundingLinesStyleEnabled, false),
  setMonacoCursorSurroundingLinesStyleEnabled: (v: boolean) =>
    set({
      monacoCursorSurroundingLinesStyleEnabled: lsSetBool(LS_KEYS.monacoCursorSurroundingLinesStyleEnabled, !!v),
    }),
  monacoCursorHeightEnabled: lsBool(LS_KEYS.monacoCursorHeightEnabled, false),
  setMonacoCursorHeightEnabled: (v: boolean) =>
    set({ monacoCursorHeightEnabled: lsSetBool(LS_KEYS.monacoCursorHeightEnabled, !!v) }),
  monacoStickyScrollEnabled: lsBool(LS_KEYS.monacoStickyScrollEnabled, false),
  setMonacoStickyScrollEnabled: (v: boolean) =>
    set({ monacoStickyScrollEnabled: lsSetBool(LS_KEYS.monacoStickyScrollEnabled, !!v) }),
  monacoSelectionClipboardEnabled: lsBool(LS_KEYS.monacoSelectionClipboardEnabled, false),
  setMonacoSelectionClipboardEnabled: (v: boolean) =>
    set({ monacoSelectionClipboardEnabled: lsSetBool(LS_KEYS.monacoSelectionClipboardEnabled, !!v) }),
  monacoCopyWithSyntaxHighlightingEnabled: lsBool(LS_KEYS.monacoCopyWithSyntaxHighlightingEnabled, false),
  setMonacoCopyWithSyntaxHighlightingEnabled: (v: boolean) =>
    set({
      monacoCopyWithSyntaxHighlightingEnabled: lsSetBool(LS_KEYS.monacoCopyWithSyntaxHighlightingEnabled, !!v),
    }),
  monacoOccurrencesHighlightDelayEnabled: lsBool(LS_KEYS.monacoOccurrencesHighlightDelayEnabled, false),
  setMonacoOccurrencesHighlightDelayEnabled: (v: boolean) =>
    set({
      monacoOccurrencesHighlightDelayEnabled: lsSetBool(LS_KEYS.monacoOccurrencesHighlightDelayEnabled, !!v),
    }),
  monacoFormatOnPasteEnabled: lsBool(LS_KEYS.monacoFormatOnPasteEnabled, false),
  setMonacoFormatOnPasteEnabled: (v: boolean) =>
    set({ monacoFormatOnPasteEnabled: lsSetBool(LS_KEYS.monacoFormatOnPasteEnabled, !!v) }),
  monacoFormatOnTypeEnabled: lsBool(LS_KEYS.monacoFormatOnTypeEnabled, false),
  setMonacoFormatOnTypeEnabled: (v: boolean) =>
    set({ monacoFormatOnTypeEnabled: lsSetBool(LS_KEYS.monacoFormatOnTypeEnabled, !!v) }),
  monacoAutoClosingBracketsEnabled: lsBool(LS_KEYS.monacoAutoClosingBracketsEnabled, false),
  setMonacoAutoClosingBracketsEnabled: (v: boolean) =>
    set({ monacoAutoClosingBracketsEnabled: lsSetBool(LS_KEYS.monacoAutoClosingBracketsEnabled, !!v) }),
  monacoAutoClosingQuotesEnabled: lsBool(LS_KEYS.monacoAutoClosingQuotesEnabled, false),
  setMonacoAutoClosingQuotesEnabled: (v: boolean) =>
    set({ monacoAutoClosingQuotesEnabled: lsSetBool(LS_KEYS.monacoAutoClosingQuotesEnabled, !!v) }),
  monacoAutoIndentEnabled: lsBool(LS_KEYS.monacoAutoIndentEnabled, false),
  setMonacoAutoIndentEnabled: (v: boolean) =>
    set({ monacoAutoIndentEnabled: lsSetBool(LS_KEYS.monacoAutoIndentEnabled, !!v) }),
  monacoAutoSurroundEnabled: lsBool(LS_KEYS.monacoAutoSurroundEnabled, false),
  setMonacoAutoSurroundEnabled: (v: boolean) =>
    set({ monacoAutoSurroundEnabled: lsSetBool(LS_KEYS.monacoAutoSurroundEnabled, !!v) }),
  monacoMatchOnWordStartOnlyEnabled: lsBool(LS_KEYS.monacoMatchOnWordStartOnlyEnabled, false),
  setMonacoMatchOnWordStartOnlyEnabled: (v: boolean) =>
    set({ monacoMatchOnWordStartOnlyEnabled: lsSetBool(LS_KEYS.monacoMatchOnWordStartOnlyEnabled, !!v) }),
  monacoFindSeedSearchStringFromSelectionEnabled: lsBool(LS_KEYS.monacoFindSeedSearchStringFromSelectionEnabled, false),
  setMonacoFindSeedSearchStringFromSelectionEnabled: (v: boolean) =>
    set({
      monacoFindSeedSearchStringFromSelectionEnabled: lsSetBool(
        LS_KEYS.monacoFindSeedSearchStringFromSelectionEnabled,
        !!v,
      ),
    }),
  monacoFindCursorMoveOnTypeEnabled: lsBool(LS_KEYS.monacoFindCursorMoveOnTypeEnabled, false),
  setMonacoFindCursorMoveOnTypeEnabled: (v: boolean) =>
    set({ monacoFindCursorMoveOnTypeEnabled: lsSetBool(LS_KEYS.monacoFindCursorMoveOnTypeEnabled, !!v) }),
  monacoFindFindOnTypeEnabled: lsBool(LS_KEYS.monacoFindFindOnTypeEnabled, false),
  setMonacoFindFindOnTypeEnabled: (v: boolean) =>
    set({ monacoFindFindOnTypeEnabled: lsSetBool(LS_KEYS.monacoFindFindOnTypeEnabled, !!v) }),
  monacoFindLoopEnabled: lsBool(LS_KEYS.monacoFindLoopEnabled, false),
  setMonacoFindLoopEnabled: (v: boolean) =>
    set({ monacoFindLoopEnabled: lsSetBool(LS_KEYS.monacoFindLoopEnabled, !!v) }),
  monacoAutoClosingDeleteEnabled: lsBool(LS_KEYS.monacoAutoClosingDeleteEnabled, false),
  setMonacoAutoClosingDeleteEnabled: (v: boolean) =>
    set({ monacoAutoClosingDeleteEnabled: lsSetBool(LS_KEYS.monacoAutoClosingDeleteEnabled, !!v) }),
  monacoAutoClosingCommentsEnabled: lsBool(LS_KEYS.monacoAutoClosingCommentsEnabled, false),
  setMonacoAutoClosingCommentsEnabled: (v: boolean) =>
    set({ monacoAutoClosingCommentsEnabled: lsSetBool(LS_KEYS.monacoAutoClosingCommentsEnabled, !!v) }),
  monacoEmptySelectionClipboardEnabled: lsBool(LS_KEYS.monacoEmptySelectionClipboardEnabled, false),
  setMonacoEmptySelectionClipboardEnabled: (v: boolean) =>
    set({ monacoEmptySelectionClipboardEnabled: lsSetBool(LS_KEYS.monacoEmptySelectionClipboardEnabled, !!v) }),
  monacoColumnSelectionEnabled: lsBool(LS_KEYS.monacoColumnSelectionEnabled, false),
  setMonacoColumnSelectionEnabled: (v: boolean) =>
    set({ monacoColumnSelectionEnabled: lsSetBool(LS_KEYS.monacoColumnSelectionEnabled, !!v) }),
  monacoWordSeparatorsEnabled: lsBool(LS_KEYS.monacoWordSeparatorsEnabled, false),
  setMonacoWordSeparatorsEnabled: (v: boolean) =>
    set({ monacoWordSeparatorsEnabled: lsSetBool(LS_KEYS.monacoWordSeparatorsEnabled, !!v) }),
  monacoMultiCursorModifierEnabled: lsBool(LS_KEYS.monacoMultiCursorModifierEnabled, false),
  setMonacoMultiCursorModifierEnabled: (v: boolean) =>
    set({ monacoMultiCursorModifierEnabled: lsSetBool(LS_KEYS.monacoMultiCursorModifierEnabled, !!v) }),
  monacoMultiCursorMergeOverlappingEnabled: lsBool(LS_KEYS.monacoMultiCursorMergeOverlappingEnabled, false),
  setMonacoMultiCursorMergeOverlappingEnabled: (v: boolean) =>
    set({
      monacoMultiCursorMergeOverlappingEnabled: lsSetBool(LS_KEYS.monacoMultiCursorMergeOverlappingEnabled, !!v),
    }),
  monacoMultiCursorPasteEnabled: lsBool(LS_KEYS.monacoMultiCursorPasteEnabled, false),
  setMonacoMultiCursorPasteEnabled: (v: boolean) =>
    set({ monacoMultiCursorPasteEnabled: lsSetBool(LS_KEYS.monacoMultiCursorPasteEnabled, !!v) }),
  monacoAutoClosingOvertypeEnabled: lsBool(LS_KEYS.monacoAutoClosingOvertypeEnabled, false),
  setMonacoAutoClosingOvertypeEnabled: (v: boolean) =>
    set({ monacoAutoClosingOvertypeEnabled: lsSetBool(LS_KEYS.monacoAutoClosingOvertypeEnabled, !!v) }),
  monacoMouseStyleEnabled: lsBool(LS_KEYS.monacoMouseStyleEnabled, false),
  setMonacoMouseStyleEnabled: (v: boolean) =>
    set({ monacoMouseStyleEnabled: lsSetBool(LS_KEYS.monacoMouseStyleEnabled, !!v) }),
  monacoRenderFinalNewlineEnabled: lsBool(LS_KEYS.monacoRenderFinalNewlineEnabled, false),
  setMonacoRenderFinalNewlineEnabled: (v: boolean) =>
    set({ monacoRenderFinalNewlineEnabled: lsSetBool(LS_KEYS.monacoRenderFinalNewlineEnabled, !!v) }),
  monacoAccessibilitySupportEnabled: lsBool(LS_KEYS.monacoAccessibilitySupportEnabled, false),
  setMonacoAccessibilitySupportEnabled: (v: boolean) =>
    set({ monacoAccessibilitySupportEnabled: lsSetBool(LS_KEYS.monacoAccessibilitySupportEnabled, !!v) }),
  monacoScrollbarUseShadowsEnabled: lsBool(LS_KEYS.monacoScrollbarUseShadowsEnabled, false),
  setMonacoScrollbarUseShadowsEnabled: (v: boolean) =>
    set({ monacoScrollbarUseShadowsEnabled: lsSetBool(LS_KEYS.monacoScrollbarUseShadowsEnabled, !!v) }),
  monacoScrollbarAlwaysConsumeMouseWheelEnabled: lsBool(LS_KEYS.monacoScrollbarAlwaysConsumeMouseWheelEnabled, false),
  setMonacoScrollbarAlwaysConsumeMouseWheelEnabled: (v: boolean) =>
    set({
      monacoScrollbarAlwaysConsumeMouseWheelEnabled: lsSetBool(
        LS_KEYS.monacoScrollbarAlwaysConsumeMouseWheelEnabled,
        !!v,
      ),
    }),
  monacoHorizontalScrollbarSizeEnabled: lsBool(LS_KEYS.monacoHorizontalScrollbarSizeEnabled, false),
  setMonacoHorizontalScrollbarSizeEnabled: (v: boolean) =>
    set({ monacoHorizontalScrollbarSizeEnabled: lsSetBool(LS_KEYS.monacoHorizontalScrollbarSizeEnabled, !!v) }),
  monacoVerticalScrollbarSizeEnabled: lsBool(LS_KEYS.monacoVerticalScrollbarSizeEnabled, false),
  setMonacoVerticalScrollbarSizeEnabled: (v: boolean) =>
    set({ monacoVerticalScrollbarSizeEnabled: lsSetBool(LS_KEYS.monacoVerticalScrollbarSizeEnabled, !!v) }),
  monacoMouseWheelScrollSensitivityEnabled: lsBool(LS_KEYS.monacoMouseWheelScrollSensitivityEnabled, false),
  setMonacoMouseWheelScrollSensitivityEnabled: (v: boolean) =>
    set({
      monacoMouseWheelScrollSensitivityEnabled: lsSetBool(LS_KEYS.monacoMouseWheelScrollSensitivityEnabled, !!v),
    }),

  }
}
