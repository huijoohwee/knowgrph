import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownPresentationFragmentsAdvanceWithinSlide() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
    }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }
    const anyGlobal = globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyGlobal.requestAnimationFrame) {
      anyGlobal.requestAnimationFrame = anyWindow.requestAnimationFrame
    }

    const doc = dom.window.document

    const markdownLines = [
      '---',
      'fragments:',
      '  enabled: true',
      '  steps: 2',
      '---',
      '',
      '# Slide 1',
      '',
      '<p>always visible</p>',
      '<p class="fragment">first fragment</p>',
      '<p class="fragment">second fragment</p>',
    ]
    const markdownText = markdownLines.join('\n')

    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const presentationApiRef = React.createRef<{ prev: () => void; next: () => void }>()

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: 'docs/fragments.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: true,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        previewOverlayScope: 'viewport',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
        presentationApiRef,
      } as never),
    )

    const tick = () =>
      new Promise<void>(resolve =>
        anyWindow.requestAnimationFrame ? anyWindow.requestAnimationFrame(() => resolve()) : setTimeout(() => resolve(), 0),
      )
    await tick()

    const rootEl = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null
    if (!rootEl) {
      throw new Error('markdown preview root not found')
    }

    const getText = () => (rootEl.textContent || '').replace(/\s+/g, ' ').trim()

    const initialText = getText()
    if (!initialText.includes('always visible')) {
      throw new Error('expected non-fragment content to be visible at initial step')
    }
    if (initialText.includes('first fragment') || initialText.includes('second fragment')) {
      throw new Error('expected fragments to be hidden at initial step')
    }

    const api = presentationApiRef.current
    if (!api) {
      throw new Error('presentationApiRef.current is null')
    }

    api.next()
    await tick()

    const afterFirstStep = getText()
    if (!afterFirstStep.includes('first fragment')) {
      throw new Error('expected first fragment to be visible after first next()')
    }
    if (afterFirstStep.includes('second fragment')) {
      throw new Error('expected second fragment to still be hidden after first next()')
    }

    api.next()
    await tick()

    const afterSecondStep = getText()
    if (!afterSecondStep.includes('second fragment')) {
      throw new Error('expected second fragment to be visible after second next()')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testMarkdownPresentationFragmentOrderingByIndexAndVClickAt() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
    }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }
    const anyGlobal = globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyGlobal.requestAnimationFrame) {
      anyGlobal.requestAnimationFrame = anyWindow.requestAnimationFrame
    }

    const doc = dom.window.document

    const markdownLines = [
      '---',
      'fragments:',
      '  enabled: true',
      '  steps: 3',
      '---',
      '',
      '# Slide with explicit ordering',
      '',
      '<p class="fragment" data-fragment-index="2">second-by-index</p>',
      '<p class="fragment" data-fragment-index="1">first-by-index</p>',
      '<v-click at="3">third-v-click</v-click>',
    ]
    const markdownText = markdownLines.join('\n')

    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const presentationApiRef = React.createRef<{ prev: () => void; next: () => void }>()

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: 'docs/fragments-order.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: true,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        previewOverlayScope: 'viewport',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
        presentationApiRef,
      } as never),
    )

    const tick = () =>
      new Promise<void>(resolve =>
        anyWindow.requestAnimationFrame ? anyWindow.requestAnimationFrame(() => resolve()) : setTimeout(() => resolve(), 0),
      )
    await tick()

    const rootEl = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null
    if (!rootEl) {
      throw new Error('markdown preview root not found')
    }

    const getText = () => (rootEl.textContent || '').replace(/\s+/g, ' ').trim()

    const initialText = getText()
    if (initialText.includes('first-by-index') || initialText.includes('second-by-index') || initialText.includes('third-v-click')) {
      throw new Error('expected all fragments to be hidden at initial step')
    }

    const api = presentationApiRef.current
    if (!api) {
      throw new Error('presentationApiRef.current is null')
    }

    api.next()
    await tick()

    const afterFirstStep = getText()
    if (!afterFirstStep.includes('first-by-index')) {
      throw new Error('expected first-by-index to be visible at step 1')
    }
    if (afterFirstStep.includes('second-by-index') || afterFirstStep.includes('third-v-click')) {
      throw new Error('expected only first-by-index to be visible at step 1')
    }

    api.next()
    await tick()

    const afterSecondStep = getText()
    if (!afterSecondStep.includes('first-by-index') || !afterSecondStep.includes('second-by-index')) {
      throw new Error('expected first-by-index and second-by-index to be visible at step 2')
    }
    if (afterSecondStep.includes('third-v-click')) {
      throw new Error('expected third-v-click to still be hidden at step 2')
    }

    api.next()
    await tick()

    const afterThirdStep = getText()
    if (!afterThirdStep.includes('third-v-click')) {
      throw new Error('expected third-v-click to be visible at step 3')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
