import { readFileSync } from 'node:fs'
import {
  IMAGE_TO_THREEJS_OUTPUT_PANEL_PROPERTY,
  IMAGE_TO_THREEJS_RENDER_MODE,
} from '@/features/image-to-threejs/imageToThreeJsContract'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config.storyboard-widget'
import { getNodeMediaSpec } from '@/lib/canvas/graph-elements/mediaSpec'
import { listMediaOverlayNodes } from '@/lib/render/mediaOverlayPool'
import type { GraphNode } from '@/lib/graph/types'

const MARKER_OUTPUT_URL = 'https://assets.example/native-three-output.png'

function readCanvasSource(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

export function testImageToThreeJsMarkerOutputUsesNativeRichMediaSurface() {
  const markerOutputPanel = {
    id: 'threejs-output-panel',
    type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    label: 'Three.js Rich Media Panel',
    properties: {
      [IMAGE_TO_THREEJS_OUTPUT_PANEL_PROPERTY]: true,
      outputSourceUrl: MARKER_OUTPUT_URL,
      richMediaActiveTab: 'image',
    },
  } as GraphNode

  const media = getNodeMediaSpec(markerOutputPanel)
  if (
    media?.kind !== 'image'
    || media.url !== MARKER_OUTPUT_URL
    || media.renderMode !== IMAGE_TO_THREEJS_RENDER_MODE
  ) {
    throw new Error(`expected marker output to preserve its native Three.js image spec, got ${JSON.stringify(media)}`)
  }

  const overlay = listMediaOverlayNodes({
    enabled: true,
    nodes: [markerOutputPanel],
    poolMax: 1,
  })[0]
  if (
    overlay?.kind !== 'image'
    || overlay.url !== MARKER_OUTPUT_URL
    || overlay.renderMode !== IMAGE_TO_THREEJS_RENDER_MODE
  ) {
    throw new Error(`expected overlay fallback to retain the Three.js render mode, got ${JSON.stringify(overlay)}`)
  }

  const directSurface = readCanvasSource('../components/RichMediaPanelDirectMediaSurface.tsx')
  const cardMedia = readCanvasSource('../lib/cards/CardMediaPreview.tsx')
  const nativeSurface = readCanvasSource('../features/image-to-threejs/ImageThreeJsSurface.tsx')
  const requiredContracts = [
    [directSurface, 'renderMode={props.renderMode}'],
    [cardMedia, '<ImageThreeJsSurface'],
    [cardMedia, 'data-kg-image-threejs-card-surface="1"'],
    [nativeSurface, 'data-kg-image-threejs-surface="1"'],
    [nativeSurface, 'data-kg-image-threejs-renderer="native-three"'],
    [nativeSurface, 'data-kg-image-threejs-native-badge="1"'],
    [nativeSurface, 'buildRasterReliefGeometry'],
    [nativeSurface, 'new THREE.ExtrudeGeometry'],
  ] as const
  for (const [source, token] of requiredContracts) {
    if (!source.includes(token)) throw new Error(`missing native Three.js Rich Media surface contract: ${token}`)
  }
}
