export const VIDEO_DOWNLOAD_ELIGIBLE_DOMAINS = new Set([
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'dailymotion.com',
  'twitch.tv',
])

const MAX_VIDEO_DOWNLOAD_URL_LENGTH = 2048

function resolveApexHost(hostname: string): string {
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  if (VIDEO_DOWNLOAD_ELIGIBLE_DOMAINS.has(normalized)) return normalized
  for (const domain of VIDEO_DOWNLOAD_ELIGIBLE_DOMAINS) {
    if (normalized.endsWith(`.${domain}`)) return domain
  }
  return normalized
}

export function isVideoDownloadEligible(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_VIDEO_DOWNLOAD_URL_LENGTH) return false
  try {
    const url = new URL(trimmed)
    return VIDEO_DOWNLOAD_ELIGIBLE_DOMAINS.has(resolveApexHost(url.hostname))
  } catch {
    return false
  }
}
