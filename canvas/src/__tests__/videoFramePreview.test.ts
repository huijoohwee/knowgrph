import {
  buildRemoteVideoFrameFileName,
  buildYouTubeTimestampFramePreviewDescriptor,
} from 'grph-shared/rich-media/providers'
import { getOrCreateVideoThumbnail } from 'grph-shared/rich-media/videoThumbnail'
import { buildRemoteVideoFrameDefaultCacheRoot, buildRemoteVideoFrameDefaultPublicPrefix, readRemoteVideoFrameOutputFolderName } from '@/lib/rich-media/server/videoFrameServer'

export async function testYouTubeTimestampFramePreviewUsesSharedVideoFrameEndpoint() {
  const url = 'https://www.youtube.com/watch?v=aBcD123xYz9&t=421'
  const preview = buildYouTubeTimestampFramePreviewDescriptor(url)
  if (!preview) throw new Error('expected timestamp frame preview descriptor')
  if (preview.kind !== 'timestamp-frame') throw new Error(`expected timestamp-frame kind, got ${preview.kind}`)
  if (preview.provider !== 'youtube') throw new Error(`expected youtube provider, got ${preview.provider}`)
  if (preview.startSeconds !== 421) throw new Error(`expected startSeconds 421, got ${preview.startSeconds}`)
  if (preview.timestampLabel !== '7:01') throw new Error(`expected timestamp label 7:01, got ${preview.timestampLabel}`)
  if (!String(preview.thumbnailUrl || '').startsWith('/__video_frame?')) {
    throw new Error(`expected video-frame endpoint thumbnail, got ${preview.thumbnailUrl || ''}`)
  }
  const requestUrl = new URL(String(preview.thumbnailUrl || ''), 'https://example.test')
  if (requestUrl.searchParams.get('time') !== '421') throw new Error('expected frame request to carry timestamp seconds')
  if (requestUrl.searchParams.get('format') !== 'png') throw new Error('expected PNG frame request')
  if (requestUrl.searchParams.get('url') !== url) throw new Error('expected frame request to preserve source URL')
}

export async function testVideoThumbnailPrefersTimestampFrameBeforeGenericYouTubeThumbnail() {
  const url = 'https://youtu.be/aBcD123xYz9?t=421'
  const thumb = await getOrCreateVideoThumbnail(url)
  if (!thumb || !thumb.startsWith('/__video_frame?')) {
    throw new Error(`expected timestamped YouTube thumbnail to use frame endpoint, got ${thumb || ''}`)
  }
}

export async function testRemoteVideoFrameFileNameIsStableAndNeutral() {
  const first = buildRemoteVideoFrameFileName({
    sourceUrl: 'https://www.youtube.com/watch?v=aBcD123xYz9&t=421',
    timeSeconds: 421,
    format: 'png',
  })
  const second = buildRemoteVideoFrameFileName({
    sourceUrl: 'https://www.youtube.com/watch?v=aBcD123xYz9&t=421',
    timeSeconds: 421,
    format: 'png',
  })
  if (first !== second) throw new Error('expected stable frame filename')
  if (!/^frame-[a-f0-9]+-t421\.png$/.test(first)) {
    throw new Error(`expected neutral generated frame filename, got ${first}`)
  }
  const fractional = buildRemoteVideoFrameFileName({
    sourceUrl: 'https://www.youtube.com/watch?v=aBcD123xYz9&t=421',
    timeSeconds: 2.8,
    format: 'png',
  })
  if (!/^frame-[a-f0-9]+-t2_8\.png$/.test(fractional)) {
    throw new Error(`expected fractional frame filename to stay filesystem-safe, got ${fractional}`)
  }
}

export function testRemoteVideoFrameCacheRootUsesTimestampedSiblingImageFolder() {
  const workspaceRoot = '/Users/huijoohwee/Documents/GitHub'
  const folderName = readRemoteVideoFrameOutputFolderName()
  const cacheRoot = buildRemoteVideoFrameDefaultCacheRoot(workspaceRoot)
  const publicPrefix = buildRemoteVideoFrameDefaultPublicPrefix()
  if (!/^\d{8}T\d{6}Z$/.test(folderName)) throw new Error(`expected docs_-style timestamp folder, got ${folderName}`)
  if (cacheRoot !== `${workspaceRoot}/huijoohwee/image/video-frame/${folderName}`) {
    throw new Error(`expected sibling image/video-frame timestamp root, got ${cacheRoot}`)
  }
  if (cacheRoot.split('/image/video-frame/').length !== 2) throw new Error(`expected one sibling image/video-frame root segment, got ${cacheRoot}`)
  if (publicPrefix !== `/image/video-frame/${folderName}`) throw new Error(`expected timestamped public prefix, got ${publicPrefix}`)
}
