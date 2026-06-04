import { buildWebpageHtmlSrcdoc } from '@/lib/websites/webpageIframeSrcdoc'

export async function testWebpageSandboxPromotesLazyImageDataSrc() {
  const raw = [
    '<!doctype html>',
    '<html><head><meta charset="utf-8"></head><body>',
    '<h1>Hello</h1>',
    '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" data-src="https://mmbiz.qpic.cn/sz_mmbiz_png/test/640?wx_fmt=png" />',
    '</body></html>',
  ].join('')

  const out = buildWebpageHtmlSrcdoc({ html: raw, baseHref: 'https://mp.weixin.qq.com/s/test', scriptPolicy: 'strip' })
  if (!out.includes('src="/__webpage_asset_path/https%3A%2F%2Fmmbiz.qpic.cn/sz_mmbiz_png/test/640?wx_fmt=png"')) {
    throw new Error('expected promoted img src to appear in sandbox html')
  }
}

export async function testWebpageSandboxProxiesWeChatImgSrc() {
  const raw = [
    '<!doctype html>',
    '<html><head><meta charset="utf-8"></head><body>',
    '<img src="https://mmbiz.qpic.cn/sz_mmbiz_png/test/640?wx_fmt=png" />',
    '</body></html>',
  ].join('')
  const out = buildWebpageHtmlSrcdoc({ html: raw, baseHref: 'https://mp.weixin.qq.com/s/test', scriptPolicy: 'strip' })
  if (!out.includes('/__webpage_asset_path/https%3A%2F%2Fmmbiz.qpic.cn/sz_mmbiz_png/test/640?wx_fmt=png')) {
    throw new Error('expected wechat image src to be rewritten to asset proxy')
  }
}

export async function testWebpageSandboxInjectsWeChatUnhideStyle() {
  const raw = [
    '<!doctype html>',
    '<html><head><meta charset="utf-8"></head><body>',
    '<section class="rich_media_content" id="js_content" style="opacity:0;visibility:hidden">X</section>',
    '</body></html>',
  ].join('')
  const out = buildWebpageHtmlSrcdoc({ html: raw, baseHref: 'https://mp.weixin.qq.com/s/test', scriptPolicy: 'strip' })
  if (!out.includes('data-kg-wechat-unhide="1"')) {
    throw new Error('expected wechat unhide style to be injected')
  }
}

export async function testWebpageSandboxAbsolutizesLocalProxyUrlsInsteadOfChangingBase() {
  const g = globalThis as unknown as { window?: unknown }
  const prevWindow = g.window
  try {
    g.window = { location: { origin: 'http://localhost:1234' } }
    const raw = [
      '<!doctype html>',
      '<html><head><meta charset="utf-8"></head><body>',
      '<img src="https://mmbiz.qpic.cn/mmbiz_png/test/640?wx_fmt=png" />',
      '</body></html>',
    ].join('')
    const out = buildWebpageHtmlSrcdoc({ html: raw, baseHref: 'https://mp.weixin.qq.com/s/test', scriptPolicy: 'strip' })
    if (!out.includes('<base href="https://mp.weixin.qq.com/s/test">')) {
      throw new Error('expected sandbox base href to remain the source url')
    }
    if (!out.includes('src="http://localhost:1234/__webpage_asset_path/')) {
      throw new Error('expected sandbox to absolutize local proxy asset urls')
    }
  } finally {
    g.window = prevWindow
  }
}
