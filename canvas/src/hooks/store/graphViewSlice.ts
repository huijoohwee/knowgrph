import type { GraphState } from '@/hooks/store/types'
import type { StoreApi } from 'zustand'
import { LS_KEYS } from '@/lib/config'
import { lsInt, lsJson, lsSetInt, lsSetJson } from '@/lib/persistence'
import type { Canvas2dRendererId } from '@/lib/config'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'

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
  return normalized.filter(id => nodeIds.has(id))
}

export const createGraphViewSlice = (set: SetGraph, get: GetGraph) => ({
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
  flowNodeQuickEditorPinnedByNodeId: (() => {
    const parsed = lsJson<Record<string, boolean>>(
      LS_KEYS.flowNodeQuickEditorPinnedByNodeId,
      {},
      raw => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
        const out: Record<string, boolean> = {}
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
          const id = String(k || '').trim()
          if (!id) continue
          out[id] = !!v
        }
        return out
      },
    )

    const version = lsInt(LS_KEYS.flowNodeQuickEditorPinnedSemanticsVersion, 0)
    if (version >= 2) return parsed

    const posById = lsJson<Record<string, { top: number; left: number }>>(
      LS_KEYS.flowNodeQuickEditorPosByNodeId,
      {},
      v => (v && typeof v === 'object' ? (v as Record<string, { top: number; left: number }>) : {}),
    )
    const worldById = lsJson<Record<string, { x: number; y: number }>>(
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
    )

    const ids = Object.keys(parsed)
    if (ids.length === 0) {
      lsSetInt(LS_KEYS.flowNodeQuickEditorPinnedSemanticsVersion, 2)
      return parsed
    }

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
      lsSetInt(LS_KEYS.flowNodeQuickEditorPinnedSemanticsVersion, 2)
      return parsed
    }

    const flipped: Record<string, boolean> = {}
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i]!
      flipped[id] = !parsed[id]
    }
    lsSetJson(LS_KEYS.flowNodeQuickEditorPinnedByNodeId, flipped)
    lsSetInt(LS_KEYS.flowNodeQuickEditorPinnedSemanticsVersion, 2)
    return flipped
  })(),
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
    const graphKey = buildGraphMetaKeyIgnoringPending(state.graphData)
    const by = state.flowNodeQuickEditorPinnedByNodeIdByGraphMetaKey || {}
    const nextBy = graphKey ? { ...by, [graphKey]: pinnedById || {} } : by
    if (graphKey) {
      set({
        flowNodeQuickEditorPinnedByNodeId: pinnedById || {},
        flowNodeQuickEditorPinnedByNodeIdByGraphMetaKey: lsSetJson(LS_KEYS.flowNodeQuickEditorPinnedByGraphMetaKey, nextBy),
      })
      return
    }
    set({ flowNodeQuickEditorPinnedByNodeId: pinnedById || {} })
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
    const graphKey = buildGraphMetaKeyIgnoringPending(state.graphData)
    const by = state.flowNodeQuickEditorPosByNodeIdByGraphMetaKey || {}
    const nextBy = graphKey ? { ...by, [graphKey]: pos || {} } : by
    if (graphKey) {
      set({
        flowNodeQuickEditorPosByNodeId: pos || {},
        flowNodeQuickEditorPosByNodeIdByGraphMetaKey: lsSetJson(LS_KEYS.flowNodeQuickEditorPosByGraphMetaKey, nextBy),
      })
      return
    }
    set({ flowNodeQuickEditorPosByNodeId: pos || {} })
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
    const graphKey = buildGraphMetaKeyIgnoringPending(state.graphData)
    const by = state.flowNodeQuickEditorWorldPosByNodeIdByGraphMetaKey || {}
    const nextBy = graphKey ? { ...by, [graphKey]: pos || {} } : by
    if (graphKey) {
      set({
        flowNodeQuickEditorWorldPosByNodeId: pos || {},
        flowNodeQuickEditorWorldPosByNodeIdByGraphMetaKey: lsSetJson(LS_KEYS.flowNodeQuickEditorWorldPosByGraphMetaKey, nextBy),
      })
      return
    }
    set({ flowNodeQuickEditorWorldPosByNodeId: pos || {} })
  },
  flowNodeQuickEditorDraggingNodeId: null as string | null,
  setFlowNodeQuickEditorDraggingNodeId: (rawId: string | null) => {
    const id = rawId == null ? null : String(rawId || '').trim()
    const prev = get().flowNodeQuickEditorDraggingNodeId ?? null
    if (prev === id) return
    set({ flowNodeQuickEditorDraggingNodeId: id })
  },
})
