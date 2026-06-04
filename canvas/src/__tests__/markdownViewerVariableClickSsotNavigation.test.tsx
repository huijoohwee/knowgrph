import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testMarkdownViewerVariableClickNavigatesToSsotLine() {
  const { dom, restore } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  let root: ReturnType<typeof createRoot> | null = null
  try {
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root')
    root = createRoot(container)
    const calls: number[] = []
    const markdownText = [
      '---',
      'venue: "Singapore"',
      '---',
      '',
      'Meet at {{venue}}',
    ].join('\n')

    root.render(
      <MarkdownPreview
        markdownText={markdownText}
        activeDocumentPath="docs/sample.md"
        highlightedLineRange={null}
        markdownWordWrap
        markdownPresentationMode={false}
        markdownTextHighlight={false}
        uiPanelTextFontClass="font-sans text-xs"
        uiPanelMonospaceTextClass="font-mono text-xs"
        previewOverlayScope="container"
        previewOverlayPortalTarget={null}
        previewScrollable
        onShowInEditor={(line) => calls.push(line)}
      />,
    )
    await tick()
    await tick()

    const variableLink = dom.window.document.querySelector('[data-kg-var-key="venue"]') as HTMLAnchorElement | null
    if (!variableLink) throw new Error('expected variable link')
    variableLink.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await tick()

    if (calls.length !== 1 || calls[0] !== 2) {
      throw new Error(`expected variable click to navigate to frontmatter ssot line 2; got ${JSON.stringify(calls)}`)
    }
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restore()
  }
}
