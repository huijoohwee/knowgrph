import React from 'react'
import type { FeatureCollection } from 'geojson'
import { computeBoundsFromCollections } from '../../geo'

export function CesiumOverlay(args: {
  collections: FeatureCollection[]
  autoFitEnabled: boolean
}): React.ReactElement {
  const { collections, autoFitEnabled } = args
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const viewerRef = React.useRef<any | null>(null)
  const [viewerReady, setViewerReady] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    const mount = async () => {
      const el = containerRef.current
      if (!el) return
      const mod = await import('cesium')
      if (cancelled) return

      try {
        const anyMod = mod as unknown as any
        if (typeof anyMod?.buildModuleUrl?.setBaseUrl === 'function') {
          const fromGlobal = (globalThis as unknown as any).CESIUM_BASE_URL
          const baseUrl = typeof fromGlobal === 'string' && fromGlobal.trim() ? fromGlobal.trim() : '/cesium/'
          anyMod.buildModuleUrl.setBaseUrl(baseUrl)
        }
      } catch {
        void 0
      }

      const anyMod = mod as unknown as any
      const imageryProvider = new anyMod.OpenStreetMapImageryProvider({
        url: 'https://tile.openstreetmap.org/',
      })

      const v = new anyMod.Viewer(el, {
        imageryProvider,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        shouldAnimate: false,
      })
      viewerRef.current = v
      setViewerReady(true)
    }
    void mount()
    return () => {
      cancelled = true
      try {
        viewerRef.current?.destroy?.()
      } catch {
        void 0
      }
      viewerRef.current = null
      setViewerReady(false)
    }
  }, [])

  React.useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    if (!autoFitEnabled) return
    const bounds = computeBoundsFromCollections(collections)
    if (!bounds) return
    const [minLng, minLat, maxLng, maxLat] = bounds
    void import('cesium').then(mod => {
      const anyMod = mod as unknown as any
      viewer.camera.flyTo({
        destination: anyMod.Rectangle.fromDegrees(minLng, minLat, maxLng, maxLat),
        duration: 0,
      })
    })
  }, [autoFitEnabled, collections])

  return (
    <div className="absolute inset-0" style={{ width: '100%', height: '100%' }}>
      <div ref={containerRef} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
      {!viewerReady ? (
        <div className="absolute top-2 left-2 z-10 pointer-events-none px-2 py-1 rounded-md text-[11px] text-gray-700 dark:text-gray-200 bg-white/80 dark:bg-black/60 border border-gray-200/60 dark:border-gray-800/60">
          Loading 3D globe...
        </div>
      ) : null}
    </div>
  )
}
