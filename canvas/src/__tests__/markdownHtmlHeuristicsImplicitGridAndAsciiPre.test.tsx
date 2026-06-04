import React from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { deriveSafeLayoutStyleFromClassAttr, renderSafeHtmlBlock } from '@/features/markdown/ui/markdownPreviewLinks'

export async function testMarkdownSafeHtmlHeuristicsImplicitGridAndAsciiPre() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const style = deriveSafeLayoutStyleFromClassAttr('col-span-6')
    if (!style) throw new Error('expected col-span-6 to derive a style object')
    if ('display' in style) throw new Error('expected col-span-6 to not force display on grid items')
    if (!('gridColumn' in style)) throw new Error('expected col-span-6 to set gridColumn')

    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const node = (
      <section>
        {renderSafeHtmlBlock('<section class="col-span-6">A</section><section class="col-span-6">B</section>', {
          activeDocumentPath: '/test.md',
          uiPanelTextFontClass: 'font-sans',
          uiPanelMonospaceTextClass: 'font-mono',
          markdownPresentationMode: false,
          renderNodeText: (text, key) => <React.Fragment key={key}>{text}</React.Fragment>,
          fragmentOptions: null,
        })}
        {renderSafeHtmlBlock(
          `<pre>┌───┬───┐\n│ A │ B │\n└───┴───┘</pre>`,
          {
            activeDocumentPath: '/test.md',
            uiPanelTextFontClass: 'font-sans',
            uiPanelMonospaceTextClass: 'font-mono',
            markdownPresentationMode: false,
            renderNodeText: (text, key) => <React.Fragment key={key}>{text}</React.Fragment>,
            fragmentOptions: null,
          },
        )}
      </section>
    )

    root.render(node)

    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number }
    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (raf) {
          raf(() => resolve())
          return
        }
        setTimeout(() => resolve(), 0)
      })

    for (let i = 0; i < 8; i += 1) await tick()

    const implicitGrid = (Array.from(container.querySelectorAll('section[style]')) as unknown as HTMLElement[]).find(el =>
      /grid-template-columns:\s*repeat\(12/i.test(String((el as HTMLElement).getAttribute('style') || '')),
    )
    if (!implicitGrid) throw new Error('expected implicit root children to be wrapped as a grid')
    const implicitStyle = String((implicitGrid as HTMLElement).getAttribute('style') || '')
    if (!/display:\s*grid/i.test(implicitStyle)) throw new Error(`expected implicit grid wrapper to set display:grid, got: ${implicitStyle}`)

    const asciiTable = container.querySelector('table')
    if (!asciiTable) throw new Error('expected ascii pre content to render as a table')
    const asciiPre = container.querySelector('pre')
    if (asciiPre) throw new Error('expected ascii pre content to not render as a pre')
    if (!String(asciiTable.textContent || '').includes('A') || !String(asciiTable.textContent || '').includes('B')) {
      throw new Error('expected ascii table to contain cell text')
    }

    root.unmount()
  } finally {
    restoreDom()
  }
}
