import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import PreviewPanelView from '@/features/panels/views/PreviewPanelView'
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

export async function testPreviewPanelGraphMediaSelectionOpensMarkdownPanel() {
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

    await mountReactRoot(root, React.createElement(PreviewPanelView), { window: dom.window, frames: 8 })

    const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
    const graphCard = buttons.find(btn => {
      const text = btn.textContent || ''
      return text.includes('Node media:')
    })
    if (!graphCard) {
      throw new Error('graph media gallery card not found')
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

    await mountReactRoot(root, React.createElement(PreviewPanelView), { window: dom.window, frames: 8 })

    const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
    const webpageCard = buttons.find(btn => String(btn.textContent || '').toLowerCase().includes('webpage'))
    if (!webpageCard) throw new Error('webpage gallery card not found')

    await act(async () => {
      webpageCard.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForNextFrame(dom.window)
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

    const buttonsAfter = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
    const tweetCard = buttonsAfter.find(btn => String(btn.textContent || '').toLowerCase().includes('tweet'))
    if (!tweetCard) throw new Error('tweet gallery card not found')

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

    await mountReactRoot(root, React.createElement(PreviewPanelView), { window: dom.window, frames: 8 })

    const graphCards = (Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]).filter(btn =>
      String(btn.textContent || '').includes('Node media:'),
    )
    if (graphCards.length !== 1) {
      throw new Error(`expected one canonical graph media card after dedupe, got ${graphCards.length}`)
    }
    const graphCardText = String(graphCards[0]?.textContent || '')
    if (!graphCardText.includes('Rich Media Panel')) {
      throw new Error(`expected canonical graph media card to keep Rich Media Panel version, got ${graphCardText || '<empty>'}`)
    }
    if (graphCardText.includes('Rich Media Panel for ')) {
      throw new Error(`expected graph media card title to stay on the single Rich Media Panel SSOT, got ${graphCardText}`)
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

    const graphCards = (Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]).filter(btn =>
      String(btn.textContent || '').includes('Node media:'),
    )
    if (graphCards.length !== 1) {
      throw new Error(`expected one graph-backed rich media card, got ${graphCards.length}`)
    }
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
