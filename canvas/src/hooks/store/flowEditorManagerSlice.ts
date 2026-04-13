import type { StoreApi } from 'zustand'

import { LS_KEYS } from '@/lib/config.ls.keys'
import { lsSetJson, getLocalStorage } from '@/lib/persistence'
import { createUniqueId } from '@/lib/ids'
import type { GraphState } from '@/hooks/store/types'
import { buildGenerateVideoRegistryDraft } from '@/features/flow-editor-manager/registryTemplates'
import { FLOW_VIDEO_GENERATION_NODE_TYPE_ID } from '@/lib/config.flow-editor'
import type {
  NodeQuickEditorRegistryEntry,
  NodeQuickEditorRegistryField,
  NodeQuickEditorRegistryPort,
  NodeQuickEditorRegistrySchemaMapping,
} from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'

type SetGraph = StoreApi<GraphState>['setState']
type GetGraph = StoreApi<GraphState>['getState']

const trimOrEmpty = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export function validateNodeQuickEditorRegistryEntry(raw: unknown): NodeQuickEditorRegistryEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rec = raw as Record<string, unknown>

  const id = trimOrEmpty(rec.id)
  const nodeTypeId = trimOrEmpty(rec.nodeTypeId)
  const quickEditorTypeId = trimOrEmpty(rec.quickEditorTypeId)
  const formId = trimOrEmpty(rec.formId)
  const updatedAt = trimOrEmpty(rec.updatedAt)
  const isEnabled = typeof rec.isEnabled === 'boolean' ? rec.isEnabled : true

  if (!id || !nodeTypeId || !quickEditorTypeId || !formId) return null

  const fieldsRaw = Array.isArray(rec.fields) ? rec.fields : []
  const portsRaw = Array.isArray(rec.ports) ? rec.ports : []
  const schemaMappingsRaw = Array.isArray(rec.schemaMappings) ? rec.schemaMappings : null

  const fields: NodeQuickEditorRegistryField[] = []
  const fieldKeySet = new Set<string>()
  for (let i = 0; i < fieldsRaw.length; i += 1) {
    const item = fieldsRaw[i]
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const it = item as Record<string, unknown>
    const fieldKey = trimOrEmpty(it.fieldKey)
    const fieldType = trimOrEmpty(it.fieldType)
    if (!fieldKey || !fieldType) continue
    if (fieldKeySet.has(fieldKey)) continue
    fieldKeySet.add(fieldKey)
    const label = trimOrEmpty(it.label) || undefined
    const schemaPath = trimOrEmpty(it.schemaPath) || undefined
    const required = typeof it.required === 'boolean' ? it.required : undefined
    const isHidden = typeof it.isHidden === 'boolean' ? it.isHidden : undefined
    fields.push({
      fieldKey,
      fieldType,
      ...(label ? { label } : {}),
      ...(schemaPath ? { schemaPath } : {}),
      ...(required != null ? { required } : {}),
      ...(isHidden === true ? { isHidden: true } : {}),
    })
  }

  const ports: NodeQuickEditorRegistryPort[] = []
  const portKeySet = new Set<string>()
  for (let i = 0; i < portsRaw.length; i += 1) {
    const item = portsRaw[i]
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const it = item as Record<string, unknown>
    const portKey = trimOrEmpty(it.portKey)
    const direction = trimOrEmpty(it.direction)
    if (!portKey || (direction !== 'input' && direction !== 'output')) continue
    const uniq = `${direction}:${portKey}`
    if (portKeySet.has(uniq)) continue
    portKeySet.add(uniq)
    const schemaPath = trimOrEmpty(it.schemaPath) || undefined
    const isHidden = typeof it.isHidden === 'boolean' ? it.isHidden : undefined
    ports.push({
      portKey,
      direction: direction as 'input' | 'output',
      ...(schemaPath ? { schemaPath } : {}),
      ...(isHidden === true ? { isHidden: true } : {}),
    })
  }

  const schemaMappings: NodeQuickEditorRegistrySchemaMapping[] | undefined = (() => {
    if (!schemaMappingsRaw) return undefined
    const out: NodeQuickEditorRegistrySchemaMapping[] = []
    for (let i = 0; i < schemaMappingsRaw.length; i += 1) {
      const item = schemaMappingsRaw[i]
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const it = item as Record<string, unknown>
      const fromPath = trimOrEmpty(it.fromPath)
      const toPath = trimOrEmpty(it.toPath)
      if (!fromPath || !toPath) continue
      const transformId = trimOrEmpty(it.transformId) || undefined
      const reduceId = trimOrEmpty(it.reduceId) || undefined
      out.push({ fromPath, toPath, ...(transformId ? { transformId } : {}), ...(reduceId ? { reduceId } : {}) })
    }
    return out.length > 0 ? out : undefined
  })()

  if (fields.length === 0 && ports.length === 0) return null

  return {
    id,
    isEnabled,
    nodeTypeId,
    quickEditorTypeId,
    formId,
    fields,
    ports,
    ...(schemaMappings ? { schemaMappings } : {}),
    updatedAt: updatedAt || new Date().toISOString(),
  }
}

export function readNodeQuickEditorRegistryFromStorage(storage: Storage | null): NodeQuickEditorRegistryEntry[] {
  const parse = (v: unknown): NodeQuickEditorRegistryEntry[] | null => {
    if (!Array.isArray(v)) return []
    const out: NodeQuickEditorRegistryEntry[] = []
    const seen = new Set<string>()
    for (let i = 0; i < v.length; i += 1) {
      const entry = validateNodeQuickEditorRegistryEntry(v[i])
      if (!entry) continue
      if (seen.has(entry.id)) continue
      seen.add(entry.id)
      out.push(entry)
    }
    return out
  }

  if (!storage) return []
  try {
    const raw = storage.getItem(LS_KEYS.flowEditorManagerNodeQuickEditorRegistry)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return parse(parsed) || []
  } catch {
    return []
  }
}

export function writeNodeQuickEditorRegistryToStorage(storage: Storage | null, entries: NodeQuickEditorRegistryEntry[]): void {
  if (!storage) return
  try {
    storage.setItem(LS_KEYS.flowEditorManagerNodeQuickEditorRegistry, JSON.stringify(entries))
  } catch {
    void 0
  }
}

export function normalizeNodeQuickEditorRegistryEntries(
  entries: NodeQuickEditorRegistryEntry[],
): NodeQuickEditorRegistryEntry[] {
  const out: NodeQuickEditorRegistryEntry[] = []
  const ids = new Set<string>()
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    if (!entry) continue
    const validated = validateNodeQuickEditorRegistryEntry(entry)
    if (!validated) continue
    if (ids.has(validated.id)) continue
    ids.add(validated.id)
    out.push(validated)
  }
  out.sort((a, b) => {
    const t = a.nodeTypeId.localeCompare(b.nodeTypeId)
    if (t !== 0) return t
    const e = a.quickEditorTypeId.localeCompare(b.quickEditorTypeId)
    if (e !== 0) return e
    return a.formId.localeCompare(b.formId)
  })
  return out
}

export function ensureDefaultGenerateVideoRegistryEntry(
  entries: NodeQuickEditorRegistryEntry[],
  nowIso?: string,
): { entries: NodeQuickEditorRegistryEntry[]; changed: boolean } {
  const prev = Array.isArray(entries) ? entries : []
  const exists = prev.some(e => {
    if (!e) return false
    return e.nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID && e.quickEditorTypeId === 'default' && e.formId === 'videoGeneration'
  })
  if (exists) return { entries: prev, changed: false }

  const usedIds = new Set(prev.map(e => String(e?.id || '')).filter(Boolean))
  const id = createUniqueId('qer', usedIds)
  const updatedAt = String(nowIso || '').trim() || new Date().toISOString()
  const draft = buildGenerateVideoRegistryDraft()

  const nextEntry: NodeQuickEditorRegistryEntry = {
    id,
    isEnabled: true,
    nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
    quickEditorTypeId: 'default',
    formId: 'videoGeneration',
    fields: Array.isArray(draft.fields) ? (draft.fields as NodeQuickEditorRegistryField[]) : [],
    ports: Array.isArray(draft.ports) ? (draft.ports as NodeQuickEditorRegistryPort[]) : [],
    ...(Array.isArray(draft.schemaMappings) ? { schemaMappings: draft.schemaMappings as NodeQuickEditorRegistrySchemaMapping[] } : {}),
    updatedAt,
  }

  const validated = validateNodeQuickEditorRegistryEntry(nextEntry)
  if (!validated) return { entries: prev, changed: false }
  const next = normalizeNodeQuickEditorRegistryEntries([...prev, validated])
  return { entries: next, changed: true }
}

export const planFlowEditorManagerDefaultRegistrySeed = (storage: Storage | null = getLocalStorage()) => {
  const rawInitial = readNodeQuickEditorRegistryFromStorage(storage)
  const seeded = ensureDefaultGenerateVideoRegistryEntry(rawInitial)
  return {
    storage,
    entries: seeded.entries,
    changed: seeded.changed,
  }
}

export const applyFlowEditorManagerDefaultRegistrySeed = (storage: Storage | null = getLocalStorage()): boolean => {
  const plan = planFlowEditorManagerDefaultRegistrySeed(storage)
  if (!plan.changed) return false
  writeNodeQuickEditorRegistryToStorage(plan.storage, plan.entries)
  return true
}

export const createFlowEditorManagerSlice = (set: SetGraph, get: GetGraph) => {
  const initialPlan = planFlowEditorManagerDefaultRegistrySeed(getLocalStorage())
  const initial = initialPlan.entries

  const persist = (next: NodeQuickEditorRegistryEntry[]) => {
    try {
      lsSetJson(LS_KEYS.flowEditorManagerNodeQuickEditorRegistry, next)
    } catch {
      void 0
    }
  }
  const pickEffective = (global: NodeQuickEditorRegistryEntry[], doc: NodeQuickEditorRegistryEntry[]) => {
    const g = Array.isArray(global) ? global : []
    const d = Array.isArray(doc) ? doc : []
    if (d.length === 0) return g
    if (g.length === 0) return d

    const uniqKey = (e: NodeQuickEditorRegistryEntry) => `${e.nodeTypeId}|${e.quickEditorTypeId}|${e.formId}`
    const docKeySet = new Set(d.map(uniqKey))
    const merged: NodeQuickEditorRegistryEntry[] = []
    for (let i = 0; i < g.length; i += 1) {
      const e = g[i]
      if (!e) continue
      if (docKeySet.has(uniqKey(e))) continue
      merged.push(e)
    }
    merged.push(...d)
    return normalizeNodeQuickEditorRegistryEntries(merged)
  }

  const upsert = (entry: Omit<NodeQuickEditorRegistryEntry, 'id' | 'updatedAt'> & { id?: string | null }) => {
    const state = get()
    const prev = state.nodeQuickEditorRegistry || []

    const requestedId = trimOrEmpty(entry.id)
    const usedIds = new Set(prev.map(e => String(e.id || '')).filter(Boolean))
    const id = requestedId || createUniqueId('qer', usedIds)
    const updatedAt = new Date().toISOString()

    const nextEntry: NodeQuickEditorRegistryEntry = {
      id,
      isEnabled: entry.isEnabled,
      nodeTypeId: String(entry.nodeTypeId || '').trim(),
      quickEditorTypeId: String(entry.quickEditorTypeId || '').trim(),
      formId: String(entry.formId || '').trim(),
      fields: Array.isArray(entry.fields) ? entry.fields : [],
      ports: Array.isArray(entry.ports) ? entry.ports : [],
      ...(Array.isArray(entry.schemaMappings) ? { schemaMappings: entry.schemaMappings } : {}),
      updatedAt,
    }

    const validated = validateNodeQuickEditorRegistryEntry(nextEntry)
    if (!validated) return { ok: false as const, message: 'Invalid registry entry.' }

    const conflict = prev.find(e => {
      if (e.id === validated.id) return false
      if (!e.isEnabled || !validated.isEnabled) return false
      return (
        e.nodeTypeId === validated.nodeTypeId &&
        e.quickEditorTypeId === validated.quickEditorTypeId &&
        e.formId === validated.formId
      )
    })
    if (conflict) {
      return { ok: false as const, message: 'Conflict: an enabled mapping already exists for this node/editor/form.' }
    }

    const replaced = prev.some(e => e.id === validated.id)
    const next = normalizeNodeQuickEditorRegistryEntries(
      replaced ? prev.map(e => (e.id === validated.id ? validated : e)) : [...prev, validated],
    )
    persist(next)
    set(s => {
      const doc = Array.isArray(s.documentNodeQuickEditorRegistry) ? s.documentNodeQuickEditorRegistry : []
      return { nodeQuickEditorRegistry: next, effectiveNodeQuickEditorRegistry: pickEffective(next, doc) }
    })
    return { ok: true as const, id: validated.id }
  }

  return {
    nodeQuickEditorRegistry: initial,
    documentNodeQuickEditorRegistry: [],
    effectiveNodeQuickEditorRegistry: initial,
    setNodeQuickEditorRegistry: (entries: NodeQuickEditorRegistryEntry[]) => {
      const next = normalizeNodeQuickEditorRegistryEntries(Array.isArray(entries) ? entries : [])
      persist(next)
      set(s => {
        const doc = Array.isArray(s.documentNodeQuickEditorRegistry) ? s.documentNodeQuickEditorRegistry : []
        return { nodeQuickEditorRegistry: next, effectiveNodeQuickEditorRegistry: pickEffective(next, doc) }
      })
    },
    setDocumentNodeQuickEditorRegistry: (entries: NodeQuickEditorRegistryEntry[]) => {
      const doc = normalizeNodeQuickEditorRegistryEntries(Array.isArray(entries) ? entries : [])
      const global = Array.isArray(get().nodeQuickEditorRegistry) ? get().nodeQuickEditorRegistry : []
      set({ documentNodeQuickEditorRegistry: doc, effectiveNodeQuickEditorRegistry: pickEffective(global, doc) })
    },
    upsertNodeQuickEditorRegistryEntry: upsert,
    removeNodeQuickEditorRegistryEntry: (id: string) => {
      const entryId = trimOrEmpty(id)
      if (!entryId) return
      const state = get()
      const prev = state.nodeQuickEditorRegistry || []
      const next = prev.filter(e => e.id !== entryId)
      if (next.length === prev.length) return
      persist(next)
      set(s => {
        const doc = Array.isArray(s.documentNodeQuickEditorRegistry) ? s.documentNodeQuickEditorRegistry : []
        return { nodeQuickEditorRegistry: next, effectiveNodeQuickEditorRegistry: pickEffective(next, doc) }
      })
    },
    toggleNodeQuickEditorRegistryEntryEnabled: (id: string, enabled?: boolean) => {
      const entryId = trimOrEmpty(id)
      if (!entryId) return
      const state = get()
      const prev = state.nodeQuickEditorRegistry || []
      const current = prev.find(e => e.id === entryId) || null
      if (!current) return
      const nextEnabled = typeof enabled === 'boolean' ? enabled : !current.isEnabled
      if (nextEnabled === current.isEnabled) return

      const conflict = prev.find(e => {
        if (e.id === entryId) return false
        if (!e.isEnabled || !nextEnabled) return false
        return (
          e.nodeTypeId === current.nodeTypeId &&
          e.quickEditorTypeId === current.quickEditorTypeId &&
          e.formId === current.formId
        )
      })
      if (conflict) {
        state.upsertUiToast({
          id: 'flow-editor-manager-registry-conflict',
          kind: 'warning',
          message: 'Enable denied: another enabled mapping already exists for this node/editor/form.',
          ttlMs: 3000,
        })
        return
      }

      const next = prev.map(e => (e.id === entryId ? { ...e, isEnabled: nextEnabled, updatedAt: new Date().toISOString() } : e))
      persist(next)
      set(s => {
        const doc = Array.isArray(s.documentNodeQuickEditorRegistry) ? s.documentNodeQuickEditorRegistry : []
        return { nodeQuickEditorRegistry: next, effectiveNodeQuickEditorRegistry: pickEffective(next, doc) }
      })
    },
  }
}
