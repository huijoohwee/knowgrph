import { applyImageLikeProxySrc, isLikelyImageUrl } from '@/lib/url'

const imageFormatHintUrl = 'https://assets.example/media/640?asset_fmt=png'

export async function testApplyImageLikeProxySrcUsesRemoteFetchForImageFormatHint() {
  const g = globalThis as unknown as { window?: unknown }
  const prevWindow = g.window
  try {
    g.window = { location: { origin: 'http://localhost:5173', hostname: 'localhost' } } as unknown
    const out = applyImageLikeProxySrc(imageFormatHintUrl)
    if (!out.startsWith('/__fetch_remote?url=')) {
      throw new Error(`expected /__fetch_remote proxy, got ${out}`)
    }
  } finally {
    g.window = prevWindow
  }
}

export async function testApplyImageLikeProxySrcSkipsProxyWhenNotLocalhost() {
  const g = globalThis as unknown as { window?: unknown }
  const prevWindow = g.window
  try {
    g.window = { location: { origin: 'https://example.com', hostname: 'example.com' } } as unknown
    const out = applyImageLikeProxySrc(imageFormatHintUrl)
    if (out.startsWith('/__fetch_remote?url=')) {
      throw new Error('expected non-localhost to avoid /__fetch_remote rewrite')
    }
    if (out !== imageFormatHintUrl) {
      throw new Error(`expected to keep raw url, got ${out}`)
    }
  } finally {
    g.window = prevWindow
  }
}

export async function testIsLikelyImageUrlDetectsFormatHintWithoutExtension() {
  const u = 'https://assets.example/media/640?asset_fmt=jpeg'
  if (!isLikelyImageUrl(u)) throw new Error('expected image format query hint to be treated as image')
}
