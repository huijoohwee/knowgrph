import {
  LS_KEYS,
  LS_KEY_VIEWPORT_LAST,
  LS_KEY_VIEWPORT_PINNED,
  SESSION_KEYS,
  STORAGE_CHANNELS,
} from './config.ls.keys'

export {
  LS_KEYS,
  LS_KEY_VIEWPORT_LAST,
  LS_KEY_VIEWPORT_PINNED,
  SESSION_KEYS,
  STORAGE_CHANNELS,
} from './config.ls.keys'

export type LsKeyId = keyof typeof LS_KEYS;
export type LsStorageKey =
  | (typeof LS_KEYS)[LsKeyId]
  | SchemaSubsectionStorageKey
  | ChatHistoryStorageKey
  | MarkdownCollapsedHeadingIdsStorageKey
  | MarkdownDataViewConfigStorageKey;

export type SchemaSubsectionStorageKeyPrefix = (typeof LS_KEYS)['schemaSubsectionPrefix'];
export type SchemaSubsectionStorageKey = `${SchemaSubsectionStorageKeyPrefix}${string}`;

export const getSchemaSubsectionStorageKey = (slug: string): SchemaSubsectionStorageKey =>
  `${LS_KEYS.schemaSubsectionPrefix}${String(slug ?? '')}` as SchemaSubsectionStorageKey;

export type ChatHistoryStorageKeyPrefix = (typeof LS_KEYS)['chatHistoryPrefix'];
export type ChatHistoryStorageKey = `${ChatHistoryStorageKeyPrefix}${string}`;

export const getChatHistoryStorageKey = (graphSignature: string): ChatHistoryStorageKey =>
  `${LS_KEYS.chatHistoryPrefix}${String(graphSignature ?? '')}` as ChatHistoryStorageKey;

export type MarkdownCollapsedHeadingIdsStorageKeyPrefix = (typeof LS_KEYS)['markdownCollapsedHeadingIds'];
export type MarkdownCollapsedHeadingIdsStorageKey = `${MarkdownCollapsedHeadingIdsStorageKeyPrefix}:${string}`;

export type MarkdownDataViewConfigStorageKeyPrefix = (typeof LS_KEYS)['markdownDataViewConfigPrefix'];
export type MarkdownDataViewConfigStorageKey = `${MarkdownDataViewConfigStorageKeyPrefix}${string}`;

export const getMarkdownCollapsedHeadingIdsStorageKey = (scopeKey: string): MarkdownCollapsedHeadingIdsStorageKey =>
  `${LS_KEYS.markdownCollapsedHeadingIds}:${String(scopeKey ?? '')}` as MarkdownCollapsedHeadingIdsStorageKey;

export const getMarkdownDataViewConfigStorageKey = (scopeKey: string): MarkdownDataViewConfigStorageKey =>
  `${LS_KEYS.markdownDataViewConfigPrefix}${String(scopeKey ?? '')}` as MarkdownDataViewConfigStorageKey;

export type LsKeyOwner =
  | 'ui.overlayOpacity'
  | 'ui.panelOpacity'
  | 'ui.toolbarOpacity'
  | 'ui.icons'
  | 'ui.bottomPanel'
  | 'ui.mainPanel'
  | 'ui.floatingPanel'
  | 'ui.sidebar'
  | 'ui.baseline'
  | 'ui.geospatial'
  | 'ui.preview'
  | 'parsers.treeSitter'
  | 'graphragText.analytics'
  | 'semantic.keyword'
  | 'data.graph'
  | 'schema.graph'
  | 'graphFields.settings'
  | 'curation.spreadsheet'
  | 'graphDataTable'
  | 'schema.deriveCache'
  | 'ui.launchSpotlight'
  | 'orchestrator.prefs'
  | 'render.prefs'
  | 'ui.statusPanelPinned'
  | 'ui.onboardingSpotlight'
  | 'ui.startup'
  | 'settings.collapsedByArea'
  | 'parsers.panel'
  | 'parsers.editor'
  | 'ui.theme'
  | 'export.prefs'
  | 'bottomPanel.collapsed'
  | 'parsers.custom'
  | 'ui.launchSpotlightDismissed'
  | 'workflow.presets'
  | 'schema.subsections'
  | 'schema.ui'
  | 'ui.chat'
  | 'ui.workspace'
  | 'ui.monaco'
  | 'import.pdf';


export const LS_KEY_OWNERS: Record<LsKeyId, LsKeyOwner> = {
  overlayOpacity: 'ui.overlayOpacity',
  panelOpacity: 'ui.panelOpacity',
  toolbarOpacity: 'ui.toolbarOpacity',
  iconScale: 'ui.icons',
  iconFormat: 'ui.icons',
  iconStrokeWidth: 'ui.icons',
  iconColorClass: 'ui.icons',
  iconHoverBgClass: 'ui.icons',
  iconPillLegendTextSizeClass: 'ui.icons',
  iconPillBadgeTextSizeClass: 'ui.icons',
  iconPillClass: 'ui.icons',
  iconBadgeChipClass: 'ui.icons',
  iconBadgeChipTextSizeClass: 'ui.icons',
  iconButtonPadding: 'ui.icons',
  iconAnimationEnabled: 'ui.icons',
  panelKeyValueTextSizeClass: 'ui.icons',
  panelTextFontClass: 'ui.icons',
  panelKeyValueInputClass: 'ui.icons',
  panelRowDensityDefaultClass: 'ui.icons',
  panelRowDensityCompactClass: 'ui.icons',
  panelMonospaceTextClass: 'ui.icons',
  panelMicroLabelTextSizeClass: 'ui.icons',
  headerRowHeightClass: 'ui.icons',
  headerRowPaddingClass: 'ui.icons',
  sectionHeaderRowHeightClass: 'ui.icons',
  sectionHeaderRowPaddingClass: 'ui.icons',
  bottomPanelHeight: 'ui.bottomPanel',
  minimapCollapsed: 'ui.bottomPanel',
  markdownWordWrap: 'ui.bottomPanel',
  markdownPresentationMode: 'ui.bottomPanel',
  markdownLayoutMode: 'ui.bottomPanel',
  markdownViewerWidthMode: 'ui.bottomPanel',
  markdownDerivedViewerKind: 'ui.bottomPanel',
  markdownDerivedViewerMode: 'ui.bottomPanel',
  bipartiteApiRunId: 'render.prefs',
  workspaceEditorMode: 'ui.workspace',
  monacoLanguageJsonEnabled: 'ui.monaco',
  monacoLanguageJsonLoadMode: 'ui.monaco',
  monacoLanguageSqlEnabled: 'ui.monaco',
  monacoLanguageSqlLoadMode: 'ui.monaco',
  monacoLanguageYamlEnabled: 'ui.monaco',
  monacoLanguageYamlLoadMode: 'ui.monaco',
  monacoWorkerJsonEnabled: 'ui.monaco',
  monacoWorkerJsonLoadMode: 'ui.monaco',
  monacoHoverEnabled: 'ui.monaco',
  monacoLinksEnabled: 'ui.monaco',
  monacoQuickSuggestionsEnabled: 'ui.monaco',
  monacoSuggestOnTriggerCharactersEnabled: 'ui.monaco',
  monacoParameterHintsEnabled: 'ui.monaco',
  monacoLineNumbersEnabled: 'ui.monaco',
  monacoFoldingEnabled: 'ui.monaco',
  monacoMinimapEnabled: 'ui.monaco',
  monacoSelectionHighlightEnabled: 'ui.monaco',
  monacoOccurrencesHighlightEnabled: 'ui.monaco',
  monacoGuidesEnabled: 'ui.monaco',
  monacoBracketPairColorizationEnabled: 'ui.monaco',
  monacoCodeLensEnabled: 'ui.monaco',
  monacoLightbulbEnabled: 'ui.monaco',
  monacoInlayHintsEnabled: 'ui.monaco',
  monacoWordBasedSuggestionsEnabled: 'ui.monaco',
  monacoInlineSuggestEnabled: 'ui.monaco',
  monacoAcceptSuggestionOnEnterEnabled: 'ui.monaco',
  monacoDragAndDropEnabled: 'ui.monaco',
  monacoDropIntoEditorEnabled: 'ui.monaco',
  monacoColorDecoratorsEnabled: 'ui.monaco',
  monacoUnicodeHighlightEnabled: 'ui.monaco',
  monacoMatchBracketsEnabled: 'ui.monaco',
  monacoRenderLineHighlightEnabled: 'ui.monaco',
  monacoGlyphMarginEnabled: 'ui.monaco',
  monacoOverviewRulerLanesEnabled: 'ui.monaco',
  monacoLineDecorationsWidthEnabled: 'ui.monaco',
  monacoRenderWhitespaceEnabled: 'ui.monaco',
  monacoRenderControlCharactersEnabled: 'ui.monaco',
  monacoSmoothScrollingEnabled: 'ui.monaco',
  monacoScrollBeyondLastLineEnabled: 'ui.monaco',
  monacoMouseWheelZoomEnabled: 'ui.monaco',
  monacoCursorBlinkingEnabled: 'ui.monaco',
  monacoCursorSmoothCaretAnimationEnabled: 'ui.monaco',
  monacoWordWrapEnabled: 'ui.monaco',
  monacoWrappingIndentEnabled: 'ui.monaco',
  monacoWrappingStrategyEnabled: 'ui.monaco',
  monacoCursorWidthEnabled: 'ui.monaco',
  monacoCursorStyleEnabled: 'ui.monaco',
  monacoCursorSurroundingLinesEnabled: 'ui.monaco',
  monacoCursorSurroundingLinesStyleEnabled: 'ui.monaco',
  monacoCursorHeightEnabled: 'ui.monaco',
  monacoStickyScrollEnabled: 'ui.monaco',
  monacoSelectionClipboardEnabled: 'ui.monaco',
  monacoCopyWithSyntaxHighlightingEnabled: 'ui.monaco',
  monacoOccurrencesHighlightDelayEnabled: 'ui.monaco',
  monacoFormatOnPasteEnabled: 'ui.monaco',
  monacoFormatOnTypeEnabled: 'ui.monaco',
  monacoAutoClosingBracketsEnabled: 'ui.monaco',
  monacoAutoClosingQuotesEnabled: 'ui.monaco',
  monacoAutoIndentEnabled: 'ui.monaco',
  monacoAutoSurroundEnabled: 'ui.monaco',
  monacoMatchOnWordStartOnlyEnabled: 'ui.monaco',
  monacoFindSeedSearchStringFromSelectionEnabled: 'ui.monaco',
  monacoFindCursorMoveOnTypeEnabled: 'ui.monaco',
  monacoFindFindOnTypeEnabled: 'ui.monaco',
  monacoFindLoopEnabled: 'ui.monaco',
  monacoAutoClosingDeleteEnabled: 'ui.monaco',
  monacoAutoClosingCommentsEnabled: 'ui.monaco',
  monacoEmptySelectionClipboardEnabled: 'ui.monaco',
  monacoColumnSelectionEnabled: 'ui.monaco',
  monacoWordSeparatorsEnabled: 'ui.monaco',
  monacoMultiCursorModifierEnabled: 'ui.monaco',
  monacoMultiCursorMergeOverlappingEnabled: 'ui.monaco',
  monacoMultiCursorPasteEnabled: 'ui.monaco',
  monacoAutoClosingOvertypeEnabled: 'ui.monaco',
  markdownDataViewConfigPrefix: 'ui.bottomPanel',
  markdownTextHighlight: 'ui.bottomPanel',
  markdownSelectionFlashMode: 'ui.bottomPanel',
  markdownAnnotateDisplay: 'ui.bottomPanel',
  markdownSyncScroll: 'ui.bottomPanel',
  markdownSidebarOpen: 'ui.bottomPanel',
  markdownSidebarWidthPx: 'ui.bottomPanel',
  markdownExplorerSourceFilesCollapsed: 'ui.sidebar',
  markdownExplorerSourceFilesExpandedPaths: 'ui.sidebar',
  markdownExplorerOutlineCollapsed: 'ui.sidebar',
  markdownExplorerBacklinksCollapsed: 'ui.sidebar',
  markdownExplorerFolderModeContract: 'ui.sidebar',
  markdownExplorerActivePath: 'ui.sidebar',
  markdownWorkspaceSourcesByPath: 'ui.bottomPanel',
  markdownWorkspaceSeeded: 'ui.bottomPanel',
  markdownWorkspaceUserClearedAllFiles: 'ui.bottomPanel',
  markdownCollapsedHeadingIds: 'ui.bottomPanel',
  jsonMarkdownMode: 'ui.bottomPanel',
  jsonMarkdownTableMaxRows: 'ui.bottomPanel',
  jsonMarkdownTableMaxColumns: 'ui.bottomPanel',
  jsonImportWorkspaceTarget: 'ui.workspace',
  pdfWorkspaceOutputDirRel: 'import.pdf',
  previewZoomPanMermaid: 'ui.preview',
  previewZoomPanSlides: 'ui.preview',
  previewSlidesShowThumbnails: 'ui.preview',
  previewSlidesShowNotes: 'ui.preview',
  floatingPanelPinned: 'ui.floatingPanel',
  hoverTooltipPinned: 'ui.floatingPanel',
  floatingPanelWidthRatio: 'ui.floatingPanel',
  floatingPanelHeightRatio: 'ui.floatingPanel',
  floatingPanelZIndex: 'ui.floatingPanel',
  flowNodeQuickEditorPinnedByNodeId: 'ui.floatingPanel',
  flowNodeQuickEditorPinnedSemanticsVersion: 'ui.floatingPanel',
  flowNodeQuickEditorMinimized: 'ui.floatingPanel',
  flowNodeQuickEditorHideFields: 'ui.floatingPanel',
  flowNodeQuickEditorPosByNodeId: 'ui.floatingPanel',
  flowNodeQuickEditorWorldPosByNodeId: 'ui.floatingPanel',
  flowNodeQuickEditorPinnedByGraphMetaKey: 'ui.floatingPanel',
  flowNodeQuickEditorPosByGraphMetaKey: 'ui.floatingPanel',
  flowNodeQuickEditorWorldPosByGraphMetaKey: 'ui.floatingPanel',
  flowEditorManagerNodeQuickEditorRegistry: 'ui.mainPanel',
  flowEditorManagerNodeSpec: 'ui.mainPanel',
  flowEditorManagerWorkflowSpec: 'ui.mainPanel',
  geospatialOverlayEnabled: 'ui.geospatial',
  geospatialAutoEnableOnGeoImport: 'ui.geospatial',
  orchestratorTraversalDelayMs: 'orchestrator.prefs',
  orchestratorTraversalLegendGraphRagMaxFull: 'orchestrator.prefs',
  orchestratorTraversalLegendGraphRagHead: 'orchestrator.prefs',
  orchestratorTraversalLegendGenericMaxFull: 'orchestrator.prefs',
  orchestratorTraversalLegendGenericHead: 'orchestrator.prefs',
  orchestratorTraversalLegendTail: 'orchestrator.prefs',
  orchestratorGraphRagCollapsed: 'orchestrator.prefs',
  orchestratorPresetsCollapsed: 'orchestrator.prefs',
  orchestratorEditorCollapsed: 'orchestrator.prefs',
  orchestratorContextCollapsed: 'orchestrator.prefs',
  orchestratorWorkflowIndexingCollapsed: 'orchestrator.prefs',
  orchestratorWorkflowTracingCollapsed: 'orchestrator.prefs',
  renderUiEditorOpen: 'render.prefs',
  renderPresetsCollapsed: 'render.prefs',
  renderDatasetInspectorCollapsed: 'render.prefs',
  renderCodebaseIndexCollapsed: 'render.prefs',
  renderThreeLinksCollapsed: 'render.prefs',
  renderThreeLayoutCollapsed: 'render.prefs',
  renderThreeBackgroundFogCollapsed: 'render.prefs',
  renderThreeStarfieldCollapsed: 'render.prefs',
  renderThreeCameraCollapsed: 'render.prefs',
  renderThreeSelectionCollapsed: 'render.prefs',
  renderThreeIframeOverlayPoolMax: 'render.prefs',
  renderThreeIframeOverlayMaxVisibleDefault: 'render.prefs',
  renderThreeIframeOverlayMaxVisibleCompact: 'render.prefs',
  renderThreeIframeOverlayMaxDistanceDefault: 'render.prefs',
  renderThreeIframeOverlayMaxDistanceCompact: 'render.prefs',
  renderThreeIframeOverlayBaseWidthRatioDefault: 'render.prefs',
  renderThreeIframeOverlayBaseWidthRatioCompact: 'render.prefs',
  renderThreeIframeOverlayBaseWidthMinPxDefault: 'render.prefs',
  renderThreeIframeOverlayBaseWidthMinPxCompact: 'render.prefs',
  renderThreeIframeOverlayBaseWidthMaxPxDefault: 'render.prefs',
  renderThreeIframeOverlayBaseWidthMaxPxCompact: 'render.prefs',
  renderRichMediaPanelMode: 'render.prefs',
  canvas2dRenderer: 'render.prefs',
  canvas3dMode: 'render.prefs',
  bipartiteDataSource: 'render.prefs',
  bipartitePollIntervalSec: 'render.prefs',
  bipartiteNodeSizeMetric: 'render.prefs',
  bipartiteNodeGlowMetric: 'render.prefs',
  bipartiteNodePulseMetric: 'render.prefs',
  bipartiteNodeBorderMetric: 'render.prefs',
  bipartiteEdgeOpacityMetric: 'render.prefs',
  bipartiteShowSpecificityBadges: 'render.prefs',
  bipartiteShowGapScoreInLabel: 'render.prefs',
  bipartiteShowClusterGapRatio: 'render.prefs',
  perDocumentUiStateMap: 'ui.workspace',
  viewportLast: 'ui.workspace',
  viewportPinned: 'ui.workspace',
  viewportFitToScreen: 'ui.workspace',
  viewportFitFillRatio: 'ui.workspace',
  viewportZoomToSelection: 'ui.workspace',
  viewportControlsPreset: 'ui.workspace',
  graphDragAlphaTarget2d: 'ui.workspace',
  infiniteCanvasInteractionMode: 'ui.workspace',
  canvasWorkspaceSyncMode: 'ui.workspace',
  flowEditorSelectionOnDrag: 'ui.workspace',
  flowEditorOverlayWheelProxyEnabled: 'ui.workspace',
  zoomDurationFitMs: 'ui.workspace',
  zoomDurationSelectionMs: 'ui.workspace',
  wheelZoomCtrlMetaBoostMultiplier: 'ui.workspace',
  zoomLabelScaleMode2d: 'ui.workspace',
  zoomLabelScaleExponent2d: 'ui.workspace',
  zoomLabelScaleClampMin2d: 'ui.workspace',
  zoomLabelScaleClampMax2d: 'ui.workspace',
  zoomStrokeScaleMode2d: 'ui.workspace',
  zoomStrokeScaleExponent2d: 'ui.workspace',
  zoomStrokeScaleClampMin2d: 'ui.workspace',
  zoomStrokeScaleClampMax2d: 'ui.workspace',
  threeCameraAutoClip: 'render.prefs',
  threeCameraAutoClipNearFactor: 'render.prefs',
  threeCameraAutoClipFarFactor: 'render.prefs',
  threeIframeOverlaySizeScaleFactor: 'render.prefs',
  threeEdgeRenderer: 'render.prefs',
  threeShaderLineWidthPx: 'render.prefs',
  canvasInteractionSpeedMultiplier: 'ui.workspace',
  canvasPanSpeedMultiplier: 'ui.workspace',
  flowWheelZoomSpeedMultiplier: 'render.prefs',
  flowWheelZoomIncrementMultiplier: 'render.prefs',
  flowWheelZoomSmoothMinDurationMs: 'render.prefs',
  flowWheelZoomSmoothMaxDurationMs: 'render.prefs',
  flowWheelZoomDefaultsVersion: 'render.prefs',
  parserTreeSitterEnabled: 'parsers.treeSitter',
  graphragTextCentralityConfig: 'graphragText.analytics',
  keywordSourceMaxLines: 'semantic.keyword',
  keywordSourceMaxChars: 'semantic.keyword',
  keywordGraphPreviewDebounceMs: 'semantic.keyword',
  keywordGraphFullDebounceMs: 'semantic.keyword',
  keywordGraphEdgesPerNode: 'semantic.keyword',
  keywordGraphMaxEdgesCap: 'semantic.keyword',
  keywordGraphMentionEdgesPerSourceNode: 'semantic.keyword',
  graphData: 'data.graph',
  graphSchema: 'schema.graph',
  graphFieldSettingsById: 'graphFields.settings',
  graphDataTableVisibleColumns: 'graphDataTable',
  graphDataTableColumnOrder: 'graphDataTable',
  graphDataTableColumnWidths: 'graphDataTable',
  graphDataTableAggregateKeys: 'graphDataTable',
  graphDataTableFilterState: 'graphDataTable',
  graphDataTableSortRules: 'graphDataTable',
  graphDataTableGroupKey: 'graphDataTable',
  graphDataTableAutoSortEnabled: 'graphDataTable',
  graphDataTableRowDensity: 'graphDataTable',
  graphDataTableDisableAutoScroll: 'graphDataTable',
  graphDataTableFreezeFirstDataColumn: 'graphDataTable',
  graphDataTableFreezeFirstDataColumnByScope: 'graphDataTable',
  graphDataTableAggregateDefaultVizMode: 'graphDataTable',
  graphDataTableAggregateIncludeMixedNumericFields: 'curation.spreadsheet',
  graphDataTableAggregateIncludeIdAsNumeric: 'curation.spreadsheet',
  graphDataTableAggregateIncludeSourceAsNumeric: 'curation.spreadsheet',
  graphDataTableAggregateIncludeTargetAsNumeric: 'curation.spreadsheet',
  graphDataTableNumericSampleLimit: 'curation.spreadsheet',
  graphDataTableNumericSampleMinCount: 'curation.spreadsheet',
  graphDataTableNumericSampleMinRatio: 'curation.spreadsheet',
  graphDataTableFrozenDragStepNoneLabelPx: 'curation.spreadsheet',
  graphDataTableFrozenDragStepLabelIdPx: 'curation.spreadsheet',
  graphDataTableVirtualOverscanRows: 'ui.bottomPanel',
  graphDataTableOverscanMultiplier: 'ui.bottomPanel',
  graphDataTableVirtualMinRows: 'ui.bottomPanel',
  graphDataTableVirtualDebugLogRanges: 'ui.bottomPanel',
  schemaDeriveCacheCapacity: 'schema.deriveCache',
  launchSpotlightEnabled: 'ui.launchSpotlight',
  statusPanelPinned: 'ui.statusPanelPinned',
  editorWorkspacePane: 'ui.workspace',
  workspaceCellSelectPanelPlacement: 'ui.workspace',
  graphTablePreviewCollapsed: 'ui.workspace',
  graphTablePreviewWidthPx: 'ui.workspace',
  graphTablePanelCollapsed: 'ui.workspace',
  graphTableInspectorOpen: 'ui.workspace',
  graphTableInspectorWidthPx: 'ui.workspace',
  graphTableViewMode: 'ui.workspace',
  graphTableColumnVisibilityById: 'ui.workspace',
  graphTableFilters: 'ui.workspace',
  graphTableFilterMatch: 'ui.workspace',
  graphTableGroupBy: 'ui.workspace',
  graphTableSortRules: 'ui.workspace',
  graphTableRowHeightPreset: 'ui.workspace',
  graphTableColumnWidthsPx: 'ui.workspace',
  graphTableColumnOrderByTableId: 'ui.workspace',

  pdfImportIncludeImages: 'import.pdf',
  pdfImportMaxPages: 'import.pdf',
  pdfImportMaxPdfBytes: 'import.pdf',
  pdfImportFetchTimeoutMs: 'import.pdf',
  pdfImportUploadTimeoutMs: 'import.pdf',
  pdfImportConvertTimeoutMs: 'import.pdf',
  pdfImportStreamDecodeCacheMaxBytes: 'import.pdf',
  pdfImportContentStreamMaxDecodeBytes: 'import.pdf',
  pdfImportPageContentMaxBytes: 'import.pdf',
  pdfImportCmapMaxBytes: 'import.pdf',
  pdfImportMaxToUnicodeStreamBytes: 'import.pdf',
  pdfImportToUnicodeMaxDecodeBytes: 'import.pdf',
  pdfImportImageStreamMaxDecodeBytes: 'import.pdf',
  pdfImportMaxTextContentBytesPerPage: 'import.pdf',
  pdfImportMaxTextStreamBytes: 'import.pdf',
  pdfImportMaxFormXObjectBytes: 'import.pdf',
  pdfImportMaxFormXObjectStreamBytes: 'import.pdf',
  pdfImportMaxFormXObjectCount: 'import.pdf',
  pdfImportEmbedImages: 'import.pdf',
  pdfImportMaxExtractedImagesPerPage: 'import.pdf',
  pdfImportMaxEmbeddedImagesPerPage: 'import.pdf',
  pdfImportMaxEmbeddedTotalBytes: 'import.pdf',
  pdfImportMaxEmbeddedAssetBytes: 'import.pdf',
  pdfImportReconstructTables: 'import.pdf',
  pdfImportTableMinColumns: 'import.pdf',
  pdfImportTableMinRows: 'import.pdf',
  pdfImportTableMaxRows: 'import.pdf',
  pdfImportProvider: 'import.pdf',
  pdfImportDoclingEndpoint: 'import.pdf',
  pdfImportProviderFallbackToNative: 'import.pdf',
  pdfImportOcrEnabled: 'import.pdf',
  pdfImportOcrMode: 'import.pdf',
  mainPanelPinned: 'ui.mainPanel',
  mainPanelCollapsed: 'ui.mainPanel',
  mainPanelTop: 'ui.mainPanel',
  mainPanelLeft: 'ui.mainPanel',
  onboardingSpotlightEnabled: 'ui.onboardingSpotlight',
  startupOpenWorkflowPanel: 'ui.startup',
  settingsCollapsedByArea: 'settings.collapsedByArea',
  parserInputCollapsed: 'parsers.panel',
  parserParsersCollapsed: 'parsers.panel',
  themeMode: 'ui.theme',
  exportPrefs: 'export.prefs',
  exportHtmlCanvasPublishPath: 'export.prefs',
  bottomPanelCollapsed: 'bottomPanel.collapsed',
  customParsers: 'parsers.custom',
  launchSpotlightDismissed: 'ui.launchSpotlightDismissed',
  workflowPresetCatalog: 'workflow.presets',
  workflowPresetLastApplied: 'workflow.presets',
  schemaSubsectionPrefix: 'schema.subsections',
  schemaUiStep31Collapsed: 'schema.ui',
  schemaUiStep32Collapsed: 'schema.ui',
  schemaUiStep33Collapsed: 'schema.ui',
  schemaUiStep332Collapsed: 'schema.ui',
  chatProvider: 'ui.chat',
  chatEndpointUrl: 'ui.chat',
  chatModel: 'ui.chat',
  chatTemperature: 'ui.chat',
  chatSystemPrompt: 'ui.chat',
  chatContextScope: 'ui.chat',
  integrationConfigsJson: 'ui.chat',
  chatHistoryPrefix: 'ui.chat',
  workspaceViewMode: 'ui.workspace',
  documentStructureBaselineLock: 'ui.baseline',
  workspacePreviewWidthPx: 'ui.workspace',
  workspaceCanvasPaneOpen: 'ui.workspace',
};

export const SCHEMA_SECTIONS = [
  {
    id: 'schemaApplyPresets',
    label: 'Apply presets from schema-config/',
    collapsedKey: 'schemaUiStep31Collapsed',
  },
  {
    id: 'schemaTuneRules',
    label: 'Tune node, edge, and layout rules',
    collapsedKey: 'schemaUiStep32Collapsed',
  },
  {
    id: 'schemaCustomizeUi',
    label: 'Customize node and edge UI',
    collapsedKey: 'schemaUiStep33Collapsed',
  },
  {
    id: 'schemaValidationRules',
    label: 'Validation and rules',
    collapsedKey: 'schemaUiStep332Collapsed',
  },
] as const;

export type SchemaSectionId = (typeof SCHEMA_SECTIONS)[number]['id'];

export const SCHEMA_SECTION_IDS: readonly SchemaSectionId[] = SCHEMA_SECTIONS.map(section => section.id);

export const ORCHESTRATOR_SECTIONS = [
  {
    id: 'graphRag',
    label: 'GraphRAG Workflow (AgenticRAG)',
    collapsedKey: 'orchestratorGraphRagCollapsed',
  },
  {
    id: 'presets',
    label: 'Traversal presets and helpers',
    collapsedKey: 'orchestratorPresetsCollapsed',
  },
  {
    id: 'editor',
    label: 'Traversal editor and layers',
    collapsedKey: 'orchestratorEditorCollapsed',
  },
  {
    id: 'context',
    label: 'AgenticRAG context and ignore filters',
    collapsedKey: 'orchestratorContextCollapsed',
  },
  {
    id: 'workflowIndexing',
    label: 'Indexing parameters',
    collapsedKey: 'orchestratorWorkflowIndexingCollapsed',
  },
  {
    id: 'workflowTracing',
    label: 'Tracing options',
    collapsedKey: 'orchestratorWorkflowTracingCollapsed',
  },
] as const;

export type OrchestratorSectionId = (typeof ORCHESTRATOR_SECTIONS)[number]['id'];

export const ORCHESTRATOR_SECTION_IDS: readonly OrchestratorSectionId[] = ORCHESTRATOR_SECTIONS.map(
  section => section.id,
);

export const RENDER_SECTIONS = [
  {
    id: 'renderPresets',
    label: 'Render presets and tuning',
    collapsedKey: 'renderPresetsCollapsed',
  },
  {
    id: 'datasetInspector',
    label: 'Dataset inspector',
    collapsedKey: 'renderDatasetInspectorCollapsed',
  },
  {
    id: 'codebaseIndexPipeline',
    label: 'Codebase index pipeline',
    collapsedKey: 'renderCodebaseIndexCollapsed',
  },
  {
    id: 'threeLinks',
    label: 'Renderer: edges and particles',
    collapsedKey: 'renderThreeLinksCollapsed',
  },
  {
    id: 'threeLayout',
    label: 'Renderer: layout and geometry',
    collapsedKey: 'renderThreeLayoutCollapsed',
  },
  {
    id: 'threeBackgroundFog',
    label: 'Renderer: background and fog',
    collapsedKey: 'renderThreeBackgroundFogCollapsed',
  },
  {
    id: 'threeStarfield',
    label: 'Renderer: starfield and depth',
    collapsedKey: 'renderThreeStarfieldCollapsed',
  },
  {
    id: 'threeCamera',
    label: 'Renderer: camera and motion',
    collapsedKey: 'renderThreeCameraCollapsed',
  },
  {
    id: 'threeSelection',
    label: 'Renderer: selection highlighting',
    collapsedKey: 'renderThreeSelectionCollapsed',
  },
] as const;

export type RenderSectionId = (typeof RENDER_SECTIONS)[number]['id'];

export type SessionKeyId = keyof typeof SESSION_KEYS;
export type SessionStorageKey = (typeof SESSION_KEYS)[SessionKeyId];

export type StorageChannelId = keyof typeof STORAGE_CHANNELS;
export type StorageChannelKey = (typeof STORAGE_CHANNELS)[StorageChannelId];

export function getLsKeyDiagnostics(): { id: LsKeyId; storageKey: (typeof LS_KEYS)[LsKeyId]; owner: LsKeyOwner }[] {
  const ids = Object.keys(LS_KEYS) as LsKeyId[];
  return ids.map(id => ({
    id,
    storageKey: LS_KEYS[id],
    owner: LS_KEY_OWNERS[id],
  }));
}

export function getOrchestratorSectionDiagnostics(): {
  id: OrchestratorSectionId;
  label: string;
  collapsedKeyId: LsKeyId;
  collapsedStorageKey: LsStorageKey;
  owner: LsKeyOwner;
}[] {
  return ORCHESTRATOR_SECTIONS.map(section => {
    const collapsedKeyId = section.collapsedKey as LsKeyId;
    return {
      id: section.id,
      label: section.label,
      collapsedKeyId,
      collapsedStorageKey: LS_KEYS[collapsedKeyId],
      owner: LS_KEY_OWNERS[collapsedKeyId],
    };
  });
}

export type OrchestratorSectionAnalyticsRecord = {
  sectionId: OrchestratorSectionId;
  label: string;
  collapsedKeyId: LsKeyId;
  collapsedStorageKey: LsStorageKey;
  owner: LsKeyOwner;
};

export function getOrchestratorSectionAnalyticsPayload(): OrchestratorSectionAnalyticsRecord[] {
  const diagnostics = getOrchestratorSectionDiagnostics();
  return diagnostics.map(diagnostic => ({
    sectionId: diagnostic.id,
    label: diagnostic.label,
    collapsedKeyId: diagnostic.collapsedKeyId,
    collapsedStorageKey: diagnostic.collapsedStorageKey,
    owner: diagnostic.owner,
  }));
}

export type OrchestratorSectionToggleAnalyticsEvent = OrchestratorSectionAnalyticsRecord & {
  collapsed: boolean;
};

export function buildOrchestratorSectionToggleAnalyticsEvent(
  sectionId: OrchestratorSectionId,
  collapsed: boolean,
): OrchestratorSectionToggleAnalyticsEvent | null {
  const payload = getOrchestratorSectionAnalyticsPayload().find(record => record.sectionId === sectionId);
  if (!payload) return null;
  return {
    ...payload,
    collapsed,
  };
}

export function getOrchestratorSectionMarkdownTable(): string {
  const diagnostics = getOrchestratorSectionDiagnostics();
  const header = '| Section ID | Label | Storage Key | Owner |';
  const separator = '| --- | --- | --- | --- |';
  const rows = diagnostics.map(diagnostic => {
    const escapedLabel = diagnostic.label.replace(/\|/g, '\\|');
    return `| ${diagnostic.id} | ${escapedLabel} | ${diagnostic.collapsedStorageKey} | ${diagnostic.owner} |`;
  });
  return [header, separator, ...rows].join('\n');
}

export function getRenderSectionDiagnostics(): {
  id: RenderSectionId;
  label: string;
  collapsedKeyId: LsKeyId;
  collapsedStorageKey: LsStorageKey;
  owner: LsKeyOwner;
}[] {
  return RENDER_SECTIONS.map(section => {
    const collapsedKeyId = section.collapsedKey as LsKeyId;
    return {
      id: section.id,
      label: section.label,
      collapsedKeyId,
      collapsedStorageKey: LS_KEYS[collapsedKeyId],
      owner: LS_KEY_OWNERS[collapsedKeyId],
    };
  });
}

export type RenderSectionAnalyticsRecord = {
  sectionId: RenderSectionId;
  label: string;
  collapsedKeyId: LsKeyId;
  collapsedStorageKey: LsStorageKey;
  owner: LsKeyOwner;
};

export function getRenderSectionAnalyticsPayload(): RenderSectionAnalyticsRecord[] {
  const diagnostics = getRenderSectionDiagnostics();
  return diagnostics.map(diagnostic => ({
    sectionId: diagnostic.id,
    label: diagnostic.label,
    collapsedKeyId: diagnostic.collapsedKeyId,
    collapsedStorageKey: diagnostic.collapsedStorageKey,
    owner: diagnostic.owner,
  }));
}

export type RenderSectionToggleAnalyticsEvent = RenderSectionAnalyticsRecord & {
  collapsed: boolean;
};

export function buildRenderSectionToggleAnalyticsEvent(
  sectionId: RenderSectionId,
  collapsed: boolean,
): RenderSectionToggleAnalyticsEvent | null {
  const payload = getRenderSectionAnalyticsPayload().find(record => record.sectionId === sectionId);
  if (!payload) return null;
  return {
    ...payload,
    collapsed,
  };
}

export function getRenderSectionMarkdownTable(): string {
  const diagnostics = getRenderSectionDiagnostics();
  const header = '| Section ID | Label | Storage Key | Owner |';
  const separator = '| --- | --- | --- | --- |';
  const rows = diagnostics.map(diagnostic => {
    const escapedLabel = diagnostic.label.replace(/\|/g, '\\|');
    return `| ${diagnostic.id} | ${escapedLabel} | ${diagnostic.collapsedStorageKey} | ${diagnostic.owner} |`;
  });
  return [header, separator, ...rows].join('\n');
}
