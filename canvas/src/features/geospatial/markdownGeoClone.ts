import type { FeatureCollection, Geometry, Point } from 'geojson'
import type {
  MarkdownGeoAnalysisSnapshot,
  MarkdownGeoEmbeddedBlock,
  MarkdownGeoEmbeddedRequest,
  MarkdownGeoParseSnapshot,
  MarkdownGeoPoiFeatureCollectionEntry,
} from './markdownGeoSnapshotContract'

function cloneMarkdownGeoGeometry<TGeometry extends Geometry>(geometry: TGeometry): TGeometry {
  if (geometry.type === 'GeometryCollection') {
    return {
      ...geometry,
      geometries: Array.isArray(geometry.geometries)
        ? geometry.geometries.map(child => cloneMarkdownGeoGeometry(child))
        : [],
    } as TGeometry
  }
  return {
    ...geometry,
    coordinates: JSON.parse(JSON.stringify(geometry.coordinates)),
  } as TGeometry
}

export function cloneMarkdownGeoFeatureCollection<TGeometry extends Geometry = Geometry>(
  featureCollection: FeatureCollection<TGeometry>,
): FeatureCollection<TGeometry> {
  return {
    ...featureCollection,
    features: Array.isArray(featureCollection.features)
      ? featureCollection.features.map(feature => ({
          ...feature,
          geometry: feature.geometry ? cloneMarkdownGeoGeometry(feature.geometry) : feature.geometry,
          properties: feature.properties ? { ...feature.properties } : feature.properties,
        }))
      : [],
  }
}

export function cloneMarkdownGeoEmbeddedBlocks<TGeometry extends Geometry = Geometry>(
  blocks: MarkdownGeoEmbeddedBlock<TGeometry>[],
): MarkdownGeoEmbeddedBlock<TGeometry>[] {
  return blocks.map(block => ({
    ...block,
    featureCollection: cloneMarkdownGeoFeatureCollection(block.featureCollection),
  }))
}

export function cloneMarkdownGeoEmbeddedRequests<TGeometry extends Geometry = Geometry>(
  requests: MarkdownGeoEmbeddedRequest<TGeometry>[],
): MarkdownGeoEmbeddedRequest<TGeometry>[] {
  return requests.map(request => ({
    sourceDocumentPath: request.sourceDocumentPath,
    sourceDescriptor: { ...request.sourceDescriptor },
    featureCollection: cloneMarkdownGeoFeatureCollection(request.featureCollection),
    codeBlock: { ...request.codeBlock },
  }))
}

export function cloneMarkdownGeoPoiEntries<TPoint extends Point = Point>(
  entries: MarkdownGeoPoiFeatureCollectionEntry<TPoint>[],
): MarkdownGeoPoiFeatureCollectionEntry<TPoint>[] {
  return entries.map(entry => ({
    sourceDescriptor: { ...entry.sourceDescriptor },
    featureCollection: cloneMarkdownGeoFeatureCollection(entry.featureCollection),
  }))
}

export function cloneMarkdownGeoAnalysis<
  TGeometry extends Geometry = Geometry,
  TPoint extends Point = Point,
>(
  value: MarkdownGeoAnalysisSnapshot<TGeometry, TPoint>,
): MarkdownGeoAnalysisSnapshot<TGeometry, TPoint> {
  return {
    embeddedGeoJsonGraphDataRequests: cloneMarkdownGeoEmbeddedRequests(value.embeddedGeoJsonGraphDataRequests),
    embeddedGeoBlockCount: value.embeddedGeoBlockCount,
    poiFeatureCollections: cloneMarkdownGeoPoiEntries(value.poiFeatureCollections),
    matchedPoiTables: value.matchedPoiTables,
    matchedPoiRows: value.matchedPoiRows,
  }
}

export function cloneMarkdownGeoParseResult<TGeometry extends Geometry = Geometry, TBounds = unknown>(
  value: MarkdownGeoParseSnapshot<TGeometry, TBounds>,
): MarkdownGeoParseSnapshot<TGeometry, TBounds> {
  return {
    normalizedText: value.normalizedText,
    textHash: value.textHash,
    featureCollection: value.featureCollection ? cloneMarkdownGeoFeatureCollection(value.featureCollection) : null,
    bounds: Array.isArray(value.bounds) ? ([...value.bounds] as TBounds) : value.bounds,
  }
}
