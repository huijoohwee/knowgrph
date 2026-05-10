import type { FeatureCollection, Geometry } from 'geojson'
import type { computeBoundsFromCollections } from 'gympgrph'
import type { MarkdownGeoParseSnapshot } from './markdownGeoSnapshotContract'

export type MarkdownGeoParsedFeatureCollection = FeatureCollection

export type MarkdownGeoParseBounds = ReturnType<typeof computeBoundsFromCollections>

export type MarkdownGeoTextParseArgs = {
  geojsonText: unknown
  featureCollection?: MarkdownGeoParsedFeatureCollection | null
}

export type MarkdownGeoParseResult = MarkdownGeoParseSnapshot<Geometry, MarkdownGeoParseBounds>
