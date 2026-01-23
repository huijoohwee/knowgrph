import { LS_KEYS } from '@/lib/config'
import { lsBool, lsSetBool } from '@/lib/persistence'
import type { GraphState } from '@/hooks/store/types'

export const createGeospatialOverlaySlice = (
  set: (fn: (state: GraphState) => Partial<GraphState>) => void,
): Pick<
  GraphState,
  | 'geospatialOverlayEnabled'
  | 'setGeospatialOverlayEnabled'
> => {
  return {
    geospatialOverlayEnabled: lsBool(LS_KEYS.geospatialOverlayEnabled, false),
    setGeospatialOverlayEnabled: (v) => {
      const next = lsSetBool(LS_KEYS.geospatialOverlayEnabled, v)
      set(() => ({ geospatialOverlayEnabled: next }))
    },
  }
}
