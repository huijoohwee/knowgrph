import type React from 'react'

export const MEDIA_PREVIEW_SELECTABLE_SURFACE_ATTR = 'data-kg-rich-media-selectable-surface'
export const MEDIA_PREVIEW_SELECTABLE_SURFACE_VALUE = '1'

export type MediaPreviewSurfaceSelectionEvent =
  | React.PointerEvent<HTMLElement>
  | React.MouseEvent<HTMLElement>

export type MediaPreviewSurfaceSelectionProps = {
  role?: 'group'
  'aria-label'?: string
  [MEDIA_PREVIEW_SELECTABLE_SURFACE_ATTR]?: typeof MEDIA_PREVIEW_SELECTABLE_SURFACE_VALUE
  onPointerDownCapture?: (event: React.PointerEvent<HTMLElement>) => void
  onMouseDownCapture?: (event: React.MouseEvent<HTMLElement>) => void
  onClickCapture?: (event: React.MouseEvent<HTMLElement>) => void
}

export type MediaPreviewSurfaceCardProps = {
  interactive: boolean
  mediaSelectableSurfaceDataAttr: boolean
}

export function resolveMediaPreviewSelectableDataAttr(enabled: boolean): typeof MEDIA_PREVIEW_SELECTABLE_SURFACE_VALUE | undefined {
  return enabled ? MEDIA_PREVIEW_SELECTABLE_SURFACE_VALUE : undefined
}

export function resolveMediaPreviewSurfaceCardProps(args: {
  enabled: boolean
  interactive?: boolean
}): MediaPreviewSurfaceCardProps {
  return {
    interactive: args.enabled ? false : args.interactive === true,
    mediaSelectableSurfaceDataAttr: args.enabled,
  }
}

export function resolveMediaPreviewSurfaceSelectionProps(args: {
  enabled: boolean
  ariaLabel?: string
  onSelect?: (event: MediaPreviewSurfaceSelectionEvent) => void
}): MediaPreviewSurfaceSelectionProps {
  if (!args.enabled) return {}
  const selectSurface = (event: MediaPreviewSurfaceSelectionEvent) => {
    if (event.button !== 0) return
    args.onSelect?.(event)
  }
  const claimSurfaceClick = (event: React.MouseEvent<HTMLElement>) => {
    selectSurface(event)
    try {
      event.preventDefault()
    } catch {
      void 0
    }
    try {
      event.stopPropagation()
    } catch {
      void 0
    }
  }
  return {
    role: 'group',
    'aria-label': args.ariaLabel,
    [MEDIA_PREVIEW_SELECTABLE_SURFACE_ATTR]: MEDIA_PREVIEW_SELECTABLE_SURFACE_VALUE,
    onPointerDownCapture: selectSurface,
    onMouseDownCapture: selectSurface,
    onClickCapture: claimSurfaceClick,
  }
}
