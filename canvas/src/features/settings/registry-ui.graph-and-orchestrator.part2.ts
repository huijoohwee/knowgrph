import { useGraphStore } from '@/hooks/useGraphStore'
import { lsInt, lsSetInt } from '@/lib/persistence'
import { LS_KEYS } from '@/lib/config'
import {
  ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS,
} from '@/features/panels/utils/orchestratorTraversal'
import {
  FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_DEFAULT,
  FLOW_WHEEL_ZOOM_SMOOTH_MAX_DURATION_DEFAULT_MS,
  FLOW_WHEEL_ZOOM_SMOOTH_MIN_DURATION_DEFAULT_MS,
  FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_DEFAULT,
} from '@/lib/canvas/flow-zoom-tuning'
import { CANVAS_INTERACTION_SPEED_MULTIPLIER_DEFAULT, CANVAS_PAN_SPEED_MULTIPLIER_DEFAULT } from '@/lib/canvas/camera-options-2d'
import { CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_DEFAULT } from '@/lib/canvas/zoom-input'
import { DEFAULT_FIT_TO_SCREEN_FILL_RATIO, DEFAULT_ZOOM_MAX_SCALE, DEFAULT_ZOOM_MIN_SCALE } from '@/lib/graph/layoutDefaults'
import { DEFAULT_PHYSICS2D_TUNING } from '@/lib/graph/physics2dTuning'
import type { GraphSchema } from '@/lib/graph/schema'
import type { SettingMeta } from './types'
import {
  JSON_IMPORT_WORKSPACE_TARGET_OPTIONS,
  readJsonImportWorkspaceTarget,
  writeJsonImportWorkspaceTarget,
} from '@/features/workspace-table/jsonImportWorkspaceTarget'

const s = () => useGraphStore.getState()

export const uiGraphAndOrchestratorSettingsRegistryPart2: SettingMeta[] = [
  {
    key: 'zoom.strokeScaleExponent2d',
    type: 'number',
    source: 'store',
    read: () => s().zoomStrokeScaleExponent2d,
    write: (v) => s().setZoomStrokeScaleExponent2d(Number(v)),
    docKey: 'zoom.strokeScaleExponent2d',
    default: () => 1,
  },
  {
    key: 'zoom.strokeScaleClampMin2d',
    type: 'number',
    source: 'store',
    read: () => s().zoomStrokeScaleClampMin2d,
    write: (v) => s().setZoomStrokeScaleClampMin2d(Number(v)),
    docKey: 'zoom.strokeScaleClampMin2d',
    default: () => 0.000001,
  },
  {
    key: 'zoom.strokeScaleClampMax2d',
    type: 'number',
    source: 'store',
    read: () => s().zoomStrokeScaleClampMax2d,
    write: (v) => s().setZoomStrokeScaleClampMax2d(Number(v)),
    docKey: 'zoom.strokeScaleClampMax2d',
    default: () => 1000,
  },
  {
    key: 'historyDebounceMs',
    type: 'number',
    source: 'store',
    read: () => s().historyDebounceMs,
    write: (v) => s().setHistoryDebounceMs(Number(v)),
    docKey: 'historyDebounceMs',
    default: () => 500,
  },
  {
    key: 'keyword.source.maxLines',
    type: 'number',
    source: 'store',
    read: () => s().keywordSourceMaxLines,
    write: (v) => s().setKeywordSourceMaxLines(Number(v)),
    docKey: 'keyword.source.maxLines',
    default: () => 8000,
  },
  {
    key: 'keyword.source.maxChars',
    type: 'number',
    source: 'store',
    read: () => s().keywordSourceMaxChars,
    write: (v) => s().setKeywordSourceMaxChars(Number(v)),
    docKey: 'keyword.source.maxChars',
    default: () => 120_000,
  },
  {
    key: 'keyword.graph.previewDebounceMs',
    type: 'number',
    source: 'store',
    read: () => s().keywordGraphPreviewDebounceMs,
    write: (v) => s().setKeywordGraphPreviewDebounceMs(Number(v)),
    docKey: 'keyword.graph.previewDebounceMs',
    default: () => 200,
  },
  {
    key: 'keyword.graph.fullDebounceMs',
    type: 'number',
    source: 'store',
    read: () => s().keywordGraphFullDebounceMs,
    write: (v) => s().setKeywordGraphFullDebounceMs(Number(v)),
    docKey: 'keyword.graph.fullDebounceMs',
    default: () => 800,
  },
  {
    key: 'keyword.graph.edgesPerNode',
    type: 'number',
    source: 'store',
    read: () => s().keywordGraphEdgesPerNode,
    write: (v) => s().setKeywordGraphEdgesPerNode(Number(v)),
    docKey: 'keyword.graph.edgesPerNode',
    default: () => 6,
  },
  {
    key: 'keyword.graph.maxEdges',
    type: 'number',
    source: 'store',
    read: () => s().keywordGraphMaxEdgesCap,
    write: (v) => s().setKeywordGraphMaxEdgesCap(Number(v)),
    docKey: 'keyword.graph.maxEdges',
    default: () => 2400,
  },
  {
    key: 'keyword.graph.mentionEdgesPerSourceNode',
    type: 'number',
    source: 'store',
    read: () => s().keywordGraphMentionEdgesPerSourceNode,
    write: (v) => s().setKeywordGraphMentionEdgesPerSourceNode(Number(v)),
    docKey: 'keyword.graph.mentionEdgesPerSourceNode',
    default: () => 6,
  },
  {
    key: 'codeHighlightDurationMs',
    type: 'number',
    source: 'store',
    read: () => s().codeHighlightDurationMs,
    write: (v) => s().setCodeHighlightDurationMs(Number(v)),
    docKey: 'codeHighlightDurationMs',
    default: () => 1000,
  },
  {
    key: 'codeSelectThrottleMs',
    type: 'number',
    source: 'store',
    read: () => s().codeSelectThrottleMs,
    write: (v) => s().setCodeSelectThrottleMs(Number(v)),
    docKey: 'codeSelectThrottleMs',
    default: () => 100,
  },
  {
    key: 'codeHighlightUntilClick',
    type: 'boolean',
    source: 'store',
    read: () => s().codeHighlightUntilClick,
    write: (v) => s().setCodeHighlightUntilClick(Boolean(v)),
    docKey: 'codeHighlightUntilClick',
    default: () => true,
  },
  {
    key: 'enableTabSync',
    type: 'boolean',
    source: 'store',
    read: () => s().enableTabSync,
    write: (v) => s().setEnableTabSync(Boolean(v)),
    docKey: 'enableTabSync',
    default: () => true,
  },
  {
    key: 'enableVirtualTables',
    type: 'boolean',
    source: 'store',
    read: () => s().enableVirtualTables,
    write: (v) => s().setEnableVirtualTables(Boolean(v)),
    docKey: 'enableVirtualTables',
    default: () => true,
  },
  {
    key: 'multiDimTableModeEnabled',
    type: 'boolean',
    source: 'store',
    read: () => s().multiDimTableModeEnabled === true,
    write: (v) => s().setMultiDimTableModeEnabled(Boolean(v)),
    docKey: 'multiDimTableModeEnabled',
    default: () => false,
  },
  {
    key: 'import.json.workspaceTarget',
    type: 'string',
    source: 'localStorage',
    read: () => readJsonImportWorkspaceTarget(),
    write: v => writeJsonImportWorkspaceTarget(String(v || '') as 'editor' | 'multiDimTable' | 'canvas'),
    docKey: 'import.json.workspaceTarget',
    default: () => 'multiDimTable',
    options: JSON_IMPORT_WORKSPACE_TARGET_OPTIONS,
  },
  {
    key: 'canvasRenderMode',
    type: 'string',
    source: 'store',
    read: () => s().canvasRenderMode,
    write: (v) => {
      const raw = String(v || '')
      const mode: '2d' | '3d' = raw === '3d' ? '3d' : '2d'
      s().setCanvasRenderMode(mode)
    },
    docKey: 'canvasRenderMode',
    default: () => '2d',
    options: ['2d', '3d'],
  },
  {
    key: 'canvas3dMode',
    type: 'string',
    source: 'store',
    read: () => s().canvas3dMode,
    write: (v) => {
      const raw = String(v || '')
      const mode = raw === 'voxel' || raw === 'xr' ? raw : '3d'
      s().setCanvas3dMode(mode)
    },
    docKey: 'canvas3dMode',
    default: () => '3d',
    options: ['3d', 'xr', 'voxel'],
  },
  {
    key: 'viewportControlsPreset',
    type: 'string',
    source: 'store',
    read: () => s().viewportControlsPreset,
    write: (v) => {
      const raw = String(v || '')
      const preset = raw === 'design' ? 'design' : 'map'
      s().setViewportControlsPreset(preset)
    },
    docKey: 'viewportControlsPreset',
    default: () => 'map',
    options: ['map', 'design'],
  },
  {
    key: 'infiniteCanvasInteractionMode',
    type: 'string',
    source: 'store',
    read: () => s().infiniteCanvasInteractionMode,
    write: (v) => {
      const raw = String(v || '')
      const mode = raw === 'interactive' ? 'interactive' : 'static'
      s().setInfiniteCanvasInteractionMode(mode)
    },
    docKey: 'infiniteCanvasInteractionMode',
    default: () => 'static',
    options: ['static', 'interactive'],
  },
  {
    key: 'canvasWorkspaceSyncMode',
    type: 'string',
    source: 'store',
    read: () => s().canvasWorkspaceSyncMode,
    write: (v) => {
      const raw = String(v || '')
      const mode = raw === 'realtime' ? 'realtime' : 'manual'
      s().setCanvasWorkspaceSyncMode(mode)
    },
    docKey: 'canvasWorkspaceSyncMode',
    default: () => 'manual',
    options: ['manual', 'realtime'],
  },
  {
    key: 'flowEditorSelectionOnDrag',
    type: 'boolean',
    source: 'store',
    read: () => s().flowEditorSelectionOnDrag === true,
    write: (v) => s().setFlowEditorSelectionOnDrag(Boolean(v)),
    docKey: 'flowEditorSelectionOnDrag',
    default: () => false,
  },
  {
    key: 'flowEditorOverlayWheelProxyEnabled',
    type: 'boolean',
    source: 'store',
    read: () => s().flowEditorOverlayWheelProxyEnabled === true,
    write: (v) => s().setFlowEditorOverlayWheelProxyEnabled(Boolean(v)),
    docKey: 'flowEditorOverlayWheelProxyEnabled',
    default: () => true,
  },
  {
    key: 'viewPinned',
    type: 'boolean',
    source: 'store',
    read: () => s().viewPinned === true,
    write: (v) => s().setViewPinned(Boolean(v)),
    docKey: 'viewPinned',
    default: () => false,
  },
  {
    key: 'fitToScreenMode',
    type: 'boolean',
    source: 'store',
    read: () => s().fitToScreenMode === true,
    write: (v) => s().setFitToScreenMode(Boolean(v)),
    docKey: 'fitToScreenMode',
    default: () => true,
  },
  {
    key: 'zoomToSelectionMode',
    type: 'boolean',
    source: 'store',
    read: () => s().zoomToSelectionMode === true,
    write: (v) => s().setZoomToSelectionMode(Boolean(v)),
    docKey: 'zoomToSelectionMode',
    default: () => false,
  },
  {
    key: 'zoomDurationFitMs',
    type: 'number',
    source: 'store',
    read: () => s().zoomDurationFitMs,
    write: (v) => s().setZoomDurationFitMs(Number(v)),
    docKey: 'zoomDurationFitMs',
    default: () => 300,
  },
  {
    key: 'zoomDurationSelectionMs',
    type: 'number',
    source: 'store',
    read: () => s().zoomDurationSelectionMs,
    write: (v) => s().setZoomDurationSelectionMs(Number(v)),
    docKey: 'zoomDurationSelectionMs',
    default: () => 300,
  },
  {
    key: 'wheelZoomCtrlMetaBoostMultiplier',
    type: 'number',
    source: 'store',
    read: () => s().wheelZoomCtrlMetaBoostMultiplier,
    write: (v) => s().setWheelZoomCtrlMetaBoostMultiplier(Number(v)),
    docKey: 'wheelZoomCtrlMetaBoostMultiplier',
    default: () => CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_DEFAULT,
  },
  {
    key: 'canvasInteractionSpeedMultiplier',
    type: 'number',
    source: 'store',
    read: () => s().canvasInteractionSpeedMultiplier,
    write: (v) => s().setCanvasInteractionSpeedMultiplier(Number(v)),
    docKey: 'canvasInteractionSpeedMultiplier',
    default: () => CANVAS_INTERACTION_SPEED_MULTIPLIER_DEFAULT,
  },
  {
    key: 'canvasPanSpeedMultiplier',
    type: 'number',
    source: 'store',
    read: () => s().canvasPanSpeedMultiplier,
    write: (v) => s().setCanvasPanSpeedMultiplier(Number(v)),
    docKey: 'canvasPanSpeedMultiplier',
    default: () => CANVAS_PAN_SPEED_MULTIPLIER_DEFAULT,
  },
]
