import React from 'react'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const tick = async (times = 1) => {
  const n = Number.isFinite(times) ? Math.max(1, Math.floor(times)) : 1
  for (let i = 0; i < n; i += 1) {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }
}

const ensureRangeRect = (dom: ReturnType<typeof initJsdomHarness>['dom']) => {
  try {
    const proto = (dom.window as unknown as { Range?: { prototype?: Record<string, unknown> } }).Range?.prototype as unknown as {
      getBoundingClientRect?: () => DOMRect
    } | null
    if (proto && typeof proto.getBoundingClientRect !== 'function') {
      proto.getBoundingClientRect = () => {
        return {
          x: 0, y: 0, top: 0, left: 0, right: 10, bottom: 10, width: 10, height: 10, toJSON: () => ({}),
        } as unknown as DOMRect
      }
    }
  } catch {
    void 0
  }
}

const setCaretToEnd = (dom: Window, el: HTMLElement) => {
  const sel = dom.getSelection()
  if (!sel) return
  const node = el.firstChild || el
  const len = node.nodeType === Node.TEXT_NODE ? String(node.textContent || '').length : el.textContent?.length || 0
  const range = dom.document.createRange()
  range.setStart(node, Math.max(0, len))
  range.setEnd(node, Math.max(0, len))
  sel.removeAllRanges()
  sel.addRange(range)
}

export async function testMarkdownViewerInlineEditFirstInputIsNotClobberedByInitialization() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    ensureRangeRect(dom)
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

    const host = dom.window.document.querySelector('[data-start-line="1"]') as HTMLElement | null
    if (!host) throw new Error('expected host')
    host.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, left: 0, right: 320, bottom: 42, width: 320, height: 42, toJSON: () => ({}),
    }) as unknown as DOMRect

    host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))

    await tick(1)
    const editor = host.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected editor after click')

    editor.textContent = 'Hello worldX'
    setCaretToEnd(dom.window, editor)
    editor.dispatchEvent(new dom.window.InputEvent('input', { bubbles: true, cancelable: true }))

    await tick(3)

    const textNow = String(editor.textContent || '')
    if (!textNow.includes('Hello worldX')) {
      throw new Error(`expected first input to persist; text=${JSON.stringify(textNow)}`)
    }

    root.unmount()
  } finally {
    restore()
  }
}

