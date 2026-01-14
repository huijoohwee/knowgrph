import React from 'react'
import { createRoot } from 'react-dom/client'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { UI_COPY } from '@/lib/config'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'

export async function testMarkdownScrollSyncViewerToEditor() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }
    const anyGlobal = globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyGlobal.requestAnimationFrame) {
      anyGlobal.requestAnimationFrame = anyWindow.requestAnimationFrame
    }

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(BottomPanelMarkdownSection))

    const tick = () => new Promise<void>(resolve => anyWindow.requestAnimationFrame ? anyWindow.requestAnimationFrame(() => resolve()) : setTimeout(() => resolve(), 0))
    await tick()

    const textarea = doc.querySelector('textarea') as HTMLTextAreaElement | null
    if (!textarea) {
      throw new Error('editor textarea not found')
    }

    const lines: string[] = []
    for (let i = 0; i < 200; i += 1) {
      lines.push(`line ${i}`)
    }
    const longText = lines.join('\n')

    Object.defineProperty(textarea, 'scrollHeight', {
      value: 2000,
      configurable: true,
    })
    Object.defineProperty(textarea, 'clientHeight', {
      value: 500,
      configurable: true,
    })

    const { useGraphStore } = await import('@/hooks/useGraphStore')
    const store = useGraphStore.getState()
    store.setMarkdownDocument('test.md', longText)

    textarea.value = longText
    textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    textarea.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    await tick()
    await tick()

    const viewer = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null
    if (!viewer) {
      throw new Error('markdown preview root not found')
    }

    // Force ratio-based sync in JSDOM since layout isn't computed
    viewer.getBoundingClientRect = () => null as unknown as DOMRect

    Object.defineProperty(viewer, 'scrollHeight', {
      value: 2000,
      configurable: true,
    })
    Object.defineProperty(viewer, 'clientHeight', {
      value: 500,
      configurable: true,
    })

    const initialEditorScrollTop = textarea.scrollTop

    viewer.scrollTop = viewer.scrollHeight
    viewer.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await tick()
    await tick()

    const finalEditorScrollTop = textarea.scrollTop
    if (finalEditorScrollTop <= initialEditorScrollTop) {
      throw new Error('expected editor to scroll when viewer scrolls with sync on')
    }

    viewer.scrollTop = 0
    viewer.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await tick()
    await tick()

    const editorScrollAfterReset = textarea.scrollTop
    if (editorScrollAfterReset >= finalEditorScrollTop) {
      throw new Error('expected editor to scroll back toward top when viewer scrolls up')
    }

    Object.defineProperty(textarea, 'scrollHeight', {
      value: 4000,
      configurable: true,
    })
    Object.defineProperty(textarea, 'clientHeight', {
      value: 500,
      configurable: true,
    })

    textarea.scrollTop = textarea.scrollHeight
    textarea.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await tick()
    await tick()

    const viewerScrollAfterEditor = viewer.scrollTop
    if (viewerScrollAfterEditor <= 0) {
      throw new Error('expected viewer to scroll when editor scrolls with sync on')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testMarkdownEditToggleKeepsScrollPosition() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(BottomPanelMarkdownSection))

    const tick = () =>
      new Promise<void>(resolve =>
        anyWindow.requestAnimationFrame ? anyWindow.requestAnimationFrame(() => resolve()) : setTimeout(() => resolve(), 0),
      )
    await tick()

    const textarea = doc.querySelector('textarea') as HTMLTextAreaElement | null
    if (!textarea) {
      throw new Error('editor textarea not found')
    }

    const lines: string[] = []
    for (let i = 0; i < 200; i += 1) {
      lines.push(`line ${i}`)
    }
    const longText = lines.join('\n')

    Object.defineProperty(textarea, 'scrollHeight', {
      value: 4000,
      configurable: true,
    })
    Object.defineProperty(textarea, 'clientHeight', {
      value: 500,
      configurable: true,
    })

    textarea.value = longText
    textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    textarea.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    await tick()
    await tick()

    const viewer = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null
    if (!viewer) {
      throw new Error('markdown preview root not found')
    }

    Object.defineProperty(viewer, 'scrollHeight', {
      value: 4000,
      configurable: true,
    })
    Object.defineProperty(viewer, 'clientHeight', {
      value: 500,
      configurable: true,
    })

    viewer.scrollTop = viewer.scrollHeight * 0.25
    viewer.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await tick()
    await tick()

    const scrollTopBeforeEdit = viewer.scrollTop

    const editToggleTitle = UI_COPY.bottomPanelMarkdownEditToggleTitle
    const findEditToggleButton = (): HTMLButtonElement | null => {
      const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
      for (const btn of buttons) {
        const label = btn.getAttribute('aria-label') || ''
        if (label === editToggleTitle) return btn
      }
      return null
    }

    const editButtonOn = findEditToggleButton()
    if (!editButtonOn) {
      throw new Error('Edit toggle button not found')
    }
    editButtonOn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()
    await tick()

    textarea.scrollTop = textarea.scrollHeight * 0.125
    textarea.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await tick()
    await tick()

    const scrollTopEditorTarget = textarea.scrollTop

    const editButtonOff = findEditToggleButton()
    if (!editButtonOff) {
      throw new Error('Edit toggle button not found after enabling edit mode')
    }
    editButtonOff.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()
    await tick()

    const scrollTopAfterEditOff = viewer.scrollTop

    if (!(scrollTopAfterEditOff > 0)) {
      throw new Error('viewer scrollTop after Edit Off should be > 0')
    }

    const deltaBefore = Math.abs(scrollTopBeforeEdit - scrollTopEditorTarget)
    const deltaAfter = Math.abs(scrollTopAfterEditOff - scrollTopEditorTarget)
    if (!(deltaAfter <= deltaBefore)) {
      throw new Error(
        `expected viewer scroll after Edit Off to be at least as close to editor target as before (before=${deltaBefore}, after=${deltaAfter})`,
      )
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testMarkdownScrollSyncMixedContentViewerToEditor() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }
    const anyGlobal = globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyGlobal.requestAnimationFrame) {
      anyGlobal.requestAnimationFrame = anyWindow.requestAnimationFrame
    }

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(BottomPanelMarkdownSection))

    const tick = () =>
      new Promise<void>(resolve =>
        anyWindow.requestAnimationFrame ? anyWindow.requestAnimationFrame(() => resolve()) : setTimeout(() => resolve(), 0),
      )
    await tick()

    const textarea = doc.querySelector('textarea') as HTMLTextAreaElement | null
    if (!textarea) {
      throw new Error('editor textarea not found')
    }

    const mixedLines: string[] = []
    mixedLines.push('# Title')
    mixedLines.push('')
    mixedLines.push('Intro paragraph before code block.')
    mixedLines.push('')
    mixedLines.push('```js')
    mixedLines.push('console.log("one");')
    mixedLines.push('console.log("two");')
    mixedLines.push('console.log("three");')
    mixedLines.push('```')
    mixedLines.push('')
    mixedLines.push('| Col A | Col B |')
    mixedLines.push('|-------|-------|')
    mixedLines.push('| a1    | b1    |')
    mixedLines.push('| a2    | b2    |')
    mixedLines.push('')
    mixedLines.push('![Alt text](https://example.com/image.png)')
    mixedLines.push('')
    mixedLines.push('Trailing paragraph after table and image.')

    const mixedMarkdown = mixedLines.join('\n')

    Object.defineProperty(textarea, 'scrollHeight', {
      value: 2000,
      configurable: true,
    })
    Object.defineProperty(textarea, 'clientHeight', {
      value: 500,
      configurable: true,
    })

    const { useGraphStore } = await import('@/hooks/useGraphStore')
    const store = useGraphStore.getState()
    store.setMarkdownDocument('mixed.md', mixedMarkdown)
    await tick()
    await tick()

    const viewer = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null
    if (!viewer) {
      throw new Error('markdown preview root not found')
    }

    Object.defineProperty(viewer, 'scrollHeight', {
      value: 2000,
      configurable: true,
    })
    Object.defineProperty(viewer, 'clientHeight', {
      value: 500,
      configurable: true,
    })

    const blocks = Array.from(
      viewer.querySelectorAll<HTMLElement>('[data-start-line]'),
    )
    if (blocks.length === 0) {
      throw new Error('expected markdown preview to render blocks with data-start-line')
    }

    const viewerHeight = 600
    Object.defineProperty(viewer, 'getBoundingClientRect', {
      value: () =>
        ({
          top: 0,
          left: 0,
          right: 800,
          bottom: viewerHeight,
          width: 800,
          height: viewerHeight,
        } as DOMRect),
      configurable: true,
    })

    const blockHeight = 120
    const basePositions: number[] = []
    blocks.forEach((el, index) => {
      const baseTop = index * blockHeight
      basePositions.push(baseTop)
      Object.defineProperty(el, 'getBoundingClientRect', {
        value: () =>
          ({
            top: baseTop - viewer.scrollTop,
            bottom: baseTop - viewer.scrollTop + blockHeight,
            left: 0,
            right: 800,
            width: 800,
            height: blockHeight,
          } as DOMRect),
        configurable: true,
      })
    })

    const findBlockByLine = (line: number) => {
      return blocks.find(el => {
        const raw = el.getAttribute('data-start-line')
        if (!raw) return false
        const n = Number.parseInt(raw, 10)
        return Number.isFinite(n) && n === line
      })
    }

    const codeStartLine = 5
    const tableStartLine = 11
    const imageStartLine = 16

    const codeBlockEl = findBlockByLine(codeStartLine)
    const tableBlockEl = findBlockByLine(tableStartLine)
    const imageBlockEl = findBlockByLine(imageStartLine)

    if (!codeBlockEl) {
      throw new Error('code block element not found in preview')
    }
    if (!tableBlockEl) {
      throw new Error('table block element not found in preview')
    }
    if (!imageBlockEl) {
      throw new Error('image block element not found in preview')
    }

    const codeIndex = blocks.indexOf(codeBlockEl)
    const tableIndex = blocks.indexOf(tableBlockEl)
    const imageIndex = blocks.indexOf(imageBlockEl)
    if (codeIndex < 0 || tableIndex < 0 || imageIndex < 0) {
      throw new Error('failed to locate code, table, or image block index')
    }

    const bias = 0.45
    const anchorOffset = viewerHeight * bias

    viewer.scrollTop = basePositions[codeIndex] - anchorOffset + blockHeight / 2
    viewer.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await tick()
    await tick()
    const editorScrollForCode = textarea.scrollTop

    viewer.scrollTop = basePositions[tableIndex] - anchorOffset + blockHeight / 2
    viewer.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await tick()
    await tick()
    const editorScrollForTable = textarea.scrollTop

    viewer.scrollTop = basePositions[imageIndex] - anchorOffset + blockHeight / 2
    viewer.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await tick()
    await tick()
    const editorScrollForImage = textarea.scrollTop

    if (!(editorScrollForTable > editorScrollForCode)) {
      throw new Error('expected table block to map to a larger editor scrollTop than code block')
    }
    if (!(editorScrollForImage > editorScrollForTable)) {
      throw new Error('expected image block to map to a larger editor scrollTop than table block')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
