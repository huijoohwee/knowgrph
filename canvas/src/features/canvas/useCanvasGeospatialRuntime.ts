import React from 'react'
import { LS_KEYS } from '@/lib/config'
import { resolveBrowserStorageKey } from '@/lib/persistence'
import { onGeospatialModeChanged } from '@/features/geospatial/events'
import { useGraphStore } from '@/hooks/useGraphStore'
import { readGeospatialOverlayEnabledPreference, writeGeospatialOverlayEnabledPreference } from '@/lib/geospatial/geospatialModePreference'

export function useCanvasGeospatialRuntime(): boolean {
  const geospatialHostViewportSnapshotRef = React.useRef<null | {
    zoomState: null | { k: number; x: number; y: number; graphDataRevision?: number; viewportW?: number; viewportH?: number }
    zoomStateByKey: Record<string, { k: number; x: number; y: number; graphDataRevision?: number; viewportW?: number; viewportH?: number }>
    viewPinned: boolean
    fitToScreenMode: boolean
    zoomToSelectionMode: boolean
  }>(null)

  const [geospatialModeEnabled, setGeospatialModeEnabled] = React.useState<boolean>(() => readGeospatialOverlayEnabledPreference())
  const lastHandledGeospatialModeEnabledRef = React.useRef(geospatialModeEnabled)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const storageKey = resolveBrowserStorageKey(LS_KEYS.geospatialOverlayEnabled)
    const handler = (ev: StorageEvent) => {
      if (!ev || ev.key !== storageKey) return
      try {
        const nextEnabled = readGeospatialOverlayEnabledPreference()
        lastHandledGeospatialModeEnabledRef.current = nextEnabled
        setGeospatialModeEnabled(prev => (prev === nextEnabled ? prev : nextEnabled))
      } catch {
        lastHandledGeospatialModeEnabledRef.current = false
        setGeospatialModeEnabled(prev => (prev === false ? prev : false))
      }
    }
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('storage', handler)
    }
  }, [])

  React.useEffect(() => {
    const anyImportMeta = import.meta as unknown as { env?: { DEV?: boolean } }
    if (!anyImportMeta.env?.DEV) return
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams(String(window.location.search || ''))
      if (params.get('kgGeo') !== '1') return
      void import('gympgrph')
        .then(m => {
          const gm = m as unknown as { setGeospatialModeEnabled?: (enabled: boolean) => void }
          if (typeof gm.setGeospatialModeEnabled === 'function') {
            gm.setGeospatialModeEnabled(true)
          } else {
            writeGeospatialOverlayEnabledPreference(true)
            lastHandledGeospatialModeEnabledRef.current = true
            setGeospatialModeEnabled(prev => (prev === true ? prev : true))
          }
        })
        .catch(() => {
          writeGeospatialOverlayEnabledPreference(true)
          lastHandledGeospatialModeEnabledRef.current = true
          setGeospatialModeEnabled(prev => (prev === true ? prev : true))
        })
    } catch {
      void 0
    }
  }, [])

  React.useEffect(() => {
    return onGeospatialModeChanged(detail => {
      const enabled = typeof detail.enabled === 'boolean' ? detail.enabled : null
      if (enabled == null) return
      if (lastHandledGeospatialModeEnabledRef.current === enabled) {
        setGeospatialModeEnabled(prev => (prev === enabled ? prev : enabled))
        return
      }
      lastHandledGeospatialModeEnabledRef.current = enabled
      if (enabled) {
        try {
          const s = useGraphStore.getState()
          geospatialHostViewportSnapshotRef.current = {
            zoomState: s.zoomState,
            zoomStateByKey: s.zoomStateByKey,
            viewPinned: s.viewPinned,
            fitToScreenMode: s.fitToScreenMode,
            zoomToSelectionMode: s.zoomToSelectionMode,
          }
        } catch {
          geospatialHostViewportSnapshotRef.current = null
        }
      } else {
        const snap = geospatialHostViewportSnapshotRef.current
        geospatialHostViewportSnapshotRef.current = null
        if (snap) {
          try {
            const s = useGraphStore.getState()
            s.setViewPinned(snap.viewPinned)
            s.setFitToScreenMode(snap.fitToScreenMode)
            s.setZoomToSelectionMode(snap.zoomToSelectionMode)
            if (snap.zoomState) s.setZoomState(snap.zoomState)
            else useGraphStore.setState(() => ({ zoomState: null }))
            useGraphStore.setState(() => ({ zoomStateByKey: snap.zoomStateByKey || {}, zoomRequest: null, threeCameraRequest: null }))
          } catch {
            void 0
          }
        }
      }
      setGeospatialModeEnabled(prev => (prev === enabled ? prev : enabled))
    })
  }, [])

  return geospatialModeEnabled
}
