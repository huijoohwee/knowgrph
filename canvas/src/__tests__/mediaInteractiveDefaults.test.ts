import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'
import type { GraphNode } from '@/lib/graph/types'

type MinimalNode = Pick<GraphNode, 'id' | 'label' | 'type' | 'properties'>

function makeNode(overrides: Partial<MinimalNode>): GraphNode {
  const base: MinimalNode = {
    id: 'n',
    label: 'n',
    type: 'Media',
    properties: {},
  }
  return { ...(base as GraphNode), ...overrides }
}

export function testMediaInteractiveDefaults() {
  const imageNode = makeNode({
    id: 'image',
    properties: { media_url: 'https://example.com/image.png', media_kind: 'image' },
  })
  const svgNode = makeNode({
    id: 'svg',
    properties: { media_url: 'https://example.com/icon.svg', media_kind: 'svg' },
  })
  const videoNode = makeNode({
    id: 'video',
    properties: { media_url: 'https://example.com/video.mp4', media_kind: 'video' },
  })
  const iframeNode = makeNode({
    id: 'iframe',
    properties: {
      iframe_url: 'https://example.com/embed/widget',
      media_kind: 'iframe',
    },
  })
  const videoExplicitOff = makeNode({
    id: 'videoOff',
    properties: {
      media_url: 'https://example.com/video2.mp4',
      media_kind: 'video',
      media_interactive: false,
    },
  })
  const imageExplicitOn = makeNode({
    id: 'imageOn',
    properties: {
      media_url: 'https://example.com/image2.png',
      media_kind: 'image',
      media_interactive: true,
    },
  })

  const imageSpec = getNodeMediaSpec(imageNode)
  const svgSpec = getNodeMediaSpec(svgNode)
  const videoSpec = getNodeMediaSpec(videoNode)
  const iframeSpec = getNodeMediaSpec(iframeNode)
  const videoOffSpec = getNodeMediaSpec(videoExplicitOff)
  const imageOnSpec = getNodeMediaSpec(imageExplicitOn)

  if (!imageSpec || !svgSpec || !videoSpec || !iframeSpec || !videoOffSpec || !imageOnSpec) {
    throw new Error('Expected media specs for all test nodes')
  }

  if (imageSpec.interactive) {
    throw new Error('Image media should be non-interactive by default')
  }
  if (svgSpec.interactive) {
    throw new Error('SVG media should be non-interactive by default')
  }
  if (!videoSpec.interactive) {
    throw new Error('Video media should be interactive by default')
  }
  if (!iframeSpec.interactive) {
    throw new Error('Iframe media should be interactive by default')
  }
  if (videoOffSpec.interactive) {
    throw new Error('media_interactive=false should override video default interactivity')
  }
  if (!imageOnSpec.interactive) {
    throw new Error('media_interactive=true should override image default non-interactivity')
  }
}
