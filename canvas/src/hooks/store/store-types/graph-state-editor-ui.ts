import type { GraphData, GraphNode, GraphEdge, JSONValue } from '@/lib/graph/types'
import type { GraphSchema, GraphBehavior, PropertySpec } from '@/lib/graph/schema'
import type { ThemeMode, ResolvedThemeMode } from '@/lib/ui/theme'
import type { GraphFieldId, GraphFieldSettings, GraphFieldSettingsById } from '@/features/graph-fields/graphFields'
import type {
  GraphDataTableRowDensity,
} from '@/features/graph-data-table/graphDataTable'
import type { TraversalSummary } from '@/features/panels/utils/orchestratorTraversal'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import type { MarkdownViewerMediaMode } from '@/features/markdown/ui/MarkdownRendererTypes'
import type { MarkdownFrontmatter } from '@/lib/markdown'
import type { ZoomCommandType, ZoomFitIntent, ZoomRequest } from '@/lib/zoom/requests'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import type { Canvas2dRendererId, Canvas3dModeId, CanvasWorkspaceSyncMode, InfiniteCanvasInteractionMode } from '@/lib/config'
import type { DesignLayerNode, DesignLayerState } from '@/features/design/designLayersState'
import type { DesignFramePos, DesignFrameSize } from '@/hooks/store/designRendererSlice'
import type { SaveFilePickerHandle } from '@/lib/graph/save'
import type {
  BottomSurfaceTab,
  CanvasSnapshotFns,
  ChatExchangeLogEntry,
  ChatExchangeLogEntryInput,
  DesignSystemPageId,
  DocumentSemanticMode,
  DocumentStructureBaselineSnapshot,
  EditorWorkspacePane,
  GraphDataTableFreezeMode,
  GraphDataTableScope,
  GraphHoverPreviewConfig,
  LayoutPositionCacheKey,
  LocalMarkdownFolderAccessMode,
  MonacoCapabilityLoadMode,
  NodePosition2d,
  PdfImportOcrMode,
  PdfImportProvider,
  RecentFileEntry,
  SchemaBySemanticMode,
  SourceFile,
  ThreeCameraPose,
  ThreeCameraSnapshotFns,
  ThreeGlbSnapshotFns,
  ThreeLayoutSnapshotFns,
  UiLogEntry,
  UiLogEntryInput,
  UiToast,
  UiToastInput,
  WorkspaceViewMode,
} from './core'

export type StoryboardCardAspectMode = '16:9' | '9:16'
export type StoryboardBoardLayoutMode = 'flex' | 'fixed'

export interface GraphStateEditorUi {
  codeHighlightDurationMs: number;
  codeSelectThrottleMs: number;
  codeHighlightUntilClick: boolean;
  setCodeHighlightDurationMs: (ms: number) => void;
  setCodeSelectThrottleMs: (ms: number) => void;
  setCodeHighlightUntilClick: (v: boolean) => void;
  uiPanelKeyValueTextSizeClass: string;
  uiPanelTextFontClass: string;
  uiPanelKeyValueInputClass: string;
  uiPanelRowDensityDefaultClass: string;
  uiPanelRowDensityCompactClass: string;
  uiPanelMonospaceTextClass: string;
  uiPanelMicroLabelTextSizeClass: string;
  renderMediaAsNodes: boolean;
  setRenderMediaAsNodes: (v: boolean) => void;
  markdownViewerMediaMode: MarkdownViewerMediaMode;
  setMarkdownViewerMediaMode: (v: MarkdownViewerMediaMode) => void;
  timelineEnabled: boolean;
  setTimelineEnabled: (v: boolean) => void;
  setMediaPanelDensity: (v: 'default' | 'compact') => void;
  mediaPanelDensity: 'default' | 'compact';
  strybldrStoryboardCardAspectMode: StoryboardCardAspectMode;
  setStrybldrStoryboardCardAspectMode: (v: StoryboardCardAspectMode) => void;
  strybldrStoryboardBoardLayoutMode: StoryboardBoardLayoutMode;
  setStrybldrStoryboardBoardLayoutMode: (v: StoryboardBoardLayoutMode) => void;
  monacoLanguageJsonEnabled: boolean;
  setMonacoLanguageJsonEnabled: (v: boolean) => void;
  monacoLanguageJsonLoadMode: MonacoCapabilityLoadMode;
  setMonacoLanguageJsonLoadMode: (v: MonacoCapabilityLoadMode) => void;
  monacoLanguageSqlEnabled: boolean;
  setMonacoLanguageSqlEnabled: (v: boolean) => void;
  monacoLanguageSqlLoadMode: MonacoCapabilityLoadMode;
  setMonacoLanguageSqlLoadMode: (v: MonacoCapabilityLoadMode) => void;
  monacoLanguageYamlEnabled: boolean;
  setMonacoLanguageYamlEnabled: (v: boolean) => void;
  monacoLanguageYamlLoadMode: MonacoCapabilityLoadMode;
  setMonacoLanguageYamlLoadMode: (v: MonacoCapabilityLoadMode) => void;
  monacoWorkerJsonEnabled: boolean;
  setMonacoWorkerJsonEnabled: (v: boolean) => void;
  monacoWorkerJsonLoadMode: MonacoCapabilityLoadMode;
  setMonacoWorkerJsonLoadMode: (v: MonacoCapabilityLoadMode) => void;
  monacoHoverEnabled: boolean;
  setMonacoHoverEnabled: (v: boolean) => void;
  monacoLinksEnabled: boolean;
  setMonacoLinksEnabled: (v: boolean) => void;
  monacoQuickSuggestionsEnabled: boolean;
  setMonacoQuickSuggestionsEnabled: (v: boolean) => void;
  monacoSuggestOnTriggerCharactersEnabled: boolean;
  setMonacoSuggestOnTriggerCharactersEnabled: (v: boolean) => void;
  monacoParameterHintsEnabled: boolean;
  setMonacoParameterHintsEnabled: (v: boolean) => void;
  monacoLineNumbersEnabled: boolean;
  setMonacoLineNumbersEnabled: (v: boolean) => void;
  monacoFoldingEnabled: boolean;
  setMonacoFoldingEnabled: (v: boolean) => void;
  monacoMinimapEnabled: boolean;
  setMonacoMinimapEnabled: (v: boolean) => void;
  monacoSelectionHighlightEnabled: boolean;
  setMonacoSelectionHighlightEnabled: (v: boolean) => void;
  monacoOccurrencesHighlightEnabled: boolean;
  setMonacoOccurrencesHighlightEnabled: (v: boolean) => void;
  monacoGuidesEnabled: boolean;
  setMonacoGuidesEnabled: (v: boolean) => void;
  monacoBracketPairColorizationEnabled: boolean;
  setMonacoBracketPairColorizationEnabled: (v: boolean) => void;
  monacoCodeLensEnabled: boolean;
  setMonacoCodeLensEnabled: (v: boolean) => void;
  monacoLightbulbEnabled: boolean;
  setMonacoLightbulbEnabled: (v: boolean) => void;
  monacoInlayHintsEnabled: boolean;
  setMonacoInlayHintsEnabled: (v: boolean) => void;
  monacoWordBasedSuggestionsEnabled: boolean;
  setMonacoWordBasedSuggestionsEnabled: (v: boolean) => void;
  monacoInlineSuggestEnabled: boolean;
  setMonacoInlineSuggestEnabled: (v: boolean) => void;
  monacoAcceptSuggestionOnEnterEnabled: boolean;
  setMonacoAcceptSuggestionOnEnterEnabled: (v: boolean) => void;
  monacoDragAndDropEnabled: boolean;
  setMonacoDragAndDropEnabled: (v: boolean) => void;
  monacoDropIntoEditorEnabled: boolean;
  setMonacoDropIntoEditorEnabled: (v: boolean) => void;
  monacoColorDecoratorsEnabled: boolean;
  setMonacoColorDecoratorsEnabled: (v: boolean) => void;
  monacoUnicodeHighlightEnabled: boolean;
  setMonacoUnicodeHighlightEnabled: (v: boolean) => void;
  monacoMatchBracketsEnabled: boolean;
  setMonacoMatchBracketsEnabled: (v: boolean) => void;
  monacoRenderLineHighlightEnabled: boolean;
  setMonacoRenderLineHighlightEnabled: (v: boolean) => void;
  monacoGlyphMarginEnabled: boolean;
  setMonacoGlyphMarginEnabled: (v: boolean) => void;
  monacoOverviewRulerLanesEnabled: boolean;
  setMonacoOverviewRulerLanesEnabled: (v: boolean) => void;
  monacoLineDecorationsWidthEnabled: boolean;
  setMonacoLineDecorationsWidthEnabled: (v: boolean) => void;
  monacoRenderWhitespaceEnabled: boolean;
  setMonacoRenderWhitespaceEnabled: (v: boolean) => void;
  monacoRenderControlCharactersEnabled: boolean;
  setMonacoRenderControlCharactersEnabled: (v: boolean) => void;
  monacoSmoothScrollingEnabled: boolean;
  setMonacoSmoothScrollingEnabled: (v: boolean) => void;
  monacoScrollBeyondLastLineEnabled: boolean;
  setMonacoScrollBeyondLastLineEnabled: (v: boolean) => void;
  monacoMouseWheelZoomEnabled: boolean;
  setMonacoMouseWheelZoomEnabled: (v: boolean) => void;
  monacoCursorBlinkingEnabled: boolean;
  setMonacoCursorBlinkingEnabled: (v: boolean) => void;
  monacoCursorSmoothCaretAnimationEnabled: boolean;
  setMonacoCursorSmoothCaretAnimationEnabled: (v: boolean) => void;
  monacoWordWrapEnabled: boolean;
  setMonacoWordWrapEnabled: (v: boolean) => void;
  monacoWrappingIndentEnabled: boolean;
  setMonacoWrappingIndentEnabled: (v: boolean) => void;
  monacoWrappingStrategyEnabled: boolean;
  setMonacoWrappingStrategyEnabled: (v: boolean) => void;
  monacoCursorWidthEnabled: boolean;
  setMonacoCursorWidthEnabled: (v: boolean) => void;
  monacoCursorStyleEnabled: boolean;
  setMonacoCursorStyleEnabled: (v: boolean) => void;
  monacoCursorSurroundingLinesEnabled: boolean;
  setMonacoCursorSurroundingLinesEnabled: (v: boolean) => void;
  monacoCursorSurroundingLinesStyleEnabled: boolean;
  setMonacoCursorSurroundingLinesStyleEnabled: (v: boolean) => void;
  monacoCursorHeightEnabled: boolean;
  setMonacoCursorHeightEnabled: (v: boolean) => void;
  monacoStickyScrollEnabled: boolean;
  setMonacoStickyScrollEnabled: (v: boolean) => void;
  monacoSelectionClipboardEnabled: boolean;
  setMonacoSelectionClipboardEnabled: (v: boolean) => void;
  monacoCopyWithSyntaxHighlightingEnabled: boolean;
  setMonacoCopyWithSyntaxHighlightingEnabled: (v: boolean) => void;
  monacoOccurrencesHighlightDelayEnabled: boolean;
  setMonacoOccurrencesHighlightDelayEnabled: (v: boolean) => void;
  monacoFormatOnPasteEnabled: boolean;
  setMonacoFormatOnPasteEnabled: (v: boolean) => void;
  monacoFormatOnTypeEnabled: boolean;
  setMonacoFormatOnTypeEnabled: (v: boolean) => void;
  monacoAutoClosingBracketsEnabled: boolean;
  setMonacoAutoClosingBracketsEnabled: (v: boolean) => void;
  monacoAutoClosingQuotesEnabled: boolean;
  setMonacoAutoClosingQuotesEnabled: (v: boolean) => void;
  monacoAutoIndentEnabled: boolean;
  setMonacoAutoIndentEnabled: (v: boolean) => void;
  monacoAutoSurroundEnabled: boolean;
  setMonacoAutoSurroundEnabled: (v: boolean) => void;
  monacoMatchOnWordStartOnlyEnabled: boolean;
  setMonacoMatchOnWordStartOnlyEnabled: (v: boolean) => void;
  monacoFindSeedSearchStringFromSelectionEnabled: boolean;
  setMonacoFindSeedSearchStringFromSelectionEnabled: (v: boolean) => void;
  monacoFindCursorMoveOnTypeEnabled: boolean;
  setMonacoFindCursorMoveOnTypeEnabled: (v: boolean) => void;
  monacoFindFindOnTypeEnabled: boolean;
  setMonacoFindFindOnTypeEnabled: (v: boolean) => void;
  monacoFindLoopEnabled: boolean;
  setMonacoFindLoopEnabled: (v: boolean) => void;
  monacoAutoClosingDeleteEnabled: boolean;
  setMonacoAutoClosingDeleteEnabled: (v: boolean) => void;
  monacoAutoClosingCommentsEnabled: boolean;
  setMonacoAutoClosingCommentsEnabled: (v: boolean) => void;
  monacoEmptySelectionClipboardEnabled: boolean;
  setMonacoEmptySelectionClipboardEnabled: (v: boolean) => void;
  monacoColumnSelectionEnabled: boolean;
  setMonacoColumnSelectionEnabled: (v: boolean) => void;
  monacoWordSeparatorsEnabled: boolean;
  setMonacoWordSeparatorsEnabled: (v: boolean) => void;
  monacoMultiCursorModifierEnabled: boolean;
  setMonacoMultiCursorModifierEnabled: (v: boolean) => void;
  monacoMultiCursorMergeOverlappingEnabled: boolean;
  setMonacoMultiCursorMergeOverlappingEnabled: (v: boolean) => void;
  monacoMultiCursorPasteEnabled: boolean;
  setMonacoMultiCursorPasteEnabled: (v: boolean) => void;
  monacoAutoClosingOvertypeEnabled: boolean;
  setMonacoAutoClosingOvertypeEnabled: (v: boolean) => void;
  monacoMouseStyleEnabled: boolean;
  setMonacoMouseStyleEnabled: (v: boolean) => void;
  monacoRenderFinalNewlineEnabled: boolean;
  setMonacoRenderFinalNewlineEnabled: (v: boolean) => void;
  monacoAccessibilitySupportEnabled: boolean;
  setMonacoAccessibilitySupportEnabled: (v: boolean) => void;
  monacoScrollbarUseShadowsEnabled: boolean;
  setMonacoScrollbarUseShadowsEnabled: (v: boolean) => void;
  monacoScrollbarAlwaysConsumeMouseWheelEnabled: boolean;
  setMonacoScrollbarAlwaysConsumeMouseWheelEnabled: (v: boolean) => void;
  monacoHorizontalScrollbarSizeEnabled: boolean;
  setMonacoHorizontalScrollbarSizeEnabled: (v: boolean) => void;
  monacoVerticalScrollbarSizeEnabled: boolean;
  setMonacoVerticalScrollbarSizeEnabled: (v: boolean) => void;
  monacoMouseWheelScrollSensitivityEnabled: boolean;
  setMonacoMouseWheelScrollSensitivityEnabled: (v: boolean) => void;
  threeIframeOverlayPoolMax: number;
  setThreeIframeOverlayPoolMax: (v: number) => void;
  richMediaPanelMode: 'snapshot' | 'embed';
  setRichMediaPanelMode: (v: 'snapshot' | 'embed') => void;
}
