import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildOverlayTopologyLayoutSignature } from '@/lib/flowEditor/overlayTopologyLayoutSignature'

export const testOverlayTopologyLayoutSignatureReusesSharedNodePropertiesReader = () => {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'flowEditor', 'overlayTopologyLayoutSignature.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { readNodeProperties } from '@/lib/graph/nodeProperties'")) {
    throw new Error('expected overlay topology layout signature to reuse the shared node properties reader upstream')
  }
  if (!text.includes('const props = readNodeProperties(node)')) {
    throw new Error('expected overlay topology layout signature to reuse the shared node properties reader for node layout props')
  }
  if (text.includes("const props = (node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)) ? node.properties as Record<string, unknown> : {}")) {
    throw new Error('expected overlay topology layout signature to stop coercing node properties inline')
  }
}

export const testOverlayTopologyLayoutSignatureIncludesVisualLayoutProps = () => {
  const signature = buildOverlayTopologyLayoutSignature({
    type: 'GraphData',
    nodes: [
      {
        id: 'overlay:node-a',
        type: 'Widget',
        properties: {
          'visual:width': 120,
          'visual:height': 80,
          'visual:minWidth': 60,
          'visual:minHeight': 40,
          'visual:zIndex': '5',
          'flow:widgetFormId': 'demo-form',
        },
      },
    ],
    edges: [],
  } as never)
  const changedSignature = buildOverlayTopologyLayoutSignature({
    type: 'GraphData',
    nodes: [
      {
        id: 'overlay:node-a',
        type: 'Widget',
        properties: {
          'visual:width': 121,
          'visual:height': 80,
          'visual:minWidth': 60,
          'visual:minHeight': 40,
          'visual:zIndex': '5',
          'flow:widgetFormId': 'demo-form',
        },
      },
    ],
    edges: [],
  } as never)
  if (!signature || !changedSignature) throw new Error('expected overlay topology layout signatures to be produced')
  if (signature === changedSignature) {
    throw new Error('expected visual layout property changes to affect the overlay topology layout signature')
  }
}
