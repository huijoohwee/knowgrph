import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyPanelBox, computeContentBoxFromPanelFrame16x9, computePanelFrameSizeFromWidth16x9 } from '@/lib/render/mediaPanelLayout'
import { computeMediaOverlaySizing } from '@/lib/render/mediaOverlaySizing'

export function testRichMediaPanelUsesSectionBodyResizeHandleSsot() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPanel.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('<article\n          data-kg-widget-body="1"')) {
    throw new Error('expected Rich Media Panel widget body SSOT to forbid article render surfaces')
  }
  if (!text.includes('<section\n          data-kg-widget-body="1"')) {
    throw new Error('expected Rich Media Panel widget body SSOT to use a semantic section render surface')
  }
  if (!text.includes('data-kg-rich-media-render-surface="1"')) {
    throw new Error('expected Rich Media Panel widget body to expose a dedicated render-surface marker')
  }
  if (!text.includes('data-kg-resize-handle="se"')) {
    throw new Error('expected Rich Media Panel widget body to render a bottom-right resize handle using data-kg-resize-handle="se"')
  }
}

export function testSharedRichMediaPanelUsesBodySectionAsResizeSurfaceSsot() {
  const p = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("'kg-mediaBody'")) {
    throw new Error('expected shared Rich Media Panel to keep a dedicated body section render surface')
  }
  if (!text.includes('data-kg-rich-media-render-surface="1"')) {
    throw new Error('expected shared Rich Media Panel body section to expose a dedicated semantic render-surface marker')
  }
  if (!text.includes("position: 'relative'")) {
    throw new Error('expected shared Rich Media Panel body section to establish the resize-anchor containing block')
  }
  if (text.includes('{showPanelMarkdownPreview ? (\n          <div') || text.includes(') : isEmptyPanel ? (\n          <div') || text.includes(') : panelIsLoading ? (\n          <div')) {
    throw new Error('expected shared Rich Media Panel body render states to forbid generic div surfaces')
  }
  const bodyStart = text.indexOf("'kg-mediaBody'")
  const resizeHandle = text.indexOf('data-kg-resize-handle="se"')
  const renderSurfaceStart = text.indexOf('const renderSurfaceChildren = (')
  if (bodyStart < 0 || resizeHandle < 0 || renderSurfaceStart < 0) {
    throw new Error('expected shared Rich Media Panel to define body section, shared render-surface fragment, and resize handle markup')
  }
  if (!(renderSurfaceStart < resizeHandle)) {
    throw new Error('expected shared Rich Media Panel resize handle to live inside the shared body render-surface fragment')
  }
  if (text.includes('showHeader?: boolean') || text.includes('data-kg-media-panel-header="1"')) {
    throw new Error('expected shared Rich Media Panel to remove the legacy headered variant while using the current Flow Editor chrome contract')
  }
  if (
    !text.includes("panelChrome?: 'none' | 'flowEditor'")
    || !text.includes("from '@/components/FlowEditor/FlowEditorPanelChrome'")
    || !text.includes('data-kg-rich-media-flow-editor-body="1"')
  ) {
    throw new Error('expected shared Rich Media Panel to expose reusable Flow Editor chrome without resurrecting the legacy header contract')
  }
  if (!text.includes('getFlowEditorPanelChromeClassName(uiPanelTextFontClass)')) {
    throw new Error('expected shared Rich Media Panel root to reuse Flow Editor panel shell classes for optional chrome')
  }
}

export function testRichMediaPanelFlowEditorChromeMaintainsContentAspectAcrossZoom() {
  const aspect = 16 / 9
  const zoomSamples = [0.55, 1, 1.85]
  for (const zoomK of zoomSamples) {
    const sizing = computeMediaOverlaySizing({
      density: 'default',
      viewportW: 1280,
      viewportH: 720,
      zoomK,
      itemCount: 3,
      config: { widthRatio: 0.22, widthMinPx: 220, widthMaxPx: 360, quantizeStepPx: 1 },
    })
    const content = computeContentBoxFromPanelFrame16x9({
      panelW: sizing.panelW,
      panelH: sizing.panelH,
      metrics: sizing.metrics,
    })
    if (Math.abs(content.aspect - aspect) > 0.0001) {
      throw new Error(`expected rich media content aspect to stay 16:9 at zoom=${zoomK}, got ${content.aspect}`)
    }
    const reconstructed = computePanelFrameSizeFromWidth16x9({
      panelW: sizing.panelW,
      metrics: sizing.metrics,
    })
    if (Math.abs(reconstructed.panelH - sizing.panelH) > 0.0001) {
      throw new Error(`expected panel frame height to reconstruct from width and chrome metrics at zoom=${zoomK}, got ${reconstructed.panelH} vs ${sizing.panelH}`)
    }
  }

  const chromePanelEl = {
    style: {},
    getAttribute: (name: string) => {
      if (name === 'data-kg-rich-media-flow-editor-chrome') return '1'
      if (name === 'data-kg-rich-media-panel') return '1'
      return null
    },
  } as unknown as HTMLElement
  applyPanelBox(chromePanelEl, { left: 0, top: 0, w: 226, h: 163, display: 'block' })
  if (chromePanelEl.style.display !== 'flex') {
    throw new Error(`expected imperative overlay sizing to preserve Flow Editor rich-media flex frame, got display=${chromePanelEl.style.display}`)
  }

  const chromePath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'FlowEditorPanelChrome.tsx')
  const chromeText = readFileSync(chromePath, 'utf8')
  for (const snippet of [
    "height: 'var(--kg-media-panel-header-h, 28px)'",
    "flex: '0 0 var(--kg-media-panel-header-h, 28px)'",
    "fontSize: 'var(--kg-media-panel-title-size, 12px)'",
    'richMediaActionStyle',
    'richMediaIconStyle',
  ]) {
    if (!chromeText.includes(snippet)) {
      throw new Error(`expected Flow Editor rich-media chrome header to bind layout to shared media-panel sizing variable: ${snippet}`)
    }
  }

  const flowCanvasOverlayPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const flowCanvasOverlayText = readFileSync(flowCanvasOverlayPath, 'utf8')
  for (const snippet of [
    'readRichMediaPanelFrameMetrics',
    'computePanelFrameSizeFromWidth16x9',
    '--kg-media-panel-header-h',
    '--kg-media-panel-padding',
    '--kg-media-panel-border-w',
  ]) {
    if (!flowCanvasOverlayText.includes(snippet)) {
      throw new Error(`expected Flow Canvas rich-media resize math to preserve chrome/content aspect using shared frame metrics: ${snippet}`)
    }
  }
}

export function testSharedRichMediaPanelUsesNativeSkeletonLoadingSsot() {
  const p = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('CardMediaLoadingSkeleton')) {
    throw new Error('expected shared Rich Media Panel to reuse the shared CardMediaLoadingSkeleton owner')
  }
  if (text.includes('function RichMediaLoadingSkeleton(') || text.includes('kgRichMediaSkeletonShimmer')) {
    throw new Error('expected shared Rich Media Panel to avoid duplicate local loading skeleton implementations')
  }
  if (!text.includes('richMediaDataAttrs')) {
    throw new Error('expected shared Rich Media Panel to request rich-media data attributes from shared card surfaces')
  }
  if (!text.includes('<CardMediaLoadingSkeleton')) {
    throw new Error('expected shared Rich Media Panel loading branch to reuse the shared Card skeleton component')
  }
  if (!text.includes("transition: 'opacity 180ms ease-out'")) {
    throw new Error('expected shared Rich Media Panel surface to fade into revealed content after loading')
  }
  if (!text.includes('const shouldHideSurfaceUntilReady = hideUntilReady && !ready && !isEmptyPanel && !panelIsLoading')) {
    throw new Error('expected shared Rich Media Panel to keep loading skeletons visible even when media-ready gating is active')
  }
  const loadingBranchIndex = text.indexOf(') : panelIsLoading ? (')
  const emptyBranchIndex = text.indexOf(') : isEmptyPanel ? (')
  if (loadingBranchIndex < 0 || emptyBranchIndex < 0 || loadingBranchIndex > emptyBranchIndex) {
    throw new Error('expected shared Rich Media Panel to render loading skeleton before empty placeholder so progress remains visible')
  }
}

export function testSharedRichMediaPanelUsesNativeEmptyCardPlaceholderSsot() {
  const p = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('CardMediaEmptyPlaceholder')) {
    throw new Error('expected shared Rich Media Panel to reuse the shared CardMediaEmptyPlaceholder owner')
  }
  if (text.includes('function RichMediaEmptyCardPlaceholder({')) {
    throw new Error('expected shared Rich Media Panel to avoid duplicate local empty-card placeholder implementations')
  }
  if (!text.includes('richMediaDataAttrs')) {
    throw new Error('expected shared Rich Media Panel to request rich-media data attributes from shared empty card surfaces')
  }
  if (!text.includes('const expectedEmptyPlaceholderVariant: CardMediaPlaceholderVariant =')) {
    throw new Error('expected shared Rich Media Panel to compute an expected target-mode variant for the empty card placeholder')
  }
  if (!text.includes('<CardMediaEmptyPlaceholder variant={expectedEmptyPlaceholderVariant} richMediaDataAttrs />')) {
    throw new Error('expected shared Rich Media Panel no-content branch to reuse the shared mode-aware empty card placeholder')
  }
  if (!text.includes('const shouldHideSurfaceUntilReady = hideUntilReady && !ready && !isEmptyPanel && !panelIsLoading')) {
    throw new Error('expected shared Rich Media Panel to keep empty card placeholders visible even when media-ready gating is active')
  }
  if (text.includes('Connect media to render')) {
    throw new Error('expected shared Rich Media Panel to remove the legacy plain-text empty state')
  }
}

export function testFlowEditorOverlayProxyTreatsRichMediaResizeHandleAsProtectedHandle() {
  const p = resolve(process.cwd(), 'src', 'lib', 'canvas', 'flow-editor-overlay-proxy.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('[data-kg-resize-handle]')) {
    throw new Error('expected Flow Editor overlay proxy drag-handle selector to include RichMediaPanel resize handles so window-capture proxy pan cannot steal resize drags')
  }
}
