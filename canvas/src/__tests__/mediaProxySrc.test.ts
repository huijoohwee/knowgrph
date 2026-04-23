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

export const testApplyMediaProxySkipsProxyWhenNotLocalhost = () => {
  const g = globalThis as unknown as Record<string, unknown>
  const prevWindow = g.window
  g.window = { location: { origin: 'https://example.invalid' } }
  try {
    const blobLike = 'https://github.com/owner/repo/blob/main/doc.md'
    const out = applyMediaProxySrc(blobLike)
    if (out.startsWith(`${MEDIA_PROXY_ENDPOINT}?url=`)) throw new Error('expected direct URL (no proxy wrapper)')
    if (!out.startsWith('https://raw.githubusercontent.com/')) {
      throw new Error('expected github blob url to normalize to raw.githubusercontent.com')
    }
  } finally {
    g.window = prevWindow
  }
}

export const testApplyMediaProxyProxiesOpenFreeMapOnLocalhost = () => {
  const g = globalThis as unknown as Record<string, unknown>
  const prevWindow = g.window
  g.window = { location: { origin: 'http://localhost:5173' } }
  try {
    const src = 'https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/0-255.pbf'
    const out = applyMediaProxySrc(src)
    if (!out.startsWith(`${MEDIA_PROXY_ENDPOINT}?url=`)) throw new Error('expected OpenFreeMap assets to be proxied on localhost')
    const encoded = out.slice(`${MEDIA_PROXY_ENDPOINT}?url=`.length)
    const decoded = decodeURIComponent(encoded)
    if (decoded !== src) throw new Error('expected OpenFreeMap URL to be preserved inside proxy parameter')
  } finally {
    g.window = prevWindow
  }
}

export const testApplyMediaProxyProxiesOnPrivateLanOrigin = () => {
  const g = globalThis as unknown as Record<string, unknown>
  const prevWindow = g.window
  g.window = { location: { origin: 'http://192.168.1.24:5173' } }
  try {
    const src = 'https://example.com/assets/demo.png'
    const out = applyMediaProxySrc(src)
    if (!out.startsWith(`${MEDIA_PROXY_ENDPOINT}?url=`)) throw new Error('expected proxy wrapper for private LAN dev origin')
    const encoded = out.slice(`${MEDIA_PROXY_ENDPOINT}?url=`.length)
    const decoded = decodeURIComponent(encoded)
    if (decoded !== src) throw new Error('expected LAN-origin proxy parameter to preserve source URL')
  } finally {
    g.window = prevWindow
  }
}
