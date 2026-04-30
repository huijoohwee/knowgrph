import * as d3 from 'd3'

import {
  createFlowNativeRuntime,
  drawFlowNative,
  setFlowNativePresentation,
  setFlowNativeScene,
  setFlowNativeTransform,
} from '@/components/FlowCanvas/nativeRuntime'

const createFakeCtx = () => {
  const arcs: Array<{ x: number; y: number; r: number }> = []
  const ctx = {
    lineWidth: 0,
    fillStyle: '',
    strokeStyle: '',
    setTransform: () => void 0,
    clearRect: () => void 0,
    fillRect: () => void 0,
    translate: () => void 0,
    scale: () => void 0,
    save: () => void 0,
    restore: () => void 0,
    beginPath: () => void 0,
    arc: (x: number, y: number, r: number) => {
      arcs.push({ x, y, r })
    },
    fill: () => void 0,
    stroke: () => void 0,
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, arcs }
}

export const testFlowPortHandlesRenderWhenSelectedNodeGlyphHidden = () => {
  const { ctx, arcs } = createFakeCtx()
  const canvas = { width: 800, height: 600 } as unknown as HTMLCanvasElement
  const rt = createFlowNativeRuntime({
    canvas,
    ctx,
    viewportW: 800,
    viewportH: 600,
    dpr: 1,
    rankdir: 'LR',
    initialTransform: d3.zoomIdentity,
  })

  setFlowNativePresentation(rt, {
    labels: { nodeFontSizePx: 14, groupFontSizePx: 16, edgeFontSizePx: 12 },
    portHandles: { enabled: true, placement: 'cardinal', sizePx: 10, offsetPx: 2, strokeWidthPx: 1.5 },
    groups: {
      enabled: false,
      shape: 'rect',
      paddingPx: 24,
      labelTopExtraPx: 0,
      cornerRadiusPx: 12,
      strokeWidthPx: 1.5,
      fillOpacity: 0.08,
      depthStyle: { enabled: false, outerMaxBoostSteps: 0, outerStrokeWidthStepPx: 0, outerFillOpacityStep: 0 },
    },
    edges: {
      edgeType: 'bezier',
      strokeColor: '#64748b',
      strokeWidthPx: 1.5,
      animated: false,
      routing: { enabled: false, mode: 'ortho', obstacleAvoidance: false, marginPx: 10, laneStepPx: 56, maxLanes: 10 },
      underlay: { enabled: false, groupFadeAlpha: 0.65 },
    },
  })

  setFlowNativeTransform(rt, d3.zoomIdentity)

  setFlowNativeScene(rt, {
    nodes: [
      {
        id: 'n1',
        label: 'n1',
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        shape: 'rect',
        handles: { in: [{ id: 'in:e', topPct: 50 }], out: [{ id: 'out:e', topPct: 50 }] },
        inHandleTopPctById: { 'in:e': 50 },
        outHandleTopPctById: { 'out:e': 50 },
      },
    ],
    edges: [],
    nodeById: new Map(),
    groups: [],
    groupIdsByNodeId: new Map(),
  })

  const scene = rt.scene
  if (!scene) throw new Error('expected scene to be set')
  scene.nodeById.set('n1', scene.nodes[0])

  rt.dirty = true
  drawFlowNative(rt, { selectedNodeIds: ['n1'], selectedEdgeIds: [], hideNodeIds: ['n1'] })

  if (arcs.length <= 0) throw new Error('expected port handles to be drawn for hidden node')
}

export const testFlowPortHandlesCanBeHiddenForSelectedNodesWhenRequested = () => {
  const { ctx, arcs } = createFakeCtx()
  const canvas = { width: 800, height: 600 } as unknown as HTMLCanvasElement
  const rt = createFlowNativeRuntime({
    canvas,
    ctx,
    viewportW: 800,
    viewportH: 600,
    dpr: 1,
    rankdir: 'LR',
    initialTransform: d3.zoomIdentity,
  })

  setFlowNativePresentation(rt, {
    labels: { nodeFontSizePx: 14, groupFontSizePx: 16, edgeFontSizePx: 12 },
    portHandles: { enabled: true, placement: 'cardinal', sizePx: 10, offsetPx: 2, strokeWidthPx: 1.5 },
    groups: {
      enabled: false,
      shape: 'rect',
      paddingPx: 24,
      labelTopExtraPx: 0,
      cornerRadiusPx: 12,
      strokeWidthPx: 1.5,
      fillOpacity: 0.08,
      depthStyle: { enabled: false, outerMaxBoostSteps: 0, outerStrokeWidthStepPx: 0, outerFillOpacityStep: 0 },
    },
    edges: {
      edgeType: 'bezier',
      strokeColor: '#64748b',
      strokeWidthPx: 1.5,
      animated: false,
      routing: { enabled: false, mode: 'ortho', obstacleAvoidance: false, marginPx: 10, laneStepPx: 56, maxLanes: 10 },
      underlay: { enabled: false, groupFadeAlpha: 0.65 },
    },
  })

  setFlowNativeTransform(rt, d3.zoomIdentity)

  setFlowNativeScene(rt, {
    nodes: [
      {
        id: 'n1',
        label: 'n1',
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        shape: 'rect',
        handles: { in: [{ id: 'in:e', topPct: 50 }], out: [{ id: 'out:e', topPct: 50 }] },
        inHandleTopPctById: { 'in:e': 50 },
        outHandleTopPctById: { 'out:e': 50 },
      },
    ],
    edges: [],
    nodeById: new Map(),
    groups: [],
    groupIdsByNodeId: new Map(),
  })

  const scene = rt.scene
  if (!scene) throw new Error('expected scene to be set')
  scene.nodeById.set('n1', scene.nodes[0])

  rt.dirty = true
  drawFlowNative(rt, {
    selectedNodeIds: ['n1'],
    selectedEdgeIds: [],
    hideNodeIds: ['n1'],
    hidePortHandleNodeIds: ['n1'],
  })

  if (arcs.length !== 0) throw new Error(`expected port handles to be hidden when requested, got arcs=${arcs.length}`)
}
