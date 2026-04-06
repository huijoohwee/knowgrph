import React from 'react'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testMarkdownViewerInlineEditParagraphDoesNotInsertBlockElementsIntoP() {
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
        sourceLines={['Hello world']}
        onReplaceLineRange={() => {}}
        editPresentation="html"
        editHtmlRender="inline"
      >
        <span>Hello world</span>
      </MarkdownBlockContainer>,
    )

    await tick()

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
    await tick()

    const editor = dom.window.document.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected contenteditable editor to mount after click')
    if (String(editor.tagName || '').toUpperCase() !== 'SPAN') {
      throw new Error('expected paragraph editing surface to use inline editor tag')
    }

    const wrapper = editor.parentElement as HTMLElement | null
    if (!wrapper) throw new Error('expected editor wrapper')
    if (wrapper.parentElement !== host) throw new Error('expected editor wrapper to be a direct child of <p>')
    if (dom.window.document.querySelector('p div')) {
      throw new Error('expected no block-level div to be inserted into <p> during inline editing')
    }
    if (String(wrapper.style.minHeight || '') !== '42px') {
      throw new Error('expected editor wrapper minHeight to preserve layout height')
    }

    root.unmount()
  } finally {
    restore()
  }
}

