import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GraphData } from '@/lib/graph/types'
import { computeZoomTargetNodeIds, computeZoomSubset } from '@/lib/zoom/selectionTargets'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { buildSimulation } from '@/components/GraphCanvas/utils'
import { createCanvasSlice } from '@/hooks/store/canvasSlice'
import type { GraphState } from '@/hooks/store/types'
import type { StoreApi } from 'zustand'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphNode } from '@/lib/graph/types'
import { readFitAllOptions } from '@/components/GraphCanvas/layout/fitConfig'
import * as d3 from 'd3'
import { computeZoomTransformFromRequest } from '@/lib/zoom/actions'
import {
  DEFAULT_FIT_PADDING,
  DEFAULT_FIT_TO_SCREEN_FILL_RATIO,
  computeFitFrame,
  ZOOM_VIEWPORT_PRESET_16_9,
} from 'grph-shared/zoom/presets'

const makeZoomGraph = (): GraphData => ({
  type: 'Graph',
  nodes: [
    { id: 'a', label: 'A', type: 'Entity', properties: {}, x: 0, y: 0 },
    { id: 'b', label: 'B', type: 'Entity', properties: {}, x: 10, y: 0 },
    { id: 'c', label: 'C', type: 'Entity', properties: {}, x: 20, y: 0 },
    { id: 'd', label: 'D', type: 'Entity', properties: {}, x: 100, y: 100 },
  ],
  edges: [
    { id: 'e1', source: 'a', target: 'b', label: 'relatedTo', properties: {} },
    { id: 'e2', source: 'b', target: 'c', label: 'relatedTo', properties: {} },
  ],
})

const makeCanvasSliceState = (): GraphState => {
  let state = {} as GraphState
  const get = () => state
  const set: StoreApi<GraphState>['setState'] = (partial, replace) => {
    if (typeof partial === 'function') {
      const next = partial(state)
      state = (replace ? next : { ...state, ...next }) as GraphState
    } else {
      state = (replace ? partial : { ...state, ...partial }) as GraphState
    }
  }
  const slice = createCanvasSlice(set, get)
  state = { ...state, ...slice }
  return state
}

export function testSelectionZoomNodeSelectionUsesNodeAndNeighbors() {
  const graphData = makeZoomGraph()
  const ids = computeZoomTargetNodeIds({
    graphData,
    selectedNodeId: 'b',
    selectedEdgeId: null,
  })
  if (!ids.has('a') || !ids.has('b') || !ids.has('c') || ids.size !== 3) {
    throw new Error('zoom node selection should include selected node and its neighbors')
  }
  const subset = computeZoomSubset({
    graphData,
    selectedNodeId: 'b',
    selectedEdgeId: null,
  })
  const subsetIds = new Set(subset.map(n => n.id))
  if (!subsetIds.has('a') || !subsetIds.has('b') || !subsetIds.has('c') || subsetIds.has('d')) {
    throw new Error('zoom subset for node selection should only include node and neighbors')
  }
}

export function testSelectionZoomEdgeSelectionUsesEndpointsAndNeighbors() {
  const graphData = makeZoomGraph()
  const ids = computeZoomTargetNodeIds({
    graphData,
    selectedNodeId: null,
    selectedEdgeId: 'e1',
  })
  if (!ids.has('a') || !ids.has('b') || !ids.has('c') || ids.size !== 3) {
    throw new Error('zoom edge selection should include endpoints and their neighbors')
  }
  const subset = computeZoomSubset({
    graphData,
    selectedNodeId: null,
    selectedEdgeId: 'e1',
  })
  const subsetIds = new Set(subset.map(n => n.id))
  if (!subsetIds.has('a') || !subsetIds.has('b') || !subsetIds.has('c') || subsetIds.has('d')) {
    throw new Error('zoom subset for edge selection should only include endpoints and neighbors')
  }
}

export function testSelectionZoomNoSelectionReturnsEmptySubset() {
  const graphData = makeZoomGraph()
  const ids = computeZoomTargetNodeIds({
    graphData,
    selectedNodeId: null,
    selectedEdgeId: null,
  })
  if (ids.size !== 0) {
    throw new Error('zoom target ids should be empty when nothing is selected')
  }
  const subset = computeZoomSubset({
    graphData,
    selectedNodeId: null,
    selectedEdgeId: null,
  })
  if (subset.length !== 0) {
    throw new Error('zoom subset should be empty when nothing is selected')
  }
}

export function testSelectionZoomGroupSelectionUsesGroupMembers() {
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [
      { id: 'a', label: 'A', type: 'Entity', properties: { 'visual:community': '1' }, x: 0, y: 0 },
      { id: 'b', label: 'B', type: 'Entity', properties: { 'visual:community': '1' }, x: 10, y: 0 },
      { id: 'c', label: 'C', type: 'Entity', properties: { 'visual:community': '2' }, x: 100, y: 0 },
    ],
    edges: [],
  }
  const ids = computeZoomTargetNodeIds({
    graphData,
    selectedNodeId: null,
    selectedEdgeId: null,
    selectedGroupId: 'community:1',
  })
  if (!ids.has('a') || !ids.has('b') || ids.has('c') || ids.size !== 2) {
    throw new Error('zoom group selection should include group member nodes only')
  }
  const subset = computeZoomSubset({
    graphData,
    selectedNodeId: null,
    selectedEdgeId: null,
    selectedGroupId: 'community:1',
  })
  const subsetIds = new Set(subset.map(n => String(n.id)))
  if (!subsetIds.has('a') || !subsetIds.has('b') || subsetIds.has('c') || subsetIds.size !== 2) {
    throw new Error('zoom subset for group selection should only include group member nodes')
  }
}

export function testSelectionZoomMultiSelectionDoesNotExpandNeighbors() {
  const graphData = makeZoomGraph()
  const ids = computeZoomTargetNodeIds({
    graphData,
    selectedNodeId: null,
    selectedEdgeId: null,
    selectedNodeIds: ['a', 'c'],
  })
  if (!ids.has('a') || !ids.has('c') || ids.has('b') || ids.size !== 2) {
    throw new Error('zoom multi node selection should not automatically expand to neighbors')
  }
}

export function testSelectionZoomResolvesCanonicalComposedNodeIdsAgainstLeafGraphNodes() {
  const graphData = makeZoomGraph()
  const ids = computeZoomTargetNodeIds({
    graphData,
    selectedNodeId: 'mermaid:demo:w-openai-text::b',
    selectedEdgeId: null,
  })
  if (!ids.has('a') || !ids.has('b') || !ids.has('c') || ids.has('d') || ids.size !== 3) {
    throw new Error('zoom target ids should resolve composed selection ids to matching leaf graph nodes before expanding neighbors')
  }
  const subset = computeZoomSubset({
    graphData,
    selectedNodeId: 'mermaid:demo:w-openai-text::b',
    selectedEdgeId: null,
  })
  const subsetIds = new Set(subset.map(n => String(n.id || '').trim()))
  if (!subsetIds.has('a') || !subsetIds.has('b') || !subsetIds.has('c') || subsetIds.has('d') || subsetIds.size !== 3) {
    throw new Error('zoom subset should resolve composed selection ids against leaf graph nodes')
  }
}

export function testSelectionZoomCentersGroupCentroidInViewport() {
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [
      { id: 'a', label: 'A', type: 'Entity', properties: { 'visual:community': '1' }, x: -50, y: 0 },
      { id: 'b', label: 'B', type: 'Entity', properties: { 'visual:community': '1' }, x: 50, y: 0 },
      { id: 'c', label: 'C', type: 'Entity', properties: { 'visual:community': '2' }, x: 400, y: 0 },
    ],
    edges: [],
  }

  const width = 800
  const height = 600
  const res = computeZoomTransformFromRequest({ type: 'selection' }, {
    graphData,
    schema: defaultSchema,
    graphDataRevision: 1,
    viewportW: width,
    viewportH: height,
    pinned: false,
    selectedNodeId: null,
    selectedEdgeId: null,
    selectedGroupId: 'community:1',
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedGroupIds: ['community:1'],
    currentTransform: d3.zoomIdentity,
    scaleExtent: { minK: 0.01, maxK: 8 },
    cacheKeyBase: 'test',
  })
  if (!res) throw new Error('expected selection zoom transform to be computed for group selection')

  const subset = computeZoomSubset({
    graphData,
    selectedNodeId: null,
    selectedEdgeId: null,
    selectedGroupId: 'community:1',
    selectedGroupIds: ['community:1'],
  })
  if (subset.length !== 2) throw new Error('expected subset to contain group member nodes')
  const cx = ((subset[0].x || 0) + (subset[1].x || 0)) / 2
  const cy = ((subset[0].y || 0) + (subset[1].y || 0)) / 2
  const t = res.nextTransform
  const screenX = t.k * cx + t.x
  const screenY = t.k * cy + t.y
  if (Math.abs(screenX - width / 2) > 1e-6 || Math.abs(screenY - height / 2) > 1e-6) {
    throw new Error('selection zoom should center selected group centroid in the viewport')
  }
}

export function testFitToScreenModeDefaultsOnAndFitsFullGraph() {
  const state = makeCanvasSliceState()
  if (state.fitToScreenMode !== true) {
    throw new Error('fitToScreenMode should default to true on canvas initialization')
  }
  const graphData = makeZoomGraph()
  const width = 800
  const height = 600
  const t = fitAllTransform(graphData.nodes, width, height)
  let sumX = 0
  let sumY = 0
  let count = 0
  for (let i = 0; i < graphData.nodes.length; i += 1) {
    const n = graphData.nodes[i]
    const x = n.x
    const y = n.y
    if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) continue
    sumX += x
    sumY += y
    count += 1
  }
  const cx = count > 0 ? sumX / count : 0
  const cy = count > 0 ? sumY / count : 0
  const screenCx = t.k * cx + t.x
  const screenCy = t.k * cy + t.y
  const targetCx = width / 2
  const targetCy = height / 2
  if (Math.abs(screenCx - targetCx) > 1e-6 || Math.abs(screenCy - targetCy) > 1e-6) {
    throw new Error('fitAllTransform should center the full graph in the viewport when Fit to Screen is active')
  }
}

export function testFitToScreenCentersSingleNodeGraph() {
  const width = 800
  const height = 600
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'n1', label: 'N1', type: 'Entity', properties: {}, x: 120, y: -40 }],
    edges: [],
  }
  const t = fitAllTransform(graphData.nodes, width, height)
  const node = graphData.nodes[0]
  const screenX = t.k * (node.x || 0) + t.x
  const screenY = t.k * (node.y || 0) + t.y
  const targetX = width / 2
  const targetY = height / 2
  if (Math.abs(screenX - targetX) > 1e-6 || Math.abs(screenY - targetY) > 1e-6) {
    throw new Error('fitAllTransform should center a single node graph in the viewport')
  }
}

export function testFitAllTransformRespectsCollisionPaddingInViewportFit() {
  const width = 1920
  const height = 1080
  const pad = 20
  const nodePadding = 12
  const nodes: GraphNode[] = [
    {
      id: 'n1',
      label: 'N1',
      type: 'Entity',
      properties: { 'visual:width': 320, 'visual:height': 180 },
      x: -800,
      y: -400,
    },
    {
      id: 'n2',
      label: 'N2',
      type: 'Entity',
      properties: { 'visual:width': 240, 'visual:height': 160 },
      x: 900,
      y: 500,
    },
    {
      id: 'n3',
      label: 'N3',
      type: 'Entity',
      properties: { 'visual:width': 200, 'visual:height': 120 },
      x: 0,
      y: 0,
    },
  ]

  const t = fitAllTransform(nodes, width, height, { pad, nodePadding })

  let minScreenX = Infinity
  let maxScreenX = -Infinity
  let minScreenY = Infinity
  let maxScreenY = -Infinity

  for (const n of nodes) {
    const x = n.x
    const y = n.y
    if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) {
      throw new Error('expected all nodes to have finite positions for collision padding test')
    }
    const vw = Number((n.properties || {})['visual:width']) || 0
    const vh = Number((n.properties || {})['visual:height']) || 0
    const halfW = (vw > 0 ? vw / 2 : 24) + nodePadding
    const halfH = (vh > 0 ? vh / 2 : 24) + nodePadding
    const sx = t.k * x + t.x
    const sy = t.k * y + t.y
    minScreenX = Math.min(minScreenX, sx - t.k * halfW)
    maxScreenX = Math.max(maxScreenX, sx + t.k * halfW)
    minScreenY = Math.min(minScreenY, sy - t.k * halfH)
    maxScreenY = Math.max(maxScreenY, sy + t.k * halfH)
  }

  if (minScreenX < pad - 1e-3) throw new Error('expected fitted graph to respect left viewport padding')
  if (maxScreenX > width - pad + 1e-3) throw new Error('expected fitted graph to respect right viewport padding')
  if (minScreenY < pad - 1e-3) throw new Error('expected fitted graph to respect top viewport padding')
  if (maxScreenY > height - pad + 1e-3) throw new Error('expected fitted graph to respect bottom viewport padding')

  let sumX = 0
  let sumY = 0
  for (const n of nodes) {
    sumX += n.x || 0
    sumY += n.y || 0
  }
  const centroidX = sumX / nodes.length
  const centroidY = sumY / nodes.length
  const screenCentroidX = t.k * centroidX + t.x
  const screenCentroidY = t.k * centroidY + t.y
  if (Math.abs(screenCentroidX - width / 2) > 1) {
    throw new Error('expected fitAllTransform to center by centroid X')
  }
  if (Math.abs(screenCentroidY - height / 2) > 1) {
    throw new Error('expected fitAllTransform to center by centroid Y')
  }
}

export function testFitAllTransformWithSchemaCentersGraphElementCentroidUnweighted() {
  const width = 1440
  const height = 980
  const nodes: GraphNode[] = [
    {
      id: 'wide',
      label: 'Wide',
      type: 'Entity',
      properties: { 'visual:width': 2400, 'visual:height': 1600 },
      x: 1000,
      y: 1000,
    },
    {
      id: 'plain-a',
      label: 'Plain A',
      type: 'Entity',
      properties: { 'visual:width': 120, 'visual:height': 80 },
      x: -500,
      y: -500,
    },
    {
      id: 'plain-b',
      label: 'Plain B',
      type: 'Entity',
      properties: { 'visual:width': 120, 'visual:height': 80 },
      x: -500,
      y: -500,
    },
  ]

  const t = fitAllTransform(nodes, width, height, {
    schema: defaultSchema,
    centerMode: 'centroid',
  })
  const centroidX = nodes.reduce((sum, n) => sum + (n.x || 0), 0) / nodes.length
  const centroidY = nodes.reduce((sum, n) => sum + (n.y || 0), 0) / nodes.length
  const screenCentroidX = t.k * centroidX + t.x
  const screenCentroidY = t.k * centroidY + t.y
  if (Math.abs(screenCentroidX - width / 2) > 1) {
    throw new Error('expected schema-backed fitAllTransform to center unweighted graph-element centroid X')
  }
  if (Math.abs(screenCentroidY - height / 2) > 1) {
    throw new Error('expected schema-backed fitAllTransform to center unweighted graph-element centroid Y')
  }
}

export function testFitAllTransformCentersFullCentroidWhenClusterFilteringBounds() {
  const width = 1440
  const height = 980
  const nodes: GraphNode[] = []
  for (let i = 0; i < 24; i += 1) {
    nodes.push({
      id: `cluster-${i}`,
      label: `Cluster ${i}`,
      type: 'Entity',
      x: i % 6,
      y: Math.floor(i / 6),
      properties: { 'visual:width': 80, 'visual:height': 40 },
    })
  }
  nodes.push({
    id: 'visible-tail',
    label: 'Visible tail',
    type: 'Entity',
    x: 1200,
    y: 800,
    properties: { 'visual:width': 80, 'visual:height': 40 },
  })

  const t = fitAllTransform(nodes, width, height, {
    schema: defaultSchema,
    centerMode: 'centroid',
    detectClusters: true,
  })
  const centroidX = nodes.reduce((sum, n) => sum + (n.x || 0), 0) / nodes.length
  const centroidY = nodes.reduce((sum, n) => sum + (n.y || 0), 0) / nodes.length
  const screenCentroidX = t.k * centroidX + t.x
  const screenCentroidY = t.k * centroidY + t.y
  if (Math.abs(screenCentroidX - width / 2) > 1) {
    throw new Error('expected cluster-filtered fit bounds to keep centering the full graph-element centroid X')
  }
  if (Math.abs(screenCentroidY - height / 2) > 1) {
    throw new Error('expected cluster-filtered fit bounds to keep centering the full graph-element centroid Y')
  }
}

export function testFitAllTransformTargetFillUsesCapped1920x1080Frame() {
  const pad = DEFAULT_FIT_PADDING
  const nodes: GraphNode[] = [
    { id: 'n1', label: 'N1', type: 'Entity', properties: { 'visual:width': 200, 'visual:height': 120 }, x: -500, y: -200 },
    { id: 'n2', label: 'N2', type: 'Entity', properties: { 'visual:width': 240, 'visual:height': 160 }, x: 600, y: 350 },
  ]

  const tCapped = fitAllTransform(nodes, 1920, 1080, { pad, targetFillRatio: DEFAULT_FIT_TO_SCREEN_FILL_RATIO })
  const tLarge = fitAllTransform(nodes, 3840, 2160, { pad, targetFillRatio: DEFAULT_FIT_TO_SCREEN_FILL_RATIO })

  if (Math.abs(tCapped.k - tLarge.k) > 1e-9) {
    throw new Error('expected targetFillRatio scaling to be computed on capped 1920×1080 frame')
  }
}

export function testFitAllTransformTargetFillUses80to20Ratio() {
  const pad = DEFAULT_FIT_PADDING
  const nodes: GraphNode[] = [
    { id: 'n1', label: 'N1', type: 'Entity', properties: { 'visual:width': 200, 'visual:height': 120 }, x: -500, y: -200 },
    { id: 'n2', label: 'N2', type: 'Entity', properties: { 'visual:width': 240, 'visual:height': 160 }, x: 600, y: 350 },
  ]
  const t = fitAllTransform(nodes, 3840, 2160, { pad, targetFillRatio: DEFAULT_FIT_TO_SCREEN_FILL_RATIO, enforceAspectRatio: true })
  const k = t.k
  if (!(typeof k === 'number' && Number.isFinite(k) && k > 0)) throw new Error('expected finite fit scale')
  const { frameW, frameH } = computeFitFrame(3840, 2160, ZOOM_VIEWPORT_PRESET_16_9)

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    const x = n.x || 0
    const y = n.y || 0
    const w = (n.properties as Record<string, unknown>)['visual:width']
    const h = (n.properties as Record<string, unknown>)['visual:height']
    const halfW = typeof w === 'number' && Number.isFinite(w) && w > 0 ? w / 2 : 24
    const halfH = typeof h === 'number' && Number.isFinite(h) && h > 0 ? h / 2 : 24
    minX = Math.min(minX, x - halfW)
    maxX = Math.max(maxX, x + halfW)
    minY = Math.min(minY, y - halfH)
    maxY = Math.max(maxY, y + halfH)
  }
  const bboxW = Math.max(1, maxX - minX)
  const bboxH = Math.max(1, maxY - minY)
  const screenW = bboxW * k
  const screenH = bboxH * k
  const targetW = frameW * DEFAULT_FIT_TO_SCREEN_FILL_RATIO
  const targetH = frameH * DEFAULT_FIT_TO_SCREEN_FILL_RATIO
  if (screenW > targetW + 1.0 && screenH > targetH + 1.0) {
    throw new Error('expected fit-to-screen to respect 80/20 target fill ratio on capped frame')
  }
}

export function testReadFitAllOptionsEnforces80to20FillRatioForAllFitIntents() {
  const schema = defaultSchema
  const mode = 'radial'
  const view = readFitAllOptions({ schema, mode, intent: 'fitToView' })
  const selection = readFitAllOptions({ schema, mode, intent: 'fitSelection' })
  const screen = readFitAllOptions({ schema, mode, intent: 'fitToScreen' })
  if (view.targetFillRatio !== DEFAULT_FIT_TO_SCREEN_FILL_RATIO) {
    throw new Error('expected fitToView to use default 80/20 target fill ratio')
  }
  if (selection.targetFillRatio !== DEFAULT_FIT_TO_SCREEN_FILL_RATIO) {
    throw new Error('expected fitSelection to use default 80/20 target fill ratio')
  }
  if (screen.targetFillRatio !== DEFAULT_FIT_TO_SCREEN_FILL_RATIO) {
    throw new Error('expected fitToScreen to use default 80/20 target fill ratio')
  }
}

export function testReadFitAllOptionsCentersD3FitToScreenByCentroid() {
  const schema = defaultSchema
  const mode = 'radial'
  const screen = readFitAllOptions({ schema, mode, intent: 'fitToScreen' })
  if (screen.centerMode !== 'centroid') {
    throw new Error('expected D3 fitToScreen options to center graph elements by centroid')
  }
  const svgRuntimeSource = readFileSync(
    resolve(process.cwd(), 'src/components/GraphCanvas/hooks/useSvgSurfaceZoomRuntime.ts'),
    'utf8',
  )
  if (!svgRuntimeSource.includes('readFitAllOptions')) {
    throw new Error('expected SVG surface runtime to reuse shared fit options')
  }
  if (svgRuntimeSource.includes("centerMode: 'bbox'") || svgRuntimeSource.includes('centerMode: "bbox"')) {
    throw new Error('expected SVG surface runtime to avoid a local bbox centering override')
  }
}

export function testGraphSceneRefitsCentroidAfterForceLayoutSettles() {
  const sceneSource = readFileSync(
    resolve(process.cwd(), 'src/components/GraphCanvas/scene.ts'),
    'utf8',
  )
  const sceneSetupSource = readFileSync(
    resolve(process.cwd(), 'src/components/GraphCanvasRoot/utils/d3SceneSetupContext.ts'),
    'utf8',
  )
  const layoutPrepSource = readFileSync(
    resolve(process.cwd(), 'src/components/GraphCanvasRoot/utils/d3SceneLayoutPrepContext.ts'),
    'utf8',
  )
  const graphCanvasRootSource = readFileSync(
    resolve(process.cwd(), 'src/components/GraphCanvasRoot/GraphCanvasRootImpl.tsx'),
    'utf8',
  )
  const autoZoomSource = readFileSync(
    resolve(process.cwd(), 'src/features/zoom/useAutoZoomModes2d.ts'),
    'utf8',
  )
  const zoomActionsSource = readFileSync(
    resolve(process.cwd(), 'src/lib/zoom/actions.ts'),
    'utf8',
  )
  if (!sceneSource.includes('const computeViewportFitTransform =')) {
    throw new Error('expected GraphCanvas scene to centralize viewport fit computation for initial and settled layout fits')
  }
  if (!sceneSource.includes('if (!initialZoomTransform && !hasGraphCanvasUserInteracted(svgEl)) {')) {
    throw new Error('expected settled D3 force layout fit to respect explicit zoom state and user interaction')
  }
  if (!sceneSource.includes("applyInitialTransform(computeViewportFitTransform(fitToScreenMode ? 'fitToScreen' : 'initialFit'))")) {
    throw new Error('expected settled D3 force layout to refit with the shared centroid fit options')
  }
  if (!sceneSource.includes('const schedulePostInitialFitToScreenTransform =') || !sceneSource.includes("applyInitialTransform(computeViewportFitTransform('fitToScreen'))")) {
    throw new Error('expected D3 fit-to-screen scenes to refit once after mounted node positions settle')
  }
  if (!sceneSource.includes('const readViewportFitNodes =') || !sceneSource.includes('const mountedNodes = nodesSelRef.current?.data()')) {
    throw new Error('expected D3 viewport fitting to use the mounted rendered node selection when available')
  }
  if (!sceneSource.includes('cancelAnimationFrame(postInitialFitRafId)')) {
    throw new Error('expected post-initial D3 fit-to-screen refit to be cancelled during scene cleanup')
  }
  if (!sceneSetupSource.includes('export function buildD3SceneGraphShapeKey') || !sceneSetupSource.includes(':shape:${buildD3SceneGraphShapeKey(args.sceneGraphData)}')) {
    throw new Error('expected D3 zoom view keys to include the rendered graph shape, not only metadata')
  }
  if (!layoutPrepSource.includes('const canReuseLastKnownZoomTransform =') || !layoutPrepSource.includes('args.prevLayoutViewKey === layoutViewKey')) {
    throw new Error('expected last-known D3 zoom reuse to be gated by the same layout view, not carried across graph-shape changes')
  }
  if (!graphCanvasRootSource.includes('const readAutoZoomGraph = useCallback(') || !graphCanvasRootSource.includes('getGraph: readAutoZoomGraph')) {
    throw new Error('expected GraphCanvasRoot D3 auto-fit mode to read the rendered scene graph, not the source graph')
  }
  if (!autoZoomSource.includes('lastFitSigRef.current = null\n    const schedule = scheduleFitRef.current')) {
    throw new Error('expected auto-fit signature cache to reset when the graph override changes')
  }
  if (!zoomActionsSource.includes('readGraphActiveDocumentViewMode') || zoomActionsSource.includes("if (args.documentSemanticMode === 'document') {\n    opts = applyDocumentSemanticFitPolicy")) {
    throw new Error('expected D3 zoom fit policy to use active document view mode instead of forcing document structure from semantic mode alone')
  }
}

export function testForceSimulationSeedsClusterAwarePositionsWhenMissing() {
  const width = 1920
  const height = 1080
  const nodes: GraphNode[] = [
    {
      id: 'a1',
      label: 'A1',
      type: 'MermaidNode',
      properties: { mermaidSubgraphName: 'ClusterA', 'visual:width': 180, 'visual:height': 120 },
    },
    {
      id: 'a2',
      label: 'A2',
      type: 'MermaidNode',
      properties: { mermaidSubgraphName: 'ClusterA', 'visual:width': 180, 'visual:height': 120 },
    },
    {
      id: 'b1',
      label: 'B1',
      type: 'MermaidNode',
      properties: { mermaidSubgraphName: 'ClusterB', 'visual:width': 180, 'visual:height': 120 },
    },
    {
      id: 'b2',
      label: 'B2',
      type: 'MermaidNode',
      properties: { mermaidSubgraphName: 'ClusterB', 'visual:width': 180, 'visual:height': 120 },
    },
    { id: 'u1', label: 'U1', type: 'Entity', properties: { 'visual:width': 120, 'visual:height': 80 } },
    { id: 'u2', label: 'U2', type: 'Entity', properties: { 'visual:width': 120, 'visual:height': 80 } },
  ]

  const schema = {
    ...defaultSchema,
    layout: {
      ...(defaultSchema.layout || {}),
      mode: 'force' as const,
    },
  }

  const sim = buildSimulation(nodes, [], width, height, schema)
  sim.stop()

  for (const n of nodes) {
    const x = n.x
    const y = n.y
    if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) {
      throw new Error('expected cluster-aware seed layout to assign finite node positions')
    }
  }

  const groupA = nodes.filter(n => (n.properties || {}).mermaidSubgraphName === 'ClusterA')
  const groupB = nodes.filter(n => (n.properties || {}).mermaidSubgraphName === 'ClusterB')
  const mean = (arr: GraphNode[]) => {
    let sx = 0
    let sy = 0
    for (const n of arr) {
      sx += n.x || 0
      sy += n.y || 0
    }
    return { x: sx / Math.max(1, arr.length), y: sy / Math.max(1, arr.length) }
  }
  const a = mean(groupA)
  const b = mean(groupB)
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 20) {
    throw new Error('expected different clusters to seed to distinct regions')
  }
}
