import React from 'react'
import { createRoot } from 'react-dom/client'
import { builtInParsers, registerParser, resetParsers, toParserId, applyParser } from '@/features/parsers'
import { buildMarkdownJsonLd } from '@/features/parsers/default'
import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { splitSlides } from '@/features/markdown/ui/markdownPreviewSlides'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { readMarkdownSlideDemo } from '@/tests/lib/markdownSlideDemo'

async function readGuidelinesMarkdownFromDisk(): Promise<string | null> {
  return readMarkdownSlideDemo()
}

export async function testGuidelinesMarkdownIngestionLexingAndSlides() {
  const markdown = await readGuidelinesMarkdownFromDisk()
  if (!markdown || !markdown.trim()) {
    await Promise.resolve()
    return
  }

  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const jsonld = buildMarkdownJsonLd(
    'file://markdown-slide-styling-guidelines.md',
    markdown,
  )

  const res = applyParser(toParserId('jsonld'), {
    name: 'markdown-slide-styling-guidelines.jsonld',
    text: JSON.stringify(jsonld),
  })

  if (!res) throw new Error('guidelines jsonld parse returned null')
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`guidelines jsonld parse warnings: ${res.warnings.join('; ')}`)
  }

  const nodes = res.graphData.nodes || []
  const edges = res.graphData.edges || []
  if (nodes.length === 0) {
    throw new Error('guidelines markdown produced no nodes')
  }
  if (edges.length === 0) {
    throw new Error('guidelines markdown produced no edges')
  }

  const { tokens, meta } = lexMarkdown(markdown)
  if (!tokens || tokens.length === 0) {
    throw new Error('guidelines markdown lexing produced no tokens')
  }
  const headMeta = meta as Record<string, unknown>
  const aspectRatio = String(headMeta.aspectRatio || '').trim()
  if (aspectRatio && aspectRatio !== '16/9' && aspectRatio !== '4/3' && aspectRatio !== '16/10') {
    throw new Error(`guidelines frontmatter aspectRatio has unexpected value: ${aspectRatio}`)
  }

  const { slides } = splitSlides(markdown)
  if (!slides.length) {
    throw new Error('guidelines markdown produced no slides')
  }

  await Promise.resolve()
}

export async function testGuidelinesMarkdownHighlightGuardWithLargeGraph() {
  const markdown = await readGuidelinesMarkdownFromDisk()
  if (!markdown || !markdown.trim()) {
    await Promise.resolve()
    return
  }

  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const { tokens } = lexMarkdown(markdown)
    const tokenCount = tokens.length
    if (!tokenCount) {
      throw new Error('guidelines markdown lexing produced no tokens for highlight guard test')
    }
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
    }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }
    const anyGlobal = globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyGlobal.requestAnimationFrame) {
      anyGlobal.requestAnimationFrame = anyWindow.requestAnimationFrame
    }

    const doc = dom.window.document

    const entityCount = 1000
    const product = tokenCount * entityCount
    if (!(product > 0)) throw new Error(`guidelines highlight guard expected positive product; got ${product}`)

    const nodes: GraphData['nodes'] = []
    for (let i = 0; i < entityCount; i += 1) {
      nodes.push({
        id: `n${i}`,
        type: 'Paragraph',
        label: `Node ${i}`,
        properties: {},
        metadata: {
          documentPath: 'markdown-slide-styling-guidelines.md',
          lineStart: 10 + (i % 200),
          lineEnd: 10 + (i % 200),
        },
      } as never)
    }
    const graphData: GraphData = {
      type: 'Graph',
      nodes,
      edges: [],
      metadata: {},
    }

    const state = useGraphStore.getState()
    state.setGraphData(graphData as never)

    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText: markdown,
        activeDocumentPath: 'markdown-slide-styling-guidelines.md',
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

    const tick = () =>
      new Promise<void>(resolve =>
        anyWindow.requestAnimationFrame ? anyWindow.requestAnimationFrame(() => resolve()) : setTimeout(() => resolve(), 0),
      )
    await tick()

    const rootEl = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null
    if (!rootEl) {
      throw new Error('guidelines markdown preview root not found')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testGuidelinesMarkdownHighlightGuardWithSmallGraph() {
  const markdown = await readGuidelinesMarkdownFromDisk()
  if (!markdown || !markdown.trim()) {
    await Promise.resolve()
    return
  }

  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const { tokens } = lexMarkdown(markdown)
    const tokenCount = tokens.length
    if (!tokenCount) {
      throw new Error('guidelines markdown lexing produced no tokens for small graph test')
    }

    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
    }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }
    const anyGlobal = globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyGlobal.requestAnimationFrame) {
      anyGlobal.requestAnimationFrame = anyWindow.requestAnimationFrame
    }

    const doc = dom.window.document

    const entityCount = 10
    const product = tokenCount * entityCount
    if (!(product > 0)) throw new Error(`guidelines small graph expected positive product; got ${product}`)

    const nodes: GraphData['nodes'] = []
    for (let i = 0; i < entityCount; i += 1) {
      nodes.push({
        id: `s${i}`,
        type: 'Paragraph',
        label: `Small Node ${i}`,
        properties: {},
        metadata: {
          documentPath: 'markdown-slide-styling-guidelines.md',
          lineStart: 10 + (i % 50),
          lineEnd: 10 + (i % 50),
        },
      } as never)
    }
    const graphData: GraphData = {
      type: 'Graph',
      nodes,
      edges: [],
      metadata: {},
    }

    const state = useGraphStore.getState()
    state.setGraphData(graphData as never)

    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText: markdown,
        activeDocumentPath: 'markdown-slide-styling-guidelines.md',
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

    const tick = () =>
      new Promise<void>(resolve =>
        anyWindow.requestAnimationFrame ? anyWindow.requestAnimationFrame(() => resolve()) : setTimeout(() => resolve(), 0),
      )
    await tick()

    const rootEl = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null
    if (!rootEl) {
      throw new Error('guidelines markdown preview root not found for small graph')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
