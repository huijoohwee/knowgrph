import React from 'react'
import { createRoot } from 'react-dom/client'

import NodeOverlayEditor from '@/components/FlowEditor/NodeOverlayEditor'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'

export async function testFlowNodeQuickEditorZoomUpdatesDoNotRerenderPanel() {
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

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    let commits = 0
    const onRender: React.ProfilerOnRenderCallback = () => {
      commits += 1
    }

    root.render(
      React.createElement(
        React.Profiler,
        { id: 'node-quick-editor', onRender },
        React.createElement(NodeOverlayEditor, {
          active: true,
          node: { id: 'n1', label: 'node', type: 'Anchor', x: 10, y: 10, properties: {} },
          viewportW: 800,
          viewportH: 600,
          onSetLabel: () => void 0,
          onSetType: () => void 0,
          onPatchProperties: () => void 0,
          onValidate: () => void 0,
        } as never),
      ),
    )

    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (typeof raf === 'function') raf(() => resolve())
        else setTimeout(() => resolve(), 0)
      })

    await tick()

    const panel = container.querySelector('aside[data-kg-canvas-wheel-ignore="true"]')
    if (!panel) throw new Error('expected quick editor to render an overlay aside')
    const initialTransform = String((panel as HTMLElement).style.transform || '')
    const initialCommits = commits

    api.setZoomState({ k: 2, x: 50, y: 60 })
    await tick()

    const nextTransform = String((panel as HTMLElement).style.transform || '')
    if (nextTransform === initialTransform) {
      throw new Error('expected overlay transform to update when zoomState changes')
    }

    if (commits !== initialCommits) {
      throw new Error(`expected zoomState updates to avoid React rerenders, commits ${initialCommits} -> ${commits}`)
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

