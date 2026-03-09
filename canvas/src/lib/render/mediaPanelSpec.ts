import { MINIMAP_HEIGHT } from '@/features/minimap/math'
import { DEFAULT_ZOOM_MAX_SCALE } from '@/lib/graph/layoutDefaults'

export type MediaPanelDensity = 'default' | 'compact'

export const MEDIA_PANEL_HEADER_AT_MAX_ZOOM = 36
export const MEDIA_PANEL_BODY_MINIMAP_MULTIPLIER_DEFAULT = 5.0
export const MEDIA_PANEL_BODY_MINIMAP_MULTIPLIER_COMPACT = 2.5
export const MEDIA_PANEL_ASPECT_WIDTH = 16
export const MEDIA_PANEL_ASPECT_HEIGHT = 9
export const MEDIA_PANEL_PADDING = 4
export const MEDIA_PANEL_CORNER_AT_MAX_ZOOM = 8
export const MEDIA_PANEL_BORDER_WIDTH_AT_MAX_ZOOM = 1

export function computeMediaPanelWorldDims(density: MediaPanelDensity): {
  headerHeight: number
  bodyHeight: number
  panelHeight: number
  panelWidth: number
  padding: number
  corner: number
  borderWidth: number
} {
  const bodyMultiplier =
    density === 'compact'
      ? MEDIA_PANEL_BODY_MINIMAP_MULTIPLIER_COMPACT
      : MEDIA_PANEL_BODY_MINIMAP_MULTIPLIER_DEFAULT
  const headerHeight = MEDIA_PANEL_HEADER_AT_MAX_ZOOM / DEFAULT_ZOOM_MAX_SCALE
  const bodyHeight = (MINIMAP_HEIGHT * bodyMultiplier) / DEFAULT_ZOOM_MAX_SCALE
  const panelHeight = bodyHeight + headerHeight
  const panelWidth = (bodyHeight * MEDIA_PANEL_ASPECT_WIDTH) / MEDIA_PANEL_ASPECT_HEIGHT
  const corner = MEDIA_PANEL_CORNER_AT_MAX_ZOOM / DEFAULT_ZOOM_MAX_SCALE
  const borderWidth = MEDIA_PANEL_BORDER_WIDTH_AT_MAX_ZOOM / DEFAULT_ZOOM_MAX_SCALE
  return { headerHeight, bodyHeight, panelHeight, panelWidth, padding: MEDIA_PANEL_PADDING, corner, borderWidth }
}
