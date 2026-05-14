import type { DesignLayerState } from '@/features/design/designLayersState'
import type { DesignFramePos, DesignFrameSize } from '@/hooks/store/designRendererSlice'

export type DesignHistoryPatch = {
  framePos?: Record<string, DesignFramePos | null>
  frameSize?: Record<string, DesignFrameSize | null>
  layerState?: DesignLayerState | null
}

export type DesignHistoryEntry = {
  id: string
  at: number
  label: string
  forward: DesignHistoryPatch
  inverse: DesignHistoryPatch
}

export type DesignHistoryStack = {
  entries: DesignHistoryEntry[]
  index: number
}

export interface GraphStateDesignHistory {
  designHistoryByGraphMetaKey: Record<string, DesignHistoryStack>
  designHistoryMaxEntries: number

  canUndoDesignHistory: () => boolean
  canRedoDesignHistory: () => boolean
  getDesignHistoryLastLabel: () => string | null

  undoDesignHistory: () => void
  redoDesignHistory: () => void

  commitDesignFrameRectHistory: (args: {
    label: string
    framePosPatch?: Record<string, DesignFramePos>
    frameSizePatch?: Record<string, DesignFrameSize>
  }) => void
  commitDesignFramePosHistory: (args: { label: string; patch: Record<string, DesignFramePos> }) => void
  commitDesignFrameSizeHistory: (args: { label: string; patch: Record<string, DesignFrameSize> }) => void
  commitDesignLayerStateHistory: (args: { label: string; next: DesignLayerState }) => void
  commitToggleDesignLayerHiddenHistory: (id: string) => void
  commitMoveDesignLayerHistory: (args: { id: string; dir: 'up' | 'down' }) => void
}
