import { LS_KEYS } from '@/lib/config'
import { lsBool, lsNum, lsSetBool, lsSetNum } from '@/lib/persistence'
import type { GraphState } from '@/hooks/store/types'
import { DEFAULT_GEOSPATIAL_OVERLAY_OPACITY } from '@/lib/geospatial/config'
import { clamp01 } from '@/lib/math/clamp01'

export const createGeospatialOverlaySlice = (
  set: (fn: (state: GraphState) => Partial<GraphState>) => void,
  get: () => GraphState,
): Pick<
  GraphState,
  | 'geospatialOverlayEnabled'
  | 'setGeospatialOverlayEnabled'
> => {
  return {
    geospatialOverlayEnabled: lsBool(LS_KEYS.geospatialOverlayEnabled, false),
    setGeospatialOverlayEnabled: (v) => {
      const next = lsSetBool(LS_KEYS.geospatialOverlayEnabled, v)
      if (next) {
        const opacity = clamp01(get().geospatialOverlayOpacity)
        if (!(opacity > 0)) {
          const fallback = clamp01(lsNum(LS_KEYS.geospatialOverlayOpacity, DEFAULT_GEOSPATIAL_OVERLAY_OPACITY))
          const restored = fallback > 0 ? fallback : DEFAULT_GEOSPATIAL_OVERLAY_OPACITY
          lsSetNum(LS_KEYS.geospatialOverlayOpacity, restored)
          set(() => ({ geospatialOverlayOpacity: restored }))
        }
      }
      set(() => ({ geospatialOverlayEnabled: next }))
    },
  }
}
