import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'

const tick = async (dom: { window: Window }) => {
  await new Promise<void>(resolve => {
    const raf = (dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame
    if (typeof raf === 'function') {
      raf(() => resolve())
      return
    }
    setTimeout(() => resolve(), 0)
  })
}

const buildLargeImportedMarkdown = (): string => {
  const paragraph = [
    'Opening marker content stays visible after scroll.',
    'This source-shaped paragraph intentionally carries enough text to enter the shared large-document viewer mode.',
    'It avoids site-specific fixtures while preserving a normal imported-webpage link line below.',
  ].join(' ')
  const lines = [
    '---',
    'kgWebpageView: markdown',
    'kgWebpageUrl: "https://example.invalid/source"',
    '---',
    '',
    '# Imported Source',
    paragraph.repeat(8),
    '',
  ]
  for (let index = 1; index <= 140; index += 1) {
    lines.push(`## Section ${index}`)
    lines.push(`${paragraph} Section marker ${index}. ${paragraph.repeat(8)}`)
    lines.push('')
    lines.push(`[Reference ${index}](https://example.invalid/reference-${index})`)
    lines.push('')
  }
  lines.push('Final marker content remains rendered at the bottom.')
  return lines.join('\n')
}

export async function testLargeImportedMarkdownKeepsContentAfterScroll() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  let root: ReturnType<typeof createRoot> | null = null
  try {
    const doc = dom.window.document
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
    }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }
    const anyGlobal = globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyGlobal.requestAnimationFrame) {
      anyGlobal.requestAnimationFrame = anyWindow.requestAnimationFrame
    }

    const markdownText = buildLargeImportedMarkdown()
    if (markdownText.length <= 250_000) {
      throw new Error(`expected large imported markdown fixture, got ${markdownText.length} chars`)
    }

    const container = doc.getElementById('root')
    if (!container) throw new Error('missing root container')

    root = createRoot(container as unknown as HTMLElement)
    await act(async () => {
      root?.render(
        React.createElement(MarkdownPreview, {
          markdownText,
          activeDocumentPath: '/imports/source.md',
          highlightedLineRange: null,
          markdownWordWrap: true,
          markdownPresentationMode: false,
          markdownTextHighlight: true,
          uiPanelTextFontClass: 'font-sans text-xs',
          uiPanelMonospaceTextClass: 'font-mono text-xs',
          previewOverlayScope: 'container',
          previewOverlayPortalTarget: null,
          previewScrollable: true,
          viewMode: 'viewer',
        }),
      )
      await tick(dom)
      await tick(dom)
    })

    const previewRoot = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLElement | null
    if (!previewRoot) throw new Error('expected markdown preview root')
    if (previewRoot.getAttribute('data-kg-large-markdown-viewer') !== '1') {
      throw new Error('expected imported source to use large-document viewer mode')
    }

    Object.defineProperty(previewRoot, 'scrollHeight', { value: 100_000, configurable: true })
    Object.defineProperty(previewRoot, 'clientHeight', { value: 800, configurable: true })
    previewRoot.scrollTop = 80_000
    previewRoot.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await act(async () => {
      await tick(dom)
    })

    const articleText = String(previewRoot.querySelector('article')?.textContent || '')
    if (!articleText.includes('Opening marker content stays visible after scroll.')) {
      throw new Error('expected opening imported markdown content to remain rendered after scroll')
    }
    if (!articleText.includes('Final marker content remains rendered at the bottom.')) {
      throw new Error('expected final imported markdown content to remain rendered after scroll')
    }
    const stickyHeadings = previewRoot.querySelectorAll('[data-kg-sticky-heading="1"]')
    if (stickyHeadings.length > 0) {
      throw new Error(`expected large imported markdown headings to avoid sticky stacking, saw ${stickyHeadings.length}`)
    }
    if (previewRoot.querySelector('figure, [data-kg-webpage-snapshot="1"]')) {
      throw new Error('expected large imported markdown standalone links to render as plain Markdown links')
    }
  } finally {
    try {
      await act(async () => {
        root?.unmount()
      })
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}
