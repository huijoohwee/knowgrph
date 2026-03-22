import React from 'react'

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

const isAbortLike = (err: unknown): boolean => {
  const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message || '') : String(err || '')
  const lower = msg.toLowerCase()
  return lower.includes('err_aborted') || lower.includes('aborterror')
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
  const { enabled, containerRef, targetStyleUrl } = args
  const [state, setState] = React.useState<BasemapResult>({
    map: null,
    probe: EMPTY_PROBE,
    mapError: null,
    styleRevision: 0,
  })

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

        let style = String(targetStyleUrl || '').trim() || 'https://tiles.openfreemap.org/styles/liberty'
        if (style.includes('demotiles.maplibre.org')) {
          style = 'https://tiles.openfreemap.org/styles/liberty'
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
          setState((prev: BasemapResult) => ({ ...prev, mapError: trimmed }))
        })

        map.on?.('styledata', () => {
          if (cancelled) return
          setState((prev: BasemapResult) => ({ ...prev, styleRevision: prev.styleRevision + 1 }))
        })

        map.once?.('load', () => {
          if (cancelled) return
          map.resize?.()
          setProbe(computeProbe(map))
          if (debug) {
            try {
              console.info('[kg-geo] maplibre load')
            } catch {
              void 0
            }
          }
        })

        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            if (cancelled || !map) return
            map.resize?.()
            setProbe(computeProbe(map))
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
        }, 1_000)

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
  }, [enabled, containerRef, targetStyleUrl])

  return state
}
