import { useGraphStore } from '@/hooks/useGraphStore'
import { lsInt, lsJson, lsSetInt, lsSetJson } from '@/lib/persistence'
import { LS_KEYS } from '@/lib/config'
import {
  ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS,
} from '@/features/panels/utils/orchestratorTraversal'
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
    key: 'geospatial.overlay.enabled',
    type: 'boolean',
    source: 'store',
    read: () => s().geospatialOverlayEnabled,
    write: (v) => s().setGeospatialOverlayEnabled(Boolean(v)),
    docKey: 'geospatialOverlayEnabled',
    default: () => false,
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
    key: 'orchestratorView',
    type: 'string',
    source: 'localStorage',
    read: () =>
      lsJson<'ui' | 'text'>(LS_KEYS.orchestratorView, 'ui', raw => {
        if (raw === 'ui' || raw === 'text') return raw
        return null
      }) || 'ui',
    write: (v) => {
      const raw = String(v || '')
      const next: 'ui' | 'text' = raw === 'text' ? 'text' : 'ui'
      lsSetJson(LS_KEYS.orchestratorView, next)
    },
    docKey: 'orchestratorView',
    default: () => 'ui',
    options: ['ui', 'text'],
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
