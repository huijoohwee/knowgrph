import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const findButtonByAriaLabel = (rootEl: HTMLElement, label: string): HTMLButtonElement | null => {
  const el = rootEl.querySelector(`button[aria-label="${label}"]`)
  return el ? (el as HTMLButtonElement) : null
}

export async function testMarkdownPreviewShowsGutterControlsForRichMedia() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) => setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    const doc = dom.window.document
    const container = doc.createElement('section')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    const markdown = ['# Title', '', '![img](https://example.com/a.png)', ''].join('\n')

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText: markdown,
        activeDocumentPath: 'https://example.com/doc.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        previewOverlayScope: 'viewport',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
        onInsertLineAfter: () => void 0,
        onReorderLineBlock: () => void 0,
      } as never),
    )

    const waitFor = async (predicate: () => boolean) => {
      const deadline = Date.now() + 750
      while (Date.now() < deadline) {
        await new Promise<void>(resolve => anyWindow.requestAnimationFrame?.(() => resolve()))
        if (predicate()) return
      }
      throw new Error('timed out')
    }

    await waitFor(() => !!findButtonByAriaLabel(container, 'Add line') && !!findButtonByAriaLabel(container, 'Reorder line'))

    const addLine = findButtonByAriaLabel(container, 'Add line')
    const reorder = findButtonByAriaLabel(container, 'Reorder line')
    if (!addLine) throw new Error('expected Add line button for rich media block')
    if (!reorder) throw new Error('expected Reorder line button for rich media block')

    const figs = Array.from(container.querySelectorAll('figure')) as unknown as HTMLElement[]
    const fig = figs.find(f => !!f.querySelector('img'))
    if (!fig) throw new Error('expected media figure wrapper')
    if (!/\bmx-0\b/.test(fig.className || '')) throw new Error(`expected figure to include mx-0, got "${fig.className}"`)
    const img = fig.querySelector('img') as HTMLImageElement | null
    if (!img) throw new Error('expected img inside media wrapper')
    if (!/\bmx-auto\b/.test(img.className || '')) throw new Error(`expected img to include mx-auto, got "${img.className}"`)
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
