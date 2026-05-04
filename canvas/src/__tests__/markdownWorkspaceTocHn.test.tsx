import React from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceExplorer } from '@/features/markdown-workspace/MarkdownWorkspaceExplorer'
import {
  buildMarkdownTocMetadata,
  buildTocHeadingNumberById,
  buildTocParentById,
  buildTocTree,
  buildVisibleMarkdownTocModel,
  resolveTocBaseDepth,
} from '@/features/markdown/ui/markdownSectionUtils'

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
    const tocTree = buildTocTree(tocTokens)
    const metadata = buildMarkdownTocMetadata(tocTree)
    const visibleModel = buildVisibleMarkdownTocModel({ tokens: tocTokens, collapsed: false })
    const collapsedModel = buildVisibleMarkdownTocModel({ tokens: tocTokens, collapsed: true })
    const headingNumbers = buildTocHeadingNumberById(tocTree)
    const parentById = buildTocParentById(tocTree)
    const baseDepth = resolveTocBaseDepth(tocTree)

    if (headingNumbers.get('doc') !== '1') throw new Error(`expected helper hn for doc to be 1, got ${String(headingNumbers.get('doc') || '')}`)
    if (headingNumbers.get('a') !== '1.1') throw new Error(`expected helper hn for a to be 1.1, got ${String(headingNumbers.get('a') || '')}`)
    if (headingNumbers.get('b') !== '1.2') throw new Error(`expected helper hn for b to be 1.2, got ${String(headingNumbers.get('b') || '')}`)
    if (headingNumbers.get('b1') !== '1.2.1') throw new Error(`expected helper hn for b1 to be 1.2.1, got ${String(headingNumbers.get('b1') || '')}`)
    if (parentById.get('doc') !== null) throw new Error(`expected doc to have null parent, got ${String(parentById.get('doc'))}`)
    if (parentById.get('b1') !== 'b') throw new Error(`expected b1 parent to be b, got ${String(parentById.get('b1') || '')}`)
    if (baseDepth !== 1) throw new Error(`expected base depth 1, got ${String(baseDepth)}`)
    if (metadata.headingNumberById.get('b1') !== '1.2.1') throw new Error(`expected metadata hn for b1 to be 1.2.1, got ${String(metadata.headingNumberById.get('b1') || '')}`)
    if (metadata.parentById.get('b1') !== 'b') throw new Error(`expected metadata parent for b1 to be b, got ${String(metadata.parentById.get('b1') || '')}`)
    if (metadata.lineById.get('b') !== 5) throw new Error(`expected metadata line for b to be 5, got ${String(metadata.lineById.get('b') || 0)}`)
    if (metadata.baseDepth !== 1) throw new Error(`expected metadata base depth 1, got ${String(metadata.baseDepth)}`)
    if (visibleModel.items.length !== 1) throw new Error(`expected visible TOC model root size 1, got ${String(visibleModel.items.length)}`)
    if (visibleModel.metadata.headingNumberById.get('b1') !== '1.2.1') throw new Error(`expected visible TOC model hn for b1 to be 1.2.1, got ${String(visibleModel.metadata.headingNumberById.get('b1') || '')}`)
    if (collapsedModel.items.length !== 0) throw new Error(`expected collapsed TOC model to hide items, got ${String(collapsedModel.items.length)}`)
    if (collapsedModel.metadata.headingNumberById.size !== 0) throw new Error(`expected collapsed TOC model metadata to be empty, got ${String(collapsedModel.metadata.headingNumberById.size)}`)

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
