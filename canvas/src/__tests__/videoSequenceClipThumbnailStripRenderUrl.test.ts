import { resolveVideoSequenceThumbnailRenderUrl } from '@/components/timeline/VideoSequenceClipThumbnailStrip'
import type { TimelineMediaReaderThumbnail } from '@/components/timeline/timelineMediaReader'

export function testVideoSequenceClipThumbnailStripRendersNativeRasterUrl() {
  const thumbnail: TimelineMediaReaderThumbnail = {
    dataUrl: 'data:image/svg+xml;charset=utf-8,%3Csvg%3Esemantic%3C%2Fsvg%3E',
    format: 'svg',
    height: 90,
    mimeType: 'image/svg+xml',
    rasterDataUrl: 'data:image/webp;base64,frame',
    rasterFormat: 'webp',
    rasterMimeType: 'image/webp',
    timestampSeconds: 12,
    width: 160,
  }
  const renderUrl = resolveVideoSequenceThumbnailRenderUrl(thumbnail)
  if (renderUrl !== thumbnail.rasterDataUrl) {
    throw new Error(`expected compact video thumbnail render URL to use native raster frame, got ${renderUrl}`)
  }
}

