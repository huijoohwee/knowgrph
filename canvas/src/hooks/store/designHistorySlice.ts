import type { StoreApi } from 'zustand'

import type { DesignLayerState } from '@/features/design/designLayersState'
import { moveDesignLayer, toggleDesignLayerHidden } from '@/features/design/designLayersState'
import type { GraphState } from '@/hooks/store/types'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'

import type { DesignHistoryEntry, DesignHistoryPatch, DesignHistoryStack } from './store-types/graph-state-design-history'
import type { DesignFramePos, DesignFrameSize } from './designRendererSlice'

type SetGraph = StoreApi<GraphState>['setState']
type GetGraph = StoreApi<GraphState>['getState']

const normId = (v: unknown): string => String(v || '').trim()

const cloneLayerState = (s: DesignLayerState): DesignLayerState => ({
  order: Array.isArray(s.order) ? [...s.order] : [],
  hiddenById: { ...(s.hiddenById || {}) },
})

const buildEntryId = (): string => `${Date.now()}-${Math.random().toString(16).slice(2)}`

function readGraphKey(state: GraphState): string | null {
  const key = buildGraphMetaKeyIgnoringPending(state.graphData)
  return key ? String(key || '').trim() : null
}

function getOrInitStack(state: GraphState, graphKey: string): DesignHistoryStack {
  const by = state.designHistoryByGraphMetaKey || {}
  const existing = by[graphKey]
  if (existing && Array.isArray(existing.entries) && typeof existing.index === 'number') return existing
  return { entries: [], index: 0 }
}

function applyPatchToStore(store: GraphState, patch: DesignHistoryPatch) {
  if (patch.framePos) {
    const setPatch: Record<string, DesignFramePos> = {}
    const clearIds: string[] = []
    for (const [rawId, v] of Object.entries(patch.framePos)) {
      const id = normId(rawId)
      if (!id) continue
      if (!v) clearIds.push(id)
      else setPatch[id] = v
    }
    if (Object.keys(setPatch).length > 0) store.setDesignFramePosMany(setPatch)
    for (let i = 0; i < clearIds.length; i += 1) store.clearDesignFramePos(clearIds[i]!)
  }

  if (patch.frameSize) {
    const setPatch: Record<string, DesignFrameSize> = {}
    const clearIds: string[] = []
    for (const [rawId, v] of Object.entries(patch.frameSize)) {
      const id = normId(rawId)
      if (!id) continue
      if (!v) clearIds.push(id)
      else setPatch[id] = v
    }
    if (Object.keys(setPatch).length > 0) store.setDesignFrameSizeMany(setPatch)
    for (let i = 0; i < clearIds.length; i += 1) store.clearDesignFrameSize(clearIds[i]!)
  }

  if (patch.layerState) {
    store.setDesignLayerState(patch.layerState)
  }
}

export const createDesignHistorySlice = (set: SetGraph, get: GetGraph) => {
  return {
    designHistoryByGraphMetaKey: {} as Record<string, DesignHistoryStack>,
    designHistoryMaxEntries: 200,

    canUndoDesignHistory: () => {
      const state = get()
      const graphKey = readGraphKey(state)
      if (!graphKey) return false
      const stack = getOrInitStack(state, graphKey)
      return stack.index > 0
    },

    canRedoDesignHistory: () => {
      const state = get()
      const graphKey = readGraphKey(state)
      if (!graphKey) return false
      const stack = getOrInitStack(state, graphKey)
      return stack.index < stack.entries.length
    },

    getDesignHistoryLastLabel: () => {
      const state = get()
      const graphKey = readGraphKey(state)
      if (!graphKey) return null
      const stack = getOrInitStack(state, graphKey)
      const last = stack.index > 0 ? stack.entries[stack.index - 1] : null
      return last ? String(last.label || '').trim() || null : null
    },

    undoDesignHistory: () => {
      const state = get()
      const graphKey = readGraphKey(state)
      if (!graphKey) return
      const stack = getOrInitStack(state, graphKey)
      if (stack.index <= 0) return
      const entry = stack.entries[stack.index - 1]
      if (!entry) return
      applyPatchToStore(state, entry.inverse)
      const nextStack: DesignHistoryStack = { entries: stack.entries, index: stack.index - 1 }
      set({ designHistoryByGraphMetaKey: { ...(state.designHistoryByGraphMetaKey || {}), [graphKey]: nextStack } })
    },

    redoDesignHistory: () => {
      const state = get()
      const graphKey = readGraphKey(state)
      if (!graphKey) return
      const stack = getOrInitStack(state, graphKey)
      if (stack.index >= stack.entries.length) return
      const entry = stack.entries[stack.index]
      if (!entry) return
      applyPatchToStore(state, entry.forward)
      const nextStack: DesignHistoryStack = { entries: stack.entries, index: stack.index + 1 }
      set({ designHistoryByGraphMetaKey: { ...(state.designHistoryByGraphMetaKey || {}), [graphKey]: nextStack } })
    },

    commitDesignFrameRectHistory: ({
      label,
      framePosPatch,
      frameSizePatch,
    }: {
      label: string
      framePosPatch?: Record<string, DesignFramePos>
      frameSizePatch?: Record<string, DesignFrameSize>
    }) => {
      const state = get()
      const graphKey = readGraphKey(state)
      if (!graphKey) return

      const posKeys = Object.keys(framePosPatch || {})
      const sizeKeys = Object.keys(frameSizePatch || {})
      if (posKeys.length === 0 && sizeKeys.length === 0) return

      const prevPos = state.designFramePosById || {}
      const prevSize = state.designFrameSizeById || {}

      const forwardPos: Record<string, DesignFramePos> = {}
      const inversePos: Record<string, DesignFramePos | null> = {}
      for (let i = 0; i < posKeys.length; i += 1) {
        const rawKey = posKeys[i]
        const id = normId(rawKey)
        if (!id) continue
        const next = framePosPatch ? framePosPatch[rawKey] : null
        if (!next) continue
        forwardPos[id] = next
        inversePos[id] = prevPos[id] || null
      }

      const forwardSize: Record<string, DesignFrameSize> = {}
      const inverseSize: Record<string, DesignFrameSize | null> = {}
      for (let i = 0; i < sizeKeys.length; i += 1) {
        const rawKey = sizeKeys[i]
        const id = normId(rawKey)
        if (!id) continue
        const next = frameSizePatch ? frameSizePatch[rawKey] : null
        if (!next) continue
        forwardSize[id] = next
        inverseSize[id] = prevSize[id] || null
      }

      if (Object.keys(forwardPos).length === 0 && Object.keys(forwardSize).length === 0) return

      const entry: DesignHistoryEntry = {
        id: buildEntryId(),
        at: Date.now(),
        label: String(label || 'Edit').trim() || 'Edit',
        forward: {
          framePos: Object.keys(forwardPos).length > 0 ? forwardPos : undefined,
          frameSize: Object.keys(forwardSize).length > 0 ? forwardSize : undefined,
        },
        inverse: {
          framePos: Object.keys(inversePos).length > 0 ? inversePos : undefined,
          frameSize: Object.keys(inverseSize).length > 0 ? inverseSize : undefined,
        },
      }
      const stack = getOrInitStack(state, graphKey)
      const truncated = stack.entries.slice(0, stack.index)
      truncated.push(entry)
      const max = Math.max(10, Math.floor(state.designHistoryMaxEntries || 200))
      const trimmed = truncated.length > max ? truncated.slice(truncated.length - max) : truncated
      const nextStack: DesignHistoryStack = { entries: trimmed, index: trimmed.length }
      set({ designHistoryByGraphMetaKey: { ...(state.designHistoryByGraphMetaKey || {}), [graphKey]: nextStack } })

      if (Object.keys(forwardPos).length > 0) state.setDesignFramePosMany(forwardPos)
      if (Object.keys(forwardSize).length > 0) state.setDesignFrameSizeMany(forwardSize)
    },

    commitDesignFramePosHistory: ({ label, patch }: { label: string; patch: Record<string, DesignFramePos> }) => {
      const state = get()
      const graphKey = readGraphKey(state)
      if (!graphKey) return
      const keys = Object.keys(patch || {})
      if (keys.length === 0) return

      const prev = state.designFramePosById || {}
      const inverse: Record<string, DesignFramePos | null> = {}
      const forward: Record<string, DesignFramePos> = {}
      for (let i = 0; i < keys.length; i += 1) {
        const id = normId(keys[i])
        if (!id) continue
        const next = patch[keys[i]!]!
        forward[id] = next
        inverse[id] = prev[id] || null
      }
      if (Object.keys(forward).length === 0) return

      const entry: DesignHistoryEntry = {
        id: buildEntryId(),
        at: Date.now(),
        label: String(label || 'Move').trim() || 'Move',
        forward: { framePos: forward },
        inverse: { framePos: inverse },
      }
      const stack = getOrInitStack(state, graphKey)
      const truncated = stack.entries.slice(0, stack.index)
      truncated.push(entry)
      const max = Math.max(10, Math.floor(state.designHistoryMaxEntries || 200))
      const trimmed = truncated.length > max ? truncated.slice(truncated.length - max) : truncated
      const nextStack: DesignHistoryStack = { entries: trimmed, index: trimmed.length }
      set({ designHistoryByGraphMetaKey: { ...(state.designHistoryByGraphMetaKey || {}), [graphKey]: nextStack } })
      state.setDesignFramePosMany(forward)
    },

    commitDesignFrameSizeHistory: ({ label, patch }: { label: string; patch: Record<string, DesignFrameSize> }) => {
      const state = get()
      const graphKey = readGraphKey(state)
      if (!graphKey) return
      const keys = Object.keys(patch || {})
      if (keys.length === 0) return

      const prev = state.designFrameSizeById || {}
      const inverse: Record<string, DesignFrameSize | null> = {}
      const forward: Record<string, DesignFrameSize> = {}
      for (let i = 0; i < keys.length; i += 1) {
        const id = normId(keys[i])
        if (!id) continue
        const next = patch[keys[i]!]!
        forward[id] = next
        inverse[id] = prev[id] || null
      }
      if (Object.keys(forward).length === 0) return

      const entry: DesignHistoryEntry = {
        id: buildEntryId(),
        at: Date.now(),
        label: String(label || 'Resize').trim() || 'Resize',
        forward: { frameSize: forward },
        inverse: { frameSize: inverse },
      }
      const stack = getOrInitStack(state, graphKey)
      const truncated = stack.entries.slice(0, stack.index)
      truncated.push(entry)
      const max = Math.max(10, Math.floor(state.designHistoryMaxEntries || 200))
      const trimmed = truncated.length > max ? truncated.slice(truncated.length - max) : truncated
      const nextStack: DesignHistoryStack = { entries: trimmed, index: trimmed.length }
      set({ designHistoryByGraphMetaKey: { ...(state.designHistoryByGraphMetaKey || {}), [graphKey]: nextStack } })
      state.setDesignFrameSizeMany(forward)
    },

    commitDesignLayerStateHistory: ({ label, next }: { label: string; next: DesignLayerState }) => {
      const state = get()
      const graphKey = readGraphKey(state)
      if (!graphKey) return
      const prev = cloneLayerState(state.designLayerState || { order: [], hiddenById: {} })
      const forwardState = cloneLayerState(next || { order: [], hiddenById: {} })

      const entry: DesignHistoryEntry = {
        id: buildEntryId(),
        at: Date.now(),
        label: String(label || 'Layers').trim() || 'Layers',
        forward: { layerState: forwardState },
        inverse: { layerState: prev },
      }
      const stack = getOrInitStack(state, graphKey)
      const truncated = stack.entries.slice(0, stack.index)
      truncated.push(entry)
      const max = Math.max(10, Math.floor(state.designHistoryMaxEntries || 200))
      const trimmed = truncated.length > max ? truncated.slice(truncated.length - max) : truncated
      const nextStack: DesignHistoryStack = { entries: trimmed, index: trimmed.length }
      set({ designHistoryByGraphMetaKey: { ...(state.designHistoryByGraphMetaKey || {}), [graphKey]: nextStack } })
      state.setDesignLayerState(forwardState)
    },

    commitToggleDesignLayerHiddenHistory: (id: string) => {
      const key = normId(id)
      if (!key) return
      const state = get()
      const prev = state.designLayerState || { order: [], hiddenById: {} }
      const nextHidden = toggleDesignLayerHidden(prev.hiddenById || {}, key)
      if (nextHidden === prev.hiddenById) return
      const next: DesignLayerState = { ...prev, hiddenById: nextHidden }
      state.commitDesignLayerStateHistory({ label: 'Layer visibility', next })
    },

    commitMoveDesignLayerHistory: ({ id, dir }: { id: string; dir: 'up' | 'down' }) => {
      const key = normId(id)
      if (!key) return
      const state = get()
      const prev = state.designLayerState || { order: [], hiddenById: {} }
      const nextOrder = moveDesignLayer({ order: prev.order || [], id: key, dir })
      if (nextOrder === prev.order) return
      const next: DesignLayerState = { ...prev, order: nextOrder }
      state.commitDesignLayerStateHistory({ label: 'Layer order', next })
    },
  }
}
