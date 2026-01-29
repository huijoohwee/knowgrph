import React from 'react'
import { createRoot } from 'react-dom/client'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { useGraphStore } from '@/hooks/useGraphStore'
import { ToolbarSourceFilesArea } from '@/features/toolbar/ToolbarSourceFilesArea'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'
import { lsSetJson } from '@/lib/persistence'
import { LS_KEYS } from '@/lib/config'

export async function testMarkdownOpenInEditorAutoParsesFrontmatterGraph() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  try {
    lsSetJson(LS_KEYS.markdownLayoutMode, 'viewer')

    const state = useGraphStore.getState()
    state.resetAll()
    state.clearSourceFiles()

    const text = [
      '---',
      'title: Auto-parse',
      'mermaid: |',
      '  graph TD',
      '    A-->B',
      '---',
      '',
      '# Body',
      '',
      '<a id="b"></a>',
    ].join('\n')

    state.addSourceFile({
      id: 'sf-1',
      name: 'auto.md',
      text,
      enabled: true,
      status: 'idle',
      source: { kind: 'local', path: 'auto.md' },
    })

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(ToolbarSourceFilesArea))

    const tick = (ms = 0) => new Promise<void>(resolve => setTimeout(resolve, ms))
    await tick()
    await tick()

    const openBtn = doc.querySelector('button[aria-label="Open in editor"]') as HTMLButtonElement | null
    if (!openBtn) throw new Error('expected Open in editor button')
    openBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick(50)
    await tick(50)

    const after = useGraphStore.getState()
    const graph = after.graphData
    if (!graph) throw new Error('expected graphData after open in editor')
    if ((graph.nodes || []).length === 0) throw new Error('expected graph nodes after open in editor')

    const focused = filterGraphToFrontmatterMermaid(graph)
    const hasFrontmatterMermaid = (focused.nodes || []).some(n => {
      const props = (n.properties || {}) as Record<string, unknown>
      return props.isMermaidFrontmatter === true || props.mermaidScope === 'frontmatter'
    })
    if (!hasFrontmatterMermaid) throw new Error('expected frontmatter MermaidDiagram node in focused graph')
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

