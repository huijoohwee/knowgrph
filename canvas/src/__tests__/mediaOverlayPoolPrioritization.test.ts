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

export async function testMediaOverlayPoolDeduplicatesProxyWrappedMediaUrlsToSingleCanonicalWidgetVersion() {
  const raw = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Example.jpg/640px-Example.jpg'
  const nodes: any[] = [
    {
      id: 'seedance-widget',
      type: 'VideoGeneration',
      label: 'Seedance 2.0 Video Widget',
      properties: {
        media_url: raw,
        imageUrl: raw,
      },
    },
    {
      id: 'rich-media-panel',
      type: 'RichMediaPanel',
      label: 'Rich Media Panel',
      properties: {
        media_url: `/__fetch_remote?url=${encodeURIComponent(raw)}`,
        imageUrl: `/__fetch_remote?url=${encodeURIComponent(raw)}`,
      },
    },
  ]
  const connectedValuesByNodeId = new Map<string, any>([
    ['rich-media-panel', {
      'properties.imageUrl': {
        value: raw,
        sources: [{ edgeId: 'edge-1', nodeId: 'seedance-widget', portKey: 'videoUrl' }],
      },
    }],
  ])
  const out = listMediaOverlayNodes({
    enabled: true,
    nodes: nodes as any,
    poolMax: 24,
    connectedValuesByNodeId,
  })
  if (out.length !== 1) throw new Error(`expected one canonical media overlay after proxy unwrap dedupe, got ${out.length}`)
  if (out[0]?.id !== 'rich-media-panel') throw new Error(`expected canonical Rich Media Panel version to win dedupe, got ${out[0]?.id || '<none>'}`)
  if (!String(out[0]?.title || '').includes('Rich Media Panel for Seedance 2.0 Video Widget')) {
    throw new Error(`expected canonical Rich Media Panel title to retain source widget context, got ${String(out[0]?.title || '<none>')}`)
  }
}

export async function testMediaOverlayPoolAppliesConnectedTextToRichMediaPanelShellBeforeSpecSelection() {
  const nodes: any[] = [
    {
      id: 'panel-1',
      type: 'RichMediaPanel',
      label: 'Rich Media Panel',
      properties: {
        'flow:widgetTypeId': 'default',
        'flow:widgetFormId': 'richMediaPanel',
      },
    },
  ]
  const connectedValuesByNodeId = new Map<string, any>([
    ['panel-1', {
      'properties.output': {
        value: 'Generated text output from OpenAI Text Widget.',
        sources: [{ edgeId: 'edge-1', nodeId: 'w-openai-text', portKey: 'text_out' }],
      },
    }],
  ])
  const out = listMediaOverlayNodes({
    enabled: true,
    nodes: nodes as any,
    poolMax: 24,
    connectedValuesByNodeId,
  })
  if (out.length !== 1) throw new Error(`expected one rich media overlay panel, got ${out.length}`)
  if (String(out[0]?.kind || '') !== 'iframe') throw new Error(`expected connected text panel to render as iframe, got ${String(out[0]?.kind || '<none>')}`)
  if (!String(out[0]?.srcDoc || '').includes('Generated text output from OpenAI Text Widget.')) {
    throw new Error('expected connected text output to be materialized into panel srcDoc before overlay spec selection')
  }
}
