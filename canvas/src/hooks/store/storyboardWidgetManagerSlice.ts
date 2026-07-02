import type { StoreApi } from 'zustand'

import { LS_KEYS } from '@/lib/config.ls.keys'
import { lsSetJson, getLocalStorage } from '@/lib/persistence'
import { createUniqueId } from '@/lib/ids'
import type { GraphState } from '@/hooks/store/types'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_STORYBOARD_ELEMENT_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config.storyboard-widget'
import { FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID } from '@/features/storyboard-widget-manager/grabMapsDiscoveryWidget'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import {
  applyStoryboardWidgetManagerDefaultRegistrySeed,
  ensureDefaultGenerateVideoRegistryEntry,
  ensureDefaultWidgetRegistryEntries,
  normalizeWidgetRegistryEntries,
  planStoryboardWidgetManagerDefaultRegistrySeed,
  readValidatedWidgetRegistryMetadataEntries,
  readWidgetRegistryFromStorage,
  trimOrEmpty,
  validateWidgetRegistryEntry,
  writeWidgetRegistryToStorage,
} from '@/hooks/store/storyboardWidgetManagerRegistryPersistence'

type SetGraph = StoreApi<GraphState>['setState']
type GetGraph = StoreApi<GraphState>['getState']

export {
  applyStoryboardWidgetManagerDefaultRegistrySeed,
  ensureDefaultGenerateVideoRegistryEntry,
  ensureDefaultWidgetRegistryEntries,
  normalizeWidgetRegistryEntries,
  planStoryboardWidgetManagerDefaultRegistrySeed,
  readValidatedWidgetRegistryMetadataEntries,
  readWidgetRegistryFromStorage,
  validateWidgetRegistryEntry,
  writeWidgetRegistryToStorage,
} from '@/hooks/store/storyboardWidgetManagerRegistryPersistence'

export const createStoryboardWidgetManagerSlice = (set: SetGraph, get: GetGraph) => {
  const initialPlan = planStoryboardWidgetManagerDefaultRegistrySeed(getLocalStorage())
  const initial = initialPlan.entries

  const isWidgetRegistryEntry = (entry: WidgetRegistryEntry | null | undefined): boolean => {
    const nodeTypeId = String(entry?.nodeTypeId || '').trim()
    return (
      nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID
      || nodeTypeId === FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID
      || nodeTypeId === FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID
      || nodeTypeId === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
      || nodeTypeId === FLOW_STORYBOARD_ELEMENT_NODE_TYPE_ID
      || nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID
      || nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID
    )
  }

  const persist = (next: WidgetRegistryEntry[]) => {
    try {
      lsSetJson(LS_KEYS.storyboardWidgetManagerWidgetRegistry, next)
    } catch {
      void 0
    }
  }
  const pickEffective = (
    global: WidgetRegistryEntry[],
    doc: WidgetRegistryEntry[],
    graphData?: GraphState['graphData'],
  ) => {
    const g = Array.isArray(global) ? global : []
    const d = Array.isArray(doc) ? doc : []
    const widgetGlobals = g.filter(isWidgetRegistryEntry)
    const graphMeta = (graphData?.metadata || {}) as Record<string, unknown>
    const graphKind = String(graphMeta.kind || '').trim()
    if (graphKind === 'frontmatter-flow') {
      if (d.length === 0) return widgetGlobals
      const seen = new Set(d.map(entry => `${entry.nodeTypeId}:${entry.formId}:${entry.widgetTypeId}`))
      const mergedWidgets = widgetGlobals.filter(entry => !seen.has(`${entry.nodeTypeId}:${entry.formId}:${entry.widgetTypeId}`))
      return [...d, ...mergedWidgets]
    }
    // Document-scoped registry is authoritative while present, but widget seeds stay globally available.
    if (d.length > 0) {
      const seen = new Set(d.map(entry => `${entry.nodeTypeId}:${entry.formId}:${entry.widgetTypeId}`))
      const mergedWidgets = widgetGlobals.filter(entry => !seen.has(`${entry.nodeTypeId}:${entry.formId}:${entry.widgetTypeId}`))
      return [...d, ...mergedWidgets]
    }
    return g
  }
  const upsert = (entry: Omit<WidgetRegistryEntry, 'id' | 'updatedAt'> & { id?: string | null }) => {
    const state = get()
    const prev = state.widgetRegistry || []

    const requestedId = trimOrEmpty(entry.id)
    const usedIds = new Set(prev.map(e => String(e.id || '')).filter(Boolean))
    const id = requestedId || createUniqueId('qer', usedIds)
    const updatedAt = new Date().toISOString()

    const nextEntry: WidgetRegistryEntry = {
      id,
      isEnabled: entry.isEnabled,
      nodeTypeId: String(entry.nodeTypeId || '').trim(),
      widgetTypeId: String(entry.widgetTypeId || '').trim(),
      formId: String(entry.formId || '').trim(),
      fields: Array.isArray(entry.fields) ? entry.fields : [],
      ports: Array.isArray(entry.ports) ? entry.ports : [],
      ...(Array.isArray(entry.schemaMappings) ? { schemaMappings: entry.schemaMappings } : {}),
      updatedAt,
    }

    const validated = validateWidgetRegistryEntry(nextEntry)
    if (!validated) return { ok: false as const, message: 'Invalid registry entry.' }

    const conflict = prev.find(e => {
      if (e.id === validated.id) return false
      if (!e.isEnabled || !validated.isEnabled) return false
      return (
        e.nodeTypeId === validated.nodeTypeId &&
        e.widgetTypeId === validated.widgetTypeId &&
        e.formId === validated.formId
      )
    })
    if (conflict) {
      return { ok: false as const, message: 'Conflict: an enabled mapping already exists for this node/editor/form.' }
    }

    const replaced = prev.some(e => e.id === validated.id)
    const next = normalizeWidgetRegistryEntries(
      replaced ? prev.map(e => (e.id === validated.id ? validated : e)) : [...prev, validated],
    )
    persist(next)
    set(s => {
      const doc = Array.isArray(s.documentWidgetRegistry) ? s.documentWidgetRegistry : []
      return {
        widgetRegistry: next,
        effectiveWidgetRegistry: pickEffective(next, doc, s.graphData),
      }
    })
    return { ok: true as const, id: validated.id }
  }

  return {
    widgetRegistry: initial,
    documentWidgetRegistry: [],
    effectiveWidgetRegistry: initial,
    setWidgetRegistry: (entries: WidgetRegistryEntry[]) => {
      const next = normalizeWidgetRegistryEntries(Array.isArray(entries) ? entries : [])
      persist(next)
      set(s => {
        const doc = Array.isArray(s.documentWidgetRegistry) ? s.documentWidgetRegistry : []
        return {
          widgetRegistry: next,
          effectiveWidgetRegistry: pickEffective(next, doc, s.graphData),
        }
      })
    },
    setDocumentWidgetRegistry: (
      entries: WidgetRegistryEntry[],
      options?: { graphData?: GraphState['graphData'] | null },
    ) => {
      const doc = normalizeWidgetRegistryEntries(Array.isArray(entries) ? entries : [])
      const global = Array.isArray(get().widgetRegistry) ? get().widgetRegistry : []
      const graphData = options?.graphData !== undefined ? (options.graphData || null) : get().graphData
      set({
        documentWidgetRegistry: doc,
        effectiveWidgetRegistry: pickEffective(global, doc, graphData),
      })
    },
    upsertWidgetRegistryEntry: upsert,
    removeWidgetRegistryEntry: (id: string) => {
      const entryId = trimOrEmpty(id)
      if (!entryId) return
      const state = get()
      const prev = state.widgetRegistry || []
      const next = prev.filter(e => e.id !== entryId)
      if (next.length === prev.length) return
      persist(next)
      set(s => {
        const doc = Array.isArray(s.documentWidgetRegistry) ? s.documentWidgetRegistry : []
        return {
          widgetRegistry: next,
          effectiveWidgetRegistry: pickEffective(next, doc, s.graphData),
        }
      })
    },
    toggleWidgetRegistryEntryEnabled: (id: string, enabled?: boolean) => {
      const entryId = trimOrEmpty(id)
      if (!entryId) return
      const state = get()
      const prev = state.widgetRegistry || []
      const current = prev.find(e => e.id === entryId) || null
      if (!current) return
      const nextEnabled = typeof enabled === 'boolean' ? enabled : !current.isEnabled
      if (nextEnabled === current.isEnabled) return

      const conflict = prev.find(e => {
        if (e.id === entryId) return false
        if (!e.isEnabled || !nextEnabled) return false
        return (
          e.nodeTypeId === current.nodeTypeId &&
          e.widgetTypeId === current.widgetTypeId &&
          e.formId === current.formId
        )
      })
      if (conflict) {
        state.upsertUiToast({
          id: 'storyboard-widget-manager-registry-conflict',
          kind: 'warning',
          message: 'Enable denied: another enabled mapping already exists for this node/editor/form.',
          ttlMs: 3000,
        })
        return
      }

      const next = prev.map(e => (e.id === entryId ? { ...e, isEnabled: nextEnabled, updatedAt: new Date().toISOString() } : e))
      persist(next)
      set(s => {
        const doc = Array.isArray(s.documentWidgetRegistry) ? s.documentWidgetRegistry : []
        return {
          widgetRegistry: next,
          effectiveWidgetRegistry: pickEffective(next, doc, s.graphData),
        }
      })
    },
  }
}
