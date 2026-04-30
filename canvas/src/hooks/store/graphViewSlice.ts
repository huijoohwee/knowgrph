import type { GraphState } from '@/hooks/store/types'
import type { StoreApi } from 'zustand'
import { LS_KEYS } from '@/lib/config.ls.keys'
import { getLocalStorage, lsJson, lsSetInt, lsSetJson, readJsonFromStorage } from '@/lib/persistence'
import type { Canvas2dRendererId } from '@/lib/config.render'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import {
  WORKSPACE_SYNC_SCOPE_FLOW_WIDGET_RUNTIME_PERSISTENCE,
  WORKSPACE_SYNC_TASK_FLOW_WIDGET_VIEW_STATE,
} from '@/lib/async/workspaceSyncKeys'
import { hashRecordSignature, hashSignatureParts } from '@/lib/hash/signature'
import { FLOW_WIDGET_REGISTRY_METADATA_KEY } from '@/lib/config'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { buildFlowWidgetEligibleNodeIdSet } from '@/lib/graph/flowWidgetEligibility'

const FLOW_WIDGET_FORM_ID_KEY = 'flow:widgetFormId' as const
const FLOW_WIDGET_FORM_ID_KEY_LEGACY = 'flow:widgetFormId' as const

type SetGraph = StoreApi<GraphState>['setState']
type GetGraph = StoreApi<GraphState>['getState']

const normalizeIds = (ids: string[]): string[] => {
  const unique = new Set<string>()
  for (let i = 0; i < ids.length; i += 1) {
    const id = String(ids[i] || '').trim()
    if (!id) continue
    unique.add(id)
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b))
}

const normalizeIdsPreserveOrder = (ids: string[]): string[] => {
  const out: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < ids.length; i += 1) {
    const id = String(ids[i] || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

const normalizeOpenWidgetNodeIds = (ids: string[], graphData: GraphState['graphData'] | null): string[] => {
  const normalized = normalizeIdsPreserveOrder(Array.isArray(ids) ? ids : [])
  if (!graphData) return normalized
  const nodeIds = new Set<string>((graphData.nodes || []).map(n => String(n.id || '')).filter(Boolean))
  const validNodeIds = normalized.filter(id => nodeIds.has(id))
  if (!isFrontmatterFlowGraph(graphData)) {
    const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
    const eligible = buildFlowWidgetEligibleNodeIdSet(nodes as any)
    if (eligible.size === 0) return validNodeIds
    return validNodeIds.filter(id => eligible.has(id))
  }

  const metadata = ((graphData.metadata || {}) as Record<string, unknown>)

  const registryRaw = metadata[FLOW_WIDGET_REGISTRY_METADATA_KEY]
  const registry = Array.isArray(registryRaw) ? registryRaw : []
  const allowedFormIds = new Set<string>()
  for (let i = 0; i < registry.length; i += 1) {
    const entry = registry[i] as Record<string, unknown> | null
    const formId = typeof entry?.formId === 'string' ? String(entry.formId || '').trim() : ''
    if (!formId) continue
    allowedFormIds.add(formId)
  }
  if (allowedFormIds.size === 0) return []

  const nodeById = new Map<string, Record<string, unknown>>()
  for (let i = 0; i < (graphData.nodes || []).length; i += 1) {
    const node = (graphData.nodes || [])[i]
    const nodeId = String(node?.id || '').trim()
    if (!nodeId || nodeById.has(nodeId)) continue
    nodeById.set(nodeId, (node?.properties || {}) as Record<string, unknown>)
  }
  return validNodeIds.filter(id => {
    const props = nodeById.get(id) || {}
    const explicitFormId =
      typeof props[FLOW_WIDGET_FORM_ID_KEY] === 'string'
        ? String(props[FLOW_WIDGET_FORM_ID_KEY] || '').trim()
        : typeof props[FLOW_WIDGET_FORM_ID_KEY_LEGACY] === 'string'
          ? String(props[FLOW_WIDGET_FORM_ID_KEY_LEGACY] || '').trim()
          : ''
    const expectedFormId = explicitFormId || `fm:${id}`
    return allowedFormIds.has(expectedFormId)
  })
}

const FLOW_WIDGET_PERSIST_DELAY_MS = 90

type WidgetPinnedByGraphMap = Record<string, Record<string, boolean>>
type WidgetPosByGraphMap = Record<string, Record<string, { top: number; left: number }>>
type WidgetWorldByGraphMap = Record<string, Record<string, { x: number; y: number }>>

type GraphViewPinnedSemanticsMigrationPlan = {
  effectivePinnedByNodeId: Record<string, boolean>
  persistedPinnedByNodeId: Record<string, boolean> | null
  shouldPersistVersion: boolean
}

const normalizePinnedByNodeId = (source: Record<string, boolean> | null | undefined): Record<string, boolean> => {
  if (!source || typeof source !== 'object') return {}
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(source)) {
    const key = String(k || '').trim()
    if (!key) continue
    out[key] = !!v
  }
  return out
}

const normalizePosByNodeId = (
  source: Record<string, { top: number; left: number }> | null | undefined,
): Record<string, { top: number; left: number }> => {
  if (!source || typeof source !== 'object') return {}
  const out: Record<string, { top: number; left: number }> = {}
  for (const [k, v] of Object.entries(source)) {
    const key = String(k || '').trim()
    const top = typeof v?.top === 'number' && Number.isFinite(v.top) ? v.top : null
    const left = typeof v?.left === 'number' && Number.isFinite(v.left) ? v.left : null
    if (!key || top == null || left == null) continue
    out[key] = { top, left }
  }
  return out
}

const normalizeWorldByNodeId = (
  source: Record<string, { x: number; y: number }> | null | undefined,
): Record<string, { x: number; y: number }> => {
  if (!source || typeof source !== 'object') return {}
  const out: Record<string, { x: number; y: number }> = {}
  for (const [k, v] of Object.entries(source)) {
    const key = String(k || '').trim()
    const x = typeof v?.x === 'number' && Number.isFinite(v.x) ? v.x : null
    const y = typeof v?.y === 'number' && Number.isFinite(v.y) ? v.y : null
    if (!key || x == null || y == null) continue
    out[key] = { x, y }
  }
  return out
}

const readStorageInt = (storage: Storage | null, key: string, fallback: number): number => {
  if (!storage) return fallback
  try {
    const raw = storage.getItem(key)
    if (raw == null) return fallback
    const value = parseInt(String(raw).trim(), 10)
    return Number.isFinite(value) ? value : fallback
  } catch {
    return fallback
  }
}

const readStorageJson = <T>(
  storage: Storage | null,
  key: string,
  fallback: T,
  parse: (raw: unknown) => T,
): T => {
  if (!storage) return fallback
  try {
    const raw = storage.getItem(key)
    if (!raw) return fallback
    return parse(JSON.parse(raw) as unknown)
  } catch {
    return fallback
  }
}

const readPinnedByNodeIdFromStorage = (storage: Storage | null): Record<string, boolean> =>
  readStorageJson(storage, LS_KEYS.flowWidgetPinnedByNodeId, {}, raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const out: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const id = String(k || '').trim()
      if (!id) continue
      out[id] = !!v
    }
    return out
  })

const readPosByNodeIdFromStorage = (storage: Storage | null): Record<string, { top: number; left: number }> =>
  readStorageJson(storage, LS_KEYS.flowWidgetPosByNodeId, {}, raw =>
    normalizePosByNodeId(raw as Record<string, { top: number; left: number }> | null | undefined),
  )

const readWorldByNodeIdFromStorage = (storage: Storage | null): Record<string, { x: number; y: number }> =>
  readStorageJson(storage, LS_KEYS.flowWidgetWorldPosByNodeId, {}, raw =>
    normalizeWorldByNodeId(raw as Record<string, { x: number; y: number }> | null | undefined),
  )

export const planGraphViewPinnedSemanticsMigration = (
  storage: Storage | null = getLocalStorage(),
): GraphViewPinnedSemanticsMigrationPlan => {
  const parsed = readPinnedByNodeIdFromStorage(storage)
  const version = readStorageInt(storage, LS_KEYS.flowWidgetPinnedSemanticsVersion, 0)
  if (version >= 2) {
    return {
      effectivePinnedByNodeId: parsed,
      persistedPinnedByNodeId: null,
      shouldPersistVersion: false,
    }
  }

  const ids = Object.keys(parsed)
  if (ids.length === 0) {
    return {
      effectivePinnedByNodeId: parsed,
      persistedPinnedByNodeId: null,
      shouldPersistVersion: true,
    }
  }

  const posById = readPosByNodeIdFromStorage(storage)
  const worldById = readWorldByNodeIdFromStorage(storage)

  let evidence = 0
  let total = 0
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]!
    const pinned = parsed[id]
    const fp = posById[id]
    const wp = worldById[id]
    const hasFloating =
      fp != null && typeof fp === 'object' && Number.isFinite((fp as { top?: unknown }).top) && Number.isFinite((fp as { left?: unknown }).left)
    const hasWorld =
      wp != null && typeof wp === 'object' && Number.isFinite((wp as { x?: unknown }).x) && Number.isFinite((wp as { y?: unknown }).y)
    if (!hasFloating && !hasWorld) continue
    total += 1

    const suggestsInverted =
      (pinned === true && hasFloating && !hasWorld) ||
      (pinned === false && hasWorld && !hasFloating)
    if (suggestsInverted) evidence += 1
  }

  const shouldInvert = total > 0 && evidence / total >= 0.75
  if (!shouldInvert) {
    return {
      effectivePinnedByNodeId: parsed,
      persistedPinnedByNodeId: null,
      shouldPersistVersion: true,
    }
  }

  const flipped: Record<string, boolean> = {}
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]!
    flipped[id] = !parsed[id]
  }
  return {
    effectivePinnedByNodeId: flipped,
    persistedPinnedByNodeId: flipped,
    shouldPersistVersion: true,
  }
}

export const applyGraphViewPinnedSemanticsMigration = (storage: Storage | null = getLocalStorage()): boolean => {
  const plan = planGraphViewPinnedSemanticsMigration(storage)
  if (!plan.shouldPersistVersion || !storage) return false
  if (plan.persistedPinnedByNodeId) {
    lsSetJson(LS_KEYS.flowWidgetPinnedByNodeId, plan.persistedPinnedByNodeId)
  }
  lsSetInt(LS_KEYS.flowWidgetPinnedSemanticsVersion, 2)
  return true
}

const isSamePinnedByNodeId = (a: Record<string, boolean>, b: Record<string, boolean>): boolean => {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (let i = 0; i < aKeys.length; i += 1) {
    const key = aKeys[i]
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false
    if (!!a[key] !== !!b[key]) return false
  }
  return true
}

const isSamePosByNodeId = (
  a: Record<string, { top: number; left: number }>,
  b: Record<string, { top: number; left: number }>,
): boolean => {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (let i = 0; i < aKeys.length; i += 1) {
    const key = aKeys[i]
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false
    const av = a[key]
    const bv = b[key]
    if (!av || !bv) return false
    if (av.top !== bv.top || av.left !== bv.left) return false
  }
  return true
}

const isSameWorldByNodeId = (
  a: Record<string, { x: number; y: number }>,
  b: Record<string, { x: number; y: number }>,
): boolean => {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (let i = 0; i < aKeys.length; i += 1) {
    const key = aKeys[i]
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false
    const av = a[key]
    const bv = b[key]
    if (!av || !bv) return false
    if (av.x !== bv.x || av.y !== bv.y) return false
  }
  return true
}

const getFlowWidgetGraphIndexStorageKey = (baseKey: string): string => `${String(baseKey || '').trim()}:graphKeys`
const getFlowWidgetGraphShardStorageKey = (baseKey: string, graphKey: string): string =>
  `${String(baseKey || '').trim()}:${encodeURIComponent(String(graphKey || '').trim())}`

const readFlowWidgetGraphIndex = (storage: Storage | null, baseKey: string): string[] => {
  if (!storage) return []
  try {
    const raw = storage.getItem(getFlowWidgetGraphIndexStorageKey(baseKey))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(v => String(v || '').trim()).filter(Boolean)
  } catch {
    return []
  }
}

const parseFlowWidgetPinnedByGraphMap = (raw: unknown): WidgetPinnedByGraphMap => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: WidgetPinnedByGraphMap = {}
  for (const [graphKeyRaw, entry] of Object.entries(raw as Record<string, unknown>)) {
    const graphKey = String(graphKeyRaw || '').trim()
    if (!graphKey) continue
    const inner = normalizePinnedByNodeId(entry as Record<string, boolean> | null | undefined)
    out[graphKey] = inner
  }
  return out
}

const parseFlowWidgetPosByGraphMap = (raw: unknown): WidgetPosByGraphMap => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: WidgetPosByGraphMap = {}
  for (const [graphKeyRaw, entry] of Object.entries(raw as Record<string, unknown>)) {
    const graphKey = String(graphKeyRaw || '').trim()
    if (!graphKey) continue
    const inner = normalizePosByNodeId(entry as Record<string, { top: number; left: number }> | null | undefined)
    out[graphKey] = inner
  }
  return out
}

const parseFlowWidgetWorldByGraphMap = (raw: unknown): WidgetWorldByGraphMap => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: WidgetWorldByGraphMap = {}
  for (const [graphKeyRaw, entry] of Object.entries(raw as Record<string, unknown>)) {
    const graphKey = String(graphKeyRaw || '').trim()
    if (!graphKey) continue
    const inner = normalizeWorldByNodeId(entry as Record<string, { x: number; y: number }> | null | undefined)
    out[graphKey] = inner
  }
  return out
}

const readShardedFlowWidgetGraphMap = <T>(
  storage: Storage | null,
  baseKey: string,
  parseEntry: (raw: unknown) => T,
  parseLegacy: (raw: unknown) => Record<string, T>,
): Record<string, T> => {
  if (!storage) return {}
  const graphKeys = readFlowWidgetGraphIndex(storage, baseKey)
  if (graphKeys.length > 0) {
    const out: Record<string, T> = {}
    for (let i = 0; i < graphKeys.length; i += 1) {
      const graphKey = graphKeys[i]
      try {
        const raw = storage.getItem(getFlowWidgetGraphShardStorageKey(baseKey, graphKey))
        if (!raw) continue
        out[graphKey] = parseEntry(JSON.parse(raw) as unknown)
      } catch {
        void 0
      }
    }
    return out
  }
  return readJsonFromStorage(storage, baseKey, {} as Record<string, T>, parseLegacy)
}

const writeShardedFlowWidgetGraphState = <T extends Record<string, unknown>>(
  storage: Storage | null,
  baseKey: string,
  graphKey: string,
  value: T,
): void => {
  if (!storage) return
  const normalizedBaseKey = String(baseKey || '').trim()
  const normalizedGraphKey = String(graphKey || '').trim()
  if (!normalizedBaseKey || !normalizedGraphKey) return
  const nextIndex = readFlowWidgetGraphIndex(storage, normalizedBaseKey)
  const hasEntries = Object.keys(value).length > 0
  const shardStorageKey = getFlowWidgetGraphShardStorageKey(normalizedBaseKey, normalizedGraphKey)
  try {
    if (hasEntries) {
      storage.setItem(shardStorageKey, JSON.stringify(value))
      const deduped = [normalizedGraphKey, ...nextIndex.filter(key => key !== normalizedGraphKey)]
      storage.setItem(getFlowWidgetGraphIndexStorageKey(normalizedBaseKey), JSON.stringify(deduped))
    } else {
      storage.removeItem(shardStorageKey)
      const pruned = nextIndex.filter(key => key !== normalizedGraphKey)
      if (pruned.length > 0) {
        storage.setItem(getFlowWidgetGraphIndexStorageKey(normalizedBaseKey), JSON.stringify(pruned))
      } else {
        storage.removeItem(getFlowWidgetGraphIndexStorageKey(normalizedBaseKey))
      }
    }
    storage.removeItem(normalizedBaseKey)
  } catch {
    void 0
  }
}

let pendingFlowWidgetPersistence: {
  pinned?: { graphKey: string; value: Record<string, boolean> }
  pos?: { graphKey: string; value: Record<string, { top: number; left: number }> }
  world?: { graphKey: string; value: Record<string, { x: number; y: number }> }
} = {}

const scheduleFlowWidgetPersistence = (patch: {
  pinned?: { graphKey: string; value: Record<string, boolean> }
  pos?: { graphKey: string; value: Record<string, { top: number; left: number }> }
  world?: { graphKey: string; value: Record<string, { x: number; y: number }> }
}): void => {
  if (patch.pinned) pendingFlowWidgetPersistence.pinned = patch.pinned
  if (patch.pos) pendingFlowWidgetPersistence.pos = patch.pos
  if (patch.world) pendingFlowWidgetPersistence.world = patch.world

  const signature = hashSignatureParts([
    pendingFlowWidgetPersistence.pinned
      ? hashSignatureParts([
          pendingFlowWidgetPersistence.pinned.graphKey,
          hashRecordSignature(pendingFlowWidgetPersistence.pinned.value, { maxEntries: 36 }),
        ])
      : '',
    pendingFlowWidgetPersistence.pos
      ? hashSignatureParts([
          pendingFlowWidgetPersistence.pos.graphKey,
          hashRecordSignature(pendingFlowWidgetPersistence.pos.value, { maxEntries: 36 }),
        ])
      : '',
    pendingFlowWidgetPersistence.world
      ? hashSignatureParts([
          pendingFlowWidgetPersistence.world.graphKey,
          hashRecordSignature(pendingFlowWidgetPersistence.world.value, { maxEntries: 36 }),
        ])
      : '',
  ])

  scheduleWorkspaceSyncTask(
    WORKSPACE_SYNC_TASK_FLOW_WIDGET_VIEW_STATE,
    () => {
      const pending = pendingFlowWidgetPersistence
      pendingFlowWidgetPersistence = {}
      const storage = getLocalStorage()
      if (pending.pinned) writeShardedFlowWidgetGraphState(storage, LS_KEYS.flowWidgetPinnedByGraphMetaKey, pending.pinned.graphKey, pending.pinned.value)
      if (pending.pos) writeShardedFlowWidgetGraphState(storage, LS_KEYS.flowWidgetPosByGraphMetaKey, pending.pos.graphKey, pending.pos.value)
      if (pending.world) writeShardedFlowWidgetGraphState(storage, LS_KEYS.flowWidgetWorldPosByGraphMetaKey, pending.world.graphKey, pending.world.value)
    },
    FLOW_WIDGET_PERSIST_DELAY_MS,
    {
      signature,
      scopeKey: WORKSPACE_SYNC_SCOPE_FLOW_WIDGET_RUNTIME_PERSISTENCE,
    },
  )
}

export const createGraphViewSlice = (set: SetGraph, get: GetGraph) => {
  const storage = getLocalStorage()
  const pinnedSemanticsMigrationPlan = planGraphViewPinnedSemanticsMigration(storage)
  return {
  collapsedGroupIds: [] as string[],
  collapsedGroupIdsByGraphMetaKey: {} as Record<string, string[]>,
  setCollapsedGroupIds: (ids: string[]) => {
    const next = normalizeIds(Array.isArray(ids) ? ids : [])
    const prev = get().collapsedGroupIds || []
    const graphKey = buildGraphMetaKeyIgnoringPending(get().graphData)
    const by = get().collapsedGroupIdsByGraphMetaKey || {}
    const prevForGraph = graphKey ? (by[graphKey] || []) : prev
    const sameGlobal = prev.length === next.length && prev.every((v, i) => v === next[i])
    const sameForGraph = prevForGraph.length === next.length && prevForGraph.every((v, i) => v === next[i])
    if (sameGlobal && sameForGraph) return
    const nextBy = graphKey ? { ...by, [graphKey]: next } : by
    set({ collapsedGroupIds: next, collapsedGroupIdsByGraphMetaKey: nextBy })
  },
  clearCollapsedGroups: () => {
    const prev = get().collapsedGroupIds || []
    if (prev.length === 0) return
    const graphKey = buildGraphMetaKeyIgnoringPending(get().graphData)
    const by = get().collapsedGroupIdsByGraphMetaKey || {}
    const prevForGraph = graphKey ? (by[graphKey] || []) : prev
    if (prevForGraph.length === 0) return
    const nextBy = graphKey ? { ...by, [graphKey]: [] } : by
    set({ collapsedGroupIds: [], collapsedGroupIdsByGraphMetaKey: nextBy })
  },
  toggleGroupCollapsed: (rawId: string) => {
    const id = String(rawId || '').trim()
    if (!id) return
    set(state => {
      const prev = state.collapsedGroupIds || []
      const exists = prev.includes(id)
      const next = exists ? prev.filter(x => x !== id) : [...prev, id]
      const normalized = normalizeIds(next)
      const graphKey = buildGraphMetaKeyIgnoringPending((state as unknown as { graphData?: unknown }).graphData as GraphState['graphData'])
      const by = (state as unknown as { collapsedGroupIdsByGraphMetaKey?: unknown }).collapsedGroupIdsByGraphMetaKey as Record<string, string[]> | undefined
      const nextBy = graphKey ? { ...(by || {}), [graphKey]: normalized } : (by || {})
      return { collapsedGroupIds: normalized, collapsedGroupIdsByGraphMetaKey: nextBy }
    })
  },
  openWidgetNodeIds: [] as string[],
  openWidgetNodeIdsByRenderer: {} as Partial<Record<Canvas2dRendererId, string[]>>,
  setOpenWidgetNodeIds: (ids: string[]) => {
    const next = normalizeOpenWidgetNodeIds(ids, get().graphData)
    const prev = get().openWidgetNodeIds || []
    const renderer = get().canvas2dRenderer
    const by = get().openWidgetNodeIdsByRenderer || {}
    const prevForRenderer = (renderer && by[renderer]) || []
    const sameGlobal = prev.length === next.length && prev.every((v, i) => v === next[i])
    const sameForRenderer =
      prevForRenderer.length === next.length && prevForRenderer.every((v, i) => v === next[i])
    if (sameGlobal && sameForRenderer) return
    const nextBy = renderer ? { ...by, [renderer]: next } : by
    set({ openWidgetNodeIds: next, openWidgetNodeIdsByRenderer: nextBy })
  },
  updateOpenWidgetNodeIds: (updater: (prev: string[]) => string[]) => {
    const prev = get().openWidgetNodeIds || []
    const next = normalizeOpenWidgetNodeIds(updater([...prev]), get().graphData)
    const renderer = get().canvas2dRenderer
    const by = get().openWidgetNodeIdsByRenderer || {}
    const prevForRenderer = (renderer && by[renderer]) || []
    const sameGlobal = prev.length === next.length && prev.every((v, i) => v === next[i])
    const sameForRenderer =
      prevForRenderer.length === next.length && prevForRenderer.every((v, i) => v === next[i])
    if (sameGlobal && sameForRenderer) return
    const nextBy = renderer ? { ...by, [renderer]: next } : by
    set({ openWidgetNodeIds: next, openWidgetNodeIdsByRenderer: nextBy })
  },
  flowWidgetPinnedByNodeId: pinnedSemanticsMigrationPlan.effectivePinnedByNodeId,
  flowWidgetPinnedByNodeIdByGraphMetaKey: readShardedFlowWidgetGraphMap(storage, LS_KEYS.flowWidgetPinnedByGraphMetaKey, raw => normalizePinnedByNodeId(raw as Record<string, boolean> | null | undefined), parseFlowWidgetPinnedByGraphMap),
  setFlowWidgetPinnedByNodeId: (pinnedById: Record<string, boolean>) => {
    const state = get()
    const nextPinnedById = normalizePinnedByNodeId(pinnedById)
    const graphKey = buildGraphMetaKeyIgnoringPending(state.graphData)
    const by = state.flowWidgetPinnedByNodeIdByGraphMetaKey || {}
    const prevPinnedById = state.flowWidgetPinnedByNodeId || {}
    const prevGraphPinnedById = graphKey ? (by[graphKey] || {}) : prevPinnedById
    const sameGlobal = isSamePinnedByNodeId(prevPinnedById, nextPinnedById)
    const sameForGraph = isSamePinnedByNodeId(prevGraphPinnedById, nextPinnedById)
    if (sameGlobal && sameForGraph) return
    const nextBy = graphKey ? { ...by, [graphKey]: nextPinnedById } : by
    if (graphKey) {
      set({
        flowWidgetPinnedByNodeId: nextPinnedById,
        flowWidgetPinnedByNodeIdByGraphMetaKey: nextBy,
      })
      scheduleFlowWidgetPersistence({ pinned: { graphKey, value: nextPinnedById } })
      return
    }
    set({ flowWidgetPinnedByNodeId: nextPinnedById })
  },
  flowWidgetPosByNodeIdByGraphMetaKey: readShardedFlowWidgetGraphMap(storage, LS_KEYS.flowWidgetPosByGraphMetaKey, raw => normalizePosByNodeId(raw as Record<string, { top: number; left: number }> | null | undefined), parseFlowWidgetPosByGraphMap),
  flowWidgetPosByNodeId: lsJson<Record<string, { top: number; left: number }>>(
    LS_KEYS.flowWidgetPosByNodeId,
    {},
    v => (v && typeof v === 'object' ? (v as Record<string, { top: number; left: number }>) : {}),
  ),
  setFlowWidgetPosByNodeId: (pos: Record<string, { top: number; left: number }>) => {
    const state = get()
    const nextPosByNodeId = normalizePosByNodeId(pos)
    const graphKey = buildGraphMetaKeyIgnoringPending(state.graphData)
    const by = state.flowWidgetPosByNodeIdByGraphMetaKey || {}
    const prevPosByNodeId = state.flowWidgetPosByNodeId || {}
    const prevGraphPosByNodeId = graphKey ? (by[graphKey] || {}) : prevPosByNodeId
    const sameGlobal = isSamePosByNodeId(prevPosByNodeId, nextPosByNodeId)
    const sameForGraph = isSamePosByNodeId(prevGraphPosByNodeId, nextPosByNodeId)
    if (sameGlobal && sameForGraph) return
    const nextBy = graphKey ? { ...by, [graphKey]: nextPosByNodeId } : by
    if (graphKey) {
      set({
        flowWidgetPosByNodeId: nextPosByNodeId,
        flowWidgetPosByNodeIdByGraphMetaKey: nextBy,
      })
      scheduleFlowWidgetPersistence({ pos: { graphKey, value: nextPosByNodeId } })
      return
    }
    set({ flowWidgetPosByNodeId: nextPosByNodeId })
  },
  flowWidgetWorldPosByNodeIdByGraphMetaKey: readShardedFlowWidgetGraphMap(storage, LS_KEYS.flowWidgetWorldPosByGraphMetaKey, raw => normalizeWorldByNodeId(raw as Record<string, { x: number; y: number }> | null | undefined), parseFlowWidgetWorldByGraphMap),
  flowWidgetWorldPosByNodeId: lsJson<Record<string, { x: number; y: number }>>(
    LS_KEYS.flowWidgetWorldPosByNodeId,
    {},
    raw => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
      const out: Record<string, { x: number; y: number }> = {}
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        const id = String(k || '').trim()
        if (!id) continue
        const o = v as { x?: unknown; y?: unknown } | null
        const x = typeof o?.x === 'number' && Number.isFinite(o.x) ? (o.x as number) : null
        const y = typeof o?.y === 'number' && Number.isFinite(o.y) ? (o.y as number) : null
        if (x == null || y == null) continue
        out[id] = { x, y }
      }
      return out
    },
  ),
  setFlowWidgetWorldPosByNodeId: (pos: Record<string, { x: number; y: number }>) => {
    const state = get()
    const nextWorldByNodeId = normalizeWorldByNodeId(pos)
    const graphKey = buildGraphMetaKeyIgnoringPending(state.graphData)
    const by = state.flowWidgetWorldPosByNodeIdByGraphMetaKey || {}
    const prevWorldByNodeId = state.flowWidgetWorldPosByNodeId || {}
    const prevGraphWorldByNodeId = graphKey ? (by[graphKey] || {}) : prevWorldByNodeId
    const sameGlobal = isSameWorldByNodeId(prevWorldByNodeId, nextWorldByNodeId)
    const sameForGraph = isSameWorldByNodeId(prevGraphWorldByNodeId, nextWorldByNodeId)
    if (sameGlobal && sameForGraph) return
    const nextBy = graphKey ? { ...by, [graphKey]: nextWorldByNodeId } : by
    if (graphKey) {
      set({
        flowWidgetWorldPosByNodeId: nextWorldByNodeId,
        flowWidgetWorldPosByNodeIdByGraphMetaKey: nextBy,
      })
      scheduleFlowWidgetPersistence({ world: { graphKey, value: nextWorldByNodeId } })
      return
    }
    set({ flowWidgetWorldPosByNodeId: nextWorldByNodeId })
  },
  flowWidgetDraggingNodeId: null as string | null,
  setFlowWidgetDraggingNodeId: (rawId: string | null) => {
    const id = rawId == null ? null : String(rawId || '').trim()
    const prev = get().flowWidgetDraggingNodeId ?? null
    if (prev === id) return
    set({ flowWidgetDraggingNodeId: id })
  },
  }
}
