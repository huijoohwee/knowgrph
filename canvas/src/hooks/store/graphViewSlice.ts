import type { GraphState } from '@/hooks/store/types'
import type { StoreApi } from 'zustand'

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
  setCollapsedGroupIds: (ids: string[]) => {
    const next = normalizeIds(Array.isArray(ids) ? ids : [])
    const prev = get().collapsedGroupIds || []
    if (prev.length === next.length && prev.every((v, i) => v === next[i])) return
    set({ collapsedGroupIds: next })
  },
  clearCollapsedGroups: () => {
    const prev = get().collapsedGroupIds || []
    if (prev.length === 0) return
    set({ collapsedGroupIds: [] })
  },
  toggleGroupCollapsed: (rawId: string) => {
    const id = String(rawId || '').trim()
    if (!id) return
    set(state => {
      const prev = state.collapsedGroupIds || []
      const exists = prev.includes(id)
      const next = exists ? prev.filter(x => x !== id) : [...prev, id]
      return { collapsedGroupIds: normalizeIds(next) }
    })
  },
  openQuickEditorNodeIds: [] as string[],
  setOpenQuickEditorNodeIds: (ids: string[]) => {
    const next = normalizeOpenQuickEditorNodeIds(ids, get().graphData)
    const prev = get().openQuickEditorNodeIds || []
    if (prev.length === next.length && prev.every((v, i) => v === next[i])) return
    set({ openQuickEditorNodeIds: next })
  },
  updateOpenQuickEditorNodeIds: (updater: (prev: string[]) => string[]) => {
    const prev = get().openQuickEditorNodeIds || []
    const next = normalizeOpenQuickEditorNodeIds(updater([...prev]), get().graphData)
    if (prev.length === next.length && prev.every((v, i) => v === next[i])) return
    set({ openQuickEditorNodeIds: next })
  },
  flowNodeQuickEditorAnchorOffsetByNodeId: {} as Record<string, { dx: number; dy: number }>,
  setFlowNodeQuickEditorAnchorOffsetByNodeId: (offsets: Record<string, { dx: number; dy: number }>) => {
    const next = offsets || {}
    const prev = get().flowNodeQuickEditorAnchorOffsetByNodeId || {}
    const prevKeys = Object.keys(prev)
    const nextKeys = Object.keys(next)
    if (prevKeys.length === nextKeys.length) {
      let same = true
      for (let i = 0; i < prevKeys.length; i += 1) {
        const k = prevKeys[i]
        const a = prev[k]
        const b = next[k]
        if (!b || a.dx !== b.dx || a.dy !== b.dy) {
          same = false
          break
        }
      }
      if (same) return
    }
    set({ flowNodeQuickEditorAnchorOffsetByNodeId: next })
  },
  clearFlowNodeQuickEditorAnchorOffsetByNodeId: (rawId: string) => {
    const id = String(rawId || '').trim()
    if (!id) return
    set(state => {
      const prev = state.flowNodeQuickEditorAnchorOffsetByNodeId || {}
      if (!prev[id]) return {}
      const next = { ...prev }
      delete next[id]
      return { flowNodeQuickEditorAnchorOffsetByNodeId: next }
    })
  },
})
