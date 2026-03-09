import { GEOSPATIAL_LS_KEYS } from 'grph-shared/geospatial/constants'

export const LS_KEYS = {
  overlayOpacity: 'kg:ui:overlayOpacity',
  panelOpacity: 'kg:ui:panelOpacity',
  toolbarOpacity: 'kg:ui:toolbarOpacity',
  iconScale: 'kg:ui:iconScale',
  iconFormat: 'kg:ui:iconFormat',
  iconStrokeWidth: 'kg:ui:iconStrokeWidth',
  iconColorClass: 'kg:ui:iconColorClass',
  iconHoverBgClass: 'kg:ui:iconHoverBgClass',
  iconButtonPadding: 'kg:ui:iconButtonPadding',
  iconPillClass: 'kg:ui:iconPillClass',
  iconPillLegendTextSizeClass: 'kg:ui:iconPillLegendTextSizeClass',
  iconPillBadgeTextSizeClass: 'kg:ui:iconPillBadgeTextSizeClass',
  iconBadgeChipClass: 'kg:ui:iconBadgeChipClass',
  iconBadgeChipTextSizeClass: 'kg:ui:iconBadgeChipTextSizeClass',
  iconAnimationEnabled: 'kg:ui:iconAnimationEnabled',
  panelKeyValueTextSizeClass: 'kg:ui:panelKeyValueTextSizeClass',
  panelTextFontClass: 'kg:ui:panelTextFontClass',
  panelKeyValueInputClass: 'kg:ui:panelKeyValueInputClass',
  panelRowDensityDefaultClass: 'kg:ui:panelRowDensityDefaultClass',
  panelRowDensityCompactClass: 'kg:ui:panelRowDensityCompactClass',
  panelMonospaceTextClass: 'kg:ui:panelMonospaceTextClass',
  panelMicroLabelTextSizeClass: 'kg:ui:panelMicroLabelTextSizeClass',
  headerRowHeightClass: 'kg:ui:headerRowHeightClass',
  headerRowPaddingClass: 'kg:ui:headerRowPaddingClass',
  sectionHeaderRowHeightClass: 'kg:ui:sectionHeaderRowHeightClass',
  sectionHeaderRowPaddingClass: 'kg:ui:sectionHeaderRowPaddingClass',
  bottomPanelHeight: 'kg:ui:bottomPanelHeight',
  minimapCollapsed: 'kg:ui:minimapCollapsed',
  markdownWordWrap: 'kg:ui:markdown:wordWrap',
  markdownPresentationMode: 'kg:ui:markdown:presentationMode',
  markdownLayoutMode: 'kg:ui:markdown:layoutMode',
  markdownViewerWidthMode: 'kg:ui:markdown:viewerWidthMode',
  markdownTextHighlight: 'kg:ui:markdown:textHighlight',
  markdownSelectionFlashMode: 'kg:ui:markdown:flashMode',
  markdownAnnotateDisplay: 'kg:ui:markdown:annotateDisplay',
  markdownSyncScroll: 'kg:ui:markdown:syncScroll',
  markdownSidebarOpen: 'kg:ui:markdown:sidebarOpen',
  markdownSidebarWidthPx: 'kg:ui:markdown:sidebarWidthPx',
  markdownExplorerSourceFilesCollapsed: 'kg:ui:markdown:explorer:sourceFilesCollapsed',
  markdownExplorerSourceFilesExpandedPaths: 'kg:ui:markdown:explorer:sourceFilesExpandedPaths',
  markdownExplorerOutlineCollapsed: 'kg:ui:markdown:explorer:outlineCollapsed',
  markdownExplorerBacklinksCollapsed: 'kg:ui:markdown:explorer:backlinksCollapsed',
  markdownExplorerFolderModeContract: 'kg:ui:markdown:explorer:folderModeContract',
  markdownExplorerActivePath: 'kg:ui:markdown:explorer:activePath',
  markdownWorkspaceSourcesByPath: 'kg:ui:markdown:workspace:sourcesByPath',
  markdownWorkspaceSeeded: 'kg:ui:markdown:workspace:seeded',
  markdownWorkspaceUserClearedAllFiles: 'kg:ui:markdown:workspace:userClearedAllFiles',
  markdownCollapsedHeadingIds: 'kg:ui:markdown:collapsedHeadingIds',
  jsonMarkdownMode: 'kg:ui:markdown:jsonMode',
  pdfWorkspaceOutputDirRel: 'kg:pdfWorkspace:outputDirRel',
  previewZoomPanMermaid: 'kg:ui:preview:zoomPan:mermaid',
  previewZoomPanSlides: 'kg:ui:preview:zoomPan:slides',
  previewSlidesShowThumbnails: 'kg:ui:preview:slides:showThumbnails',
  previewSlidesShowNotes: 'kg:ui:preview:slides:showNotes',
  floatingPanelPinned: 'kg:ui:floatingPanel:pinned',
  floatingPanelWidthRatio: 'kg:ui:floatingPanelWidthRatio',
  floatingPanelHeightRatio: 'kg:ui:floatingPanelHeightRatio',
  floatingPanelZIndex: 'kg:ui:floatingPanelZIndex',

  flowNodeQuickEditorPinnedByNodeId: 'kg:ui:flowEditor:nodeQuickEditor:pinnedByNodeId',
  flowNodeQuickEditorPinnedSemanticsVersion: 'kg:ui:flowEditor:nodeQuickEditor:pinnedSemanticsVersion',
  flowNodeQuickEditorMinimized: 'kg:ui:flowEditor:nodeQuickEditor:minimized',
  flowNodeQuickEditorHideFields: 'kg:ui:flowEditor:nodeQuickEditor:hideFields',
  flowNodeQuickEditorPosByNodeId: 'kg:ui:flowEditor:nodeQuickEditor:posByNodeId',
  flowNodeQuickEditorWorldPosByNodeId: 'kg:ui:flowEditor:nodeQuickEditor:worldPosByNodeId',
  flowNodeQuickEditorPinnedByGraphMetaKey: 'kg:ui:flowEditor:nodeQuickEditor:pinnedByGraphMetaKey',
  flowNodeQuickEditorPosByGraphMetaKey: 'kg:ui:flowEditor:nodeQuickEditor:posByGraphMetaKey',
  flowNodeQuickEditorWorldPosByGraphMetaKey: 'kg:ui:flowEditor:nodeQuickEditor:worldPosByGraphMetaKey',
  flowEditorSelectionOnDrag: 'kg:ui:flowEditor:selectionOnDrag',
  flowEditorOverlayWheelProxyEnabled: 'kg:ui:flowEditor:overlayWheelProxyEnabled',
  flowEditorManagerNodeQuickEditorRegistry: 'kg:ui:flowEditorManager:nodeQuickEditorRegistry',
  flowEditorManagerNodeSpec: 'kg:ui:flowEditorManager:spec:node',
  flowEditorManagerWorkflowSpec: 'kg:ui:flowEditorManager:spec:workflow',
  geospatialOverlayEnabled: GEOSPATIAL_LS_KEYS.geospatialOverlayEnabled,
  geospatialAutoEnableOnGeoImport: 'kg:ui:geospatial:autoEnableOnGeoImport',
  orchestratorTraversalDelayMs: 'kg:orchestrator:traversalDelayMs',
  orchestratorTraversalLegendGraphRagMaxFull: 'kg:orchestrator:traversalLegend:graphRagMaxFull',
  orchestratorTraversalLegendGraphRagHead: 'kg:orchestrator:traversalLegend:graphRagHead',
  orchestratorTraversalLegendGenericMaxFull: 'kg:orchestrator:traversalLegend:genericMaxFull',
  orchestratorTraversalLegendGenericHead: 'kg:orchestrator:traversalLegend:genericHead',
  orchestratorTraversalLegendTail: 'kg:orchestrator:traversalLegend:tail',
  orchestratorGraphRagCollapsed: 'kg:orchestrator:graphRagCollapsed',
  orchestratorPresetsCollapsed: 'kg:orchestrator:presetsCollapsed',
  orchestratorEditorCollapsed: 'kg:orchestrator:editorCollapsed',
  orchestratorContextCollapsed: 'kg:orchestrator:contextCollapsed',
  orchestratorWorkflowIndexingCollapsed: 'kg:orchestrator:workflow:indexingCollapsed',
  orchestratorWorkflowTracingCollapsed: 'kg:orchestrator:workflow:tracingCollapsed',
  renderUiEditorOpen: 'kg:render:editor:uiEditorOpen',
  renderPresetsCollapsed: 'kg:render:presetsCollapsed',
  renderDatasetInspectorCollapsed: 'kg:render:datasetInspectorCollapsed',
  renderCodebaseIndexCollapsed: 'kg:render:codebaseIndexCollapsed',
  renderThreeLinksCollapsed: 'kg:render:three:linksCollapsed',
  renderThreeLayoutCollapsed: 'kg:render:three:layoutCollapsed',
  renderThreeBackgroundFogCollapsed: 'kg:render:three:backgroundFogCollapsed',
  renderThreeStarfieldCollapsed: 'kg:render:three:starfieldCollapsed',
  renderThreeCameraCollapsed: 'kg:render:three:cameraCollapsed',
  renderThreeSelectionCollapsed: 'kg:render:three:selectionCollapsed',
  renderThreeIframeOverlayPoolMax: 'kg:render:three:iframeOverlay:poolMax',
  renderThreeIframeOverlayMaxVisibleDefault: 'kg:render:three:iframeOverlay:maxVisibleDefault',
  renderThreeIframeOverlayMaxVisibleCompact: 'kg:render:three:iframeOverlay:maxVisibleCompact',
  renderThreeIframeOverlayMaxDistanceDefault: 'kg:render:three:iframeOverlay:maxDistanceDefault',
  renderThreeIframeOverlayMaxDistanceCompact: 'kg:render:three:iframeOverlay:maxDistanceCompact',
  renderThreeIframeOverlayBaseWidthRatioDefault: 'kg:render:three:iframeOverlay:baseWidthRatioDefault',
  renderThreeIframeOverlayBaseWidthRatioCompact: 'kg:render:three:iframeOverlay:baseWidthRatioCompact',
  renderThreeIframeOverlayBaseWidthMinPxDefault: 'kg:render:three:iframeOverlay:baseWidthMinPxDefault',
  renderThreeIframeOverlayBaseWidthMinPxCompact: 'kg:render:three:iframeOverlay:baseWidthMinPxCompact',
  renderThreeIframeOverlayBaseWidthMaxPxDefault: 'kg:render:three:iframeOverlay:baseWidthMaxPxDefault',
  renderThreeIframeOverlayBaseWidthMaxPxCompact: 'kg:render:three:iframeOverlay:baseWidthMaxPxCompact',
  canvas2dRenderer: 'kg:render:2dRenderer',
  perDocumentUiStateMap: 'kg:ui:perDocument:uiStateMap',
  viewportLast: 'kg:ui:viewport:last',
  viewportPinned: 'kg:ui:viewport:pinned',
  viewportFitToScreen: 'kg:ui:viewport:fitToScreen',
  viewportZoomToSelection: 'kg:ui:viewport:zoomToSelection',
  viewportControlsPreset: 'kg:ui:viewport:controlsPreset',
  zoomDurationFitMs: 'kg:ui:zoom:durationFitMs',
  zoomDurationSelectionMs: 'kg:ui:zoom:durationSelectionMs',
  wheelZoomCtrlMetaBoostMultiplier: 'kg:ui:zoom:wheelCtrlMetaBoostMultiplier',
  canvasInteractionSpeedMultiplier: 'kg:ui:interaction:speedMultiplier',
  canvasPanSpeedMultiplier: 'kg:ui:pan:speedMultiplier',
  flowWheelZoomSpeedMultiplier: 'kg:render:flow:wheelZoomSpeedMultiplier',
  flowWheelZoomIncrementMultiplier: 'kg:render:flow:wheelZoomIncrementMultiplier',
  flowWheelZoomSmoothMinDurationMs: 'kg:render:flow:wheelZoomSmoothMinDurationMs',
  flowWheelZoomSmoothMaxDurationMs: 'kg:render:flow:wheelZoomSmoothMaxDurationMs',
  flowWheelZoomDefaultsVersion: 'kg:render:flow:wheelZoomDefaultsVersion',
  parserTreeSitterEnabled: 'kg:parsers:treeSitterEnabled',
  graphragTextCentralityConfig: 'kg:graphragText:centralityConfig',
  keywordSourceMaxLines: 'kg:semantic:keyword:sourceMaxLines',
  keywordSourceMaxChars: 'kg:semantic:keyword:sourceMaxChars',
  keywordGraphPreviewDebounceMs: 'kg:semantic:keyword:previewDebounceMs',
  keywordGraphFullDebounceMs: 'kg:semantic:keyword:fullDebounceMs',
  keywordGraphEdgesPerNode: 'kg:semantic:keyword:edgesPerNode',
  keywordGraphMaxEdgesCap: 'kg:semantic:keyword:maxEdgesCap',
  keywordGraphMentionEdgesPerSourceNode: 'kg:semantic:keyword:mentionEdgesPerSourceNode',
  graphData: 'kg:data',
  graphSchema: 'kg:schema',
  graphFieldSettingsById: 'kg:graphFields:settingsById',
  graphDataTableVisibleColumns: 'kg:graphDataTable:visibleColumns',
  graphDataTableColumnOrder: 'kg:graphDataTable:columnOrder',
  graphDataTableColumnWidths: 'kg:graphDataTable:columnWidths',
  graphDataTableAggregateKeys: 'kg:graphDataTable:aggregateKeys',
  graphDataTableFilterState: 'kg:graphDataTable:filterState',
  graphDataTableSortRules: 'kg:graphDataTable:sortRules',
  graphDataTableGroupKey: 'kg:graphDataTable:groupKey',
  graphDataTableAutoSortEnabled: 'kg:graphDataTable:autoSortEnabled',
  graphDataTableRowDensity: 'kg:graphDataTable:rowDensity',
  graphDataTableDisableAutoScroll: 'kg:graphDataTable:disableAutoScroll',
  graphDataTableFreezeFirstDataColumn: 'kg:graphDataTable:freezeFirstDataColumn',
  graphDataTableFreezeFirstDataColumnByScope: 'kg:graphDataTable:freezeFirstDataColumnByScope',
  graphDataTableAggregateDefaultVizMode: 'kg:graphDataTable:aggregateDefaultVizMode',
  graphDataTableAggregateIncludeMixedNumericFields: 'kg:curation:aggregate:includeMixed',
  graphDataTableAggregateIncludeIdAsNumeric: 'kg:curation:aggregate:includeId',
  graphDataTableAggregateIncludeSourceAsNumeric: 'kg:curation:aggregate:includeSource',
  graphDataTableAggregateIncludeTargetAsNumeric: 'kg:curation:aggregate:includeTarget',
  graphDataTableNumericSampleLimit: 'kg:curation:aggregate:numericSampleLimit',
  graphDataTableNumericSampleMinCount: 'kg:curation:aggregate:numericSampleMinCount',
  graphDataTableNumericSampleMinRatio: 'kg:curation:aggregate:numericSampleMinRatio',
  graphDataTableFrozenDragStepNoneLabelPx: 'kg:curation:spreadsheet:frozenDragStepNoneLabelPx',
  graphDataTableFrozenDragStepLabelIdPx: 'kg:curation:spreadsheet:frozenDragStepLabelIdPx',
  graphDataTableVirtualOverscanRows: 'kg:ui:tableVirtual:overscanRows',
  graphDataTableOverscanMultiplier: 'kg:ui:tableVirtual:overscanMultiplier',
  graphDataTableVirtualMinRows: 'kg:ui:tableVirtual:minRows',
  graphDataTableVirtualDebugLogRanges: 'kg:ui:tableVirtual:debugLogRanges',
  schemaDeriveCacheCapacity: 'kg:perf:schemaDeriveCacheCapacity',
  launchSpotlightEnabled: 'kg:ui:launchSpotlightEnabled',
  statusPanelPinned: 'kg:ui:statusPanelPinned',
  mainPanelPinned: 'kg:ui:mainPanel:pinned',
  mainPanelCollapsed: 'kg:ui:mainPanel:collapsed',
  mainPanelTop: 'kg:ui:mainPanel:top',
  mainPanelLeft: 'kg:ui:mainPanel:left',
  onboardingSpotlightEnabled: 'kg:ui:onboardingSpotlightEnabled',
  settingsCollapsedByArea: 'kg:settings:collapsedByArea',
  parserInputCollapsed: 'kg:parsers:panel:inputCollapsed',
  parserParsersCollapsed: 'kg:parsers:panel:parsersCollapsed',
  themeMode: 'kg:ui:themeMode',
  exportPrefs: 'kg:export:prefs',
  bottomPanelCollapsed: 'kg:ui:bottomPanel:collapsed',
  customParsers: 'kg:parsers:custom',
  launchSpotlightDismissed: 'kg:ui:launchSpotlightDismissed',
  workflowPresetCatalog: 'kg:workflowPresets:catalog',
  workflowPresetLastApplied: 'kg:workflowPresets:lastApplied',
  schemaSubsectionPrefix: 'kg:schema:subsection:',
  schemaUiStep31Collapsed: 'kg:schemaUi:step31:collapsed',
  schemaUiStep32Collapsed: 'kg:schemaUi:step32:collapsed',
  schemaUiStep33Collapsed: 'kg:schemaUi:step33:collapsed',
  schemaUiStep332Collapsed: 'kg:schemaUi:step332:collapsed',
  chatEndpointUrl: 'kg:chat:endpointUrl',
  chatModel: 'kg:chat:model',
  chatTemperature: 'kg:chat:temperature',
  chatSystemPrompt: 'kg:chat:systemPrompt',
  chatHistoryPrefix: 'kg:chat:history:',
  workspaceViewMode: 'kg:ui:workspace:viewMode',
  workspaceViewModeBeforeTable: 'kg:ui:workspace:viewModeBeforeTable',
  documentStructureBaselineLock: 'kg:ui:baseline:documentStructureLock',
  workspacePreviewWidthPx: 'kg:ui:workspace:previewWidthPx',
  workspaceCanvasPaneOpen: 'kg:ui:workspace:canvasPaneOpen',
  graphTablePreviewCollapsed: 'kg:ui:graphTable:preview:collapsed',
  graphTablePreviewWidthPx: 'kg:ui:graphTable:preview:widthPx',
  graphTablePanelCollapsed: 'kg:ui:graphTable:panelCollapsed',
  graphTableInspectorOpen: 'kg:ui:graphTable:inspector:open',
  graphTableInspectorWidthPx: 'kg:ui:graphTable:inspector:widthPx',
  graphTableColumnVisibilityById: 'kg:ui:graphTable:columns:visibilityById',
  graphTableFilters: 'kg:ui:graphTable:filters',
  graphTableFilterMatch: 'kg:ui:graphTable:filterMatch',
  graphTableGroupBy: 'kg:ui:graphTable:groupBy',
  graphTableSortRules: 'kg:ui:graphTable:sortRules',
  graphTableRowHeightPreset: 'kg:ui:graphTable:rowHeightPreset',
  graphTableColumnWidthsPx: 'kg:ui:graphTable:columnWidthsPx',
  graphTableColumnOrderByTableId: 'kg:ui:graphTable:columnOrderByTableId',

  pdfImportIncludeImages: 'kg:import:pdf:includeImages',
  pdfImportMaxPages: 'kg:import:pdf:maxPages',
  pdfImportMaxPdfBytes: 'kg:import:pdf:maxPdfBytes',
  pdfImportFetchTimeoutMs: 'kg:import:pdf:fetchTimeoutMs',
  pdfImportUploadTimeoutMs: 'kg:import:pdf:uploadTimeoutMs',
  pdfImportConvertTimeoutMs: 'kg:import:pdf:convertTimeoutMs',
  pdfImportStreamDecodeCacheMaxBytes: 'kg:import:pdf:streamDecodeCacheMaxBytes',
  pdfImportContentStreamMaxDecodeBytes: 'kg:import:pdf:contentStreamMaxDecodeBytes',
  pdfImportPageContentMaxBytes: 'kg:import:pdf:pageContentMaxBytes',
  pdfImportCmapMaxBytes: 'kg:import:pdf:cmapMaxBytes',
  pdfImportMaxToUnicodeStreamBytes: 'kg:import:pdf:maxToUnicodeStreamBytes',
  pdfImportToUnicodeMaxDecodeBytes: 'kg:import:pdf:toUnicodeMaxDecodeBytes',
  pdfImportImageStreamMaxDecodeBytes: 'kg:import:pdf:imageStreamMaxDecodeBytes',
  pdfImportMaxTextContentBytesPerPage: 'kg:import:pdf:maxTextContentBytesPerPage',
  pdfImportMaxTextStreamBytes: 'kg:import:pdf:maxTextStreamBytes',
  pdfImportMaxFormXObjectBytes: 'kg:import:pdf:maxFormXObjectBytes',
  pdfImportMaxFormXObjectStreamBytes: 'kg:import:pdf:maxFormXObjectStreamBytes',
  pdfImportMaxFormXObjectCount: 'kg:import:pdf:maxFormXObjectCount',
  pdfImportEmbedImages: 'kg:import:pdf:embedImages',
  pdfImportMaxExtractedImagesPerPage: 'kg:import:pdf:maxExtractedImagesPerPage',
  pdfImportMaxEmbeddedImagesPerPage: 'kg:import:pdf:maxEmbeddedImagesPerPage',
  pdfImportMaxEmbeddedTotalBytes: 'kg:import:pdf:maxEmbeddedTotalBytes',
  pdfImportMaxEmbeddedAssetBytes: 'kg:import:pdf:maxEmbeddedAssetBytes',
  pdfImportReconstructTables: 'kg:import:pdf:reconstructTables',
  pdfImportTableMinColumns: 'kg:import:pdf:tableMinColumns',
  pdfImportTableMinRows: 'kg:import:pdf:tableMinRows',
  pdfImportTableMaxRows: 'kg:import:pdf:tableMaxRows',
  pdfImportProvider: 'kg:import:pdf:provider',
  pdfImportDoclingEndpoint: 'kg:import:pdf:doclingEndpoint',
  pdfImportProviderFallbackToNative: 'kg:import:pdf:providerFallbackToNative',
  pdfImportOcrEnabled: 'kg:import:pdf:ocr:enabled',
  pdfImportOcrMode: 'kg:import:pdf:ocr:mode',
} as const;

export const LS_KEY_VIEWPORT_LAST = LS_KEYS.viewportLast
export const LS_KEY_VIEWPORT_PINNED = LS_KEYS.viewportPinned


export const SESSION_KEYS = {
  tabId: 'kg:session:tabId',
} as const;

export const STORAGE_CHANNELS = {
  tabSync: 'kg:session:tabSync',
} as const;

export type LsKeyId = keyof typeof LS_KEYS;
export type LsStorageKey =
  | (typeof LS_KEYS)[LsKeyId]
  | SchemaSubsectionStorageKey
  | ChatHistoryStorageKey
  | MarkdownCollapsedHeadingIdsStorageKey;

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

export const getMarkdownCollapsedHeadingIdsStorageKey = (scopeKey: string): MarkdownCollapsedHeadingIdsStorageKey =>
  `${LS_KEYS.markdownCollapsedHeadingIds}:${String(scopeKey ?? '')}` as MarkdownCollapsedHeadingIdsStorageKey;

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
  pdfWorkspaceOutputDirRel: 'import.pdf',
  previewZoomPanMermaid: 'ui.preview',
  previewZoomPanSlides: 'ui.preview',
  previewSlidesShowThumbnails: 'ui.preview',
  previewSlidesShowNotes: 'ui.preview',
  floatingPanelPinned: 'ui.floatingPanel',
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
  canvas2dRenderer: 'render.prefs',
  perDocumentUiStateMap: 'ui.workspace',
  viewportLast: 'ui.workspace',
  viewportPinned: 'ui.workspace',
  viewportFitToScreen: 'ui.workspace',
  viewportZoomToSelection: 'ui.workspace',
  viewportControlsPreset: 'ui.workspace',
  flowEditorSelectionOnDrag: 'ui.workspace',
  flowEditorOverlayWheelProxyEnabled: 'ui.workspace',
  zoomDurationFitMs: 'ui.workspace',
  zoomDurationSelectionMs: 'ui.workspace',
  wheelZoomCtrlMetaBoostMultiplier: 'ui.workspace',
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
  workspaceViewModeBeforeTable: 'ui.workspace',
  graphTablePreviewCollapsed: 'ui.workspace',
  graphTablePreviewWidthPx: 'ui.workspace',
  graphTablePanelCollapsed: 'ui.workspace',
  graphTableInspectorOpen: 'ui.workspace',
  graphTableInspectorWidthPx: 'ui.workspace',
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
  settingsCollapsedByArea: 'settings.collapsedByArea',
  parserInputCollapsed: 'parsers.panel',
  parserParsersCollapsed: 'parsers.panel',
  themeMode: 'ui.theme',
  exportPrefs: 'export.prefs',
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
  chatEndpointUrl: 'ui.chat',
  chatModel: 'ui.chat',
  chatTemperature: 'ui.chat',
  chatSystemPrompt: 'ui.chat',
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
