import {
  deriveOpenWidgetOverlayNodeIds,
  deriveStoryboardCanvasRichMediaPanelNodeIds,
  filterGraphByExcludedNodeIds,
} from '@/components/StoryboardWidgetCanvas/storyboardWidgetCanvasShared'
import {
  deriveStoryboardWidgetNodeRemoval,
  isStoryboardWidgetNodeRemovalTarget,
} from '@/components/StoryboardWidgetCanvas/runtime/useStoryboardWidgetNodeDraftActions'
import { resolveFlowCanvasRichMediaOverlayRemoval } from '@/components/FlowCanvas/FlowCanvasRichMediaOverlayToolbar'
import { resolveStoryboardCardOverlayRemoval } from '@/components/StoryboardWidgetCanvas/StoryboardCardOverlayLayer2d'
import { STORYBOARD_CANVAS_RICH_MEDIA_PANEL_PROPERTY } from '@/components/StoryboardCanvas/storyboardModel'
import { buildFlowWidgetEligibleNodeIdSet, buildFlowWidgetOverlayEligibleNodeIdSet } from '@/lib/graph/flowWidgetEligibility'
import { buildRichMediaPanelOverlayExcludeNodeIdSet, listDisplayRichMediaOverlayNodes } from '@/lib/render/richMediaSsot'
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

export function testStoryboardWidgetRemoveClosesCanonicalRichMediaPanelIds() {
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'workspace-source::rich-media-panel',
        type: 'RichMediaPanel',
        label: 'Rich Media Panel',
        properties: { 'flow:widgetFormId': 'richMediaPanel' },
      },
      {
        id: 'source-node',
        type: 'InputWidget',
        label: 'Source',
        properties: {},
      },
    ],
    edges: [
      { id: 'source-to-rich', source: 'source-node', target: 'workspace-source::rich-media-panel', label: 'output', properties: {} },
    ],
    metadata: { kind: 'frontmatter-flow' },
  }

  const removal = deriveStoryboardWidgetNodeRemoval({
    graphData,
    nodeId: 'rich-media-panel',
  })

  if (removal.removedNodeIds.length !== 1 || removal.removedNodeIds[0] !== 'workspace-source::rich-media-panel') {
    throw new Error(`expected canonical Rich Media Panel suffix remove to resolve the workspace-qualified graph node, got ${JSON.stringify(removal.removedNodeIds)}`)
  }
  const nextNodeIds = (removal.nextGraphData?.nodes || []).map(node => String(node.id || '').trim())
  if (nextNodeIds.includes('workspace-source::rich-media-panel') || !nextNodeIds.includes('source-node')) {
    throw new Error(`expected remove to prune only the Rich Media Panel node, got ${JSON.stringify(nextNodeIds)}`)
  }
  if ((removal.nextGraphData?.edges || []).length !== 0) {
    throw new Error(`expected remove to prune incident Rich Media Panel edges, got ${JSON.stringify(removal.nextGraphData?.edges || [])}`)
  }

  const remainingOpenWidgetNodeIds = ['rich-media-panel', 'workspace-source::rich-media-panel', 'source-node'].filter(nodeId => {
    return !isStoryboardWidgetNodeRemovalTarget({ nodeId, removalNodeIds: removal.removedNodeIds })
  })
  if (remainingOpenWidgetNodeIds.length !== 1 || remainingOpenWidgetNodeIds[0] !== 'source-node') {
    throw new Error(`expected canonical Rich Media Panel remove to close every equivalent floating widget id, got ${JSON.stringify(remainingOpenWidgetNodeIds)}`)
  }
}

export function testFlowCanvasRichMediaOverlayRemoveResolvesCanonicalOpenWidgetIds() {
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'workspace-source::n10',
        type: 'RichMediaPanel',
        label: 'Rich Media Panel',
        properties: { 'flow:widgetFormId': 'richMediaPanel' },
      },
      {
        id: 'source-node',
        type: 'InputWidget',
        label: 'Source',
        properties: {},
      },
    ],
    edges: [],
    metadata: { kind: 'frontmatter-flow' },
  }

  const removal = resolveFlowCanvasRichMediaOverlayRemoval({
    graphData,
    nodeId: 'n10',
    openWidgetNodeIds: ['n10', 'workspace-source::n10', 'source-node'],
    selectedNodeId: 'workspace-source::n10',
  })

  if (!removal) throw new Error('expected Rich Media overlay remove resolver to return a removal contract')
  if (removal.targetNodeId !== 'workspace-source::n10') {
    throw new Error(`expected canonical Rich Media overlay remove target, got ${removal.targetNodeId}`)
  }
  if (removal.nextOpenWidgetNodeIds.length !== 1 || removal.nextOpenWidgetNodeIds[0] !== 'source-node') {
    throw new Error(`expected canonical Rich Media overlay remove to close equivalent open widget ids, got ${JSON.stringify(removal.nextOpenWidgetNodeIds)}`)
  }
  if (removal.clearSelection !== true) {
    throw new Error('expected canonical Rich Media overlay remove to clear equivalent selected node ids')
  }
}

export function testStoryboardCardOverlayRemoveResolvesCanonicalCardIds() {
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'workspace-source::n8',
        type: 'TextGeneration',
        label: 'Text Widget',
        properties: { 'flow:widgetFormId': 'textGeneration' },
      },
      {
        id: 'workspace-runtime',
        type: 'Validation',
        label: 'Runtime Gate',
        properties: {},
      },
    ],
    edges: [
      { id: 'runtime-to-card', source: 'workspace-runtime', target: 'workspace-source::n8', label: 'output', properties: {} },
    ],
    metadata: { kind: 'frontmatter-flow' },
  }

  const removal = resolveStoryboardCardOverlayRemoval({
    graphData,
    cardId: 'n8',
    openWidgetNodeIds: ['n8', 'workspace-source::n8', 'workspace-runtime'],
    selectedNodeId: 'n8',
  })

  if (!removal) throw new Error('expected Storyboard card overlay remove resolver to return a removal contract')
  if (removal.removedNodeIds.length !== 1 || removal.removedNodeIds[0] !== 'workspace-source::n8') {
    throw new Error(`expected canonical Storyboard card remove to resolve the workspace-qualified graph node, got ${JSON.stringify(removal.removedNodeIds)}`)
  }
  const nextNodeIds = (removal.nextGraphData?.nodes || []).map(node => String(node.id || '').trim())
  if (nextNodeIds.includes('workspace-source::n8') || !nextNodeIds.includes('workspace-runtime')) {
    throw new Error(`expected Storyboard card remove to prune only the selected card node, got ${JSON.stringify(nextNodeIds)}`)
  }
  if ((removal.nextGraphData?.edges || []).length !== 0) {
    throw new Error(`expected Storyboard card remove to prune incident edges, got ${JSON.stringify(removal.nextGraphData?.edges || [])}`)
  }
  if (removal.nextOpenWidgetNodeIds.length !== 1 || removal.nextOpenWidgetNodeIds[0] !== 'workspace-runtime') {
    throw new Error(`expected Storyboard card remove to close equivalent open widget ids, got ${JSON.stringify(removal.nextOpenWidgetNodeIds)}`)
  }
  if (removal.clearSelection !== true) {
    throw new Error('expected Storyboard card remove to clear equivalent selected node ids')
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

export function testStoryboardCardSurfaceSuppressesCanvasOwnedRichMediaBackingOverlay() {
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'care-panel',
        type: 'RichMediaPanel',
        label: 'Patient Coach Panel',
        properties: {
          [STORYBOARD_CANVAS_RICH_MEDIA_PANEL_PROPERTY]: true,
          'flow:widgetFormId': 'richMediaPanel',
          richMediaActiveTab: 'text',
        },
      },
      {
        id: 'standalone-panel',
        type: 'RichMediaPanel',
        label: 'Standalone Rich Media Panel',
        properties: { 'flow:widgetFormId': 'richMediaPanel' },
      },
      {
        id: 'care-source',
        type: 'InputWidget',
        label: 'Care Source',
        properties: { lane: 'Source' },
      },
    ],
    edges: [
      { id: 'care-source-to-panel', source: 'care-source', target: 'care-panel', label: 'output', properties: {} },
      { id: 'care-source-to-standalone', source: 'care-source', target: 'standalone-panel', label: 'reference', properties: {} },
    ],
  }
  const canvasOwnedPanelIds = deriveStoryboardCanvasRichMediaPanelNodeIds(graphData)
  if (canvasOwnedPanelIds.length !== 1 || canvasOwnedPanelIds[0] !== 'care-panel') {
    throw new Error(`expected only Storyboard canvas-owned Rich Media panels to be excluded from the backing FlowCanvas graph, got ${JSON.stringify(canvasOwnedPanelIds)}`)
  }

  const filtered = filterGraphByExcludedNodeIds({
    graphData,
    excludedNodeIds: canvasOwnedPanelIds,
  })
  const retainedNodeIds = new Set((filtered?.nodes || []).map(node => String(node.id || '').trim()))
  if (retainedNodeIds.has('care-panel')) {
    throw new Error('expected the Storyboard-owned Rich Media panel to be removed from FlowCanvas materialization')
  }
  if (!retainedNodeIds.has('standalone-panel') || !retainedNodeIds.has('care-source')) {
    throw new Error('expected non-Storyboard Rich Media panels and source nodes to remain renderable in FlowCanvas')
  }
  if ((filtered?.edges || []).some(edge => String(edge.target || '') === 'care-panel')) {
    throw new Error('expected edges into the suppressed Storyboard-owned Rich Media panel to be pruned with the node')
  }
}

export function testBlankRichMediaPanelUsesPanelOverlayInsteadOfFlowNodeGlyph() {
  const overlays = listDisplayRichMediaOverlayNodes({
    renderMediaAsNodes: true,
    canvas2dRenderer: 'storyboard',
    frontmatterModeEnabled: true,
    documentSemanticMode: 'document',
    nodes: [{ id: 'blank-rich-media', type: 'RichMediaPanel', label: 'Rich Media Panel', properties: {} }],
    poolMax: 24,
  })
  if (overlays.length !== 1 || overlays[0]?.id !== 'blank-rich-media' || overlays[0]?.kind !== 'iframe') {
    throw new Error(`expected blank Rich Media Panels to enter the panel overlay pool instead of rendering as FlowCanvas node glyphs, got ${JSON.stringify(overlays)}`)
  }
}

export function testBlankRichMediaPanelsStayOverlayOwnedBesideMeaningfulPanel() {
  const overlays = listDisplayRichMediaOverlayNodes({
    renderMediaAsNodes: true,
    canvas2dRenderer: 'storyboard',
    frontmatterModeEnabled: true,
    documentSemanticMode: 'document',
    nodes: [
      { id: 'blank-rich-media-a', type: 'RichMediaPanel', label: 'Rich Media Panel', properties: {} },
      { id: 'image-rich-media', type: 'RichMediaPanel', label: 'Rich Media Panel', properties: { imageUrl: 'https://example.com/image.png', richMediaActiveTab: 'image' } },
      { id: 'blank-rich-media-b', type: 'RichMediaPanel', label: 'Rich Media Panel', properties: {} },
    ],
    poolMax: 24,
  })
  const ids = new Set(overlays.map(node => String(node.id || '').trim()))
  if (overlays.length !== 3 || !ids.has('blank-rich-media-a') || !ids.has('image-rich-media') || !ids.has('blank-rich-media-b')) {
    throw new Error(`expected every Rich Media Panel to stay overlay-owned instead of mutating blank panels into FlowCanvas glyphs, got ${JSON.stringify(overlays)}`)
  }
}

export function testStoryboardSharedSurfaceSuppressesOpenRichMediaWidgetDuplicateOverlay() {
  const runtimePath = path.resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas.runtime.tsx')
  const surfacePath = path.resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'StoryboardWidgetCanvasSurface.tsx')
  const sharedPath = path.resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'storyboardWidgetCanvasShared.tsx')
  const runtimeText = fs.readFileSync(runtimePath, 'utf8')
  const surfaceText = fs.readFileSync(surfacePath, 'utf8')
  const sharedText = fs.readFileSync(sharedPath, 'utf8')

  if (!runtimeText.includes('openWidgetNodeIds={overlayOpenWidgetNodeIds}')) {
    throw new Error('expected Storyboard Widget runtime to pass the merged overlay widget owner ids into the shared surface for Rich Media duplicate suppression')
  }
  if (runtimeText.includes('() => storyboardWidgetDisplayActive ? storyboardWidgetNodeIds : openWidgetNodeIds')) {
    throw new Error('expected Storyboard Widget runtime not to drop explicit open Rich Media widgets when Storyboard display mode owns fixed cards')
  }
  if (!runtimeText.includes('if (storyboardCardDisplayActive) return []')) {
    throw new Error('expected Storyboard Card display mode to suppress floating widget shells, including Rich Media panels already owned by the canvas overlay')
  }
  if (!runtimeText.includes('for (let i = 0; i < storyboardWidgetNodeIds.length; i += 1) pushId(storyboardWidgetNodeIds[i])')
    || !runtimeText.includes('for (let i = 0; i < openWidgetNodeIds.length; i += 1) pushId(openWidgetNodeIds[i])')) {
    throw new Error('expected Storyboard Widget runtime to merge fixed Storyboard widget ids with explicit open widget ids before duplicate suppression')
  }
  if (!surfaceText.includes("import { buildRichMediaPanelOverlayExcludeNodeIdSet } from '@/lib/render/richMediaSsot'")) {
    throw new Error('expected Storyboard shared surface to reuse the upstream Rich Media overlay exclusion helper')
  }
  if (!surfaceText.includes('deriveStoryboardCanvasRichMediaPanelNodeIds')
    || !surfaceText.includes('const storyboardCanvasRichMediaPanelNodeIds = storyboardCardsActive')
    || !surfaceText.includes('for (const id of storyboardCanvasRichMediaPanelNodeIds) hiddenNodeIds.add(id)')) {
    throw new Error('expected Storyboard Card display mode to hide canvas-owned Rich Media panels from FlowCanvas so the backing panel cannot shadow the Storyboard-owned panel')
  }
  if (!surfaceText.includes('props.storyboardWidgetMode === true && Array.isArray(props.openWidgetNodeIds)')
    || !surfaceText.includes('candidateRawIds: explicitOpenWidgetNodeIds')) {
    throw new Error('expected Storyboard shared surface to keep the explicit open-widget Rich Media duplicate suppression path')
  }
  if (!surfaceText.includes('for (const id of openRichMediaPanelNodeIds) hiddenNodeIds.add(id)')) {
    throw new Error('expected open Rich Media widgets to be merged into the FlowCanvas hidden node ids instead of rendering a duplicate Rich Media overlay')
  }
  const overlaySurfacePath = path.resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'useStoryboardWidgetOverlaySurface.tsx')
  const overlaySurfaceText = fs.readFileSync(overlaySurfacePath, 'utf8')
  if (!overlaySurfaceText.includes('selectedNodeId: selectedOverlayEditorNodeIdForDerivation')) {
    throw new Error('expected selected overlay editor node ids to pass through the shared Rich Media duplicate-suppression gate')
  }
  if (!sharedText.includes("String(args.storyboardWidgetSurfaceId || '').trim() !== 'storyboard'") || !sharedText.includes('isRichMediaPanelNode(node) ? null : selectedNodeId')) {
    throw new Error('expected selected Storyboard Rich Media panels to stay canvas-owned instead of opening a duplicate floating widget shell')
  }
  if (!overlaySurfaceText.includes("if (editorSurfaceKind === 'card') return []")) {
    throw new Error('expected Storyboard Card display mode to remove stale floating overlay editor shells at the shared overlay surface')
  }
}
