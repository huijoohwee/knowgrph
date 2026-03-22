import { create } from 'zustand'
import { buildGympgrphGeospatialActions, createDefaultGympgrphGeospatialState, type GympgrphGeospatialState } from './hooks/store/geospatialSlice'

export type GympgrphState = GympgrphGeospatialState

export const useGympgrphStore = create<GympgrphState>((set, _get) => {
  const defaults = createDefaultGympgrphGeospatialState()
  const actions = buildGympgrphGeospatialActions(updater => set(updater))
  return {
    ...defaults,
    ...actions,
  }
})
