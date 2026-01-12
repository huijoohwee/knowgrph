import React from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { UI_COPY } from '@/lib/config'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { splitSlides } from '@/features/markdown/ui/markdownPreviewSlides'
import {
  buildTestMarkdownFromFile,
  buildTestMarkdownFromGithub,
  buildTestMarkdownFromAieHtml,
  buildTestMarkdownFromMlflow,
  collectMediaNodeUrls,
  assertArrayNonEmpty,
  runMarkdownToGraphWithToggle,
  renderMarkdownPreview,
  extractImgSrcsFromHtml,
} from './markdown/markdownTestUtils'

export async function testMarkdownInlineAbbrAndSpanRenderingFromSlideDemo() {
  const markdownLines = readFileSync(
    resolve(process.cwd(), 'src', '__tests__', 'demo', 'markdown-slide-demo.md'),
    'utf8',
  ).split('\n')

  const abbrLineIndex = markdownLines.findIndex(line => line.includes('<abbr'))
  if (abbrLineIndex === -1) {
    throw new Error('Could not find <abbr> line in markdown-slide-demo.md')
  }

  // Extract a snippet covering the abbr and the following span
  const snippet = markdownLines.slice(abbrLineIndex - 5, abbrLineIndex + 15).join('\n')
  const html = renderMarkdownPreview(snippet, 'docs/markdown-slide-demo.md')

  if (!html.includes('Hover over this term:')) {
    throw new Error('expected abbr line to be present in rendered HTML')
  }
  if (!html.includes('Canvas Viewer')) {
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

    if (!dom.window.ResizeObserver) {
      dom.window.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    }
    if (!global.ResizeObserver) {
      global.ResizeObserver = dom.window.ResizeObserver
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

    const overlaySelector = '.fixed.inset-0.z-\\[99999\\], .absolute.inset-0.z-\\[99999\\]'
    let overlay = doc.querySelector(overlaySelector) as HTMLDivElement | null
    for (let i = 0; i < 40 && !overlay; i += 1) {
      await tick()
      overlay = doc.querySelector(overlaySelector) as HTMLDivElement | null
    }
    if (!overlay) {
      throw new Error('expected PreviewOverlay to be open after fullscreen toggle from bottom panel controls')
    }

    let presentationRoot = doc.querySelector('[data-testid="markdown-presentation-root"]') as HTMLDivElement | null
    for (let i = 0; i < 40 && !presentationRoot; i += 1) {
      await tick()
      presentationRoot = doc.querySelector('[data-testid="markdown-presentation-root"]') as HTMLDivElement | null
    }
    if (!presentationRoot) {
      throw new Error('expected markdown presentation root to be present after fullscreen toggle')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
