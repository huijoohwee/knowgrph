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
    key: 'schema.layers.mode',
    type: 'string',
    source: 'store',
    read: () => {
      const schema = s().schema
      const mode = schema.layers?.mode
      if (mode === 'document-structure' || mode === 'semantic') return mode
      return 'property'
    },
    write: (v) => {
      const raw = String(v || '')
      const nextMode: 'property' | 'document-structure' | 'semantic' =
        raw === 'document-structure' || raw === 'semantic'
          ? (raw as 'document-structure' | 'semantic')
          : 'property'
      const current = s().schema
      const nextLayers = current.layers || {}
      const next = {
        ...current,
        layers: {
          ...nextLayers,
          mode: nextMode,
        },
      }
      s().setSchema(next)
    },
    docKey: 'schema.layers.mode',
    default: () => 'property',
    options: ['property', 'document-structure', 'semantic'],
  },
  {
    key: 'schema.layers.documentStructure.minGroupSize',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw = schema.layers?.documentStructure?.minGroupSize
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        const clamped = Math.max(2, Math.floor(raw))
        return clamped
      }
      return 2
    },
    write: (v) => {
      const raw = Number(v)
      const nextValue = Number.isFinite(raw) ? Math.max(2, Math.floor(raw)) : 2
      const current = s().schema
      const baseLayers = current.layers || {}
      const baseDoc = baseLayers.documentStructure || {}
      const next = {
        ...current,
        layers: {
          ...baseLayers,
          documentStructure: {
            ...baseDoc,
            minGroupSize: nextValue,
          },
        },
      }
      s().setSchema(next)
    },
    docKey: 'schema.layers.documentStructure.minGroupSize',
    default: () => 2,
  },
  {
    key: 'schema.layers.semantic.similarityEdgeLabel',
    type: 'string',
    source: 'store',
    read: () => {
      const schema = s().schema
      const label = schema.layers?.semantic?.similarityEdgeLabel
      if (typeof label === 'string' && label.trim().length > 0) {
        return label
      }
      return 'semanticSimilarity'
    },
    write: (v) => {
      const raw = String(v || '')
      const trimmed = raw.trim()
      const current = s().schema
      const baseLayers = current.layers || {}
      const baseSemantic = baseLayers.semantic || {}
      const next = {
        ...current,
        layers: {
          ...baseLayers,
          semantic: {
            ...baseSemantic,
            similarityEdgeLabel: trimmed || undefined,
          },
        },
      }
      s().setSchema(next)
    },
    docKey: 'schema.layers.semantic.similarityEdgeLabel',
    default: () => 'semanticSimilarity',
  },
  {
    key: 'schema.layers.semantic.similarityMetric',
    type: 'string',
    source: 'store',
    read: () => {
      const schema = s().schema
      const metric = schema.layers?.semantic?.similarityMetric
      if (metric === 'pmi') return 'pmi'
      return 'cosine'
    },
    write: (v) => {
      const raw = String(v || '')
      const nextMetric: 'cosine' | 'pmi' = raw === 'pmi' ? 'pmi' : 'cosine'
      const current = s().schema
      const baseLayers = current.layers || {}
      const baseSemantic = baseLayers.semantic || {}
      const next = {
        ...current,
        layers: {
          ...baseLayers,
          semantic: {
            ...baseSemantic,
            similarityMetric: nextMetric,
          },
        },
      }
      s().setSchema(next)
    },
    docKey: 'schema.layers.semantic.similarityMetric',
    default: () => 'cosine',
    options: ['cosine', 'pmi'],
  },
  {
    key: 'schema.layers.semantic.topKEdgesPerNode',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw = schema.layers?.semantic?.topKEdgesPerNode
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        const clamped = Math.max(0, Math.floor(raw))
        return clamped
      }
      return 4
    },
    write: (v) => {
      const raw = Number(v)
      const nextValue = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 4
      const current = s().schema
      const baseLayers = current.layers || {}
      const baseSemantic = baseLayers.semantic || {}
      const next = {
        ...current,
        layers: {
          ...baseLayers,
          semantic: {
            ...baseSemantic,
            topKEdgesPerNode: nextValue,
          },
        },
      }
      s().setSchema(next)
    },
    docKey: 'schema.layers.semantic.topKEdgesPerNode',
    default: () => 4,
  },
  {
    key: 'schema.layers.semantic.minSimilarity',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw = schema.layers?.semantic?.minSimilarity
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        const clamped = Math.max(0, raw)
        return clamped
      }
      return 0.12
    },
    write: (v) => {
      const raw = Number(v)
      const nextValue = Number.isFinite(raw) ? Math.max(0, raw) : 0.12
      const current = s().schema
      const baseLayers = current.layers || {}
      const baseSemantic = baseLayers.semantic || {}
      const next = {
        ...current,
        layers: {
          ...baseLayers,
          semantic: {
            ...baseSemantic,
            minSimilarity: nextValue,
          },
        },
      }
      s().setSchema(next)
    },
    docKey: 'schema.layers.semantic.minSimilarity',
    default: () => 0.12,
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
]
