import type { FeatureCollection } from 'geojson'

export function isPointOnlyFeatureCollection(fc: FeatureCollection, maxFeatures: number): boolean {
  const features = Array.isArray(fc?.features) ? fc.features : []
  const lim = Math.max(0, Math.floor(maxFeatures))
  const n = lim > 0 ? Math.min(features.length, lim) : features.length
  for (let i = 0; i < n; i += 1) {
    const g = features[i]?.geometry
    const t = g?.type
    if (t !== 'Point' && t !== 'MultiPoint') return false
  }
  return true
}

export function coerceFeatureCollectionIds(fc: FeatureCollection, datasetId: string): FeatureCollection {
  const features = Array.isArray(fc?.features) ? fc.features : []
  let changed = false
  const next = features.map((f, idx) => {
    if (f && (typeof f.id === 'string' || typeof f.id === 'number')) return f
    changed = true
    return { ...f, id: `${datasetId}:${idx + 1}` }
  })
  return changed ? { ...fc, features: next } : fc
}

export function pickPoiSelection(args: {
  features: Array<{ id?: unknown; properties?: Record<string, unknown> | null; geometry?: unknown; source?: unknown }>
  datasets: Array<{ id: string; label: string; enabled: boolean; source: unknown; format: unknown }>
  graphLayerIds: string[]
  datasetSourcePrefix: string
}): { kind: 'dataset-feature'; featureLabel: string } | null {
  const features = Array.isArray(args.features) ? args.features : []
  for (const f of features) {
    const props = (f && typeof f === 'object' ? (f as Record<string, unknown>).properties : null) as Record<string, unknown> | null
    if (props && props.cluster === true) continue
    const label = props ? String(props.label || '').trim() : ''
    return { kind: 'dataset-feature', featureLabel: label || 'Feature' }
  }
  return null
}
