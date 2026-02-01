import React from 'react'
import { createRoot } from 'react-dom/client'
import { useGraphStore } from '@/hooks/useGraphStore'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { buildMarkdownTokensKey, lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import type { GraphData } from '@/lib/graph/types'

const findButtonByExactText = (rootEl: HTMLElement, label: string): HTMLButtonElement | null => {
  const buttons = Array.from(rootEl.querySelectorAll('button'))
  for (const btn of buttons) {
    const text = (btn.textContent || '').trim()
    if (text === label) return btn as HTMLButtonElement
  }
  return null
}

export async function testMarkdownPreviewShowOnCanvasSelectsExpectedNode() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
      getSelection?: () => Selection | null
    }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    const doc = dom.window.document

    const graphData: GraphData = {
      type: 'Graph',
      nodes: [
        {
          id: 'n1',
          type: 'Paragraph',
          label: 'First',
          properties: {},
          metadata: {
            documentPath: 'docs/example.md',
            lineStart: 5,
            lineEnd: 7,
          },
        },
        {
          id: 'n2',
          type: 'Paragraph',
          label: 'Second',
          properties: {},
          metadata: {
            documentPath: 'docs/example.md',
            lineStart: 20,
            lineEnd: 22,
          },
        },
      ],
      edges: [],
      metadata: {},
    }

    const state = useGraphStore.getState()
    state.setGraphData(graphData as never)
    state.selectNode(null)
    state.selectEdge(null)

    const markdownLines = [
      '# Title',
      '',
      'intro',
      '',
      'first para line 1',
      'first para line 2',
      'first para line 3',
      '',
      'other content',
      '',
      'second para line 1',
      'second para line 2',
      'second para line 3',
    ]
    const markdownText = markdownLines.join('\n')

    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: 'docs/example.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        previewOverlayScope: 'viewport',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
      } as never),
    )

    const tick = (label: string) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out`)), 750) as unknown as number
        const raf = anyWindow.requestAnimationFrame
        if (typeof raf === 'function') {
          raf(() => {
            clearTimeout(timer)
            resolve()
          })
          return
        }
        setTimeout(() => {
          clearTimeout(timer)
          resolve()
        }, 0)
      })
    await tick('mount')

    const rootEl = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null
    if (!rootEl) {
      throw new Error('markdown preview root not found')
    }

    const targetBlock = rootEl.querySelector('[data-start-line="5"]') as HTMLElement | null
    if (!targetBlock) {
      throw new Error('block with data-start-line=5 not found')
    }

    anyWindow.getSelection = () =>
      ({
        isCollapsed: false,
      } as unknown as Selection)

    const contextMenuEvent = new dom.window.MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 10,
    })
    targetBlock.dispatchEvent(contextMenuEvent)
    await tick('contextmenu')

    const menuButton = findButtonByExactText(rootEl, 'Show on Canvas')
    if (!menuButton) {
      throw new Error('Show on Canvas menu button not found')
    }

    menuButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick('show-on-canvas')

    const selectedNodeId = useGraphStore.getState().selectedNodeId
    const selectedEdgeId = useGraphStore.getState().selectedEdgeId
    if (selectedNodeId !== 'n1') {
      throw new Error(
        `expected selectedNodeId to be "n1" after Show on Canvas, got ${String(selectedNodeId)} (edge=${String(selectedEdgeId)})`,
      )
    }

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

export async function testMarkdownPreviewContextMenuRendersInsideRoot() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
      getSelection?: () => Selection | null
    }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    const doc = dom.window.document

    const markdownLines = [
      '# Title',
      '',
      'intro',
      '',
      'first para line 1',
      'first para line 2',
      'first para line 3',
    ]
    const markdownText = markdownLines.join('\n')

    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: 'docs/example.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        previewOverlayScope: 'viewport',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
      } as never),
    )

    const tick = (label: string) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out`)), 750) as unknown as number
        const raf = anyWindow.requestAnimationFrame
        if (typeof raf === 'function') {
          raf(() => {
            clearTimeout(timer)
            resolve()
          })
          return
        }
        setTimeout(() => {
          clearTimeout(timer)
          resolve()
        }, 0)
      })
    await tick('mount')

    const rootEl = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null
    if (!rootEl) {
      throw new Error('markdown preview root not found')
    }

    const targetBlock = rootEl.querySelector('[data-start-line="5"]') as HTMLElement | null
    if (!targetBlock) {
      throw new Error('block with data-start-line=5 not found')
    }

    anyWindow.getSelection = () =>
      ({
        isCollapsed: false,
      } as unknown as Selection)

    const contextMenuEvent = new dom.window.MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 10,
    })
    targetBlock.dispatchEvent(contextMenuEvent)
    await tick('contextmenu')

    const menuButton = findButtonByExactText(rootEl, 'Show on Canvas')
    if (!menuButton) {
      throw new Error('context menu button not found inside markdown preview root')
    }

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

export async function testMarkdownPreviewTokenCacheDoesNotCrossDocumentPath() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
    }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    const doc = dom.window.document
    const markdownA = ['# A', '', 'alpha'].join('\n')
    const markdownB = ['# B', '', 'beta'].join('\n')

    const { tokens: tokensA, meta: metaA, startLineOffset: startLineOffsetA } = lexMarkdown(markdownA)
    if (!tokensA || tokensA.length === 0) throw new Error('expected tokens for markdownA')

    const keyB = buildMarkdownTokensKey(markdownB)
    useGraphStore.getState().setMarkdownTokens({
      tokens: tokensA,
      path: 'docA.md',
      key: keyB,
      meta: metaA,
      startLineOffset: startLineOffsetA,
    })

    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText: markdownB,
        activeDocumentPath: 'docB.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        previewOverlayScope: 'viewport',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
      } as never),
    )

    const tick = (label: string) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out`)), 750) as unknown as number
        const raf = anyWindow.requestAnimationFrame
        if (typeof raf === 'function') {
          raf(() => {
            clearTimeout(timer)
            resolve()
          })
          return
        }
        setTimeout(() => {
          clearTimeout(timer)
          resolve()
        }, 0)
      })
    await tick('mount')

    const rootEl = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null
    if (!rootEl) throw new Error('markdown preview root not found')

    const text = String(rootEl.textContent || '')
    if (!text.includes('B')) {
      throw new Error(`expected markdownB content to render, got: ${text.slice(0, 80)}`)
    }
    if (text.includes('A')) {
      throw new Error(`expected markdownA token cache not to be used, got: ${text.slice(0, 80)}`)
    }
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

export async function testMarkdownPreviewViewModeSwitchDoesNotCrossDocumentPath() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
    }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    const tick = (label: string) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out`)), 750) as unknown as number
        const raf = anyWindow.requestAnimationFrame
        if (typeof raf === 'function') {
          raf(() => {
            clearTimeout(timer)
            resolve()
          })
          return
        }
        setTimeout(() => {
          clearTimeout(timer)
          resolve()
        }, 0)
      })

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText: ['# A', '', 'alpha'].join('\n'),
        activeDocumentPath: 'docA.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        previewOverlayScope: 'viewport',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
        viewMode: 'viewer',
      } as never),
    )
    await tick('mount-A')

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText: ['# B', '', 'beta'].join('\n'),
        activeDocumentPath: 'docB.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: true,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        previewOverlayScope: 'viewport',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
        viewMode: 'presentation',
      } as never),
    )
    await tick('mount-B')

    const rootEl =
      (doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null) ||
      (doc.querySelector('[data-testid="markdown-preview"]') as HTMLDivElement | null) ||
      (container as unknown as HTMLDivElement)
    const text = String(rootEl.textContent || '')
    if (!text.includes('B')) {
      throw new Error(`expected B content after view switch, got: ${text.slice(0, 80)}`)
    }
    if (text.includes('A')) {
      throw new Error(`expected A content not to persist after view switch, got: ${text.slice(0, 80)}`)
    }
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
