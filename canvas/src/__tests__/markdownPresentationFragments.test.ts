import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { readMarkdownSlideDemo, resolveMarkdownSlideDemoPath } from '@/tests/lib/markdownSlideDemo'

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

    const container = doc.createElement('section')
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
    await tick()
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0))

    const rootEl = doc.querySelector('[data-testid="markdown-presentation-root"]') as HTMLElement | null
    if (!rootEl) {
      throw new Error('markdown presentation root not found')
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

    const container = doc.createElement('section')
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

    const rootEl = doc.querySelector('[data-testid="markdown-presentation-root"]') as HTMLElement | null
    if (!rootEl) {
      throw new Error('markdown presentation root not found')
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

export async function testMarkdownPresentationVClickAndVMarkVisibilityAcrossSteps() {
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
      '# Slide with v-click and v-mark',
      '',
      '<p>always visible</p>',
      '<v-click>click-fragment-1</v-click>',
      '<v-click at="3">click-fragment-3</v-click>',
      '<v-mark color="red">mark-fragment-2</v-mark>',
    ]
    const markdownText = markdownLines.join('\n')

    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const presentationApiRef = React.createRef<{ prev: () => void; next: () => void }>()

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: 'docs/fragments-vclick-vmark.md',
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

    const rootEl = doc.querySelector('[data-testid="markdown-presentation-root"]') as HTMLElement | null
    if (!rootEl) {
      throw new Error('markdown presentation root not found')
    }

    const getText = () => (rootEl.textContent || '').replace(/\s+/g, ' ').trim()

    const initialText = getText()
    if (!initialText.includes('always visible')) {
      throw new Error('expected non-fragment content to be visible at initial step')
    }
    if (initialText.includes('click-fragment-1') || initialText.includes('click-fragment-3') || initialText.includes('mark-fragment-2')) {
      throw new Error('expected all v-click and v-mark fragments to be hidden at initial step')
    }

    const api = presentationApiRef.current
    if (!api) {
      throw new Error('presentationApiRef.current is null')
    }

    api.next()
    await tick()

    const afterFirstStep = getText()
    if (!afterFirstStep.includes('click-fragment-1')) {
      throw new Error('expected click-fragment-1 to be visible at step 1')
    }
    if (afterFirstStep.includes('mark-fragment-2') || afterFirstStep.includes('click-fragment-3')) {
      throw new Error('expected only click-fragment-1 to be visible at step 1')
    }

    api.next()
    await tick()

    const afterSecondStep = getText()
    if (!afterSecondStep.includes('click-fragment-1') || !afterSecondStep.includes('mark-fragment-2')) {
      throw new Error('expected click-fragment-1 and mark-fragment-2 to be visible at step 2')
    }
    if (afterSecondStep.includes('click-fragment-3')) {
      throw new Error('expected click-fragment-3 to still be hidden at step 2')
    }

    api.next()
    await tick()

    const afterThirdStep = getText()
    if (
      !afterThirdStep.includes('click-fragment-1') ||
      !afterThirdStep.includes('mark-fragment-2') ||
      !afterThirdStep.includes('click-fragment-3')
    ) {
      throw new Error('expected all v-click and v-mark fragments to be visible at step 3')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testMarkdownPresentationVClickAndVMarkVisibilityFromSlideDemo() {
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

    const demo = readMarkdownSlideDemo()
    if (!demo) return
    const demoLines = demo.split('\n')
    const startIdx = demoLines.findIndex(l => l.includes('Click-Based Progressive Disclosure') || l.includes('Click‑Based Progressive Disclosure'))
    if (startIdx === -1) {
      throw new Error('Expected sandbox slide demo to include Click-Based Progressive Disclosure section')
    }
    const excerpt = demoLines.slice(Math.max(0, startIdx - 2), startIdx + 40).join('\n')
    const markdownText = ['---', 'fragments:', '  enabled: true', '  steps: 2', '---', '', excerpt, ''].join('\n')
    const docPath = resolveMarkdownSlideDemoPath() ?? 'markdown-slide-demo.md'

    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    const presentationApiRef = React.createRef<{ next: () => void }>()

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: docPath,
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
    await tick()
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0))

    const api = presentationApiRef.current
    if (!api || typeof api.next !== 'function') {
      throw new Error('presentationApiRef.current is null for v-click demo excerpt')
    }

    const pressNext = () => api.next()

    const rootEl = doc.querySelector('[data-testid="markdown-presentation-root"]') as HTMLElement | null
    if (!rootEl) {
      throw new Error('markdown presentation root not found')
    }

    const getText = () => (rootEl.textContent || '').replace(/\s+/g, ' ').trim()
    const hiddenBefore = getText()
    if (hiddenBefore.includes('Block appears on click') || hiddenBefore.includes('Appears at step 2')) {
      throw new Error('expected v-click fragments from demo excerpt to be hidden before stepping')
    }

    pressNext()
    await tick()
    await tick()
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0))
    const afterFirstStep = getText()
    if (!afterFirstStep.includes('Block appears on click')) {
      throw new Error('expected first v-click fragment to be visible after first next()')
    }

    pressNext()
    await tick()
    await tick()
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0))
    const afterSecondStep = getText()
    if (!afterSecondStep.includes('Appears at step 2')) {
      throw new Error('expected second v-click fragment to be visible after second next()')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testMarkdownPresentationSpeakerNotesToggle() {
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
      '---',
      '',
      '# Slide with notes',
      '',
      'Visible content',
      '',
      '<!--',
      'Speaker notes:',
      '- line 1',
      '- line 2',
      '-->',
    ]
    const markdownText = markdownLines.join('\n')

    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const presentationApiRef = React.createRef<{ prev: () => void; next: () => void }>()

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: 'docs/notes.md',
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

    const rootEl = doc.querySelector('[data-testid="markdown-presentation-root"]') as HTMLElement | null
    if (!rootEl) {
      throw new Error('markdown presentation root not found')
    }

    const initialText = (rootEl.textContent || '').replace(/\s+/g, ' ').trim()
    if (!initialText.includes('Visible content')) {
      throw new Error('expected slide content to render')
    }
    if (initialText.includes('Speaker notes:')) {
      throw new Error('expected speaker notes to be hidden by default')
    }

    const notesBefore = doc.querySelector('[data-testid="markdown-presentation-notes"]')
    if (notesBefore) {
      throw new Error('expected notes panel to be absent by default')
    }

    dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'n', bubbles: true }))
    await tick()

    const notesAfter = doc.querySelector('[data-testid="markdown-presentation-notes"]') as HTMLElement | null
    if (!notesAfter) {
      throw new Error('expected notes panel to be present after toggling')
    }
    const notesText = (notesAfter.textContent || '').replace(/\s+/g, ' ').trim()
    if (!notesText.includes('Speaker notes:') || !notesText.includes('line 1') || !notesText.includes('line 2')) {
      throw new Error(`unexpected notes content: ${notesText}`)
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
