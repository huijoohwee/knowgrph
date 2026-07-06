import type { WorkspaceUrlContent } from './types'
import { deriveFilenameFromUrl } from '@/lib/url'
import {
  buildSpatialCaptureStandaloneManifestMarkdown,
  deriveSpatialCaptureStandaloneManifestName,
  resolveSpatialCaptureStandaloneFormat,
  type SpatialCaptureStandaloneFormat,
} from './spatialCaptureFileset'

const SPATIAL_CAPTURE_FORMAT_BY_MIME: Record<string, SpatialCaptureStandaloneFormat> = {
  'application/ply': 'ply',
  'application/spz': 'spz',
  'model/ply': 'ply',
  'model/spz': 'spz',
}

function normalizeMime(value: unknown): string {
  return String(value || '').toLowerCase().split(';')[0]?.trim() || ''
}

function resolveSpatialCaptureFormatFromMime(value: unknown): SpatialCaptureStandaloneFormat | null {
  return SPATIAL_CAPTURE_FORMAT_BY_MIME[normalizeMime(value)] || null
}

function resolveSpatialCaptureSourceName(args: {
  normalizedUrl: string
  sourceNameHint?: string | null
  format: SpatialCaptureStandaloneFormat
}): string {
  const hint = String(args.sourceNameHint || '').trim().replace(/\\/g, '/').split('/').filter(Boolean).pop() || ''
  if (resolveSpatialCaptureStandaloneFormat(hint)) return hint
  return deriveFilenameFromUrl(args.normalizedUrl, `spatial-capture.${args.format}`)
}

export function resolveSpatialCaptureUrlFormat(args: {
  normalizedUrl: string
  sourceMimeHint?: string | null
  sourceNameHint?: string | null
}): SpatialCaptureStandaloneFormat | null {
  return resolveSpatialCaptureStandaloneFormat(args.normalizedUrl)
    || resolveSpatialCaptureStandaloneFormat(String(args.sourceNameHint || ''))
    || resolveSpatialCaptureFormatFromMime(args.sourceMimeHint)
}

export function buildSpatialCaptureUrlContent(args: {
  normalizedUrl: string
  sourceUrl: string
  sourceMimeHint?: string | null
  sourceNameHint?: string | null
}): WorkspaceUrlContent | null {
  const format = resolveSpatialCaptureUrlFormat(args)
  if (!format) return null
  const originalName = resolveSpatialCaptureSourceName({ normalizedUrl: args.normalizedUrl, sourceNameHint: args.sourceNameHint, format })
  const mimeHint = normalizeMime(args.sourceMimeHint) || (format === 'ply' ? 'model/ply' : 'model/spz')
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
