import React from 'react'
import { createRoot } from 'react-dom/client'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { useGraphStore } from '@/hooks/useGraphStore'
import { ToolbarSourceFilesArea } from '@/features/toolbar/ToolbarSourceFilesArea'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'
import { lsSetJson } from '@/lib/persistence'
import { LS_KEYS } from '@/lib/config'
import type { GraphData } from '@/lib/graph/types'

export async function testMarkdownSourceFilesOpenInEditorUsesSelectedDocument() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  let bottomRoot: ReturnType<typeof createRoot> | null = null
  try {
    lsSetJson(LS_KEYS.markdownLayoutMode, 'viewer')

    const state = useGraphStore.getState()
    state.resetAll()
    state.setBottomPanelCurationView('markdown')
    state.clearSourceFiles()

    const graphData: GraphData = {
      type: 'Graph',
      nodes: [
        {
          id: 'n1',
          type: 'Paragraph',
          label: 'Other doc block',
          properties: {},
          metadata: { documentPath: 'docs/other.md', lineStart: 1, lineEnd: 1 },
        },
      ],
      edges: [],
      metadata: {},
    }
    state.setGraphData(graphData as never)

    state.addSourceFile({
      id: 'sf-1',
      name: 'source-1.md',
      text: ['# Source File', '', 'Hello from source file.'].join('\n'),
      enabled: true,
      status: 'idle',
      source: { kind: 'local', path: 'source-1.md' },
    })

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(ToolbarSourceFilesArea))

    const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))
    await tick()
    await tick()

    const openBtn = doc.querySelector('button[aria-label="Open in editor"]') as HTMLButtonElement | null
    if (!openBtn) throw new Error('expected Open in editor button')
    openBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()
    await tick()

    const after = useGraphStore.getState()
    if (String(after.markdownDocumentName || '') !== 'source-1.md') {
      throw new Error(`expected markdownDocumentName to be source-1.md, got ${String(after.markdownDocumentName)}`)
    }
    if (!String(after.markdownDocumentText || '').includes('Hello from source file.')) {
      throw new Error('expected markdownDocumentText to be set from opened source file')
    }

    const bottom = doc.createElement('div')
    bottom.id = 'bottom'
    doc.body.appendChild(bottom)
    bottomRoot = createRoot(bottom as unknown as HTMLElement)
    bottomRoot.render(React.createElement(BottomPanelMarkdownSection))
    await tick()
    await tick()

    const previewRoot = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLElement | null
    if (!previewRoot) throw new Error('expected markdown preview root')
    const rendered = String(previewRoot.textContent || '')
    if (!rendered.includes('Hello from source file.')) {
      throw new Error(`expected preview to render opened source file text, got length=${rendered.length}`)
    }
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    try {
      bottomRoot?.unmount()
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

