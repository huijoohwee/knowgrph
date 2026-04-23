import React from 'react'
import { createRoot } from 'react-dom/client'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import PreviewPanelView from '@/features/panels/views/PreviewPanelView'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { buildMarkdownPreviewMediaKey } from '@/features/markdown/ui/markdownPreviewLinks'

const buildGraphWithMediaNode = (): GraphData => ({
  type: 'Graph',
  nodes: [
    {
      id: 'n1',
      type: 'Image',
      label: 'Example media node',
      properties: {
        media_kind: 'image',
        image: 'https://example.com/example.png',
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
      id: 'seedance-widget',
      type: 'VideoGeneration',
      label: 'Seedance 2.0 Video Widget',
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

const buildMarkdown = (): string =>
  [
    '# Title',
    '',
    'Paragraph before image.',
    '',
    '![Inline image](https://example.com/example.png)',
    '',
  ].join('\n')

const waitForNextFrame = (win: Window): Promise<void> => {
  const anyWindow = win as unknown as { requestAnimationFrame?: (cb: () => void) => number }
  if (!anyWindow.requestAnimationFrame) {
    anyWindow.requestAnimationFrame = (cb: () => void) =>
      setTimeout(cb, 0) as unknown as number
  }
  return new Promise<void>(resolve => anyWindow.requestAnimationFrame!(() => resolve()))
}

export async function testPreviewPanelGraphMediaSelectionOpensMarkdownPanel() {
  const storage = new MemoryStorage()
  const { dom, restore: restoreDom } = initJsdomHarness()
  const { restore: restoreWindow } = initWindowHarness({ storage })

  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const state = useGraphStore.getState()
    try {
      state.setCanvasRenderMode('2d')
      state.setCanvas2dRenderer('d3')
      state.setDocumentSemanticMode('document')
    } catch {
      void 0
    }
    try {
      state.setFrontmatterModeEnabled(false)
    } catch {
      void 0
    }
    const graph = buildGraphWithMediaNode()
    state.setGraphData(graph)
    state.setMarkdownDocument('doc.md', buildMarkdown())
    state.setWorkspaceViewMode('canvas')
    state.selectNode(null)
    state.setSelectionSource(null)
    state.setMarkdownPreviewMermaidFocus(null)
    state.setMarkdownPreviewActiveMediaKey(null)

    root.render(React.createElement(PreviewPanelView))
    for (let i = 0; i < 8; i += 1) await waitForNextFrame(dom.window)

    const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
    const graphCard = buttons.find(btn => {
      const text = btn.textContent || ''
      return text.includes('Node media:')
    })
    if (!graphCard) {
      throw new Error('graph media gallery card not found')
    }

    graphCard.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await waitForNextFrame(dom.window)

    const after = useGraphStore.getState()

    if (after.selectedNodeId !== 'n1') {
      throw new Error(`expected selectedNodeId to be "n1", got ${String(after.selectedNodeId)}`)
    }
    if (after.selectionSource !== 'toolbar') {
      throw new Error(`expected selectionSource "toolbar", got ${String(after.selectionSource)}`)
    }
    if (after.workspaceViewMode !== 'editor') {
      throw new Error(`expected workspaceViewMode "editor", got ${String(after.workspaceViewMode)}`)
    }
    const expectedKey = 'graph-node-media:n1:image:https://example.com/example.png'
    if (after.markdownPreviewActiveMediaKey !== expectedKey) {
      throw new Error(
        `expected markdownPreviewActiveMediaKey "${expectedKey}", got ${String(
          after.markdownPreviewActiveMediaKey,
        )}`,
      )
    }

    root.unmount()
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
    const container = doc.createElement('div')
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

    root.render(React.createElement(PreviewPanelView))
    for (let i = 0; i < 8; i += 1) await waitForNextFrame(dom.window)

    const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
    const webpageCard = buttons.find(btn => String(btn.textContent || '').toLowerCase().includes('webpage'))
    if (!webpageCard) throw new Error('webpage gallery card not found')

    webpageCard.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await waitForNextFrame(dom.window)

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
    loadEmbed.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await waitForNextFrame(dom.window)

    const mediaHeader = doc.querySelector('[data-kg-media-panel-header="1"]')
    if (!mediaHeader) throw new Error('expected RichMediaPanel header in active media preview')

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

    const buttonsAfter = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
    const tweetCard = buttonsAfter.find(btn => String(btn.textContent || '').toLowerCase().includes('tweet'))
    if (!tweetCard) throw new Error('tweet gallery card not found')

    tweetCard.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await waitForNextFrame(dom.window)

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

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testPreviewPanelGraphMediaDeduplicatesSeedanceWidgetToCanonicalRichMediaPanel() {
  const storage = new MemoryStorage()
  const { dom, restore: restoreDom } = initJsdomHarness()
  const { restore: restoreWindow } = initWindowHarness({ storage })

  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const state = useGraphStore.getState()
    state.setGraphData(buildGraphWithConflictingSeedanceAndRichMediaPanelNodes())
    state.setMarkdownDocument('doc.md', '')
    state.setMarkdownPreviewMermaidFocus(null)
    state.setMarkdownPreviewActiveMediaKey(null)

    root.render(React.createElement(PreviewPanelView))
    for (let i = 0; i < 8; i += 1) await waitForNextFrame(dom.window)

    const graphCards = Array.from(doc.querySelectorAll('button')).filter(btn =>
      String(btn.textContent || '').includes('Node media:'),
    )
    if (graphCards.length !== 1) {
      throw new Error(`expected one canonical graph media card after dedupe, got ${graphCards.length}`)
    }
    const graphCardText = String(graphCards[0]?.textContent || '')
    if (!graphCardText.includes('Rich Media Panel')) {
      throw new Error(`expected canonical graph media card to keep Rich Media Panel version, got ${graphCardText || '<empty>'}`)
    }
    if (graphCardText.includes('Seedance 2.0 Video Widget') && !graphCardText.includes('Rich Media Panel for Seedance 2.0 Video Widget')) {
      throw new Error(`expected stale Seedance widget-only card to be removed, got ${graphCardText}`)
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
