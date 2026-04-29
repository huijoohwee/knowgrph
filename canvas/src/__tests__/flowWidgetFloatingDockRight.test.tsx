import React from 'react'
import { createRoot } from 'react-dom/client'

import NodeOverlayEditor from '@/components/FlowEditor/NodeOverlayEditor'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'

function readTranslateX(transform: string): number | null {
  const m = String(transform || '').match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*([-\d.]+),\s*([-\d.]+)\s*\)/)
  if (!m) return null
  const tx = Number(m[1])
  return Number.isFinite(tx) ? tx : null
}

function readScale(transform: string): number | null {
  const m = String(transform || '').match(/matrix\(([-\d.]+),/)
  if (!m) return null
  const scale = Number(m[1])
  return Number.isFinite(scale) ? scale : null
}

export async function testFlowWidgetUnpinnedReusesCanvasZoomMovement() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    const api = useGraphStore.getState()
    api.resetAll()
    api.setZoomState({ k: 1, x: 0, y: 0 })
    api.setFlowWidgetPinnedByNodeId({ n1: false })
    api.setFlowWidgetPosByNodeId({ n1: { top: 96, left: 999 } })

    const startViewportW = 600

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (typeof raf === 'function') raf(() => resolve())
        else setTimeout(() => resolve(), 0)
      })
    const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(() => resolve(), ms))

    root.render(
      React.createElement(NodeOverlayEditor, {
        active: true,
        node: { id: 'n1', label: 'node', type: 'Anchor', x: 10, y: 10, properties: {} },
        edges: [],
        viewportW: startViewportW,
        viewportH: 600,
        canvasWindowOffset: { left: 0, top: 0 },
        onSetLabel: () => void 0,
        onSetType: () => void 0,
        onPatchProperties: () => void 0,
        onSetProperties: () => void 0,
        onValidate: () => void 0,
        onDuplicate: () => void 0,
        onRemove: () => void 0,
        onClearOutput: () => void 0,
        onHelp: () => void 0,
        onConvertToLoopNode: () => void 0,
        onEnableHandlesForAllInputs: () => void 0,
      } as never),
    )

    await sleep(0)
    await tick()
    await sleep(0)
    await tick()

    const panel = document.body.querySelector('aside[data-kg-canvas-wheel-ignore="true"]') as HTMLElement | null
    if (!panel) throw new Error('expected widget overlay aside')
    const tx0 = readTranslateX(panel.style.transform)
    if (tx0 == null) throw new Error(`expected matrix() transform, got ${String(panel.style.transform || '')}`)
    if (Math.abs(tx0 - 999) < 120) throw new Error(`expected unpinned overlay to ignore floating-position cache, got tx ${tx0}`)

    api.setZoomState({ k: 2, x: 0, y: 0 })

    const nextViewportW = 600
    root.render(
      React.createElement(NodeOverlayEditor, {
        active: true,
        node: { id: 'n1', label: 'node', type: 'Anchor', x: 10, y: 10, properties: {} },
        edges: [],
        viewportW: nextViewportW,
        viewportH: 600,
        canvasWindowOffset: { left: 0, top: 0 },
        onSetLabel: () => void 0,
        onSetType: () => void 0,
        onPatchProperties: () => void 0,
        onSetProperties: () => void 0,
        onValidate: () => void 0,
        onDuplicate: () => void 0,
        onRemove: () => void 0,
        onClearOutput: () => void 0,
        onHelp: () => void 0,
        onConvertToLoopNode: () => void 0,
        onEnableHandlesForAllInputs: () => void 0,
      } as never),
    )

    await sleep(0)
    await tick()
    await sleep(0)
    await tick()

    const tx1 = readTranslateX(panel.style.transform)
    if (tx1 == null) throw new Error('expected next matrix() transform')
    if (!(tx1 > tx0 + 150)) {
      throw new Error(`expected unpinned overlay to follow zoom movement (tx0=${tx0}, tx1=${tx1})`)
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

export async function testFlowWidgetUnpinnedReusesCanvasPanMovement() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    const api = useGraphStore.getState()
    api.resetAll()
    api.setZoomState({ k: 1, x: 0, y: 0 })
    api.setFlowWidgetPinnedByNodeId({ n1: false })
    api.setFlowWidgetPosByNodeId({ n1: { top: 160, left: 220 } })

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (typeof raf === 'function') raf(() => resolve())
        else setTimeout(() => resolve(), 0)
      })
    const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(() => resolve(), ms))

    root.render(
      React.createElement(NodeOverlayEditor, {
        active: true,
        node: { id: 'n1', label: 'node', type: 'Anchor', x: 10, y: 10, properties: {} },
        edges: [],
        viewportW: 900,
        viewportH: 600,
        canvasWindowOffset: { left: 0, top: 0 },
        onSetLabel: () => void 0,
        onSetType: () => void 0,
        onPatchProperties: () => void 0,
        onSetProperties: () => void 0,
        onValidate: () => void 0,
        onDuplicate: () => void 0,
        onRemove: () => void 0,
        onClearOutput: () => void 0,
        onHelp: () => void 0,
        onConvertToLoopNode: () => void 0,
        onEnableHandlesForAllInputs: () => void 0,
      } as never),
    )

    await sleep(0)
    await tick()
    await sleep(0)
    await tick()

    const panel = document.body.querySelector('aside[data-kg-canvas-wheel-ignore="true"]') as HTMLElement | null
    if (!panel) throw new Error('expected widget overlay aside')
    const tx0 = readTranslateX(panel.style.transform)
    if (tx0 == null) throw new Error(`expected matrix() transform, got ${String(panel.style.transform || '')}`)

    api.setZoomState({ k: 1, x: 180, y: 0 })

    await sleep(0)
    await tick()
    await sleep(0)
    await tick()

    const tx1 = readTranslateX(panel.style.transform)
    if (tx1 == null) throw new Error('expected next matrix() transform')
    if (!(tx1 > tx0 + 120)) {
      throw new Error(`expected unpinned overlay to follow pan movement (tx0=${tx0}, tx1=${tx1})`)
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

export async function testFlowWidgetUnpinnedReusesPinnedScaleBehavior() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    const api = useGraphStore.getState()
    api.resetAll()
    api.setZoomState({ k: 0.5, x: 0, y: 0 })
    api.setFlowWidgetPinnedByNodeId({ n1: false })
    api.setFlowWidgetPosByNodeId({ n1: { top: 120, left: 220 } })

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (typeof raf === 'function') raf(() => resolve())
        else setTimeout(() => resolve(), 0)
      })
    const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(() => resolve(), ms))

    root.render(
      React.createElement(NodeOverlayEditor, {
        active: true,
        node: { id: 'n1', label: 'node', type: 'Anchor', x: 10, y: 10, properties: {} },
        edges: [],
        viewportW: 900,
        viewportH: 600,
        canvasWindowOffset: { left: 0, top: 0 },
        onSetLabel: () => void 0,
        onSetType: () => void 0,
        onPatchProperties: () => void 0,
        onSetProperties: () => void 0,
        onValidate: () => void 0,
        onDuplicate: () => void 0,
        onRemove: () => void 0,
        onClearOutput: () => void 0,
        onHelp: () => void 0,
        onConvertToLoopNode: () => void 0,
        onEnableHandlesForAllInputs: () => void 0,
      } as never),
    )

    await sleep(0)
    await tick()
    await sleep(0)
    await tick()

    const panel = document.body.querySelector('aside[data-kg-canvas-wheel-ignore="true"]') as HTMLElement | null
    if (!panel) throw new Error('expected widget overlay aside')
    const s0 = readScale(panel.style.transform)
    if (s0 == null) throw new Error(`expected matrix() transform, got ${String(panel.style.transform || '')}`)
    if (Math.abs(s0 - 0.5) > 0.02) {
      throw new Error(`expected unpinned overlay to reuse pinned zoom-out scale, got ${s0}`)
    }

    api.setZoomState({ k: 2, x: 0, y: 0 })

    await sleep(0)
    await tick()
    await sleep(0)
    await tick()

    const s1 = readScale(panel.style.transform)
    if (s1 == null) throw new Error('expected next matrix() transform')
    if (Math.abs(s1 - 1) > 0.02) {
      throw new Error(`expected unpinned overlay to cap at pinned zoom-in scale 1, got ${s1}`)
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

export async function testFlowWidgetUnpinnedMaxZoomOutKeepsLayoutWithoutViewportBounce() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    const api = useGraphStore.getState()
    api.resetAll()
    api.setZoomState({ k: 1, x: 0, y: 0 })
    api.setFlowWidgetPinnedByNodeId({ n1: false })
    api.setFlowWidgetPosByNodeId({ n1: { top: 120, left: 220 } })

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (typeof raf === 'function') raf(() => resolve())
        else setTimeout(() => resolve(), 0)
      })
    const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(() => resolve(), ms))

    root.render(
      React.createElement(NodeOverlayEditor, {
        active: true,
        node: { id: 'n1', label: 'node', type: 'Anchor', x: 10, y: 10, properties: {} },
        edges: [],
        viewportW: 900,
        viewportH: 600,
        canvasWindowOffset: { left: 0, top: 0 },
        onSetLabel: () => void 0,
        onSetType: () => void 0,
        onPatchProperties: () => void 0,
        onSetProperties: () => void 0,
        onValidate: () => void 0,
        onDuplicate: () => void 0,
        onRemove: () => void 0,
        onClearOutput: () => void 0,
        onHelp: () => void 0,
        onConvertToLoopNode: () => void 0,
        onEnableHandlesForAllInputs: () => void 0,
      } as never),
    )

    await sleep(0)
    await tick()
    await sleep(0)
    await tick()

    const panel = document.body.querySelector('aside[data-kg-canvas-wheel-ignore="true"]') as HTMLElement | null
    if (!panel) throw new Error('expected widget overlay aside')

    api.setZoomState({ k: 0.1, x: -500, y: 0 })

    await sleep(0)
    await tick()
    await sleep(0)
    await tick()

    const tx = readTranslateX(panel.style.transform)
    if (tx == null) throw new Error(`expected matrix() transform, got ${String(panel.style.transform || '')}`)
    if (!(tx < -200)) {
      throw new Error(`expected max zoom-out layout to remain offscreen instead of bouncing back into viewport, got tx=${tx}`)
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
