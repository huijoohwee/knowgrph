import React from 'react'
import { createRoot } from 'react-dom/client'

import NodeOverlayEditor from '@/components/FlowEditor/NodeOverlayEditor'
import { WIDGET_BASE_SIZE } from '@/lib/canvas/overlayWidgetZoom'
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

export async function testFlowEditorUnpinnedWidgetDoesNotSnapToPhantomBorderOnLayoutChange() {
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
    api.setZoomState({ k: 1, x: 0, y: 0 })
    api.setFlowWidgetPinnedByNodeId({ n1: false })

    const viewportW = 800
    const dockedLeft = viewportW - WIDGET_BASE_SIZE.width - 16
    api.setFlowWidgetPosByNodeId({ n1: { top: 96, left: dockedLeft } })

    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (typeof raf === 'function') raf(() => resolve())
        else setTimeout(() => resolve(), 0)
      })
    const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

    const waitForTx = async (expected: number) => {
      const deadline = Date.now() + 800
      while (Date.now() < deadline) {
        const panel = document.body.querySelector('aside[data-kg-canvas-wheel-ignore="true"]') as HTMLElement | null
        const tx = panel ? readTranslateX(panel.style.transform) : null
        if (tx != null && Math.abs(tx - expected) <= 2) return tx
        await sleep(2)
      }
      const panel = document.body.querySelector('aside[data-kg-canvas-wheel-ignore="true"]') as HTMLElement | null
      const got = panel ? readTranslateX(panel.style.transform) : null
      throw new Error(`expected tx ~${expected} got ${String(got)}`)
    }

    root.render(
      React.createElement(NodeOverlayEditor, {
        active: true,
        node: { id: 'n1', label: 'node', type: 'Anchor', x: 10, y: 10, properties: {} },
        edges: [],
        viewportW,
        viewportH: 600,
        canvasWindowOffset: { left: 200, top: 0 },
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

    await waitForTx(dockedLeft + 200)

    root.render(
      React.createElement(NodeOverlayEditor, {
        active: true,
        node: { id: 'n1', label: 'node', type: 'Anchor', x: 10, y: 10, properties: {} },
        edges: [],
        viewportW,
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

    await waitForTx(dockedLeft)
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

