import type { CSSProperties } from 'react'

export const UI_RESPONSIVE_VIEWPORT_FIT_CONTENT_CLASSNAME =
  'mx-auto flex min-w-0 w-full flex-col gap-4 px-5 py-5'

export const UI_RESPONSIVE_VIEWPORT_FIT_GRID_CLASSNAME = 'grid min-w-0 gap-3'

export const UI_RESPONSIVE_VIEWPORT_FIT_CONTENT_DEFAULT_MAX_INLINE_SIZE = '1420px'

export const UI_RESPONSIVE_VIEWPORT_FIT_GRID_DEFAULT_MIN_INLINE_SIZE = '14rem'

export type ResponsiveViewportFitContentOptions = {
  maxInlineSize?: string
}

export type ResponsiveViewportFitGridOptions = {
  minInlineSize?: string
  trackMode?: 'stretch' | 'fixed'
}

const normalizeCssSize = (value: string | null | undefined, fallback: string): string => {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

export const buildResponsiveViewportFitContentStyle = (
  options: ResponsiveViewportFitContentOptions = {},
): CSSProperties => ({
  maxWidth: normalizeCssSize(
    options.maxInlineSize,
    UI_RESPONSIVE_VIEWPORT_FIT_CONTENT_DEFAULT_MAX_INLINE_SIZE,
  ),
})

export const buildResponsiveViewportFitGridStyle = (
  options: ResponsiveViewportFitGridOptions = {},
): CSSProperties => {
  const minInlineSize = normalizeCssSize(
    options.minInlineSize,
    UI_RESPONSIVE_VIEWPORT_FIT_GRID_DEFAULT_MIN_INLINE_SIZE,
  )
  const trackMax = options.trackMode === 'fixed' ? minInlineSize : '1fr'
  return {
    gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minInlineSize}), ${trackMax}))`,
    ...(options.trackMode === 'fixed' ? { justifyContent: 'start' } : {}),
  }
}
