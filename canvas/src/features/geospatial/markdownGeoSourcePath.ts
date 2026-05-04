import type { FeatureCollection, Geometry } from 'geojson'
import type { MarkdownGeoDatasetRegistrationRequest } from './markdownGeoDatasetContract'
import { normalizeMarkdownGeoSourceDocumentPath } from './markdownGeoDocumentPath'
import { buildMarkdownGeoDocumentLineRangePath } from './markdownGeoLineRange'
import type { MarkdownGeoGraphSourceDescriptor } from './markdownGeoSourceContract'

const normalizePositiveOrdinal = (value: unknown, fallback: number): number => {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value as number)) : fallback
}

const readTableStartLineFromFeatureCollection = (
  featureCollection: FeatureCollection<Geometry> | null | undefined,
): number | null => {
  const features = Array.isArray(featureCollection?.features) ? featureCollection.features : []
  for (let i = 0; i < features.length; i += 1) {
    const properties = features[i]?.properties
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) continue
    const startLine = Number((properties as Record<string, unknown>).kgSourceTableStartLine)
    if (Number.isFinite(startLine)) return Math.max(1, Math.floor(startLine))
  }
  return null
}

export function buildMarkdownGeoCodeBlockGraphSourcePath(
  req: Pick<MarkdownGeoDatasetRegistrationRequest, 'sourceDocumentPath' | 'codeBlock'>,
): string {
  return buildMarkdownGeoCodeBlockGraphSourceDescriptor(req).sourcePath
}

export function buildMarkdownGeoTableGraphSourcePath(args: {
  sourceDocumentPath: unknown
  featureCollection?: FeatureCollection<Geometry> | null
  tableIndex?: unknown
}): string {
  return buildMarkdownGeoTableGraphSourceDescriptor(args).sourcePath
}

export function buildMarkdownGeoCodeBlockGraphSourceDescriptor(
  req: Pick<MarkdownGeoDatasetRegistrationRequest, 'sourceDocumentPath' | 'codeBlock'>,
): MarkdownGeoGraphSourceDescriptor {
  return {
    kind: 'code-block',
    sourcePath: buildMarkdownGeoDocumentLineRangePath({
      sourceDocumentPath: req.sourceDocumentPath,
      startLine: req.codeBlock.startLine,
      endLine: req.codeBlock.endLine,
    }),
  }
}

export function buildMarkdownGeoTableGraphSourceDescriptor(args: {
  sourceDocumentPath: unknown
  featureCollection?: FeatureCollection<Geometry> | null
  tableIndex?: unknown
}): MarkdownGeoGraphSourceDescriptor {
  const sourceDocumentPath = normalizeMarkdownGeoSourceDocumentPath(args.sourceDocumentPath) || 'document'
  const startLine = readTableStartLineFromFeatureCollection(args.featureCollection)
  return {
    kind: 'table',
    sourcePath: startLine
      ? `${sourceDocumentPath}#markdown-geo-table-L${startLine}`
      : `${sourceDocumentPath}#markdown-geo-table-${normalizePositiveOrdinal(args.tableIndex, 1)}`,
  }
}
