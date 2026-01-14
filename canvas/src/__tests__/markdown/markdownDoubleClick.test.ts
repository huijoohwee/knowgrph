import React from 'react'
import { createRoot } from 'react-dom/client'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { UI_COPY } from '@/lib/config'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'

export async function testMarkdownEditorDoubleClickScrollsViewerToBlockStartLine() {
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
    await tick()

    const { useGraphStore } = await import('@/hooks/useGraphStore')
    const store = useGraphStore.getState()

    const markdown = ['alpha one', 'alpha two', '', 'beta one', 'beta two'].join('\n')
    store.setMarkdownDocument('dblclick.md', markdown)
    await tick()
    await tick()

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

    const textarea = doc.querySelector('textarea') as HTMLTextAreaElement | null
    if (!textarea) {
      throw new Error('editor textarea not found')
    }

    textarea.value = markdown
    textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    textarea.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    await tick()
    await tick()

    const calls: string[] = []
    const prevScrollIntoView = (dom.window.HTMLElement.prototype as unknown as { scrollIntoView?: unknown })
      .scrollIntoView
    ;(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: (arg?: unknown) => void }).scrollIntoView =
      function () {
        const el = this as unknown as HTMLElement
        calls.push(el.getAttribute('data-start-line') || '')
      }

    const offsetToLine2 = markdown.indexOf('\n') + 1
    textarea.selectionStart = offsetToLine2 + 2
    textarea.selectionEnd = textarea.selectionStart

    textarea.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true, detail: 2 }))
    await tick()
    await tick()
    await tick()
    await tick()

    ;(dom.window.HTMLElement.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView = prevScrollIntoView

    if (calls.length === 0) {
      throw new Error('expected viewer to scrollIntoView after editor double click')
    }
    const last = calls[calls.length - 1]
    if (last !== '1') {
      throw new Error(`expected scroll target data-start-line=1, got ${String(last)}`)
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testMarkdownViewerDoubleClickScrollsEditor() {
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
    await tick()

    const { useGraphStore } = await import('@/hooks/useGraphStore')
    const store = useGraphStore.getState()

    // 200 lines to ensure scrolling is possible
    const lines: string[] = []
    for (let i = 0; i < 200; i++) {
      lines.push(`line ${i}`)
    }
    const markdown = lines.join('\n')
    
    store.setMarkdownDocument('viewer_dblclick.md', markdown)
    await tick()
    await tick()

    const viewer = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null
    if (!viewer) {
      throw new Error('markdown preview root not found')
    }

    // Find a block around line 100
    // The Lexer usually produces blocks. With plain lines, paragraphs might differ.
    // Let's assume standard behavior: consecutive lines might be one paragraph.
    // But `markdownPreviewLex` handles it.
    // We need to find an element with data-start-line.
    const blocks = viewer.querySelectorAll('[data-start-line]')
    let targetBlock: Element | null = null
    // Pick one in the middle
    for (let i = 0; i < blocks.length; i++) {
      const el = blocks[i]
      const ln = parseInt(el.getAttribute('data-start-line') || '0', 10)
      if (ln > 50) {
        targetBlock = el
        break
      }
    }

    if (!targetBlock) {
      // Fallback: just pick the last one if < 50
      if (blocks.length > 0) targetBlock = blocks[blocks.length - 1]
    }

    if (!targetBlock) {
      throw new Error('no blocks with data-start-line found')
    }

    const targetLine = parseInt(targetBlock.getAttribute('data-start-line') || '1', 10)

    // Simulate Double Click
    targetBlock.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, detail: 2 }))
    await tick()
    await tick()
    await tick()
    await tick()

    // Check if mode switched to editor
    // We can check if textarea is visible or if layout changed.
    // But in JSDOM visibility might be tricky if we don't check classes.
    // The component sets `markdownLayoutMode` to 'editor'.
    // `BottomPanelMarkdownSection` renders based on this.
    
    // Check if textarea exists and is likely scrolled.
    const textarea = doc.querySelector('textarea') as HTMLTextAreaElement | null
    if (!textarea) {
      throw new Error('editor textarea not found after double click')
    }
    
    // We need to verify scroll position.
    // `scrollToLineInEditor` calculates scrollTop.
    // line 50 -> approx 50 * lineHeight
    // We assume standard lineHeight (e.g. 20px) but we don't know exact config here.
    // However, scrollTop should be > 0 if targetLine is large enough.
    
    if (targetLine > 5 && textarea.scrollTop === 0) {
       // Wait more ticks?
       await tick()
       await tick()
       if (textarea.scrollTop === 0) {
          throw new Error(`expected textarea to scroll for line ${targetLine}, but scrollTop is 0`)
       }
    }
    
    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
