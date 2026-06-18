export type MediaOverlayAppearance = 'always' | 'hover'

export const MEDIA_OVERLAY_HOVER_APPEAR_CLASSNAME = 'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'

export function getMediaOverlayAppearanceClassName(appearance: MediaOverlayAppearance | null | undefined): string {
  return appearance === 'hover' ? MEDIA_OVERLAY_HOVER_APPEAR_CLASSNAME : ''
}
