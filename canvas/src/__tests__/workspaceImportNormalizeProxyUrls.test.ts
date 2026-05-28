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
  if (!out.includes('/__webpage_asset_path/https%3A%2F%2Fmmbiz.qpic.cn/mmbiz_png/abc/640?wx_fmt=png&from=appmsg')) {
    throw new Error('expected proxy url path and query to be preserved and unescaped')
  }
  if (!/!\[[^\]]*\]\(\/__fetch_remote\?url=https%3A%2F%2Fmmbiz\.qpic\.cn%2Fx\.png&from=appmsg\)/.test(out)) {
    throw new Error('expected !https://... and !<https://...> to be normalized into a markdown image ![alt](...)')
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
