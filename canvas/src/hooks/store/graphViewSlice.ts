import type { GraphState } from '@/hooks/store/types'
import type { StoreApi } from 'zustand'
import { LS_KEYS } from '@/lib/config.ls.keys'
import { getLocalStorage, lsJson, lsSetInt, lsSetJson } from '@/lib/persistence'
import type { Canvas2dRendererId } from '@/lib/config.render'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import {
  WORKSPACE_SYNC_SCOPE_FLOW_QUICK_EDITOR_RUNTIME_PERSISTENCE,
  WORKSPACE_SYNC_TASK_FLOW_QUICK_EDITOR_VIEW_STATE,
} from '@/lib/async/workspaceSyncKeys'
import { hashRecordSignature, hashSignatureParts } from '@/lib/hash/signature'
import { FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY } from '@/lib/config'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { buildFlowQuickEditorEligibleNodeIdSet } from '@/lib/graph/flowQuickEditorEligibility'

const FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY = 'flow:quickEditorFormId' as const
const FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY_LEGACY = 'flow:nodeQuickEditorFormId' as const

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

const normalizeOpenQuickEditorNodeIds = (ids: string[], graphData: GraphState['graphData'] | null): string[] => {
  const normalized = normalizeIds(Array.isArray(ids) ? ids : [])
  if (!graphData) return normalized
  const nodeIds = new Set<string>((graphData.nodes || []).map(n => String(n.id || '')).filter(Boolean))
  const validNodeIds = normalized.filter(id => nodeIds.has(id))
  if (!isFrontmatterFlowGraph(graphData)) {
    const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
    const eligible = buildFlowQuickEditorEligibleNodeIdSet(nodes as any)
    if (eligible.size === 0) return validNodeIds
    return validNodeIds.filter(id => eligible.has(id))
  }

  const metadata = ((graphData.metadata || {}) as Record<string, unknown>)

  const registryRaw = metadata[FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]
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
      typeof props[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY] === 'string'
        ? String(props[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY] || '').trim()
        : typeof props[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY_LEGACY] === 'string'
          ? String(props[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY_LEGACY] || '').trim()
          : ''
    const expectedFormId = explicitFormId || `fm:${id}`
    return allowedFormIds.has(expectedFormId)
  })
}

const FLOW_QUICK_EDITOR_PERSIST_DELAY_MS = 90

type QuickEditorPinnedByGraphMap = Record<string, Record<string, boolean>>
type QuickEditorPosByGraphMap = Record<string, Record<string, { top: number; left: number }>>
type QuickEditorWorldByGraphMap = Record<string, Record<string, { x: number; y: number }>>

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
  readStorageJson(storage, LS_KEYS.flowNodeQuickEditorPinnedByNodeId, {}, raw => {
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
  readStorageJson(storage, LS_KEYS.flowNodeQuickEditorPosByNodeId, {}, raw =>
    normalizePosByNodeId(raw as Record<string, { top: number; left: number }> | null | undefined),
  )

const readWorldByNodeIdFromStorage = (storage: Storage | null): Record<string, { x: number; y: number }> =>
  readStorageJson(storage, LS_KEYS.flowNodeQuickEditorWorldPosByNodeId, {}, raw =>
    normalizeWorldByNodeId(raw as Record<string, { x: number; y: number }> | null | undefined),
  )

export const planGraphViewPinnedSemanticsMigration = (
  storage: Storage | null = getLocalStorage(),
): GraphViewPinnedSemanticsMigrationPlan => {
  const parsed = readPinnedByNodeIdFromStorage(storage)
  const version = readStorageInt(storage, LS_KEYS.flowNodeQuickEditorPinnedSemanticsVersion, 0)
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
    lsSetJson(LS_KEYS.flowNodeQuickEditorPinnedByNodeId, plan.persistedPinnedByNodeId)
  }
  lsSetInt(LS_KEYS.flowNodeQuickEditorPinnedSemanticsVersion, 2)
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

let pendingFlowQuickEditorPersistence: {
  pinnedByGraph?: QuickEditorPinnedByGraphMap
  posByGraph?: QuickEditorPosByGraphMap
  worldByGraph?: QuickEditorWorldByGraphMap
} = {}

const scheduleFlowQuickEditorPersistence = (patch: {
  pinnedByGraph?: QuickEditorPinnedByGraphMap
  posByGraph?: QuickEditorPosByGraphMap
  worldByGraph?: QuickEditorWorldByGraphMap
}): void => {
  if (patch.pinnedByGraph) pendingFlowQuickEditorPersistence.pinnedByGraph = patch.pinnedByGraph
  if (patch.posByGraph) pendingFlowQuickEditorPersistence.posByGraph = patch.posByGraph
  if (patch.worldByGraph) pendingFlowQuickEditorPersistence.worldByGraph = patch.worldByGraph

  const signature = hashSignatureParts([
    pendingFlowQuickEditorPersistence.pinnedByGraph ? hashRecordSignature(pendingFlowQuickEditorPersistence.pinnedByGraph, { maxEntries: 36 }) : '',
    pendingFlowQuickEditorPersistence.posByGraph ? hashRecordSignature(pendingFlowQuickEditorPersistence.posByGraph, { maxEntries: 36 }) : '',
    pendingFlowQuickEditorPersistence.worldByGraph ? hashRecordSignature(pendingFlowQuickEditorPersistence.worldByGraph, { maxEntries: 36 }) : '',
  ])

  scheduleWorkspaceSyncTask(
    WORKSPACE_SYNC_TASK_FLOW_QUICK_EDITOR_VIEW_STATE,
    () => {
      const pending = pendingFlowQuickEditorPersistence
      pendingFlowQuickEditorPersistence = {}
      if (pending.pinnedByGraph) lsSetJson(LS_KEYS.flowNodeQuickEditorPinnedByGraphMetaKey, pending.pinnedByGraph)
      if (pending.posByGraph) lsSetJson(LS_KEYS.flowNodeQuickEditorPosByGraphMetaKey, pending.posByGraph)
      if (pending.worldByGraph) lsSetJson(LS_KEYS.flowNodeQuickEditorWorldPosByGraphMetaKey, pending.worldByGraph)
    },
    FLOW_QUICK_EDITOR_PERSIST_DELAY_MS,
    {
      signature,
      scopeKey: WORKSPACE_SYNC_SCOPE_FLOW_QUICK_EDITOR_RUNTIME_PERSISTENCE,
    },
  )
}

export const createGraphViewSlice = (set: SetGraph, get: GetGraph) => {
  const pinnedSemanticsMigrationPlan = planGraphViewPinnedSemanticsMigration(getLocalStorage())
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
  openQuickEditorNodeIds: [] as string[],
  openQuickEditorNodeIdsByRenderer: {} as Partial<Record<Canvas2dRendererId, string[]>>,
  setOpenQuickEditorNodeIds: (ids: string[]) => {
    const next = normalizeOpenQuickEditorNodeIds(ids, get().graphData)
    const prev = get().openQuickEditorNodeIds || []
    const renderer = get().canvas2dRenderer
    const by = get().openQuickEditorNodeIdsByRenderer || {}
    const prevForRenderer = (renderer && by[renderer]) || []
    const sameGlobal = prev.length === next.length && prev.every((v, i) => v === next[i])
    const sameForRenderer =
      prevForRenderer.length === next.length && prevForRenderer.every((v, i) => v === next[i])
    if (sameGlobal && sameForRenderer) return
    const nextBy = renderer ? { ...by, [renderer]: next } : by
    set({ openQuickEditorNodeIds: next, openQuickEditorNodeIdsByRenderer: nextBy })
  },
  updateOpenQuickEditorNodeIds: (updater: (prev: string[]) => string[]) => {
    const prev = get().openQuickEditorNodeIds || []
    const next = normalizeOpenQuickEditorNodeIds(updater([...prev]), get().graphData)
    const renderer = get().canvas2dRenderer
    const by = get().openQuickEditorNodeIdsByRenderer || {}
    const prevForRenderer = (renderer && by[renderer]) || []
    const sameGlobal = prev.length === next.length && prev.every((v, i) => v === next[i])
    const sameForRenderer =
      prevForRenderer.length === next.length && prevForRenderer.every((v, i) => v === next[i])
    if (sameGlobal && sameForRenderer) return
    const nextBy = renderer ? { ...by, [renderer]: next } : by
    set({ openQuickEditorNodeIds: next, openQuickEditorNodeIdsByRenderer: nextBy })
  },
  flowNodeQuickEditorPinnedByNodeId: pinnedSemanticsMigrationPlan.effectivePinnedByNodeId,
  flowNodeQuickEditorPinnedByNodeIdByGraphMetaKey: lsJson<Record<string, Record<string, boolean>>>(
    LS_KEYS.flowNodeQuickEditorPinnedByGraphMetaKey,
    {},
    raw => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
      const out: Record<string, Record<string, boolean>> = {}
      for (const [graphKeyRaw, entry] of Object.entries(raw as Record<string, unknown>)) {
        const graphKey = String(graphKeyRaw || '').trim()
        if (!graphKey) continue
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
        const inner: Record<string, boolean> = {}
        for (const [nodeIdRaw, v] of Object.entries(entry as Record<string, unknown>)) {
          const nodeId = String(nodeIdRaw || '').trim()
          if (!nodeId) continue
          if (typeof v !== 'boolean') continue
          inner[nodeId] = v
        }
        out[graphKey] = inner
      }
      return out
    },
  ),
  setFlowNodeQuickEditorPinnedByNodeId: (pinnedById: Record<string, boolean>) => {
    const state = get()
    const nextPinnedById = normalizePinnedByNodeId(pinnedById)
    const graphKey = buildGraphMetaKeyIgnoringPending(state.graphData)
    const by = state.flowNodeQuickEditorPinnedByNodeIdByGraphMetaKey || {}
    const prevPinnedById = state.flowNodeQuickEditorPinnedByNodeId || {}
    const prevGraphPinnedById = graphKey ? (by[graphKey] || {}) : prevPinnedById
    const sameGlobal = isSamePinnedByNodeId(prevPinnedById, nextPinnedById)
    const sameForGraph = isSamePinnedByNodeId(prevGraphPinnedById, nextPinnedById)
    if (sameGlobal && sameForGraph) return
    const nextBy = graphKey ? { ...by, [graphKey]: nextPinnedById } : by
    if (graphKey) {
      set({
        flowNodeQuickEditorPinnedByNodeId: nextPinnedById,
        flowNodeQuickEditorPinnedByNodeIdByGraphMetaKey: nextBy,
      })
      scheduleFlowQuickEditorPersistence({ pinnedByGraph: nextBy })
      return
    }
    set({ flowNodeQuickEditorPinnedByNodeId: nextPinnedById })
  },
  flowNodeQuickEditorPosByNodeIdByGraphMetaKey: lsJson<Record<string, Record<string, { top: number; left: number }>>>(
    LS_KEYS.flowNodeQuickEditorPosByGraphMetaKey,
    {},
    raw => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
      const out: Record<string, Record<string, { top: number; left: number }>> = {}
      for (const [graphKeyRaw, entry] of Object.entries(raw as Record<string, unknown>)) {
        const graphKey = String(graphKeyRaw || '').trim()
        if (!graphKey) continue
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
        const inner: Record<string, { top: number; left: number }> = {}
        for (const [nodeIdRaw, v] of Object.entries(entry as Record<string, unknown>)) {
          const nodeId = String(nodeIdRaw || '').trim()
          if (!nodeId) continue
          const o = v as { top?: unknown; left?: unknown } | null
          const top = typeof o?.top === 'number' && Number.isFinite(o.top) ? (o.top as number) : null
          const left = typeof o?.left === 'number' && Number.isFinite(o.left) ? (o.left as number) : null
          if (top == null || left == null) continue
          inner[nodeId] = { top, left }
        }
        out[graphKey] = inner
      }
      return out
    },
  ),
  flowNodeQuickEditorPosByNodeId: lsJson<Record<string, { top: number; left: number }>>(
    LS_KEYS.flowNodeQuickEditorPosByNodeId,
    {},
    v => (v && typeof v === 'object' ? (v as Record<string, { top: number; left: number }>) : {}),
  ),
  setFlowNodeQuickEditorPosByNodeId: (pos: Record<string, { top: number; left: number }>) => {
    const state = get()
    const nextPosByNodeId = normalizePosByNodeId(pos)
    const graphKey = buildGraphMetaKeyIgnoringPending(state.graphData)
    const by = state.flowNodeQuickEditorPosByNodeIdByGraphMetaKey || {}
    const prevPosByNodeId = state.flowNodeQuickEditorPosByNodeId || {}
    const prevGraphPosByNodeId = graphKey ? (by[graphKey] || {}) : prevPosByNodeId
    const sameGlobal = isSamePosByNodeId(prevPosByNodeId, nextPosByNodeId)
    const sameForGraph = isSamePosByNodeId(prevGraphPosByNodeId, nextPosByNodeId)
    if (sameGlobal && sameForGraph) return
    const nextBy = graphKey ? { ...by, [graphKey]: nextPosByNodeId } : by
    if (graphKey) {
      set({
        flowNodeQuickEditorPosByNodeId: nextPosByNodeId,
        flowNodeQuickEditorPosByNodeIdByGraphMetaKey: nextBy,
      })
      scheduleFlowQuickEditorPersistence({ posByGraph: nextBy })
      return
    }
    set({ flowNodeQuickEditorPosByNodeId: nextPosByNodeId })
  },
  flowNodeQuickEditorWorldPosByNodeIdByGraphMetaKey: lsJson<Record<string, Record<string, { x: number; y: number }>>>(
    LS_KEYS.flowNodeQuickEditorWorldPosByGraphMetaKey,
    {},
    raw => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
      const out: Record<string, Record<string, { x: number; y: number }>> = {}
      for (const [graphKeyRaw, entry] of Object.entries(raw as Record<string, unknown>)) {
        const graphKey = String(graphKeyRaw || '').trim()
        if (!graphKey) continue
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
        const inner: Record<string, { x: number; y: number }> = {}
        for (const [nodeIdRaw, v] of Object.entries(entry as Record<string, unknown>)) {
          const nodeId = String(nodeIdRaw || '').trim()
          if (!nodeId) continue
          const o = v as { x?: unknown; y?: unknown } | null
          const x = typeof o?.x === 'number' && Number.isFinite(o.x) ? (o.x as number) : null
          const y = typeof o?.y === 'number' && Number.isFinite(o.y) ? (o.y as number) : null
          if (x == null || y == null) continue
          inner[nodeId] = { x, y }
        }
        out[graphKey] = inner
      }
      return out
    },
  ),
  flowNodeQuickEditorWorldPosByNodeId: lsJson<Record<string, { x: number; y: number }>>(
    LS_KEYS.flowNodeQuickEditorWorldPosByNodeId,
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
  setFlowNodeQuickEditorWorldPosByNodeId: (pos: Record<string, { x: number; y: number }>) => {
    const state = get()
    const nextWorldByNodeId = normalizeWorldByNodeId(pos)
    const graphKey = buildGraphMetaKeyIgnoringPending(state.graphData)
    const by = state.flowNodeQuickEditorWorldPosByNodeIdByGraphMetaKey || {}
    const prevWorldByNodeId = state.flowNodeQuickEditorWorldPosByNodeId || {}
    const prevGraphWorldByNodeId = graphKey ? (by[graphKey] || {}) : prevWorldByNodeId
    const sameGlobal = isSameWorldByNodeId(prevWorldByNodeId, nextWorldByNodeId)
    const sameForGraph = isSameWorldByNodeId(prevGraphWorldByNodeId, nextWorldByNodeId)
    if (sameGlobal && sameForGraph) return
    const nextBy = graphKey ? { ...by, [graphKey]: nextWorldByNodeId } : by
    if (graphKey) {
      set({
        flowNodeQuickEditorWorldPosByNodeId: nextWorldByNodeId,
        flowNodeQuickEditorWorldPosByNodeIdByGraphMetaKey: nextBy,
      })
      scheduleFlowQuickEditorPersistence({ worldByGraph: nextBy })
      return
    }
    set({ flowNodeQuickEditorWorldPosByNodeId: nextWorldByNodeId })
  },
  flowNodeQuickEditorDraggingNodeId: null as string | null,
  setFlowNodeQuickEditorDraggingNodeId: (rawId: string | null) => {
    const id = rawId == null ? null : String(rawId || '').trim()
    const prev = get().flowNodeQuickEditorDraggingNodeId ?? null
    if (prev === id) return
    set({ flowNodeQuickEditorDraggingNodeId: id })
  },
  }
}
