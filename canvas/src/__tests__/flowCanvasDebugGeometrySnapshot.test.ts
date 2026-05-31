import { JSDOM } from 'jsdom'
import React from 'react'
import { createRoot } from 'react-dom/client'

import FlowCanvas from '@/components/FlowCanvas'
import {
  __flowCanvasDebug,
  readFlowCanvasDebugGeometrySnapshot,
  readFlowCanvasDebugStatusLine,
  resetFlowCanvasDebugStatus,
  syncFlowCanvasDebugToast,
} from '@/components/FlowCanvas/flowCanvasDebug'
import { useGraphStore } from '@/hooks/useGraphStore'

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
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  g.ResizeObserver = ResizeObserverStub
  anyWindow.ResizeObserver = ResizeObserverStub
  g.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number
  g.cancelAnimationFrame = (id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>)
  anyWindow.requestAnimationFrame = g.requestAnimationFrame
  anyWindow.cancelAnimationFrame = g.cancelAnimationFrame

  const ctx = {
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
    if (type === '2d') return ctx as unknown as CanvasRenderingContext2D
    return null
  }
}

export async function testFlowCanvasDebugGeometrySnapshotPublishesWidgetAndRichMediaPlacement() {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  installDomStubs(dom)

  const priorState = useGraphStore.getState()
  __flowCanvasDebug.widgetWorldRectById = {}
  __flowCanvasDebug.richMediaRectById = {}

  useGraphStore.setState({
    graphData: {
      type: 'Graph',
      nodes: [
        { id: 'n1', label: 'n1', type: 'Anchor', x: 0, y: 0, properties: {} },
        {
          id: 'media-1',
          label: 'media-1',
          type: 'RichMediaPanel',
          x: 0,
          y: 0,
          properties: { imageUrl: 'https://example.com/image.png', 'visual:width': 240, 'visual:height': 180 },
        },
      ],
      edges: [],
      metadata: { kind: 'test', source: 'flowCanvasDebugGeometrySnapshot' },
    },
    graphDataRevision: (priorState.graphDataRevision || 0) + 1,
    canvasRenderMode: '2d',
    canvas2dRenderer: 'flowEditor',
    frontmatterModeEnabled: false,
    documentSemanticMode: 'document',
    documentStructureBaselineLock: false,
    zoomStateByKey: {},
    zoomState: { k: 1, x: 0, y: 0 },
    openWidgetNodeIds: ['n1'],
    flowWidgetPinnedByNodeId: {},
    flowWidgetWorldPosByNodeId: { n1: { x: 240, y: 220 } },
  })

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)

  const root = createRoot(host)
  root.render(React.createElement(FlowCanvas, { active: true }))

  await waitFor({
    ms: 5000,
    pollMs: 25,
    ok: () => {
      const widgetIds = Object.keys(__flowCanvasDebug.widgetWorldRectById || {})
      const mediaIds = Object.keys(__flowCanvasDebug.richMediaRectById || {})
      return widgetIds.length > 0 || mediaIds.length > 0
    },
  })

  const snapshot = readFlowCanvasDebugGeometrySnapshot()
  if (!snapshot.includes('widgets[') || !snapshot.includes('media[')) {
    throw new Error(`expected geometry snapshot to include widget and media sections, got ${snapshot}`)
  }

  root.unmount()
  useGraphStore.setState(priorState)
}

export function testFlowCanvasDebugStatusResetClearsStickyRecoveryToast() {
  const priorState = useGraphStore.getState()
  try {
    useGraphStore.setState({ uiToasts: [] })
    __flowCanvasDebug.lastRecoveryReason = 'workspace-open-offscreen-infinite-canvas-preserve-current'
    __flowCanvasDebug.lastRuntimeTransform = '10,20,1'
    __flowCanvasDebug.lastExpectedFit = '30,40,1'

    syncFlowCanvasDebugToast({ enabled: true })
    const beforeReset = useGraphStore.getState().uiToasts
    if (!beforeReset.some(toast => String(toast?.message || '').includes('workspace-open-offscreen-infinite-canvas-preserve-current'))) {
      throw new Error('expected flow canvas debug toast to surface the sticky infinite-canvas preservation reason before reset')
    }

    resetFlowCanvasDebugStatus({ dismissToast: true })

    if (__flowCanvasDebug.lastRecoveryReason || __flowCanvasDebug.lastRuntimeTransform || __flowCanvasDebug.lastExpectedFit) {
      throw new Error('expected flow canvas debug status reset to clear sticky recovery payload fields')
    }
    const afterReset = useGraphStore.getState().uiToasts
    if (afterReset.some(toast => String(toast?.message || '').startsWith('Flow status '))) {
      throw new Error('expected flow canvas debug status reset to dismiss the sticky runtime toast')
    }
    if (readFlowCanvasDebugStatusLine() !== 'Flow status - | t - | e -') {
      throw new Error(`expected cleared debug status line after reset, got ${readFlowCanvasDebugStatusLine()}`)
    }
  } finally {
    useGraphStore.setState(priorState)
    resetFlowCanvasDebugStatus({ dismissToast: true })
  }
}
