import { useGraphStore } from '@/hooks/useGraphStore'

export function testFlowWidgetUiStateIsScopedByGraphMetaKey() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'NODE_SVO', type: 'Node', label: 'SVO', properties: {} }],
    edges: [],
    metadata: { kind: 'frontmatter-flow', sourceLayerHash: 'graph-a' },
  } as never)

  useGraphStore.getState().setFlowWidgetPinnedByNodeId({ NODE_SVO: false })
  useGraphStore.getState().setFlowWidgetPosByNodeId({ NODE_SVO: { top: 10, left: 20 } })
  useGraphStore.getState().setFlowWidgetWorldPosByNodeId({ NODE_SVO: { x: 1, y: 2 } })

  const afterA = useGraphStore.getState()
  if (afterA.flowWidgetPinnedByNodeId.NODE_SVO !== false) throw new Error('expected pinned state for graph A')
  if (afterA.flowWidgetPosByNodeId.NODE_SVO?.top !== 10) throw new Error('expected pos for graph A')
  if (afterA.flowWidgetWorldPosByNodeId.NODE_SVO?.x !== 1) throw new Error('expected world pos for graph A')

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'NODE_SVO', type: 'Node', label: 'SVO', properties: {} }],
    edges: [],
    metadata: { kind: 'frontmatter-flow', sourceLayerHash: 'graph-b' },
  } as never)

  const afterB = useGraphStore.getState()
  if (Object.keys(afterB.flowWidgetPinnedByNodeId || {}).length !== 0) throw new Error('expected no pinned state for graph B')
  if (Object.keys(afterB.flowWidgetPosByNodeId || {}).length !== 0) throw new Error('expected no pos state for graph B')
  if (Object.keys(afterB.flowWidgetWorldPosByNodeId || {}).length !== 0) throw new Error('expected no world pos state for graph B')

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'NODE_SVO', type: 'Node', label: 'SVO', properties: {} }],
    edges: [],
    metadata: { kind: 'frontmatter-flow', sourceLayerHash: 'graph-a' },
  } as never)

  const afterARestore = useGraphStore.getState()
  if (afterARestore.flowWidgetPinnedByNodeId.NODE_SVO !== false) throw new Error('expected pinned restored for graph A')
  if (afterARestore.flowWidgetPosByNodeId.NODE_SVO?.left !== 20) throw new Error('expected pos restored for graph A')
  if (afterARestore.flowWidgetWorldPosByNodeId.NODE_SVO?.y !== 2) throw new Error('expected world pos restored for graph A')
}

export function testFlowWidgetUiStateCarriesAcrossSameSourceRecomposeHashChanges() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'NODE_TEXT', type: 'CustomWidget', label: 'Text Widget', properties: {} }],
    edges: [{ id: 'EDGE_A', source: 'NODE_TEXT', target: 'NODE_TEXT' }],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'typed-hash-a',
    },
  } as never)

  useGraphStore.getState().setFlowWidgetPinnedByNodeId({ NODE_TEXT: true })
  useGraphStore.getState().setFlowWidgetPosByNodeId({ NODE_TEXT: { top: 120, left: 240 } })
  useGraphStore.getState().setFlowWidgetWorldPosByNodeId({ NODE_TEXT: { x: 12, y: 24 } })

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'NODE_TEXT', type: 'CustomWidget', label: 'Text Widget', properties: { prompt: 'updated' } }],
    edges: [{ id: 'EDGE_A', source: 'NODE_TEXT', target: 'NODE_TEXT' }],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'typed-hash-b',
    },
  } as never)

  const after = useGraphStore.getState()
  if (after.flowWidgetPinnedByNodeId.NODE_TEXT !== true) {
    throw new Error('expected same-source recomposition to preserve pinned widget state across sourceLayerHash changes')
  }
  if (after.flowWidgetPosByNodeId.NODE_TEXT?.top !== 120 || after.flowWidgetPosByNodeId.NODE_TEXT?.left !== 240) {
    throw new Error('expected same-source recomposition to preserve widget viewport position across sourceLayerHash changes')
  }
  if (after.flowWidgetWorldPosByNodeId.NODE_TEXT?.x !== 12 || after.flowWidgetWorldPosByNodeId.NODE_TEXT?.y !== 24) {
    throw new Error('expected same-source recomposition to preserve widget world position across sourceLayerHash changes')
  }
}

export function testFrontmatterBuiltInFloatingScreenLayoutCarriesAcrossStableSameSourceRecompose() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'NODE_TEXT', type: 'TextGeneration', label: 'Text Widget', x: 120, y: 80, properties: {} }],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'frontmatter-hash-a',
    },
  } as never)

  useGraphStore.getState().setFlowWidgetPinnedByNodeId({ NODE_TEXT: false })
  useGraphStore.getState().setFlowWidgetPosByNodeId({ NODE_TEXT: { top: 180, left: 320 } })
  useGraphStore.getState().setFlowWidgetWorldPosByNodeId({ NODE_TEXT: { x: 16, y: 28 } })

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'NODE_TEXT', type: 'TextGeneration', label: 'Text Widget', x: 120, y: 80, properties: { prompt: 'updated' } }],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'frontmatter-hash-b',
    },
  } as never)

  const after = useGraphStore.getState()
  if (after.flowWidgetPinnedByNodeId.NODE_TEXT !== false) {
    throw new Error('expected stable same-source frontmatter recompose to preserve floating widget pinned semantics')
  }
  if (after.flowWidgetPosByNodeId.NODE_TEXT?.top !== 180 || after.flowWidgetPosByNodeId.NODE_TEXT?.left !== 320) {
    throw new Error('expected stable same-source frontmatter recompose to preserve initialized floating widget screen layout')
  }
  if (after.flowWidgetWorldPosByNodeId.NODE_TEXT?.x !== 16 || after.flowWidgetWorldPosByNodeId.NODE_TEXT?.y !== 28) {
    throw new Error('expected stable same-source frontmatter recompose to preserve derived widget world layout state')
  }
}

export function testFrontmatterBuiltInFloatingResidueClusterDoesNotCarryAcrossStableSameSourceRecompose() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [
      { id: 'NODE_TEXT_A', type: 'TextGeneration', label: 'Text A', x: 120, y: 80, properties: {} },
      { id: 'NODE_TEXT_B', type: 'TextGeneration', label: 'Text B', x: 180, y: 80, properties: {} },
      { id: 'NODE_TEXT_C', type: 'TextGeneration', label: 'Text C', x: 240, y: 80, properties: {} },
      { id: 'NODE_TEXT_D', type: 'TextGeneration', label: 'Text D', x: 300, y: 80, properties: {} },
    ],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'frontmatter-residue-a',
    },
  } as never)

  useGraphStore.getState().setFlowWidgetPinnedByNodeId({
    NODE_TEXT_A: false,
    NODE_TEXT_B: false,
    NODE_TEXT_C: false,
    NODE_TEXT_D: false,
  })
  useGraphStore.getState().setFlowWidgetPosByNodeId({
    NODE_TEXT_A: { top: 120, left: 320 },
    NODE_TEXT_B: { top: 760, left: 320 },
    NODE_TEXT_C: { top: 1400, left: 320 },
    NODE_TEXT_D: { top: 2040, left: 320 },
  })
  useGraphStore.getState().setFlowWidgetWorldPosByNodeId({
    NODE_TEXT_A: { x: 16, y: 28 },
    NODE_TEXT_B: { x: 18, y: 30 },
    NODE_TEXT_C: { x: 20, y: 32 },
    NODE_TEXT_D: { x: 22, y: 34 },
  })

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [
      { id: 'NODE_TEXT_A', type: 'TextGeneration', label: 'Text A', x: 120, y: 80, properties: { prompt: 'updated-a' } },
      { id: 'NODE_TEXT_B', type: 'TextGeneration', label: 'Text B', x: 180, y: 80, properties: { prompt: 'updated-b' } },
      { id: 'NODE_TEXT_C', type: 'TextGeneration', label: 'Text C', x: 240, y: 80, properties: { prompt: 'updated-c' } },
      { id: 'NODE_TEXT_D', type: 'TextGeneration', label: 'Text D', x: 300, y: 80, properties: { prompt: 'updated-d' } },
    ],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'frontmatter-residue-b',
    },
  } as never)

  const after = useGraphStore.getState()
  if (after.flowWidgetPinnedByNodeId.NODE_TEXT_A !== false) {
    throw new Error('expected stable same-source frontmatter recompose to preserve floating widget pinned semantics even when residue layout is stripped')
  }
  if (
    after.flowWidgetPosByNodeId.NODE_TEXT_A !== undefined
    || after.flowWidgetPosByNodeId.NODE_TEXT_B !== undefined
    || after.flowWidgetPosByNodeId.NODE_TEXT_C !== undefined
    || after.flowWidgetPosByNodeId.NODE_TEXT_D !== undefined
  ) {
    throw new Error('expected stable same-source frontmatter recompose to strip long-column residue screen layout for auto-managed built-in widgets')
  }
  if (after.flowWidgetWorldPosByNodeId.NODE_TEXT_A?.x !== 16 || after.flowWidgetWorldPosByNodeId.NODE_TEXT_D?.y !== 34) {
    throw new Error('expected stable same-source frontmatter recompose to preserve derived world layout state while clearing residue screen positions')
  }
}

export function testFrontmatterBuiltInFloatingPartialCoverageDoesNotCarryAcrossStableSameSourceRecompose() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [
      { id: 'NODE_TEXT_A', type: 'TextGeneration', label: 'Text A', x: 120, y: 80, properties: {} },
      { id: 'NODE_TEXT_B', type: 'ImageGeneration', label: 'Image B', x: 180, y: 80, properties: {} },
      { id: 'NODE_TEXT_C', type: 'VideoGeneration', label: 'Video C', x: 240, y: 80, properties: {} },
      { id: 'NODE_TEXT_D', type: 'RichMediaPanel', label: 'Panel D', x: 300, y: 80, properties: {} },
    ],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'frontmatter-partial-a',
    },
  } as never)

  useGraphStore.getState().setFlowWidgetPinnedByNodeId({
    NODE_TEXT_A: false,
    NODE_TEXT_B: false,
    NODE_TEXT_C: false,
    NODE_TEXT_D: false,
  })
  useGraphStore.getState().setFlowWidgetPosByNodeId({
    NODE_TEXT_A: { top: 180, left: 320 },
    NODE_TEXT_B: { top: 180, left: 760 },
  })
  useGraphStore.getState().setFlowWidgetWorldPosByNodeId({
    NODE_TEXT_A: { x: 16, y: 28 },
    NODE_TEXT_B: { x: 18, y: 30 },
    NODE_TEXT_C: { x: 20, y: 32 },
    NODE_TEXT_D: { x: 22, y: 34 },
  })

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [
      { id: 'NODE_TEXT_A', type: 'TextGeneration', label: 'Text A', x: 120, y: 80, properties: { prompt: 'updated-a' } },
      { id: 'NODE_TEXT_B', type: 'ImageGeneration', label: 'Image B', x: 180, y: 80, properties: { prompt: 'updated-b' } },
      { id: 'NODE_TEXT_C', type: 'VideoGeneration', label: 'Video C', x: 240, y: 80, properties: { prompt: 'updated-c' } },
      { id: 'NODE_TEXT_D', type: 'RichMediaPanel', label: 'Panel D', x: 300, y: 80, properties: { prompt: 'updated-d' } },
    ],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'frontmatter-partial-b',
    },
  } as never)

  const after = useGraphStore.getState()
  if (after.flowWidgetPinnedByNodeId.NODE_TEXT_A !== false) {
    throw new Error('expected stable same-source frontmatter recompose to preserve floating widget pinned semantics when partial screen coverage is cleared')
  }
  if (
    after.flowWidgetPosByNodeId.NODE_TEXT_A !== undefined
    || after.flowWidgetPosByNodeId.NODE_TEXT_B !== undefined
    || after.flowWidgetPosByNodeId.NODE_TEXT_C !== undefined
    || after.flowWidgetPosByNodeId.NODE_TEXT_D !== undefined
  ) {
    throw new Error('expected stable same-source frontmatter recompose to clear partial auto-managed screen coverage before indexing can replay a hybrid collective layout')
  }
  if (after.flowWidgetWorldPosByNodeId.NODE_TEXT_A?.x !== 16 || after.flowWidgetWorldPosByNodeId.NODE_TEXT_D?.y !== 34) {
    throw new Error('expected stable same-source frontmatter recompose to preserve derived world layout state while clearing partial screen coverage')
  }
}

export function testFrontmatterBuiltInPinnedCanvasResidueDoesNotCarryAcrossComposedSourceRecompose() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [
      { id: 'NODE_TEXT_A', type: 'TextGeneration', label: 'Text A', x: 120, y: 80, properties: {} },
      { id: 'NODE_TEXT_B', type: 'ImageGeneration', label: 'Image B', x: 180, y: 80, properties: {} },
      { id: 'NODE_TEXT_C', type: 'VideoGeneration', label: 'Video C', x: 240, y: 80, properties: {} },
      { id: 'NODE_TEXT_D', type: 'RichMediaPanel', label: 'Panel D', x: 300, y: 80, properties: {} },
    ],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'frontmatter-pinned-residue-a',
    },
  } as never)

  useGraphStore.getState().setFlowWidgetPinnedByNodeId({
    NODE_TEXT_A: true,
    NODE_TEXT_B: true,
    NODE_TEXT_C: true,
    NODE_TEXT_D: true,
  })
  useGraphStore.getState().setFlowWidgetWorldPosByNodeId({
    NODE_TEXT_A: { x: 16, y: 28 },
    NODE_TEXT_B: { x: 18, y: 30 },
    NODE_TEXT_C: { x: 20, y: 32 },
    NODE_TEXT_D: { x: 22, y: 34 },
  })

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [
      { id: 'ws:semantic::NODE_TEXT_A', type: 'TextGeneration', label: 'Text A', x: 120, y: 80, properties: { prompt: 'updated-a' } },
      { id: 'ws:semantic::NODE_TEXT_B', type: 'ImageGeneration', label: 'Image B', x: 180, y: 80, properties: { prompt: 'updated-b' } },
      { id: 'ws:semantic::NODE_TEXT_C', type: 'VideoGeneration', label: 'Video C', x: 240, y: 80, properties: { prompt: 'updated-c' } },
      { id: 'ws:semantic::NODE_TEXT_D', type: 'RichMediaPanel', label: 'Panel D', x: 300, y: 80, properties: { prompt: 'updated-d' } },
    ],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'frontmatter-pinned-residue-b',
    },
  } as never)

  const after = useGraphStore.getState()
  if (
    after.flowWidgetPinnedByNodeId['ws:semantic::NODE_TEXT_A'] === true
    || after.flowWidgetPinnedByNodeId['ws:semantic::NODE_TEXT_B'] === true
    || after.flowWidgetPinnedByNodeId['ws:semantic::NODE_TEXT_C'] === true
    || after.flowWidgetPinnedByNodeId['ws:semantic::NODE_TEXT_D'] === true
    || after.flowWidgetPinnedByNodeId.NODE_TEXT_A === true
  ) {
    throw new Error('expected composed frontmatter source hydration to strip stale pinned-canvas residue for auto-managed widgets')
  }
}

export function testFrontmatterBuiltInPinnedCanvasResidueCannotEnterRootSetter() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [
      { id: 'NODE_TEXT_A', type: 'TextGeneration', label: 'Text A', x: 120, y: 80, properties: {} },
      { id: 'NODE_PANEL_A', type: 'RichMediaPanel', label: 'Panel A', x: 180, y: 80, properties: {} },
      { id: 'NODE_CUSTOM_A', type: 'CustomNode', label: 'Custom A', x: 240, y: 80, properties: {} },
    ],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'frontmatter-root-setter-pinned-residue',
    },
  } as never)

  useGraphStore.getState().setFlowWidgetPinnedByNodeId({
    NODE_TEXT_A: true,
    NODE_PANEL_A: true,
    NODE_CUSTOM_A: true,
  })

  const after = useGraphStore.getState()
  if (after.flowWidgetPinnedByNodeId.NODE_TEXT_A === true || after.flowWidgetPinnedByNodeId.NODE_PANEL_A === true) {
    throw new Error('expected root pinned-state setter to reject frontmatter auto-managed pinned-canvas residue')
  }
  if (after.flowWidgetPinnedByNodeId.NODE_CUSTOM_A !== true) {
    throw new Error('expected root pinned-state setter to preserve non-auto-managed frontmatter widget pin state')
  }
}

export function testFlowWidgetOverlayStateDoesNotCarryAcrossSameSourceLayoutChanges() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'NODE_TEXT', type: 'CustomWidget', label: 'Text Widget', x: 0, y: 0, properties: {} }],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'layout-hash-a',
    },
  } as never)

  useGraphStore.getState().setFlowWidgetPinnedByNodeId({ NODE_TEXT: true })
  useGraphStore.getState().setFlowWidgetPosByNodeId({ NODE_TEXT: { top: 120, left: 240 } })
  useGraphStore.getState().setFlowWidgetWorldPosByNodeId({ NODE_TEXT: { x: 12, y: 24 } })

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'NODE_TEXT', type: 'CustomWidget', label: 'Text Widget', x: 640, y: 320, properties: {} }],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'layout-hash-b',
    },
  } as never)

  const after = useGraphStore.getState()
  if (after.flowWidgetPinnedByNodeId.NODE_TEXT !== undefined) {
    throw new Error('expected layout-changing same-source recomposition to reset pinned widget state')
  }
  if (after.flowWidgetPosByNodeId.NODE_TEXT !== undefined) {
    throw new Error('expected layout-changing same-source recomposition to reset widget viewport position')
  }
  if (after.flowWidgetWorldPosByNodeId.NODE_TEXT !== undefined) {
    throw new Error('expected layout-changing same-source recomposition to reset widget world position')
  }
}

export function testFrontmatterBuiltInFloatingBalancedLayoutCarriesAcrossSameSourceLayoutChanges() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [
      { id: 'NODE_TEXT_A', type: 'TextGeneration', label: 'Text A', x: 0, y: 0, properties: {} },
      { id: 'NODE_TEXT_B', type: 'ImageGeneration', label: 'Image B', x: 200, y: 0, properties: {} },
      { id: 'NODE_TEXT_C', type: 'VideoGeneration', label: 'Video C', x: 0, y: 200, properties: {} },
      { id: 'NODE_TEXT_D', type: 'RichMediaPanel', label: 'Panel D', x: 200, y: 200, properties: {} },
    ],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'balanced-layout-a',
    },
  } as never)

  useGraphStore.getState().setFlowWidgetPinnedByNodeId({
    NODE_TEXT_A: false,
    NODE_TEXT_B: false,
    NODE_TEXT_C: false,
    NODE_TEXT_D: false,
  })
  useGraphStore.getState().setFlowWidgetPosByNodeId({
    NODE_TEXT_A: { top: 140, left: 240 },
    NODE_TEXT_B: { top: 140, left: 720 },
    NODE_TEXT_C: { top: 760, left: 240 },
    NODE_TEXT_D: { top: 760, left: 720 },
  })
  useGraphStore.getState().setFlowWidgetWorldPosByNodeId({
    NODE_TEXT_A: { x: 16, y: 28 },
    NODE_TEXT_B: { x: 18, y: 30 },
    NODE_TEXT_C: { x: 20, y: 32 },
    NODE_TEXT_D: { x: 22, y: 34 },
  })

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [
      { id: 'NODE_TEXT_A', type: 'TextGeneration', label: 'Text A', x: 640, y: 320, properties: { prompt: 'updated-a' } },
      { id: 'NODE_TEXT_B', type: 'ImageGeneration', label: 'Image B', x: 960, y: 320, properties: { prompt: 'updated-b' } },
      { id: 'NODE_TEXT_C', type: 'VideoGeneration', label: 'Video C', x: 640, y: 640, properties: { prompt: 'updated-c' } },
      { id: 'NODE_TEXT_D', type: 'RichMediaPanel', label: 'Panel D', x: 960, y: 640, properties: { prompt: 'updated-d' } },
    ],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'balanced-layout-b',
    },
  } as never)

  const after = useGraphStore.getState()
  if (after.flowWidgetPinnedByNodeId.NODE_TEXT_A !== false || after.flowWidgetPinnedByNodeId.NODE_TEXT_D !== false) {
    throw new Error('expected balanced floating frontmatter collective to preserve floating pinned semantics across same-source layout changes')
  }
  if (
    after.flowWidgetPosByNodeId.NODE_TEXT_A?.top !== 140
    || after.flowWidgetPosByNodeId.NODE_TEXT_A?.left !== 240
    || after.flowWidgetPosByNodeId.NODE_TEXT_D?.top !== 760
    || after.flowWidgetPosByNodeId.NODE_TEXT_D?.left !== 720
  ) {
    throw new Error('expected balanced floating frontmatter collective to preserve screen-space layout across same-source layout changes')
  }
  if (after.flowWidgetWorldPosByNodeId.NODE_TEXT_A?.x !== 16 || after.flowWidgetWorldPosByNodeId.NODE_TEXT_D?.y !== 34) {
    throw new Error('expected balanced floating frontmatter collective to preserve world-space anchor state across same-source layout changes')
  }
}
