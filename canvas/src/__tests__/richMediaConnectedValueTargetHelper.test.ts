import {
  buildRichMediaConnectedValueTargetNodeIdSet,
  buildRichMediaPanelOverlayExcludeNodeIdSet,
  isRichMediaConnectedValueTargetNode,
  resolvePreferredRichMediaPanelNodeId,
} from '@/lib/render/richMediaSsot'

export function testBuildRichMediaConnectedValueTargetNodeIdSetIncludesPanelsAndCanonicalMediaSpecs() {
  const ids = buildRichMediaConnectedValueTargetNodeIdSet({
    nodes: [
      {
        id: 'panel-1',
        type: 'RichMediaPanel',
        label: 'Panel',
        properties: {},
      },
      {
        id: 'image-1',
        type: 'Image',
        label: 'Image',
        properties: {
          image: 'https://example.com/image.png',
        },
      },
      {
        id: 'plain-1',
        type: 'Paragraph',
        label: 'Plain',
        properties: {},
      },
    ] as Parameters<typeof buildRichMediaConnectedValueTargetNodeIdSet>[0]['nodes'],
    includeMediaSpecNodes: true,
  })

  if (!ids.has('panel-1')) throw new Error('expected rich media panel id in connected-value target set')
  if (!ids.has('image-1')) throw new Error('expected canonical media node id in connected-value target set')
  if (ids.has('plain-1')) throw new Error('expected plain node to stay out of connected-value target set')
}

export function testBuildRichMediaConnectedValueTargetNodeIdSetMergesExtraNodeIds() {
  const ids = buildRichMediaConnectedValueTargetNodeIdSet({
    nodes: [],
    extraNodeIds: ['overlay-1', '', 'overlay-2'],
  })

  if (!ids.has('overlay-1') || !ids.has('overlay-2')) {
    throw new Error('expected extra overlay ids in connected-value target set')
  }
  if (ids.size !== 2) throw new Error(`expected exactly 2 extra ids, got ${ids.size}`)
}

export function testIsRichMediaConnectedValueTargetNodeUsesSharedEligibilityRule() {
  const richMediaPanelNode = {
    id: 'panel-1',
    type: 'RichMediaPanel',
    label: 'Panel',
    properties: {},
  } as Parameters<typeof isRichMediaConnectedValueTargetNode>[0]['node']
  if (!isRichMediaConnectedValueTargetNode({ node: richMediaPanelNode })) {
    throw new Error('expected rich media panel node to be eligible without media spec fallback')
  }

  const imageNode = {
    id: 'image-1',
    type: 'Image',
    label: 'Image',
    properties: { image: 'https://example.com/image.png' },
  } as Parameters<typeof isRichMediaConnectedValueTargetNode>[0]['node']
  if (isRichMediaConnectedValueTargetNode({ node: imageNode }) !== false) {
    throw new Error('expected media-spec node to stay excluded unless includeMediaSpecNodes is enabled')
  }
  if (!isRichMediaConnectedValueTargetNode({ node: imageNode, includeMediaSpecNodes: true })) {
    throw new Error('expected media-spec node to be eligible when includeMediaSpecNodes is enabled')
  }
}

export function testBuildRichMediaPanelOverlayExcludeNodeIdSetMergesBlanketAndCandidatePanelIds() {
  const graphData = {
    nodes: [
      { id: 'panel-1', type: 'RichMediaPanel', label: 'Panel 1', properties: {} },
      { id: 'panel-2', type: 'RichMediaPanel', label: 'Panel 2', properties: {} },
      { id: 'image-1', type: 'Image', label: 'Image', properties: { image: 'https://example.com/image.png' } },
    ],
  } as Parameters<typeof buildRichMediaPanelOverlayExcludeNodeIdSet>[0]['graphData']
  const nodeById = new Map(
    (graphData?.nodes || []).map(node => [String(node?.id || '').trim(), node] as const),
  )

  const ids = buildRichMediaPanelOverlayExcludeNodeIdSet({
    graphData,
    nodeById,
    candidateRawIds: ['panel-2', 'image-1'],
    excludeAllRichMediaPanelNodes: true,
  })

  if (!ids.has('panel-1') || !ids.has('panel-2')) {
    throw new Error('expected panel overlay exclusion helper to include blanket and candidate rich media panel ids')
  }
  if (ids.has('image-1')) {
    throw new Error('expected non-panel candidate ids to stay out of the rich media panel exclusion set')
  }
}

export function testResolvePreferredRichMediaPanelNodeIdFollowsSharedPriorityOrder() {
  const graphData = {
    nodes: [
      { id: 'panel-selected', type: 'RichMediaPanel', label: 'Selected', properties: {} },
      { id: 'panel-flow-open', type: 'RichMediaPanel', label: 'Flow Open', properties: {} },
      { id: 'panel-open', type: 'RichMediaPanel', label: 'Open', properties: {} },
    ],
  } as Parameters<typeof resolvePreferredRichMediaPanelNodeId>[0]['graphData']

  const selectedId = resolvePreferredRichMediaPanelNodeId({
    graphData,
    selectedNodeId: 'panel-selected',
    selectedNodeIds: ['panel-open'],
    flowEditorOpenWidgetNodeIds: ['panel-flow-open'],
    openWidgetNodeIds: ['panel-open'],
  })
  if (selectedId !== 'panel-selected') {
    throw new Error(`expected selected rich media panel to win priority order, got ${selectedId}`)
  }

  const flowEditorOpenId = resolvePreferredRichMediaPanelNodeId({
    graphData,
    selectedNodeIds: ['missing'],
    flowEditorOpenWidgetNodeIds: ['panel-flow-open'],
    openWidgetNodeIds: ['panel-open'],
  })
  if (flowEditorOpenId !== 'panel-flow-open') {
    throw new Error(`expected flow editor open panel to beat generic open widget ids, got ${flowEditorOpenId}`)
  }
}
