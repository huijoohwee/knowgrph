import React from 'react'
import { createRoot } from 'react-dom/client'
import PreviewPanelView from '@/features/panels/views/PreviewPanelView'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { readSandboxDemoText, toDocumentPath } from '@/tests/lib/sandboxRoot'

const extractMermaidFence = (markdown: string): string => {
  const text = String(markdown || '')
  const bt = String.fromCharCode(96)
  const fence = bt + bt + bt + 'mermaid'
  const fenceEnd = bt + bt + bt
  const start = text.indexOf(fence)
  if (start < 0) return ''
  const afterFence = text.indexOf('\n', start)
  if (afterFence < 0) return ''
  const end = text.indexOf(fenceEnd, afterFence + 1)
  if (end < 0) return ''
  return text.slice(afterFence + 1, end)
}

const countDiagramStarts = (mermaid: string): number => {
  const code = String(mermaid || '').replace(/\r\n?/g, '\n')
  const starts = code.match(/^\s*(graph|flowchart)\b/gm) || []
  return starts.length
}

export async function testPreviewPanelSplitsMultiDiagramMermaidCodeBlocks() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document

    const res = readSandboxDemoText({
      preferBasename: 'graphrag-pipeline-mmd-demo.md',
      predicate: text => /```\s*mermaid/i.test(text),
      envVarPathKey: 'KG_GRAPHRAG_PIPELINE_MMD_DEMO_PATH',
    })
    if (!res) return
    const fence = extractMermaidFence(res.text)
    const expected = countDiagramStarts(fence)
    if (expected < 2) return

    const state = useGraphStore.getState()
    state.setMarkdownDocument(toDocumentPath(res.path) || 'graphrag-pipeline-mmd-demo.md', res.text)
    state.setMarkdownPreviewMermaidFocus(null)
    state.setMarkdownPreviewActiveMediaKey(null)

    const container = doc.createElement('section')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(PreviewPanelView))

    const tick = (ms = 0) => new Promise<void>(resolve => setTimeout(() => resolve(), ms))
    for (let i = 0; i < 10; i += 1) await tick(i ? 10 : 0)

    const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
    const mermaidCards = buttons.filter(b => (b.textContent || '').toLowerCase().includes('mermaid'))
    if (mermaidCards.length < expected) {
      throw new Error(`expected >=${expected} mermaid gallery cards, got ${mermaidCards.length}`)
    }

    mermaidCards[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick(20)

    const focused = useGraphStore.getState().markdownPreviewMermaidFocusCode || ''
    const focusedStarts = (String(focused).match(/^\s*(graph|flowchart)\b/gm) || []).length
    if (focusedStarts > 1) {
      throw new Error(`expected focused mermaid code to be a single diagram, got ${focusedStarts} diagram starts`)
    }

    const textContent = String(doc.body.textContent || '')
    if (textContent.includes('Parse error')) {
      throw new Error('unexpected Mermaid parse error in Preview panel')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

