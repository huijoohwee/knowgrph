import type { FeatureCollection, Geometry, Point } from 'geojson'
import type { MarkdownGeoEmbeddedCodeBlock } from './markdownGeoCodeBlockContract'
import type { MarkdownGeoGraphSourceDescriptor } from './markdownGeoSourceContract'

export type MarkdownGeoEmbeddedBlock<TGeometry extends Geometry = Geometry> = {
  featureCollection: FeatureCollection<TGeometry>
  geojsonText: string
  startLine: number
  endLine: number
}

export type MarkdownGeoEmbeddedRequest<TGeometry extends Geometry = Geometry> = {
  sourceDocumentPath: string
  sourceDescriptor: MarkdownGeoGraphSourceDescriptor
  featureCollection: FeatureCollection<TGeometry>
  codeBlock: MarkdownGeoEmbeddedCodeBlock
}

export type MarkdownGeoPoiFeatureCollectionEntry<TPoint extends Point = Point> = {
  sourceDescriptor: MarkdownGeoGraphSourceDescriptor
  featureCollection: FeatureCollection<TPoint>
}

export type MarkdownGeoAnalysisSnapshot<
  TGeometry extends Geometry = Geometry,
  TPoint extends Point = Point,
> = {
  embeddedGeoJsonGraphDataRequests: MarkdownGeoEmbeddedRequest<TGeometry>[]
  embeddedGeoBlockCount: number
  poiFeatureCollections: MarkdownGeoPoiFeatureCollectionEntry<TPoint>[]
  matchedPoiTables: number
  matchedPoiRows: number
}

export type MarkdownGeoParseSnapshot<TGeometry extends Geometry = Geometry, TBounds = unknown> = {
  normalizedText: string
  textHash: string
  featureCollection: FeatureCollection<TGeometry> | null
  bounds: TBounds | null
}
