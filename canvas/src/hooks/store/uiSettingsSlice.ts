import type { StoreApi } from 'zustand';
import type { GraphState, GraphDataTableScope, GraphDataTableFreezeMode, GraphHoverPreviewConfig, DocumentSemanticMode, BottomTab, MonacoCapabilityLoadMode } from './types';
import type { GraphFieldId, GraphFieldSettingsById } from '@/features/graph-fields/graphFields';
import type {
  GraphDataTableColumnKey,
  GraphDataTableColumnVisibilityByKey,
  GraphDataTableFilterClause,
  GraphDataTableFilterMatch,
  GraphDataTableRowDensity,
  GraphDataTableSortRule,
} from '@/features/graph-data-table/graphDataTable';
import type { TraversalSummary } from '@/features/panels/utils/orchestratorTraversal';
import { LS_KEYS, SESSION_KEYS } from '@/lib/config.ls.keys';
import { UI_COPY } from '@/lib/config-copy/uiCopy';
import { lsBool, lsFloat, lsInt, lsSetBool, lsSetFloat, lsSetInt } from '@/lib/persistence'
import { ssSetString, ssString, getLocalStorage } from '@/lib/persistence';
import { ThemeMode, ResolvedThemeMode, getInitialThemeMode, persistThemeMode, applyThemeMode, resolveThemeMode, getSystemTheme } from '@/lib/ui/theme';
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import type { GraphData } from '@/lib/graph/types'
import type { ZoomRequest } from '@/lib/zoom/requests'
import { isFrontmatterOnlyPolicyActive } from '@/lib/config.render'

const nodeHasMediaLikeProps = (node: { properties?: unknown } | null): boolean => {
  if (!node) return false
  const props = node.properties
  if (!props || typeof props !== 'object' || Array.isArray(props)) return false
  const rec = props as Record<string, unknown>
  const keys = ['iframe_url', 'media_url', 'image', 'video', 'media']
  for (let i = 0; i < keys.length; i += 1) {
    const v = rec[keys[i]!]
    if (typeof v === 'string' && v.trim()) return true
  }
  return false
}

const nodeIdExistsInGraph = (graph: unknown, nodeId: string): boolean => {
  if (!nodeId) return false
  if (!graph || typeof graph !== 'object') return false
  const g = graph as { nodes?: unknown }
  const nodes = Array.isArray(g.nodes) ? (g.nodes as Array<{ id?: unknown }>) : []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    if (!n) continue
    if (String(n.id || '') === nodeId) return true
  }
  return false
}

type SetGraph = StoreApi<GraphState>['setState'];
type GetGraph = StoreApi<GraphState>['getState'];

const createSessionTabId = (): string =>
  `tab-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`

export const readInitialSessionTabId = (): string => {
  try {
    return ssString(SESSION_KEYS.tabId, '') || 'tab-ssr'
  } catch {
    return 'tab-ssr'
  }
}

export const ensureSessionTabId = (): string => {
  try {
    const existing = ssString(SESSION_KEYS.tabId, '')
    if (existing) return existing
    const id = createSessionTabId()
    ssSetString(SESSION_KEYS.tabId, id)
    return id
  } catch {
    return 'tab-ssr'
  }
}

export const createUiSettingsSlice = (set: SetGraph, get: GetGraph) => {
  const themeMode = getInitialThemeMode(getLocalStorage())
  const resolvedThemeMode: ResolvedThemeMode = resolveThemeMode(themeMode)
  const keywordDefaults = {
    sourceMaxLines: lsInt(LS_KEYS.keywordSourceMaxLines, 8000),
    sourceMaxChars: lsInt(LS_KEYS.keywordSourceMaxChars, 120_000),
    previewDebounceMs: lsInt(LS_KEYS.keywordGraphPreviewDebounceMs, 200),
    fullDebounceMs: lsInt(LS_KEYS.keywordGraphFullDebounceMs, 800),
    edgesPerNode: lsInt(LS_KEYS.keywordGraphEdgesPerNode, 6),
    maxEdgesCap: lsInt(LS_KEYS.keywordGraphMaxEdgesCap, 2400),
    mentionEdgesPerSourceNode: lsInt(LS_KEYS.keywordGraphMentionEdgesPerSourceNode, 6),
  }
  const clampInt = (v: number, fallback: number, opts: { min: number; max: number }) => {
    const n = Number.isFinite(v) ? Math.floor(Number(v)) : fallback
    return n < opts.min ? opts.min : n > opts.max ? opts.max : n
  }
  const clampFloat = (v: number, fallback: number, opts: { min: number; max: number }) => {
    const n = Number.isFinite(v) ? Number(v) : fallback
    return n < opts.min ? opts.min : n > opts.max ? opts.max : n
  }
  const readLsString = (key: string, fallback: string) => {
    const storage = getLocalStorage()
    if (!storage) return fallback
    try {
      const raw = storage.getItem(key)
      if (raw == null) return fallback
      const s = String(raw || '').trim()
      return s ? s : fallback
    } catch {
      return fallback
    }
  }
  const writeLsString = (key: string, value: string) => {
    const storage = getLocalStorage()
    const next = String(value || '').trim()
    if (!storage) return next
    try {
      storage.setItem(key, next)
    } catch {
      void 0
    }
    return next
  }
  const readMonacoLoadMode = (key: string, fallback: MonacoCapabilityLoadMode = 'lazy'): MonacoCapabilityLoadMode => {
    const raw = readLsString(key, fallback)
    return raw === 'eager' ? 'eager' : 'lazy'
  }
  return ({
  renderMediaAsNodes: true,
  setRenderMediaAsNodes: (v: boolean) => set({ renderMediaAsNodes: v }),
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

  richMediaPanelMode: (() => {
    const raw = readLsString(LS_KEYS.renderRichMediaPanelMode, 'snapshot')
    return (raw === 'embed' ? 'embed' : 'snapshot') as 'snapshot' | 'embed'
  })(),
  setRichMediaPanelMode: (v: 'snapshot' | 'embed') => {
    const next = v === 'embed' ? 'embed' : 'snapshot'
    writeLsString(LS_KEYS.renderRichMediaPanelMode, next)
    set({ richMediaPanelMode: next })
  },

  bipartiteDataSource: (() => {
    const raw = readLsString(LS_KEYS.bipartiteDataSource, 'workspace')
    return (raw === 'fixture' ? 'fixture' : raw === 'workspace' ? 'workspace' : 'api') as 'api' | 'fixture' | 'workspace'
  })(),
  setBipartiteDataSource: (v: 'api' | 'fixture' | 'workspace') => {
    const next = v === 'fixture' ? 'fixture' : v === 'workspace' ? 'workspace' : 'api'
    writeLsString(LS_KEYS.bipartiteDataSource, next)
    set({ bipartiteDataSource: next })
  },
  bipartiteApiRunId: readLsString(LS_KEYS.bipartiteApiRunId, ''),
  setBipartiteApiRunId: (v: string) => {
    const next = writeLsString(LS_KEYS.bipartiteApiRunId, v)
    set({ bipartiteApiRunId: next })
  },
  bipartitePollIntervalSec: clampInt(lsInt(LS_KEYS.bipartitePollIntervalSec, 60), 60, { min: 3, max: 3600 }),
  setBipartitePollIntervalSec: (v: number) =>
    set({ bipartitePollIntervalSec: lsSetInt(LS_KEYS.bipartitePollIntervalSec, v, { min: 3, max: 3600 }) }),

  bipartiteNodeSizeMetric: (() => {
    const raw = readLsString(LS_KEYS.bipartiteNodeSizeMetric, 'gap_score')
    const next = raw === 'pmf_score' || raw === 'gap_velocity' || raw === 'source_count' || raw === 'none' ? raw : 'gap_score'
    return next as 'gap_score' | 'pmf_score' | 'gap_velocity' | 'source_count' | 'none'
  })(),
  setBipartiteNodeSizeMetric: (v: 'gap_score' | 'pmf_score' | 'gap_velocity' | 'source_count' | 'none') => {
    const next = v === 'pmf_score' || v === 'gap_velocity' || v === 'source_count' || v === 'none' ? v : 'gap_score'
    writeLsString(LS_KEYS.bipartiteNodeSizeMetric, next)
    set({ bipartiteNodeSizeMetric: next })
  },
  bipartiteNodeGlowMetric: (() => {
    const raw = readLsString(LS_KEYS.bipartiteNodeGlowMetric, 'pmf_score')
    const next = raw === 'gap_score' || raw === 'none' ? raw : 'pmf_score'
    return next as 'pmf_score' | 'gap_score' | 'none'
  })(),
  setBipartiteNodeGlowMetric: (v: 'pmf_score' | 'gap_score' | 'none') => {
    const next = v === 'gap_score' || v === 'none' ? v : 'pmf_score'
    writeLsString(LS_KEYS.bipartiteNodeGlowMetric, next)
    set({ bipartiteNodeGlowMetric: next })
  },
  bipartiteNodePulseMetric: (() => {
    const raw = readLsString(LS_KEYS.bipartiteNodePulseMetric, 'gap_velocity')
    const next = raw === 'pmf_score' || raw === 'none' ? raw : 'gap_velocity'
    return next as 'gap_velocity' | 'pmf_score' | 'none'
  })(),
  setBipartiteNodePulseMetric: (v: 'gap_velocity' | 'pmf_score' | 'none') => {
    const next = v === 'pmf_score' || v === 'none' ? v : 'gap_velocity'
    writeLsString(LS_KEYS.bipartiteNodePulseMetric, next)
    set({ bipartiteNodePulseMetric: next })
  },
  bipartiteNodeBorderMetric: (() => {
    const raw = readLsString(LS_KEYS.bipartiteNodeBorderMetric, 'source_count')
    const next = raw === 'gap_score' || raw === 'none' ? raw : 'source_count'
    return next as 'source_count' | 'gap_score' | 'none'
  })(),
  setBipartiteNodeBorderMetric: (v: 'source_count' | 'gap_score' | 'none') => {
    const next = v === 'gap_score' || v === 'none' ? v : 'source_count'
    writeLsString(LS_KEYS.bipartiteNodeBorderMetric, next)
    set({ bipartiteNodeBorderMetric: next })
  },
  bipartiteEdgeOpacityMetric: (() => {
    const raw = readLsString(LS_KEYS.bipartiteEdgeOpacityMetric, 'strength')
    return (raw === 'none' ? 'none' : 'strength') as 'strength' | 'none'
  })(),
  setBipartiteEdgeOpacityMetric: (v: 'strength' | 'none') => {
    const next = v === 'none' ? 'none' : 'strength'
    writeLsString(LS_KEYS.bipartiteEdgeOpacityMetric, next)
    set({ bipartiteEdgeOpacityMetric: next })
  },

  bipartiteShowSpecificityBadges: lsBool(LS_KEYS.bipartiteShowSpecificityBadges, true),
  setBipartiteShowSpecificityBadges: (v: boolean) =>
    set({ bipartiteShowSpecificityBadges: lsSetBool(LS_KEYS.bipartiteShowSpecificityBadges, v) }),
  bipartiteShowGapScoreInLabel: lsBool(LS_KEYS.bipartiteShowGapScoreInLabel, true),
  setBipartiteShowGapScoreInLabel: (v: boolean) =>
    set({ bipartiteShowGapScoreInLabel: lsSetBool(LS_KEYS.bipartiteShowGapScoreInLabel, v) }),
  bipartiteShowClusterGapRatio: lsBool(LS_KEYS.bipartiteShowClusterGapRatio, true),
  setBipartiteShowClusterGapRatio: (v: boolean) =>
    set({ bipartiteShowClusterGapRatio: lsSetBool(LS_KEYS.bipartiteShowClusterGapRatio, v) }),

  threeIframeOverlayPoolMax: clampInt(lsInt(LS_KEYS.renderThreeIframeOverlayPoolMax, 24), 24, { min: 1, max: 200 }),
  setThreeIframeOverlayPoolMax: (v: number) => set({ threeIframeOverlayPoolMax: lsSetInt(LS_KEYS.renderThreeIframeOverlayPoolMax, v, { min: 1, max: 200 }) }),

  threeIframeOverlayMaxVisibleDefault: clampInt(lsInt(LS_KEYS.renderThreeIframeOverlayMaxVisibleDefault, 8), 8, { min: 0, max: 50 }),
  setThreeIframeOverlayMaxVisibleDefault: (v: number) => set({ threeIframeOverlayMaxVisibleDefault: lsSetInt(LS_KEYS.renderThreeIframeOverlayMaxVisibleDefault, v, { min: 0, max: 50 }) }),

  threeIframeOverlayMaxVisibleCompact: clampInt(lsInt(LS_KEYS.renderThreeIframeOverlayMaxVisibleCompact, 6), 6, { min: 0, max: 50 }),
  setThreeIframeOverlayMaxVisibleCompact: (v: number) => set({ threeIframeOverlayMaxVisibleCompact: lsSetInt(LS_KEYS.renderThreeIframeOverlayMaxVisibleCompact, v, { min: 0, max: 50 }) }),

  threeIframeOverlayMaxDistanceDefault: clampFloat(lsFloat(LS_KEYS.renderThreeIframeOverlayMaxDistanceDefault, 620, { min: 60, max: 5000 }), 620, { min: 60, max: 5000 }),
  setThreeIframeOverlayMaxDistanceDefault: (v: number) => set({ threeIframeOverlayMaxDistanceDefault: lsSetFloat(LS_KEYS.renderThreeIframeOverlayMaxDistanceDefault, v, { min: 60, max: 5000 }) }),

  threeIframeOverlayMaxDistanceCompact: clampFloat(lsFloat(LS_KEYS.renderThreeIframeOverlayMaxDistanceCompact, 520, { min: 60, max: 5000 }), 520, { min: 60, max: 5000 }),
  setThreeIframeOverlayMaxDistanceCompact: (v: number) => set({ threeIframeOverlayMaxDistanceCompact: lsSetFloat(LS_KEYS.renderThreeIframeOverlayMaxDistanceCompact, v, { min: 60, max: 5000 }) }),

  threeIframeOverlayBaseWidthRatioDefault: clampFloat(lsFloat(LS_KEYS.renderThreeIframeOverlayBaseWidthRatioDefault, 0.2, { min: 0.05, max: 0.9 }), 0.2, { min: 0.05, max: 0.9 }),
  setThreeIframeOverlayBaseWidthRatioDefault: (v: number) => set({ threeIframeOverlayBaseWidthRatioDefault: lsSetFloat(LS_KEYS.renderThreeIframeOverlayBaseWidthRatioDefault, v, { min: 0.05, max: 0.9 }) }),

  threeIframeOverlayBaseWidthRatioCompact: clampFloat(lsFloat(LS_KEYS.renderThreeIframeOverlayBaseWidthRatioCompact, 0.16, { min: 0.05, max: 0.9 }), 0.16, { min: 0.05, max: 0.9 }),
  setThreeIframeOverlayBaseWidthRatioCompact: (v: number) => set({ threeIframeOverlayBaseWidthRatioCompact: lsSetFloat(LS_KEYS.renderThreeIframeOverlayBaseWidthRatioCompact, v, { min: 0.05, max: 0.9 }) }),

  threeIframeOverlayBaseWidthMinPxDefault: clampInt(lsInt(LS_KEYS.renderThreeIframeOverlayBaseWidthMinPxDefault, 210), 210, { min: 80, max: 4000 }),
  setThreeIframeOverlayBaseWidthMinPxDefault: (v: number) => set({ threeIframeOverlayBaseWidthMinPxDefault: lsSetInt(LS_KEYS.renderThreeIframeOverlayBaseWidthMinPxDefault, v, { min: 80, max: 4000 }) }),

  threeIframeOverlayBaseWidthMinPxCompact: clampInt(lsInt(LS_KEYS.renderThreeIframeOverlayBaseWidthMinPxCompact, 180), 180, { min: 80, max: 4000 }),
  setThreeIframeOverlayBaseWidthMinPxCompact: (v: number) => set({ threeIframeOverlayBaseWidthMinPxCompact: lsSetInt(LS_KEYS.renderThreeIframeOverlayBaseWidthMinPxCompact, v, { min: 80, max: 4000 }) }),

  threeIframeOverlayBaseWidthMaxPxDefault: clampInt(lsInt(LS_KEYS.renderThreeIframeOverlayBaseWidthMaxPxDefault, 360), 360, { min: 80, max: 4000 }),
  setThreeIframeOverlayBaseWidthMaxPxDefault: (v: number) => set({ threeIframeOverlayBaseWidthMaxPxDefault: lsSetInt(LS_KEYS.renderThreeIframeOverlayBaseWidthMaxPxDefault, v, { min: 80, max: 4000 }) }),

  threeIframeOverlayBaseWidthMaxPxCompact: clampInt(lsInt(LS_KEYS.renderThreeIframeOverlayBaseWidthMaxPxCompact, 300), 300, { min: 80, max: 4000 }),
  setThreeIframeOverlayBaseWidthMaxPxCompact: (v: number) => set({ threeIframeOverlayBaseWidthMaxPxCompact: lsSetInt(LS_KEYS.renderThreeIframeOverlayBaseWidthMaxPxCompact, v, { min: 80, max: 4000 }) }),

  zoomLabelScaleMode2d: (() => {
    const raw = readLsString(LS_KEYS.zoomLabelScaleMode2d, 'clampAt1')
    const next = raw === 'smooth' || raw === 'power' ? raw : 'clampAt1'
    return next as 'clampAt1' | 'smooth' | 'power'
  })(),
  setZoomLabelScaleMode2d: (v: 'clampAt1' | 'smooth' | 'power') => {
    const next = v === 'smooth' || v === 'power' ? v : 'clampAt1'
    writeLsString(LS_KEYS.zoomLabelScaleMode2d, next)
    set({ zoomLabelScaleMode2d: next })
  },
  zoomLabelScaleExponent2d: clampFloat(lsFloat(LS_KEYS.zoomLabelScaleExponent2d, 1, { min: 0.05, max: 4 }), 1, { min: 0.05, max: 4 }),
  setZoomLabelScaleExponent2d: (v: number) => set({ zoomLabelScaleExponent2d: lsSetFloat(LS_KEYS.zoomLabelScaleExponent2d, v, { min: 0.05, max: 4 }) }),
  zoomLabelScaleClampMin2d: clampFloat(lsFloat(LS_KEYS.zoomLabelScaleClampMin2d, 0.000001, { min: 0.000001, max: 10 }), 0.000001, { min: 0.000001, max: 10 }),
  setZoomLabelScaleClampMin2d: (v: number) => set({ zoomLabelScaleClampMin2d: lsSetFloat(LS_KEYS.zoomLabelScaleClampMin2d, v, { min: 0.000001, max: 10 }) }),
  zoomLabelScaleClampMax2d: clampFloat(lsFloat(LS_KEYS.zoomLabelScaleClampMax2d, 1000000, { min: 1, max: 1000000 }), 1000000, { min: 1, max: 1000000 }),
  setZoomLabelScaleClampMax2d: (v: number) => set({ zoomLabelScaleClampMax2d: lsSetFloat(LS_KEYS.zoomLabelScaleClampMax2d, v, { min: 1, max: 1000000 }) }),

  zoomStrokeScaleMode2d: (() => {
    const raw = readLsString(LS_KEYS.zoomStrokeScaleMode2d, 'zoomScaled')
    const next = raw === 'screenConstant' || raw === 'power' ? raw : 'zoomScaled'
    return next as 'zoomScaled' | 'screenConstant' | 'power'
  })(),
  setZoomStrokeScaleMode2d: (v: 'zoomScaled' | 'screenConstant' | 'power') => {
    const next = v === 'screenConstant' || v === 'power' ? v : 'zoomScaled'
    writeLsString(LS_KEYS.zoomStrokeScaleMode2d, next)
    set({ zoomStrokeScaleMode2d: next })
  },
  zoomStrokeScaleExponent2d: clampFloat(lsFloat(LS_KEYS.zoomStrokeScaleExponent2d, 1, { min: 0.05, max: 4 }), 1, { min: 0.05, max: 4 }),
  setZoomStrokeScaleExponent2d: (v: number) => set({ zoomStrokeScaleExponent2d: lsSetFloat(LS_KEYS.zoomStrokeScaleExponent2d, v, { min: 0.05, max: 4 }) }),
  zoomStrokeScaleClampMin2d: clampFloat(lsFloat(LS_KEYS.zoomStrokeScaleClampMin2d, 0.000001, { min: 0.000001, max: 1000 }), 0.000001, { min: 0.000001, max: 1000 }),
  setZoomStrokeScaleClampMin2d: (v: number) => set({ zoomStrokeScaleClampMin2d: lsSetFloat(LS_KEYS.zoomStrokeScaleClampMin2d, v, { min: 0.000001, max: 1000 }) }),
  zoomStrokeScaleClampMax2d: clampFloat(lsFloat(LS_KEYS.zoomStrokeScaleClampMax2d, 1000, { min: 0.000001, max: 1000 }), 1000, { min: 0.000001, max: 1000 }),
  setZoomStrokeScaleClampMax2d: (v: number) => set({ zoomStrokeScaleClampMax2d: lsSetFloat(LS_KEYS.zoomStrokeScaleClampMax2d, v, { min: 0.000001, max: 1000 }) }),

  threeCameraAutoClip: lsBool(LS_KEYS.threeCameraAutoClip, true),
  setThreeCameraAutoClip: (v: boolean) => set({ threeCameraAutoClip: lsSetBool(LS_KEYS.threeCameraAutoClip, v) }),
  threeCameraAutoClipNearFactor: clampFloat(lsFloat(LS_KEYS.threeCameraAutoClipNearFactor, 0.0001, { min: 0.000001, max: 0.1 }), 0.0001, { min: 0.000001, max: 0.1 }),
  setThreeCameraAutoClipNearFactor: (v: number) => set({ threeCameraAutoClipNearFactor: lsSetFloat(LS_KEYS.threeCameraAutoClipNearFactor, v, { min: 0.000001, max: 0.1 }) }),
  threeCameraAutoClipFarFactor: clampFloat(lsFloat(LS_KEYS.threeCameraAutoClipFarFactor, 200, { min: 10, max: 1000000 }), 200, { min: 10, max: 1000000 }),
  setThreeCameraAutoClipFarFactor: (v: number) => set({ threeCameraAutoClipFarFactor: lsSetFloat(LS_KEYS.threeCameraAutoClipFarFactor, v, { min: 10, max: 1000000 }) }),

  threeIframeOverlaySizeScaleFactor: clampFloat(lsFloat(LS_KEYS.threeIframeOverlaySizeScaleFactor, 260, { min: 1, max: 20000 }), 260, { min: 1, max: 20000 }),
  setThreeIframeOverlaySizeScaleFactor: (v: number) => set({ threeIframeOverlaySizeScaleFactor: lsSetFloat(LS_KEYS.threeIframeOverlaySizeScaleFactor, v, { min: 1, max: 20000 }) }),

  threeEdgeRenderer: (() => {
    const raw = readLsString(LS_KEYS.threeEdgeRenderer, 'mesh')
    const next = raw === 'shaderLine' || raw === 'tubeBridge' ? raw : 'mesh'
    return next as 'mesh' | 'shaderLine' | 'tubeBridge'
  })(),
  setThreeEdgeRenderer: (v: 'mesh' | 'shaderLine' | 'tubeBridge') => {
    const next = v === 'shaderLine' || v === 'tubeBridge' ? v : 'mesh'
    writeLsString(LS_KEYS.threeEdgeRenderer, next)
    set({ threeEdgeRenderer: next })
  },
  threeShaderLineWidthPx: clampFloat(lsFloat(LS_KEYS.threeShaderLineWidthPx, 2, { min: 0.5, max: 20 }), 2, { min: 0.5, max: 20 }),
  setThreeShaderLineWidthPx: (v: number) => set({ threeShaderLineWidthPx: lsSetFloat(LS_KEYS.threeShaderLineWidthPx, v, { min: 0.5, max: 20 }) }),
  themeMode,
  resolvedThemeMode,
  setThemeMode: (mode: ThemeMode) => {
    persistThemeMode(getLocalStorage(), mode);
    applyThemeMode(mode);
    set({ themeMode: mode, resolvedThemeMode: resolveThemeMode(mode) });
  },
  refreshResolvedThemeModeFromSystem: () => {
    set((state) => {
      if (state.themeMode !== 'system') return {} as Partial<GraphState>;
      const next = getSystemTheme();
      applyThemeMode('system');
      if (state.resolvedThemeMode === next) return {} as Partial<GraphState>;
      return { resolvedThemeMode: next };
    });
  },
  selectionFlashDurationMs: 500,
  selectionFlashOpacity: 0.18,
  markdownSelectionFlashMode: 'auto' as const,
  bottomPanelHeightRatio: 0.35,
  floatingPanelWidthRatio: 0.25,
  floatingPanelHeightRatio: 0.5,
  floatingPanelZIndex: 40,
  bottomPanelTab: 'stats' as BottomTab,
  frontmatterModeEnabled: true,
  multiDimTableModeEnabled: false,
  documentSemanticMode: 'document' as DocumentSemanticMode,
  keywordSourceMaxLines: keywordDefaults.sourceMaxLines,
  keywordSourceMaxChars: keywordDefaults.sourceMaxChars,
  keywordGraphPreviewDebounceMs: keywordDefaults.previewDebounceMs,
  keywordGraphFullDebounceMs: keywordDefaults.fullDebounceMs,
  keywordGraphEdgesPerNode: keywordDefaults.edgesPerNode,
  keywordGraphMaxEdgesCap: keywordDefaults.maxEdgesCap,
  keywordGraphMentionEdgesPerSourceNode: keywordDefaults.mentionEdgesPerSourceNode,
  schemaDeriveCacheCapacity: 50,
  graphFieldSettingsById: {} as GraphFieldSettingsById,
  selectedGraphFieldId: null as GraphFieldId | null,
  graphRagWorkflowJsonText: null as string | null,
  graphDataTableVisibleColumns: {} as GraphDataTableColumnVisibilityByKey,
  graphDataTableColumnOrder: [] as GraphDataTableColumnKey[],
  graphDataTableAggregateKeys: [] as GraphDataTableColumnKey[],
  graphDataTableFilterMatch: 'all' as GraphDataTableFilterMatch,
  graphDataTableFilterClauses: [] as GraphDataTableFilterClause[],
  graphDataTableSortRules: [] as GraphDataTableSortRule[],
  graphDataTableGroupKey: '' as GraphDataTableColumnKey | '',
  graphDataTableAutoSortEnabled: true,
  graphDataTableRowDensity: 'standard' as GraphDataTableRowDensity,
  graphDataTableDisableAutoScroll: false,
  graphDataTableColumnWidths: {},
  graphDataTableFreezeFirstDataColumn: 'none' as GraphDataTableFreezeMode,
  graphDataTableFreezeFirstDataColumnByScope: {
    all: 'none',
    nodes: 'none',
    edges: 'none',
  } as Record<GraphDataTableScope, GraphDataTableFreezeMode>,
  graphDataTableAggregateDefaultVizMode: 'none' as const,
  graphDataTableAggregateIncludeMixedNumericFields: false,
  graphDataTableAggregateIncludeIdAsNumeric: false,
  graphDataTableAggregateIncludeSourceAsNumeric: false,
  graphDataTableAggregateIncludeTargetAsNumeric: false,
  graphDataTableNumericSampleLimit: 100,
  graphDataTableNumericSampleMinCount: 5,
  graphDataTableNumericSampleMinRatio: 0.8,
  spotlightMargin: 8,
  spotlightNearTopThreshold: 96,
  graphDataTableFrozenDragStepNoneLabelPx: 120,
  graphDataTableFrozenDragStepLabelIdPx: 200,
  graphDataTableVirtualOverscanRows: 5,
  graphDataTableOverscanMultiplier: 1.5,
  graphDataTableVirtualMinRows: 10,
  graphDataTableVirtualDebugLogRanges: false,
  graphHoverPreviewConfig: {
    showNodeId: false,
    showNodeName: true,
    showNodeLabel: true,
    showNodeDescription: true,
    showNodeProperties: true,
    showEdgeId: false,
    showEdgeLabel: true,
    showEdgeWeight: true,
    showEdgeProperties: true,
  },
  setGraphHoverPreviewConfig: (config: Partial<GraphHoverPreviewConfig>) =>
    set((state) => ({
      graphHoverPreviewConfig: { ...state.graphHoverPreviewConfig, ...config },
    })),
  graphId: 'default',
  tabId: readInitialSessionTabId(),
  enableTabSync: true,
  enableVirtualTables: true,
  aiKgTraversalRan: false,
  requestAiKgTraversal: false,
  schemaLastExportHash: null as string | null,
  schemaLintCount: null as number | null,
  schemaLintExamplePath: null as string | null,
  schemaLintExamplePaths: null as string[] | null,
  lastTraversalSummary: null as TraversalSummary | null,

  setBottomPanelHeightRatio: (v: number) => set({ bottomPanelHeightRatio: v }),
  setFloatingPanelWidthRatio: (v: number) => set({ floatingPanelWidthRatio: v }),
  setFloatingPanelHeightRatio: (v: number) => set({ floatingPanelHeightRatio: v }),
  setFloatingPanelZIndex: (v: number) => set({ floatingPanelZIndex: v }),
  setBottomPanelTab: (tab: BottomTab) => set({ bottomPanelTab: tab }),
  setFrontmatterModeEnabled: (v: boolean) => {
    const stateNow = get()
    if (v !== true && isFrontmatterOnlyPolicyActive({ canvasRenderMode: stateNow.canvasRenderMode, canvas2dRenderer: stateNow.canvas2dRenderer })) {
      return
    }
    set(state => {
      const nextEnabled = v === true
      const prevEnabled = state.frontmatterModeEnabled === true
      if (nextEnabled === prevEnabled) return {}

      const nextTable = nextEnabled ? false : state.multiDimTableModeEnabled === true

      const prevZoomKey = buildActive2dZoomViewKey({
        canvasRenderMode: state.canvasRenderMode,
        canvas2dRenderer: state.canvas2dRenderer,
        schema: state.schema,
        graphData: (state.graphData as unknown as GraphData | null),
        documentSemanticMode: state.documentSemanticMode,
        frontmatterModeEnabled: prevEnabled,
        multiDimTableModeEnabled: state.multiDimTableModeEnabled === true,
        documentStructureBaselineLock: state.documentStructureBaselineLock,
        renderMediaAsNodes: state.renderMediaAsNodes,
        mediaPanelDensity: state.mediaPanelDensity,
        collapsedGroupIds: state.collapsedGroupIds,
      })
      const nextZoomKey = buildActive2dZoomViewKey({
        canvasRenderMode: state.canvasRenderMode,
        canvas2dRenderer: state.canvas2dRenderer,
        schema: state.schema,
        graphData: (state.graphData as unknown as GraphData | null),
        documentSemanticMode: state.documentSemanticMode,
        frontmatterModeEnabled: nextEnabled,
        multiDimTableModeEnabled: nextTable,
        documentStructureBaselineLock: state.documentStructureBaselineLock,
        renderMediaAsNodes: state.renderMediaAsNodes,
        mediaPanelDensity: state.mediaPanelDensity,
        collapsedGroupIds: state.collapsedGroupIds,
      })
      const prevZoom = prevZoomKey ? state.zoomStateByKey?.[prevZoomKey] ?? null : null
      const nextZoomExists = nextZoomKey ? Boolean(state.zoomStateByKey?.[nextZoomKey]) : false
      const zoomStateByKey =
        prevZoom && nextZoomKey && !nextZoomExists
          ? { ...(state.zoomStateByKey || {}), [nextZoomKey]: prevZoom }
          : state.zoomStateByKey

      const zoomRequest: ZoomRequest | null =
        nextEnabled && state.canvasRenderMode === '2d'
          ? { type: 'fit', intent: 'fitToView', at: Date.now() }
          : null

      return zoomRequest
        ? { frontmatterModeEnabled: nextEnabled, multiDimTableModeEnabled: nextTable, zoomStateByKey, zoomRequest }
        : { frontmatterModeEnabled: nextEnabled, multiDimTableModeEnabled: nextTable, zoomStateByKey }
    })
  },

  setMultiDimTableModeEnabled: (v: boolean) => {
    const stateNow = get()
    if (v === true && isFrontmatterOnlyPolicyActive({ canvasRenderMode: stateNow.canvasRenderMode, canvas2dRenderer: stateNow.canvas2dRenderer })) {
      return
    }
    set(state => {
      const nextEnabled = v === true
      const prevEnabled = state.multiDimTableModeEnabled === true
      if (nextEnabled === prevEnabled) return {}

      const nextFrontmatter = nextEnabled ? false : state.frontmatterModeEnabled === true

      const prevZoomKey = buildActive2dZoomViewKey({
        canvasRenderMode: state.canvasRenderMode,
        canvas2dRenderer: state.canvas2dRenderer,
        schema: state.schema,
        graphData: (state.graphData as unknown as GraphData | null),
        documentSemanticMode: state.documentSemanticMode,
        frontmatterModeEnabled: state.frontmatterModeEnabled,
        multiDimTableModeEnabled: prevEnabled,
        documentStructureBaselineLock: state.documentStructureBaselineLock,
        renderMediaAsNodes: state.renderMediaAsNodes,
        mediaPanelDensity: state.mediaPanelDensity,
        collapsedGroupIds: state.collapsedGroupIds,
      })
      const nextZoomKey = buildActive2dZoomViewKey({
        canvasRenderMode: state.canvasRenderMode,
        canvas2dRenderer: state.canvas2dRenderer,
        schema: state.schema,
        graphData: (state.graphData as unknown as GraphData | null),
        documentSemanticMode: state.documentSemanticMode,
        frontmatterModeEnabled: nextFrontmatter,
        multiDimTableModeEnabled: nextEnabled,
        documentStructureBaselineLock: state.documentStructureBaselineLock,
        renderMediaAsNodes: state.renderMediaAsNodes,
        mediaPanelDensity: state.mediaPanelDensity,
        collapsedGroupIds: state.collapsedGroupIds,
      })
      const prevZoom = prevZoomKey ? state.zoomStateByKey?.[prevZoomKey] ?? null : null
      const nextZoomExists = nextZoomKey ? Boolean(state.zoomStateByKey?.[nextZoomKey]) : false
      const zoomStateByKey =
        prevZoom && nextZoomKey && !nextZoomExists
          ? { ...(state.zoomStateByKey || {}), [nextZoomKey]: prevZoom }
          : state.zoomStateByKey

      const zoomRequest: ZoomRequest | null =
        nextEnabled && state.canvasRenderMode === '2d'
          ? { type: 'fit', intent: 'fitToView', at: Date.now() }
          : null

      return zoomRequest
        ? {
            multiDimTableModeEnabled: nextEnabled,
            frontmatterModeEnabled: nextFrontmatter,
            zoomStateByKey,
            zoomRequest,
          }
        : { multiDimTableModeEnabled: nextEnabled, frontmatterModeEnabled: nextFrontmatter, zoomStateByKey }
    })
  },
  setDocumentSemanticMode: (v: DocumentSemanticMode) => {
    if (get().documentStructureBaselineLock === true) {
      get().upsertUiToast({
        id: 'baseline-locked',
        kind: 'warning',
        message: UI_COPY.baselineLockedToast,
        ttlMs: 6000,
      })
      return
    }
    const stateNow = get()
    const keywordBlockedForRenderer = v === 'keyword' && isFrontmatterOnlyPolicyActive({
      canvasRenderMode: stateNow.canvasRenderMode,
      canvas2dRenderer: stateNow.canvas2dRenderer,
    })
    const nextMode: DocumentSemanticMode = keywordBlockedForRenderer ? 'document' : (v === 'keyword' ? 'keyword' : 'document')
    const prevMode: DocumentSemanticMode = (get().documentSemanticMode || 'document') as DocumentSemanticMode
    if (nextMode === prevMode) return
    let selectionClearedOnSwitch = false
    set(state => {
      const prevSchemaByMode = state.schemaBySemanticMode
      const schemaByMode = {
        document: prevSchemaByMode?.document || state.schema,
        keyword: prevSchemaByMode?.keyword || state.schema,
        [prevMode]: state.schema,
      }
      const nextSchema = schemaByMode[nextMode] || state.schema

      const prevZoomKey = buildActive2dZoomViewKey({
        canvasRenderMode: state.canvasRenderMode,
        canvas2dRenderer: state.canvas2dRenderer,
        schema: state.schema,
        graphData: (state.graphData as unknown as GraphData | null),
        documentSemanticMode: prevMode,
        frontmatterModeEnabled: state.frontmatterModeEnabled,
        documentStructureBaselineLock: state.documentStructureBaselineLock,
        renderMediaAsNodes: state.renderMediaAsNodes,
        mediaPanelDensity: state.mediaPanelDensity,
        collapsedGroupIds: state.collapsedGroupIds,
      })
      const nextZoomKey = buildActive2dZoomViewKey({
        canvasRenderMode: state.canvasRenderMode,
        canvas2dRenderer: state.canvas2dRenderer,
        schema: nextSchema,
        graphData: (state.graphData as unknown as GraphData | null),
        documentSemanticMode: nextMode,
        frontmatterModeEnabled: state.frontmatterModeEnabled,
        documentStructureBaselineLock: state.documentStructureBaselineLock,
        renderMediaAsNodes: state.renderMediaAsNodes,
        mediaPanelDensity: state.mediaPanelDensity,
        collapsedGroupIds: state.collapsedGroupIds,
      })
      const prevZoom = prevZoomKey ? state.zoomStateByKey?.[prevZoomKey] ?? null : null
      const nextZoomExists = nextZoomKey ? Boolean(state.zoomStateByKey?.[nextZoomKey]) : false
      const shouldCopyZoom = true
      const zoomStateByKey =
        shouldCopyZoom && prevZoom && nextZoomKey && !nextZoomExists
          ? { ...(state.zoomStateByKey || {}), [nextZoomKey]: prevZoom }
          : state.zoomStateByKey

      const selectedNodeId = String(state.selectedNodeId || '')
      const selectedEdgeId = String(state.selectedEdgeId || '')
      const selectedGroupId = String(state.selectedGroupId || '')
      const selectedNodeIds = Array.isArray(state.selectedNodeIds) ? state.selectedNodeIds.map(String) : []
      const selectedEdgeIds = Array.isArray(state.selectedEdgeIds) ? state.selectedEdgeIds.map(String) : []
      const selectedGroupIds = Array.isArray(state.selectedGroupIds) ? state.selectedGroupIds.map(String) : []

      const prevHadNodeSelection = Boolean(selectedNodeId) || selectedNodeIds.length > 0
      const prevHadOtherSelection = Boolean(selectedEdgeId || selectedGroupId) || selectedEdgeIds.length > 0 || selectedGroupIds.length > 0

      const baseGraph = state.graphData as unknown as { nodes?: unknown[]; edges?: unknown[] } | null
      const keepSelectedNode = (() => {
        if (!selectedNodeId) return ''
        if (nextMode === 'document') return nodeIdExistsInGraph(baseGraph, selectedNodeId) ? selectedNodeId : ''
        if (nextMode !== 'keyword') return ''
        if (!nodeIdExistsInGraph(baseGraph, selectedNodeId)) return ''
        const nodes = baseGraph && Array.isArray(baseGraph.nodes) ? (baseGraph.nodes as Array<{ id?: unknown; properties?: unknown }>) : []
        for (let i = 0; i < nodes.length; i += 1) {
          const n = nodes[i]
          if (!n) continue
          if (String(n.id || '') !== selectedNodeId) continue
          return nodeHasMediaLikeProps(n) ? selectedNodeId : ''
        }
        return ''
      })()

      const keepSelectedNodeIds = (() => {
        if (keepSelectedNode) return [keepSelectedNode]
        const kept: string[] = []
        if (nextMode === 'document') {
          for (let i = 0; i < selectedNodeIds.length; i += 1) {
            const id = selectedNodeIds[i]!
            if (nodeIdExistsInGraph(baseGraph, id)) kept.push(id)
          }
          return kept
        }
        if (nextMode === 'keyword') {
          for (let i = 0; i < selectedNodeIds.length; i += 1) {
            const id = selectedNodeIds[i]!
            if (!nodeIdExistsInGraph(baseGraph, id)) continue
            const nodes = baseGraph && Array.isArray(baseGraph.nodes) ? (baseGraph.nodes as Array<{ id?: unknown; properties?: unknown }>) : []
            let found = false
            for (let j = 0; j < nodes.length; j += 1) {
              const n = nodes[j]
              if (!n) continue
              if (String(n.id || '') !== id) continue
              if (nodeHasMediaLikeProps(n)) {
                kept.push(id)
              }
              found = true
              break
            }
            if (!found) continue
          }
          return kept
        }
        return []
      })()

      const shouldClearNonNodeSelection = nextMode !== 'document'
      const nextSelectedEdgeId = shouldClearNonNodeSelection ? null : (selectedEdgeId && state.selectedEdgeId)
      const nextSelectedGroupId = shouldClearNonNodeSelection ? null : (selectedGroupId && state.selectedGroupId)
      const nextSelectedEdgeIds = shouldClearNonNodeSelection ? [] : selectedEdgeIds
      const nextSelectedGroupIds = shouldClearNonNodeSelection ? [] : selectedGroupIds

      const disableZoomModes = state.viewPinned !== true && (state.fitToScreenMode === true || state.zoomToSelectionMode === true)

      const nextHadNodeSelection = Boolean(keepSelectedNode) || keepSelectedNodeIds.length > 0
      const nextHadOtherSelection = Boolean(nextSelectedEdgeId || nextSelectedGroupId) || nextSelectedEdgeIds.length > 0 || nextSelectedGroupIds.length > 0
      selectionClearedOnSwitch = (prevHadNodeSelection || prevHadOtherSelection) && !nextHadNodeSelection && !nextHadOtherSelection

      return {
        documentSemanticMode: nextMode,
        schema: nextSchema,
        schemaBySemanticMode: schemaByMode,
        zoomStateByKey,
        fitToScreenMode: disableZoomModes ? false : state.fitToScreenMode,
        zoomToSelectionMode: disableZoomModes ? false : state.zoomToSelectionMode,
        selectedNodeId: keepSelectedNode ? keepSelectedNode : null,
        selectedNodeIds: keepSelectedNodeIds,
        selectedEdgeId: nextSelectedEdgeId ?? null,
        selectedGroupId: nextSelectedGroupId ?? null,
        selectedEdgeIds: nextSelectedEdgeIds,
        selectedGroupIds: nextSelectedGroupIds,
        collapsedGroupIds: nextMode === 'keyword' ? [] : state.collapsedGroupIds,
      } as Partial<GraphState>
    })

    if (selectionClearedOnSwitch) {
      try {
        get().upsertUiToast({
          id: 'selection-cleared-mode',
          kind: 'neutral',
          message: UI_COPY.selectionClearedOnModeSwitchToast,
          ttlMs: 4500,
        })
      } catch {
        void 0
      }
    }
  },
  setKeywordSourceMaxLines: (v: number) => {
    const n = Number.isFinite(v) ? Math.floor(v) : 8000
    const clamped = Math.max(200, Math.min(100_000, n))
    lsSetInt(LS_KEYS.keywordSourceMaxLines, clamped, { min: 200, max: 100_000 })
    set({ keywordSourceMaxLines: clamped })
  },
  setKeywordSourceMaxChars: (v: number) => {
    const n = Number.isFinite(v) ? Math.floor(v) : 120_000
    const clamped = Math.max(10_000, Math.min(2_000_000, n))
    lsSetInt(LS_KEYS.keywordSourceMaxChars, clamped, { min: 10_000, max: 2_000_000 })
    set({ keywordSourceMaxChars: clamped })
  },
  setKeywordGraphPreviewDebounceMs: (v: number) => {
    const n = Number.isFinite(v) ? Math.floor(v) : keywordDefaults.previewDebounceMs
    const clamped = Math.max(0, Math.min(10_000, n))
    lsSetInt(LS_KEYS.keywordGraphPreviewDebounceMs, clamped, { min: 0, max: 10_000 })
    set({ keywordGraphPreviewDebounceMs: clamped })
  },
  setKeywordGraphFullDebounceMs: (v: number) => {
    const n = Number.isFinite(v) ? Math.floor(v) : keywordDefaults.fullDebounceMs
    const clamped = Math.max(0, Math.min(30_000, n))
    lsSetInt(LS_KEYS.keywordGraphFullDebounceMs, clamped, { min: 0, max: 30_000 })
    set({ keywordGraphFullDebounceMs: clamped })
  },
  setKeywordGraphEdgesPerNode: (v: number) => {
    const n = Number.isFinite(v) ? Math.floor(v) : 6
    const clamped = Math.max(1, Math.min(60, n))
    lsSetInt(LS_KEYS.keywordGraphEdgesPerNode, clamped, { min: 1, max: 60 })
    set({ keywordGraphEdgesPerNode: clamped })
  },
  setKeywordGraphMaxEdgesCap: (v: number) => {
    const n = Number.isFinite(v) ? Math.floor(v) : 2400
    const clamped = Math.max(0, Math.min(25_000, n))
    lsSetInt(LS_KEYS.keywordGraphMaxEdgesCap, clamped, { min: 0, max: 25_000 })
    set({ keywordGraphMaxEdgesCap: clamped })
  },
  setKeywordGraphMentionEdgesPerSourceNode: (v: number) => {
    const n = Number.isFinite(v) ? Math.floor(v) : 6
    const clamped = Math.max(0, Math.min(30, n))
    lsSetInt(LS_KEYS.keywordGraphMentionEdgesPerSourceNode, clamped, { min: 0, max: 30 })
    set({ keywordGraphMentionEdgesPerSourceNode: clamped })
  },
  setSchemaDeriveCacheCapacity: (n: number) => set({ schemaDeriveCacheCapacity: n }),
  setGraphFieldSettingsById: (next: GraphFieldSettingsById) =>
    set(state => (state.graphFieldSettingsById === next ? state : { graphFieldSettingsById: next })),
  setSelectedGraphFieldId: (id: GraphFieldId | null) =>
    set(state => (state.selectedGraphFieldId === id ? state : { selectedGraphFieldId: id })),
  setGraphDataTableVisibleColumns: (next: GraphDataTableColumnVisibilityByKey) => set({ graphDataTableVisibleColumns: next }),
  setGraphDataTableColumnOrder: (next: GraphDataTableColumnKey[]) =>
    set({ graphDataTableColumnOrder: Array.from(new Set(next)) as GraphDataTableColumnKey[] }),
  setGraphDataTableAggregateKeys: (next: GraphDataTableColumnKey[]) => set({ graphDataTableAggregateKeys: next }),
  setGraphDataTableFilterMatch: (match: GraphDataTableFilterMatch) => set({ graphDataTableFilterMatch: match }),
  setGraphDataTableFilterClauses: (
    updater: GraphDataTableFilterClause[] | ((prev: GraphDataTableFilterClause[]) => GraphDataTableFilterClause[]),
  ) =>
    set(state => ({
      graphDataTableFilterClauses: typeof updater === 'function' ? updater(state.graphDataTableFilterClauses) : updater,
    })),
  setGraphDataTableSortRules: (
    updater: GraphDataTableSortRule[] | ((prev: GraphDataTableSortRule[]) => GraphDataTableSortRule[]),
  ) =>
    set(state => ({
      graphDataTableSortRules: typeof updater === 'function' ? updater(state.graphDataTableSortRules) : updater,
    })),
  setGraphDataTableGroupKey: (key: GraphDataTableColumnKey | '') => set({ graphDataTableGroupKey: key }),
  setGraphDataTableAutoSortEnabled: (v: boolean) => set({ graphDataTableAutoSortEnabled: v }),
  setGraphDataTableRowDensity: (v: GraphDataTableRowDensity) => set({ graphDataTableRowDensity: v }),
  setGraphDataTableDisableAutoScroll: (v: boolean) => set({ graphDataTableDisableAutoScroll: v }),
  setGraphDataTableColumnWidth: (key: GraphDataTableColumnKey, width: number) =>
    set(state => ({ graphDataTableColumnWidths: { ...state.graphDataTableColumnWidths, [key]: width } })),
  setGraphDataTableFreezeFirstDataColumn: (scope: GraphDataTableScope, v: GraphDataTableFreezeMode) =>
    set(state => ({
      graphDataTableFreezeFirstDataColumn: scope === 'all' ? v : state.graphDataTableFreezeFirstDataColumn,
      graphDataTableFreezeFirstDataColumnByScope: { ...state.graphDataTableFreezeFirstDataColumnByScope, [scope]: v },
    })),
  setGraphDataTableAggregateDefaultVizMode: (v: 'none' | 'radial' | 'bars' | 'sparkline') =>
    set({ graphDataTableAggregateDefaultVizMode: v }),
  setGraphDataTableAggregateIncludeMixedNumericFields: (v: boolean) =>
    set({ graphDataTableAggregateIncludeMixedNumericFields: v }),
  setGraphDataTableAggregateIncludeIdAsNumeric: (v: boolean) => set({ graphDataTableAggregateIncludeIdAsNumeric: v }),
  setGraphDataTableAggregateIncludeSourceAsNumeric: (v: boolean) => set({ graphDataTableAggregateIncludeSourceAsNumeric: v }),
  setGraphDataTableAggregateIncludeTargetAsNumeric: (v: boolean) => set({ graphDataTableAggregateIncludeTargetAsNumeric: v }),
  setGraphDataTableNumericSampleLimit: (v: number) => set({ graphDataTableNumericSampleLimit: v }),
  setGraphDataTableNumericSampleMinCount: (v: number) => set({ graphDataTableNumericSampleMinCount: v }),
  setGraphDataTableNumericSampleMinRatio: (v: number) => set({ graphDataTableNumericSampleMinRatio: v }),
  setGraphDataTableFrozenDragStepNoneLabelPx: (v: number) => set({ graphDataTableFrozenDragStepNoneLabelPx: v }),
  setGraphDataTableFrozenDragStepLabelIdPx: (v: number) => set({ graphDataTableFrozenDragStepLabelIdPx: v }),
  setGraphDataTableVirtualOverscanRows: (v: number) => set({ graphDataTableVirtualOverscanRows: v }),
  setGraphDataTableOverscanMultiplier: (v: number) => set({ graphDataTableOverscanMultiplier: v }),
  setGraphDataTableVirtualMinRows: (v: number) => set({ graphDataTableVirtualMinRows: v }),
  setGraphDataTableVirtualDebugLogRanges: (v: boolean) => set({ graphDataTableVirtualDebugLogRanges: v }),
  setSelectionFlashDurationMs: (v: number) => {
    const n = Number.isFinite(v) ? Number(v) : 500;
    const clamped = n < 100 ? 100 : n > 2000 ? 2000 : n;
    set({ selectionFlashDurationMs: clamped });
  },
  setSelectionFlashOpacity: (v: number) => {
    const n = Number.isFinite(v) ? Number(v) : 0.18;
    const clamped = n < 0 ? 0 : n > 1 ? 1 : n;
    set({ selectionFlashOpacity: clamped });
  },
  setMarkdownSelectionFlashMode: (v: 'auto' | 'manual') => set({ markdownSelectionFlashMode: v }),

  setSpotlightMargin: (v: number) => {
    const n = Number.isFinite(v) ? Number(v) : 8;
    set({ spotlightMargin: n >= 0 ? n : 0 });
  },
  setSpotlightNearTopThreshold: (v: number) => {
    const n = Number.isFinite(v) ? Number(v) : 96;
    set({ spotlightNearTopThreshold: n >= 0 ? n : 0 });
  },
  setGraphId: (id: string) => set({ graphId: id }),
  setEnableTabSync: (v: boolean) => set({ enableTabSync: v }),
  setEnableVirtualTables: (v: boolean) => set({ enableVirtualTables: v }),
  setAiKgTraversalRan: (v: boolean) => set({ aiKgTraversalRan: !!v }),
  setRequestAiKgTraversal: (v: boolean) => set({ requestAiKgTraversal: !!v }),
  setLastTraversalSummary: (summary: TraversalSummary | null) => {
    const next = summary || null;
    set({ lastTraversalSummary: next });
  },
  youtubeTranscriptOutputDir: '.knowgrph-workspace/youtube-transcripts',
  setYoutubeTranscriptOutputDir: (v: string | null) => set({ youtubeTranscriptOutputDir: v }),

  youtubeTranscriptOutputFormat: 'markdown' as const,
  setYoutubeTranscriptOutputFormat: (v: 'markdown' | 'json') => set({ youtubeTranscriptOutputFormat: v }),

  webpageImportIncludeImages: true,
  setWebpageImportIncludeImages: (v: boolean) => set({ webpageImportIncludeImages: v }),

  webpageImportView: 'html' as const,
  setWebpageImportView: (v: 'markdown' | 'json' | 'html') => set({ webpageImportView: v }),

  webpageViewerScriptPolicy: 'allow' as const,
  setWebpageViewerScriptPolicy: (v: 'strip' | 'allow') => set({ webpageViewerScriptPolicy: v === 'allow' ? 'allow' : 'strip' }),

  webpageArtifactFidelityMaxLevel: 4,
  setWebpageArtifactFidelityMaxLevel: (v: number) => {
    const n = Number.isFinite(v) ? Math.floor(Number(v)) : 4
    set({ webpageArtifactFidelityMaxLevel: n < 1 ? 1 : n > 4 ? 4 : n })
  },

  websiteImportDiscoverSitemap: true,
  setWebsiteImportDiscoverSitemap: (v: boolean) => set({ websiteImportDiscoverSitemap: !!v }),

  websiteImportGenerateWebpageArtifactDocs: false,
  setWebsiteImportGenerateWebpageArtifactDocs: (v: boolean) => set({ websiteImportGenerateWebpageArtifactDocs: !!v }),

  websiteImportMaxPages: 50,
  setWebsiteImportMaxPages: (v: number) => {
    const n = Number.isFinite(v) ? Math.floor(Number(v)) : 50
    set({ websiteImportMaxPages: n < 1 ? 1 : n > 500 ? 500 : n })
  },

  websiteImportConcurrency: 4,
  setWebsiteImportConcurrency: (v: number) => {
    const n = Number.isFinite(v) ? Math.floor(Number(v)) : 4
    set({ websiteImportConcurrency: n < 1 ? 1 : n > 12 ? 12 : n })
  },

  websiteImportOutputDirRel: '.knowgrph-workspace/website-imports',
  setWebsiteImportOutputDirRel: (v: string) => set({ websiteImportOutputDirRel: String(v || '').trim() }),

  setPdfImportIncludeImages: (v: boolean) => set({ pdfImportIncludeImages: v }),
});
}
