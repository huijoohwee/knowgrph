import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  applyPanelBox,
  computeContentBoxFromPanelFrame16x9,
  computePanelFrameResizeFromDrag16x9,
  computePanelFrameSizeFromDensityWidth16x9,
  computePanelFrameSizeFromWidth16x9,
} from '@/lib/render/mediaPanelLayout'
import { computeMediaOverlaySizing } from '@/lib/render/mediaOverlaySizing'
import {
  coerceRichMediaPanelSizePx,
  computeRichMediaPanelAspectResizeSizePx,
  RICH_MEDIA_PANEL_FRAME_ASPECT,
  RICH_MEDIA_PANEL_PORTRAIT_FRAME_ASPECT,
} from '@/lib/render/richMediaSsot'

function readRichMediaPanelSourceBundle(): string {
  const root = resolve(process.cwd(), 'src', 'components')
  const files = [
    'RichMediaPanel.tsx',
    'RichMediaPanel.types.ts',
    'RichMediaPanelSurface.tsx',
    'RichMediaPanelShell.tsx',
    'RichMediaPanelContentStack.tsx',
    'RichMediaPanelTextSurface.tsx',
    'RichMediaPanelIframeSurface.tsx',
    'RichMediaPanelDirectMediaSurface.tsx',
    'RichMediaPanelResizeHandle.tsx',
    'RichMediaPanelOpenOverlay.tsx',
    'useRichMediaPanelMediaState.ts',
    'useRichMediaPanelSurfaceState.ts',
  ]
  return files.map(file => readFileSync(resolve(root, file), 'utf8')).join('\n')
}

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
  if (!text.includes('<RichMediaPanelResizeHandle placement="panel" onPointerDown={handleRichMediaOuterResizePointerDown} />')) {
    throw new Error('expected Rich Media Panel widget body to render the shared bottom-right resize handle')
  }
}

export function testSharedRichMediaPanelUsesRootFrameAsResizeSurfaceSsot() {
  const surfaceStateText = readFileSync(resolve(process.cwd(), 'src', 'components', 'useRichMediaPanelSurfaceState.ts'), 'utf8')
  const shellText = readFileSync(resolve(process.cwd(), 'src', 'components', 'RichMediaPanelShell.tsx'), 'utf8')
  const typesText = readFileSync(resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.types.ts'), 'utf8')
  if (!surfaceStateText.includes("'kg-mediaBody'")) {
    throw new Error('expected shared Rich Media Panel to keep a dedicated panel frame render surface')
  }
  if (!surfaceStateText.includes("'data-kg-rich-media-render-surface': '1'")) {
    throw new Error('expected shared Rich Media Panel frame to expose a dedicated semantic render-surface marker')
  }
  if (!surfaceStateText.includes("position: useSurfaceFrame || panelOwnsInlineSrcDocScroll ? 'relative' : (flowEditorInteractionMode ? 'absolute' : 'relative')")) {
    throw new Error('expected shared Rich Media Panel root frame to establish the resize-anchor containing block')
  }
  if (!shellText.includes('<RichMediaPanelResizeHandle placement="root" onPointerDown={model.onResizePointerDown} />')) {
    throw new Error('expected shared Rich Media Panel resize handle to stay mounted at the root frame owner')
  }
  if (typesText.includes('showHeader?: boolean') || shellText.includes('data-kg-media-panel-header="1"')) {
    throw new Error('expected shared Rich Media Panel to remove the legacy headered variant while using the current Flow Editor chrome contract')
  }
  if (
    !typesText.includes("panelChrome?: 'none' | 'flowEditor'")
    || !shellText.includes("from '@/components/FlowEditor/FlowEditorPanelChrome'")
    || !shellText.includes('data-kg-rich-media-flow-editor-body="1"')
  ) {
    throw new Error('expected shared Rich Media Panel to expose reusable Flow Editor chrome without resurrecting the legacy header contract')
  }
  if (!surfaceStateText.includes('getFlowEditorPanelChromeClassName(mediaState.uiPanelTextFontClass)')) {
    throw new Error('expected shared Rich Media Panel root to reuse Flow Editor panel shell classes for optional chrome')
  }
  for (const snippet of [
    "flex: '1 1 0%'",
    'minHeight: 0',
    "overflow: 'hidden'",
    "padding: 'var(--kg-media-panel-padding, 6px)'",
  ]) {
    if (!surfaceStateText.includes(snippet)) {
      throw new Error(`expected shared Rich Media Panel chrome body to stay responsive inside the 16:9 frame: ${snippet}`)
    }
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
  const mediaPanelLayoutPath = resolve(process.cwd(), 'src', 'lib', 'render', 'mediaPanelLayout.ts')
  const mediaPanelLayoutText = readFileSync(mediaPanelLayoutPath, 'utf8')
  for (const snippet of [
    'readRichMediaPanelFrameMetrics',
    'computePanelFrameResizeFromDrag16x9',
    'computePanelFrameSizeFromWidth16x9',
  ]) {
    if (!flowCanvasOverlayText.includes(snippet)) {
      throw new Error(`expected Flow Canvas rich-media resize path to reuse shared frame metrics/aspect helpers: ${snippet}`)
    }
  }
  for (const snippet of [
    'readRichMediaPanelFrameMetrics',
    '--kg-media-panel-header-h',
    '--kg-media-panel-padding',
    '--kg-media-panel-border-w',
  ]) {
    if (!mediaPanelLayoutText.includes(snippet)) {
      throw new Error(`expected shared media-panel layout owner to preserve chrome/content aspect using shared frame metrics: ${snippet}`)
    }
  }
}

export function testRichMediaPanelResizeDragMaintainsContentAspectFromSharedMath() {
  const metrics = { headerH: 28, padding: 8, borderW: 1 }
  const startFrame = { panelW: 360, panelH: 401 }
  const startContent = computeContentBoxFromPanelFrame16x9({
    panelW: startFrame.panelW,
    panelH: startFrame.panelH,
    metrics,
  })
  const resizedFromWidth = computePanelFrameResizeFromDrag16x9({
    startW: startFrame.panelW,
    startH: startFrame.panelH,
    dxClientPx: 96,
    dyClientPx: 12,
    scale: 1,
    metrics,
    minPanelW: 24,
    minPanelH: 24,
  })
  const resizedFromHeight = computePanelFrameResizeFromDrag16x9({
    startW: startFrame.panelW,
    startH: startFrame.panelH,
    dxClientPx: 4,
    dyClientPx: 96,
    scale: 1,
    metrics,
    minPanelW: 24,
    minPanelH: 24,
  })
  for (const frame of [resizedFromWidth, resizedFromHeight]) {
    const content = computeContentBoxFromPanelFrame16x9({
      panelW: frame.panelW,
      panelH: frame.panelH,
      metrics,
    })
    if (Math.abs(content.aspect - startContent.aspect) > 0.0001) {
      throw new Error(`expected shared rich-media resize math to preserve starting content aspect ${startContent.aspect}, got ${content.aspect}`)
    }
  }
  if (Math.abs(startContent.aspect - 16 / 9) < 0.05) {
    throw new Error('expected resize regression to exercise a non-16:9 starting aspect')
  }

  const widgetResize = computeRichMediaPanelAspectResizeSizePx({
    startWidth: 360,
    startHeight: 401,
    dx: 90,
    dy: 12,
    targetAspect: RICH_MEDIA_PANEL_FRAME_ASPECT,
  })
  const widgetAspect = widgetResize.width / Math.max(1, widgetResize.height)
  if (Math.abs(widgetAspect - RICH_MEDIA_PANEL_FRAME_ASPECT) > 0.005) {
    throw new Error(`expected Flow Editor widget resize math to normalize stale panel aspect to 16:9, got ${widgetAspect}`)
  }
  const staleWidePanel = coerceRichMediaPanelSizePx({
    width: 965,
    height: 188,
    viewportW: 1253,
    viewportH: 998,
    minWidthPx: 220,
    minHeightPx: 160,
    targetAspect: RICH_MEDIA_PANEL_FRAME_ASPECT,
  })
  const staleWidePanelAspect = staleWidePanel.width / Math.max(1, staleWidePanel.height)
  if (Math.abs(staleWidePanelAspect - RICH_MEDIA_PANEL_FRAME_ASPECT) > 0.005) {
    throw new Error(`expected Flow Editor widget load coercion to repair stale non-16:9 saved dimensions, got ${staleWidePanelAspect}`)
  }
  const portraitResize = computeRichMediaPanelAspectResizeSizePx({
    startWidth: 220,
    startHeight: 391,
    dx: 80,
    dy: 4,
    targetAspect: RICH_MEDIA_PANEL_PORTRAIT_FRAME_ASPECT,
  })
  const portraitAspect = portraitResize.width / Math.max(1, portraitResize.height)
  if (Math.abs(portraitAspect - RICH_MEDIA_PANEL_PORTRAIT_FRAME_ASPECT) > 0.005) {
    throw new Error(`expected Flow Editor widget resize math to preserve 9:16 toolbar-selected aspect, got ${portraitAspect}`)
  }

  const flowEditorHookPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useRichMediaWidgetPreview.ts')
  const flowEditorHookText = readFileSync(flowEditorHookPath, 'utf8')
  if (!flowEditorHookText.includes('computeRichMediaPanelAspectResizeSizePx')) {
    throw new Error('expected Flow Editor Rich Media Panel resize to reuse shared aspect-preserving resize math')
  }
  for (const snippet of [
    'const richMediaPanelViewSizeRef = React.useRef(richMediaPanelBaseSize)',
    'resolveRichMediaAspectSelection',
    'resolveRichMediaAspectRatioValue',
    'const richMediaPanelTargetAspect = React.useMemo',
    'targetAspect: richMediaPanelTargetAspect',
    'richMediaPanelViewSizeRef.current = nextSize',
    'const latestSize = richMediaPanelViewSizeRef.current',
    'width: latestSize.width',
    'height: latestSize.height',
  ]) {
    if (!flowEditorHookText.includes(snippet)) {
      throw new Error(`expected Flow Editor Rich Media Panel resize end to commit latest drag size without stale React state: ${snippet}`)
    }
  }
  if (flowEditorHookText.includes('richMediaPanelResizeStartRef.current.width + args0.dx') || flowEditorHookText.includes('richMediaPanelResizeStartRef.current.height + args0.dy')) {
    throw new Error('expected Flow Editor Rich Media Panel resize to avoid independent width/height delta resizing')
  }
  const flowEditorViewPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorView.tsx')
  const flowEditorViewText = readFileSync(flowEditorViewPath, 'utf8')
  if (flowEditorViewText.includes('readRichMediaPanelFrameWidthPx') || flowEditorViewText.includes('richMediaPanelFrameWidthPx')) {
    throw new Error('expected Flow Editor Rich Media Panel wrapper to avoid duplicate width ownership outside the panel frame')
  }
  const flowEditorPanelPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPanel.tsx')
  const flowEditorPanelText = readFileSync(flowEditorPanelPath, 'utf8')
  for (const snippet of [
    'width: showRichMediaPanelBody ? `${richMediaPanelViewSize.width}px` : undefined',
    'height: minimized ? undefined : (showRichMediaPanelBody ? `${richMediaPanelViewSize.height}px` : WIDGET_BASE_SIZE.height)',
    'opacity: showRichMediaPanelBody ? 1 : (Number.isFinite(uiPanelOpacity) ? uiPanelOpacity : 1)',
    "width: '100%'",
    "flex: '1 1 0%'",
    "pointerEvents: 'auto'",
    'srcDoc={richMediaPreview?.srcDoc}',
    'style={PANEL_FRAME_EMBEDDED_SURFACE_STYLE}',
  ]) {
    if (!flowEditorPanelText.includes(snippet)) {
      throw new Error(`expected Flow Editor Rich Media Panel outer frame to own selected-aspect resize dimensions: ${snippet}`)
    }
  }
  if (flowEditorPanelText.includes('richMediaPreviewPassThrough')) {
    throw new Error('expected Flow Editor Rich Media Panel media surface to remain selectable instead of passing pointer events through the body')
  }
  if (flowEditorPanelText.includes("height: `${richMediaPanelViewSize.height}px`")) {
    throw new Error('expected Flow Editor Rich Media Panel body to avoid owning the fixed resize height')
  }
  const placementRuntimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayPlacementRuntime.ts')
  const placementRuntimeText = readFileSync(placementRuntimePath, 'utf8')
  const richMediaPanelText = readRichMediaPanelSourceBundle()
  const mediaSurfaceSelectionPath = resolve(process.cwd(), 'src', 'lib', 'cards', 'mediaPreviewSurfaceSelection.ts')
  const mediaSurfaceSelectionText = readFileSync(mediaSurfaceSelectionPath, 'utf8')
  for (const snippet of [
    "position: useSurfaceFrame || panelOwnsInlineSrcDocScroll ? 'relative' : (flowEditorInteractionMode ? 'absolute' : 'relative')",
    "'data-kg-rich-media-frame-mode': useSurfaceFrame ? 'surface' : undefined",
    'interactive={false}',
    'const directMediaPreviewSelectionProps = React.useMemo',
    'const directMediaPreviewCardProps = React.useMemo',
    'resolveMediaPreviewSurfaceSelectionProps({',
    'resolveMediaPreviewSurfaceCardProps({',
    'frameSelectionProps={model.directMediaPreviewSelectionProps}',
    '{...model.directMediaPreviewCardProps}',
    'pointerTarget.isSelectableSurface',
    'selectSelf(nativePointerEvent || null)',
    'data-kg-rich-media-video-srcdoc-fallback="1"',
    'className="relative h-full w-full overflow-hidden"',
    'model.directVideoFallbackSrcDoc',
    'transparentBackground',
    "videoMuted={model.kind === 'video' ? true : undefined}",
    "videoAutoPlay={model.kind === 'video' ? true : undefined}",
    "videoLoop={model.kind === 'video' ? true : undefined}",
  ]) {
    if (!richMediaPanelText.includes(snippet)) {
      throw new Error(`expected embedded Rich Media Panel surface to remain inside Flow Editor panel stacking: ${snippet}`)
    }
  }
  if (richMediaPanelText.includes('className="relative z-10 h-full w-full overflow-hidden"') || richMediaPanelText.includes("position: 'relative', zIndex: 1")) {
    throw new Error('expected embedded Rich Media Panel media preview to share normal form stacking instead of creating an elevated preview layer')
  }
  if (!mediaSurfaceSelectionText.includes("MEDIA_PREVIEW_SELECTABLE_SURFACE_ATTR = 'data-kg-rich-media-selectable-surface'")
    || !mediaSurfaceSelectionText.includes("MEDIA_PREVIEW_SELECTABLE_SURFACE_VALUE = '1'")
    || !mediaSurfaceSelectionText.includes('resolveMediaPreviewSurfaceSelectionProps')
    || !mediaSurfaceSelectionText.includes('resolveMediaPreviewSurfaceCardProps')
    || !mediaSurfaceSelectionText.includes('interactive: args.enabled ? false : args.interactive === true')
    || !mediaSurfaceSelectionText.includes('const claimSurfaceEvent = (event: MediaPreviewSurfaceSelectionEvent) => {')
    || !mediaSurfaceSelectionText.includes('onPointerDownCapture: claimSurfaceEvent')
    || !mediaSurfaceSelectionText.includes('onMouseDownCapture: claimSurfaceEvent')
    || !mediaSurfaceSelectionText.includes('onClickCapture: claimSurfaceClick')
    || !mediaSurfaceSelectionText.includes('event.preventDefault()')
    || !mediaSurfaceSelectionText.includes('event.stopPropagation()')) {
    throw new Error('expected embedded Rich Media media preview selection event ownership to live in the shared media preview surface helper')
  }
  if (mediaSurfaceSelectionText.includes('data-kg-canvas-overlay-control="true"')) {
    throw new Error('expected embedded Rich Media Panel media preview selection to avoid canvas overlay-control elevation')
  }
  const zoomPanViewportPath = resolve(process.cwd(), 'src', 'features', 'panels', 'views', 'preview-panel', 'ui', 'ZoomPanViewport.tsx')
  const zoomPanViewportText = readFileSync(zoomPanViewportPath, 'utf8')
  for (const snippet of [
    'transparentBackground?: boolean',
    "transparentBackground ? 'bg-transparent' : UI_THEME_TOKENS.panel.bg",
    'frameSelectionProps?: MediaPreviewSurfaceSelectionProps',
    'const shouldStartPanDrag = React.useCallback',
    'const applyPanDragMove = React.useCallback',
    'const endPanDrag = React.useCallback',
    'onPointerDownCapture={(e) => {',
    "down.pointerType === 'mouse' && down.button === 2",
    'onPointerMoveCapture={(e) => {',
    'onPointerUpCapture={endPanDrag}',
    'onPointerCancelCapture={endPanDrag}',
    '{...frameSelectionProps}',
    "frameSelectionProps?.[MEDIA_PREVIEW_SELECTABLE_SURFACE_ATTR]",
    'data-kg-rich-media-selectable-surface={selectableSurfaceDataAttr}',
  ]) {
    if (!zoomPanViewportText.includes(snippet)) {
      throw new Error(`expected embedded Rich Media media surface to avoid panel-background gutters: ${snippet}`)
    }
  }
  if (richMediaPanelText.includes('data-kg-rich-media-zoom-pan-viewport="1"\n          {...directMediaPreviewSelectionProps}')) {
    throw new Error('expected expanded Rich Media selectable surface props on the inner media frame, not the outer body-sized viewport')
  }
  for (const snippet of [
    'readRichMediaOverlayFrameSize',
    'FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID',
    'resolveRichMediaAspectSelection',
    'resolveRichMediaAspectRatioValue',
    'coerceRichMediaPanelSizePx',
    "Number(props['visual:width'])",
    "Number(props['visual:height'])",
    'const richMediaFrameSize = readRichMediaOverlayFrameSize',
    'if (el.style.width !== nextFrameWidth) el.style.width = nextFrameWidth',
    'if (el.style.height !== nextFrameHeight) el.style.height = nextFrameHeight',
  ]) {
    if (!placementRuntimeText.includes(snippet)) {
      throw new Error(`expected Flow Editor placement runtime to align Rich Media wrapper geometry with the selected-aspect panel frame: ${snippet}`)
    }
  }
}

export function testMarkdownDesignRichMediaPanelsReuseSharedAspectFrameSizing() {
  const mediaPanelLayoutPath = resolve(process.cwd(), 'src', 'lib', 'render', 'mediaPanelLayout.ts')
  const mediaPanelLayoutText = readFileSync(mediaPanelLayoutPath, 'utf8')
  if (!mediaPanelLayoutText.includes('export function computePanelFrameSizeFromDensityWidth16x9')) {
    throw new Error('expected shared media-panel layout owner to expose density-aware 16:9 frame sizing')
  }

  const frame = computePanelFrameSizeFromDensityWidth16x9({ density: 'default', panelW: 520 })
  const content = computeContentBoxFromPanelFrame16x9({
    panelW: frame.panelW,
    panelH: frame.panelH,
    metrics: frame.metrics,
  })
  if (Math.abs(content.aspect - 16 / 9) > 0.0001) {
    throw new Error(`expected density-aware markdown rich-media frame sizing to preserve 16:9 content aspect, got ${content.aspect}`)
  }

  const markdownOverlayPath = resolve(process.cwd(), 'src', 'lib', 'markdown-edgeless', 'MarkdownDesignOverlay.impl.tsx')
  const markdownOverlayText = readFileSync(markdownOverlayPath, 'utf8')
  for (const snippet of [
    'computePanelFrameSizeFromDensityWidth16x9',
    'resolveMarkdownPanelBlockAspectSize',
    'const panelSize = resolveMarkdownPanelBlockAspectSize(b, getDensity())',
    'b.x + panelSize.w / 2',
    'b.y + panelSize.h / 2',
  ]) {
    if (!markdownOverlayText.includes(snippet)) {
      throw new Error(`expected Markdown Design rich-media panels to reuse shared 16:9 aspect frame sizing: ${snippet}`)
    }
  }
}

export function testRichMediaPanelResizeWiredAcross2dRendererOwners() {
  const files = [
    {
      label: 'D3 Graph',
      path: resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'components', 'RichMediaOverlayLayer2d.tsx'),
    },
    {
      label: 'Design',
      path: resolve(process.cwd(), 'src', 'components', 'DesignCanvas', 'MediaOverlay.tsx'),
    },
    {
      label: 'Design Markdown Overlay',
      path: resolve(process.cwd(), 'src', 'lib', 'markdown-edgeless', 'MarkdownDesignOverlay.impl.tsx'),
    },
    {
      label: 'Flow Canvas',
      path: resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx'),
    },
  ]
  for (const file of files) {
    const text = readFileSync(file.path, 'utf8')
    for (const snippet of [
      'computePanelFrameResizeFromDrag16x9',
      'readRichMediaPanelFrameMetrics',
      'resizable=',
      'onResizeStart=',
      'onResize=',
      'onResizeEnd=',
    ]) {
      if (!text.includes(snippet)) {
        throw new Error(`expected ${file.label} rich-media overlay to wire shared aspect-preserving resize behavior: ${snippet}`)
      }
    }
    const persistsGraphSize = text.includes("'visual:width'") && text.includes("'visual:height'")
    const persistsMarkdownSize = text.includes('patchMarkdownDesignLayoutRects')
    if (!persistsGraphSize && !persistsMarkdownSize) {
      throw new Error(`expected ${file.label} rich-media overlay to persist resized panel dimensions through its renderer owner`)
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
