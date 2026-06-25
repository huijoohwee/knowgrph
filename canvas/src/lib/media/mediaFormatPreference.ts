export const MEDIA_IMAGE_FORMAT_PREFERENCE = ['svg', 'webp', 'png', 'jpeg'] as const
export const MEDIA_VIDEO_FORMAT_PREFERENCE = ['mp4', 'webm'] as const

export type PreferredMediaImageFormat = typeof MEDIA_IMAGE_FORMAT_PREFERENCE[number]
export type PreferredMediaVideoFormat = typeof MEDIA_VIDEO_FORMAT_PREFERENCE[number]

export const MEDIA_IMAGE_FORMAT_PREFERENCE_ATTR = MEDIA_IMAGE_FORMAT_PREFERENCE.join(' ')
export const MEDIA_VIDEO_FORMAT_PREFERENCE_ATTR = MEDIA_VIDEO_FORMAT_PREFERENCE.join(' ')
export const MEDIA_VIDEO_RECORDER_MIME_TYPE_CANDIDATES = [
  'video/mp4; codecs="avc1.42E01E"',
  'video/webm; codecs="vp9"',
  'video/webm; codecs="vp8"',
  'video/webm',
] as const

export function isPreferredRasterImageFormat(value: string): value is Exclude<PreferredMediaImageFormat, 'svg'> {
  return value === 'webp' || value === 'png' || value === 'jpeg'
}

export function readPreferredImageFormat(url: string, contentType = ''): PreferredMediaImageFormat | string {
  const normalizedType = String(contentType || '').toLowerCase().split(';')[0]?.trim() || ''
  if (normalizedType === 'image/svg+xml') return 'svg'
  if (normalizedType === 'image/webp') return 'webp'
  if (normalizedType === 'image/png') return 'png'
  if (normalizedType === 'image/jpeg' || normalizedType === 'image/jpg') return 'jpeg'
  if (normalizedType.startsWith('image/')) return normalizedType.slice('image/'.length)

  const normalizedUrl = String(url || '').toLowerCase()
  if (normalizedUrl.startsWith('data:image/svg+xml')) return 'svg'
  if (normalizedUrl.startsWith('data:image/webp')) return 'webp'
  if (normalizedUrl.startsWith('data:image/png')) return 'png'
  if (normalizedUrl.startsWith('data:image/jpeg') || normalizedUrl.startsWith('data:image/jpg')) return 'jpeg'

  const extension = normalizedUrl.split(/[?#]/)[0]?.match(/\.([a-z0-9]{1,12})$/)?.[1] || ''
  if (extension === 'svg') return 'svg'
  if (extension === 'webp') return 'webp'
  if (extension === 'png') return 'png'
  if (extension === 'jpg' || extension === 'jpeg') return 'jpeg'
  return extension
}

export function readPreferredVideoFormat(url: string, contentType = ''): PreferredMediaVideoFormat | string {
  const normalizedType = String(contentType || '').toLowerCase().split(';')[0]?.trim() || ''
  if (normalizedType === 'video/mp4') return 'mp4'
  if (normalizedType === 'video/webm') return 'webm'
  if (normalizedType.startsWith('video/')) return normalizedType.slice('video/'.length)

  const extension = String(url || '').toLowerCase().split(/[?#]/)[0]?.match(/\.([a-z0-9]{1,12})$/)?.[1] || ''
  if (extension === 'm4v') return 'mp4'
  if (extension === 'mp4') return 'mp4'
  if (extension === 'webm') return 'webm'
  return extension
}
