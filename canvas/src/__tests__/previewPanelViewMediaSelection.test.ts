import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import PreviewPanelView from '@/features/panels/views/PreviewPanelView'
import CommandMenuCatalogPanel from '@/features/command-menu/CommandMenuCatalogPanel'
import { dedupeCommandMenuRichMediaItems, type CommandMenuRichMediaItem } from '@/lib/command-menu/commandMenuRichMediaInventory'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames, waitForNextFrame } from '@/tests/lib/reactRootHarness'
import { buildMarkdownPreviewMediaKey } from '@/features/markdown/ui/markdownPreviewLinks'

const buildGraphWithMediaNode = (): GraphData => ({
  type: 'Graph',
  nodes: [
    {
      id: 'n1',
      type: 'RichMediaPanel',
      label: 'Example media node',
      properties: {
        richMediaActiveTab: 'image',
        imageUrl: 'https://example.com/example.png',
      },
      metadata: {
        documentPath: 'doc.md',
        lineStart: 5,
        lineEnd: 7,
      },
    },
  ],
  edges: [],
})

const buildGraphWithConflictingSeedanceAndRichMediaPanelNodes = (): GraphData => ({
  type: 'Graph',
  nodes: [
    {
      id: 'byteplus-video-widget',
      type: 'VideoGeneration',
      label: 'ByteDance-Seedance-1.0-pro-fast BytePlus Video Widget',
      properties: {
        media_url: 'https://example.com/flower.mp4',
        videoUrl: 'https://example.com/flower.mp4',
      },
    },
    {
      id: 'rich-media-panel',
      type: 'RichMediaPanel',
      label: 'Rich Media Panel',
      properties: {
        media_url: '/__fetch_remote?url=https%3A%2F%2Fexample.com%2Fflower.mp4',
        videoUrl: '/__fetch_remote?url=https%3A%2F%2Fexample.com%2Fflower.mp4',
      },
    },
  ],
  edges: [],
})

const buildGraphWithRichMediaPanelTextPreview = (): GraphData => ({
  type: 'Graph',
  nodes: [
    {
      id: 'rich-media-text-panel',
      type: 'RichMediaPanel',
      label: 'Rich Media Panel',
      properties: {
        richMediaActiveTab: 'text',
        output: '# Inline preview\n\nBody copy.',
        outputSrcDoc: '<!doctype html><html><body><h1>Inline preview</h1><p>Body copy.</p></body></html>',
      },
    },
  ],
  edges: [],
})

const buildMarkdown = (): string =>
  [
    '# Title',
    '',
    'Paragraph before image.',
    '',
    '![Inline image](https://example.com/example.png)',
    '',
  ].join('\n')

const readCommandMenuMediaRowName = (row: Element): string => {
  const input = row.querySelector('[data-kg-command-menu-media-name-input]') as HTMLInputElement | null
  const label = row.querySelector('[data-kg-command-menu-media-name-text]') as HTMLElement | null
  return String(input?.value || label?.textContent || row.textContent || '')
}

type InputHarnessWindow = Window & typeof globalThis

const setInputValue = (window: InputHarnessWindow, input: HTMLInputElement, value: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
  descriptor?.set?.call(input, value)
  const InputEventCtor = (window as unknown as { InputEvent?: typeof InputEvent }).InputEvent
  input.dispatchEvent(InputEventCtor
    ? new InputEventCtor('input', { bubbles: true, inputType: 'insertText', data: value })
    : new window.Event('input', { bubbles: true }))
  input.dispatchEvent(new window.Event('change', { bubbles: true }))
}

export async function testCommandMenuGraphMediaSelectionSelectsPreviewMedia() {
  const storage = new MemoryStorage()
  const { dom, restore: restoreDom } = initJsdomHarness()
  const { restore: restoreWindow } = initWindowHarness({ storage })

  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const state = useGraphStore.getState()
    try {
      state.setFrontmatterModeEnabled(false)
    } catch {
      void 0
    }
    const graph = buildGraphWithMediaNode()
    state.setGraphData(graph)
    state.setMarkdownDocument('doc.md', '')
    state.setWorkspaceViewMode('canvas')
    state.selectNode(null)
    state.setSelectionSource(null)
    state.setMarkdownPreviewMermaidFocus(null)
    state.setMarkdownPreviewActiveMediaKey(null)

    await mountReactRoot(root, React.createElement(CommandMenuCatalogPanel), { window: dom.window, frames: 8 })

    const rows = Array.from(doc.querySelectorAll('[data-kg-command-menu-media-source="graph"]')) as HTMLElement[]
    const graphCard = rows.find(row => readCommandMenuMediaRowName(row).includes('Node media:'))
    if (!graphCard) {
      throw new Error('graph media Command Menu row not found')
    }

    await act(async () => {
      graphCard.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForNextFrame(dom.window)
    })

    const after = useGraphStore.getState()

    if (after.selectedNodeId !== 'n1') {
      throw new Error(`expected selectedNodeId to be "n1", got ${String(after.selectedNodeId)}`)
    }
    if (after.selectionSource !== 'toolbar') {
      throw new Error(`expected selectionSource "toolbar", got ${String(after.selectionSource)}`)
    }
    const expectedKey = 'graph-node-media:n1:image:https://example.com/example.png'
    if (after.markdownPreviewActiveMediaKey !== expectedKey) {
      throw new Error(
        `expected markdownPreviewActiveMediaKey "${expectedKey}", got ${String(
          after.markdownPreviewActiveMediaKey,
        )}`,
      )
    }

    const renameButton = graphCard.querySelector('[data-kg-command-menu-media-rename]') as HTMLButtonElement | null
    if (!renameButton) throw new Error('expected graph media row to expose explicit rename control')
    await act(async () => {
      renameButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await waitForNextFrame(dom.window)
    })
    const nameInput = graphCard.querySelector('[data-kg-command-menu-media-name-input]') as HTMLInputElement | null
    if (!nameInput) throw new Error('expected graph media row to expose inline name edit input')
    await act(async () => {
      setInputValue(dom.window, nameInput, 'Renamed graph media')
      nameInput.dispatchEvent(new dom.window.FocusEvent('focusout', { bubbles: true }))
      await waitForNextFrame(dom.window)
    })
    const renamedNode = useGraphStore.getState().graphData?.nodes?.find(node => node.id === 'n1')
    if (renamedNode?.label !== 'Renamed graph media') {
      throw new Error(`expected graph media inline rename to update node label, got ${String(renamedNode?.label || '')}`)
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testCommandMenuMediaLayoutSelectorTogglesGridAndList() {
  const storage = new MemoryStorage()
  const { dom, restore: restoreDom } = initJsdomHarness()
  const { restore: restoreWindow } = initWindowHarness({ storage })

  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const state = useGraphStore.getState()
    state.setGraphData({ type: 'Graph', nodes: [], edges: [] })
    state.setMarkdownDocument('doc.md', buildMarkdown())
    state.setMarkdownPreviewMermaidFocus(null)
    state.setMarkdownPreviewActiveMediaKey(null)

    await mountReactRoot(root, React.createElement(CommandMenuCatalogPanel), { window: dom.window, frames: 8 })

    const panel = doc.querySelector('[data-kg-media-panel="1"]') as HTMLElement | null
    if (!panel) throw new Error('expected FloatingPanel Media root')
    if (panel.getAttribute('data-kg-media-layout') !== 'grid') {
      throw new Error(`expected Media layout to default to grid, got ${String(panel.getAttribute('data-kg-media-layout'))}`)
    }
    if (!doc.querySelector('[data-kg-media-layout-selector="1"]')) throw new Error('expected Media layout selector')
    if (!doc.querySelector('[data-kg-media-grid="1"]')) throw new Error('expected Media grid surface')
    if (!doc.querySelector('article[data-kg-command-menu-media-candidate]')) throw new Error('expected media candidates to render as semantic grid articles')

    const listButton = doc.querySelector('[data-kg-media-layout-toggle="list"]') as HTMLButtonElement | null
    const gridButton = doc.querySelector('[data-kg-media-layout-toggle="grid"]') as HTMLButtonElement | null
    if (!listButton || !gridButton) throw new Error('expected list and grid layout buttons')

    await act(async () => {
      listButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForNextFrame(dom.window)
    })

    if (panel.getAttribute('data-kg-media-layout') !== 'list') {
      throw new Error(`expected Media layout to switch to list, got ${String(panel.getAttribute('data-kg-media-layout'))}`)
    }
    if (doc.querySelector('[data-kg-media-ktv-layout="1"]')) throw new Error('expected list layout to avoid legacy KTV three-column surface')
    if (doc.querySelector('[data-kg-media-list="1"] [role="columnheader"]')) throw new Error('expected media list layout to avoid column headers')
    if (!doc.querySelector('[data-kg-media-list-layout="3-rows"]')) throw new Error('expected Media list layout to expose the 3-row marker')
    const listRows = Array.from(doc.querySelectorAll('[data-kg-media-list-row-layout="3-rows"]')) as HTMLElement[]
    if (listRows.length === 0) throw new Error('expected media candidates to render as semantic 3-row list items')
    const rowSectionCounts = listRows.map(row => row.querySelectorAll('[data-kg-media-list-row-section]').length)
    if (rowSectionCounts.some(count => count !== 3)) {
      throw new Error(`expected every media list item to expose exactly 3 rows, got ${JSON.stringify(rowSectionCounts)}`)
    }

    await act(async () => {
      gridButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForNextFrame(dom.window)
    })

    if (panel.getAttribute('data-kg-media-layout') !== 'grid') {
      throw new Error(`expected Media layout to switch back to grid, got ${String(panel.getAttribute('data-kg-media-layout'))}`)
    }
    if (storage.getItem('kg.media.catalog.layout') !== 'grid') {
      throw new Error(`expected Media layout preference to persist, got ${String(storage.getItem('kg.media.catalog.layout'))}`)
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testPreviewPanelStandaloneLinkWebpageAndTweetSelectable() {
  const storage = new MemoryStorage()
  const { dom, restore: restoreDom } = initJsdomHarness()
  const { restore: restoreWindow } = initWindowHarness({ storage })

  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdown = [
      '# Rich Media',
      '',
      '[Article](https://www.aljazeera.com/news/2026/2/19/visualising-ai-spending-how-does-it-compare-with-historys-mega-projects)',
      '',
      '[Tweet](https://x.com/HuiJooHwee/status/2023774971982672097?s=20)',
      '',
    ].join('\n')

    const state = useGraphStore.getState()
    state.setGraphData({ type: 'Graph', nodes: [], edges: [] })
    state.setMarkdownDocument('doc.md', markdown)
    try {
      state.setFrontmatterModeEnabled(false)
    } catch {
      void 0
    }
    try {
      useGraphStore.setState({ frontmatterModeEnabled: false })
    } catch {
      void 0
    }
    state.setMarkdownPreviewMermaidFocus(null)
    state.setMarkdownPreviewActiveMediaKey(null)

    await mountReactRoot(root, React.createElement(CommandMenuCatalogPanel), { window: dom.window, frames: 8 })

    const rows = Array.from(doc.querySelectorAll('[data-kg-command-menu-media-source="markdown"]')) as HTMLElement[]
    const webpageCard = rows.find(row => readCommandMenuMediaRowName(row).toLowerCase().includes('article'))
    if (!webpageCard) throw new Error('webpage Command Menu row not found')

    const webpageNameInput = webpageCard.querySelector('[data-kg-command-menu-media-name-input]') as HTMLInputElement | null
    if (!webpageNameInput) throw new Error('expected markdown media row to expose inline name edit input')
    await act(async () => {
      setInputValue(dom.window, webpageNameInput, 'Renamed article')
      webpageNameInput.dispatchEvent(new dom.window.FocusEvent('focusout', { bubbles: true }))
      await waitForNextFrame(dom.window)
    })
    const renamedMarkdown = String(useGraphStore.getState().markdownDocumentText || '')
    if (!renamedMarkdown.includes('[Renamed article](https://www.aljazeera.com/news/2026/2/19/visualising-ai-spending-how-does-it-compare-with-historys-mega-projects)')) {
      throw new Error(`expected markdown media inline rename to persist into link text, got ${renamedMarkdown}`)
    }

    await act(async () => {
      webpageCard.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForNextFrame(dom.window)
    })

    await act(async () => {
      root.render(React.createElement(PreviewPanelView))
      await waitForFrames(dom.window, 4)
    })

    const loadButtons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
    const loadEmbed = loadButtons.find(btn => String(btn.textContent || '').toLowerCase().includes('load embed'))
    if (!loadEmbed) {
      const sample = loadButtons
        .map(b => String(b.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 30)
        .join(' | ')
      throw new Error(`load embed button not found. buttons=${sample}`)
    }
    await act(async () => {
      loadEmbed.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForNextFrame(dom.window)
    })

    const mediaPanel = doc.querySelector('[data-kg-rich-media-panel="1"][data-kg-rich-media-render-surface="1"]')
    if (!mediaPanel) throw new Error('expected active media preview to reuse the widget-style RichMediaPanel surface')

    const expectedWebpageKey = buildMarkdownPreviewMediaKey(
      'webpage',
      3,
      'https://www.aljazeera.com/news/2026/2/19/visualising-ai-spending-how-does-it-compare-with-historys-mega-projects',
    )
    const afterWebpage = useGraphStore.getState()
    if (afterWebpage.markdownPreviewActiveMediaKey !== expectedWebpageKey) {
      throw new Error(
        `expected markdownPreviewActiveMediaKey "${expectedWebpageKey}", got ${String(
          afterWebpage.markdownPreviewActiveMediaKey,
        )}`,
      )
    }

    await act(async () => {
      root.render(React.createElement(CommandMenuCatalogPanel))
      await waitForFrames(dom.window, 4)
    })
    const rowsAfter = Array.from(doc.querySelectorAll('[data-kg-command-menu-media-source="markdown"]')) as HTMLElement[]
    const tweetCard = rowsAfter.find(row => readCommandMenuMediaRowName(row).toLowerCase().includes('tweet'))
    if (!tweetCard) throw new Error('tweet Command Menu row not found')

    await act(async () => {
      tweetCard.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForNextFrame(dom.window)
    })

    const expectedTweetKey = buildMarkdownPreviewMediaKey(
      'tweet',
      5,
      'https://x.com/HuiJooHwee/status/2023774971982672097?s=20',
    )
    const afterTweet = useGraphStore.getState()
    if (afterTweet.markdownPreviewActiveMediaKey !== expectedTweetKey) {
      throw new Error(
        `expected markdownPreviewActiveMediaKey "${expectedTweetKey}", got ${String(
          afterTweet.markdownPreviewActiveMediaKey,
        )}`,
      )
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testCommandMenuMarkdownMediaRenameSyncsWorkspaceHrefReferences() {
  const storage = new MemoryStorage()
  const { dom, restore: restoreDom } = initJsdomHarness()
  const { restore: restoreWindow } = initWindowHarness({ storage })

  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    const href = 'https://example.com/seedance.mp4'
    const markdown = [
      '# Media source',
      '',
      `[${href}](${href})`,
      '',
      `[Video reference](${href})`,
      '',
    ].join('\n')
    const workspacePeerText = [
      '# Storyboard card',
      '',
      `[Old storyboard media](${href})`,
      '',
    ].join('\n')

    const state = useGraphStore.getState()
    state.setGraphData({ type: 'Graph', nodes: [], edges: [] })
    state.setSourceFiles([
      {
        id: 'active-media-source',
        name: 'import-url-source.md',
        text: markdown,
        enabled: true,
        status: 'idle',
        source: { kind: 'local', path: 'workspace:/import-url-source.md' },
      },
      {
        id: 'storyboard-media-peer',
        name: 'storyboard-card.md',
        text: workspacePeerText,
        enabled: true,
        status: 'idle',
        source: { kind: 'local', path: 'workspace:/storyboard-card.md' },
      },
    ])
    state.setMarkdownDocument('workspace:/import-url-source.md', markdown)
    state.setMarkdownPreviewMermaidFocus(null)
    state.setMarkdownPreviewActiveMediaKey(null)

    await mountReactRoot(root, React.createElement(CommandMenuCatalogPanel), { window: dom.window, frames: 8 })

    const nameText = Array
      .from(doc.querySelectorAll('[data-kg-command-menu-media-name-text]') as NodeListOf<HTMLElement>)
      .find(label => String(label.textContent || '').trim() === href)
    if (!nameText) throw new Error('expected Command Menu media row to expose the URL-derived media name')
    const mediaRow = nameText.closest('[data-kg-command-menu-media-candidate]')
    const renameButton = mediaRow?.querySelector('[data-kg-command-menu-media-rename]') as HTMLButtonElement | null
    if (!renameButton) throw new Error('expected Command Menu media row to expose explicit rename control')

    await act(async () => {
      renameButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await waitForNextFrame(dom.window)
    })

    const nameInput = mediaRow?.querySelector('[data-kg-command-menu-media-name-input]') as HTMLInputElement | null
    if (!nameInput || nameInput.value !== href) throw new Error('expected explicit rename control to open the URL-derived media name input')

    await act(async () => {
      setInputValue(dom.window, nameInput, 'Seedance source media')
      await waitForNextFrame(dom.window)
    })
    const syncedDraftInput = mediaRow?.querySelector('[data-kg-command-menu-media-name-input]') as HTMLInputElement | null
    if (syncedDraftInput?.value !== 'Seedance source media') {
      throw new Error(`expected same-href media row to keep one live draft input, got ${JSON.stringify(syncedDraftInput?.value || '')}`)
    }

    await act(async () => {
      nameInput.dispatchEvent(new dom.window.FocusEvent('focusout', { bubbles: true }))
      await waitForNextFrame(dom.window)
    })

    const after = useGraphStore.getState()
    const activeText = String(after.markdownDocumentText || '')
    if (!activeText.includes(`[Seedance source media](${href})`)) {
      throw new Error(`expected active markdown link label to be renamed, got ${activeText}`)
    }
    if (!activeText.includes(`[Seedance source media](${href})\n\n[Seedance source media](${href})`)) {
      throw new Error(`expected active markdown same-href link labels to sync to renamed media name, got ${activeText}`)
    }
    const sourceFiles = after.sourceFiles || []
    const activeSource = sourceFiles.find(file => file.id === 'active-media-source')
    const peerSource = sourceFiles.find(file => file.id === 'storyboard-media-peer')
    if (!String(activeSource?.text || '').includes(`[Seedance source media](${href})\n\n[Seedance source media](${href})`)) {
      throw new Error(`expected active Source Files entry to sync media rename, got ${String(activeSource?.text || '')}`)
    }
    if (!String(peerSource?.text || '').includes(`[Seedance source media](${href})`)) {
      throw new Error(`expected peer Source Files entry to sync same-href media rename, got ${String(peerSource?.text || '')}`)
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    useGraphStore.getState().setSourceFiles([])
    restoreDom()
    restoreWindow()
  }
}

export async function testCommandMenuMediaInventoryDeduplicatesMarkdownAndGraphSameUrl() {
  const storage = new MemoryStorage()
  const { dom, restore: restoreDom } = initJsdomHarness()
  const { restore: restoreWindow } = initWindowHarness({ storage })

  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    const href = 'https://example.com/example.png'
    const markdown = [
      '# Media source',
      '',
      `![Seedance source](${href})`,
      '',
    ].join('\n')

    const state = useGraphStore.getState()
    state.setGraphData(buildGraphWithMediaNode())
    state.setSourceFiles([])
    state.setMarkdownDocument('workspace:/import-url-source.md', markdown)
    state.setMarkdownPreviewMermaidFocus(null)
    state.setMarkdownPreviewActiveMediaKey(null)

    await mountReactRoot(root, React.createElement(CommandMenuCatalogPanel), { window: dom.window, frames: 8 })

    const mediaRows = Array.from(doc.querySelectorAll('[data-kg-command-menu-media-candidate]')) as HTMLElement[]
    if (mediaRows.length !== 1) {
      const rowText = mediaRows.map(row => String(row.textContent || '').replace(/\s+/g, ' ').trim())
      throw new Error(`expected graph and markdown same-URL media to collapse to one row, got ${mediaRows.length}; rows=${JSON.stringify(rowText)}`)
    }
    const deduped = dedupeCommandMenuRichMediaItems([
      {
        key: 'markdown:image',
        kind: 'image',
        source: 'markdown',
        startLine: 3,
        label: 'Seedance source',
        src: href,
        openUrl: href,
      },
      {
        key: 'graph:image',
        kind: 'image',
        source: 'graph',
        startLine: 0,
        label: 'Node media: Example media node',
        src: href,
        openUrl: href,
        nodeId: 'n1',
      },
    ] satisfies CommandMenuRichMediaItem[])
    if (deduped.length !== 1 || deduped[0]?.source !== 'graph') {
      throw new Error(`expected shared media inventory dedupe to keep graph owner, got ${JSON.stringify(deduped.map(item => item.source))}`)
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testPreviewPanelGraphMediaDeduplicatesBytePlusVideoWidgetToCanonicalRichMediaPanel() {
  const storage = new MemoryStorage()
  const { dom, restore: restoreDom } = initJsdomHarness()
  const { restore: restoreWindow } = initWindowHarness({ storage })

  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const state = useGraphStore.getState()
    state.setGraphData(buildGraphWithConflictingSeedanceAndRichMediaPanelNodes())
    state.setMarkdownDocument('doc.md', '')
    state.setMarkdownPreviewMermaidFocus(null)
    state.setMarkdownPreviewActiveMediaKey(null)

    await mountReactRoot(root, React.createElement(CommandMenuCatalogPanel), { window: dom.window, frames: 8 })

    const graphCards = (Array.from(doc.querySelectorAll('[data-kg-command-menu-media-source="graph"]')) as HTMLElement[]).filter(row =>
      readCommandMenuMediaRowName(row).includes('Node media:'),
    )
    if (graphCards.length !== 1) {
      throw new Error(`expected one canonical graph media Command Menu row after dedupe, got ${graphCards.length}`)
    }
    const graphCardText = String(graphCards[0]?.textContent || '')
    if (!graphCardText.includes('Rich Media Panel')) {
      throw new Error(`expected canonical graph media row to keep Rich Media Panel version, got ${graphCardText || '<empty>'}`)
    }
    if (graphCardText.includes('Rich Media Panel for ')) {
      throw new Error(`expected graph media row title to stay on the single Rich Media Panel SSOT, got ${graphCardText}`)
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testPreviewPanelGraphRichMediaPanelTextPreviewUsesCanonicalPanelSurface() {
  const storage = new MemoryStorage()
  const { dom, restore: restoreDom } = initJsdomHarness()
  const { restore: restoreWindow } = initWindowHarness({ storage })

  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const state = useGraphStore.getState()
    const expectedKey = 'graph-node-media:rich-media-text-panel:iframe:srcdoc'
    state.setGraphData(buildGraphWithRichMediaPanelTextPreview())
    state.setMarkdownDocument('doc.md', '')
    try {
      state.setFrontmatterModeEnabled(false)
    } catch {
      void 0
    }
    try {
      useGraphStore.setState({ frontmatterModeEnabled: false })
    } catch {
      void 0
    }
    state.setMarkdownPreviewMermaidFocus(null)
    state.setMarkdownPreviewActiveMediaKey(expectedKey)

    await mountReactRoot(root, React.createElement(PreviewPanelView), { window: dom.window, frames: 8 })

    const after = useGraphStore.getState()
    if (after.markdownPreviewActiveMediaKey !== expectedKey) {
      throw new Error(`expected markdownPreviewActiveMediaKey "${expectedKey}", got ${String(after.markdownPreviewActiveMediaKey)}`)
    }
    const mediaPanel = doc.querySelector('[data-kg-rich-media-markdown-preview="1"]')
    if (!mediaPanel) throw new Error('expected PreviewPanelView to mount the canonical RichMediaPanel markdown preview surface for graph text previews')
    const markdownPreview = doc.querySelector('[data-kg-rich-media-markdown-preview="1"]')
    if (!markdownPreview) throw new Error('expected graph-backed RichMediaPanel text preview to render through the shared markdown preview surface')
    const loadEmbedButton = (Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]).find(btn =>
      String(btn.textContent || '').toLowerCase().includes('load embed'),
    )
    if (loadEmbedButton) {
      throw new Error('expected graph-backed RichMediaPanel text preview to avoid the legacy explicit iframe load gate')
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
    restoreWindow()
  }
}
