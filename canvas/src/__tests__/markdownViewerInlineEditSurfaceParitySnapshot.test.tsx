import React from 'react'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testMarkdownViewerInlineEditSurfaceParitySnapshotAppliesReadSurfaceStyles() {
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
        editCaptureLayoutSpacing
      >
        <span>Hello world</span>
      </MarkdownBlockContainer>,
    )

    await tick()
    await tick()

    const host = dom.window.document.querySelector('[data-start-line="1"]') as HTMLElement | null
    if (!host) throw new Error('expected host p')
    if (String(host.tagName || '').toUpperCase() !== 'P') throw new Error('expected host to be rendered as p')
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

    const sourceSpan = host.querySelector('span') as HTMLElement | null
    if (!sourceSpan) throw new Error('expected view source span')

    const originalGetComputedStyle = dom.window.getComputedStyle.bind(dom.window)
    dom.window.getComputedStyle = ((node: Element) => {
      if (node === sourceSpan || node === host) {
        return {
          ...originalGetComputedStyle(node),
          fontFamily: 'Inter',
          fontSize: '17px',
          fontWeight: '600',
          fontStyle: 'italic',
          lineHeight: '24px',
          letterSpacing: '0.2px',
          color: 'rgb(22, 22, 22)',
          textAlign: 'right',
          wordSpacing: '4px',
          textIndent: '8px',
          paddingTop: '3px',
          paddingRight: '7px',
          paddingBottom: '5px',
          paddingLeft: '9px',
          marginTop: '2px',
          marginRight: '4px',
          marginBottom: '6px',
          marginLeft: '8px',
          borderTopWidth: '1px',
          borderRightWidth: '2px',
          borderBottomWidth: '3px',
          borderLeftWidth: '4px',
          borderTopStyle: 'solid',
          borderRightStyle: 'dashed',
          borderBottomStyle: 'double',
          borderLeftStyle: 'dotted',
          borderTopColor: 'rgb(10, 20, 30)',
          borderRightColor: 'rgb(11, 21, 31)',
          borderBottomColor: 'rgb(12, 22, 32)',
          borderLeftColor: 'rgb(13, 23, 33)',
          borderRadius: '10px',
          boxSizing: 'border-box',
          backgroundColor: 'rgb(240, 240, 240)',
          caretColor: 'rgb(30, 30, 30)',
        } as unknown as CSSStyleDeclaration
      }
      return originalGetComputedStyle(node)
    }) as typeof dom.window.getComputedStyle

    host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
    await tick()

    const editor = dom.window.document.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected contenteditable editor to mount after click')
    if (editor.style.paddingTop !== '3px' || editor.style.paddingLeft !== '9px') {
      throw new Error('expected edit surface to reuse read-surface padding styles')
    }
    if (editor.style.marginTop !== '2px' || editor.style.marginLeft !== '8px') {
      throw new Error('expected edit surface to reuse read-surface margin styles')
    }
    if (editor.style.borderTopWidth !== '1px' || editor.style.borderLeftWidth !== '4px') {
      throw new Error('expected edit surface to reuse read-surface border width styles')
    }
    if (editor.style.borderTopStyle !== 'solid' || editor.style.borderLeftStyle !== 'dotted') {
      throw new Error('expected edit surface to reuse read-surface border style parity')
    }
    if (editor.style.textAlign !== 'right' || editor.style.textIndent !== '8px') {
      throw new Error('expected edit surface to reuse read-surface text spacing/layout parity')
    }
    if (editor.style.backgroundColor !== 'rgb(240, 240, 240)') {
      throw new Error('expected edit surface to reuse read-surface background style')
    }
    if (editor.style.caretColor !== 'rgb(30, 30, 30)') {
      throw new Error('expected edit surface to reuse read-surface caret style')
    }

    root.unmount()
  } finally {
    restore()
  }
}
