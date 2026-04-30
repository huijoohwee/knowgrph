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

export interface GraphStateFiles {
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

  grabMapsAuthMode: 'serverManaged' | 'byok'
  grabMapsApiKey: string
  grabMapsDirectionsEndpointUrl: string
  grabMapsDirectionsOverview: string
  grabMapsDirectionsLatFirst: boolean
  grabMapsDirectionsAlternatives: boolean
  grabMapsDirectionsSteps: boolean
  grabMapsDirectionsLanguage: string
  grabMapsDirectionsUnits: string
  grabMapsDirectionsOriginLng: number
  grabMapsDirectionsOriginLat: number
  grabMapsDirectionsDestinationLng: number
  grabMapsDirectionsDestinationLat: number
  grabMapsDirectionsWaypointsJson: string
  grabMapsDirectionsAnnotationsJson: string
  grabMapsDirectionsExtraParamsJson: string
  grabMapsBasemapStyleUrl: string

  setGrabMapsAuthMode: (mode: 'serverManaged' | 'byok') => void
  setGrabMapsApiKey: (v: string | null) => void
  setGrabMapsDirectionsEndpointUrl: (v: string) => void
  setGrabMapsDirectionsOverview: (v: string) => void
  setGrabMapsDirectionsLatFirst: (v: boolean) => void
  setGrabMapsDirectionsAlternatives: (v: boolean) => void
  setGrabMapsDirectionsSteps: (v: boolean) => void
  setGrabMapsDirectionsLanguage: (v: string) => void
  setGrabMapsDirectionsUnits: (v: string) => void
  setGrabMapsDirectionsOriginLng: (v: number) => void
  setGrabMapsDirectionsOriginLat: (v: number) => void
  setGrabMapsDirectionsDestinationLng: (v: number) => void
  setGrabMapsDirectionsDestinationLat: (v: number) => void
  setGrabMapsDirectionsWaypointsJson: (v: string) => void
  setGrabMapsDirectionsAnnotationsJson: (v: string) => void
  setGrabMapsDirectionsExtraParamsJson: (v: string) => void
  setGrabMapsBasemapStyleUrl: (v: string) => void
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
}
