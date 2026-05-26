import { deriveOpenWidgetOverlayNodeIds } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
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

export function testFlowEditorOpenWidgetEligibilityIncludesRichMediaPanels() {
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

export function testFlowCanvasGraphStateDoesNotFallbackToStoreGraphForFlowEditorWhenOverrideIsEmpty() {
  const filePath = path.resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasGraphState.ts')
  const text = fs.readFileSync(filePath, 'utf8')
  if (text.includes('const preferStoreGraphFallback =')) {
    throw new Error('expected flow canvas graph state to remove the Flow Editor store-graph fallback guard')
  }
  if (text.includes('if (preferStoreGraphFallback) return storeGraphData')) {
    throw new Error('expected flow canvas graph state to forbid store-graph fallback when the Flow Editor override is empty')
  }
  if (!text.includes('return graphDataOverride !== undefined ? graphDataOverride : storeGraphData')) {
    throw new Error('expected flow canvas graph state to keep Flow Editor render-graph ownership on the explicit override contract')
  }
}
