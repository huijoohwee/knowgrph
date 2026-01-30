import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownTokenRenderer from '@/features/markdown/ui/MarkdownTokenRenderer'
import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownHtmlCodeFenceRespectsFragmentsInRenderMode() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const markdownText = [
      '```html',
      '<v-clicks>',
      '',
      '- Appears on click 1',
      '- Appears on click 2',
      '- Appears on click 3',
      '',
      '</v-clicks>',
      '```',
    ].join('\n')

    const { tokens } = lexMarkdown(markdownText)

    const container = doc.createElement('section')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(
      React.createElement(MarkdownTokenRenderer, {
        tokens,
        activeDocumentPath: 'inline-html-fragments.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: true,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        previewOverlayScope: 'viewport',
        previewOverlayPortalTarget: null,
        annotateDisplayMode: 'render',
        fragmentsEnabled: true,
        fragmentStep: 1,
        fragmentClassNames: ['fragment'],
        fragmentTags: ['v-click', 'v-mark', 'v-clicks'],
      } as never),
    )

    const tick = (ms = 0) => new Promise<void>(resolve => setTimeout(() => resolve(), ms))
    for (let i = 0; i < 4; i += 1) await tick(i ? 10 : 0)

    const liEls = Array.from(doc.querySelectorAll('li')) as Array<{ textContent?: string | null }>
    const lis = liEls.map(el => String(el.textContent || '').trim())
    if (lis.length !== 1 || lis[0] !== 'Appears on click 1') {
      throw new Error(`expected exactly 1 v-clicks item at step 1, got: ${JSON.stringify(lis)}`)
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
