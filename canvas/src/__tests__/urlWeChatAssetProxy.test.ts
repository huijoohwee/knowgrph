import { applyImageLikeProxySrc, isLikelyImageUrl } from '@/lib/url'

export async function testApplyImageLikeProxySrcUsesWebpageAssetPathForWeChatCdn() {
  const g = globalThis as unknown as { window?: unknown }
  const prevWindow = g.window
  try {
    g.window = { location: { origin: 'http://localhost:5173', hostname: 'localhost' } } as unknown
    const out = applyImageLikeProxySrc('https://mmbiz.qpic.cn/mmbiz_png/test/640?wx_fmt=png')
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
    const out = applyImageLikeProxySrc('https://mmbiz.qpic.cn/mmbiz_png/test/640?wx_fmt=png')
    if (out.startsWith('/__fetch_remote?url=')) {
      throw new Error('expected non-localhost to avoid /__fetch_remote rewrite')
    }
    if (!out.startsWith('https://mmbiz.qpic.cn/')) {
      throw new Error(`expected to keep raw url, got ${out}`)
    }
  } finally {
    g.window = prevWindow
  }
}

export async function testIsLikelyImageUrlDetectsWeChatWxFmtWithoutExtension() {
  const u = 'https://mmbiz.qpic.cn/mmbiz_png/test/640?wx_fmt=jpeg'
  if (!isLikelyImageUrl(u)) throw new Error('expected wx_fmt=jpeg to be treated as image')
}
