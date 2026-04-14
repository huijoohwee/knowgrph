import React from 'react'
import { MAPLIBRE_DEFAULT_STYLE_URL } from './basemapStyle'

type BasemapProbe = {
  tileSourceId: string
  tilesLoaded: boolean
  canvasW: number
  canvasH: number
  zoom: number
  lng: number
  lat: number
}

type BasemapResult = {
  map: any | null
  probe: BasemapProbe
  mapError: string | null
  styleRevision: number
}

const EMPTY_PROBE: BasemapProbe = { tileSourceId: '', tilesLoaded: false, canvasW: 0, canvasH: 0, zoom: 0, lng: 0, lat: 0 }
const SINGAPORE_CENTER_LNG = 103.8198
const SINGAPORE_CENTER_LAT = 1.3521
const INITIAL_3D_ZOOM = 2.8
const INITIAL_3D_PITCH = 0
const INITIAL_3D_BEARING = 0
const SAFE_SVG_FALLBACK_STYLE_SENTINEL = 'kg:style:svg-fallback'

const resolveBasemapStyle = (rawStyleUrl: string | null | undefined) => {
  const trimmed = String(rawStyleUrl || '').trim()
  const lower = trimmed.toLowerCase()
  if (!trimmed) return MAPLIBRE_DEFAULT_STYLE_URL
  if (trimmed === SAFE_SVG_FALLBACK_STYLE_SENTINEL) return null
  if (lower.startsWith('kg:style:')) return MAPLIBRE_DEFAULT_STYLE_URL
  return trimmed
}

const isAbortLike = (err: unknown): boolean => {
  const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message || '') : String(err || '')
  const lower = msg.toLowerCase()
  return lower.includes('err_aborted') || lower.includes('aborterror')
}

const isKnownUnsafeGlobeRuntimeError = (err: unknown): boolean => {
  const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message || '') : String(err || '')
  const lower = msg.toLowerCase()
  return (
    lower.includes("cannot set properties of undefined (setting '0')") ||
    lower.includes('undefined is not an object') ||
    lower.includes('this.int16[')
  )
}

export function useMapLibreBasemap(args: {
  enabled: boolean
  rootRef: React.RefObject<HTMLElement | null>
  containerRef: React.RefObject<HTMLElement | null>
  targetStyleUrl?: string | null
  canvasRenderMode: '2d' | '3d'
  projectionMode: 'mercator' | 'globe'
  viewportSizingMode: 'none' | 'fit'
  vectorFallbackMs: number
}): BasemapResult {
  const { enabled, containerRef, targetStyleUrl, canvasRenderMode, projectionMode, viewportSizingMode, vectorFallbackMs } = args
  const [runtimeProjectionMode, setRuntimeProjectionMode] = React.useState<'mercator' | 'globe'>(projectionMode)
  const [state, setState] = React.useState<BasemapResult>({
    map: null,
    probe: EMPTY_PROBE,
    mapError: null,
    styleRevision: 0,
  })

  React.useEffect(() => {
    if (!enabled) {
      setRuntimeProjectionMode(projectionMode)
      return
    }
    if (projectionMode === 'mercator') {
      setRuntimeProjectionMode('mercator')
      return
    }
    setRuntimeProjectionMode(prev => (prev === 'mercator' ? prev : projectionMode))
  }, [enabled, projectionMode])

  const setProbe = React.useCallback((next: BasemapProbe) => {
    setState((prev: BasemapResult) => {
      const p = prev.probe
      if (
        p.tileSourceId === next.tileSourceId &&
        p.tilesLoaded === next.tilesLoaded &&
        p.canvasW === next.canvasW &&
        p.canvasH === next.canvasH &&
        p.zoom === next.zoom &&
        p.lng === next.lng &&
        p.lat === next.lat
      ) {
        return prev
      }
      return { ...prev, probe: next }
    })
  }, [])

  const computeProbe = React.useCallback((map: any): BasemapProbe => {
    if (!map) return EMPTY_PROBE
    const canvas = map.getCanvas?.()
    const canvasW = canvas && typeof canvas.width === 'number' ? canvas.width : 0
    const canvasH = canvas && typeof canvas.height === 'number' ? canvas.height : 0
    const zoom = typeof map.getZoom === 'function' ? Number(map.getZoom() || 0) : 0
    const center = typeof map.getCenter === 'function' ? map.getCenter() : null
    const lng = center && typeof center.lng === 'number' ? center.lng : 0
    const lat = center && typeof center.lat === 'number' ? center.lat : 0

    const tilesLoaded = typeof map.areTilesLoaded === 'function' ? map.areTilesLoaded() === true : false
    const tileSourceId = ''
    return { tileSourceId, tilesLoaded, canvasW, canvasH, zoom, lng, lat }
  }, [])

  const debug = React.useMemo(() => {
    if (typeof window === 'undefined') return false
    try {
      return new URLSearchParams(String(window.location.search || '')).get('kgGeoDebug') === '1'
    } catch {
      return false
    }
  }, [])

  React.useEffect(() => {
    if (!enabled) {
      setState((prev: BasemapResult) =>
        prev.map ? { ...prev, map: null, probe: EMPTY_PROBE, mapError: null, styleRevision: 0 } : prev,
      )
      return
    }

    let cancelled = false
    let map: any | null = null
    let resizeObserver: ResizeObserver | null = null
    let probeInterval: ReturnType<typeof setInterval> | null = null
    const el = containerRef.current
    if (!el) return

    const mount = async () => {
      try {
        const mlRaw = await import('maplibre-gl')
        if (cancelled) return
        const mlAny = mlRaw as unknown as any
        const MapConstructor = mlAny?.Map || mlAny?.default?.Map

        if (!MapConstructor) {
          throw new Error('MapLibre Map constructor not found')
        }

        if (typeof mlAny?.setLogger === 'function') {
          mlAny.setLogger({
            error: (...args: unknown[]) => {
              const text = args.map(v => String(v)).join(' ')
              if (text.includes('/__fetch_remote') && text.toLowerCase().includes('abort')) return
              if (text.includes('/__fetch_remote') && text.toLowerCase().includes('err_aborted')) return
              if (text.includes('/__fetch_remote') && text.toLowerCase().includes('aborterror')) return
              console.error(...args)
            },
            warn: (...args: unknown[]) => console.warn(...args),
            info: (...args: unknown[]) => console.info(...args),
            debug: () => void 0,
          })
        }

        const style = resolveBasemapStyle(targetStyleUrl)

        if (style == null) {
          setState((prev: BasemapResult) =>
            prev.map || prev.mapError || prev.styleRevision !== 0 || prev.probe !== EMPTY_PROBE
              ? { ...prev, map: null, probe: EMPTY_PROBE, mapError: null, styleRevision: 0 }
              : prev,
          )
          return
        }

        if (debug) {
          try {
            console.info('[kg-geo] maplibre init', { style })
          } catch {
            void 0
          }
        }
        
        map = new MapConstructor({
          container: el,
          style,
          interactive: true,
          attributionControl: false,
          preserveDrawingBuffer: false,
          center: canvasRenderMode === '3d' ? [SINGAPORE_CENTER_LNG, SINGAPORE_CENTER_LAT] : undefined,
          pitch: canvasRenderMode === '3d' ? INITIAL_3D_PITCH : 0,
          bearing: canvasRenderMode === '3d' ? INITIAL_3D_BEARING : 0,
          maxPitch: canvasRenderMode === '3d' ? 85 : 60,
          zoom: canvasRenderMode === '3d' ? INITIAL_3D_ZOOM : 1.1,
        })

        if (debug && typeof window !== 'undefined') {
          try {
            ;(window as unknown as { __kgGeoMapLibre?: unknown }).__kgGeoMapLibre = map
          } catch {
            void 0
          }
        }

        map.on?.('error', (e: any) => {
          if (cancelled) return
          const err = e && typeof e === 'object' && 'error' in e ? (e as { error?: unknown }).error : e
          if (isAbortLike(err)) return
          const msg = err instanceof Error ? err.message : String(err || '')
          const trimmed = msg.trim()
          if (!trimmed) return
          if (runtimeProjectionMode === 'globe' && isKnownUnsafeGlobeRuntimeError(trimmed)) {
            setRuntimeProjectionMode('mercator')
            setState((prev: BasemapResult) => ({ ...prev, mapError: null }))
            return
          }
          setState((prev: BasemapResult) => ({ ...prev, mapError: trimmed }))
        })

        map.on?.('style.load', () => {
          if (cancelled) return
          try {
            if (runtimeProjectionMode === 'globe') {
              map.setProjection?.({ type: 'globe' })
            } else {
              map.setProjection?.({ type: 'mercator' })
            }
          } catch {
            void 0
          }
          if (viewportSizingMode === 'fit') {
            map.resize?.()
          }
          setState((prev: BasemapResult) => ({ ...prev, styleRevision: prev.styleRevision + 1 }))
        })

        const updateProbe = () => {
          if (cancelled || !map) return
          setProbe(computeProbe(map))
        }

        let initial3dCameraAligned = false
        const align3dViewportCenter = () => {
          if (cancelled || !map) return
          if (canvasRenderMode !== '3d') return
          if (initial3dCameraAligned) return
          initial3dCameraAligned = true
          try {
            map.jumpTo?.({
              center: [SINGAPORE_CENTER_LNG, SINGAPORE_CENTER_LAT],
              zoom: INITIAL_3D_ZOOM,
              pitch: INITIAL_3D_PITCH,
              bearing: INITIAL_3D_BEARING,
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
            })
          } catch {
            void 0
          }
          const w = typeof window !== 'undefined' ? window : null
          if (!w || typeof w.requestAnimationFrame !== 'function') return
          w.requestAnimationFrame(() => {
            if (cancelled || !map) return
            try {
              map.jumpTo?.({
                center: [SINGAPORE_CENTER_LNG, SINGAPORE_CENTER_LAT],
                zoom: INITIAL_3D_ZOOM,
                pitch: INITIAL_3D_PITCH,
                bearing: INITIAL_3D_BEARING,
                padding: { top: 0, right: 0, bottom: 0, left: 0 },
              })
            } catch {
              void 0
            }
          })
        }

        map.once?.('load', () => {
          if (cancelled) return
          map.resize?.()
          align3dViewportCenter()
          if (canvasRenderMode === '3d') {
            try {
              map.jumpTo?.({
                center: [SINGAPORE_CENTER_LNG, SINGAPORE_CENTER_LAT],
                zoom: INITIAL_3D_ZOOM,
                pitch: INITIAL_3D_PITCH,
                bearing: INITIAL_3D_BEARING,
                padding: { top: 0, right: 0, bottom: 0, left: 0 },
              })
            } catch {
              void 0
            }
          }
          updateProbe()
          if (debug) {
            try {
              console.info('[kg-geo] maplibre load')
            } catch {
              void 0
            }
          }
        })
        map.on?.('moveend', updateProbe)
        map.on?.('idle', updateProbe)
        map.on?.('resize', updateProbe)

        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            if (cancelled || !map) return
            map.resize?.()
            align3dViewportCenter()
            updateProbe()
          })
          resizeObserver.observe(el)
        }

        let loggedCanvasReady = false
        let loggedTilesLoaded = false
        probeInterval = setInterval(() => {
          if (cancelled || !map) return
          const probe = computeProbe(map)
          setProbe(probe)
          if (debug) {
            if (!loggedCanvasReady && probe.canvasW > 0 && probe.canvasH > 0) {
              loggedCanvasReady = true
              try {
                console.info('[kg-geo] maplibre canvas ready', { canvasW: probe.canvasW, canvasH: probe.canvasH })
              } catch {
                void 0
              }
            }
            if (!loggedTilesLoaded && probe.tilesLoaded) {
              loggedTilesLoaded = true
              try {
                console.info('[kg-geo] maplibre tiles loaded')
              } catch {
                void 0
              }
            }
          }
        }, debug ? 1_000 : Math.max(1_500, Math.floor(vectorFallbackMs)))

        setState((prev: BasemapResult) => ({ ...prev, map, mapError: null }))
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err || '')
        setState((prev: BasemapResult) => ({ ...prev, map: null, mapError: msg || 'Map init failed' }))
      }
    }

    void mount()

    return () => {
      cancelled = true
      if (probeInterval) {
        clearInterval(probeInterval)
        probeInterval = null
      }
      if (resizeObserver) {
        try {
          resizeObserver.disconnect()
        } catch {
          void 0
        }
        resizeObserver = null
      }
      try {
        map?.remove?.()
      } catch {
        void 0
      }
      map = null
    }
  }, [enabled, containerRef, targetStyleUrl, canvasRenderMode, runtimeProjectionMode, viewportSizingMode, vectorFallbackMs, computeProbe, debug, setProbe])

  return state
}
