import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRoot } from 'react-dom/client'
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
import { UI_COPY } from '@/lib/config'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { splitSlides } from '@/features/markdown/ui/markdownPreviewSlides'

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

const findElementWithText = (root: HTMLElement, text: string): HTMLElement | null => {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  while (walker.nextNode()) {
    const el = walker.currentNode as HTMLElement
    if (el.textContent && el.textContent.trim() === text) return el
  }
  return null
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

export async function testMarkdownInlineAbbrAndSpanRenderingFromSlideDemo() {
  const markdownLines = readFileSync(
    resolve(process.cwd(), 'canvas', 'src', '__tests__', 'demo', 'markdown-slide-demo.md'),
    'utf8',
  ).split('\n')

  const snippet = markdownLines.slice(41, 64).join('\n')
  const html = renderMarkdownPreview(snippet, 'docs/markdown-slide-demo.md')

  if (!html.includes('Hover over this term:')) {
    throw new Error('expected abbr line to be present in rendered HTML')
  }
  if (!html.includes('Knowgrph Canvas')) {
    throw new Error('expected abbr inner text to be rendered')
  }
  if (html.includes('<abbr') || html.includes('</abbr>')) {
    throw new Error('expected abbr markup not to appear in rendered HTML')
  }

  if (!html.includes('Tailwind‑style span with custom color')) {
    throw new Error('expected span inner text to be rendered')
  }
  if (!html.includes('text-emerald-400') || !html.includes('font-semibold')) {
    throw new Error('expected span Tailwind classes to be applied')
  }
  if (html.includes('<span class="text-emerald-400 font-semibold">Tailwind‑style span with custom color</span>')) {
    throw new Error('expected raw span markup not to be echoed directly')
  }
}

export async function testMarkdownHeadMetaFrontmatterArrays() {
  const frontmatterLines = [
    '---',
    'ontologies:',
    '  - prefix: prov',
    '    iri: http://www.w3.org/ns/prov#',
    '  - prefix: mex',
    '    iri: http://mex.aksw.org/mex-core#',
    '  - prefix: pplan',
    '    iri: http://purl.org/net/p-plan#',
    '  - prefix: mls',
    '    iri: http://www.w3.org/ns/mls#',
    '  - prefix: geo',
    '    iri: http://www.opengis.net/ont/geosparql#',
    '  - prefix: ro',
    '    iri: https://w3id.org/ro/crate#',
    'graphLayers:',
    '  - competencyHyperspace',
    '  - performanceSpace',
    '  - classDistributionSpace',
    '  - preprocessingCluster',
    '  - modelTypeClusters',
    '  - kpiViolationRegion',
    '  - candidateClusters',
    '  - assessmentRegion',
    '---',
    '',
    '# Title',
  ]

  const markdown = frontmatterLines.join('\n')
  const { headMeta } = splitSlides(markdown)

  if (!headMeta || typeof headMeta !== 'object' || Array.isArray(headMeta)) {
    throw new Error('headMeta is missing or not an object')
  }

  const meta = headMeta as Record<string, unknown>
  const ontologies = meta.ontologies as unknown
  const graphLayers = meta.graphLayers as unknown

  if (!Array.isArray(ontologies)) {
    throw new Error('headMeta.ontologies is not an array')
  }
  if (!Array.isArray(graphLayers)) {
    throw new Error('headMeta.graphLayers is not an array')
  }

  const expectedOntologies = [
    { prefix: 'prov', iri: 'http://www.w3.org/ns/prov#' },
    { prefix: 'mex', iri: 'http://mex.aksw.org/mex-core#' },
    { prefix: 'pplan', iri: 'http://purl.org/net/p-plan#' },
    { prefix: 'mls', iri: 'http://www.w3.org/ns/mls#' },
    { prefix: 'geo', iri: 'http://www.opengis.net/ont/geosparql#' },
    { prefix: 'ro', iri: 'https://w3id.org/ro/crate#' },
  ]

  if (ontologies.length !== expectedOntologies.length) {
    throw new Error(
      `headMeta.ontologies length ${ontologies.length} != ${expectedOntologies.length}`,
    )
  }

  for (let i = 0; i < expectedOntologies.length; i += 1) {
    const actual = ontologies[i] as Record<string, unknown>
    const expected = expectedOntologies[i]
    if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
      throw new Error(`headMeta.ontologies[${i}] is not an object`)
    }
    const prefix = String(actual.prefix || '')
    const iri = String(actual.iri || '')
    if (prefix !== expected.prefix || iri !== expected.iri) {
      throw new Error(
        `headMeta.ontologies[${i}] mismatch: expected prefix=${expected.prefix} iri=${expected.iri}, got prefix=${prefix} iri=${iri}`,
      )
    }
  }

  const expectedGraphLayers = [
    'competencyHyperspace',
    'performanceSpace',
    'classDistributionSpace',
    'preprocessingCluster',
    'modelTypeClusters',
    'kpiViolationRegion',
    'candidateClusters',
    'assessmentRegion',
  ]

  const graphLayersStrings = graphLayers.map(v => String(v || ''))
  if (graphLayersStrings.length !== expectedGraphLayers.length) {
    throw new Error(
      `headMeta.graphLayers length ${graphLayersStrings.length} != ${expectedGraphLayers.length}`,
    )
  }

  for (let i = 0; i < expectedGraphLayers.length; i += 1) {
    if (graphLayersStrings[i] !== expectedGraphLayers[i]) {
      throw new Error(
        `headMeta.graphLayers[${i}] mismatch: expected ${expectedGraphLayers[i]}, got ${graphLayersStrings[i]}`,
      )
    }
  }

  await Promise.resolve()
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

export async function testMarkdownLayoutViewToggleEndToEnd() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(BottomPanelMarkdownSection))

    const raf = (cb: () => void) => {
      const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number }
      if (anyWindow.requestAnimationFrame) {
        anyWindow.requestAnimationFrame(cb)
        return
      }
      setTimeout(cb, 0)
    }
    const tick = () => new Promise<void>(resolve => raf(() => resolve()))
    await tick()

    const editorTitle = UI_COPY.bottomPanelMarkdownEditorTitle
    const viewerTitle = UI_COPY.bottomPanelMarkdownViewerTitle

    const editorHeaderInitial = findElementWithText(doc.body as HTMLElement, editorTitle)
    const viewerHeaderInitial = findElementWithText(doc.body as HTMLElement, viewerTitle)
    if (!editorHeaderInitial) {
      throw new Error('editor header not found in initial split layout')
    }
    if (!viewerHeaderInitial) {
      throw new Error('viewer header not found in initial split layout')
    }

    const findToggleButton = (label: string): HTMLButtonElement | null => {
      const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
      for (const btn of buttons) {
        const text = btn.textContent ? btn.textContent.trim() : ''
        if (text === label) return btn
      }
      return null
    }

    const eButton = findToggleButton('E')
    if (!eButton) {
      throw new Error('E toggle button not found')
    }
    eButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()

    const editorHeaderEditorMode = findElementWithText(doc.body as HTMLElement, editorTitle)
    const viewerHeaderEditorMode = findElementWithText(doc.body as HTMLElement, viewerTitle)
    if (!editorHeaderEditorMode) {
      throw new Error('editor header not found after toggling to editor mode')
    }
    if (viewerHeaderEditorMode) {
      throw new Error('viewer header should be hidden in editor mode')
    }

    const vButton = findToggleButton('V')
    if (!vButton) {
      throw new Error('V toggle button not found')
    }
    vButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()

    const editorHeaderViewerMode = findElementWithText(doc.body as HTMLElement, editorTitle)
    const viewerHeaderViewerMode = findElementWithText(doc.body as HTMLElement, viewerTitle)
    if (editorHeaderViewerMode) {
      throw new Error('editor header should be hidden in viewer mode')
    }
    if (!viewerHeaderViewerMode) {
      throw new Error('viewer header not found after toggling to viewer mode')
    }

    const sButton = findToggleButton('S')
    if (!sButton) {
      throw new Error('S toggle button not found')
    }
    sButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()

    const editorHeaderSplitEnd = findElementWithText(doc.body as HTMLElement, editorTitle)
    const viewerHeaderSplitEnd = findElementWithText(doc.body as HTMLElement, viewerTitle)
    if (!editorHeaderSplitEnd) {
      throw new Error('editor header not found after toggling back to split mode')
    }
    if (!viewerHeaderSplitEnd) {
      throw new Error('viewer header not found after toggling back to split mode')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testMarkdownScrollSyncViewerToEditor() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }
    const anyGlobal = globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyGlobal.requestAnimationFrame) {
      anyGlobal.requestAnimationFrame = anyWindow.requestAnimationFrame
    }

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(BottomPanelMarkdownSection))

    const tick = () => new Promise<void>(resolve => anyWindow.requestAnimationFrame ? anyWindow.requestAnimationFrame(() => resolve()) : setTimeout(() => resolve(), 0))
    await tick()

    const textarea = doc.querySelector('textarea') as HTMLTextAreaElement | null
    if (!textarea) {
      throw new Error('editor textarea not found')
    }

    const lines: string[] = []
    for (let i = 0; i < 200; i += 1) {
      lines.push(`line ${i}`)
    }
    const longText = lines.join('\n')

    Object.defineProperty(textarea, 'scrollHeight', {
      value: 2000,
      configurable: true,
    })
    Object.defineProperty(textarea, 'clientHeight', {
      value: 500,
      configurable: true,
    })

    textarea.value = longText
    textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    textarea.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    await tick()
    await tick()

    const viewer = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null
    if (!viewer) {
      throw new Error('markdown preview root not found')
    }

    Object.defineProperty(viewer, 'scrollHeight', {
      value: 2000,
      configurable: true,
    })
    Object.defineProperty(viewer, 'clientHeight', {
      value: 500,
      configurable: true,
    })

    const initialEditorScrollTop = textarea.scrollTop

    viewer.scrollTop = viewer.scrollHeight
    viewer.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await tick()
    await tick()

    const finalEditorScrollTop = textarea.scrollTop
    if (finalEditorScrollTop <= initialEditorScrollTop) {
      throw new Error('expected editor to scroll when viewer scrolls with sync on')
    }

    viewer.scrollTop = 0
    viewer.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await tick()
    await tick()

    const editorScrollAfterReset = textarea.scrollTop
    if (editorScrollAfterReset >= finalEditorScrollTop) {
      throw new Error('expected editor to scroll back toward top when viewer scrolls up')
    }

    Object.defineProperty(textarea, 'scrollHeight', {
      value: 4000,
      configurable: true,
    })
    Object.defineProperty(textarea, 'clientHeight', {
      value: 500,
      configurable: true,
    })

    textarea.scrollTop = textarea.scrollHeight
    textarea.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await tick()
    await tick()

    const viewerScrollAfterEditor = viewer.scrollTop
    if (viewerScrollAfterEditor <= 0) {
      throw new Error('expected viewer to scroll when editor scrolls with sync on')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testMarkdownEditToggleKeepsScrollPosition() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(BottomPanelMarkdownSection))

    const tick = () =>
      new Promise<void>(resolve =>
        anyWindow.requestAnimationFrame ? anyWindow.requestAnimationFrame(() => resolve()) : setTimeout(() => resolve(), 0),
      )
    await tick()

    const textarea = doc.querySelector('textarea') as HTMLTextAreaElement | null
    if (!textarea) {
      throw new Error('editor textarea not found')
    }

    const lines: string[] = []
    for (let i = 0; i < 200; i += 1) {
      lines.push(`line ${i}`)
    }
    const longText = lines.join('\n')

    Object.defineProperty(textarea, 'scrollHeight', {
      value: 4000,
      configurable: true,
    })
    Object.defineProperty(textarea, 'clientHeight', {
      value: 500,
      configurable: true,
    })

    textarea.value = longText
    textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    textarea.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    await tick()
    await tick()

    const viewer = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null
    if (!viewer) {
      throw new Error('markdown preview root not found')
    }

    Object.defineProperty(viewer, 'scrollHeight', {
      value: 4000,
      configurable: true,
    })
    Object.defineProperty(viewer, 'clientHeight', {
      value: 500,
      configurable: true,
    })

    viewer.scrollTop = viewer.scrollHeight * 0.25
    viewer.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await tick()
    await tick()

    const scrollTopBeforeEdit = viewer.scrollTop

    const editToggleTitle = UI_COPY.bottomPanelMarkdownEditToggleTitle
    const findEditToggleButton = (): HTMLButtonElement | null => {
      const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
      for (const btn of buttons) {
        const label = btn.getAttribute('aria-label') || ''
        if (label === editToggleTitle) return btn
      }
      return null
    }

    const editButtonOn = findEditToggleButton()
    if (!editButtonOn) {
      throw new Error('Edit toggle button not found')
    }
    editButtonOn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()
    await tick()

    textarea.scrollTop = textarea.scrollHeight * 0.125
    textarea.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await tick()
    await tick()

    const scrollTopEditorTarget = textarea.scrollTop

    const editButtonOff = findEditToggleButton()
    if (!editButtonOff) {
      throw new Error('Edit toggle button not found after enabling edit mode')
    }
    editButtonOff.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()
    await tick()

    const scrollTopAfterEditOff = viewer.scrollTop

    if (!(scrollTopAfterEditOff > 0)) {
      throw new Error('viewer scrollTop after Edit Off should be > 0')
    }

    const deltaBefore = Math.abs(scrollTopBeforeEdit - scrollTopEditorTarget)
    const deltaAfter = Math.abs(scrollTopAfterEditOff - scrollTopEditorTarget)
    if (!(deltaAfter <= deltaBefore)) {
      throw new Error(
        `expected viewer scroll after Edit Off to be at least as close to editor target as before (before=${deltaBefore}, after=${deltaAfter})`,
      )
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testMarkdownScrollSyncMixedContentViewerToEditor() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }
    const anyGlobal = globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyGlobal.requestAnimationFrame) {
      anyGlobal.requestAnimationFrame = anyWindow.requestAnimationFrame
    }

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(BottomPanelMarkdownSection))

    const tick = () =>
      new Promise<void>(resolve =>
        anyWindow.requestAnimationFrame ? anyWindow.requestAnimationFrame(() => resolve()) : setTimeout(() => resolve(), 0),
      )
    await tick()

    const textarea = doc.querySelector('textarea') as HTMLTextAreaElement | null
    if (!textarea) {
      throw new Error('editor textarea not found')
    }

    const mixedLines: string[] = []
    mixedLines.push('# Title')
    mixedLines.push('')
    mixedLines.push('Intro paragraph before code block.')
    mixedLines.push('')
    mixedLines.push('```js')
    mixedLines.push('console.log("one");')
    mixedLines.push('console.log("two");')
    mixedLines.push('console.log("three");')
    mixedLines.push('```')
    mixedLines.push('')
    mixedLines.push('| Col A | Col B |')
    mixedLines.push('|-------|-------|')
    mixedLines.push('| a1    | b1    |')
    mixedLines.push('| a2    | b2    |')
    mixedLines.push('')
    mixedLines.push('![Alt text](https://example.com/image.png)')
    mixedLines.push('')
    mixedLines.push('Trailing paragraph after table and image.')

    const mixedMarkdown = mixedLines.join('\n')

    Object.defineProperty(textarea, 'scrollHeight', {
      value: 2000,
      configurable: true,
    })
    Object.defineProperty(textarea, 'clientHeight', {
      value: 500,
      configurable: true,
    })

    textarea.value = mixedMarkdown
    textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    textarea.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    await tick()
    await tick()

    const viewer = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null
    if (!viewer) {
      throw new Error('markdown preview root not found')
    }

    Object.defineProperty(viewer, 'scrollHeight', {
      value: 2000,
      configurable: true,
    })
    Object.defineProperty(viewer, 'clientHeight', {
      value: 500,
      configurable: true,
    })

    const blocks = Array.from(
      viewer.querySelectorAll<HTMLElement>('[data-start-line]'),
    )
    if (blocks.length === 0) {
      throw new Error('expected markdown preview to render blocks with data-start-line')
    }

    const viewerHeight = 600
    Object.defineProperty(viewer, 'getBoundingClientRect', {
      value: () =>
        ({
          top: 0,
          left: 0,
          right: 800,
          bottom: viewerHeight,
          width: 800,
          height: viewerHeight,
        } as DOMRect),
      configurable: true,
    })

    const blockHeight = 120
    const basePositions: number[] = []
    blocks.forEach((el, index) => {
      const baseTop = index * blockHeight
      basePositions.push(baseTop)
      Object.defineProperty(el, 'getBoundingClientRect', {
        value: () =>
          ({
            top: baseTop - viewer.scrollTop,
            bottom: baseTop - viewer.scrollTop + blockHeight,
            left: 0,
            right: 800,
            width: 800,
            height: blockHeight,
          } as DOMRect),
        configurable: true,
      })
    })

    const findBlockByLine = (line: number) => {
      return blocks.find(el => {
        const raw = el.getAttribute('data-start-line')
        if (!raw) return false
        const n = Number.parseInt(raw, 10)
        return Number.isFinite(n) && n === line
      })
    }

    const codeStartLine = 5
    const tableStartLine = 11
    const imageStartLine = 16

    const codeBlockEl = findBlockByLine(codeStartLine)
    const tableBlockEl = findBlockByLine(tableStartLine)
    const imageBlockEl = findBlockByLine(imageStartLine)

    if (!codeBlockEl) {
      throw new Error('code block element not found in preview')
    }
    if (!tableBlockEl) {
      throw new Error('table block element not found in preview')
    }
    if (!imageBlockEl) {
      throw new Error('image block element not found in preview')
    }

    const codeIndex = blocks.indexOf(codeBlockEl)
    const tableIndex = blocks.indexOf(tableBlockEl)
    const imageIndex = blocks.indexOf(imageBlockEl)
    if (codeIndex < 0 || tableIndex < 0 || imageIndex < 0) {
      throw new Error('failed to locate code, table, or image block index')
    }

    const bias = 0.45
    const anchorOffset = viewerHeight * bias

    viewer.scrollTop = basePositions[codeIndex] - anchorOffset + blockHeight / 2
    viewer.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await tick()
    await tick()
    const editorScrollForCode = textarea.scrollTop

    viewer.scrollTop = basePositions[tableIndex] - anchorOffset + blockHeight / 2
    viewer.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await tick()
    await tick()
    const editorScrollForTable = textarea.scrollTop

    viewer.scrollTop = basePositions[imageIndex] - anchorOffset + blockHeight / 2
    viewer.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await tick()
    await tick()
    const editorScrollForImage = textarea.scrollTop

    if (!(editorScrollForTable > editorScrollForCode)) {
      throw new Error('expected table block to map to a larger editor scrollTop than code block')
    }
    if (!(editorScrollForImage > editorScrollForTable)) {
      throw new Error('expected image block to map to a larger editor scrollTop than table block')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testMarkdownPresentationFullscreenFromBottomPanelControls() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(BottomPanelMarkdownSection))

    const tick = () =>
      new Promise<void>(resolve =>
        anyWindow.requestAnimationFrame ? anyWindow.requestAnimationFrame(() => resolve()) : setTimeout(() => resolve(), 0),
      )

    await tick()
    await tick()

    const textarea = doc.querySelector('textarea') as HTMLTextAreaElement | null
    if (!textarea) {
      throw new Error('editor textarea not found')
    }

    const markdownLines: string[] = []
    markdownLines.push('---')
    markdownLines.push('title: Demo')
    markdownLines.push('---')
    markdownLines.push('')
    markdownLines.push('# Slide 1')
    markdownLines.push('')
    markdownLines.push('Content for slide 1.')
    const markdown = markdownLines.join('\n')

    textarea.value = markdown
    textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    textarea.dispatchEvent(new dom.window.Event('change', { bubbles: true }))

    await tick()
    await tick()

    const fullscreenTitle = UI_COPY.bottomPanelMarkdownFullscreenToggleTitle
    const findFullscreenButton = (): HTMLButtonElement | null => {
      const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
      for (const btn of buttons) {
        const label = btn.getAttribute('aria-label') || ''
        if (label === fullscreenTitle) return btn
      }
      return null
    }

    const fullscreenBtn = findFullscreenButton()
    if (!fullscreenBtn) {
      throw new Error('markdown fullscreen toggle button not found')
    }

    fullscreenBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    await tick()
    await tick()

    const overlay = doc.querySelector('.fixed.inset-0.z-[99999], .absolute.inset-0.z-[99999]') as HTMLDivElement | null
    if (!overlay) {
      throw new Error('expected PreviewOverlay to be open after fullscreen toggle from bottom panel controls')
    }

    const presentationRoot = overlay.querySelector('[data-testid="markdown-presentation-root"]') as HTMLDivElement | null
    if (!presentationRoot) {
      throw new Error('expected overlay to contain markdown presentation root after fullscreen toggle')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
