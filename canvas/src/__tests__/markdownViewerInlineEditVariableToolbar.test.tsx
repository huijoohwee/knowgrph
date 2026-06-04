import React from 'react'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const tick = async (times = 1) => {
  const n = Number.isFinite(times) ? Math.max(1, Math.floor(times)) : 1
  for (let i = 0; i < n; i += 1) {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
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

export async function testMarkdownViewerInlineEditVariableToolbarInvokesWithAtAndAppliesReference() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
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
    await tick(3)
    await tick()

    const editor = host.querySelector('[contenteditable="true"]') as HTMLElement | null
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

    const panel = (variableKeyInput.closest('section') || variableKeyInput.parentElement) as HTMLElement | null
    if (!panel) throw new Error('expected variable toolbar panel')

    const suggestionButton = Array.from(panel.querySelectorAll('button')).find(
      el => String((el as HTMLButtonElement).textContent || '').trim().startsWith('venue'),
    ) as HTMLButtonElement | undefined
    if (!suggestionButton) throw new Error('expected variable suggestion list to include venue')
    const toolbarButtons = Array.from(panel.querySelectorAll('button')).map(
      el => String((el as HTMLButtonElement).textContent || '').trim(),
    )
    if (!toolbarButtons.includes('Delete') || !toolbarButtons.includes('New Variable') || !toolbarButtons.includes('Edit Key')) {
      throw new Error('expected variable toolbar to expose CRUD controls')
    }
    suggestionButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await tick()

    const applyButton = Array.from(panel.querySelectorAll('button')).find(
      el => String((el as HTMLButtonElement).textContent || '').trim() === 'Apply',
    ) as HTMLButtonElement | undefined
    if (!applyButton) throw new Error('expected variable toolbar apply button')
    applyButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await tick()
    await tick()

    const editorNow = host.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editorNow) throw new Error('expected contenteditable editor after apply')
    const text = String(editorNow.textContent || '')
    if (!text.includes('{{venue}}')) throw new Error(`expected apply to insert {{venue}} token; text=${JSON.stringify(text)}`)
    if (text.includes('@ve')) throw new Error(`expected apply to replace @ query trigger; text=${JSON.stringify(text)}`)

    root.unmount()
  } finally {
    restore()
  }
}

export async function testMarkdownViewerInlineEditVariableToolbarDeleteUpdatesFrontmatter() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')
    const reactDomClient = await import('react-dom/client')
    const root = reactDomClient.createRoot(container)
    const mod = await import('@/features/markdown/ui/MarkdownBlockContainer')
    const MarkdownBlockContainer = mod.MarkdownBlockContainer
    let replacePayload: { startLine: number; endLine: number; replacementLines: string[] } | null = null

    root.render(
      <MarkdownBlockContainer
        as="p"
        className="mt-2 mb-2 text-sm"
        highlightClass=""
        startLine={5}
        endLine={5}
        inlineEditable
        sourceLines={['---', 'venue: "Singapore"', '---', '', 'Body line']}
        onReplaceLineRange={(args) => { replacePayload = args }}
        editPresentation="html"
        editHtmlRender="inline"
      >
        <span>Body line @venue</span>
      </MarkdownBlockContainer>,
    )

    await tick()
    await tick()

    const host = dom.window.document.querySelector('[data-start-line="5"]') as HTMLElement | null
    if (!host) throw new Error('expected host')
    host.getBoundingClientRect = () =>
      ({
        x: 0, y: 0, top: 0, left: 0, right: 320, bottom: 42, width: 320, height: 42, toJSON: () => ({})
      }) as unknown as DOMRect
    host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
    await tick(3)
    await tick()

    const editor = host.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected contenteditable editor')
    ;(dom.window.Range.prototype as unknown as { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect = () =>
      ({ x: 0, y: 0, top: 0, left: 0, right: 80, bottom: 22, width: 80, height: 22, toJSON: () => ({}) }) as unknown as DOMRect
    editor.textContent = 'Body line @venue'
    setCaretToEnd(dom.window, editor)
    editor.dispatchEvent(new dom.window.InputEvent('input', { bubbles: true, cancelable: true }))
    await tick()
    await tick()

    const keyInput = Array.from(dom.window.document.querySelectorAll('input')).find(
      el => (el as HTMLInputElement).placeholder === 'variable key',
    ) as HTMLInputElement | undefined
    if (!keyInput) throw new Error('expected variable key input')
    if (keyInput.value !== 'venue') throw new Error(`expected @ query to seed key input with "venue", got ${keyInput.value}`)
    await tick()

    const deleteButton = Array.from(dom.window.document.querySelectorAll('button')).find(
      el => String((el as HTMLButtonElement).textContent || '').trim() === 'Delete',
    ) as HTMLButtonElement | undefined
    if (!deleteButton) throw new Error('expected delete button')
    deleteButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await tick()
    await tick()

    if (!replacePayload) throw new Error('expected frontmatter delete to call onReplaceLineRange')
    if (replacePayload.startLine !== 1 || replacePayload.endLine !== 3) {
      throw new Error(`expected frontmatter range replace (1..3), got ${replacePayload.startLine}..${replacePayload.endLine}`)
    }
    const merged = replacePayload.replacementLines.join('\n')
    if (merged.includes('venue: "Singapore"')) throw new Error('expected delete to remove frontmatter key')

    root.unmount()
  } finally {
    restore()
  }
}
