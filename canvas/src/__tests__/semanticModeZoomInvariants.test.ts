import type { GraphData } from '@/lib/graph/types'
import type { GraphState } from '@/hooks/store/types'
import type { StoreApi } from 'zustand'
import { defaultSchema } from '@/lib/graph/schema'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import { createUiSettingsSlice } from '@/hooks/store/uiSettingsSlice'
import { createSchemaSlice } from '@/hooks/store/schemaSlice'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const makeStoreHarness = () => {
  let state = {} as GraphState
  const set: StoreApi<GraphState>['setState'] = (partial, replace) => {
    if (typeof partial === 'function') {
      const next = partial(state)
      state = (replace ? next : { ...state, ...next }) as GraphState
    } else {
      state = (replace ? partial : { ...state, ...partial }) as GraphState
    }
  }
  return { get: () => state, set, bind: (slice: Partial<GraphState>) => { state = { ...state, ...slice } as GraphState } }
}

export function testSemanticModeSwitchCarriesZoomStateAcrossKeys() {
  const env = initJsdomHarness()
  try {
    const store = makeStoreHarness()
    store.bind(createUiSettingsSlice(store.set, store.get))

    const graphData: GraphData = {
      type: 'Graph',
      context: 'test',
      metadata: { kind: 'doc', source: 'test', sourceLayerHash: 'base:v1:abc' },
      nodes: [{ id: 'n1', label: 'N1', type: 'Entity', properties: { media_url: 'https://example.com/a.png' } }],
      edges: [],
    }

    store.bind({
      schema: { ...defaultSchema },
      graphData,
      canvasRenderMode: '2d',
      canvas2dRenderer: 'd3',
      frontmatterModeEnabled: true,
      documentStructureBaselineLock: false,
      renderMediaAsNodes: true,
      mediaPanelDensity: 'default',
      collapsedGroupIds: [],
      upsertUiToast: () => {},
    } as unknown as Partial<GraphState>)

    const prevKey = buildActive2dZoomViewKey({
      canvasRenderMode: store.get().canvasRenderMode,
      canvas2dRenderer: store.get().canvas2dRenderer,
      schema: store.get().schema,
      graphData: store.get().graphData as unknown as GraphData | null,
      documentSemanticMode: 'document',
      frontmatterModeEnabled: store.get().frontmatterModeEnabled,
      documentStructureBaselineLock: store.get().documentStructureBaselineLock,
      renderMediaAsNodes: store.get().renderMediaAsNodes,
      mediaPanelDensity: store.get().mediaPanelDensity,
      collapsedGroupIds: store.get().collapsedGroupIds,
    })
    if (!prevKey) throw new Error('expected prev zoom view key')
    store.bind({ zoomStateByKey: { [prevKey]: { k: 1.25, x: 12, y: -34 } } } as unknown as Partial<GraphState>)

    store.get().setDocumentSemanticMode('keyword')

    const nextKey = buildActive2dZoomViewKey({
      canvasRenderMode: store.get().canvasRenderMode,
      canvas2dRenderer: store.get().canvas2dRenderer,
      schema: store.get().schema,
      graphData: store.get().graphData as unknown as GraphData | null,
      documentSemanticMode: 'keyword',
      frontmatterModeEnabled: store.get().frontmatterModeEnabled,
      documentStructureBaselineLock: store.get().documentStructureBaselineLock,
      renderMediaAsNodes: store.get().renderMediaAsNodes,
      mediaPanelDensity: store.get().mediaPanelDensity,
      collapsedGroupIds: store.get().collapsedGroupIds,
    })
    if (!nextKey) throw new Error('expected next zoom view key')

    const prev = store.get().zoomStateByKey?.[prevKey]
    const next = store.get().zoomStateByKey?.[nextKey]
    if (!prev || !next) throw new Error('expected zoom states for both keys')
    if (prev.k !== next.k || prev.x !== next.x || prev.y !== next.y) {
      throw new Error('expected semantic mode switch to carry zoom state to next key')
    }
  } finally {
    env.restore()
  }
}

export function testSchemaUpdateCarriesZoomStateAcrossLayoutKey() {
  const env = initJsdomHarness()
  try {
    const store = makeStoreHarness()
    store.bind(createUiSettingsSlice(store.set, store.get))
    store.bind(createSchemaSlice(store.set, store.get))

    const graphData: GraphData = {
      type: 'Graph',
      context: 'test',
      metadata: { kind: 'doc', source: 'test', sourceLayerHash: 'base:v1:abc' },
      nodes: [{ id: 'n1', label: 'N1', type: 'Entity', properties: {} }],
      edges: [],
    }

    store.bind({
      schema: { ...defaultSchema },
      graphData,
      canvasRenderMode: '2d',
      canvas2dRenderer: 'd3',
      frontmatterModeEnabled: true,
      documentStructureBaselineLock: false,
      documentSemanticMode: 'document',
      renderMediaAsNodes: true,
      mediaPanelDensity: 'default',
      collapsedGroupIds: [],
      zoomStateByKey: {},
    } as unknown as Partial<GraphState>)

    const prevKey = buildActive2dZoomViewKey({
      canvasRenderMode: store.get().canvasRenderMode,
      canvas2dRenderer: store.get().canvas2dRenderer,
      schema: store.get().schema,
      graphData: store.get().graphData as unknown as GraphData | null,
      documentSemanticMode: store.get().documentSemanticMode,
      frontmatterModeEnabled: store.get().frontmatterModeEnabled,
      documentStructureBaselineLock: store.get().documentStructureBaselineLock,
      renderMediaAsNodes: store.get().renderMediaAsNodes,
      mediaPanelDensity: store.get().mediaPanelDensity,
      collapsedGroupIds: store.get().collapsedGroupIds,
    })
    if (!prevKey) throw new Error('expected prev zoom view key')
    store.bind({ zoomStateByKey: { [prevKey]: { k: 0.8, x: -20, y: 10 } } } as unknown as Partial<GraphState>)

    const nextSchema = {
      ...defaultSchema,
      layout: { ...(defaultSchema.layout || {}), mode: 'radial' as const },
    }
    store.get().setSchema(nextSchema)

    const nextKey = buildActive2dZoomViewKey({
      canvasRenderMode: store.get().canvasRenderMode,
      canvas2dRenderer: store.get().canvas2dRenderer,
      schema: store.get().schema,
      graphData: store.get().graphData as unknown as GraphData | null,
      documentSemanticMode: store.get().documentSemanticMode,
      frontmatterModeEnabled: store.get().frontmatterModeEnabled,
      documentStructureBaselineLock: store.get().documentStructureBaselineLock,
      renderMediaAsNodes: store.get().renderMediaAsNodes,
      mediaPanelDensity: store.get().mediaPanelDensity,
      collapsedGroupIds: store.get().collapsedGroupIds,
    })
    if (!nextKey) throw new Error('expected next zoom view key')

    const prev = store.get().zoomStateByKey?.[prevKey]
    const next = store.get().zoomStateByKey?.[nextKey]
    if (!prev || !next) throw new Error('expected zoom states for both keys')
    if (prev.k !== next.k || prev.x !== next.x || prev.y !== next.y) {
      throw new Error('expected schema update to carry zoom state to next key')
    }
  } finally {
    env.restore()
  }
}
