import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

export function testPassiveSourceFileSwitchesDoNotRetargetCanvasMarkdownRenderContext() {
  const helperText = readSource('src/features/canvas/useCanvasAppliedMarkdownDocument.ts')
  const graphRootText = readSource('src/components/GraphCanvasRoot/GraphCanvasRootImpl.tsx')
  const viewportText = readSource('src/components/CanvasViewportGeospatialOverlay.tsx')
  const designText = readSource('src/components/DesignCanvas.tsx')
  const flowCanvasText = readSource('src/components/FlowCanvas/useFlowCanvasStoreState.ts')
  const flowchartText = readSource('src/lib/flowchart/apiGraphFlowchart.impl.ts')
  const threeGraphText = readSource('src/lib/three/ThreeGraph.impl.tsx')
  const storyboardWidgetText = readSource('src/components/StoryboardWidgetCanvas.runtime.tsx')
  const flowStoreText = readSource('src/components/StoryboardWidgetCanvas/runtime/useStoryboardWidgetRuntimeStoreState.ts')
  const widgetScopeText = readSource('src/lib/storyboardWidget/widgetStateScope.ts')

  if (!helperText.includes("buildScopedGraphSemanticKey('canvas-applied-markdown-document'")) {
    throw new Error('expected Canvas markdown render context to reuse the shared scoped semantic-key helper')
  }
  if (!helperText.includes('if (args.applyViewPreset !== false)')) {
    throw new Error('expected Canvas markdown render context to advance only on explicit Canvas/apply payloads')
  }
  if (!graphRootText.includes('const canvasMarkdownDocument = useCanvasAppliedMarkdownDocument({')) {
    throw new Error('expected 2D graph root overlays to read the applied markdown render context')
  }
  if (!graphRootText.includes('markdownDocumentText={canvasMarkdownDocument.text}')) {
    throw new Error('expected markdown/rich-media overlay rendering not to follow passive editor text switches')
  }
  if (!viewportText.includes('markdownText: canvasMarkdownDocument.text')) {
    throw new Error('expected CanvasViewportGeospatialOverlay rendering not to follow passive editor text switches')
  }
  if (!designText.includes('markdownDocumentText={canvasMarkdownDocument.text}')) {
    throw new Error('expected Design canvas overlays not to follow passive editor text switches')
  }
  if (!flowCanvasText.includes('markdownDocumentText: canvasMarkdownDocument.text')) {
    throw new Error('expected Flow Canvas snapshot/render state not to follow passive editor text switches')
  }
  if (!flowchartText.includes('useDebouncedValue(canvasMarkdownDocument.text')) {
    throw new Error('expected Flowchart workspace source parsing not to follow passive editor text switches')
  }
  if (!threeGraphText.includes('parseGlbAssetDocument(canvasMarkdownDocument.text)')) {
    throw new Error('expected 3D/XR asset rendering not to follow passive editor text switches')
  }
  if (!flowStoreText.includes('markdownDocumentApplyViewPreset: s.markdownDocumentApplyViewPreset')) {
    throw new Error('expected Storyboard Widget render state to receive the active document apply flag')
  }
  if (!flowStoreText.includes('markdownDocumentText: s.markdownDocumentText')) {
    throw new Error('expected Storyboard Widget runtime store state to expose the active applied markdown text for same-path source reapply resets')
  }
  if (!flowStoreText.includes('markdownDocumentApplyRevision: s.markdownDocumentApplyRevision || 0')) {
    throw new Error('expected Storyboard Widget runtime store state to expose the explicit markdown apply revision for same-text source replays')
  }
  if (!flowStoreText.includes('Array.isArray(s.openWidgetNodeIdsByRenderer?.[s.canvas2dRenderer])')) {
    throw new Error('expected Storyboard Widget runtime store state to read active-renderer-scoped open-widget ids before any global fallback')
  }
  if (!flowStoreText.includes('const flowWidgetPinnedByNodeId = React.useMemo(') || !flowStoreText.includes('resolveScopedFlowWidgetNodeMap({')) {
    throw new Error('expected Storyboard Widget runtime store state to read pinned widget state through the shared graph-scoped helper')
  }
  if (!widgetScopeText.includes('const EMPTY_SCOPED_FLOW_WIDGET_NODE_MAP')) {
    throw new Error('expected scoped Storyboard Widget-state helper to keep one stable empty map for selector-safe fallbacks')
  }
  if (!widgetScopeText.includes('EMPTY_SCOPED_FLOW_WIDGET_NODE_MAP as Record<string, T>')) {
    throw new Error('expected scoped Storyboard Widget-state helper to reuse the stable empty map instead of allocating a fresh object fallback')
  }
  if (!storyboardWidgetText.includes('applyViewPreset: markdownDocumentApplyViewPreset !== false')) {
    throw new Error('expected Storyboard Widget stable render keys to ignore passive Source Files switches')
  }
  if (!storyboardWidgetText.includes('text: markdownDocumentText')) {
    throw new Error('expected Storyboard Widget applied markdown context to include the active source text for same-document reapply resets')
  }
  if (!storyboardWidgetText.includes("return [String(canvasMarkdownDocument.semanticKey || '').trim(), String(markdownDocumentApplyRevision || 0)].join('::')")) {
    throw new Error('expected Storyboard Widget draft lifetime to key off the shared applied-document semantic key plus explicit apply revision instead of only the document path')
  }
}
