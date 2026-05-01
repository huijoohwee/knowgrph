import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
  if (!text.includes('className="kg-mediaBody"')) {
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
  const bodyStart = text.indexOf('className="kg-mediaBody"')
  const resizeHandle = text.indexOf('data-kg-resize-handle="se"')
  const renderSurfaceStart = text.indexOf('const renderSurfaceChildren = (')
  if (bodyStart < 0 || resizeHandle < 0 || renderSurfaceStart < 0) {
    throw new Error('expected shared Rich Media Panel to define body section, shared render-surface fragment, and resize handle markup')
  }
  if (!(renderSurfaceStart < resizeHandle)) {
    throw new Error('expected shared Rich Media Panel resize handle to live inside the shared body render-surface fragment')
  }
  if (!text.includes("if (!showHeader) {")) {
    throw new Error('expected shared Rich Media Panel to flatten the headerless path into a single body render surface')
  }
  if (!text.includes("className={['kg-media', 'kg-mediaBody', props.className].filter(Boolean).join(' ')}")) {
    throw new Error('expected headerless Rich Media Panel path to reuse the body section as the root render surface')
  }
}

export function testSharedRichMediaPanelUsesNativeSkeletonLoadingSsot() {
  const p = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('function RichMediaLoadingSkeleton(')) {
    throw new Error('expected shared Rich Media Panel to define one native loading skeleton component upstream')
  }
  if (!text.includes('kgRichMediaSkeletonShimmer')) {
    throw new Error('expected shared Rich Media Panel to define a native shimmer animation for loading placeholders')
  }
  if (!text.includes('data-kg-rich-media-loading-surface="1"')) {
    throw new Error('expected shared Rich Media Panel loading state to expose a dedicated loading surface marker')
  }
  if (!text.includes('<RichMediaLoadingSkeleton')) {
    throw new Error('expected shared Rich Media Panel loading branch to reuse the shared skeleton component')
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
  if (!text.includes('function RichMediaEmptyCardPlaceholder({')) {
    throw new Error('expected shared Rich Media Panel to define one native mode-aware empty card placeholder upstream')
  }
  if (!text.includes('data-kg-rich-media-empty-card-placeholder="1"')) {
    throw new Error('expected shared Rich Media Panel empty state to expose a dedicated card placeholder marker')
  }
  if (!text.includes('data-kg-rich-media-empty-card-variant={variant}')) {
    throw new Error('expected shared Rich Media Panel empty card placeholder to expose its expected target-mode variant')
  }
  if (!text.includes('const expectedEmptyPlaceholderVariant: RichMediaPlaceholderMode =')) {
    throw new Error('expected shared Rich Media Panel to compute an expected target-mode variant for the empty card placeholder')
  }
  if (!text.includes('<RichMediaEmptyCardPlaceholder variant={expectedEmptyPlaceholderVariant} />')) {
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
