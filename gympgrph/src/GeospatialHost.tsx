import React from 'react'
import { useGympgrphStore } from './store'
import { useMapLibreBasemap } from './features/geospatial/useMapLibreBasemap'
import { LS_KEYS } from './lib/config'
import { GEOSPATIAL_STYLE_URL_CHANGED_EVENT } from 'grph-shared/geospatial/constants'

const CesiumOverlayLazy = React.lazy(async () => {
  const m = await import('./features/geospatial/CesiumOverlay')
  return { default: m.CesiumOverlay }
})

type GeospatialOverlayHostProps = {
  active?: boolean
  snapshot?: unknown
  handlers?: unknown
}

const readStyleUrl = (): string | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_KEYS.geospatialStyleUrl) || ''
    const s = raw.trim()
    return s || null
  } catch {
    return null
  }
}

export function GeospatialOverlayHost(props: GeospatialOverlayHostProps): React.ReactElement | null {
  const active = props.active !== false
  const geospatialViewMode = useGympgrphStore(s => s.geospatialViewMode)
  const geospatialAutoFitEnabled = useGympgrphStore(s => s.geospatialAutoFitEnabled)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const cesiumRootRef = React.useRef<HTMLDivElement | null>(null)
  const [targetStyleUrl, setTargetStyleUrl] = React.useState<string | null>(() => readStyleUrl())

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onChanged = () => {
      setTargetStyleUrl(readStyleUrl())
    }
    window.addEventListener(GEOSPATIAL_STYLE_URL_CHANGED_EVENT, onChanged)
    return () => {
      window.removeEventListener(GEOSPATIAL_STYLE_URL_CHANGED_EVENT, onChanged)
    }
  }, [])

  const show2d = active && geospatialViewMode !== '3d'
  const show3d = active && geospatialViewMode === '3d'

  const basemap = useMapLibreBasemap({
    enabled: show2d,
    rootRef,
    containerRef,
    targetStyleUrl,
    canvasRenderMode: '2d',
    projectionMode: 'mercator',
    viewportSizingMode: 'fit',
    vectorFallbackMs: 2_000,
  })

  const debug = React.useMemo(() => {
    if (typeof window === 'undefined') return false
    try {
      return new URLSearchParams(String(window.location.search || '')).get('kgGeoDebug') === '1'
    } catch {
      return false
    }
  }, [])

  return (
    <div ref={rootRef} className="relative w-full h-full" style={{ width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        className={show2d ? 'absolute inset-0 pointer-events-auto opacity-100' : 'absolute inset-0 pointer-events-none opacity-0'}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <div
        ref={cesiumRootRef}
        className={show3d ? 'absolute inset-0 pointer-events-auto opacity-100' : 'absolute inset-0 pointer-events-none opacity-0'}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {show3d ? (
          <React.Suspense fallback={null}>
            <CesiumOverlayLazy collections={[]} autoFitEnabled={geospatialAutoFitEnabled} />
          </React.Suspense>
        ) : null}
      </div>
      {debug ? (
        <div className="absolute top-2 right-2 z-20 pointer-events-none rounded-md border border-gray-200/60 bg-white/80 px-2 py-1 text-[11px] text-gray-700 dark:border-gray-800/60 dark:bg-black/60 dark:text-gray-200">
          <div>map: {basemap.map ? 'yes' : 'no'}</div>
          <div>
            canvas: {basemap.probe.canvasW}×{basemap.probe.canvasH} tilesLoaded: {basemap.probe.tilesLoaded ? 'yes' : 'no'}
          </div>
          <div>
            zoom: {basemap.probe.zoom.toFixed(2)} center: {basemap.probe.lng.toFixed(4)},{basemap.probe.lat.toFixed(4)}
          </div>
          {basemap.mapError ? <div className="text-red-700 dark:text-red-300">err: {basemap.mapError}</div> : null}
        </div>
      ) : null}
      {!debug && basemap.mapError ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-700 dark:text-gray-200 bg-white/70 dark:bg-black/40">
          {basemap.mapError}
        </div>
      ) : null}
    </div>
  )
}
