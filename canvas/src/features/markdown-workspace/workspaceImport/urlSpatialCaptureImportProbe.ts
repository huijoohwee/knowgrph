import type { WorkspaceUrlContent } from './types'
import { buildSpatialCaptureUrlContent } from './urlSpatialCaptureContent'
import { fetchSpatialCaptureHeadHints } from './urlSpatialCaptureHeadHints'

const SPATIAL_CAPTURE_HEAD_PROBE_HINT_PATTERN =
  /(?:\.ply(?:[?#]|$)|\.spz(?:[?#]|$)|(?:^|[/?#&=_-])(?:ply|spz|splat|gaussian|point[-_]?cloud|spatial[-_]?capture|scan|capture|download)(?:$|[/?#&=_-]))/i

export function shouldProbeSpatialCaptureHeadHints(value: string): boolean {
  const raw = String(value || '').trim()
  if (!raw) return false
  try {
    const parsed = new URL(raw)
    return SPATIAL_CAPTURE_HEAD_PROBE_HINT_PATTERN.test(`${parsed.pathname}?${parsed.searchParams.toString()}#${parsed.hash}`)
  } catch {
    return SPATIAL_CAPTURE_HEAD_PROBE_HINT_PATTERN.test(raw)
  }
}

export async function resolveSpatialCaptureUrlContentForImport(args: {
  normalizedUrl: string
  sourceUrl: string
  headFetchPath?: string | null
}): Promise<WorkspaceUrlContent | null> {
  const direct = buildSpatialCaptureUrlContent({ normalizedUrl: args.normalizedUrl, sourceUrl: args.sourceUrl })
  if (direct) return direct
  const headFetchPath = String(args.headFetchPath || '').trim()
  if (!headFetchPath || !shouldProbeSpatialCaptureHeadHints(args.normalizedUrl)) return null
  const headHints = await fetchSpatialCaptureHeadHints(args.normalizedUrl, headFetchPath)
  if (!headHints) return null
  return buildSpatialCaptureUrlContent({
    normalizedUrl: args.normalizedUrl,
    sourceUrl: args.sourceUrl,
    sourceMimeHint: headHints.contentType,
    sourceNameHint: headHints.filename,
  })
}
