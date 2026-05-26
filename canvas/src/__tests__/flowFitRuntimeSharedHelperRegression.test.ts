import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowFitRuntimePathsReuseSharedHelpers() {
  const fitRuntimeText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'fitRuntime.ts'),
    'utf8',
  )
  const layoutStateText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasLayoutState.ts'),
    'utf8',
  )
  const runtimeText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasRuntime.ts'),
    'utf8',
  )
  const nativeZoomText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'applyZoomRequestNative.ts'),
    'utf8',
  )

  if (!fitRuntimeText.includes('export function buildFlowFitOptions') || !fitRuntimeText.includes('export function readFlowEditorPortExtraPadScreenPx')) {
    throw new Error('expected FlowCanvas fit runtime helpers to centralize shared fit option and port padding logic')
  }
  if (!fitRuntimeText.includes('readDocumentViewModeContext({') || fitRuntimeText.includes('resolveActiveDocumentViewMode(')) {
    throw new Error('expected FlowCanvas fit runtime to reuse the shared document view mode context instead of resolving document view mode locally')
  }
  if (!layoutStateText.includes('buildFlowFitOptions({') || !layoutStateText.includes('readFlowEditorPortExtraPadScreenPx(')) {
    throw new Error('expected FlowCanvas layout state to reuse shared Flow fit runtime helpers instead of duplicating fit prep logic')
  }
  if (layoutStateText.includes('resolveActiveDocumentViewMode(')) {
    throw new Error('expected FlowCanvas layout state to stop resolving document view mode locally once the shared fit runtime helper owns that decision')
  }
  if (!runtimeText.includes('buildFlowFitOptions({') || !runtimeText.includes('readFlowEditorPortExtraPadScreenPx(')) {
    throw new Error('expected FlowCanvas runtime to reuse shared Flow fit runtime helpers instead of duplicating fit prep logic')
  }
  if (!nativeZoomText.includes('fitFlowEditorPinnedWidgets({') || !nativeZoomText.includes('buildFlowFitOptions({') || !nativeZoomText.includes('readFlowEditorPortExtraPadScreenPx(')) {
    throw new Error('expected FlowCanvas zoom reset/fit actions to reuse the shared pinned-widget fit and fit-runtime helpers')
  }
  if (!nativeZoomText.includes("import { resolveScopedFlowWidgetNodeMap } from '@/lib/flowEditor/widgetStateScope'")) {
    throw new Error('expected FlowCanvas zoom reset/fit actions to reuse the shared scoped widget-state helper for Flow Editor fits')
  }
  if (!nativeZoomText.includes("import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'")) {
    throw new Error('expected FlowCanvas zoom reset/fit actions to derive one active render-graph key before reading Flow Editor widget state')
  }
  if (!nativeZoomText.includes('const graphKey = buildGraphMetaKeyIgnoringPending(args.graphData || null)')) {
    throw new Error('expected FlowCanvas zoom reset/fit actions to derive the active graph key from the fit graph source')
  }
  if (!nativeZoomText.includes('pinnedById: resolveScopedFlowWidgetNodeMap({')) {
    throw new Error('expected FlowCanvas zoom reset/fit actions to read pinned widget state from the active graph scope')
  }
  if (!nativeZoomText.includes('worldPosById: resolveScopedFlowWidgetNodeMap({')) {
    throw new Error('expected FlowCanvas zoom reset/fit actions to read widget world positions from the active graph scope')
  }
  if (!nativeZoomText.includes('recenterVisibleFlowEditorOverlayCentroid') || !nativeZoomText.includes('collectCanonicalFlowEditorOverlayRectEntries')) {
    throw new Error('expected FlowCanvas zoom reset/fit actions to nudge the live visible Flow Editor overlay centroid into the viewport center after the shared fit resolves')
  }
}
