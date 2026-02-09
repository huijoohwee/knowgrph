export const VIEWPORT_CONTROLS_PRESETS = ['map', 'design'] as const

export type ViewportControlsPreset = (typeof VIEWPORT_CONTROLS_PRESETS)[number]

export const DEFAULT_VIEWPORT_CONTROLS_PRESET: ViewportControlsPreset = 'map'

