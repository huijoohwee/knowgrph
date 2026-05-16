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

export function testFlowEditorOpenWidgetEligibilityExcludesRichMediaPanels() {
  const graphData = buildFrontmatterFlowGraph()
  const nodes = graphData.nodes || []
  const broadEligible = buildFlowWidgetEligibleNodeIdSet(nodes as never)
  const overlayEligible = buildFlowWidgetOverlayEligibleNodeIdSet(nodes as never)

  if (!broadEligible.has('p-media')) {
    throw new Error('expected RichMediaPanel to remain graph-eligible for frontmatter-flow/rich-media derivation')
  }
  if (overlayEligible.has('p-media')) {
    throw new Error('expected RichMediaPanel to be excluded from open widget overlay eligibility')
  }
  if (!overlayEligible.has('w-text')) {
    throw new Error('expected actual widget nodes to remain open-widget eligible')
  }

  const excludedPanelIds = buildRichMediaPanelOverlayExcludeNodeIdSet({
    graphData,
    candidateRawIds: Array.from(overlayEligible),
  })
  if (excludedPanelIds.has('p-media')) {
    throw new Error('expected sanitized open widget ids to stop excluding rich-media panels from overlay materialization')
  }
}

export function testDeriveOpenWidgetOverlayNodeIdsDropsRichMediaPanelsEvenIfStateLeaks() {
  const graphData = buildFrontmatterFlowGraph()
  const nodeById = new Map((graphData.nodes || []).map(node => [String(node.id || '').trim(), node] as const))
  const ids = deriveOpenWidgetOverlayNodeIds({
    graphData,
    openWidgetNodeIds: ['p-media', 'w-text'],
    eligibleNodeIds: new Set(['p-media', 'w-text']),
    nodeById,
  })

  if (ids.length !== 1 || ids[0] !== 'w-text') {
    throw new Error(`expected overlay node id derivation to drop leaked RichMediaPanel widget ids, got ${JSON.stringify(ids)}`)
  }
}

export function testFlowCanvasGraphStateFallsBackToStoreGraphForFlowEditorWhenOverrideIsEmpty() {
  const filePath = path.resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasGraphState.ts')
  const text = fs.readFileSync(filePath, 'utf8')
  if (!text.includes("canvas2dRenderer === 'flowEditor'")) {
    throw new Error('expected flow canvas graph state to scope empty-override fallback to Flow Editor')
  }
  if (!text.includes('const preferStoreGraphFallback =')) {
    throw new Error('expected flow canvas graph state to compute an explicit store-graph fallback guard')
  }
  if (!text.includes('&& overrideNodeCount === 0')) {
    throw new Error('expected flow canvas graph state to detect empty Flow Editor overrides by node count')
  }
  if (!text.includes('if (preferStoreGraphFallback) return storeGraphData')) {
    throw new Error('expected flow canvas graph state to reuse the loaded store graph when the Flow Editor override is empty')
  }
}
