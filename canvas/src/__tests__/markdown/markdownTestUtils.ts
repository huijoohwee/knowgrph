import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  builtInParsers,
  registerParser,
  resetParsers,
  applyParser,
  toParserId,
} from '@/features/parsers'
import { useGraphStore } from '@/hooks/useGraphStore'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'

export const buildTestMarkdownFromFile = (): string => {
  const path = resolve(process.cwd(), '../data/_tmp_md_smoke/markdown-html-img-smoke.md')
  return readFileSync(path, 'utf8')
}

export const buildTestMarkdownFromGithub = (): string =>
  [
    '# Chapter Summaries',
    '',
    'These are the summaries of each chapter taken from the book.',
    '',
    '![AI Engineering Book Cover](https://github.com/chiphuyen/aie-book/raw/main/assets/ai-judge.png)',
    '',
  ].join('\n')

export const buildTestMarkdownFromAieHtml = (): string =>
  [
    '# Chapter Summaries (HTML)',
    '',
    '<center><img src="assets/rlhf.png" width="800"><br>',
    '<i>RLHF diagram from AI Engineering book</i></center>',
    '',
  ].join('\n')

export const buildTestMarkdownFromMlflow = (): string =>
  [
    '# MLflow',
    '',
    '![MLflow logo](docs/source/_static/MLflow-logo-final-white.png)',
    '',
  ].join('\n')

export type MediaNodeLike = {
  properties?: {
    properties?: Record<string, unknown>
  } & Record<string, unknown>
}

export const collectMediaNodeUrls = (nodes: MediaNodeLike[]): string[] => {
  const urls: string[] = []
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    const props = (node.properties || {}) as Record<string, unknown>
    const inner = (props.properties || {}) as Record<string, unknown>
    const candidates = [
      props.media_url,
      props.url,
      props.image,
      props.video,
      props.iframe_url,
      inner.media_url,
      inner.url,
      inner.image,
      inner.video,
      inner.iframe_url,
    ]
    for (const raw of candidates) {
      const url = String(raw ?? '').trim()
      if (!url) continue
      urls.push(url)
    }
  }
  return urls
}

export const assertArrayNonEmpty = (arr: unknown[], label: string): void => {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error(`${label} should be non-empty`)
  }
}

export const findElementWithText = (root: HTMLElement, text: string): HTMLElement | null => {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  while (walker.nextNode()) {
    const el = walker.currentNode as HTMLElement
    if (el.textContent && el.textContent.trim() === text) return el
  }
  return null
}

export const runMarkdownToGraphWithToggle = (name: string, markdown: string, enabled: boolean) => {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const state = useGraphStore.getState()
  state.setRenderMediaAsNodes(enabled)

  const res = applyParser(toParserId('markdown'), {
    name,
    text: markdown,
  })

  if (!res) throw new Error('markdown parse returned null')
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`markdown parse warnings: ${res.warnings.join('; ')}`)
  }

  const graphData = res.graphData
  if (!graphData || typeof graphData !== 'object') {
    throw new Error('graphData missing from parser result')
  }

  state.setGraphData(graphData as never)

  const nodes = (graphData as { nodes?: unknown[] }).nodes || []
  assertArrayNonEmpty(nodes, 'graph nodes')

  return { graphData, nodes }
}

export const renderMarkdownPreview = (markdown: string, activeDocumentPath: string): string => {
  const element = React.createElement(MarkdownPreview, {
    markdownText: markdown,
    activeDocumentPath,
    highlightedLineRange: null,
    markdownWordWrap: true,
    markdownPresentationMode: false,
    markdownTextHighlight: false,
    uiPanelTextFontClass: 'font-sans text-xs',
    uiPanelMonospaceTextClass: 'font-mono text-xs',
    previewOverlayScope: 'viewport',
    previewOverlayPortalTarget: null,
  } as never)
  const html = renderToStaticMarkup(element)
  if (!html || !html.trim()) {
    throw new Error('MarkdownPreview did not render any HTML')
  }
  return html
}

export const extractImgSrcsFromHtml = (html: string): string[] => {
  const srcs: string[] = []
  const re = /<img\b[^>]*\s+src=["']?([^"' >]+)["']?[^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const src = String(match[1] || '').trim()
    if (src) srcs.push(src)
  }
  return srcs
}
