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
