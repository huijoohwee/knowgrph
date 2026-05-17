import { emitGeospatialModeChanged } from 'grph-shared/geospatial/events'
import { LS_KEYS } from '@/lib/config'
import { lsBool, lsSetBool } from '@/lib/persistence'

const toErrorMessage = (err: unknown): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message
    const text = String(msg || '').trim()
    if (text) return text
  }
  return 'Unknown error'
}

function publishGeospatialModeEnabled(enabled: boolean, opts?: { emitAlways?: boolean }): boolean {
  const next = enabled === true
  let previous = next
  try {
    previous = lsBool(LS_KEYS.geospatialOverlayEnabled, next)
  } catch {
    previous = next
  }
  try {
    lsSetBool(LS_KEYS.geospatialOverlayEnabled, next)
  } catch {
    void 0
  }
  if (opts?.emitAlways === true || previous !== next) {
    try {
      emitGeospatialModeChanged({ enabled: next })
    } catch {
      void 0
    }
  }
  return previous
}

export async function importGympgrph(): Promise<typeof import('gympgrph')> {
  try {
    return await import('gympgrph')
  } catch (err) {
    throw new Error(toErrorMessage(err))
  }
}

export async function readGeospatialModeEnabled(): Promise<boolean> {
  const m = await importGympgrph()
  if (typeof m.isGeospatialModeEnabled !== 'function') return false
  try {
    return Boolean(m.isGeospatialModeEnabled())
  } catch {
    return false
  }
}

export async function toggleGeospatialModeEnabled(): Promise<boolean> {
  const m = await importGympgrph()
  if (typeof m.isGeospatialModeEnabled !== 'function') {
    throw new Error('Geospatial mode API is unavailable')
  }
  const enabled = m.isGeospatialModeEnabled()
  publishGeospatialModeEnabled(!enabled, { emitAlways: true })
  if (typeof m.setGeospatialModeEnabled === 'function') {
    m.setGeospatialModeEnabled(!enabled)
  } else if (typeof m.toggleGeospatialModeEnabled === 'function') {
    m.toggleGeospatialModeEnabled()
  } else {
    throw new Error('Geospatial mode toggle API is unavailable')
  }
  return Boolean(m.isGeospatialModeEnabled())
}

export async function setGeospatialModeEnabled(enabled: boolean): Promise<boolean> {
  const next = enabled === true
  const previous = publishGeospatialModeEnabled(next, { emitAlways: true })
  const m = await importGympgrph()
  if (typeof m.isGeospatialModeEnabled !== 'function') {
    publishGeospatialModeEnabled(previous, { emitAlways: true })
    throw new Error('Geospatial mode API is unavailable')
  }
  const current = Boolean(m.isGeospatialModeEnabled())
  if (current === next) return current
  if (typeof m.setGeospatialModeEnabled === 'function') {
    m.setGeospatialModeEnabled(next)
    const resolved = Boolean(m.isGeospatialModeEnabled())
    if (resolved !== next) publishGeospatialModeEnabled(resolved, { emitAlways: true })
    return resolved
  }
  if (typeof m.toggleGeospatialModeEnabled === 'function') {
    m.toggleGeospatialModeEnabled()
    const resolved = Boolean(m.isGeospatialModeEnabled())
    if (resolved !== next) publishGeospatialModeEnabled(resolved, { emitAlways: true })
    return resolved
  }
  publishGeospatialModeEnabled(previous, { emitAlways: true })
  throw new Error('Geospatial mode toggle API is unavailable')
}

export async function requestGeospatialTraversalRun(args?: { edgeIds?: string[] | null }): Promise<void> {
  const m = await importGympgrph()
  if (typeof m.requestGeospatialTraversalRun !== 'function') {
    throw new Error('Geospatial traversal API is unavailable')
  }
  m.requestGeospatialTraversalRun(args)
}

export async function requestGeospatialCurrentLocation(args: { lat: number; lng: number; zoom?: number }): Promise<void> {
  const m = await importGympgrph()
  if (typeof m.requestGeospatialCurrentLocation !== 'function') {
    throw new Error('Geospatial current location API is unavailable')
  }
  m.requestGeospatialCurrentLocation(args)
}
