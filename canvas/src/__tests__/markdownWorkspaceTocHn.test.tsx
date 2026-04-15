import React from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceExplorer } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspaceExplorer'

export async function testMarkdownWorkspaceExplorerTocShowsHeadingNumbers() {
  const { dom, restore } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('div')
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    const tocTokens = [
      { type: 'heading', depth: 1, id: 'doc', text: 'Doc', tokens: [], raw: '', startLine: 1, endLine: 1 },
      { type: 'heading', depth: 2, id: 'a', text: 'A', tokens: [], raw: '', startLine: 3, endLine: 3 },
      { type: 'heading', depth: 2, id: 'b', text: 'B', tokens: [], raw: '', startLine: 5, endLine: 5 },
      { type: 'heading', depth: 3, id: 'b1', text: 'B1', tokens: [], raw: '', startLine: 7, endLine: 7 },
    ] as unknown as import('@/features/markdown/ui/markdownPreviewLex').TokenWithLines[]

    root.render(
      React.createElement(MarkdownWorkspaceExplorer, {
        uiPanelTextFontClass: 'font-sans',
        sidebarWidthPx: 260,
        sidebarWidthMinPx: 200,
        sidebarWidthMaxPx: 420,
        entries: [],
        filteredEntries: [],
        sourcesByPath: null,
        loading: false,
        loadError: '',
        expandedPaths: new Set<string>(),
        toggleExpanded: () => void 0,
        activePath: null,
        onSelectFile: () => void 0,
        onSelectFolder: () => void 0,
        search: '',
        setSearch: () => void 0,
        sourceFilesCollapsed: true,
        setSourceFilesCollapsed: () => void 0,
        tocCollapsed: false,
        setTocCollapsed: () => void 0,
        backlinksCollapsed: true,
        setBacklinksCollapsed: () => void 0,
        tocTokens,
        backlinks: [],
        onRevealLine: () => void 0,
        onOpenBacklink: () => void 0,
        onTocReorder: () => void 0,
        onCreateNewFile: () => void 0,
        onRefresh: () => void 0,
        activeEntryName: '',
        activeEntryKind: '',
        canClearActiveSelection: false,
        onClearActiveSelection: () => void 0,
        canRefreshActiveFromSource: false,
        onRefreshActiveFromSource: () => void 0,
        canDeleteActive: false,
        onDeleteActive: () => void 0,
        onRevealInFinder: () => void 0,
        onRenameEntry: () => void 0,
        onDeleteEntry: () => void 0,
      }),
    )

    for (let i = 0; i < 20; i += 1) {
      await new Promise<void>(resolve => setTimeout(() => resolve(), 0))
    }

    const spans = container.querySelectorAll('span.tabular-nums') as unknown as NodeListOf<HTMLSpanElement>
    const nums = Array.from(spans).map(el => String(el.textContent || '').trim()).filter(Boolean)
    if (!nums.includes('1')) throw new Error(`expected TOC hn to include "1", got: ${nums.join(', ')}`)
    if (!nums.includes('1.1')) throw new Error(`expected TOC hn to include "1.1", got: ${nums.join(', ')}`)
    if (!nums.includes('1.2')) throw new Error(`expected TOC hn to include "1.2", got: ${nums.join(', ')}`)
    if (!nums.includes('1.2.1')) throw new Error(`expected TOC hn to include "1.2.1", got: ${nums.join(', ')}`)
  } finally {
    try { root.unmount() } catch { void 0 }
    restore()
  }
}
