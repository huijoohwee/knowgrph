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
  const flowEditorText = readSource('src/components/FlowEditorCanvas.runtime.tsx')
  const flowStoreText = readSource('src/components/FlowEditorCanvas/runtime/useFlowEditorRuntimeStoreState.ts')
  const widgetScopeText = readSource('src/lib/flowEditor/widgetStateScope.ts')

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
    throw new Error('expected Flow Editor render state to receive the active document apply flag')
  }
  if (!flowStoreText.includes("s.openWidgetNodeIdsByRenderer?.flowEditor")) {
    throw new Error('expected Flow Editor runtime store state to read renderer-scoped open-widget ids before any global fallback')
  }
  if (!flowStoreText.includes('flowWidgetPinnedByNodeId: resolveScopedFlowWidgetNodeMap({')) {
    throw new Error('expected Flow Editor runtime store state to read pinned widget state through the shared graph-scoped helper')
  }
  if (!widgetScopeText.includes('const EMPTY_SCOPED_FLOW_WIDGET_NODE_MAP')) {
    throw new Error('expected scoped Flow Editor widget-state helper to keep one stable empty map for selector-safe fallbacks')
  }
  if (!widgetScopeText.includes('EMPTY_SCOPED_FLOW_WIDGET_NODE_MAP as Record<string, T>')) {
    throw new Error('expected scoped Flow Editor widget-state helper to reuse the stable empty map instead of allocating a fresh object fallback')
  }
  if (!flowEditorText.includes('applyViewPreset: markdownDocumentApplyViewPreset !== false')) {
    throw new Error('expected Flow Editor stable render keys to ignore passive Source Files switches')
  }
}
