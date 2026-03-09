import React from 'react'
import { createRoot } from 'react-dom/client'

import NodeOverlayEditor from '@/components/FlowEditor/NodeOverlayEditor'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'

export async function testFlowNodeQuickEditorBeatByBeatTitleUsesTemplateHeading() {
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
        node: { id: 'NODE_CLIP_01', label: 'Clip 01', type: 'Node', x: 10, y: 10, properties: {} },
        graphMetaKind: 'frontmatter-flow',
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

    const title = document.body.querySelector('[aria-label="Node editor header"] h3') as HTMLElement | null
    if (!title) throw new Error('expected quick editor header title')
    const text = String(title.textContent || '')
    if (!text.includes('beat_01')) throw new Error(`expected header title to include beat_01, got ${text}`)
    if (!text.includes('{{timeline.beats.beat_01.label}}')) throw new Error(`expected header title to include template label, got ${text}`)
    if (!text.includes('NODE_CLIP_01')) throw new Error(`expected header title to include NODE_CLIP_01, got ${text}`)
    if (!text.includes('NODE_OVERLAY_01')) throw new Error(`expected header title to include NODE_OVERLAY_01, got ${text}`)
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

