import { listMediaOverlayNodes } from '@/lib/render/mediaOverlayPool'

export async function testMediaOverlayPoolPrioritizesWeChatImagesWithinBudget() {
  const nodes: any[] = Array.from({ length: 60 }).map((_, i) => {
    return {
      id: `img:${i + 1}`,
      type: 'Image',
      label: `Image ${i + 1}`,
      properties: { media_url: `https://example.com/img-${i + 1}.png` },
    }
  })
  nodes.push({
    id: 'wechat:1',
    type: 'Link',
    label: 'mmbiz.qpic.cn',
    properties: {
      url: 'https://mmbiz.qpic.cn/mmbiz_png/gdEn3pxzatSHAib7vomhHSibH0icqO2xD72/640?wx_fmt=png&from=appmsg',
      label: 'mmbiz.qpic.cn',
    },
  })

  const out = listMediaOverlayNodes({ enabled: true, nodes: nodes as any, poolMax: 24 })
  const hasWeChat = out.some(n => n.kind === 'image' && n.url.includes('mmbiz.qpic.cn') && n.url.includes('wx_fmt='))
  if (!hasWeChat) throw new Error('expected WeChat image to be prioritized into overlay pool budget')
}

export async function testMediaOverlayPoolAlwaysIncludesPreferredNodesWhenMedia() {
  const nodes: any[] = Array.from({ length: 80 }).map((_, i) => {
    return {
      id: `img:${i + 1}`,
      type: 'Image',
      label: `Image ${i + 1}`,
      properties: { media_url: `https://example.com/img-${i + 1}.png` },
    }
  })
  nodes.push({
    id: 'preferred:wechat',
    type: 'Link',
    label: 'Preferred WeChat',
    properties: {
      url: 'https://mmbiz.qpic.cn/mmbiz_png/test/640?wx_fmt=png&from=appmsg',
      label: 'cover',
    },
  })

  const out = listMediaOverlayNodes({
    enabled: true,
    nodes: nodes as any,
    poolMax: 6,
    preferredNodeIds: ['preferred:wechat'],
  })
  if (!out.some(n => n.id === 'preferred:wechat')) {
    throw new Error('expected preferred media node to be included even when poolMax is small')
  }
}

export async function testMediaOverlayPoolDeduplicatesByKindAndUrl() {
  const nodes: any[] = [
    {
      id: 'p:1',
      type: 'Paragraph',
      label: 'Paragraph',
      properties: {
        text: '[YouTube](https://youtu.be/XzzPRQRDcDw?t=2997)',
      },
    },
    {
      id: 'link:1',
      type: 'Link',
      label: 'YouTube',
      properties: {
        url: 'https://youtu.be/XzzPRQRDcDw?t=2997',
        label: 'YouTube',
        media_kind: 'iframe',
        iframe_url: 'https://www.youtube-nocookie.com/embed/XzzPRQRDcDw?start=2997',
        media_url: 'https://www.youtube-nocookie.com/embed/XzzPRQRDcDw?start=2997',
        media: 'https://www.youtube-nocookie.com/embed/XzzPRQRDcDw?start=2997',
        media_interactive: true,
      },
    },
  ]

  const out = listMediaOverlayNodes({ enabled: true, nodes: nodes as any, poolMax: 24 })
  const iframeCount = out.filter(n => n.kind === 'iframe').length
  if (iframeCount !== 1) throw new Error(`expected 1 iframe panel after dedupe, got ${iframeCount}`)
}
