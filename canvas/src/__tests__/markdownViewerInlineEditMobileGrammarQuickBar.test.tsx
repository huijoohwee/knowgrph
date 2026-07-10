import React from 'react'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const tick = async (times = 1) => {
  const count = Number.isFinite(times) ? Math.max(1, Math.floor(times)) : 1
  for (let i = 0; i < count; i += 1) {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }
}

const setRect = (element: HTMLElement, rect: { left: number; top: number; right: number; bottom: number; width: number; height: number }) => {
  element.getBoundingClientRect = () =>
    ({
      x: rect.left,
      y: rect.top,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      toJSON: () => ({}),
    }) as unknown as DOMRect
}

export async function testMarkdownViewerInlineEditMobileGrammarQuickBarUsesFlowLayoutAndOpensSharedMenus() {
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
        startLine={9}
        endLine={9}
        inlineEditable
        sourceLines={['Hello world']}
        onReplaceLineRange={() => {}}
        editPresentation="html"
        editHtmlRender="inline"
      >
        <span>Hello world</span>
      </MarkdownBlockContainer>,
    )
    await tick(3)

    const host = dom.window.document.querySelector('[data-start-line="9"]') as HTMLElement | null
    if (!host) throw new Error('expected inline edit host')
    setRect(host, { left: 0, top: 0, right: 360, bottom: 72, width: 360, height: 72 })

    host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 12, clientY: 12 }))
    await tick(4)

    const editor = host.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected contenteditable editor after click')

    const quickBar = host.querySelector('[data-kg-markdown-mobile-grammar-quick-bar="true"]') as HTMLElement | null
    if (!quickBar) throw new Error('expected markdown inline edit surface to render the mobile grammar quick bar')
    const quickBarClassName = String(quickBar.className || '')
    if (!quickBarClassName.includes('sm:hidden') || quickBarClassName.includes('absolute')) {
      throw new Error(`expected markdown quick bar to remain a mobile flow row instead of an absolute overlay, got ${JSON.stringify(quickBarClassName)}`)
    }

    const slashButton = host.querySelector('[data-kg-markdown-mobile-grammar-quick-bar-token="/"]') as HTMLButtonElement | null
    const semanticButton = host.querySelector('[data-kg-markdown-mobile-grammar-quick-bar-token="#"]') as HTMLButtonElement | null
    const variableButton = host.querySelector('[data-kg-markdown-mobile-grammar-quick-bar-token="@"]') as HTMLButtonElement | null
    if (!slashButton || !semanticButton || !variableButton) {
      throw new Error('expected markdown mobile grammar quick bar to expose / # @ buttons')
    }

    setRect(slashButton, { left: 20, top: 28, right: 60, bottom: 52, width: 40, height: 24 })
    setRect(semanticButton, { left: 68, top: 28, right: 108, bottom: 52, width: 40, height: 24 })
    setRect(variableButton, { left: 116, top: 28, right: 156, bottom: 52, width: 40, height: 24 })

    slashButton.click()
    await tick(3)
    const slashMenu = dom.window.document.querySelector('section[aria-label="Slash commands"]') as HTMLElement | null
    if (!slashMenu) throw new Error(`expected slash quick bar button to open the shared slash menu, html=${dom.window.document.body.innerHTML}`)

    semanticButton.click()
    await tick(3)
    const semanticMenu = dom.window.document.querySelector('section[aria-label="Semantic commands"]') as HTMLElement | null
    if (!semanticMenu) throw new Error('expected semantic quick bar button to open the shared semantic menu')

    variableButton.click()
    await tick(3)
    const variableMenu = dom.window.document.querySelector('section[aria-label="Variable toolbar"]') as HTMLElement | null
    if (!variableMenu) throw new Error('expected variable quick bar button to open the shared variable menu')

    root.unmount()
  } finally {
    restore()
  }
}
