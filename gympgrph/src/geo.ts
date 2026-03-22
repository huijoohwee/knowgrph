import type { FeatureCollection, Geometry, Position } from 'geojson'

const visitPositions = (geom: Geometry | null | undefined, onPos: (p: Position) => void): void => {
  if (!geom) return
  if (geom.type === 'Point') {
    onPos(geom.coordinates)
    return
  }
  if (geom.type === 'MultiPoint' || geom.type === 'LineString') {
    for (const p of geom.coordinates) onPos(p)
    return
  }
  if (geom.type === 'MultiLineString' || geom.type === 'Polygon') {
    for (const ring of geom.coordinates) {
      for (const p of ring) onPos(p)
    }
    return
  }
  if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      for (const ring of poly) {
        for (const p of ring) onPos(p)
      }
    }
  }
}

export function computeBoundsFromCollections(collections: FeatureCollection[]): [number, number, number, number] | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let seen = false

  for (const fc of collections || []) {
    const features = Array.isArray(fc?.features) ? fc.features : []
    for (const f of features) {
      visitPositions(f?.geometry, p => {
        const x = Number(p?.[0])
        const y = Number(p?.[1])
        if (!Number.isFinite(x) || !Number.isFinite(y)) return
        seen = true
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      })
    }
  }

  if (!seen) return null
  return [minX, minY, maxX, maxY]
}
