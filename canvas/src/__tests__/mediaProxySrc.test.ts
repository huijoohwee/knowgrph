import { applyMediaProxySrc, MEDIA_PROXY_ENDPOINT } from '@/lib/url'

export const testApplyMediaProxyNormalizesGithubBlobUrl = () => {
  const g = globalThis as unknown as Record<string, unknown>
  const prevWindow = g.window
  g.window = { location: { origin: 'http://localhost:5173' } }
  try {
    const blobLike = 'https://github.com/owner/repo/blob/main/doc.md'
    const out = applyMediaProxySrc(blobLike)
    if (!out.startsWith(`${MEDIA_PROXY_ENDPOINT}?url=`)) throw new Error('expected proxy wrapper')
    const encoded = out.slice(`${MEDIA_PROXY_ENDPOINT}?url=`.length)
    const decoded = decodeURIComponent(encoded)
    if (!decoded.startsWith('https://raw.githubusercontent.com/')) {
      throw new Error('expected github blob url to normalize to raw.githubusercontent.com')
    }
  } finally {
    g.window = prevWindow
  }
}
