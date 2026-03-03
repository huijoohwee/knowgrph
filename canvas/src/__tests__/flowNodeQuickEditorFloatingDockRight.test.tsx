import React from 'react'
import { createRoot } from 'react-dom/client'

import NodeOverlayEditor from '@/components/FlowEditor/NodeOverlayEditor'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { NODE_QUICK_EDITOR_BASE_SIZE } from '@/components/FlowEditor/nodeQuickEditorZoom'

function readTranslateX(transform: string): number | null {
  const m = String(transform || '').match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*([-\d.]+),\s*([-\d.]+)\s*\)/)
  if (!m) return null
  const tx = Number(m[1])
  return Number.isFinite(tx) ? tx : null
}

export async function testFlowNodeQuickEditorUnpinnedSnapsToCanvasRightOnViewportChange() {
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
    api.setFlowNodeQuickEditorPinnedByNodeId({ n1: false })

    const startViewportW = 600
    const startLeft = startViewportW - NODE_QUICK_EDITOR_BASE_SIZE.width - 16
    api.setFlowNodeQuickEditorPosByNodeId({ n1: { top: 96, left: startLeft } })

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
    if (!panel) throw new Error('expected quick editor overlay aside')
    const tx0 = readTranslateX(panel.style.transform)
    if (tx0 == null) throw new Error(`expected matrix() transform, got ${String(panel.style.transform || '')}`)
    if (Math.abs(tx0 - startLeft) > 2) throw new Error(`expected initial tx ~${startLeft} got ${tx0}`)

    const nextViewportW = 800
    const expectedLeft = nextViewportW - NODE_QUICK_EDITOR_BASE_SIZE.width - 16
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
    if (Math.abs(tx1 - expectedLeft) > 2) throw new Error(`expected snap-right tx ~${expectedLeft} got ${tx1}`)

    await new Promise<void>(resolve => setTimeout(() => resolve(), 180))
    const persisted = useGraphStore.getState().flowNodeQuickEditorPosByNodeId?.n1?.left
    if (typeof persisted !== 'number' || Math.abs(persisted - expectedLeft) > 2) {
      throw new Error(`expected persisted left ~${expectedLeft} got ${String(persisted)}`)
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
