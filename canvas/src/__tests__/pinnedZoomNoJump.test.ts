import { adjustPinnedZoomForViewportChange } from '@/components/GraphCanvas/zoomState'

export const testPinnedZoomAdjustKeepsWorldCenter = () => {
  const z = { k: 2, x: -100, y: -50, viewportW: 800, viewportH: 600 }
  const adjusted = adjustPinnedZoomForViewportChange({ zoom: z, nextViewportW: 1000, nextViewportH: 600 })
  const worldCx = (z.viewportW / 2 - z.x) / z.k
  const worldCy = (z.viewportH / 2 - z.y) / z.k
  const screenCx = worldCx * adjusted.k + adjusted.x
  const screenCy = worldCy * adjusted.k + adjusted.y
  if (Math.abs(screenCx - 500) > 1e-6) throw new Error('expected world center to remain at new viewport center x')
  if (Math.abs(screenCy - 300) > 1e-6) throw new Error('expected world center to remain at new viewport center y')
}

