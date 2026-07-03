import type { TimelineMediaReaderThumbnail } from './timelineMediaReader'
import type { VideoSequenceTimelineSourceThumbnailSet } from './VideoSequenceTimelineRuler'

const readImageFormatFromSourceUrl = (value: unknown): TimelineMediaReaderThumbnail['rasterFormat'] => {
  const url = String(value || '').toLowerCase()
  if (/\.webp(?:[?#]|$)|^data:image\/webp/.test(url)) return 'webp'
  if (/\.png(?:[?#]|$)|^data:image\/png/.test(url)) return 'png'
  return 'jpeg'
}

export function buildVideoSequenceSourceImageThumbnail(set: VideoSequenceTimelineSourceThumbnailSet | null | undefined): readonly TimelineMediaReaderThumbnail[] {
  if (!set || set.kind !== 'image' || !set.sourceUrl) return []
  const rasterFormat = readImageFormatFromSourceUrl(set.sourceUrl)
  const rasterMimeType = rasterFormat === 'webp' ? 'image/webp' : rasterFormat === 'png' ? 'image/png' : 'image/jpeg'
  return [{
    dataUrl: set.sourceUrl,
    format: rasterFormat,
    height: 90,
    mimeType: rasterMimeType,
    rasterDataUrl: set.sourceUrl,
    rasterFormat,
    rasterMimeType,
    timestampSeconds: 0,
    width: 160,
  }]
}
