import React from 'react'
import { createRoot } from 'react-dom/client'

import FlowEditorCanvas from '@/components/FlowEditorCanvas'
import { computeWidgetScale, computeWidgetScaledSize } from '@/components/FlowEditor/widgetZoom'
import { useGraphStore } from '@/hooks/useGraphStore'
import { viewportCenterToWorld } from '@/lib/zoom/viewport'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'

export async function testFlowEditorPinnedWidgetsInitCenteredEvenGrid() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) => setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame = anyWindow.requestAnimationFrame

    const api = useGraphStore.getState()
    api.resetAll()

    useGraphStore.setState(s => ({
      ...s,
      graphData: {
        type: 'Graph',
        nodes: [
          { id: 'n1', label: 'n1', type: 'Anchor', x: 0, y: 0, properties: {} },
          { id: 'n2', label: 'n2', type: 'Anchor', x: 0, y: 0, properties: {} },
          { id: 'n3', label: 'n3', type: 'Anchor', x: 0, y: 0, properties: {} },
          { id: 'n4', label: 'n4', type: 'Anchor', x: 0, y: 0, properties: {} },
        ],
        edges: [],
        metadata: { kind: 'test', source: 'flowEditorPinnedWidgetsSeed' },
      },
      graphDataRevision: (s.graphDataRevision || 0) + 1,
      canvasRenderMode: '2d',
      canvas2dRenderer: 'flow',
      frontmatterModeEnabled: false,
      documentSemanticMode: 'document',
      documentStructureBaselineLock: false,
    }))

    api.setZoomState({ k: 1, x: 0, y: 0 })
    api.setOpenWidgetNodeIds(['n1', 'n2', 'n3', 'n4'])
    api.setFlowWidgetWorldPosByNodeId({})
    api.setFlowWidgetPinnedByNodeId({})

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    root.render(React.createElement(FlowEditorCanvas, { active: true } as never))

    const ids = ['n1', 'n2', 'n3', 'n4']
    const waitForSeed = async () => {
      const deadline = Date.now() + 800
      while (Date.now() < deadline) {
        const st = useGraphStore.getState()
        const worldById =
          (st as unknown as { flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }> })
            .flowWidgetWorldPosByNodeId || {}
        const ok = ids.every(id => {
          const w = worldById[id]
          return w && Number.isFinite(w.x) && Number.isFinite(w.y)
        })
        if (ok) return worldById
        await new Promise<void>(resolve => setTimeout(() => resolve(), 5))
      }
      throw new Error('expected seeded world positions')
    }
    const worldById = await waitForSeed()

    const z = { k: 1, x: 0, y: 0 }
    const viewportW = 800
    const viewportH = 600
    const center = viewportCenterToWorld({ transform: z, viewportW, viewportH })
    const panelScale = computeWidgetScale(z.k, null, { mode: 'pinnedInCanvas' })
    const panelScreen = computeWidgetScaledSize(panelScale)
    const panelWorldW = panelScreen.width / z.k
    const panelWorldH = panelScreen.height / z.k

    const centers = ids.map(id => {
      const p = worldById[id]!
      return { x: p.x + panelWorldW / 2, y: p.y + panelWorldH / 2 }
    })
    const centroid = centers.reduce((acc, c) => ({ x: acc.x + c.x, y: acc.y + c.y }), { x: 0, y: 0 })
    centroid.x /= centers.length
    centroid.y /= centers.length

    if (Math.abs(centroid.x - center.x) > 2 || Math.abs(centroid.y - center.y) > 2) {
      throw new Error(`expected centroid ~${center.x},${center.y} got ${centroid.x},${centroid.y}`)
    }

    const rects = ids.map(id => {
      const p = worldById[id]!
      const left = p.x * z.k + z.x
      const top = p.y * z.k + z.y
      return { id, left, top, right: left + panelScreen.width, bottom: top + panelScreen.height }
    })
    for (let i = 0; i < rects.length; i += 1) {
      const a = rects[i]!
      for (let j = i + 1; j < rects.length; j += 1) {
        const b = rects[j]!
        const overlapX = a.left < b.right && b.left < a.right
        const overlapY = a.top < b.bottom && b.top < a.bottom
        if (overlapX && overlapY) throw new Error(`expected no overlap: ${a.id} vs ${b.id}`)
      }
    }
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testFlowEditorPinnedWidgetsReseedWhenViewportStabilizes() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
      ResizeObserver?: new (cb: ResizeObserverCallback) => ResizeObserver
    }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) => setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame = anyWindow.requestAnimationFrame

    const resizeObservers: ResizeObserverCallback[] = []
    class ResizeObserverStub {
      callback: ResizeObserverCallback
      constructor(cb: ResizeObserverCallback) {
        this.callback = cb
        resizeObservers.push(cb)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub
    anyWindow.ResizeObserver = ResizeObserverStub as unknown as new (cb: ResizeObserverCallback) => ResizeObserver

    const api = useGraphStore.getState()
    api.resetAll()

    useGraphStore.setState(s => ({
      ...s,
      graphData: {
        type: 'Graph',
        nodes: [
          { id: 'n1', label: 'n1', type: 'Anchor', x: 0, y: 0, properties: {} },
          { id: 'n2', label: 'n2', type: 'Anchor', x: 0, y: 0, properties: {} },
          { id: 'n3', label: 'n3', type: 'Anchor', x: 0, y: 0, properties: {} },
          { id: 'n4', label: 'n4', type: 'Anchor', x: 0, y: 0, properties: {} },
        ],
        edges: [],
        metadata: { kind: 'test', source: 'flowEditorPinnedWidgetsViewportResize' },
      },
      graphDataRevision: (s.graphDataRevision || 0) + 1,
      canvasRenderMode: '2d',
      canvas2dRenderer: 'flowEditor',
      frontmatterModeEnabled: false,
      documentSemanticMode: 'document',
      documentStructureBaselineLock: false,
    }))

    api.setZoomState({ k: 1, x: 0, y: 0 })
    api.setOpenWidgetNodeIds(['n1', 'n2', 'n3', 'n4'])
    api.setFlowWidgetWorldPosByNodeId({})
    api.setFlowWidgetPinnedByNodeId({})

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(FlowEditorCanvas, { active: true } as never))

    const ids = ['n1', 'n2', 'n3', 'n4']
    const readWorld = () =>
      ((useGraphStore.getState() as unknown as { flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }> })
        .flowWidgetWorldPosByNodeId || {}) as Record<string, { x: number; y: number }>
    const waitForSeed = async () => {
      const deadline = Date.now() + 1200
      while (Date.now() < deadline) {
        const worldById = readWorld()
        const ok = ids.every(id => {
          const w = worldById[id]
          return w && Number.isFinite(w.x) && Number.isFinite(w.y)
        })
        if (ok) return worldById
        await new Promise<void>(resolve => setTimeout(resolve, 5))
      }
      throw new Error('expected seeded world positions')
    }

    const initialWorld = await waitForSeed()
    const measureRoot = await (async () => {
      const deadline = Date.now() + 1200
      while (Date.now() < deadline) {
        const viewportRoot = doc.querySelector('[data-kg-canvas-viewport-root="1"]') as HTMLElement | null
        if (viewportRoot) return viewportRoot
        const flowEditorRoot = doc.querySelector('[aria-label="Flow Editor"]') as HTMLElement | null
        if (flowEditorRoot) return flowEditorRoot
        await new Promise<void>(resolve => setTimeout(resolve, 5))
      }
      throw new Error('expected Flow Editor measurement root')
    })()

    measureRoot.getBoundingClientRect = () =>
      ({
        left: 540,
        top: 24,
        width: 260,
        height: 600,
        right: 800,
        bottom: 624,
        x: 540,
        y: 24,
        toJSON: () => ({}),
      }) as DOMRect

    for (let i = 0; i < resizeObservers.length; i += 1) {
      resizeObservers[i]!([] as ResizeObserverEntry[], {} as ResizeObserver)
    }

    const resizedWorld = await (async () => {
      const deadline = Date.now() + 1200
      while (Date.now() < deadline) {
        const worldById = readWorld()
        const moved = ids.some(id => {
          const a = initialWorld[id]
          const b = worldById[id]
          return !!a && !!b && (Math.abs(a.x - b.x) > 0.0001 || Math.abs(a.y - b.y) > 0.0001)
        })
        if (moved) return worldById
        await new Promise<void>(resolve => setTimeout(resolve, 5))
      }
      throw new Error('expected reseeded world positions after viewport resize')
    })()

    const z = { k: 1, x: 0, y: 0 }
    const center = viewportCenterToWorld({ transform: z, viewportW: 260, viewportH: 600 })
    const panelScale = computeWidgetScale(z.k, null, { mode: 'pinnedInCanvas' })
    const panelScreen = computeWidgetScaledSize(panelScale)
    const panelWorldW = panelScreen.width / z.k
    const panelWorldH = panelScreen.height / z.k
    const centers = ids.map(id => {
      const p = resizedWorld[id]!
      return { x: p.x + panelWorldW / 2, y: p.y + panelWorldH / 2 }
    })
    const centroid = centers.reduce((acc, c) => ({ x: acc.x + c.x, y: acc.y + c.y }), { x: 0, y: 0 })
    centroid.x /= centers.length
    centroid.y /= centers.length

    if (Math.abs(centroid.x - center.x) > 2 || Math.abs(centroid.y - center.y) > 2) {
      throw new Error(`expected resized centroid ~${center.x},${center.y} got ${centroid.x},${centroid.y}`)
    }
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testFlowEditorPinnedWidgetsReseedWhenInitiallyStacked() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) => setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame = anyWindow.requestAnimationFrame

    const api = useGraphStore.getState()
    api.resetAll()

    useGraphStore.setState(s => ({
      ...s,
      graphData: {
        type: 'Graph',
        nodes: [
          { id: 'n1', label: 'n1', type: 'Anchor', x: 0, y: 0, properties: {} },
          { id: 'n2', label: 'n2', type: 'Anchor', x: 0, y: 0, properties: {} },
          { id: 'n3', label: 'n3', type: 'Anchor', x: 0, y: 0, properties: {} },
          { id: 'n4', label: 'n4', type: 'Anchor', x: 0, y: 0, properties: {} },
        ],
        edges: [],
        metadata: { kind: 'test', source: 'flowEditorPinnedWidgetsInitialStack' },
      },
      graphDataRevision: (s.graphDataRevision || 0) + 1,
      canvasRenderMode: '2d',
      canvas2dRenderer: 'flowEditor',
      frontmatterModeEnabled: false,
      documentSemanticMode: 'document',
      documentStructureBaselineLock: false,
    }))

    api.setZoomState({ k: 1, x: 0, y: 0 })
    api.setOpenWidgetNodeIds(['n1', 'n2', 'n3', 'n4'])
    api.setFlowWidgetPinnedByNodeId({})
    api.setFlowWidgetWorldPosByNodeId({
      n1: { x: 400, y: 300 },
      n2: { x: 400, y: 300 },
      n3: { x: 400, y: 300 },
      n4: { x: 400, y: 300 },
    })

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(FlowEditorCanvas, { active: true } as never))

    const ids = ['n1', 'n2', 'n3', 'n4']
    const readWorld = () =>
      ((useGraphStore.getState() as unknown as { flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }> })
        .flowWidgetWorldPosByNodeId || {}) as Record<string, { x: number; y: number }>

    const worldById = await (async () => {
      const deadline = Date.now() + 1200
      while (Date.now() < deadline) {
        const current = readWorld()
        const unique = new Set(ids.map(id => `${Math.round((current[id]?.x || 0) * 1000)}:${Math.round((current[id]?.y || 0) * 1000)}`))
        if (unique.size >= 2) return current
        await new Promise<void>(resolve => setTimeout(resolve, 5))
      }
      throw new Error('expected stacked widgets to reseed into spread positions')
    })()

    const panelScale = computeWidgetScale(1, null, { mode: 'pinnedInCanvas' })
    const panelScreen = computeWidgetScaledSize(panelScale)
    const rects = ids.map(id => {
      const p = worldById[id]!
      return { id, left: p.x, top: p.y, right: p.x + panelScreen.width, bottom: p.y + panelScreen.height }
    })
    for (let i = 0; i < rects.length; i += 1) {
      const a = rects[i]!
      for (let j = i + 1; j < rects.length; j += 1) {
        const b = rects[j]!
        const overlapX = a.left < b.right && b.left < a.right
        const overlapY = a.top < b.bottom && b.top < a.bottom
        if (overlapX && overlapY) throw new Error(`expected no overlap after reseed: ${a.id} vs ${b.id}`)
      }
    }
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testFlowEditorPinnedWidgetsReseedWhenInitiallyVerticalStrip() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) => setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame = anyWindow.requestAnimationFrame

    const api = useGraphStore.getState()
    api.resetAll()

    useGraphStore.setState(s => ({
      ...s,
      graphData: {
        type: 'Graph',
        nodes: [
          { id: 'n1', label: 'n1', type: 'Anchor', x: 0, y: 0, properties: {} },
          { id: 'n2', label: 'n2', type: 'Anchor', x: 0, y: 0, properties: {} },
          { id: 'n3', label: 'n3', type: 'Anchor', x: 0, y: 0, properties: {} },
          { id: 'n4', label: 'n4', type: 'Anchor', x: 0, y: 0, properties: {} },
        ],
        edges: [],
        metadata: { kind: 'test', source: 'flowEditorPinnedWidgetsVerticalStrip' },
      },
      graphDataRevision: (s.graphDataRevision || 0) + 1,
      canvasRenderMode: '2d',
      canvas2dRenderer: 'flowEditor',
      frontmatterModeEnabled: false,
      documentSemanticMode: 'document',
      documentStructureBaselineLock: false,
    }))

    api.setZoomState({ k: 1, x: 0, y: 0 })
    api.setOpenWidgetNodeIds(['n1', 'n2', 'n3', 'n4'])
    api.setFlowWidgetPinnedByNodeId({})
    api.setFlowWidgetWorldPosByNodeId({
      n1: { x: 400, y: 40 },
      n2: { x: 400, y: 220 },
      n3: { x: 400, y: 400 },
      n4: { x: 400, y: 580 },
    })

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(FlowEditorCanvas, { active: true } as never))

    const ids = ['n1', 'n2', 'n3', 'n4']
    const readWorld = () =>
      ((useGraphStore.getState() as unknown as { flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }> })
        .flowWidgetWorldPosByNodeId || {}) as Record<string, { x: number; y: number }>

    const worldById = await (async () => {
      const deadline = Date.now() + 1200
      while (Date.now() < deadline) {
        const current = readWorld()
        const uniqueX = new Set(ids.map(id => Math.round((current[id]?.x || 0) * 1000)))
        if (uniqueX.size >= 2) return current
        await new Promise<void>(resolve => setTimeout(resolve, 5))
      }
      throw new Error('expected vertical-strip widgets to reseed into spread positions')
    })()

    const uniqueX = new Set(ids.map(id => Math.round((worldById[id]?.x || 0) * 1000)))
    if (uniqueX.size < 2) throw new Error('expected reseeded vertical-strip widgets to use multiple columns')
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}
