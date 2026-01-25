import MarkdownIt from 'markdown-it'
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

export const buildTestMarkdownFromFile = (): string => {
  const path = resolve(process.cwd(), '../data/_tmp_md_smoke/markdown-html-img-smoke.md')
  return readFileSync(path, 'utf8')
}

export const buildTestMarkdownFromGithub = (): string =>
  [
    '# Sample Summaries',
    '',
    'These are sample summaries from a generic document.',
    '',
    '![Sample Cover](https://example.com/assets/sample-cover.png)',
    '',
  ].join('\n')

export const buildTestMarkdownFromAieHtml = (): string =>
  [
    '# Sample Summaries (HTML)',
    '',
    '<center><img src="assets/sample.png" width="800"><br>',
    '<i>Sample diagram from a neutral reference</i></center>',
    '',
  ].join('\n')

export const buildTestMarkdownFromMlflow = (): string =>
  [
    '# Sample Tooling',
    '',
    '![Sample logo](docs/source/_static/sample-logo.png)',
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
  const md = new MarkdownIt({
    html: true,
    linkify: false,
    typographer: false,
    breaks: false,
  })
  let html = md.render(String(markdown || ''))

  html = html.replace(/<abbr\b[^>]*>([\s\S]*?)<\/abbr>/gi, '$1')
  html = html.replace(/<span\b([^>]*\bclass=["'][^"']+["'][^>]*)>/gi, '<span data-kg-inline="1"$1>')
  if (!html || !html.trim()) {
    throw new Error(`Markdown render did not produce any HTML for ${String(activeDocumentPath || '')}`)
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
