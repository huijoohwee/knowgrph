import React from 'react'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const tick = async (times = 1) => {
  const n = Number.isFinite(times) ? Math.max(1, Math.floor(times)) : 1
  for (let i = 0; i < n; i += 1) {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }
}

const waitMs = async (ms: number) => {
  await new Promise<void>(resolve => setTimeout(resolve, ms))
}

export async function testMarkdownViewerInlineEditNoInputDomNormalizationDoesNotMutateSource() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section><button id="outside">outside</button></body></html>')
  try {
    const container = dom.window.document.getElementById('root')
    const outside = dom.window.document.getElementById('outside')
    if (!container || !outside) throw new Error('missing test nodes')
    const reactDomClient = await import('react-dom/client')
    const root = reactDomClient.createRoot(container)
    const mod = await import('@/features/markdown/ui/MarkdownBlockContainer')
    const MarkdownBlockContainer = mod.MarkdownBlockContainer
    const sourceLine = 'This is the /prd-tad.create minimum viable runnable ![1920s_Singapore_Malaya_20260](https://example.com/media.png) Strybldr seed. #canvas @canvas'
    const replacements: Array<{ startLine: number; endLine: number; replacementLines: string[] }> = []
    root.render(
      <MarkdownBlockContainer
        as="p"
        className="mt-2 mb-2 text-sm"
        highlightClass=""
        startLine={1}
        endLine={1}
        inlineEditable
        sourceLines={[sourceLine]}
        onReplaceLineRange={args => replacements.push(args)}
        editPresentation="html"
        editHtmlRender="inline"
      >
        <span>{sourceLine}</span>
      </MarkdownBlockContainer>,
    )
    await tick(2)
    const host = dom.window.document.querySelector('[data-start-line="1"]') as HTMLElement | null
    if (!host) throw new Error('expected host p')
    host.getBoundingClientRect = () =>
      ({ x: 0, y: 0, top: 0, left: 0, right: 480, bottom: 42, width: 480, height: 42, toJSON: () => ({}) }) as unknown as DOMRect
    host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
    await tick(4)
    const editor = host.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected contenteditable editor to mount after click')
    const mediaToken = editor.querySelector('[data-kg-inline-media-edit-token="1"]') as HTMLElement | null
    const slashToken = editor.querySelector('[data-kg-inline-invocation-edit-token="1"][data-kg-inline-invocation-markdown="/prd-tad.create"]') as HTMLElement | null
    if (!mediaToken || !slashToken) {
      throw new Error(`expected edit session to hydrate media and invocation chips, html=${editor.innerHTML}`)
    }

    mediaToken.replaceWith(dom.window.document.createTextNode('1920s_Singapore_Malaya_20260'))
    slashToken.replaceWith(dom.window.document.createTextNode('/prd-tad.create'))
    outside.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
    editor.dispatchEvent(new dom.window.FocusEvent('focusout', { bubbles: true, relatedTarget: outside }))
    editor.dispatchEvent(new dom.window.FocusEvent('blur', { bubbles: false, relatedTarget: outside }))
    await waitMs(180)
    await tick(2)

    if (replacements.length !== 0) {
      throw new Error(`expected no-input Viewer edit session not to write normalized chip text, got ${JSON.stringify(replacements)}`)
    }
    if (host.querySelector('[contenteditable="true"]')) {
      throw new Error('expected no-input blur to close the Viewer inline editor')
    }
    root.unmount()
  } finally {
    restore()
  }
}
