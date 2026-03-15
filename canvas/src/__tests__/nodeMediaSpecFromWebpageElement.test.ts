import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'

export async function testNodeMediaSpecDetectsWebpageElementImg() {
  const node = {
    id: 'dom:img:1',
    type: 'WebpageElement',
    label: 'IMG',
    properties: {
      'dom:tag': 'IMG',
      'dom:attrs:src': 'https://mmbiz.qpic.cn/mmbiz_png/test/640?wx_fmt=png',
    },
  } as unknown as Parameters<typeof getNodeMediaSpec>[0]

  const spec = getNodeMediaSpec(node)
  if (!spec) throw new Error('expected media spec for WebpageElement IMG')
  if (spec.kind !== 'image') throw new Error(`expected image kind, got ${String((spec as any).kind)}`)
  if (!String(spec.url).includes('mmbiz.qpic.cn')) throw new Error('expected url from dom:attrs:src')
}

export async function testNodeMediaSpecDetectsWebpageElementIframeProxy() {
  const node = {
    id: 'dom:iframe:1',
    type: 'WebpageElement',
    label: 'IFRAME',
    properties: {
      'dom:tag': 'IFRAME',
      'dom:attrs:src': '/__webpage_proxy?url=https%3A%2F%2Fexample.com%2F',
    },
  } as unknown as Parameters<typeof getNodeMediaSpec>[0]

  const spec = getNodeMediaSpec(node)
  if (!spec) throw new Error('expected media spec for WebpageElement IFRAME')
  if (spec.kind !== 'iframe') throw new Error(`expected iframe kind, got ${String((spec as any).kind)}`)
  if (!String(spec.url).startsWith('/__webpage_proxy?url=')) throw new Error('expected iframe url to preserve local proxy url')
}

export async function testNodeMediaSpecDetectsMarkdownLinkImageWithoutMediaKind() {
  const node = {
    id: 'link:image:1',
    type: 'Link',
    label: 'Cover',
    properties: {
      url: 'https://mmbiz.qpic.cn/mmbiz_png/test/640?wx_fmt=png&from=appmsg',
      label: 'cover',
    },
  } as unknown as Parameters<typeof getNodeMediaSpec>[0]
  const spec = getNodeMediaSpec(node)
  if (!spec) throw new Error('expected media spec for markdown link image url')
  if (spec.kind !== 'image') throw new Error(`expected image kind, got ${String((spec as any).kind)}`)
}

export async function testNodeMediaSpecDetectsMarkdownLinkIframeFromLabelAndLocalHtml() {
  const node = {
    id: 'link:iframe:1',
    type: 'Link',
    label: 'IFrame Demo',
    properties: {
      url: '/__repo_file/sandbox/test-data/openclaw-injection-demo.html',
      label: 'iframe demo',
    },
  } as unknown as Parameters<typeof getNodeMediaSpec>[0]
  const spec = getNodeMediaSpec(node)
  if (!spec) throw new Error('expected media spec for markdown link local iframe html')
  if (spec.kind !== 'iframe') throw new Error(`expected iframe kind, got ${String((spec as any).kind)}`)
  if (!String(spec.url).startsWith('/__repo_file/sandbox/test-data/openclaw-injection-demo.html')) {
    throw new Error('expected local html iframe path to be preserved')
  }
}

export async function testNodeMediaSpecSkipsPlainHttpLinkWithoutMediaHint() {
  const node = {
    id: 'link:plain:1',
    type: 'Link',
    label: 'Plain Article',
    properties: {
      url: 'https://example.com/news/article',
      label: 'article',
    },
  } as unknown as Parameters<typeof getNodeMediaSpec>[0]
  const spec = getNodeMediaSpec(node)
  if (spec) throw new Error('expected no media spec for plain article link')
}
