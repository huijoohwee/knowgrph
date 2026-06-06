import {
  UI_RESPONSIVE_VIEWPORT_FIT_CONTENT_CLASSNAME,
  UI_RESPONSIVE_VIEWPORT_FIT_CONTENT_DEFAULT_MAX_INLINE_SIZE,
  UI_RESPONSIVE_VIEWPORT_FIT_GRID_CLASSNAME,
  UI_RESPONSIVE_VIEWPORT_FIT_GRID_DEFAULT_MIN_INLINE_SIZE,
  buildResponsiveViewportFitContentStyle,
  buildResponsiveViewportFitGridStyle,
} from '@/lib/ui/responsiveViewportFitGrid'

export function testResponsiveViewportFitGridBuildsNeutralAutoFitStyle() {
  const contentStyle = buildResponsiveViewportFitContentStyle()
  if (contentStyle.maxWidth !== UI_RESPONSIVE_VIEWPORT_FIT_CONTENT_DEFAULT_MAX_INLINE_SIZE) {
    throw new Error('expected viewport-fit content style to use the shared max inline size default')
  }
  const compactContentStyle = buildResponsiveViewportFitContentStyle({ maxInlineSize: '960px' })
  if (compactContentStyle.maxWidth !== '960px') {
    throw new Error('expected viewport-fit content style to accept neutral max inline size overrides')
  }
  const gridStyle = buildResponsiveViewportFitGridStyle()
  const expectedGrid = `repeat(auto-fit, minmax(min(100%, ${UI_RESPONSIVE_VIEWPORT_FIT_GRID_DEFAULT_MIN_INLINE_SIZE}), 1fr))`
  if (gridStyle.gridTemplateColumns !== expectedGrid) {
    throw new Error('expected viewport-fit grid style to use the shared auto-fit default')
  }
  const compactGridStyle = buildResponsiveViewportFitGridStyle({ minInlineSize: '10rem' })
  if (compactGridStyle.gridTemplateColumns !== 'repeat(auto-fit, minmax(min(100%, 10rem), 1fr))') {
    throw new Error('expected viewport-fit grid style to accept neutral min inline size overrides')
  }
  const fixedGridStyle = buildResponsiveViewportFitGridStyle({ minInlineSize: '320px', trackMode: 'fixed' })
  if (fixedGridStyle.gridTemplateColumns !== 'repeat(auto-fit, minmax(min(100%, 320px), 320px))') {
    throw new Error('expected viewport-fit grid style to support fixed-width responsive tracks')
  }
  if (fixedGridStyle.justifyContent !== 'start') {
    throw new Error('expected fixed viewport-fit grid tracks to align from the start')
  }
  for (const requiredClass of ['min-w-0', 'w-full']) {
    if (!UI_RESPONSIVE_VIEWPORT_FIT_CONTENT_CLASSNAME.includes(requiredClass)) {
      throw new Error(`expected viewport-fit content class to preserve responsive width class: ${requiredClass}`)
    }
  }
  for (const requiredClass of ['grid', 'min-w-0']) {
    if (!UI_RESPONSIVE_VIEWPORT_FIT_GRID_CLASSNAME.includes(requiredClass)) {
      throw new Error(`expected viewport-fit grid class to preserve responsive grid class: ${requiredClass}`)
    }
  }
}
