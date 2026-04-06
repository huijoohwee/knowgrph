import React from 'react'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
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

export async function testMarkdownViewerInlineEditVariableToolbarInvokesWithAtAndAppliesReference() {
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
        sourceLines={['Hello @ve', '{{venue}}']}
        onReplaceLineRange={() => {}}
        editPresentation="html"
        editHtmlRender="inline"
      >
        <span>Hello @ve</span>
      </MarkdownBlockContainer>,
    )

    await tick()
    await tick()

    const host = dom.window.document.querySelector('[data-start-line="1"]') as HTMLElement | null
    if (!host) throw new Error('expected host p')
    host.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 320,
        bottom: 42,
        width: 320,
        height: 42,
        toJSON: () => ({}),
      }) as unknown as DOMRect
    host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
    await tick()
    await tick()

    const editor = dom.window.document.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected contenteditable editor to mount after click')
    ;(dom.window.Range.prototype as unknown as { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 80,
        bottom: 22,
        width: 80,
        height: 22,
        toJSON: () => ({}),
      }) as unknown as DOMRect
    editor.textContent = 'Hello @ve'
    setCaretToEnd(dom.window, editor)
    editor.dispatchEvent(new dom.window.InputEvent('input', { bubbles: true, cancelable: true }))
    await tick()
    await tick()

    const variableKeyInput = Array.from(dom.window.document.querySelectorAll('input')).find(
      el => (el as HTMLInputElement).placeholder === 'variable key',
    ) as HTMLInputElement | undefined
    if (!variableKeyInput) throw new Error('expected variable toolbar to open from @ trigger')
    if (variableKeyInput.value !== 've') throw new Error('expected @query to seed variable key input')

    const suggestionButton = Array.from(dom.window.document.querySelectorAll('button')).find(
      el => String((el as HTMLButtonElement).textContent || '').trim() === 'venue',
    ) as HTMLButtonElement | undefined
    if (!suggestionButton) throw new Error('expected variable suggestion list to include venue')
    const toolbarButtons = Array.from(dom.window.document.querySelectorAll('button')).map(
      el => String((el as HTMLButtonElement).textContent || '').trim(),
    )
    if (!toolbarButtons.includes('Delete') || !toolbarButtons.includes('Create') || !toolbarButtons.includes('Update')) {
      throw new Error('expected variable toolbar to expose CRUD controls')
    }
    suggestionButton.click()
    await tick()

    const applyButton = Array.from(dom.window.document.querySelectorAll('button')).find(
      el => String((el as HTMLButtonElement).textContent || '').trim() === 'Apply',
    ) as HTMLButtonElement | undefined
    if (!applyButton) throw new Error('expected variable toolbar apply button')
    applyButton.click()
    await tick()
    await tick()

    const text = String(editor.textContent || '')
    if (!text.includes('{{venue}}')) throw new Error(`expected apply to insert {{venue}} token; text=${JSON.stringify(text)}`)
    if (text.includes('@ve')) throw new Error(`expected apply to replace @ query trigger; text=${JSON.stringify(text)}`)

    root.unmount()
  } finally {
    restore()
  }
}
