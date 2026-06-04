import React from 'react'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import MarkdownTokenRenderer from '@/features/markdown/ui/MarkdownTokenRenderer'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

const setRect = (el: HTMLElement, width: number = 560, height: number = 120) => {
  el.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  } as unknown as DOMRect)
}

export async function testMarkdownViewerInlineEditTableDoesNotOpenGenericContentEditableSurface() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    const reactDomClient = await import('react-dom/client')
    const createRoot = reactDomClient.createRoot
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const markdown = ['| Name | Status |', '| --- | --- |', '| A | Todo |', '| B | Done |'].join('\n')
    const sourceLines = markdown.split('\n')
    const { tokens } = lexMarkdown(markdown)

    const root = createRoot(container)
    root.render(
      <MarkdownTokenRenderer
        tokens={tokens}
        activeDocumentPath="/sandbox/demo/table-inline-edit.md"
        highlightedLineRange={null}
        markdownWordWrap
        markdownPresentationMode={false}
        uiPanelTextFontClass="font-sans"
        uiPanelMonospaceTextClass="font-mono text-xs"
        mermaidFrontmatterConfig={null}
        rootThemeMode="light"
        previewOverlayScope="container"
        markdownSourceLines={sourceLines}
        viewerBlockEditingEnabled
        onReplaceLineRange={() => {}}
      />,
    )
    await tick()
    await tick()

    const host = dom.window.document.querySelector('[data-start-line="1"]') as HTMLElement | null
    if (!host) throw new Error('expected table host')
    setRect(host)
    host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 12, clientY: 12 }))
    await tick()
    await tick()

    const editor = host.querySelector('[contenteditable="true"]')
    if (editor) {
      throw new Error('expected table block to avoid generic contentEditable text-edit surface')
    }

    root.unmount()
  } finally {
    restore()
  }
}
