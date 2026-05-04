import { hashText } from '@/features/parsers/hash'
import type { FeatureCollection, Geometry } from 'geojson'

export function normalizeMarkdownGeoCodeBlockText(raw: unknown): string {
  return String(raw || '').trim()
}

export function buildMarkdownGeoCodeBlockContentHash(raw: unknown): string {
  return hashText(normalizeMarkdownGeoCodeBlockText(raw))
}

export function buildMarkdownGeoFeatureCollectionGraphSourceHash(
  featureCollection: FeatureCollection<Geometry> | null | undefined,
): string {
  return hashText(JSON.stringify(featureCollection || null))
}
