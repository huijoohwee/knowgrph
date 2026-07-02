import { deriveOpenWidgetOverlayNodeIds } from '@/components/StoryboardWidgetCanvas/storyboardWidgetCanvasShared'
import { buildFlowWidgetEligibleNodeIdSet, buildFlowWidgetOverlayEligibleNodeIdSet } from '@/lib/graph/flowWidgetEligibility'
import { buildRichMediaPanelOverlayExcludeNodeIdSet } from '@/lib/render/richMediaSsot'
import type { GraphData } from '@/lib/graph/types'
import fs from 'node:fs'
import path from 'node:path'

function buildFrontmatterFlowGraph(): GraphData {
  return {
    type: 'Graph',
    nodes: [
      {
        id: 'w-text',
        type: 'TextGeneration',
        label: 'Text Widget',
        properties: { 'flow:widgetFormId': 'textGeneration' },
      },
      {
        id: 'p-media',
        type: 'RichMediaPanel',
        label: 'Rich Media Panel',
        properties: { 'flow:widgetFormId': 'richMediaPanel', richMediaActiveTab: 'video' },
      },
    ],
    edges: [],
    metadata: { kind: 'frontmatter-flow' },
  }
}

export function testStoryboardWidgetOpenWidgetEligibilityIncludesRichMediaPanels() {
  const graphData = buildFrontmatterFlowGraph()
  const nodes = graphData.nodes || []
  const nodeById = new Map(nodes.map(node => [String(node.id || '').trim(), node] as const))
  const broadEligible = buildFlowWidgetEligibleNodeIdSet(nodes as never)
  const overlayEligible = buildFlowWidgetOverlayEligibleNodeIdSet(nodes as never)

  if (!broadEligible.has('p-media')) {
    throw new Error('expected RichMediaPanel to remain graph-eligible for frontmatter-flow/rich-media derivation')
  }
  if (!overlayEligible.has('p-media')) {
    throw new Error('expected RichMediaPanel to be open-widget eligible so runtime proof routes can mount its KTV rows and ports')
  }
  if (!overlayEligible.has('w-text')) {
    throw new Error('expected actual widget nodes to remain open-widget eligible')
  }

  const excludedPanelIds = buildRichMediaPanelOverlayExcludeNodeIdSet({
    graphData,
    nodeById,
    candidateRawIds: Array.from(overlayEligible),
  })
  if (!excludedPanelIds.has('p-media')) {
    throw new Error('expected open RichMediaPanel widgets to suppress duplicate rich-media overlay materialization')
  }
}

export function testDeriveOpenWidgetOverlayNodeIdsKeepsRichMediaPanelsWhenExplicitlyOpened() {
  const graphData = buildFrontmatterFlowGraph()
  const nodeById = new Map((graphData.nodes || []).map(node => [String(node.id || '').trim(), node] as const))
  const ids = deriveOpenWidgetOverlayNodeIds({
    graphData,
    openWidgetNodeIds: ['p-media', 'w-text'],
    eligibleNodeIds: new Set(['p-media', 'w-text']),
    nodeById,
  })

  if (ids.length !== 2 || ids[0] !== 'p-media' || ids[1] !== 'w-text') {
    throw new Error(`expected overlay node id derivation to preserve explicitly opened RichMediaPanel widget ids, got ${JSON.stringify(ids)}`)
  }
}

export function testFlowCanvasGraphStateDoesNotFallbackToStoreGraphForStoryboardWidgetWhenOverrideIsEmpty() {
  const filePath = path.resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasGraphState.ts')
  const text = fs.readFileSync(filePath, 'utf8')
  if (text.includes('const preferStoreGraphFallback =')) {
    throw new Error('expected flow canvas graph state to remove the Storyboard Widget store-graph fallback guard')
  }
  if (text.includes('if (preferStoreGraphFallback) return storeGraphData')) {
    throw new Error('expected flow canvas graph state to forbid store-graph fallback when the Storyboard Widget override is empty')
  }
  if (!text.includes('return graphDataOverride !== undefined ? graphDataOverride : storeGraphData')) {
    throw new Error('expected flow canvas graph state to keep Storyboard Widget render-graph ownership on the explicit override contract')
  }
}

export function testStoryboardSharedSurfaceSuppressesOpenRichMediaWidgetDuplicateOverlay() {
  const runtimePath = path.resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas.runtime.tsx')
  const surfacePath = path.resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'StoryboardWidgetCanvasSurface.tsx')
  const runtimeText = fs.readFileSync(runtimePath, 'utf8')
  const surfaceText = fs.readFileSync(surfacePath, 'utf8')

  if (!runtimeText.includes('openWidgetNodeIds={overlayOpenWidgetNodeIds}')) {
    throw new Error('expected Storyboard Widget runtime to pass the merged overlay widget owner ids into the shared surface for Rich Media duplicate suppression')
  }
  if (runtimeText.includes('() => storyboardWidgetDisplayActive ? storyboardWidgetNodeIds : openWidgetNodeIds')) {
    throw new Error('expected Storyboard Widget runtime not to drop explicit open Rich Media widgets when Storyboard display mode owns fixed cards')
  }
  if (!runtimeText.includes('for (let i = 0; i < storyboardWidgetNodeIds.length; i += 1) pushId(storyboardWidgetNodeIds[i])')
    || !runtimeText.includes('for (let i = 0; i < openWidgetNodeIds.length; i += 1) pushId(openWidgetNodeIds[i])')) {
    throw new Error('expected Storyboard Widget runtime to merge fixed Storyboard widget ids with explicit open widget ids before duplicate suppression')
  }
  if (!surfaceText.includes("import { buildRichMediaPanelOverlayExcludeNodeIdSet } from '@/lib/render/richMediaSsot'")) {
    throw new Error('expected Storyboard shared surface to reuse the upstream Rich Media overlay exclusion helper')
  }
  if (!surfaceText.includes('props.storyboardWidgetMode === true && Array.isArray(props.openWidgetNodeIds)')
    || !surfaceText.includes('candidateRawIds: explicitOpenWidgetNodeIds')) {
    throw new Error('expected Storyboard shared surface to suppress duplicate Rich Media overlays only when Widget display owns the shared widget shell')
  }
  if (!surfaceText.includes('for (const id of openRichMediaPanelNodeIds) hiddenNodeIds.add(id)')) {
    throw new Error('expected open Rich Media widgets to be merged into the FlowCanvas hidden node ids instead of rendering a duplicate Rich Media overlay')
  }
}
