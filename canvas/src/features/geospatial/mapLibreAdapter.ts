import type { FeatureCollection, Feature, Point } from 'geojson'
import type { GraphNode } from '@/lib/graph/types'
import { agenticRagNodeFromGraphNode } from '@/lib/graph/jsonld/utils'

export type MapEntityFeatureProperties = {
  entityId: string
  entityType: string
  label: string
  fill?: string
}

export function transformGraphNodesToGeoJson(
  nodes: GraphNode[],
  options?: {
    getFill?: (node: GraphNode) => string | null | undefined
  },
): FeatureCollection<Point, MapEntityFeatureProperties> {
  const features: Array<Feature<Point, MapEntityFeatureProperties>> = []
  const getFill = options?.getFill
  for (const node of nodes) {
    const agentic = agenticRagNodeFromGraphNode(node)
    const geo = agentic.geo
    if (!geo) continue
    const lat = geo.lat
    const lng = geo.lng
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    if (lat < -90 || lat > 90) continue
    if (lng < -180 || lng > 180) continue
    const fillRaw = getFill ? getFill(node) : null
    const fill = typeof fillRaw === 'string' ? fillRaw.trim() : ''
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        entityId: node.id,
        entityType: node.type,
        label: node.label,
        ...(fill ? { fill } : {}),
      },
    })
  }
  return { type: 'FeatureCollection', features }
}
