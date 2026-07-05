import type { WorkspaceUrlContent } from './types'
import { deriveFilenameFromUrl } from '@/lib/url'
import {
  buildSpatialCaptureStandaloneManifestMarkdown,
  deriveSpatialCaptureStandaloneManifestName,
  resolveSpatialCaptureStandaloneFormat,
} from './spatialCaptureFileset'

export function buildSpatialCaptureUrlContent(args: {
  normalizedUrl: string
  sourceUrl: string
}): WorkspaceUrlContent | null {
  const format = resolveSpatialCaptureStandaloneFormat(args.normalizedUrl)
  if (!format) return null
  const originalName = deriveFilenameFromUrl(args.normalizedUrl, `spatial-capture.${format}`)
  const mimeHint = format === 'ply' ? 'model/ply' : 'application/octet-stream'
  return {
    normalizedUrl: args.sourceUrl,
    name: deriveSpatialCaptureStandaloneManifestName(originalName),
    sourceMediaKind: 'model',
    sourceMimeHint: mimeHint,
    text: buildSpatialCaptureStandaloneManifestMarkdown({
      originalName,
      format,
      sourceKind: 'url',
      sourceIdentity: args.sourceUrl,
      mimeHint,
    }),
  }
}
