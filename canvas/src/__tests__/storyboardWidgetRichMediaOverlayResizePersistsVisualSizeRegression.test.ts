import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readStoryboardCardSize2d, readStoryboardWidgetPlacementSize2d } from '@/components/StoryboardWidgetCanvas/storyboardCardPlacements2d'
import type { GraphNode } from '@/lib/graph/types'
import { projectMediaOverlayResizeWorldSizeToLayout } from '@/lib/render/mediaOverlayResizeProjection'

export function testStoryboardWidgetRichMediaOverlayResizePersistsVisualSize() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const sharedPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'shared.ts')
  const draftActionsPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'useStoryboardWidgetNodeDraftActions.ts')
  const text = readFileSync(p, 'utf8')
  const sharedText = readFileSync(sharedPath, 'utf8')
  const draftActionsText = readFileSync(draftActionsPath, 'utf8')
  if (!text.includes("'visual:width'") || !text.includes("'visual:height'")) {
    throw new Error('expected FlowCanvas rich media overlay resize to write visual:width/visual:height')
  }
  if (!text.includes('onNodePropertiesChange(node.id, nextProperties, mutationSourceGraphData)')) {
    throw new Error('expected FlowCanvas media overlays to commit size through the renderer source-graph mutation contract')
  }
  if (!sharedText.includes('sourceGraphData?: GraphData | null')) {
    throw new Error('expected the shared node-property mutation contract to carry its canonical source graph')
  }
  if (!draftActionsText.includes('const storeNodeId = String(resolveGraphNodeByCanonicalId(storeGraphData, id)?.id || \'\').trim()')
    || !draftActionsText.includes('args.updateNode(storeNodeId || id, patch)')) {
    throw new Error('expected Storyboard source-graph mutations to commit only the canonically resolved node')
  }
  if (!sharedText.includes('resizeActive: rendererInteractionMode && args.workspaceMutationBlocked !== true')) {
    throw new Error('expected FlowCanvas rich media overlay resize to stay blocked by shared workspace mutation policy')
  }
  if (!text.includes('const resizeHandleVisible = resizeInteractionActive')) {
    throw new Error('expected FlowCanvas rich media overlay resize-handle visibility to stay solely policy gated so iframe content cannot hide its resize control')
  }
  if (!text.includes('isStoryboardWidgetFrontmatterDocumentModeRequested')) {
    throw new Error('expected FlowCanvas rich media overlay resize to reuse shared frontmatter-document mode request gate SSOT')
  }
  if (!text.includes('phase=layout-override') || !text.includes('lastRichMediaResizeTrace')) {
    throw new Error('expected FlowCanvas rich media overlay resize path to publish strict live trace for resize lifecycle and layout override consumption')
  }
  if (!text.includes('projectMediaOverlayResizeWorldSizeToLayout({')) {
    throw new Error('expected Rich Media resize overrides to reuse the shared world-to-layout projection owner')
  }
  if (!text.includes('if (mediaOverlayDragInteractionMode) return')) {
    throw new Error('expected active Card, Widget, Storyboard, and Flow Canvas resize sessions to survive renderer cleanup effects')
  }
  if (!text.includes('readVectorPaintedOverlayScale(el)')) {
    throw new Error('expected Rich Media resize deltas to reuse the shared Card and Widget painted-scale projection instead of raw renderer zoom')
  }
  if (text.includes('if (!runtime || !scene) return')) {
    throw new Error('expected Rich Media resize to remain available before the optional Flow scene runtime hydrates')
  }
  const storyboardProjected = projectMediaOverlayResizeWorldSizeToLayout({
    height: 270,
    projectWithWorldTransformScale: true,
    scale: 0.375,
    width: 480,
  })
  if (storyboardProjected.w !== 480 || storyboardProjected.h !== 270) {
    throw new Error(`expected Storyboard resize to keep world size for one-time canvas zoom projection, got ${storyboardProjected.w}x${storyboardProjected.h}`)
  }
  const screenProjected = projectMediaOverlayResizeWorldSizeToLayout({
    height: 270,
    projectWithWorldTransformScale: false,
    scale: 0.375,
    width: 480,
  })
  if (screenProjected.w !== 180 || screenProjected.h !== 101.25) {
    throw new Error(`expected screen-layout renderers to retain their explicit zoom projection, got ${screenProjected.w}x${screenProjected.h}`)
  }

  const resizedBelowDefault = readStoryboardCardSize2d({
    id: 'rich-media-resized-below-default',
    label: 'Rich media resized below default',
    properties: { 'visual:width': 240, 'visual:height': 135 },
    type: 'MediaPanel',
  } as GraphNode, '16:9')
  if (resizedBelowDefault.width !== 240 || resizedBelowDefault.height !== 135) {
    throw new Error(`expected explicit Card and Rich Media resize below the default width to persist, got ${resizedBelowDefault.width}x${resizedBelowDefault.height}`)
  }
  const resizedWidgetBelowDefault = readStoryboardWidgetPlacementSize2d({
    id: 'widget-resized-below-default',
    label: 'Widget resized below default',
    properties: { 'visual:width': 240, 'visual:height': 135 },
    type: 'Widget',
  } as GraphNode, '16:9')
  if (resizedWidgetBelowDefault.width !== 240 || resizedWidgetBelowDefault.height !== 135) {
    throw new Error(`expected explicit Widget resize below the default width to persist, got ${resizedWidgetBelowDefault.width}x${resizedWidgetBelowDefault.height}`)
  }
}
