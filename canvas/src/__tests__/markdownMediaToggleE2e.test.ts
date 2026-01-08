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
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const buildTestMarkdownFromFile = (): string => {
  const path = resolve(process.cwd(), '../data/_tmp_md_smoke/markdown-html-img-smoke.md')
  return readFileSync(path, 'utf8')
}

const buildTestMarkdownFromGithub = (): string =>
  [
    '# Chapter Summaries',
    '',
    'These are the summaries of each chapter taken from the book.',
    '',
    '![AI Engineering Book Cover](https://github.com/chiphuyen/aie-book/raw/main/assets/ai-judge.png)',
    '',
  ].join('\n')

const buildTestMarkdownFromAieHtml = (): string =>
  [
    '# Chapter Summaries (HTML)',
    '',
    '<center><img src="assets/rlhf.png" width="800"><br>',
    '<i>RLHF diagram from AI Engineering book</i></center>',
    '',
  ].join('\n')

const buildTestMarkdownFromMlflow = (): string =>
  [
    '# MLflow',
    '',
    '![MLflow logo](docs/source/_static/MLflow-logo-final-white.png)',
    '',
  ].join('\n')

type MediaNodeLike = {
  properties?: {
    properties?: Record<string, unknown>
  } & Record<string, unknown>
}

const collectMediaNodeUrls = (nodes: MediaNodeLike[]): string[] => {
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

const assertArrayNonEmpty = (arr: unknown[], label: string): void => {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error(`${label} should be non-empty`)
  }
}

const runMarkdownToGraphWithToggle = (name: string, markdown: string, enabled: boolean) => {
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

const renderMarkdownPreview = (markdown: string, activeDocumentPath: string): string => {
  const element = React.createElement(MarkdownPreview, {
    markdownText: markdown,
    activeDocumentPath,
    highlightedLineRange: null,
    markdownWordWrap: true,
    markdownPresentationMode: false,
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

const extractImgSrcsFromHtml = (html: string): string[] => {
  const srcs: string[] = []
  const re = /<img\b[^>]*\s+src=["']?([^"' >]+)["']?[^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const src = String(match[1] || '').trim()
    if (src) srcs.push(src)
  }
  return srcs
}

export async function testMarkdownMediaToggleEndToEnd() {
  const { restore: restoreWindow } = initWindowHarness({ navigatorOnline: true })
  const { restore: restoreDom } = initJsdomHarness()
  try {
    const markdownLocal = buildTestMarkdownFromFile()
    const markdownGithub = buildTestMarkdownFromGithub()
    const markdownAieHtml = buildTestMarkdownFromAieHtml()
    const markdownMlflow = buildTestMarkdownFromMlflow()

    const githubSourceUrl = 'https://github.com/chiphuyen/aie-book/blob/main/chapter-summaries.md'
    const mlflowSourceUrl = 'https://github.com/mlflow/mlflow/blob/master/README.md'

    const enabledLocal = runMarkdownToGraphWithToggle('file://markdown-html-img-smoke.md', markdownLocal, true)
    const enabledGithub = runMarkdownToGraphWithToggle(
      githubSourceUrl,
      markdownGithub,
      true,
    )
    const enabledMlflow = runMarkdownToGraphWithToggle(
      mlflowSourceUrl,
      markdownMlflow,
      true,
    )

    const enabledMediaUrlsLocal = collectMediaNodeUrls(enabledLocal.nodes)
    const enabledMediaUrlsGithub = collectMediaNodeUrls(enabledGithub.nodes)
    const enabledMediaUrlsMlflow = collectMediaNodeUrls(enabledMlflow.nodes)
    assertArrayNonEmpty(enabledMediaUrlsLocal, 'media node urls (local markdown)')
    assertArrayNonEmpty(enabledMediaUrlsGithub, 'media node urls (github markdown)')
    assertArrayNonEmpty(enabledMediaUrlsMlflow, 'media node urls (mlflow markdown)')

    const disabledLocal = runMarkdownToGraphWithToggle('file://markdown-html-img-smoke.md', markdownLocal, false)
    const disabledGithub = runMarkdownToGraphWithToggle(
      githubSourceUrl,
      markdownGithub,
      false,
    )
    const disabledMlflow = runMarkdownToGraphWithToggle(
      mlflowSourceUrl,
      markdownMlflow,
      false,
    )

    const disabledMediaUrlsLocal = collectMediaNodeUrls(disabledLocal.nodes)
    const disabledMediaUrlsGithub = collectMediaNodeUrls(disabledGithub.nodes)
    const disabledMediaUrlsMlflow = collectMediaNodeUrls(disabledMlflow.nodes)

    if (
      disabledMediaUrlsGithub.length === 0 &&
      disabledMediaUrlsLocal.length === 0 &&
      disabledMediaUrlsMlflow.length === 0
    ) {
      throw new Error('expected media-capable nodes when toggle is disabled')
    }

    const previewLocalHtml = renderMarkdownPreview(markdownLocal, 'markdown-html-img-smoke.md')
    const previewGithubHtml = renderMarkdownPreview(markdownGithub, githubSourceUrl)
    const previewMlflowHtml = renderMarkdownPreview(markdownMlflow, mlflowSourceUrl)
    const previewAieHtml = renderMarkdownPreview(markdownAieHtml, githubSourceUrl)

    const localImgSrcs = extractImgSrcsFromHtml(previewLocalHtml)
    const githubImgSrcs = extractImgSrcsFromHtml(previewGithubHtml)
    const mlflowImgSrcs = extractImgSrcsFromHtml(previewMlflowHtml)
    const aieHtmlImgSrcs = extractImgSrcsFromHtml(previewAieHtml)

    if (
      localImgSrcs.length === 0 &&
      githubImgSrcs.length === 0 &&
      mlflowImgSrcs.length === 0 &&
      aieHtmlImgSrcs.length === 0
    ) {
      throw new Error('expected MarkdownPreview to render at least one <img> element')
    }

    const hasAieHtmlImg = aieHtmlImgSrcs.some(src => {
      if (src.includes('assets/rlhf.png')) return true
      try {
        const decoded = decodeURIComponent(src)
        return decoded.includes('assets/rlhf.png')
      } catch {
        return false
      }
    })
    if (!hasAieHtmlImg) {
      throw new Error('expected HTML img src to resolve assets/rlhf.png')
    }
  } finally {
    restoreDom()
    restoreWindow()
  }
}
