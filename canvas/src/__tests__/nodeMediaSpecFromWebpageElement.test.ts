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

export async function testNodeMediaSpecDetectsLegacyImageUrlField() {
  const node = {
    id: 'legacy:image-url:1',
    type: 'Image',
    label: 'Legacy image_url',
    properties: {
      image_url: 'https://mmbiz.qpic.cn/mmbiz_png/test/640?wx_fmt=png&from=appmsg',
    },
  } as unknown as Parameters<typeof getNodeMediaSpec>[0]
  const spec = getNodeMediaSpec(node)
  if (!spec) throw new Error('expected media spec for legacy image_url field')
  if (spec.kind !== 'image') throw new Error(`expected image kind from image_url, got ${String((spec as any).kind)}`)
}

export async function testNodeMediaSpecAllowsYouTubeEmbedIframeUrl() {
  const node = {
    id: 'iframe:youtube:1',
    type: 'IFrame',
    label: 'YouTube embed',
    properties: {
      iframe_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    },
  } as unknown as Parameters<typeof getNodeMediaSpec>[0]

  const spec = getNodeMediaSpec(node)
  if (!spec) throw new Error('expected media spec for YouTube embed iframe')
  if (spec.kind !== 'iframe') throw new Error(`expected iframe kind, got ${String((spec as any).kind)}`)
  if (!String(spec.url).includes('youtube.com/embed/')) throw new Error('expected normalized YouTube embed URL')
}

export async function testNodeMediaSpecDetectsMarkdownImageInParagraphText() {
  const node = {
    id: 'p:md:image:1',
    type: 'Paragraph',
    label: 'Paragraph',
    properties: {
      text: '![](https://mmbiz.qpic.cn/mmbiz_png/test/640?wx_fmt=png&from=appmsg)',
    },
  } as unknown as Parameters<typeof getNodeMediaSpec>[0]

  const spec = getNodeMediaSpec(node)
  if (!spec) throw new Error('expected media spec for markdown image in paragraph text')
  if (spec.kind !== 'image') throw new Error(`expected image kind, got ${String((spec as any).kind)}`)
  if (!String(spec.url).includes('mmbiz.qpic.cn')) throw new Error('expected url extracted from markdown')
}

export async function testNodeMediaSpecDetectsStandaloneMarkdownLinkWebpageAsIframe() {
  const node = {
    id: 'p:md:link:webpage',
    type: 'Paragraph',
    label: 'Paragraph',
    properties: {
      text: '[Visualising AI spending](https://www.aljazeera.com/news/2026/2/19/visualising-ai-spending-how-does-it-compare-with-historys-mega-projects)',
    },
  } as unknown as Parameters<typeof getNodeMediaSpec>[0]

  const spec = getNodeMediaSpec(node)
  if (!spec) throw new Error('expected media spec for standalone markdown link paragraph')
  if (spec.kind !== 'iframe') throw new Error(`expected iframe kind, got ${String((spec as any).kind)}`)
  if (!String(spec.url).includes('aljazeera.com/news/')) throw new Error('expected iframe url extracted from markdown link')
}

export async function testNodeMediaSpecDetectsStandaloneMarkdownLinkYouTubeAsEmbedIframe() {
  const node = {
    id: 'p:md:link:youtube',
    type: 'Paragraph',
    label: 'Paragraph',
    properties: {
      text: '[What To Do](https://youtu.be/XzzPRQRDcDw?t=2997)',
    },
  } as unknown as Parameters<typeof getNodeMediaSpec>[0]

  const spec = getNodeMediaSpec(node)
  if (!spec) throw new Error('expected media spec for standalone youtube markdown link paragraph')
  if (spec.kind !== 'iframe') throw new Error(`expected iframe kind, got ${String((spec as any).kind)}`)
  const u = String(spec.url)
  if (!u.includes('youtube-nocookie.com/embed/') && !u.includes('youtube.com/embed/')) throw new Error('expected youtube embed url')
  if (!u.includes('start=2997')) throw new Error('expected youtube start seconds to be preserved')
}

export async function testNodeMediaSpecDetectsStandaloneMarkdownLinkBilibiliAsEmbedIframe() {
  const node = {
    id: 'p:md:link:bilibili',
    type: 'Paragraph',
    label: 'Paragraph',
    properties: {
      text: '[Bilibili](https://www.bilibili.com/video/BV15KqbBaEAG)',
    },
  } as unknown as Parameters<typeof getNodeMediaSpec>[0]

  const spec = getNodeMediaSpec(node)
  if (!spec) throw new Error('expected media spec for standalone bilibili markdown link paragraph')
  if (spec.kind !== 'iframe') throw new Error(`expected iframe kind, got ${String((spec as any).kind)}`)
  const u = String(spec.url)
  if (!u.startsWith('https://player.bilibili.com/player.html?bvid=')) throw new Error('expected bilibili embed url')
}
