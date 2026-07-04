import { resolveVideoSequenceClipThumbnails } from '@/components/timeline/videoSequenceClipThumbnailSelection'
import type { TimelineMediaReaderThumbnail } from '@/components/timeline/timelineMediaReader'

const buildThumbnail = (args: {
  dataUrl: string
  timestampSeconds: number
}): TimelineMediaReaderThumbnail => ({
  dataUrl: args.dataUrl,
  format: 'svg',
  height: 90,
  mimeType: 'image/svg+xml',
  rasterDataUrl: args.dataUrl,
  rasterFormat: 'webp',
  rasterMimeType: 'image/webp',
  timestampSeconds: args.timestampSeconds,
  width: 160,
})

export function testVideoSequenceClipThumbnailsKeepDuplicateNativeFrameReel() {
  const thumbnails = resolveVideoSequenceClipThumbnails({
    sourceThumbnails: [
      buildThumbnail({ dataUrl: 'data:image/webp;base64,same-frame', timestampSeconds: 0 }),
      buildThumbnail({ dataUrl: 'data:image/webp;base64,same-frame', timestampSeconds: 4 }),
      buildThumbnail({ dataUrl: 'data:image/webp;base64,same-frame', timestampSeconds: 8 }),
    ],
    sourceWindow: { sourceEndSeconds: 10, sourceStartSeconds: 0, timelineEndMinutes: 1, timelineStartMinutes: 0 },
  })
  if (thumbnails.length !== 3) {
    throw new Error(`expected duplicate native source frames to stay as a reel, got ${JSON.stringify(thumbnails)}`)
  }
}

export function testVideoSequenceClipThumbnailsKeepDistinctNativeFrames() {
  const thumbnails = resolveVideoSequenceClipThumbnails({
    sourceThumbnails: [
      buildThumbnail({ dataUrl: 'data:image/webp;base64,frame-a', timestampSeconds: 0 }),
      buildThumbnail({ dataUrl: 'data:image/webp;base64,frame-b', timestampSeconds: 4 }),
      buildThumbnail({ dataUrl: 'data:image/webp;base64,frame-c', timestampSeconds: 8 }),
    ],
    sourceWindow: { sourceEndSeconds: 10, sourceStartSeconds: 0, timelineEndMinutes: 1, timelineStartMinutes: 0 },
  })
  if (thumbnails.length !== 3) {
    throw new Error(`expected distinct native frames to keep their timeline strip, got ${JSON.stringify(thumbnails)}`)
  }
}

export function testVideoSequenceClipThumbnailsRestoreNativeReelWhenSourceWindowIsSparse() {
  const thumbnails = resolveVideoSequenceClipThumbnails({
    sourceThumbnails: [
      buildThumbnail({ dataUrl: 'data:image/webp;base64,source-frame-a', timestampSeconds: 1.08 }),
      buildThumbnail({ dataUrl: 'data:image/webp;base64,source-frame-b', timestampSeconds: 4 }),
      buildThumbnail({ dataUrl: 'data:image/webp;base64,source-frame-c', timestampSeconds: 8 }),
      buildThumbnail({ dataUrl: 'data:image/webp;base64,source-frame-d', timestampSeconds: 12 }),
    ],
    sourceWindow: { sourceEndSeconds: 1.45, sourceStartSeconds: 0.45, timelineEndMinutes: 1.45, timelineStartMinutes: 0.45 },
  })
  const urls = thumbnails.map(thumbnail => thumbnail.dataUrl)
  if (thumbnails.length < 3 || !urls.every(url => url.startsWith('data:image/webp')) || urls.includes('data:image/svg+xml;base64,vid')) {
    throw new Error(`expected missed-window video clips to keep a native thumbnail reel, got ${JSON.stringify(thumbnails)}`)
  }
}

export function testVideoSequenceClipThumbnailsRestoreWholeNativeReelWhenSourceWindowIsStale() {
  const sourceThumbnails = Array.from({ length: 24 }, (_, index) =>
    buildThumbnail({ dataUrl: `data:image/webp;base64,source-frame-${index}`, timestampSeconds: 1.08 + index * 2.16 }),
  )
  const thumbnails = resolveVideoSequenceClipThumbnails({
    sourceThumbnails,
    sourceWindow: { sourceEndSeconds: 1, sourceStartSeconds: 0, timelineEndMinutes: 52 / 60, timelineStartMinutes: 0 },
  })
  if (thumbnails.length !== sourceThumbnails.length || thumbnails[0] !== sourceThumbnails[0] || thumbnails[thumbnails.length - 1] !== sourceThumbnails[sourceThumbnails.length - 1]) {
    throw new Error(`expected stale one-second source window to restore the whole native media reel, got ${JSON.stringify(thumbnails)}`)
  }
}
