import { applyImageLikeProxySrc, isLikelyImageUrl } from '@/lib/url'

export async function testApplyImageLikeProxySrcUsesWebpageAssetPathForWeChatCdn() {
  const out = applyImageLikeProxySrc('https://mmbiz.qpic.cn/mmbiz_png/test/640?wx_fmt=png')
  if (!out.startsWith('/__webpage_asset_path/')) {
    throw new Error(`expected /__webpage_asset_path proxy, got ${out}`)
  }
}

export async function testIsLikelyImageUrlDetectsWeChatWxFmtWithoutExtension() {
  const u = 'https://mmbiz.qpic.cn/mmbiz_png/test/640?wx_fmt=jpeg'
  if (!isLikelyImageUrl(u)) throw new Error('expected wx_fmt=jpeg to be treated as image')
}
