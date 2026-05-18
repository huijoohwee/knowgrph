import { DEFAULT_GEOSPATIAL_OVERLAY_ENABLED, GEOSPATIAL_OVERLAY_PREFERENCE_VERSION } from 'grph-shared/geospatial/constants'
import { LS_KEYS } from '@/lib/config'
import { getLocalStorage, lsBool, lsSetBool } from '@/lib/persistence'

export { DEFAULT_GEOSPATIAL_OVERLAY_ENABLED }

export function readGeospatialOverlayEnabledPreference(): boolean {
  try {
    const enabled = lsBool(LS_KEYS.geospatialOverlayEnabled, DEFAULT_GEOSPATIAL_OVERLAY_ENABLED)
    if (!enabled) return false
    return getLocalStorage()?.getItem(LS_KEYS.geospatialOverlayPreferenceVersion) === GEOSPATIAL_OVERLAY_PREFERENCE_VERSION
  } catch {
    return DEFAULT_GEOSPATIAL_OVERLAY_ENABLED
  }
}

export function readGeospatialOverlayEnabledPreferenceRaw(): string {
  try {
    return String(getLocalStorage()?.getItem(LS_KEYS.geospatialOverlayEnabled) || '').trim()
  } catch {
    return ''
  }
}

export function writeGeospatialOverlayEnabledPreference(enabled: boolean): void {
  try {
    lsSetBool(LS_KEYS.geospatialOverlayEnabled, enabled === true)
    getLocalStorage()?.setItem(LS_KEYS.geospatialOverlayPreferenceVersion, GEOSPATIAL_OVERLAY_PREFERENCE_VERSION)
  } catch {
    void 0
  }
}
