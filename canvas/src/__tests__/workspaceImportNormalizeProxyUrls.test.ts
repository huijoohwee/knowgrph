import { buildWebpageWorkspaceEntryTextFromUpstreamMarkdown } from '@/features/markdown-workspace/workspaceImport'

export async function testWorkspaceImportNormalizesLocalProxyUrlsAndAutolinks() {
  const upstream = [
    '**<https://mp.weixin.qq.com/s?__biz=1&mid=2>**',
    '',
    '!https://mp.weixin.qq.com/__webpage_asset_path/https%3A%2F%2Fmmbiz.qpic.cn/mmbiz_png/abc/640?wx_fmt=png\\&from=appmsg',
    '',
    '![](https://mp.weixin.qq.com/__webpage_asset_path/https%3A%2F%2Fmmbiz.qpic.cn/mmbiz_png/def/640?wx_fmt=png\\&from=appmsg)',
    '',
    '!<https://mp.weixin.qq.com/__fetch_remote?url=https%3A%2F%2Fmmbiz.qpic.cn%2Fx.png\\&from=appmsg>',
    '',
    '![The committee noted that AI should be integrated across firms’ operations and workforce capabilities.](/__webpage_asset_path/https%3A%2F%2Fcassette.sphdigital.com.sg/image/straitstimes/04c048580dbbd2204b1b172b998af8bb480077470466d51c0853f5eb4d5b8541)',
    '',
    '![video](/__fetch_remote?url=https%3A%2F%2Fcdn.example.test%2Fclips%2Flaunch.mp4)',
    '',
    '[![avatar-alt](/__webpage_asset_path/https%3A%2F%2Fcassette.sphdigital.com.sg/image/straitstimes/9da6d00a056afab1bf12013ad5b1a245d2e99e3f65d360a924712fcac8a8b4a13?w=150)](https://www.straitstimes.com/authors/zhaki-abdullah?ref=article-byline)',
    '',
    '<div data-testid="content-block-header"><img alt="Hero" src="/__webpage_asset_path/https%3A%2F%2Fcassette.sphdigital.com.sg/image/straitstimes/html-hero?w=800"><video poster="/__webpage_asset_path/https%3A%2F%2Fcdn.example.test/posters/launch?fmt=webp"><source src="/__fetch_remote?url=https%3A%2F%2Fcdn.example.test%2Fclips%2Finline.webm" type="video/webm"></video></div>',
    '',
  ].join('\n')

  const out = buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
    upstreamMarkdown: upstream,
    url: 'https://mp.weixin.qq.com/s/hAliUVOIw5Q_XNMUBL_tZQ',
    view: 'html',
  })

  if (!out.includes('[WeChat](https://mp.weixin.qq.com/s?__biz=1&mid=2)')) {
    throw new Error('expected <https://...> autolinks to be normalized into [WeChat](...)')
  }
  if (out.includes('https://mp.weixin.qq.com/__webpage_asset_path')) {
    throw new Error('expected absolute host prefix on local proxy paths to be stripped')
  }
  if (!out.includes('![](https://mmbiz.qpic.cn/mmbiz_png/abc/640?wx_fmt=png&from=appmsg)')) {
    throw new Error('expected proxied image autolink to be canonicalized to upstream media url')
  }
  if (!out.includes('![](https://mmbiz.qpic.cn/mmbiz_png/def/640?wx_fmt=png&from=appmsg)')) {
    throw new Error('expected proxied markdown image href to be canonicalized to upstream media url')
  }
  if (!/!\[[^\]]*\]\(https:\/\/mmbiz\.qpic\.cn\/x\.png\)/.test(out)) {
    throw new Error('expected !https://... and !<https://...> proxy images to normalize into upstream markdown image urls')
  }
  if (!out.includes('![The committee noted that AI should be integrated across firms’ operations and workforce capabilities.](https://cassette.sphdigital.com.sg/image/straitstimes/04c048580dbbd2204b1b172b998af8bb480077470466d51c0853f5eb4d5b8541)')) {
    throw new Error('expected no-extension webpage asset image path to be canonicalized to the upstream media url')
  }
  if (!out.includes('![video](https://cdn.example.test/clips/launch.mp4)')) {
    throw new Error('expected proxied markdown video href to be canonicalized to upstream media url')
  }
  if (!out.includes('[![avatar-alt](https://cassette.sphdigital.com.sg/image/straitstimes/9da6d00a056afab1bf12013ad5b1a245d2e99e3f65d360a924712fcac8a8b4a13?w=150)](https://www.straitstimes.com/authors/zhaki-abdullah?ref=article-byline)')) {
    throw new Error('expected linked proxied avatar image to preserve alt and outer link while canonicalizing image destination')
  }
  if (/<\/?div\b/i.test(out)) {
    throw new Error(`expected imported raw html to use semantic containers, got: ${out}`)
  }
  if (!out.includes('<section data-testid="content-block-header">')) {
    throw new Error('expected raw HTML generic container to be normalized to semantic section')
  }
  if (/<(?:img|video|source)\b/i.test(out)) {
    throw new Error(`expected imported raw html media tags to be normalized to markdown media, got: ${out}`)
  }
  if (!out.includes('![Hero](https://cassette.sphdigital.com.sg/image/straitstimes/html-hero?w=800)')) {
    throw new Error('expected raw HTML img proxy to be rewritten as markdown image with preserved alt text')
  }
  if (!out.includes('![video](https://cdn.example.test/clips/inline.webm)')) {
    throw new Error('expected raw HTML video source proxy to be rewritten as markdown video media')
  }
}

export async function testWorkspaceImportNormalizesProxyReferenceLabelsAndLooseEntities() {
  const proxyHref = '/__webpage_asset_path/https%3A%2F%2Fexample.com%2Freport%3Fa%3D1%26b%3D2'
  const fracturedProxyHref =
    '/__webpage_asset_path/https%3A%2F%2Fwww.marketscreener.com%2Fnews%2Fmarket-talk-oil-s-new-85-floor-locked-in-for-2026-ce7e51dedc8ef625'
  const upstream = [
    `Reference: [${proxyHref}](${proxyHref.replace(/&/g, '\\&')})`,
    `Broken reference: [${proxyHref})`,
    `Fractured label: [https://www.marketscreener.com/news/market-talk-oil-s-new-85-floor-locked-in-for-2026-ce 7e 51dedc 8ef 625](${fracturedProxyHref})`,
    '',
    'Explicit demand destruction &#x 26; policy acceleration.',
    '',
  ].join('\n')

  const out = buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
    upstreamMarkdown: upstream,
    url: 'https://example.com/source',
    view: 'html',
  })

  if (!out.includes(`[https://example.com/report?a=1&b=2](${proxyHref})`)) {
    throw new Error(`expected proxied reference label normalized to upstream URL, got: ${out}`)
  }
  if (!out.includes(`Broken reference: [https://example.com/report?a=1&b=2](${proxyHref})`)) {
    throw new Error(`expected malformed proxied pseudo-link normalized, got: ${out}`)
  }
  if (!out.includes(
    `Fractured label: [https://www.marketscreener.com/news/market-talk-oil-s-new-85-floor-locked-in-for-2026-ce7e51dedc8ef625](${fracturedProxyHref})`,
  )) {
    throw new Error(`expected whitespace-fractured url label normalized, got: ${out}`)
  }
  if (!out.includes('Explicit demand destruction & policy acceleration.')) {
    throw new Error(`expected loose html entity residue decoded, got: ${out}`)
  }
}
