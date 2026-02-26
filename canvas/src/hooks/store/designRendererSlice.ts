import type { StoreApi } from 'zustand'

import { moveDesignLayer, normalizeDesignLayerState, toggleDesignLayerHidden } from '@/features/design/designLayersState'
import type { DesignLayerNode, DesignLayerState } from '@/features/design/designLayersState'
import type { GraphState } from '@/hooks/store/types'
import type { GraphNode } from '@/lib/graph/types'

type SetGraph = StoreApi<GraphState>['setState']
type GetGraph = StoreApi<GraphState>['getState']

export type DesignFramePos = { x: number; y: number }

export function designFramePosEq(a: DesignFramePos | null | undefined, b: DesignFramePos | null | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.x === b.x && a.y === b.y
}

const normId = (v: unknown): string => String(v || '').trim()

const clampFinite = (v: number, fallback: number): number => {
  if (!Number.isFinite(v)) return fallback
  return v
}

export const createDesignRendererSlice = (set: SetGraph, get: GetGraph) => {
  return {
    designLayerState: { order: [], hiddenById: {} } as DesignLayerState,
    normalizeDesignLayerStateFromNodes: (nodes: DesignLayerNode[]) => {
      const state = get()
      const prev = state.designLayerState
      const next = normalizeDesignLayerState({ prev, nodes: Array.isArray(nodes) ? nodes : [] })

      if (next.order.length === prev.order.length) {
        let same = true
        for (let i = 0; i < next.order.length; i += 1) {
          if (next.order[i] !== prev.order[i]) {
            same = false
            break
          }
        }
        if (same) {
          const prevHidden = prev.hiddenById || {}
          const nextHidden = next.hiddenById || {}
          const nextKeys = Object.keys(nextHidden)
          const prevKeys = Object.keys(prevHidden)
          if (nextKeys.length === prevKeys.length) {
            for (let i = 0; i < nextKeys.length; i += 1) {
              const k = nextKeys[i]
              if (prevHidden[k] !== nextHidden[k]) {
                same = false
                break
              }
            }
          } else {
            same = false
          }
        }
        if (same) return
      }

      set({ designLayerState: next })
    },
    toggleDesignLayerHidden: (id: string) => {
      const key = normId(id)
      if (!key) return
      const prev = get().designLayerState
      const nextHidden = toggleDesignLayerHidden(prev.hiddenById || {}, key)
      if (nextHidden === prev.hiddenById) return
      set({ designLayerState: { ...prev, hiddenById: nextHidden } })
    },
    moveDesignLayer: (id: string, dir: 'up' | 'down') => {
      const key = normId(id)
      if (!key) return
      const prev = get().designLayerState
      const nextOrder = moveDesignLayer({ order: prev.order || [], id: key, dir })
      if (nextOrder === prev.order) return
      set({ designLayerState: { ...prev, order: nextOrder } })
    },
    setDesignLayerState: (next: DesignLayerState) => {
      const n = next || { order: [], hiddenById: {} }
      set({ designLayerState: { order: Array.isArray(n.order) ? n.order : [], hiddenById: n.hiddenById || {} } })
    },

    designRendererNodes: [] as DesignLayerNode[],
    setDesignRendererNodes: (nodes: DesignLayerNode[]) => {
      const next = Array.isArray(nodes) ? nodes : []
      const prev = get().designRendererNodes || []
      if (next.length === prev.length) {
        let same = true
        for (let i = 0; i < next.length; i += 1) {
          const a = prev[i]
          const b = next[i]
          if (a?.id !== b?.id || a?.label !== b?.label || a?.type !== b?.type) {
            same = false
            break
          }
        }
        if (same) return
      }
      set({ designRendererNodes: next })
    },

    designRendererWebpageLayoutKey: null as string | null,
    designRendererGraphNodesById: {} as Record<string, GraphNode>,
    setDesignRendererWebpageGraph: (args: { key: string | null; nodesById: Record<string, GraphNode> }) => {
      const nextKey = typeof args.key === 'string' && args.key.trim() ? args.key.trim() : null
      const state = get()
      if (state.designRendererWebpageLayoutKey === nextKey) return
      const nodesById = args.nodesById && typeof args.nodesById === 'object' ? args.nodesById : {}
      set({ designRendererWebpageLayoutKey: nextKey, designRendererGraphNodesById: nodesById })
    },

    designFramePosById: {} as Record<string, DesignFramePos>,
    setDesignFramePos: (id: string, pos: DesignFramePos) => {
      const key = normId(id)
      if (!key) return
      const nextPos = { x: clampFinite(pos.x, 0), y: clampFinite(pos.y, 0) }
      const prev = get().designFramePosById || {}
      const prevPos = prev[key]
      if (designFramePosEq(prevPos, nextPos)) return
      set({ designFramePosById: { ...prev, [key]: nextPos } })
    },
    setDesignFramePosMany: (patch: Record<string, DesignFramePos>) => {
      const src = patch || {}
      const keys = Object.keys(src)
      if (keys.length === 0) return
      const prev = get().designFramePosById || {}
      let next: Record<string, DesignFramePos> | null = null
      for (let i = 0; i < keys.length; i += 1) {
        const key = normId(keys[i])
        if (!key) continue
        const raw = src[keys[i]!]!
        const nextPos = { x: clampFinite(raw.x, 0), y: clampFinite(raw.y, 0) }
        const prevPos = prev[key]
        if (designFramePosEq(prevPos, nextPos)) continue
        if (!next) next = { ...prev }
        next[key] = nextPos
      }
      if (!next) return
      set({ designFramePosById: next })
    },
    clearDesignFramePos: (id: string) => {
      const key = normId(id)
      if (!key) return
      const prev = get().designFramePosById || {}
      if (!Object.prototype.hasOwnProperty.call(prev, key)) return
      const next = { ...prev }
      delete next[key]
      set({ designFramePosById: next })
    },
    clearAllDesignFramePos: () => {
      const prev = get().designFramePosById || {}
      if (Object.keys(prev).length === 0) return
      set({ designFramePosById: {} })
    },
  }
}
