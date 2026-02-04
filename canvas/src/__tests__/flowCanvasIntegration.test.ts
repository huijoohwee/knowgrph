import { JSDOM } from 'jsdom'
import React from 'react'
import { createRoot } from 'react-dom/client'

import FlowCanvas, { __flowCanvasDebug } from '@/components/FlowCanvas'
import { useGraphStore } from '@/hooks/useGraphStore'

type Ctx2d = Partial<CanvasRenderingContext2D>

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

const waitFor = async (args: { ms: number; pollMs: number; ok: () => boolean }) => {
  const deadline = Date.now() + Math.max(1, args.ms)
  while (Date.now() < deadline) {
    if (args.ok()) return
    await sleep(Math.max(1, args.pollMs))
  }
  throw new Error('timed out waiting for condition')
}

const installDomStubs = (dom: JSDOM) => {
  const g = globalThis as unknown as {
    window?: unknown
    document?: unknown
    navigator?: unknown
    ResizeObserver?: unknown
    requestAnimationFrame?: unknown
    cancelAnimationFrame?: unknown
  }

  g.window = dom.window
  g.document = dom.window.document
  try {
    Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
  } catch {
    void 0
  }

  const anyWindow = dom.window as unknown as {
    ResizeObserver?: unknown
    requestAnimationFrame?: unknown
    cancelAnimationFrame?: unknown
  }

  class ResizeObserverStub {
    callback: ResizeObserverCallback
    constructor(cb: ResizeObserverCallback) {
      this.callback = cb
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  g.ResizeObserver = ResizeObserverStub
  anyWindow.ResizeObserver = ResizeObserverStub

  g.requestAnimationFrame = (cb: FrameRequestCallback) => {
    return setTimeout(() => cb(Date.now()), 0) as unknown as number
  }
  g.cancelAnimationFrame = (id: number) => {
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>)
  }
  anyWindow.requestAnimationFrame = g.requestAnimationFrame
  anyWindow.cancelAnimationFrame = g.cancelAnimationFrame

  const ctx: Ctx2d = {
    save: () => {},
    restore: () => {},
    setTransform: () => {},
    clearRect: () => {},
    fillRect: () => {},
    translate: () => {},
    scale: () => {},
    beginPath: () => {},
    rect: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    bezierCurveTo: () => {},
    quadraticCurveTo: () => {},
    fillText: () => {},
  }

  dom.window.HTMLCanvasElement.prototype.getContext = function (type: string) {
    if (type === '2d') return ctx as CanvasRenderingContext2D
    return null
  }
}

export const testFlowCanvasUsesActiveGraphRenderDataAndZoomState = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  installDomStubs(dom)

  const priorState = useGraphStore.getState()

  const baseGraphData = {
    type: 'Graph',
    nodes: [{ id: 'n1', label: 'Alpha Beta Gamma', type: 'Note', properties: {} }],
    edges: [],
    metadata: { kind: 'test', source: 'flowCanvasIntegration' },
  }

  useGraphStore.setState({
    graphData: baseGraphData,
    graphDataRevision: (priorState.graphDataRevision || 0) + 1,
    frontmatterModeEnabled: false,
    documentSemanticMode: 'document',
    zoomRequest: null,
    zoomStateByKey: {},
    zoomState: { k: 1, x: 0, y: 0 },
  })

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)

  const root = createRoot(host)
  root.render(React.createElement(FlowCanvas, { active: true }))

  await waitFor({
    ms: 5_000,
    pollMs: 25,
    ok: () => __flowCanvasDebug.lastBuiltSceneKey.length > 0 && __flowCanvasDebug.lastBuiltSceneNodeCount === 1,
  })

  useGraphStore.setState({ documentSemanticMode: 'keyword' })
  await waitFor({
    ms: 10_000,
    pollMs: 25,
    ok: () => __flowCanvasDebug.lastBuiltSceneNodeCount > 1,
  })

  const key = String(__flowCanvasDebug.lastZoomViewKey || '')
  if (!key) throw new Error('expected FlowCanvas to publish a zoom view key')

  useGraphStore.getState().requestZoom('in')
  await waitFor({
    ms: 5_000,
    pollMs: 25,
    ok: () => {
      const s = useGraphStore.getState()
      const byKey = s.zoomStateByKey?.[key]
      return !!byKey && typeof byKey.k === 'number' && byKey.k > 1
    },
  })

  root.unmount()
  useGraphStore.setState({
    graphData: priorState.graphData,
    graphDataRevision: priorState.graphDataRevision,
    frontmatterModeEnabled: priorState.frontmatterModeEnabled,
    documentSemanticMode: priorState.documentSemanticMode,
    zoomRequest: priorState.zoomRequest,
    zoomStateByKey: priorState.zoomStateByKey,
    zoomState: priorState.zoomState,
  })
}

export const testFlowCanvasAutoFitToScreenRunsInFlowRenderer = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  installDomStubs(dom)

  const priorState = useGraphStore.getState()

  const baseGraphData = {
    type: 'Graph',
    nodes: [{ id: 'n1', label: 'Alpha Beta Gamma', type: 'Note', properties: {} }],
    edges: [],
    metadata: { kind: 'test', source: 'flowCanvasAutoFit' },
  }

  useGraphStore.setState({
    graphData: baseGraphData,
    graphDataRevision: (priorState.graphDataRevision || 0) + 1,
    frontmatterModeEnabled: false,
    documentSemanticMode: 'document',
    fitToScreenMode: true,
    viewPinned: false,
    zoomRequest: null,
    zoomStateByKey: {},
    zoomState: { k: 2, x: 100, y: 100 },
  })

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)
  root.render(React.createElement(FlowCanvas, { active: true }))

  await waitFor({
    ms: 5_000,
    pollMs: 25,
    ok: () => __flowCanvasDebug.lastBuiltSceneKey.length > 0,
  })

  const key = String(__flowCanvasDebug.lastZoomViewKey || '')
  if (!key) throw new Error('expected FlowCanvas to publish a zoom view key')

  await waitFor({
    ms: 10_000,
    pollMs: 25,
    ok: () => {
      const s = useGraphStore.getState()
      const byKey = s.zoomStateByKey?.[key]
      if (!byKey) return false
      if (typeof byKey.k !== 'number' || typeof byKey.x !== 'number' || typeof byKey.y !== 'number') return false
      return byKey.k !== 2 || byKey.x !== 100 || byKey.y !== 100
    },
  })

  root.unmount()
  useGraphStore.setState({
    graphData: priorState.graphData,
    graphDataRevision: priorState.graphDataRevision,
    frontmatterModeEnabled: priorState.frontmatterModeEnabled,
    documentSemanticMode: priorState.documentSemanticMode,
    fitToScreenMode: priorState.fitToScreenMode,
    viewPinned: priorState.viewPinned,
    zoomRequest: priorState.zoomRequest,
    zoomStateByKey: priorState.zoomStateByKey,
    zoomState: priorState.zoomState,
  })
}

export const testFlowCanvasAutoZoomToSelectionRunsInFlowRenderer = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  installDomStubs(dom)

  const priorState = useGraphStore.getState()

  const baseGraphData = {
    type: 'Graph',
    nodes: [
      { id: 'n1', label: 'Alpha', type: 'Note', properties: {}, x: 0, y: 0 },
      { id: 'n2', label: 'Beta', type: 'Note', properties: {}, x: 200, y: 0 },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2', label: 'rel', properties: {} }],
    metadata: { kind: 'test', source: 'flowCanvasAutoZoomSelection' },
  }

  useGraphStore.setState({
    graphData: baseGraphData,
    graphDataRevision: (priorState.graphDataRevision || 0) + 1,
    frontmatterModeEnabled: false,
    documentSemanticMode: 'document',
    zoomToSelectionMode: true,
    viewPinned: false,
    selectedNodeId: null,
    selectedEdgeId: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    zoomRequest: null,
    zoomStateByKey: {},
    zoomState: { k: 1, x: 0, y: 0 },
  })

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)
  root.render(React.createElement(FlowCanvas, { active: true }))

  await waitFor({
    ms: 5_000,
    pollMs: 25,
    ok: () => __flowCanvasDebug.lastBuiltSceneKey.length > 0,
  })

  const key = String(__flowCanvasDebug.lastZoomViewKey || '')
  if (!key) throw new Error('expected FlowCanvas to publish a zoom view key')

  useGraphStore.setState({ selectedNodeId: 'n1' })

  await waitFor({
    ms: 10_000,
    pollMs: 25,
    ok: () => {
      const s = useGraphStore.getState()
      const byKey = s.zoomStateByKey?.[key]
      if (!byKey) return false
      if (typeof byKey.x !== 'number' || typeof byKey.y !== 'number' || typeof byKey.k !== 'number') return false
      return byKey.x !== 0 || byKey.y !== 0 || byKey.k !== 1
    },
  })

  root.unmount()
  useGraphStore.setState({
    graphData: priorState.graphData,
    graphDataRevision: priorState.graphDataRevision,
    frontmatterModeEnabled: priorState.frontmatterModeEnabled,
    documentSemanticMode: priorState.documentSemanticMode,
    zoomToSelectionMode: priorState.zoomToSelectionMode,
    viewPinned: priorState.viewPinned,
    selectedNodeId: priorState.selectedNodeId,
    selectedEdgeId: priorState.selectedEdgeId,
    selectedNodeIds: priorState.selectedNodeIds,
    selectedEdgeIds: priorState.selectedEdgeIds,
    zoomRequest: priorState.zoomRequest,
    zoomStateByKey: priorState.zoomStateByKey,
    zoomState: priorState.zoomState,
  })
}
