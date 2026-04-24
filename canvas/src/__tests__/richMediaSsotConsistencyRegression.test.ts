import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  listDisplayRichMediaOverlayNodes,
  normalizeRichMediaPanelDensity,
  readRichMediaDisplayMode,
  resolveRichMediaPanelInteractive,
} from '@/lib/render/richMediaSsot'

export function testRichMediaSsotConsistencyRegression() {
  if (readRichMediaDisplayMode(false) !== 'circle-only') {
    throw new Error('expected Rich Media display mode SSOT to map false to circle-only')
  }
  if (readRichMediaDisplayMode(true) !== 'panel-only') {
    throw new Error('expected Rich Media display mode SSOT to map true to panel-only')
  }
  if (normalizeRichMediaPanelDensity('compact') !== 'compact') {
    throw new Error('expected Rich Media panel density SSOT to preserve compact mode')
  }
  if (normalizeRichMediaPanelDensity('anything-else') !== 'default') {
    throw new Error('expected Rich Media panel density SSOT to clamp unknown values to default')
  }
  if (resolveRichMediaPanelInteractive({ nodeInteractive: false, renderMediaAsNodes: false, infiniteCanvasInteractionMode: 'interactive' }) !== true) {
    throw new Error('expected interactive canvas mode to force Rich Media interactivity across renderers')
  }
  if (resolveRichMediaPanelInteractive({ nodeInteractive: true, renderMediaAsNodes: true, infiniteCanvasInteractionMode: 'static' }) !== true) {
    throw new Error('expected panel-only Rich Media mode to preserve interactive media nodes')
  }
  if (resolveRichMediaPanelInteractive({ nodeInteractive: true, renderMediaAsNodes: false, infiniteCanvasInteractionMode: 'static' }) !== false) {
    throw new Error('expected circle-only Rich Media mode to disable overlay interaction')
  }

  const imageNode = {
    id: 'img-1',
    type: 'image',
    properties: { imageUrl: 'https://example.com/demo.png' },
  } as any
  if (listDisplayRichMediaOverlayNodes({ renderMediaAsNodes: false, nodes: [imageNode], poolMax: 24 }).length !== 0) {
    throw new Error('expected Rich Media overlay pool SSOT to disable overlays when display toggle is off')
  }
  if (listDisplayRichMediaOverlayNodes({ renderMediaAsNodes: true, nodes: [imageNode], poolMax: 24 }).length !== 1) {
    throw new Error('expected Rich Media overlay pool SSOT to enable overlays when display toggle is on')
  }

  const flowCanvasText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx'), 'utf8')
  const d3HookText = readFileSync(resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useRichMediaOverlays2d.ts'), 'utf8')
  const d3LayerText = readFileSync(resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'components', 'RichMediaOverlayLayer2d.tsx'), 'utf8')
  const designText = readFileSync(resolve(process.cwd(), 'src', 'components', 'DesignCanvas.tsx'), 'utf8')
  const threeText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'three', 'ThreeGraph.impl.tsx'), 'utf8')

  if (!flowCanvasText.includes('listDisplayRichMediaOverlayNodes') || !flowCanvasText.includes('commitRichMediaPanelChange') || !flowCanvasText.includes('resolveRichMediaPanelInteractive')) {
    throw new Error('expected FlowCanvas to reuse upstream Rich Media SSOT helpers for overlay enablement, writeback, and interactivity')
  }
  if (!d3HookText.includes('listDisplayRichMediaOverlayNodes')) {
    throw new Error('expected D3 rich media overlay hook to reuse upstream Rich Media overlay enablement SSOT')
  }
  if (!d3LayerText.includes('commitRichMediaPanelChange') || !d3LayerText.includes('resolveRichMediaPanelInteractive')) {
    throw new Error('expected D3 rich media overlay layer to reuse upstream Rich Media panel writeback and interactivity SSOT')
  }
  if (!designText.includes('listDisplayRichMediaOverlayNodes')) {
    throw new Error('expected Design canvas to reuse upstream Rich Media overlay enablement SSOT')
  }
  if (!threeText.includes('listDisplayRichMediaOverlayNodes') || !threeText.includes('resolveRichMediaPanelInteractive')) {
    throw new Error('expected 3D rich media overlays to reuse upstream Rich Media SSOT helpers')
  }
}
