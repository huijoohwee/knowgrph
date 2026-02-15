const toErrorMessage = (err: unknown): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message
    const text = String(msg || '').trim()
    if (text) return text
  }
  return 'Unknown error'
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
  const m = await importGympgrph()
  if (typeof m.isGeospatialModeEnabled !== 'function') {
    throw new Error('Geospatial mode API is unavailable')
  }
  const next = enabled === true
  const current = Boolean(m.isGeospatialModeEnabled())
  if (current === next) return current
  if (typeof m.setGeospatialModeEnabled === 'function') {
    m.setGeospatialModeEnabled(next)
    return Boolean(m.isGeospatialModeEnabled())
  }
  if (typeof m.toggleGeospatialModeEnabled === 'function') {
    m.toggleGeospatialModeEnabled()
    return Boolean(m.isGeospatialModeEnabled())
  }
  throw new Error('Geospatial mode toggle API is unavailable')
}

export async function requestGeospatialTraversalRun(args?: { edgeIds?: string[] | null }): Promise<void> {
  const m = await importGympgrph()
  if (typeof m.requestGeospatialTraversalRun !== 'function') {
    throw new Error('Geospatial traversal API is unavailable')
  }
  m.requestGeospatialTraversalRun(args)
}
