import { LS_KEYS } from '@/lib/config.ls'

export type ViewportControlsPreset = 'map' | 'design'

export const readViewportControlsPresetFromLocalStorage = (): ViewportControlsPreset | null => {
  try {
    const v = String(globalThis?.localStorage?.getItem(LS_KEYS.viewportControlsPreset) || '').trim()
    if (v === 'map' || v === 'design') return v
    return null
  } catch {
    return null
  }
}

