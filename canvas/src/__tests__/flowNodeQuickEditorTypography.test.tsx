import React from 'react'
import { createRoot } from 'react-dom/client'
import NodeOverlayEditor from '@/components/FlowEditor/NodeOverlayEditor'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { useGraphStore } from '@/hooks/useGraphStore'

export async function testFlowNodeQuickEditorTypographyInheritsPanelSettings() {
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
    api.setUiPanelTextFontClass('font-serif')
    api.setUiPanelKeyValueTextSizeClass('text-[15px]')
    api.setUiPanelMicroLabelTextSizeClass('text-[10px]')
    api.setUiPanelMonospaceTextClass('font-mono text-[13px]')

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(NodeOverlayEditor, {
        active: true,
        node: { id: 'n1', label: '890', type: 'Anchor', x: 10, y: 10, properties: {} },
        zoomState: { k: 1, x: 0, y: 0 },
        viewportW: 800,
        viewportH: 600,
        onSetLabel: () => void 0,
        onSetType: () => void 0,
        onPatchProperties: () => void 0,
        onValidate: () => void 0,
      } as never),
    )

    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (typeof raf === 'function') raf(() => resolve())
        else setTimeout(() => resolve(), 0)
      })

    await tick()

    const form = container.querySelector('form[aria-label="Quick edit form"]')
    if (!form) throw new Error('expected quick editor to render a form')
    const formClass = String(form.getAttribute('class') || '')
    if (!formClass.includes('text-[15px]')) {
      throw new Error(`expected form to inherit base panel text size, got ${JSON.stringify(formClass)}`)
    }

    const legend = container.querySelector('legend')
    if (!legend) throw new Error('expected quick editor to render a legend')
    const legendClass = String(legend.getAttribute('class') || '')
    if (!legendClass.includes('text-[10px]')) {
      throw new Error(`expected legend to use micro label class, got ${JSON.stringify(legendClass)}`)
    }

    const textarea = container.querySelector('textarea')
    if (!textarea) throw new Error('expected quick editor to render a textarea')
    const textareaClass = String(textarea.getAttribute('class') || '')
    if (!textareaClass.includes('text-[13px]')) {
      throw new Error(`expected textarea to use monospace class, got ${JSON.stringify(textareaClass)}`)
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

