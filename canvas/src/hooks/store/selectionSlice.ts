import type { GraphState } from '@/hooks/useGraphStore'
import type { StoreApi } from 'zustand'

type SetGraph = StoreApi<GraphState>['setState']
type GetGraph = StoreApi<GraphState>['getState']

export const createSelectionSlice = (set: SetGraph, get: GetGraph) => ({
  selectedNodeId: null as string | null,
  selectedEdgeId: null as string | null,
  selectedNodeIds: [] as string[],
  selectedEdgeIds: [] as string[],
  selectionSource: null as null | 'canvas' | 'menu' | 'toolbar' | 'editor' | 'table' | 'unknown',
  setSelectionSource: (src: null | 'canvas' | 'menu' | 'toolbar' | 'editor' | 'table' | 'unknown') =>
    set({ selectionSource: src }),
  selectNode: (id: string | null) => {
    const state = get()
    const mode = state.schema.behavior?.selectMode || 'single'
    if (!id) {
      set({
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedNodeIds: [],
        selectedEdgeIds: [],
      })
      return
    }
    if (mode === 'multi' || mode === 'lasso') {
      const prevIds = state.selectedNodeIds || []
      const exists = prevIds.includes(id)
      const nextIds = exists ? prevIds.filter(x => x !== id) : [...prevIds, id]
      const nextActiveId = nextIds.length > 0 ? (nextIds.includes(id) ? id : nextIds[nextIds.length - 1]) : null
      set({
        selectedNodeId: nextActiveId,
        selectedEdgeId: state.selectedEdgeId,
        selectedNodeIds: nextIds,
        selectedEdgeIds: state.selectedEdgeIds || [],
      })
      return
    }
    set({
      selectedNodeId: id,
      selectedEdgeId: null,
      selectedNodeIds: [id],
      selectedEdgeIds: [],
    })
  },
  selectEdge: (id: string | null) => {
    const state = get()
    const mode = state.schema.behavior?.selectMode || 'single'
    if (!id) {
      set({
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedNodeIds: [],
        selectedEdgeIds: [],
      })
      return
    }
    if (mode === 'multi' || mode === 'lasso') {
      const prevIds = state.selectedEdgeIds || []
      const exists = prevIds.includes(id)
      const nextIds = exists ? prevIds.filter(x => x !== id) : [...prevIds, id]
      const nextActiveId = nextIds.length > 0 ? (nextIds.includes(id) ? id : nextIds[nextIds.length - 1]) : null
      set({
        selectedNodeId: state.selectedNodeId,
        selectedEdgeId: nextActiveId,
        selectedNodeIds: state.selectedNodeIds || [],
        selectedEdgeIds: nextIds,
      })
      return
    }
    set({
      selectedNodeId: null,
      selectedEdgeId: id,
      selectedNodeIds: [],
      selectedEdgeIds: [id],
    })
  },
});
