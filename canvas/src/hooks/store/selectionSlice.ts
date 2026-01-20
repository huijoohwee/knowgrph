import type { GraphState } from '@/hooks/store/types'
import type { StoreApi } from 'zustand'

type SetGraph = StoreApi<GraphState>['setState']
type GetGraph = StoreApi<GraphState>['getState']

export const createSelectionSlice = (set: SetGraph, get: GetGraph) => ({
  selectedNodeId: null as string | null,
  selectedEdgeId: null as string | null,
  selectedGroupId: null as string | null,
  selectedNodeIds: [] as string[],
  selectedEdgeIds: [] as string[],
  selectedGroupIds: [] as string[],
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
        selectedGroupId: null,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        selectedGroupIds: [],
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
        selectedGroupId: null,
        selectedNodeIds: nextIds,
        selectedEdgeIds: state.selectedEdgeIds || [],
        selectedGroupIds: [],
      })
      return
    }
    set({
      selectedNodeId: id,
      selectedEdgeId: null,
      selectedGroupId: null,
      selectedNodeIds: [id],
      selectedEdgeIds: [],
      selectedGroupIds: [],
    })
  },
  selectEdge: (id: string | null) => {
    const state = get()
    const mode = state.schema.behavior?.selectMode || 'single'
    if (!id) {
      set({
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedGroupId: null,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        selectedGroupIds: [],
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
        selectedGroupId: null,
        selectedNodeIds: state.selectedNodeIds || [],
        selectedEdgeIds: nextIds,
        selectedGroupIds: [],
      })
      return
    }
    set({
      selectedNodeId: null,
      selectedEdgeId: id,
      selectedGroupId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [id],
      selectedGroupIds: [],
    })
  },
  selectGroup: (id: string | null) => {
    const state = get()
    const mode = state.schema.behavior?.selectMode || 'single'
    if (!id) {
      set({
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedGroupId: null,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        selectedGroupIds: [],
      })
      return
    }
    if (mode === 'multi' || mode === 'lasso') {
      const prevIds = state.selectedGroupIds || []
      const exists = prevIds.includes(id)
      const nextIds = exists ? prevIds.filter(x => x !== id) : [...prevIds, id]
      const nextActiveId = nextIds.length > 0 ? (nextIds.includes(id) ? id : nextIds[nextIds.length - 1]) : null
      set({
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedGroupId: nextActiveId,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        selectedGroupIds: nextIds,
      })
      return
    }
    set({
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedGroupId: id,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedGroupIds: [id],
    })
  },
  selectGroupExpanded: (args: { id: string; nodeIds: string[]; edgeIds: string[] }) => {
    const id = String(args.id || '').trim()
    if (!id) return
    const nodeIds = Array.isArray(args.nodeIds) ? args.nodeIds.map(x => String(x)).filter(Boolean) : []
    const edgeIds = Array.isArray(args.edgeIds) ? args.edgeIds.map(x => String(x)).filter(Boolean) : []
    set({
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedGroupId: id,
      selectedNodeIds: nodeIds,
      selectedEdgeIds: edgeIds,
      selectedGroupIds: [id],
    })
  },
});
