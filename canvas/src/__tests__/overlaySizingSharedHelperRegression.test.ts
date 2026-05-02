import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { readOverlaySizingInputFromStoreState } from '@/lib/render/overlaySizing2d'

export function testOverlaySizingHelperIsReusedAcrossCanvasAndOverlayPaths() {
  const helperPath = resolve(process.cwd(), 'src', 'lib', 'render', 'overlaySizing2d.ts')
  const halfExtentsPath = resolve(process.cwd(), 'src', 'lib', 'render', 'overlayHalfExtentsByNodeId2d.ts')
  const richMediaPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useRichMediaOverlays2d.ts')
  const flowLayoutPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasLayoutState.ts')
  const markdownOverlayPath = resolve(process.cwd(), 'src', 'lib', 'markdown-edgeless', 'MarkdownDesignOverlay.impl.tsx')
  const d3PresentationPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3PresentationUpdates2d.ts')

  const helperText = readFileSync(helperPath, 'utf8')
  const halfExtentsText = readFileSync(halfExtentsPath, 'utf8')
  const richMediaText = readFileSync(richMediaPath, 'utf8')
  const flowLayoutText = readFileSync(flowLayoutPath, 'utf8')
  const markdownOverlayText = readFileSync(markdownOverlayPath, 'utf8')
  const d3PresentationText = readFileSync(d3PresentationPath, 'utf8')

  if (!helperText.includes('export function readOverlaySizingConfigForDensity')) {
    throw new Error('expected shared overlay sizing helper to be defined upstream')
  }
  if (!halfExtentsText.includes('const overlayCfg = readOverlaySizingConfigForDensity({ density, sizing: args.overlaySizing || null })')) {
    throw new Error('expected overlay half-extents derivation to reuse the shared overlay sizing helper')
  }
  if (!richMediaText.includes('const sizingConfig = readOverlaySizingConfigForDensity({')) {
    throw new Error('expected GraphCanvasRoot rich media overlays to reuse the shared overlay sizing helper')
  }
  if (!flowLayoutText.includes('const sizingConfig = readOverlaySizingConfigForDensity({')) {
    throw new Error('expected Flow canvas layout state to reuse the shared overlay sizing helper')
  }
  if (!markdownOverlayText.includes('return readOverlaySizingConfigForDensity({ density, sizing: st })')) {
    throw new Error('expected markdown design overlay to reuse the shared overlay sizing helper')
  }
  if (!d3PresentationText.includes('overlaySizing: useGraphStore.getState(),')) {
    throw new Error('expected D3 presentation updates to pass shared store sizing state directly into the shared overlay sizing pipeline')
  }
}

export function testOverlaySizingInputFromStoreStateKeepsStableReferencesForEqualValues() {
  const first = readOverlaySizingInputFromStoreState({
    threeIframeOverlayBaseWidthRatioDefault: 0.25,
    threeIframeOverlayBaseWidthRatioCompact: 0.2,
    threeIframeOverlayBaseWidthMinPxDefault: 220,
    threeIframeOverlayBaseWidthMinPxCompact: 180,
    threeIframeOverlayBaseWidthMaxPxDefault: 420,
    threeIframeOverlayBaseWidthMaxPxCompact: 300,
  })
  const second = readOverlaySizingInputFromStoreState({
    threeIframeOverlayBaseWidthRatioDefault: 0.25,
    threeIframeOverlayBaseWidthRatioCompact: 0.2,
    threeIframeOverlayBaseWidthMinPxDefault: 220,
    threeIframeOverlayBaseWidthMinPxCompact: 180,
    threeIframeOverlayBaseWidthMaxPxDefault: 420,
    threeIframeOverlayBaseWidthMaxPxCompact: 300,
  })
  if (first !== second) {
    throw new Error('expected shared overlay sizing input helper to reuse the previous snapshot for unchanged values')
  }

  const emptyFirst = readOverlaySizingInputFromStoreState(null)
  const emptySecond = readOverlaySizingInputFromStoreState({})
  if (emptyFirst !== emptySecond) {
    throw new Error('expected shared overlay sizing input helper to reuse the same empty snapshot for missing values')
  }

  const changed = readOverlaySizingInputFromStoreState({
    threeIframeOverlayBaseWidthRatioDefault: 0.3,
    threeIframeOverlayBaseWidthRatioCompact: 0.2,
    threeIframeOverlayBaseWidthMinPxDefault: 220,
    threeIframeOverlayBaseWidthMinPxCompact: 180,
    threeIframeOverlayBaseWidthMaxPxDefault: 420,
    threeIframeOverlayBaseWidthMaxPxCompact: 300,
  })
  if (changed === first) {
    throw new Error('expected shared overlay sizing input helper to publish a new snapshot when sizing values change')
  }
}
