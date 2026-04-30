import type { GraphData, GraphNode, GraphEdge, JSONValue } from '@/lib/graph/types'
import type { GraphSchema, GraphBehavior, PropertySpec } from '@/lib/graph/schema'
import type { ThemeMode, ResolvedThemeMode } from '@/lib/ui/theme'
import type { GraphFieldId, GraphFieldSettings, GraphFieldSettingsById } from '@/features/graph-fields/graphFields'
import type {
  GraphDataTableRowDensity,
} from '@/features/graph-data-table/graphDataTable'
import type { TraversalSummary } from '@/features/panels/utils/orchestratorTraversal'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import type { MarkdownFrontmatter } from '@/lib/markdown'
import type { ZoomCommandType, ZoomFitIntent, ZoomRequest } from '@/lib/zoom/requests'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import type { Canvas2dRendererId, Canvas3dModeId, CanvasWorkspaceSyncMode, InfiniteCanvasInteractionMode } from '@/lib/config'
import type { DesignLayerNode, DesignLayerState } from '@/features/design/designLayersState'
import type { DesignFramePos, DesignFrameSize } from '@/hooks/store/designRendererSlice'
import type { SaveFilePickerHandle } from '@/lib/graph/save'
import type {
  BottomTab,
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

export interface GraphStateChatImport {
  bipartiteDataSource: 'api' | 'fixture' | 'workspace';
  setBipartiteDataSource: (v: 'api' | 'fixture' | 'workspace') => void;
  bipartiteApiRunId: string;
  setBipartiteApiRunId: (v: string) => void;
  bipartitePollIntervalSec: number;
  setBipartitePollIntervalSec: (v: number) => void;

  bipartiteNodeSizeMetric: 'gap_score' | 'pmf_score' | 'gap_velocity' | 'source_count' | 'none';
  setBipartiteNodeSizeMetric: (v: 'gap_score' | 'pmf_score' | 'gap_velocity' | 'source_count' | 'none') => void;
  bipartiteNodeGlowMetric: 'pmf_score' | 'gap_score' | 'none';
  setBipartiteNodeGlowMetric: (v: 'pmf_score' | 'gap_score' | 'none') => void;
  bipartiteNodePulseMetric: 'gap_velocity' | 'pmf_score' | 'none';
  setBipartiteNodePulseMetric: (v: 'gap_velocity' | 'pmf_score' | 'none') => void;
  bipartiteNodeBorderMetric: 'source_count' | 'gap_score' | 'none';
  setBipartiteNodeBorderMetric: (v: 'source_count' | 'gap_score' | 'none') => void;
  bipartiteEdgeOpacityMetric: 'strength' | 'none';
  setBipartiteEdgeOpacityMetric: (v: 'strength' | 'none') => void;

  bipartiteShowSpecificityBadges: boolean;
  setBipartiteShowSpecificityBadges: (v: boolean) => void;
  bipartiteShowGapScoreInLabel: boolean;
  setBipartiteShowGapScoreInLabel: (v: boolean) => void;
  bipartiteShowClusterGapRatio: boolean;
  setBipartiteShowClusterGapRatio: (v: boolean) => void;
  threeIframeOverlayMaxVisibleDefault: number;
  setThreeIframeOverlayMaxVisibleDefault: (v: number) => void;
  threeIframeOverlayMaxVisibleCompact: number;
  setThreeIframeOverlayMaxVisibleCompact: (v: number) => void;
  threeIframeOverlayMaxDistanceDefault: number;
  setThreeIframeOverlayMaxDistanceDefault: (v: number) => void;
  threeIframeOverlayMaxDistanceCompact: number;
  setThreeIframeOverlayMaxDistanceCompact: (v: number) => void;
  threeIframeOverlayBaseWidthRatioDefault: number;
  setThreeIframeOverlayBaseWidthRatioDefault: (v: number) => void;
  threeIframeOverlayBaseWidthRatioCompact: number;
  setThreeIframeOverlayBaseWidthRatioCompact: (v: number) => void;
  threeIframeOverlayBaseWidthMinPxDefault: number;
  setThreeIframeOverlayBaseWidthMinPxDefault: (v: number) => void;
  threeIframeOverlayBaseWidthMinPxCompact: number;
  setThreeIframeOverlayBaseWidthMinPxCompact: (v: number) => void;
  threeIframeOverlayBaseWidthMaxPxDefault: number;
  setThreeIframeOverlayBaseWidthMaxPxDefault: (v: number) => void;
  threeIframeOverlayBaseWidthMaxPxCompact: number;
  setThreeIframeOverlayBaseWidthMaxPxCompact: (v: number) => void;
  zoomLabelScaleMode2d: 'clampAt1' | 'smooth' | 'power';
  setZoomLabelScaleMode2d: (v: 'clampAt1' | 'smooth' | 'power') => void;
  zoomLabelScaleExponent2d: number;
  setZoomLabelScaleExponent2d: (v: number) => void;
  zoomLabelScaleClampMin2d: number;
  setZoomLabelScaleClampMin2d: (v: number) => void;
  zoomLabelScaleClampMax2d: number;
  setZoomLabelScaleClampMax2d: (v: number) => void;
  zoomStrokeScaleMode2d: 'zoomScaled' | 'screenConstant' | 'power';
  setZoomStrokeScaleMode2d: (v: 'zoomScaled' | 'screenConstant' | 'power') => void;
  zoomStrokeScaleExponent2d: number;
  setZoomStrokeScaleExponent2d: (v: number) => void;
  zoomStrokeScaleClampMin2d: number;
  setZoomStrokeScaleClampMin2d: (v: number) => void;
  zoomStrokeScaleClampMax2d: number;
  setZoomStrokeScaleClampMax2d: (v: number) => void;
  threeCameraAutoClip: boolean;
  setThreeCameraAutoClip: (v: boolean) => void;
  threeCameraAutoClipNearFactor: number;
  setThreeCameraAutoClipNearFactor: (v: number) => void;
  threeCameraAutoClipFarFactor: number;
  setThreeCameraAutoClipFarFactor: (v: number) => void;
  threeIframeOverlaySizeScaleFactor: number;
  setThreeIframeOverlaySizeScaleFactor: (v: number) => void;
  threeEdgeRenderer: 'mesh' | 'shaderLine' | 'tubeBridge';
  setThreeEdgeRenderer: (v: 'mesh' | 'shaderLine' | 'tubeBridge') => void;
  threeShaderLineWidthPx: number;
  setThreeShaderLineWidthPx: (v: number) => void;
  uiHeaderRowHeightClass: string;
  uiHeaderRowPaddingClass: string;
  uiSectionHeaderRowHeightClass: string;
  uiSectionHeaderRowPaddingClass: string;
  uiIconScale: 'compact' | 'default';
  uiIconFormat: 'default' | 'minimal' | '1';
  uiIconStrokeWidth: number;
  uiIconColorClass: string;
  uiIconHoverBgClass: string;
  uiIconButtonPaddingClass: string;
  uiIconPillClass: string;
  uiIconPillLegendTextSizeClass: string;
  uiIconPillBadgeTextSizeClass: string;
  uiIconBadgeChipClass: string;
  uiIconBadgeChipTextSizeClass: string;
  uiIconAnimationEnabled: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  resolvedThemeMode: ResolvedThemeMode;
  refreshResolvedThemeModeFromSystem: () => void;
  designSystemRequestedPage: DesignSystemPageId | null
  setDesignSystemRequestedPage: (page: DesignSystemPageId | null) => void
  selectionFlashDurationMs: number;
  selectionFlashOpacity: number;
  markdownSelectionFlashMode: 'auto' | 'manual';
  uiOverlayOpacity: number;
  uiPanelOpacity: number;
  uiToolbarOpacity: number;
  uiToasts: UiToast[];
  pushUiToast: (toast: UiToastInput) => void;
  upsertUiToast: (toast: UiToastInput) => void;
  dismissUiToast: (id: string) => void;
  pruneUiToasts: (nowMs: number) => void;
  uiLogEntries: UiLogEntry[];
  pushUiLog: (entry: UiLogEntryInput) => void;
  clearUiLog: () => void;
  floatingPanelOpen: boolean;
  setFloatingPanelOpen: (open: boolean) => void;
  floatingPanelView: 'propsPanel' | 'interaction' | 'domTree' | 'domInspect' | 'chat' | 'geo' | 'renderer' | 'graphTraversal';
  setFloatingPanelView: (view: 'propsPanel' | 'interaction' | 'domTree' | 'domInspect' | 'chat' | 'geo' | 'renderer' | 'graphTraversal') => void;
  chatExchangeLogs: ChatExchangeLogEntry[];
  pushChatExchangeLog: (entry: ChatExchangeLogEntryInput) => void;
  clearChatExchangeLogs: () => void;
  mediaNodeOpacity: number;
  paymentsStripePaywallEnabled: boolean;
  setPaymentsStripePaywallEnabled: (enabled: boolean) => void;
  paymentsStripeCheckoutUrl: string;
  setPaymentsStripeCheckoutUrl: (url: string) => void;
  chatProvider: string;
  chatAuthMode: 'serverManaged' | 'byok';
  setChatAuthMode: (mode: 'serverManaged' | 'byok') => void;
  chatApiKey: string;
  chatEndpointUrl: string | null;
  chatModel: string | null;
  chatTemperature: number;
  chatMaxCompletionTokens: number;
  setChatMaxCompletionTokens: (v: number) => void;
  chatServiceTier: 'auto' | 'default';
  setChatServiceTier: (v: 'auto' | 'default') => void;
  chatStream: boolean;
  setChatStream: (v: boolean) => void;
  chatMessagesJson: string;
  setChatMessagesJson: (v: string | null) => void;
  chatReasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
  setChatReasoningEffort: (v: 'minimal' | 'low' | 'medium' | 'high') => void;
  chatThinkingType: 'enabled' | 'disabled' | 'auto';
  setChatThinkingType: (v: 'enabled' | 'disabled' | 'auto') => void;
  chatThinkingJson: string;
  setChatThinkingJson: (v: string | null) => void;
  chatFrequencyPenalty: number;
  setChatFrequencyPenalty: (v: number) => void;
  chatPresencePenalty: number;
  setChatPresencePenalty: (v: number) => void;
  chatTopP: number;
  setChatTopP: (v: number) => void;
  chatLogprobs: boolean;
  setChatLogprobs: (v: boolean) => void;
  chatTopLogprobs: number;
  setChatTopLogprobs: (v: number) => void;
  chatParallelToolCalls: boolean;
  setChatParallelToolCalls: (v: boolean) => void;
  chatStopJson: string;
  setChatStopJson: (v: string | null) => void;
  chatStreamOptionsJson: string;
  setChatStreamOptionsJson: (v: string | null) => void;
  chatResponseFormatJson: string;
  setChatResponseFormatJson: (v: string | null) => void;
  chatLogitBiasJson: string;
  setChatLogitBiasJson: (v: string | null) => void;
  chatToolsJson: string;
  setChatToolsJson: (v: string | null) => void;
  chatToolChoiceJson: string;
  setChatToolChoiceJson: (v: string | null) => void;
  chatGraphSummaryMaxTokens: number;
  setChatGraphSummaryMaxTokens: (v: number) => void;
  chatGuidelineDigestMaxTokens: number;
  setChatGuidelineDigestMaxTokens: (v: number) => void;
  chatSystemPrompt: string | null;
  chatStorageTarget: 'chatKnowgrph' | 'chatHistory';
  setChatStorageTarget: (target: 'chatKnowgrph' | 'chatHistory') => void;
  chatLocalStorageRootPath: string;
  setChatLocalStorageRootPath: (path: string | null) => void;
  chatKnowgrphStorageMode: 'local' | 'cloud';
  setChatKnowgrphStorageMode: (mode: 'local' | 'cloud') => void;
  chatKnowgrphWorkspacePath: string | null;
  setChatKnowgrphWorkspacePath: (path: string | null) => void;
  chatKnowgrphCloudUrl: string | null;
  setChatKnowgrphCloudUrl: (url: string | null) => void;
  chatHistoryWorkspacePath: string | null;
  setChatHistoryWorkspacePath: (path: string | null) => void;
  chatHistoryStorageMode: 'local' | 'cloud';
  setChatHistoryStorageMode: (mode: 'local' | 'cloud') => void;
  chatHistoryCloudUrl: string | null;
  setChatHistoryCloudUrl: (url: string | null) => void;
  setChatContextScope: (scope: 'selection' | 'workspace' | 'hybrid') => void;
  chatContextScope: 'selection' | 'workspace' | 'hybrid';
  integrationConfigsJson: string;

  youtubeTranscriptOutputDir: string | null;
  setYoutubeTranscriptOutputDir: (v: string | null) => void;

  youtubeTranscriptOutputFormat: 'markdown' | 'json';
  setYoutubeTranscriptOutputFormat: (v: 'markdown' | 'json') => void;

  webpageImportIncludeImages: boolean;
  setWebpageImportIncludeImages: (v: boolean) => void;

  webpageImportView: 'markdown' | 'json' | 'html';
  setWebpageImportView: (v: 'markdown' | 'json' | 'html') => void;

  webpageViewerScriptPolicy: 'strip' | 'allow';
  setWebpageViewerScriptPolicy: (v: 'strip' | 'allow') => void;

  webpageArtifactFidelityMaxLevel: number;
  setWebpageArtifactFidelityMaxLevel: (v: number) => void;

  websiteImportDiscoverSitemap: boolean;
  setWebsiteImportDiscoverSitemap: (v: boolean) => void;

  websiteImportGenerateWebpageArtifactDocs: boolean;
  setWebsiteImportGenerateWebpageArtifactDocs: (v: boolean) => void;
  websiteImportMaxPages: number;
  setWebsiteImportMaxPages: (v: number) => void;
  websiteImportConcurrency: number;
  setWebsiteImportConcurrency: (v: number) => void;
  websiteImportOutputDirRel: string;
  setWebsiteImportOutputDirRel: (v: string) => void;

}
