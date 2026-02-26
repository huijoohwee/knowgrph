import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownPreviewRendersHtmlTableDivAndPictureSources() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdownText = [
      '<div class="table table-fixed border-collapse w-full">',
      '  <div class="table-row">',
      '    <div class="table-cell">A</div>',
      '    <div class="table-cell">B</div>',
      '  </div>',
      '</div>',
      '',
      '<picture>',
      '  <source type="image/webp" srcset="https://example.com/a.webp 1x" />',
      '  <source type="image/png" srcset="https://example.com/a.png 1x" />',
      '  <img src="https://example.com/a.png" alt="Example" width="320" height="200" />',
      '</picture>',
      '',
    ].join('\n')

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: '/test.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans',
        uiPanelMonospaceTextClass: 'font-mono',
        previewOverlayScope: 'container',
        previewOverlayPortalTarget: null,
        previewScrollable: false,
        showSidebar: false,
      }),
    )

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

    for (let i = 0; i < 12; i += 1) await tick()

    const tableRoot = container.querySelector('section.table') as HTMLElement | null
    if (!tableRoot) throw new Error('expected table-like div structure to render')
    if (tableRoot.style.display !== 'table') throw new Error(`expected display: table, got: ${tableRoot.getAttribute('style') || ''}`)
    if (tableRoot.style.tableLayout !== 'fixed') {
      throw new Error(`expected table-layout: fixed, got: ${tableRoot.getAttribute('style') || ''}`)
    }
    if (tableRoot.style.borderCollapse !== 'collapse') {
      throw new Error(`expected border-collapse: collapse, got: ${tableRoot.getAttribute('style') || ''}`)
    }

    const row = container.querySelector('section.table-row') as HTMLElement | null
    if (!row) throw new Error('expected table-row to render')
    if (row.style.display !== 'table-row') throw new Error(`expected display: table-row, got: ${row.getAttribute('style') || ''}`)

    const cells = Array.from(container.querySelectorAll('section.table-cell')) as HTMLElement[]
    if (cells.length < 2) throw new Error('expected table-cell elements to render')
    for (const cell of cells) {
      if (cell.style.display !== 'table-cell') {
        throw new Error(`expected display: table-cell, got: ${cell.getAttribute('style') || ''}`)
      }
    }

    const pic = container.querySelector('picture') as HTMLPictureElement | null
    if (!pic) throw new Error('expected picture element to render')
    const sources = pic.querySelectorAll('source')
    if (sources.length < 2) throw new Error('expected multiple picture sources to be preserved')
    const img = pic.querySelector('img')
    if (!img) throw new Error('expected picture img fallback to be rendered')
    const imgSrc = String(img.getAttribute('src') || '')
    if (!imgSrc) throw new Error('expected picture img src to be set')
    const decodedImgSrc = (() => {
      try {
        return decodeURIComponent(imgSrc)
      } catch {
        return imgSrc
      }
    })()
    if (!/example\.com\/a\.png/i.test(decodedImgSrc)) {
      throw new Error(`expected fallback img src to reference a.png, got: ${imgSrc}`)
    }
    const alt = String(img.getAttribute('alt') || '')
    if (alt !== 'Example') throw new Error('expected picture img alt to be preserved')

    root.unmount()
  } finally {
    restoreDom()
  }
}
