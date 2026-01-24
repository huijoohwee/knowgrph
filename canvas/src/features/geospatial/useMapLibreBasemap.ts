import React from 'react'
import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl'
import { applyMediaProxySrc, normalizeGitHubBlobLikeUrl } from '@/lib/url'
import { applyPreferredStyle, buildBlankStyle } from '@/features/geospatial/geospatialOverlayUtils'

export type BasemapProbe = {
  tileSourceId: string
  styleLoaded: boolean
  tilesLoaded: boolean
  sourceLoaded: boolean
  canvasW: number
  canvasH: number
}

const emptyProbe = (): BasemapProbe => ({
  tileSourceId: '',
  styleLoaded: false,
  tilesLoaded: false,
  sourceLoaded: false,
  canvasW: 0,
  canvasH: 0,
})

const readViewport = (): { w: number; h: number } => {
  try {
    if (typeof window === 'undefined') return { w: 0, h: 0 }
    return { w: Math.max(0, Math.floor(window.innerWidth || 0)), h: Math.max(0, Math.floor(window.innerHeight || 0)) }
  } catch {
    return { w: 0, h: 0 }
  }
}

export function useMapLibreBasemap(args: {
  enabled: boolean
  rootRef: React.RefObject<HTMLDivElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  targetStyleUrl: string
  canvasRenderMode: '2d' | '3d'
  projectionMode: 'auto' | 'mercator' | 'globe'
}) {
  const mapRef = React.useRef<MapLibreMap | null>(null)
  const lastStyleUrlRef = React.useRef<string | null>(null)
  const lastMapRequestRef = React.useRef<{ input: string; output: string } | null>(null)
  const probeRef = React.useRef<BasemapProbe>(emptyProbe())
  const mapListenersRef = React.useRef<{ onMapError: (e: unknown) => void; onStyleReady: () => void } | null>(null)

  const [mapError, setMapError] = React.useState<string | null>(null)
  const [styleRevision, setStyleRevision] = React.useState(0)
  const [statusRevision, setStatusRevision] = React.useState(0)

  const forceViewportSize = React.useCallback(() => {
    const el = args.rootRef.current
    if (!el) return
    const { w, h } = readViewport()
    if (w > 0) el.style.width = `${w}px`
    if (h > 0) el.style.height = `${h}px`
  }, [args.rootRef])

  const readContainerSize = React.useCallback((): { w: number; h: number } => {
    const { w: vw, h: vh } = readViewport()
    try {
      const el = args.rootRef.current
      if (!el) return { w: vw, h: vh }
      const rect = el.getBoundingClientRect()
      const w = Number.isFinite(rect.width) ? Math.max(0, Math.floor(rect.width)) : 0
      const h = Number.isFinite(rect.height) ? Math.max(0, Math.floor(rect.height)) : 0
      if (w > 0 && h > 0) return { w, h }
      if (vw > 0 && vh > 0) return { w: vw, h: vh }
      return { w, h }
    } catch {
      return { w: vw, h: vh }
    }
  }, [args.rootRef])

  React.useEffect(() => {
    if (!args.enabled) return
    if (!args.containerRef.current) return
    if (mapRef.current) return

    setMapError(null)
    probeRef.current = emptyProbe()

    let cancelled = false
    let timeoutId: number | null = null
    let bootTimeoutId: number | null = null
    let readyIntervalId: number | null = null
    let pulseIntervalId: number | null = null
    let resizeObserver: ResizeObserver | null = null

    const initialStyleUrl = args.targetStyleUrl

    const destroy = () => {
      if (timeoutId != null) {
        try {
          window.clearTimeout(timeoutId)
        } catch {
          void 0
        }
      }
      if (bootTimeoutId != null) {
        try {
          window.clearTimeout(bootTimeoutId)
        } catch {
          void 0
        }
      }
      if (readyIntervalId != null) {
        try {
          window.clearInterval(readyIntervalId)
        } catch {
          void 0
        }
      }
      if (pulseIntervalId != null) {
        try {
          window.clearInterval(pulseIntervalId)
        } catch {
          void 0
        }
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
        const map = mapRef.current
        const listeners = mapListenersRef.current
        if (map && listeners) {
          map.off('error', listeners.onMapError)
          map.off('load', listeners.onStyleReady)
          map.off('style.load', listeners.onStyleReady)
        }
      } catch {
        void 0
      }
      try {
        mapRef.current?.remove()
      } catch {
        void 0
      }
      mapRef.current = null
      mapListenersRef.current = null
      lastStyleUrlRef.current = null
    }

    timeoutId = window.setTimeout(() => {
      if (cancelled) return
      if (!args.containerRef.current) return
      if (mapRef.current) return

      const map = new maplibregl.Map({
        container: args.containerRef.current,
        style: buildBlankStyle() as never,
        center: [0, 0],
        zoom: 1,
        interactive: true,
        attributionControl: false,
        transformRequest: (url, resourceType) => {
          const normalized = normalizeGitHubBlobLikeUrl(url) ?? url
          const proxied = applyMediaProxySrc(normalized)
          if (typeof window === 'undefined') return { url: proxied }
          try {
            const out = new URL(proxied).toString()
            lastMapRequestRef.current = { input: normalized, output: out }
            return { url: out }
          } catch {
            try {
              const out = new URL(proxied, window.location.origin).toString()
              lastMapRequestRef.current = { input: normalized, output: out }
              return { url: out }
            } catch {
              lastMapRequestRef.current = { input: normalized, output: proxied }
              return { url: proxied }
            }
          }
        },
      })

      mapRef.current = map
      lastStyleUrlRef.current = initialStyleUrl

      const deriveTileSourceId = (): string => {
        if (probeRef.current.tileSourceId) return probeRef.current.tileSourceId
        try {
          const style = map.getStyle() as unknown as { sources?: Record<string, unknown> }
          const sources = style && typeof style === 'object' && style.sources && typeof style.sources === 'object' ? style.sources : null
          if (!sources) return ''
          for (const [id, srcRaw] of Object.entries(sources)) {
            if (!srcRaw || typeof srcRaw !== 'object' || Array.isArray(srcRaw)) continue
            const src = srcRaw as Record<string, unknown>
            const type = typeof src.type === 'string' ? src.type : ''
            if (type === 'geojson') continue
            const hasTiles = Array.isArray(src.tiles) && src.tiles.length > 0
            const hasUrl = typeof src.url === 'string' && src.url.trim().length > 0
            if (hasTiles || hasUrl) return id
          }
          return ''
        } catch {
          return ''
        }
      }

      const onMapError = (e: unknown) => {
        const extractUrl = (raw: unknown): string => {
          if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ''
          const url = (raw as { url?: unknown }).url
          return typeof url === 'string' ? url : ''
        }
        const extractMessage = (raw: unknown): string => {
          if (raw instanceof Error) return raw.message
          if (typeof raw === 'string') return raw
          if (raw && typeof raw === 'object' && 'message' in raw) return String((raw as { message?: unknown }).message || '')
          return ''
        }
        const payload = typeof e === 'object' && e && 'error' in e ? (e as { error?: unknown }).error : null
        const payloadUrl = extractUrl(payload)
        const evUrl = extractUrl(e)
        const url = payloadUrl || evUrl
        const base = extractMessage(payload) || extractMessage(e) || 'Map load error'
        const message = (() => {
          if (url) return `${base} (${url})`
          const last = lastMapRequestRef.current
          if (last?.output) return `${base} (lastRequest=${last.output})`
          return base
        })()
        setMapError(message)
      }

      const onStyleReady = () => {
        setStyleRevision(v => v + 1)
        try {
          forceViewportSize()
          map.resize()
        } catch {
          void 0
        }
      }

      mapListenersRef.current = { onMapError, onStyleReady }

      map.on('error', onMapError)
      map.on('load', onStyleReady)
      map.on('style.load', onStyleReady)

      try {
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            if (cancelled) return
            try {
              forceViewportSize()
              map.resize()
              const prev = probeRef.current
              const size = readContainerSize()
              probeRef.current = { ...prev, canvasW: size.w, canvasH: size.h }
              setStatusRevision(v => (v + 1) % 1_000_000)
            } catch {
              void 0
            }
          })
          if (args.rootRef.current) resizeObserver.observe(args.rootRef.current)
        }
      } catch {
        resizeObserver = null
      }

      readyIntervalId = window.setInterval(() => {
        if (cancelled) return
        try {
          const anyMap = map as unknown as {
            isStyleLoaded?: () => boolean
            areTilesLoaded?: () => boolean
            isSourceLoaded?: (id: string) => boolean
            loaded?: () => boolean
          }
          const styleOkRaw: unknown = (() => {
            const any = map as unknown as { isStyleLoaded?: () => unknown; loaded?: () => unknown }
            if (typeof anyMap.isStyleLoaded === 'function') {
              return (anyMap.isStyleLoaded as unknown as () => unknown)()
            }
            if (typeof any.isStyleLoaded === 'function') return any.isStyleLoaded()
            if (typeof any.loaded === 'function') return any.loaded()
            return probeRef.current.styleLoaded
          })()
          const styleOk = styleOkRaw === true

          const canvasSize = readContainerSize()

          const tilesOkRaw: unknown = (() => {
            if (typeof anyMap.areTilesLoaded === 'function') {
              return (anyMap.areTilesLoaded as unknown as () => unknown)()
            }
            if (typeof anyMap.loaded === 'function') {
              return (anyMap.loaded as unknown as () => unknown)()
            }
            return probeRef.current.tilesLoaded
          })()
          const tilesOk = tilesOkRaw === true

          const tileSourceId = deriveTileSourceId()
          const sourceOkRaw: unknown = (() => {
            if (tileSourceId && typeof anyMap.isSourceLoaded === 'function') {
              return (anyMap.isSourceLoaded as unknown as (id: string) => unknown)(tileSourceId)
            }
            if (tileSourceId) return tilesOk
            return probeRef.current.sourceLoaded
          })()
          const sourceOk = sourceOkRaw === true

          const prev = probeRef.current
          probeRef.current = {
            ...prev,
            tileSourceId,
            styleLoaded: styleOk,
            tilesLoaded: tilesOk,
            sourceLoaded: sourceOk,
            canvasW: canvasSize.w,
            canvasH: canvasSize.h,
          }

          if (canvasSize.w === 0 || canvasSize.h === 0) {
            try {
              forceViewportSize()
              map.resize()
            } catch {
              void 0
            }
          }
        } catch {
          void 0
        }
      }, 400)

      pulseIntervalId = window.setInterval(() => {
        if (cancelled) return
        setStatusRevision(v => (v + 1) % 1_000_000)
      }, 1_000)

      void (async () => {
        const ok = await applyPreferredStyle(map, initialStyleUrl, () => cancelled)
        if (cancelled) return
        if (!ok) {
          try {
            map.setStyle(initialStyleUrl as never)
          } catch {
            void 0
          }
          setMapError(prev => prev ?? 'Failed to load map style.')
        }
      })()

      bootTimeoutId = window.setTimeout(() => {
        if (cancelled) return
        const probe = probeRef.current
        const derivedReady = Boolean(probe.styleLoaded && probe.canvasW > 0 && probe.canvasH > 0)
        if (derivedReady) return
        const last = lastMapRequestRef.current
        const suffix = last?.output ? ` (lastRequest=${last.output})` : ''
        setMapError(prev => prev ?? `Basemap did not load. Check style URL, CORS, or network.${suffix}`)
      }, 25_000)

      try {
        forceViewportSize()
        map.resize()
      } catch {
        void 0
      }
    }, 0)

    return () => {
      cancelled = true
      destroy()
    }
  }, [args.enabled, args.containerRef, args.rootRef, forceViewportSize, readContainerSize])

  React.useEffect(() => {
    const map = mapRef.current
    if (!args.enabled || !map) return
    if (lastStyleUrlRef.current === args.targetStyleUrl) return

    let cancelled = false
    const isCancelled = () => cancelled
    void (async () => {
      const ok = await applyPreferredStyle(map, args.targetStyleUrl, isCancelled)
      if (isCancelled()) return
      if (!ok) {
        setMapError(prev => prev ?? 'Failed to load map style.')
        return
      }
      setMapError(null)
      lastStyleUrlRef.current = args.targetStyleUrl
    })()
    return () => {
      cancelled = true
    }
  }, [args.enabled, args.targetStyleUrl])

  React.useEffect(() => {
    const map = mapRef.current
    if (!args.enabled || !map) return
    try {
      const mode = args.projectionMode
      if (mode === 'mercator') {
        map.setProjection({ type: 'mercator' } as never)
      } else if (mode === 'globe') {
        map.setProjection({ type: 'globe' } as never)
      } else {
        if (args.canvasRenderMode === '3d') {
          map.setProjection({ type: 'globe' } as never)
        } else {
          map.setProjection({ type: 'mercator' } as never)
        }
      }
    } catch {
      void 0
    }
  }, [args.enabled, args.canvasRenderMode, args.projectionMode])

  const map = args.enabled ? mapRef.current : null
  return {
    map,
    mapError,
    styleRevision,
    statusRevision,
    probe: probeRef.current,
    lastMapRequestRef,
    forceViewportSize,
  }
}
