import React from 'react'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const tick = async (n: number = 1) => {
  for (let i = 0; i < n; i += 1) {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }
}

export async function testMarkdownViewerInlineEditToolbarTextColorAppliesInHtmlMode() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    try {
      const proto = (dom.window as unknown as { Range?: { prototype?: Record<string, unknown> } }).Range?.prototype as unknown as {
        getBoundingClientRect?: () => DOMRect
      } | null
      if (proto && typeof proto.getBoundingClientRect !== 'function') {
        proto.getBoundingClientRect = () => {
          return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 10,
            bottom: 10,
            width: 10,
            height: 10,
            toJSON: () => ({}),
          } as unknown as DOMRect
        }
      }
    } catch {
      void 0
    }
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const reactDomClient = await import('react-dom/client')
    const root = reactDomClient.createRoot(container)
    const mod = await import('@/features/markdown/ui/MarkdownBlockContainer')
    const MarkdownBlockContainer = mod.MarkdownBlockContainer

    root.render(
      <MarkdownBlockContainer
        as="p"
        className="mt-2 mb-2 text-sm"
        highlightClass=""
        startLine={1}
        endLine={1}
        inlineEditable
        sourceLines={['Hello world']}
        onReplaceLineRange={() => {}}
        editPresentation="html"
        editHtmlRender="inline"
      >
        <span>Hello world</span>
      </MarkdownBlockContainer>,
    )

    await tick(2)

    const host = dom.window.document.querySelector('p') as HTMLElement | null
    if (!host) throw new Error('expected host p')
    host.getBoundingClientRect = () => {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 320,
        bottom: 42,
        width: 320,
        height: 42,
        toJSON: () => ({}),
      } as unknown as DOMRect
    }

    host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
    await tick(3)

    const editor = dom.window.document.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected contenteditable editor to mount after click')

    const textNode = editor.firstChild
    if (!textNode || textNode.nodeType !== dom.window.Node.TEXT_NODE) throw new Error('expected editor to contain text node')

    const range = dom.window.document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, 5)
    const sel = dom.window.getSelection()
    if (!sel) throw new Error('expected selection')
    sel.removeAllRanges()
    sel.addRange(range)
    dom.window.document.dispatchEvent(new dom.window.Event('selectionchange'))
    await tick(3)

    const summary = dom.window.document.querySelector('summary[title="Text color"]') as HTMLElement | null
    if (!summary) throw new Error('expected text color toolbar summary')
    summary.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
    summary.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    summary.click()
    await tick(2)

    const redBtn = dom.window.document.querySelector('menu[aria-label="Text color menu"] button') as HTMLButtonElement | null
    if (!redBtn) throw new Error('expected text color menu button')
    redBtn.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    redBtn.click()
    await tick(3)

    const editorAfterClick = dom.window.document.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editorAfterClick) throw new Error('expected toolbar color action not to bounce out of inline edit')
    const sigil = editorAfterClick.querySelector('[data-kg-sigil="1"]') as HTMLElement | null
    if (!sigil) throw new Error('expected text color toolbar action to apply a sigil span')
    if (sigil.getAttribute('data-kg-sigil-color') !== '#EF4444') {
      throw new Error(`expected text color toolbar action to apply red sigil color, got ${String(sigil.getAttribute('data-kg-sigil-color'))}`)
    }
    if ((sigil.textContent || '').trim() !== 'Hello') {
      throw new Error(`expected text color toolbar action to preserve selected text, got "${String(sigil.textContent || '')}"`)
    }
    const toolbarAfterClick = dom.window.document.querySelector('menu[aria-label="Inline selection toolbar"]') as HTMLElement | null
    if (!toolbarAfterClick) throw new Error('expected inline selection toolbar to remain available after text color action')

    root.unmount()
  } finally {
    restore()
  }
}

export async function testMarkdownViewerInlineEditToolbarBoldRestoresCachedHtmlSelection() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    try {
      const proto = (dom.window as unknown as { Range?: { prototype?: Record<string, unknown> } }).Range?.prototype as unknown as {
        getBoundingClientRect?: () => DOMRect
      } | null
      if (proto && typeof proto.getBoundingClientRect !== 'function') {
        proto.getBoundingClientRect = () => {
          return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 10,
            bottom: 10,
            width: 10,
            height: 10,
            toJSON: () => ({}),
          } as unknown as DOMRect
        }
      }
    } catch {
      void 0
    }
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const originalExecCommand = dom.window.document.execCommand
    dom.window.document.execCommand = ((cmd: string) => {
      if (cmd !== 'bold') return false
      const sel = dom.window.getSelection()
      if (!sel || sel.rangeCount <= 0) return false
      const range = sel.getRangeAt(0)
      if (range.collapsed) return false
      const strong = dom.window.document.createElement('strong')
      strong.appendChild(range.extractContents())
      range.insertNode(strong)
      range.selectNodeContents(strong)
      sel.removeAllRanges()
      sel.addRange(range)
      return true
    }) as typeof dom.window.document.execCommand

    const reactDomClient = await import('react-dom/client')
    const root = reactDomClient.createRoot(container)
    const mod = await import('@/features/markdown/ui/MarkdownBlockContainer')
    const MarkdownBlockContainer = mod.MarkdownBlockContainer

    root.render(
      <MarkdownBlockContainer
        as="p"
        className="mt-2 mb-2 text-sm"
        highlightClass=""
        startLine={1}
        endLine={1}
        inlineEditable
        sourceLines={['Hello world']}
        onReplaceLineRange={() => {}}
        editPresentation="html"
        editHtmlRender="inline"
      >
        <span>Hello world</span>
      </MarkdownBlockContainer>,
    )

    await tick(2)

    const host = dom.window.document.querySelector('p') as HTMLElement | null
    if (!host) throw new Error('expected host p')
    host.getBoundingClientRect = () => {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 320,
        bottom: 42,
        width: 320,
        height: 42,
        toJSON: () => ({}),
      } as unknown as DOMRect
    }

    host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
    await tick(3)

    const editor = dom.window.document.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected contenteditable editor to mount after click')

    const textNode = editor.firstChild
    if (!textNode || textNode.nodeType !== dom.window.Node.TEXT_NODE) throw new Error('expected editor to contain text node')

    const range = dom.window.document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, 5)
    const sel = dom.window.getSelection()
    if (!sel) throw new Error('expected selection')
    sel.removeAllRanges()
    sel.addRange(range)
    dom.window.document.dispatchEvent(new dom.window.Event('selectionchange'))
    editor.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, cancelable: true, detail: 1 }))
    await tick(3)

    sel.removeAllRanges()

    const boldBtn = dom.window.document.querySelector('button[title="Bold"]') as HTMLButtonElement | null
    if (!boldBtn) throw new Error('expected bold toolbar button')
    boldBtn.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    boldBtn.click()
    await tick(3)

    const strong = editor.querySelector('strong') as HTMLElement | null
    if (!strong) throw new Error('expected bold toolbar action to restore cached selection and mutate html editor')
    if ((strong.textContent || '').trim() !== 'Hello') {
      throw new Error(`expected bold toolbar action to wrap selected text, got "${String(strong.textContent || '')}"`)
    }

    dom.window.document.execCommand = originalExecCommand
    root.unmount()
  } finally {
    restore()
  }
}

export async function testMarkdownViewerInlineEditShowsSigilColorAsStyledTextNotCode() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')
    const reactDomClient = await import('react-dom/client')
    const root = reactDomClient.createRoot(container)
    const mod = await import('@/features/markdown/ui/MarkdownBlockContainer')
    const MarkdownBlockContainer = mod.MarkdownBlockContainer

    root.render(
      <MarkdownBlockContainer
        as="p"
        className="mt-2 mb-2 text-sm"
        highlightClass=""
        startLine={1}
        endLine={1}
        inlineEditable
        sourceLines={['`#EF4444|bg#FEF08A:Hello` world']}
        onReplaceLineRange={() => {}}
        editPresentation="html"
        editHtmlRender="inline"
      >
        <span>Hello world</span>
      </MarkdownBlockContainer>,
    )

    await tick(2)

    const host = dom.window.document.querySelector('p') as HTMLElement | null
    if (!host) throw new Error('expected host p')
    host.getBoundingClientRect = () => {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 320,
        bottom: 42,
        width: 320,
        height: 42,
        toJSON: () => ({}),
      } as unknown as DOMRect
    }
    host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
    await tick(3)

    const editor = dom.window.document.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected contenteditable editor')
    const sigilSpan = editor.querySelector('[data-kg-sigil="1"]') as HTMLElement | null
    if (!sigilSpan) throw new Error('expected sigil text to render as styled normal text in editor')
    if ((sigilSpan.textContent || '').trim() !== 'Hello') throw new Error('expected styled sigil text content')
    const codeLike = Array.from(editor.querySelectorAll('code')).find(n => (n.textContent || '').includes('#EF4444'))
    if (codeLike) throw new Error('expected editor not to show sigil as inline code token')

    root.unmount()
  } finally {
    restore()
  }
}
