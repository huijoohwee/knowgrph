import React from 'react'
import type { FeatureCollection } from 'geojson'
import { computeBoundsFromCollections } from '../../geo'

export function CesiumOverlay(args: {
  collections: FeatureCollection[]
  autoFitEnabled: boolean
}): React.ReactElement {
  const { collections, autoFitEnabled } = args
  const [viewer, setViewer] = React.useState<any | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const mount = async () => {
      const mod = await import('cesium')
      if (cancelled) return
      const v = new mod.Viewer(document.createElement('div'))
      setViewer(v)
    }
    void mount()
    return () => {
      cancelled = true
      try {
        viewer?.destroy?.()
      } catch {
        void 0
      }
    }
  }, [])

  React.useEffect(() => {
    if (!viewer) return
    if (!autoFitEnabled) return
    const bounds = computeBoundsFromCollections(collections)
    if (!bounds) return
    const [minLng, minLat, maxLng, maxLat] = bounds
    void import('cesium').then(mod => {
      viewer.camera.flyTo({
        destination: mod.Rectangle.fromDegrees(minLng, minLat, maxLng, maxLat),
        duration: 0,
      })
    })
  }, [viewer, autoFitEnabled, collections])

  return React.createElement('div', { style: { display: 'none' } })
}
