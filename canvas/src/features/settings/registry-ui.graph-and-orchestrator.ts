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
import type { SettingMeta } from './types'

const s = () => useGraphStore.getState()

export const uiGraphAndOrchestratorSettingsRegistry: SettingMeta[] = [
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
    key: 'flowEditorSelectionOnDrag',
    type: 'boolean',
    source: 'store',
    read: () => s().flowEditorSelectionOnDrag === true,
    write: (v) => s().setFlowEditorSelectionOnDrag(Boolean(v)),
    docKey: 'flowEditorSelectionOnDrag',
    default: () => false,
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
  {
    key: 'flowWheelZoomSpeedMultiplier',
    type: 'number',
    source: 'store',
    read: () => s().flowWheelZoomSpeedMultiplier,
    write: (v) => s().setFlowWheelZoomSpeedMultiplier(Number(v)),
    docKey: 'flowWheelZoomSpeedMultiplier',
    default: () => FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_DEFAULT,
  },
  {
    key: 'flowWheelZoomIncrementMultiplier',
    type: 'number',
    source: 'store',
    read: () => s().flowWheelZoomIncrementMultiplier,
    write: (v) => s().setFlowWheelZoomIncrementMultiplier(Number(v)),
    docKey: 'flowWheelZoomIncrementMultiplier',
    default: () => FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_DEFAULT,
  },
  {
    key: 'flowWheelZoomSmoothMinDurationMs',
    type: 'number',
    source: 'store',
    read: () => s().flowWheelZoomSmoothMinDurationMs,
    write: (v) => s().setFlowWheelZoomSmoothMinDurationMs(Number(v)),
    docKey: 'flowWheelZoomSmoothMinDurationMs',
    default: () => FLOW_WHEEL_ZOOM_SMOOTH_MIN_DURATION_DEFAULT_MS,
  },
  {
    key: 'flowWheelZoomSmoothMaxDurationMs',
    type: 'number',
    source: 'store',
    read: () => s().flowWheelZoomSmoothMaxDurationMs,
    write: (v) => s().setFlowWheelZoomSmoothMaxDurationMs(Number(v)),
    docKey: 'flowWheelZoomSmoothMaxDurationMs',
    default: () => FLOW_WHEEL_ZOOM_SMOOTH_MAX_DURATION_DEFAULT_MS,
  },
  {
    key: 'orchestratorTraversalDelayMs',
    type: 'number',
    source: 'localStorage',
    read: () => lsInt(LS_KEYS.orchestratorTraversalDelayMs, ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS),
    write: (v) => {
      lsSetInt(LS_KEYS.orchestratorTraversalDelayMs, Number(v), {
        min: ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS,
        max: ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS,
      })
    },
    docKey: 'orchestratorTraversalDelayMs',
    default: () => ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS,
  },
  {
    key: 'graph.behavior.selectMode',
    type: 'string',
    source: 'store',
    read: () => {
      const schema = s().schema
      const mode = schema.behavior?.selectMode
      if (mode === 'single' || mode === 'multi' || mode === 'lasso') return mode
      return 'single'
    },
    write: (v) => {
      const raw = String(v || '')
      const mode: 'single' | 'multi' | 'lasso' =
        raw === 'multi' || raw === 'lasso' ? (raw as 'multi' | 'lasso') : 'single'
      s().setSelectMode(mode)
    },
    docKey: 'graph.behavior.selectMode',
    default: () => 'single',
    options: ['single', 'multi', 'lasso'],
  },
  {
    key: 'graph.behavior.createMode',
    type: 'string',
    source: 'store',
    read: () => {
      const schema = s().schema
      const mode = schema.behavior?.createMode
      if (mode === 'click-source-target' || mode === 'panel-only') return mode
      return 'shift-drag'
    },
    write: (v) => {
      const raw = String(v || '')
      const mode: 'shift-drag' | 'click-source-target' | 'panel-only' =
        raw === 'click-source-target' || raw === 'panel-only'
          ? (raw as 'click-source-target' | 'panel-only')
          : 'shift-drag'
      s().setCreateMode(mode)
    },
    docKey: 'graph.behavior.createMode',
    default: () => 'shift-drag',
    options: ['shift-drag', 'click-source-target', 'panel-only'],
  },
  {
    key: 'schemaDeriveCacheCapacity',
    type: 'number',
    source: 'store',
    read: () => s().schemaDeriveCacheCapacity,
    write: (v) => s().setSchemaDeriveCacheCapacity(Number(v)),
    docKey: 'schemaDeriveCacheCapacity',
    default: () => 16,
  },
  {
    key: 'schema.behavior.hover.content.type',
    type: 'boolean',
    source: 'store',
    read: () => {
      const schema = s().schema
      return schema.behavior?.hover?.content?.showType ?? true
    },
    write: (v) => {
      const current = s().schema
      const behavior = current.behavior
      const hover = behavior.hover || {}
      const content = hover.content || {}
      s().setSchema({
        ...current,
        behavior: {
          ...behavior,
          hover: {
            ...hover,
            content: { ...content, showType: Boolean(v) },
          },
        },
      })
    },
    docKey: 'schema.behavior.hover.content.type',
    default: () => true,
  },
  {
    key: 'schema.behavior.hover.content.id',
    type: 'boolean',
    source: 'store',
    read: () => {
      const schema = s().schema
      return schema.behavior?.hover?.content?.showId ?? true
    },
    write: (v) => {
      const current = s().schema
      const behavior = current.behavior
      const hover = behavior.hover || {}
      const content = hover.content || {}
      s().setSchema({
        ...current,
        behavior: {
          ...behavior,
          hover: {
            ...hover,
            content: { ...content, showId: Boolean(v) },
          },
        },
      })
    },
    docKey: 'schema.behavior.hover.content.id',
    default: () => true,
  },
  {
    key: 'schema.behavior.hover.content.properties',
    type: 'boolean',
    source: 'store',
    read: () => {
      const schema = s().schema
      return schema.behavior?.hover?.content?.showProps ?? true
    },
    write: (v) => {
      const current = s().schema
      const behavior = current.behavior
      const hover = behavior.hover || {}
      const content = hover.content || {}
      s().setSchema({
        ...current,
        behavior: {
          ...behavior,
          hover: {
            ...hover,
            content: { ...content, showProps: Boolean(v) },
          },
        },
      })
    },
    docKey: 'schema.behavior.hover.content.properties',
    default: () => true,
  },
  {
    key: 'schema.layout.groups.nestedPaddingStep',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw = schema.layout?.groups && typeof schema.layout.groups === 'object'
        ? (schema.layout.groups as { nestedPaddingStep?: unknown }).nestedPaddingStep
        : undefined
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0, Math.min(80, Math.floor(next))) : 0
      const current = s().schema
      const layout = current.layout || {}
      const groups = layout.groups || {}
      s().setSchema({
        ...current,
        layout: {
          ...layout,
          groups: { ...groups, nestedPaddingStep: clamped },
        },
      })
    },
    docKey: 'schema.layout.groups.nestedPaddingStep',
    default: () => 10,
  },
  {
    key: 'schema.layout.edges.opacity',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw = schema.layout?.edges && typeof schema.layout.edges === 'object'
        ? (schema.layout.edges as { opacity?: unknown }).opacity
        : undefined
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0.6
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0, Math.min(1, next)) : 0.6
      const current = s().schema
      const layout = current.layout || {}
      const edges = layout.edges || {}
      s().setSchema({
        ...current,
        layout: {
          ...layout,
          edges: { ...edges, opacity: clamped },
        },
      })
    },
    docKey: 'schema.layout.edges.opacity',
    default: () => 0.6,
  },
  {
    key: 'schema.layout.edges.opacityUnderGroups',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw = schema.layout?.edges && typeof schema.layout.edges === 'object'
        ? (schema.layout.edges as { opacityUnderGroups?: unknown }).opacityUnderGroups
        : undefined
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0.45
    },
    write: (v) => {
      const next = Number(v)
      const clamped = Number.isFinite(next) ? Math.max(0, Math.min(1, next)) : 0.45
      const current = s().schema
      const layout = current.layout || {}
      const edges = layout.edges || {}
      s().setSchema({
        ...current,
        layout: {
          ...layout,
          edges: { ...edges, opacityUnderGroups: clamped },
        },
      })
    },
    docKey: 'schema.layout.edges.opacityUnderGroups',
    default: () => 0.45,
  },
  {
    key: 'graphHoverPreview.showNodeId',
    type: 'boolean',
    source: 'store',
    read: () => s().graphHoverPreviewConfig.showNodeId,
    write: (v) => s().setGraphHoverPreviewConfig({ showNodeId: Boolean(v) }),
    docKey: 'graphHoverPreview.showNodeId',
    default: () => false,
  },
  {
    key: 'graphHoverPreview.showNodeName',
    type: 'boolean',
    source: 'store',
    read: () => s().graphHoverPreviewConfig.showNodeName,
    write: (v) => s().setGraphHoverPreviewConfig({ showNodeName: Boolean(v) }),
    docKey: 'graphHoverPreview.showNodeName',
    default: () => true,
  },
  {
    key: 'graphHoverPreview.showNodeLabel',
    type: 'boolean',
    source: 'store',
    read: () => s().graphHoverPreviewConfig.showNodeLabel,
    write: (v) => s().setGraphHoverPreviewConfig({ showNodeLabel: Boolean(v) }),
    docKey: 'graphHoverPreview.showNodeLabel',
    default: () => true,
  },
  {
    key: 'graphHoverPreview.showNodeDescription',
    type: 'boolean',
    source: 'store',
    read: () => s().graphHoverPreviewConfig.showNodeDescription,
    write: (v) => s().setGraphHoverPreviewConfig({ showNodeDescription: Boolean(v) }),
    docKey: 'graphHoverPreview.showNodeDescription',
    default: () => true,
  },
  {
    key: 'graphHoverPreview.showNodeProperties',
    type: 'boolean',
    source: 'store',
    read: () => s().graphHoverPreviewConfig.showNodeProperties,
    write: (v) => s().setGraphHoverPreviewConfig({ showNodeProperties: Boolean(v) }),
    docKey: 'graphHoverPreview.showNodeProperties',
    default: () => true,
  },
  {
    key: 'graphHoverPreview.showEdgeId',
    type: 'boolean',
    source: 'store',
    read: () => s().graphHoverPreviewConfig.showEdgeId,
    write: (v) => s().setGraphHoverPreviewConfig({ showEdgeId: Boolean(v) }),
    docKey: 'graphHoverPreview.showEdgeId',
    default: () => false,
  },
  {
    key: 'graphHoverPreview.showEdgeLabel',
    type: 'boolean',
    source: 'store',
    read: () => s().graphHoverPreviewConfig.showEdgeLabel,
    write: (v) => s().setGraphHoverPreviewConfig({ showEdgeLabel: Boolean(v) }),
    docKey: 'graphHoverPreview.showEdgeLabel',
    default: () => true,
  },
  {
    key: 'graphHoverPreview.showEdgeWeight',
    type: 'boolean',
    source: 'store',
    read: () => s().graphHoverPreviewConfig.showEdgeWeight,
    write: (v) => s().setGraphHoverPreviewConfig({ showEdgeWeight: Boolean(v) }),
    docKey: 'graphHoverPreview.showEdgeWeight',
    default: () => true,
  },
  {
    key: 'graphHoverPreview.showEdgeProperties',
    type: 'boolean',
    source: 'store',
    read: () => s().graphHoverPreviewConfig.showEdgeProperties,
    write: (v) => s().setGraphHoverPreviewConfig({ showEdgeProperties: Boolean(v) }),
    docKey: 'graphHoverPreview.showEdgeProperties',
    default: () => true,
  },
]
