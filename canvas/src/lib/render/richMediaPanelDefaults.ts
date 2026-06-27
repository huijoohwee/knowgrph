import { WIDGET_BASE_SIZE } from '@/lib/canvas/overlayWidgetZoom'
import { computeMediaPanelCssVars3d } from '@/lib/render/mediaPanelLayout'

export const RICH_MEDIA_PANEL_DEFAULT_WIDTH_PX = WIDGET_BASE_SIZE.width
export const RICH_MEDIA_PANEL_DEFAULT_HEIGHT_PX = Math.round((RICH_MEDIA_PANEL_DEFAULT_WIDTH_PX * 9) / 16)
export const RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE = Object.freeze({
  width: RICH_MEDIA_PANEL_DEFAULT_WIDTH_PX,
  height: RICH_MEDIA_PANEL_DEFAULT_HEIGHT_PX,
})
export const RICH_MEDIA_PANEL_DEFAULT_CSS_VARS = Object.freeze(
  computeMediaPanelCssVars3d({ density: 'default', sizeScale: 1 }).vars,
)
