import { GraphData, GraphNode, GraphEdge, JSONValue } from '@/lib/graph/types';
import { GraphSchema, GraphBehavior, PropertySpec } from '@/lib/graph/schema';
import { ThemeMode, ResolvedThemeMode } from '@/lib/ui/theme';
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
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex';
import type { MarkdownFrontmatter } from '@/lib/markdown'
import type { ZoomCommandType, ZoomFitIntent, ZoomRequest } from '@/lib/zoom/requests'
import type { LayoutMode2d } from '@/lib/graph/layoutMode'
import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import type { Canvas2dRendererId, Canvas3dModeId, CanvasWorkspaceSyncMode, InfiniteCanvasInteractionMode } from '@/lib/config'
import type { DesignLayerNode, DesignLayerState } from '@/features/design/designLayersState'
import type { DesignFramePos, DesignFrameSize } from '@/hooks/store/designRendererSlice'
import type { SaveFilePickerHandle } from '@/lib/graph/save'

export type DesignSystemPageId = 'hub' | 'tokens' | 'utilities'
export type MonacoCapabilityLoadMode = 'lazy' | 'eager'

export type DesignSystemSlice = {
  designSystemRequestedPage: DesignSystemPageId | null
  setDesignSystemRequestedPage: (page: DesignSystemPageId | null) => void
}

export type CanvasSnapshotFns = {
  capturePng?: (pixelRatio?: number) => Promise<Blob | null>;
  captureSvg?: () => Promise<string | null>;
};

export type ThreeCameraPose = {
  position: { x: number; y: number; z: number }
  quaternion: { x: number; y: number; z: number; w: number }
  target: { x: number; y: number; z: number }
  fov?: number
  zoom?: number
}

export type ThreeCameraSnapshotFns = {
  capturePose: () => ThreeCameraPose | null
  restorePose: (pose: ThreeCameraPose) => void
}

export type ThreeGlbSnapshotFns = {
  captureGlb: () => Promise<Blob | null>
}

export type ThreeLayoutSnapshotFns = {
  capturePositions: () => Record<string, [number, number, number]> | null
}

export type GraphDataTableScope = 'all' | 'nodes' | 'edges';

export type GraphDataTableFreezeMode = 'none' | 'label' | 'id';

export type LayoutMode = LayoutMode2d;
export type NodePosition2d = { x: number; y: number };
export type LayoutPositionCacheKey = string;

export type DocumentSemanticMode = 'document' | 'keyword'

export type BottomTab = 'stats' | 'render' | 'settings' | 'history'

export type SchemaBySemanticMode = Record<DocumentSemanticMode, GraphSchema>

export type WorkspaceViewMode = 'canvas' | 'editor'

export type EditorWorkspacePane = 'markdown' | 'graphTable'

export type PdfImportProvider = 'native' | 'docling-remote'

export type PdfImportOcrMode = 'fallback' | 'always'

export type DocumentStructureBaselineSnapshot = {
  documentSemanticMode: DocumentSemanticMode
  frontmatterModeEnabled: boolean
  canvasRenderMode: '2d' | '3d'
  canvas3dMode: Canvas3dModeId
  canvas2dRenderer: Canvas2dRendererId
  canvasRenderModeLastFree: '2d' | '3d'
  canvasRenderModeIsAuto: boolean
  viewPinned: boolean
  fitToScreenMode: boolean
  zoomToSelectionMode: boolean
  zoomState: null | { k: number; x: number; y: number; graphDataRevision?: number; viewportW?: number; viewportH?: number }
  zoomStateByKey: Record<string, { k: number; x: number; y: number; graphDataRevision?: number; viewportW?: number; viewportH?: number }>
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedGroupId: string | null
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  selectedGroupIds: string[]
  collapsedGroupIds: string[]
}

export type UiToastKind = 'neutral' | 'success' | 'warning' | 'error'

export type UiToast = {
  id: string
  kind: UiToastKind
  message: string
  createdAtMs: number
  expiresAtMs: number | null
  dismissible: boolean
}

export type UiToastInput = {
  id: string
  kind?: UiToastKind
  message: string
  ttlMs?: number | null
  dismissible?: boolean
  log?: boolean
}

export type UiLogKind = UiToastKind

export type UiLogEntry = {
  id: string
  kind: UiLogKind
  message: string
  tsMs: number
  source: string | null
}

export type UiLogEntryInput = {
  kind?: UiLogKind
  message: string
  tsMs?: number
  source?: string | null
}

export type ChatExchangeLogEntry = {
  id: string
  request: string
  response: string
  snippet: string
  tsMs: number
  status: 'ok' | 'error' | 'aborted'
  model: string | null
}

export type ChatExchangeLogEntryInput = {
  request: string
  response: string
  snippet?: string
  tsMs?: number
  status?: 'ok' | 'error' | 'aborted'
  model?: string | null
}

export type GraphHoverPreviewConfig = {
  showNodeId: boolean;
  showNodeName: boolean;
  showNodeLabel: boolean;
  showNodeDescription: boolean;
  showNodeProperties: boolean;
  showEdgeId: boolean;
  showEdgeLabel: boolean;
  showEdgeWeight: boolean;
  showEdgeProperties: boolean;
};

export type RecentFileEntry = {
  id: string
  name: string
  path?: string
  url?: string
  timestamp: number
  type: 'json' | 'jsonld' | 'markdown' | 'csv' | 'graphml' | 'cypher' | 'url' | 'html'
}

export type SourceFile = {
  id: string
  name: string
  text: string
  enabled: boolean
  geoLayerEnabled?: boolean
  status: 'idle' | 'loading' | 'parsed' | 'error'
  error?: string
  parsedParserId?: string
  parsedTextHash?: string
  parsedGraphRevision?: number
  parsedGraphData?: GraphData
  source?: {
    kind: 'url' | 'local'
    url?: string
    path?: string
  }
}

export type LocalMarkdownFolderAccessMode = 'fs-access' | 'opfs' | 'file-input'

export interface GraphState {
  graphData: GraphData | null;
  graphContentRevision: number;
  docLocationRevision: number;

  sourceFiles: SourceFile[];
  setSourceFiles: (files: SourceFile[]) => void;
  addSourceFile: (file: SourceFile) => void;
  updateSourceFile: (id: string, updates: Partial<SourceFile>) => void;
  removeSourceFile: (id: string) => void;
  toggleSourceFile: (id: string) => void;
  setSourceFileName: (id: string, name: string) => void;
  setSourceFileGeoLayerEnabled: (id: string, enabled: boolean) => void;
  setSourceFileStatus: (id: string, status: SourceFile['status'], error?: string) => void;
  reorderSourceFiles: (sourceId: string, targetId: string) => void;
  clearSourceFiles: () => void;

  localMarkdownFolderHandle: FileSystemDirectoryHandle | null
  localMarkdownFolderName: string | null
  localMarkdownFolderAccessMode: LocalMarkdownFolderAccessMode | null
  localMarkdownFolderCacheId: string | null
  localMarkdownSelectedFolderPath: string | null
  setLocalMarkdownFolderHandle: (
    handle: FileSystemDirectoryHandle | null,
    opts?: { accessMode?: 'fs-access' | 'opfs'; name?: string | null },
  ) => void
  setLocalMarkdownFolderCachedMetadata: (meta: {
    name: string | null
    accessMode: LocalMarkdownFolderAccessMode | null
  }) => void
  setLocalMarkdownFolderCacheId: (cacheId: string | null, folderName?: string | null) => void
  setLocalMarkdownSelectedFolderPath: (path: string | null) => void
  clearLocalMarkdownFolder: () => void

  htmlCanvasPublishFolderHandle: FileSystemDirectoryHandle | null
  htmlCanvasPublishFolderName: string | null
  htmlCanvasPublishFileHandle: SaveFilePickerHandle | null
  htmlCanvasPublishFileName: string | null
  htmlCanvasPublishPath: string
  setHtmlCanvasPublishFolder: (handle: FileSystemDirectoryHandle | null, folderName?: string | null) => void
  setHtmlCanvasPublishFile: (handle: SaveFilePickerHandle | null, fileName?: string | null) => void
  setHtmlCanvasPublishPath: (path: string) => void
  clearHtmlCanvasPublishTarget: () => void

  graphDataRevision: number;
  documentSemanticMode: DocumentSemanticMode;
  setDocumentSemanticMode: (mode: DocumentSemanticMode) => void;
  keywordSourceMaxLines: number;
  keywordSourceMaxChars: number;
  keywordGraphPreviewDebounceMs: number;
  keywordGraphFullDebounceMs: number;
  keywordGraphEdgesPerNode: number;
  keywordGraphMaxEdgesCap: number;
  keywordGraphMentionEdgesPerSourceNode: number;
  setKeywordSourceMaxLines: (v: number) => void;
  setKeywordSourceMaxChars: (v: number) => void;
  setKeywordGraphPreviewDebounceMs: (v: number) => void;
  setKeywordGraphFullDebounceMs: (v: number) => void;
  setKeywordGraphEdgesPerNode: (v: number) => void;
  setKeywordGraphMaxEdgesCap: (v: number) => void;
  setKeywordGraphMentionEdgesPerSourceNode: (v: number) => void;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedGroupId: string | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectedGroupIds: string[];
  collapsedGroupIds: string[];
  collapsedGroupIdsByGraphMetaKey: Record<string, string[]>;
  openQuickEditorNodeIds: string[];
  openQuickEditorNodeIdsByRenderer: Partial<Record<Canvas2dRendererId, string[]>>;
  flowNodeQuickEditorPinnedByNodeId: Record<string, boolean>;
  flowNodeQuickEditorPinnedByNodeIdByGraphMetaKey: Record<string, Record<string, boolean>>;
  flowNodeQuickEditorPosByNodeId: Record<string, { top: number; left: number }>;
  flowNodeQuickEditorPosByNodeIdByGraphMetaKey: Record<string, Record<string, { top: number; left: number }>>;
  flowNodeQuickEditorWorldPosByNodeId: Record<string, { x: number; y: number }>;
  flowNodeQuickEditorWorldPosByNodeIdByGraphMetaKey: Record<string, Record<string, { x: number; y: number }>>;
  flowNodeQuickEditorDraggingNodeId: string | null;
  graphFieldsOpOk: boolean | null;
  graphFieldsOpMsg: string;
  orchestratorOpOk: boolean | null;
  orchestratorOpMsg: string;
  renderOpOk: boolean | null;
  renderOpMsg: string;
  selectionSource: null | 'canvas' | 'menu' | 'toolbar' | 'editor' | 'unknown';
  setSelectionSource: (src: null | 'canvas' | 'menu' | 'toolbar' | 'editor' | 'unknown') => void;
  setFlowNodeQuickEditorPinnedByNodeId: (pinnedById: Record<string, boolean>) => void;

  isEditMode: boolean;
  workspaceViewMode: WorkspaceViewMode;
  editorWorkspacePane: EditorWorkspacePane
  setEditorWorkspacePane: (pane: EditorWorkspacePane) => void
  workspaceCanvasPaneOpen: boolean
  setWorkspaceCanvasPaneOpen: (open: boolean) => void
  documentStructureBaselineLock: boolean;
  documentStructureBaselineSnapshot: DocumentStructureBaselineSnapshot | null
  setDocumentStructureBaselineLock: (enabled: boolean) => void;
  history: Array<{ id: string; label: string; timestamp: number; graphData: GraphData; graphFieldSettingsById?: GraphFieldSettingsById }>;
  historyIndex: number;
  recentFiles: RecentFileEntry[];
  historyDebounceMs: number;
  schema: GraphSchema;
  schemaBySemanticMode?: SchemaBySemanticMode | null;
  layoutPositionCacheByMode: Partial<Record<LayoutPositionCacheKey, Record<string, NodePosition2d>>>;
  setLayoutPositionsForMode: (key: LayoutPositionCacheKey, positions: Record<string, NodePosition2d> | null) => void;
  schemaImportLabel: string | null;
  schemaOpOk: boolean | null;
  schemaOpMsg: string;
  graphValidationStatus: 'valid' | 'invalid' | null;
  graphValidationTimestamp: number | null;
  setGraphValidationResult: (status: 'valid' | 'invalid' | null, timestamp: number | null) => void;
  setSchemaImportLabel: (label: string | null) => void;
  setSchemaOpStatus: (ok: boolean | null, msg: string) => void;
  setGraphFieldsOpStatus: (ok: boolean | null, msg: string) => void;
  setOrchestratorOpStatus: (ok: boolean | null, msg: string) => void;
  setRenderOpStatus: (ok: boolean | null, msg: string) => void;

  nodeQuickEditorRegistry: NodeQuickEditorRegistryEntry[]
  documentNodeQuickEditorRegistry: NodeQuickEditorRegistryEntry[]
  effectiveNodeQuickEditorRegistry: NodeQuickEditorRegistryEntry[]
  setNodeQuickEditorRegistry: (entries: NodeQuickEditorRegistryEntry[]) => void
  setDocumentNodeQuickEditorRegistry: (entries: NodeQuickEditorRegistryEntry[]) => void
  upsertNodeQuickEditorRegistryEntry: (
    entry: Omit<NodeQuickEditorRegistryEntry, 'id' | 'updatedAt'> & { id?: string | null },
  ) => { ok: true; id: string } | { ok: false; message: string }
  removeNodeQuickEditorRegistryEntry: (id: string) => void
  toggleNodeQuickEditorRegistryEntryEnabled: (id: string, enabled?: boolean) => void

  designLayerState: DesignLayerState
  designLayerStateByGraphMetaKey: Record<string, DesignLayerState>
  setDesignLayerState: (next: DesignLayerState) => void
  normalizeDesignLayerStateFromNodes: (nodes: DesignLayerNode[]) => void
  toggleDesignLayerHidden: (id: string) => void
  moveDesignLayer: (id: string, dir: 'up' | 'down') => void

  designWireframeCacheEpoch: number
  bumpDesignWireframeCacheEpoch: () => void

  designRendererNodes: DesignLayerNode[]
  setDesignRendererNodes: (nodes: DesignLayerNode[]) => void

  designRendererWebpageLayoutKey: string | null
  designRendererGraphNodesById: Record<string, GraphNode>
  setDesignRendererWebpageGraph: (args: { key: string | null; nodesById: Record<string, GraphNode> }) => void

  designFramePosById: Record<string, DesignFramePos>
  setDesignFramePos: (id: string, pos: DesignFramePos) => void
  setDesignFramePosMany: (patch: Record<string, DesignFramePos>) => void
  clearDesignFramePos: (id: string) => void
  clearAllDesignFramePos: () => void

  designFrameSizeById: Record<string, DesignFrameSize>
  setDesignFrameSize: (id: string, size: DesignFrameSize) => void
  setDesignFrameSizeMany: (patch: Record<string, DesignFrameSize>) => void
  clearDesignFrameSize: (id: string) => void
  clearAllDesignFrameSize: () => void
  lifecycleStage: 'idle' | 'reset' | 'hydrated' | 'committed' | 'rendering' | 'selectionUpdate' | 'edgeMutate' | 'zoomUpdate' | 'minimapQuick' | 'minimapAsync';
  setLifecycleStage: (stage: 'idle' | 'reset' | 'hydrated' | 'committed' | 'rendering' | 'selectionUpdate' | 'edgeMutate' | 'zoomUpdate' | 'minimapQuick' | 'minimapAsync') => void;
  setGraphData: (data: GraphData) => void;
  setGraphDataPreservingLayout: (data: GraphData) => void;
  resyncGraphFieldsFromGraphData: () => void;
  clearGraphData: () => void;
  updateNode: (id: string, updates: Partial<GraphNode>) => void;
  flushComposedPositionWritesNow: () => void;
  updateEdge: (id: string, updates: Partial<GraphEdge>) => void;
  addNode: (node: GraphNode) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: GraphEdge) => void;
  removeEdge: (id: string) => void;
  createUserSubgraph: (args: { label?: string; memberNodeIds: string[]; parentId?: string | null; kind?: 'subgraph' | 'cluster' }) => { ok: true; id: string } | { ok: false; message: string };
  updateUserSubgraph: (id: string, patch: { label?: string; memberNodeIds?: string[]; parentId?: string | null; kind?: 'subgraph' | 'cluster' }) => { ok: true } | { ok: false; message: string };
  removeUserSubgraph: (id: string) => void;
  addNodesToUserSubgraph: (id: string, nodeIds: string[]) => { ok: true } | { ok: false; message: string };
  removeNodesFromUserSubgraph: (id: string, nodeIds: string[]) => { ok: true } | { ok: false; message: string };
  selectNode: (id: string | null) => void;
  selectNodesExpanded: (args: { nodeIds: string[]; edgeIds?: string[]; groupIds?: string[]; activeNodeId?: string | null }) => void;
  selectEdge: (id: string | null) => void;
  selectGroup: (id: string | null) => void;
  selectGroupExpanded: (args: { id: string; nodeIds: string[]; edgeIds: string[] }) => void;
  setCollapsedGroupIds: (ids: string[]) => void;
  clearCollapsedGroups: () => void;
  toggleGroupCollapsed: (id: string) => void;
  setOpenQuickEditorNodeIds: (ids: string[]) => void;
  updateOpenQuickEditorNodeIds: (updater: (prev: string[]) => string[]) => void;
  setFlowNodeQuickEditorPosByNodeId: (pos: Record<string, { top: number; left: number }>) => void;
  setFlowNodeQuickEditorWorldPosByNodeId: (pos: Record<string, { x: number; y: number }>) => void;
  setFlowNodeQuickEditorDraggingNodeId: (id: string | null) => void;
  setEditMode: (mode: boolean) => void;
  setWorkspaceViewMode: (mode: WorkspaceViewMode) => void;
  toggleWorkspaceViewMode: () => void;
  addHistory: (label?: string) => void;
  addRecentFile: (entry: Omit<RecentFileEntry, 'id' | 'timestamp'>) => void;
  restoreHistory: (index: number) => void;
  undoHistory: () => void;
  redoHistory: () => void;
  scheduleHistory: (label: string) => void;
  setHistoryDebounceMs: (ms: number) => void;
  replaceHistoryState: (
    history: Array<{ id: string; label: string; timestamp: number; graphData: GraphData; graphFieldSettingsById?: GraphFieldSettingsById }>,
    historyIndex: number,
  ) => void;
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
  setMediaPanelDensity: (v: 'default' | 'compact') => void;
  mediaPanelDensity: 'default' | 'compact';
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
  chatExchangeLogs: ChatExchangeLogEntry[];
  pushChatExchangeLog: (entry: ChatExchangeLogEntryInput) => void;
  clearChatExchangeLogs: () => void;
  mediaNodeOpacity: number;
  chatProvider: string;
  chatApiKey: string;
  chatEndpointUrl: string | null;
  chatModel: string | null;
  chatTemperature: number;
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

  autoEnableGeospatialOnGeoImport: boolean;
  setAutoEnableGeospatialOnGeoImport: (v: boolean) => void;

  pdfImportIncludeImages: boolean;
  pdfImportMaxPages: number;
  pdfImportMaxPdfBytes: number;
  pdfImportFetchTimeoutMs: number;
  pdfImportUploadTimeoutMs: number;
  pdfImportConvertTimeoutMs: number;
  pdfImportStreamDecodeCacheMaxBytes: number;
  pdfImportContentStreamMaxDecodeBytes: number;
  pdfImportPageContentMaxBytes: number;
  pdfImportCmapMaxBytes: number;
  pdfImportMaxToUnicodeStreamBytes: number;
  pdfImportToUnicodeMaxDecodeBytes: number;
  pdfImportImageStreamMaxDecodeBytes: number;
  pdfImportMaxTextContentBytesPerPage: number;
  pdfImportMaxTextStreamBytes: number;
  pdfImportMaxFormXObjectBytes: number;
  pdfImportMaxFormXObjectStreamBytes: number;
  pdfImportMaxFormXObjectCount: number;
  pdfImportEmbedImages: boolean;
  pdfImportMaxExtractedImagesPerPage: number;
  pdfImportMaxEmbeddedImagesPerPage: number;
  pdfImportMaxEmbeddedTotalBytes: number;
  pdfImportMaxEmbeddedAssetBytes: number;
  pdfImportReconstructTables: boolean;
  pdfImportTableMinColumns: number;
  pdfImportTableMinRows: number;
  pdfImportTableMaxRows: number;
  pdfImportProvider: PdfImportProvider;
  pdfImportDoclingEndpoint: string | null;
  pdfImportProviderFallbackToNative: boolean;
  pdfImportOcrEnabled: boolean;
  pdfImportOcrMode: PdfImportOcrMode;
  bottomPanelHeightRatio: number;
  bottomPanelCollapsed: boolean;
  floatingPanelWidthRatio: number;
  floatingPanelHeightRatio: number;
  floatingPanelZIndex: number;
  bottomPanelTab: BottomTab;
  launchSpotlightMode: 'tour' | 'stats';
  enableLaunchSpotlight: boolean;
  statusPanelPinned: boolean;
  frontmatterModeEnabled: boolean;
  multiDimTableModeEnabled: boolean;
  schemaDeriveCacheCapacity: number;
  graphFieldSettingsById: GraphFieldSettingsById;
  selectedGraphFieldId: GraphFieldId | null;
  graphRagWorkflowJsonText: string | null;
  graphDataTableVisibleColumns: GraphDataTableColumnVisibilityByKey;
  graphDataTableColumnOrder: GraphDataTableColumnKey[];
  graphDataTableAggregateKeys: GraphDataTableColumnKey[];
  graphDataTableFilterMatch: GraphDataTableFilterMatch;
  graphDataTableFilterClauses: GraphDataTableFilterClause[];
  graphDataTableSortRules: GraphDataTableSortRule[];
  graphDataTableGroupKey: GraphDataTableColumnKey | '';
  graphDataTableAutoSortEnabled: boolean;
  graphDataTableRowDensity: GraphDataTableRowDensity;
  graphDataTableDisableAutoScroll: boolean;
  graphDataTableColumnWidths: Partial<Record<GraphDataTableColumnKey, number>>;
  graphDataTableFreezeFirstDataColumn: GraphDataTableFreezeMode;
  graphDataTableFreezeFirstDataColumnByScope: Record<GraphDataTableScope, GraphDataTableFreezeMode>;
  graphDataTableAggregateDefaultVizMode: 'none' | 'radial' | 'bars' | 'sparkline';
  graphDataTableAggregateIncludeMixedNumericFields: boolean;
  graphDataTableAggregateIncludeIdAsNumeric: boolean;
  graphDataTableAggregateIncludeSourceAsNumeric: boolean;
  graphDataTableAggregateIncludeTargetAsNumeric: boolean;
  graphDataTableNumericSampleLimit: number;
  graphDataTableNumericSampleMinCount: number;
  graphDataTableNumericSampleMinRatio: number;
  spotlightMargin: number;
  spotlightNearTopThreshold: number;
  graphDataTableFrozenDragStepNoneLabelPx: number;
  graphDataTableFrozenDragStepLabelIdPx: number;
  graphDataTableVirtualOverscanRows: number;
  graphDataTableOverscanMultiplier: number;
  graphDataTableVirtualMinRows: number;
  graphDataTableVirtualDebugLogRanges: boolean;
  graphHoverPreviewConfig: GraphHoverPreviewConfig;
  setGraphHoverPreviewConfig: (config: Partial<GraphHoverPreviewConfig>) => void;
  markdownDocumentName: string | null;
  markdownDocumentText: string | null;
  markdownTokens: TokenWithLines[] | null;
  markdownTokensPath: string | null;
  markdownTokensKey: string | null;
  markdownTokensMeta: MarkdownFrontmatter | null;
  markdownTokensStartLineOffset: number | null;
  markdownDocumentSourceUrl: string | null;
  jsonSourceDocumentText: string | null;
  markdownPreviewMermaidFocusCode: string | null;
  markdownPreviewMermaidFocusConfig: Record<string, unknown> | null;
  markdownPreviewActiveMediaKey: string | null;
  setMarkdownTokens: (args: {
    tokens: TokenWithLines[] | null
    path?: string | null
    key?: string | null
    meta?: MarkdownFrontmatter | null
    startLineOffset?: number | null
  }) => void;
  setUiIconScale: (scale: 'compact' | 'default') => void;
  setUiOverlayOpacity: (v: number) => void;
  setUiPanelOpacity: (v: number) => void;
  setUiToolbarOpacity: (v: number) => void;
  setMediaNodeOpacity: (v: number) => void;
  setChatProvider: (provider: string) => void;
  setChatApiKey: (apiKey: string | null) => void;
  setChatEndpointUrl: (url: string | null) => void;
  setChatModel: (model: string | null) => void;
  setChatTemperature: (v: number) => void;
  setChatSystemPrompt: (v: string | null) => void;
  setIntegrationConfigsJson: (v: string | null) => void;

  setPdfImportIncludeImages: (v: boolean) => void;
  setPdfImportMaxPages: (v: number) => void;
  setPdfImportMaxPdfBytes: (v: number) => void;
  setPdfImportFetchTimeoutMs: (v: number) => void;
  setPdfImportUploadTimeoutMs: (v: number) => void;
  setPdfImportConvertTimeoutMs: (v: number) => void;
  setPdfImportStreamDecodeCacheMaxBytes: (v: number) => void;
  setPdfImportContentStreamMaxDecodeBytes: (v: number) => void;
  setPdfImportPageContentMaxBytes: (v: number) => void;
  setPdfImportCmapMaxBytes: (v: number) => void;
  setPdfImportMaxToUnicodeStreamBytes: (v: number) => void;
  setPdfImportToUnicodeMaxDecodeBytes: (v: number) => void;
  setPdfImportImageStreamMaxDecodeBytes: (v: number) => void;
  setPdfImportMaxTextContentBytesPerPage: (v: number) => void;
  setPdfImportMaxTextStreamBytes: (v: number) => void;
  setPdfImportMaxFormXObjectBytes: (v: number) => void;
  setPdfImportMaxFormXObjectStreamBytes: (v: number) => void;
  setPdfImportMaxFormXObjectCount: (v: number) => void;
  setPdfImportEmbedImages: (v: boolean) => void;
  setPdfImportMaxExtractedImagesPerPage: (v: number) => void;
  setPdfImportMaxEmbeddedImagesPerPage: (v: number) => void;
  setPdfImportMaxEmbeddedTotalBytes: (v: number) => void;
  setPdfImportMaxEmbeddedAssetBytes: (v: number) => void;
  setPdfImportReconstructTables: (v: boolean) => void;
  setPdfImportTableMinColumns: (v: number) => void;
  setPdfImportTableMinRows: (v: number) => void;
  setPdfImportTableMaxRows: (v: number) => void;
  setPdfImportProvider: (v: PdfImportProvider) => void;
  setPdfImportDoclingEndpoint: (v: string | null) => void;
  setPdfImportProviderFallbackToNative: (v: boolean) => void;
  setPdfImportOcrEnabled: (v: boolean) => void;
  setPdfImportOcrMode: (v: PdfImportOcrMode) => void;
  setBottomPanelHeightRatio: (v: number) => void;
  setBottomPanelCollapsed: (v: boolean) => void;
  setFloatingPanelWidthRatio: (v: number) => void;
  setFloatingPanelHeightRatio: (v: number) => void;
  setFloatingPanelZIndex: (v: number) => void;
  setBottomPanelTab: (tab: BottomTab) => void;
  setLaunchSpotlightMode: (mode: 'tour' | 'stats') => void;
  setEnableLaunchSpotlight: (v: boolean) => void;
  setStatusPanelPinned: (v: boolean) => void;
  setFrontmatterModeEnabled: (enabled: boolean) => void;
  setMultiDimTableModeEnabled: (enabled: boolean) => void;
  setSchemaDeriveCacheCapacity: (n: number) => void;
  setGraphFieldSettingsById: (next: GraphFieldSettingsById) => void;
  setSelectedGraphFieldId: (id: GraphFieldId | null) => void;
  setGraphRagWorkflowJsonText: (text: string | null) => void;
  setGraphDataTableVisibleColumns: (next: GraphDataTableColumnVisibilityByKey) => void;
  setGraphDataTableColumnOrder: (next: GraphDataTableColumnKey[]) => void;
  setGraphDataTableAggregateKeys: (next: GraphDataTableColumnKey[]) => void;
  setGraphDataTableFilterMatch: (match: GraphDataTableFilterMatch) => void;
  setGraphDataTableFilterClauses: (
    updater: GraphDataTableFilterClause[] | ((prev: GraphDataTableFilterClause[]) => GraphDataTableFilterClause[]),
  ) => void;
  setGraphDataTableSortRules: (
    updater: GraphDataTableSortRule[] | ((prev: GraphDataTableSortRule[]) => GraphDataTableSortRule[]),
  ) => void;
  setGraphDataTableGroupKey: (key: GraphDataTableColumnKey | '') => void;
  setGraphDataTableAutoSortEnabled: (v: boolean) => void;
  setGraphDataTableRowDensity: (v: GraphDataTableRowDensity) => void;
  setGraphDataTableDisableAutoScroll: (v: boolean) => void;
  setGraphDataTableColumnWidth: (key: GraphDataTableColumnKey, width: number) => void;
  setGraphDataTableFreezeFirstDataColumn: (scope: GraphDataTableScope, v: GraphDataTableFreezeMode) => void;
  setGraphDataTableAggregateDefaultVizMode: (v: 'none' | 'radial' | 'bars' | 'sparkline') => void;
  setGraphDataTableAggregateIncludeMixedNumericFields: (v: boolean) => void;
  setGraphDataTableAggregateIncludeIdAsNumeric: (v: boolean) => void;
  setGraphDataTableAggregateIncludeSourceAsNumeric: (v: boolean) => void;
  setGraphDataTableAggregateIncludeTargetAsNumeric: (v: boolean) => void;
  setGraphDataTableNumericSampleLimit: (v: number) => void;
  setGraphDataTableNumericSampleMinCount: (v: number) => void;
  setGraphDataTableNumericSampleMinRatio: (v: number) => void;
  setSpotlightMargin: (v: number) => void;
  setSpotlightNearTopThreshold: (v: number) => void;
  setGraphDataTableFrozenDragStepNoneLabelPx: (v: number) => void;
  setGraphDataTableFrozenDragStepLabelIdPx: (v: number) => void;
  setGraphDataTableVirtualOverscanRows: (v: number) => void;
  setGraphDataTableOverscanMultiplier: (v: number) => void;
  setGraphDataTableVirtualMinRows: (v: number) => void;
  setGraphDataTableVirtualDebugLogRanges: (v: boolean) => void;
  setMarkdownDocument: (name: string | null, text: string | null, opts?: { autoEnableFrontmatter?: boolean }) => void;
  setActiveMarkdownDocument: (args: {
    name: string
    text: string
    sourceUrl?: string | null
    jsonSourceText?: string | null
    autoEnableFrontmatter?: boolean
    workspaceViewMode?: WorkspaceViewMode | null
    recent?: Omit<RecentFileEntry, 'id' | 'timestamp'> | null
    applyToGraph?: boolean
    forceApplyToGraph?: boolean
    normalizeMermaidMmd?: boolean
  }) => Promise<boolean>
  applyMarkdownDocumentToGraph: (
    name: string,
    text: string,
    opts?: { force?: boolean },
  ) => Promise<boolean>;
  setJsonSourceDocument: (name: string | null, text: string | null) => void;
  setMarkdownDocumentSourceUrl: (url: string | null) => void;
  setMarkdownPreviewMermaidFocus: (
    focus: { code: string; frontmatterConfig: Record<string, unknown> | null } | null,
  ) => void;
  setMarkdownPreviewActiveMediaKey: (key: string | null) => void;
  setUiPanelKeyValueTextSizeClass: (className: string) => void;
  setUiPanelTextFontClass: (className: string) => void;
  setUiPanelKeyValueInputClass: (className: string) => void;
  setUiPanelRowDensityDefaultClass: (className: string) => void;
  setUiPanelRowDensityCompactClass: (className: string) => void;
  setUiPanelMonospaceTextClass: (className: string) => void;
  setUiPanelMicroLabelTextSizeClass: (className: string) => void;
  setUiHeaderRowHeightClass: (className: string) => void;
  setUiHeaderRowPaddingClass: (className: string) => void;
  setUiSectionHeaderRowHeightClass: (className: string) => void;
  setUiSectionHeaderRowPaddingClass: (className: string) => void;
  setUiIconFormat: (format: 'default' | 'minimal' | '1') => void;
  setUiIconStrokeWidth: (width: number) => void;
  setUiIconColorClass: (className: string) => void;
  setUiIconHoverBgClass: (className: string) => void;
  setUiIconButtonPaddingClass: (className: string) => void;
  setUiIconPillClass: (className: string) => void;
  setUiIconPillLegendTextSizeClass: (className: string) => void;
  setUiIconPillBadgeTextSizeClass: (className: string) => void;
  setUiIconBadgeChipClass: (className: string) => void;
  setUiIconBadgeChipTextSizeClass: (className: string) => void;
  setUiIconAnimationEnabled: (v: boolean) => void;
  setSelectionFlashDurationMs: (v: number) => void;
  setSelectionFlashOpacity: (v: number) => void;
  setMarkdownSelectionFlashMode: (v: 'auto' | 'manual') => void;
  canvasDims: { w: number; h: number };
  canvasPos: { x: number; y: number };
  setCanvasDims: (d: { w: number; h: number }) => void;
  setCanvasPos: (p: { x: number; y: number }) => void;
  viewPinned: boolean;
  setViewPinned: (v: boolean) => void;
  toggleViewPinned: () => void;
  fitToScreenMode: boolean;
  setFitToScreenMode: (v: boolean) => void;
  toggleFitToScreenMode: () => void;
  zoomToSelectionMode: boolean;
  setZoomToSelectionMode: (v: boolean) => void;
  toggleZoomToSelectionMode: () => void;
  zoomRequest: ZoomRequest | null;
  requestZoom: (type: ZoomCommandType, opts?: { intent?: ZoomFitIntent }) => void;
  requestZoomTransform: (payload: { k: number; x: number; y: number }) => void;
  requestZoomBounds: (payload: { bounds: { x: number; y: number; w: number; h: number }; insetPx?: number; origin?: { x: number; y: number } }) => void;
  clearZoomRequest: () => void;

  canvasPointerMode2d: 'select' | 'pan';
  canvasPointerMode2dByRenderer: Partial<Record<Canvas2dRendererId, 'select' | 'pan'>>;
  setCanvasPointerMode2d: (mode: 'select' | 'pan') => void;

  graphCanvasArrangeRequest: null | (
    | { type: 'center'; scope: 'selection' | 'all'; at: number }
    | { type: 'distribute'; axis: 'x' | 'y'; at: number }
  );
  requestGraphCanvasArrange: (req: { type: 'center'; scope: 'selection' | 'all' } | { type: 'distribute'; axis: 'x' | 'y' }) => void;
  clearGraphCanvasArrangeRequest: () => void;
  zoomState: null | { k: number; x: number; y: number; graphDataRevision?: number; viewportW?: number; viewportH?: number };
  setZoomState: (z: { k: number; x: number; y: number; graphDataRevision?: number; viewportW?: number; viewportH?: number }) => void;
  zoomStateByKey: Record<string, { k: number; x: number; y: number; graphDataRevision?: number; viewportW?: number; viewportH?: number }>
  setZoomStateForKey: (
    key: string,
    z: { k: number; x: number; y: number; graphDataRevision?: number; viewportW?: number; viewportH?: number } | null,
  ) => void
  threeCameraRequest: null | { type: 'in' | 'out' | 'fit' | 'reset' | 'selection'; at: number };
  requestThreeCamera: (type: 'in' | 'out' | 'fit' | 'reset' | 'selection') => void;
  clearThreeCameraRequest: () => void;
  edgeCreationRequest: null | { type: 'create' | 'update-source' | 'update-target'; fromId: string; at: number };
  requestEdgeCreation: (req: { type: 'create' | 'update-source' | 'update-target'; fromId: string }) => void;
  clearEdgeCreationRequest: () => void;
  minimapPreview: { nodesPath: string; edgesPath: string; sx: number; bounds: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } };
  minimapAbortController: AbortController | null;
  cancelMinimapWorker: () => void;
  computeMinimapPreviewQuick: () => void;
  computeMinimapPreviewAsync: () => void;
  setSchema: (schema: GraphSchema) => void;
  updateNodeStyle: (type: string, style: Partial<{ color: string }>) => void;
  updateEdgeStyle: (label: string, style: Partial<{ color: string; width: number }>) => void;
  setBehavior: (b: Partial<GraphBehavior>) => void;
  updateNodeSize: (type: string, size: Partial<{ radius: number }>) => void;
  updateNodeStroke: (type: string, stroke: Partial<{ color: string; width: number }>) => void;
  setLabelStyles: (styles: Partial<{ fontSize: number; color: string }>) => void;
  setLabelOffset: (off: Partial<{ dx: number; dy: number }>) => void;
  setLinkDistanceByLabel: (label: string, dist: number) => void;
  setCharge: (val: number) => void;
  setCollisionByType: (type: string, radius: number) => void;
  setAlphaDecay: (val: number) => void;
  setThreeConfig: (cfg: Partial<GraphSchema['three']>) => void;
  upsertNodeValidation: (type: string, v: Partial<{ required?: string[]; types?: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'>; patterns?: Record<string, string>; ranges?: Record<string, { min?: number; max?: number }>; uniqueness?: string[]; severity?: 'error' | 'warn' }>) => void;
  upsertEdgeValidation: (label: string, v: Partial<{ required?: string[]; types?: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'>; patterns?: Record<string, string>; ranges?: Record<string, { min?: number; max?: number }>; uniqueness?: string[]; severity?: 'error' | 'warn' }>) => void;
  setEndpointMatrix: (label: string, sources: string[], targets: string[]) => void;
  setCardinalityNodeType: (type: string, minEdges?: number, maxEdges?: number) => void;
  setCardinalityEdgeLabel: (label: string, maxPerNode?: number) => void;
  setNodeTemplate: (type: string, tpl: Record<string, JSONValue>) => void;
  setEdgeTemplate: (label: string, tpl: Record<string, JSONValue>) => void;
  setLodHideLabelsBelow: (scale: number) => void;
  setHighContrast: (v: boolean) => void;
  setNodeShape: (type: string, shape: 'circle' | 'rect' | 'diamond' | 'hex' | 'image') => void;
  setEdgeArrow: (label: string, arrow: boolean) => void;
  setSelectMode: (mode: 'single' | 'multi' | 'lasso') => void;
  setCreateMode: (mode: 'shift-drag' | 'click-source-target' | 'panel-only') => void;
  setHover: (v: Partial<{ intensity: number; debounceMs: number }>) => void;
  setSerialization: (v: Partial<GraphSchema['serialization']>) => void;
  addNodeType: (type: string) => void;
  renameNodeType: (oldType: string, newType: string) => void;
  removeNodeType: (type: string) => void;
  addEdgeLabel: (label: string) => void;
  renameEdgeLabel: (oldLabel: string, newLabel: string) => void;
  removeEdgeLabel: (label: string) => void;
  upsertNodeProperty: (type: string, key: string, spec: PropertySpec) => void;
  removeNodeProperty: (type: string, key: string) => void;
  upsertEdgeProperty: (label: string, key: string, spec: PropertySpec) => void;
  removeEdgeProperty: (label: string, key: string) => void;
  graphId: string;
  tabId: string;
  enableTabSync: boolean;
  enableVirtualTables: boolean;
  aiKgTraversalRan: boolean;
  requestAiKgTraversal: boolean;
  schemaLastExportHash: string | null;
  schemaLintCount: number | null;
  schemaLintExamplePath: string | null;
  schemaLintExamplePaths: string[] | null;
  setGraphId: (id: string) => void;
  setEnableTabSync: (v: boolean) => void;
  setEnableVirtualTables: (v: boolean) => void;
  setAiKgTraversalRan: (v: boolean) => void;
  setRequestAiKgTraversal: (v: boolean) => void;
  lastTraversalSummary: TraversalSummary | null;
  setLastTraversalSummary: (summary: TraversalSummary | null) => void;
  setSchemaLastExportSnapshot: (schema: GraphSchema | null) => void;
  setSchemaLintSummary: (count: number, examplePath: string | null, examplePaths?: string[] | null) => void;
  setSchemaLintActivePath: (examplePath: string | null) => void;
  clearSchemaLintSummary: () => void;
  canvasRenderMode: '2d' | '3d';
  canvas3dMode: Canvas3dModeId;
  canvas2dRenderer: Canvas2dRendererId;
  viewportControlsPreset: ViewportControlsPreset;
  infiniteCanvasInteractionMode: InfiniteCanvasInteractionMode;
  canvasWorkspaceSyncMode: CanvasWorkspaceSyncMode;
  flowEditorSelectionOnDrag: boolean;
  flowEditorOverlayWheelProxyEnabled: boolean;
  flowWheelZoomSpeedMultiplier: number;
  flowWheelZoomIncrementMultiplier: number;
  flowWheelZoomSmoothMinDurationMs: number;
  flowWheelZoomSmoothMaxDurationMs: number;
  zoomDurationFitMs: number;
  zoomDurationSelectionMs: number;
  wheelZoomCtrlMetaBoostMultiplier: number;
  viewportFitFillRatio: number;
  graphDragAlphaTarget2d: number;
  canvasInteractionSpeedMultiplier: number;
  canvasPanSpeedMultiplier: number;
  canvasRenderModeLastFree: '2d' | '3d';
  canvasRenderModeIsAuto: boolean;
  setCanvasRenderMode: (m: '2d' | '3d') => void;
  setCanvas3dMode: (m: Canvas3dModeId) => void;
  setCanvas2dRenderer: (id: Canvas2dRendererId) => void;
  setViewportControlsPreset: (preset: ViewportControlsPreset) => void;
  setInfiniteCanvasInteractionMode: (mode: InfiniteCanvasInteractionMode) => void;
  setCanvasWorkspaceSyncMode: (mode: CanvasWorkspaceSyncMode) => void;
  setFlowEditorSelectionOnDrag: (v: boolean) => void;
  setFlowEditorOverlayWheelProxyEnabled: (v: boolean) => void;
  setFlowWheelZoomSpeedMultiplier: (v: number) => void;
  setFlowWheelZoomIncrementMultiplier: (v: number) => void;
  setFlowWheelZoomSmoothMinDurationMs: (v: number) => void;
  setFlowWheelZoomSmoothMaxDurationMs: (v: number) => void;
  setZoomDurationFitMs: (v: number) => void;
  setZoomDurationSelectionMs: (v: number) => void;
  setWheelZoomCtrlMetaBoostMultiplier: (v: number) => void;
  setViewportFitFillRatio: (v: number) => void;
  setGraphDragAlphaTarget2d: (v: number) => void;
  setCanvasInteractionSpeedMultiplier: (v: number) => void;
  setCanvasPanSpeedMultiplier: (v: number) => void;
  resetAll: () => void;
  canvasSnapshotFns: { '2d'?: CanvasSnapshotFns; '3d'?: CanvasSnapshotFns };
  registerCanvasSnapshotFns: (mode: '2d' | '3d', fns: CanvasSnapshotFns | null) => void;
  captureCanvasPngSnapshot: (mode?: '2d' | '3d', pixelRatio?: number) => Promise<Blob | null>;
  captureCanvasSvgSnapshot: (mode?: '2d' | '3d') => Promise<string | null>;
  threeCameraSnapshotFns: ThreeCameraSnapshotFns | null;
  registerThreeCameraSnapshotFns: (fns: ThreeCameraSnapshotFns | null) => void;
  captureThreeCameraPose: () => ThreeCameraPose | null;
  restoreThreeCameraPose: (pose: ThreeCameraPose | null) => void;
  threeGlbSnapshotFns: ThreeGlbSnapshotFns | null;
  registerThreeGlbSnapshotFns: (fns: ThreeGlbSnapshotFns | null) => void;
  captureThreeGlbSnapshot: () => Promise<Blob | null>;

  threeLayoutSnapshotFns: ThreeLayoutSnapshotFns | null;
  registerThreeLayoutSnapshotFns: (fns: ThreeLayoutSnapshotFns | null) => void;
  captureThreeLayoutPositions: () => Record<string, [number, number, number]> | null;
}
