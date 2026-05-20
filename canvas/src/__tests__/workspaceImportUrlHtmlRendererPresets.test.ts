import { fetchWorkspaceUrlContent } from '@/features/markdown-workspace/workspaceImport'
import { resetWorkspaceUrlContentCacheForTests } from '@/features/markdown-workspace/workspaceImport/urlContentCache'
import {
  WORKSPACE_URL_IMPORT_DOCUMENT_MODES,
  WORKSPACE_URL_IMPORT_CANVAS_RENDERERS,
  getWorkspaceUrlImportDocumentModeLabel,
  getWorkspaceUrlImportCanvasRendererLabel,
} from '@/features/markdown-workspace/workspaceImport/canvasPresets'
import { normalizeImportUrlRendererSelection, parseImportUrlRendererSelection } from '@/lib/toolbar/ImportUrlRendererSelect'

type GlobalWithFetch = typeof globalThis & { fetch?: typeof fetch }

function buildSourceHtml(title: string, first: string, last: string): string {
  const paragraphs = [
    `<p>${first}</p>`,
    ...Array.from(
      { length: 18 },
      (_, index) => `<p>Neutral source paragraph ${index + 1} remains part of the imported HTML body.</p>`,
    ),
    `<p>${last}</p>`,
  ].join('')
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    `<title>${title}</title>`,
    '</head>',
    '<body>',
    `<main><h1>${title}</h1>${paragraphs}</main>`,
    '</body>',
    '</html>',
  ].join('')
}

export function testImportUrlRendererSelectionCarriesDocumentMode(): void {
  for (const renderer of WORKSPACE_URL_IMPORT_CANVAS_RENDERERS) {
    for (const documentSemanticMode of WORKSPACE_URL_IMPORT_DOCUMENT_MODES) {
      const value = normalizeImportUrlRendererSelection(`${renderer}:${documentSemanticMode}`)
      const parsed = parseImportUrlRendererSelection(value)
      if (!parsed) throw new Error(`expected import URL selection to parse ${value}`)
      if (parsed.canvas2dRenderer !== renderer) throw new Error(`expected ${value} to preserve renderer ${renderer}`)
      if (parsed.documentSemanticMode !== documentSemanticMode) {
        throw new Error(`expected ${value} to preserve document mode ${documentSemanticMode}`)
      }
    }
  }
  if (normalizeImportUrlRendererSelection('d3') !== 'default') {
    throw new Error('expected bare renderer values to avoid legacy selection remapping')
  }
}

function installWebpageProxyFetch(htmlByUrl: Map<string, string>, calls: string[]): () => void {
  const g = globalThis as GlobalWithFetch
  const prev = g.fetch
  g.fetch = (async (input: unknown) => {
    const url = input instanceof URL ? input.toString() : String(input || '')
    calls.push(url)
    if (url.startsWith('/__fetch_remote?url=')) {
      throw new Error(`unexpected legacy remote fetch for webpage import: ${url}`)
    }
    if (!url.startsWith('/__webpage_proxy?')) {
      return new Response('not found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
    }
    const qs = new URLSearchParams(url.slice(url.indexOf('?') + 1))
    const sourceUrl = qs.get('url') || ''
    const html = htmlByUrl.get(sourceUrl) || ''
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }) as unknown as typeof fetch
  return () => {
    g.fetch = prev
  }
}

export async function testWorkspaceImportUrlHtmlRendererPresetsFetchAndSetCanvasPreset(): Promise<void> {
  resetWorkspaceUrlContentCacheForTests()
  const urls = new Map<string, { title: string; first: string; last: string }>([
    ...WORKSPACE_URL_IMPORT_CANVAS_RENDERERS.map(renderer => {
      const fixture = {
        title: `${getWorkspaceUrlImportCanvasRendererLabel(renderer)} Source`,
        first: `${getWorkspaceUrlImportCanvasRendererLabel(renderer)} first source-visible paragraph`,
        last: `${getWorkspaceUrlImportCanvasRendererLabel(renderer)} last source-visible paragraph`,
      }
      return [`https://example.com/import-html-${renderer}.html`, fixture] as [string, typeof fixture]
    }),
  ])
  const htmlByUrl = new Map(
    Array.from(urls.entries()).map(([url, fixture]) => [url, buildSourceHtml(fixture.title, fixture.first, fixture.last)]),
  )
  const calls: string[] = []
  const restore = installWebpageProxyFetch(htmlByUrl, calls)
  try {
    for (const renderer of WORKSPACE_URL_IMPORT_CANVAS_RENDERERS) {
      const url = `https://example.com/import-html-${renderer}.html`
      const fixture = urls.get(url)
      if (!fixture) throw new Error(`missing fixture for ${renderer}`)
      for (const documentSemanticMode of WORKSPACE_URL_IMPORT_DOCUMENT_MODES) {
        const res = await fetchWorkspaceUrlContent(url, { mode: 'import', viewHint: 'html', canvas2dRenderer: renderer, documentSemanticMode })
        if (!res || typeof res.text !== 'string') throw new Error(`expected ${renderer} import result text`)
        if (!res.text.includes(fixture.first)) throw new Error(`expected ${renderer} import to preserve first source-visible paragraph`)
        if (!res.text.includes(fixture.last)) throw new Error(`expected ${renderer} import to preserve last source-visible paragraph`)
        if (!new RegExp(`kgCanvas2dRenderer:\\s*"${renderer}"`).test(res.text)) {
          throw new Error(`expected ${getWorkspaceUrlImportCanvasRendererLabel(renderer)} preset frontmatter`)
        }
        if (!new RegExp(`kgDocumentSemanticMode:\\s*"${documentSemanticMode}"`).test(res.text)) {
          throw new Error(`expected ${renderer} import to set ${getWorkspaceUrlImportDocumentModeLabel(documentSemanticMode)}`)
        }
        if (!/kgCanvasRenderMode:\s*"2d"/.test(res.text)) throw new Error(`expected ${renderer} import to activate 2D canvas mode`)
        if (!/kgWebpageView:\s*"html"/.test(res.text)) throw new Error(`expected ${renderer} import to request HTML view`)
        if (!/kgWebpageFidelityLevel:\s*"4"/.test(res.text)) throw new Error(`expected ${renderer} import to use fidelity level 4`)
        if (!/kgWebpageIncludeImages:\s*"true"/.test(res.text)) throw new Error(`expected ${renderer} import to include images`)
        if (res.text.includes('Fetching content in background')) throw new Error(`expected ${renderer} import to avoid background hydration placeholders`)
        if (res.text.includes('kgWebpageHydrate')) throw new Error(`expected ${renderer} import to avoid hydrate frontmatter`)
        if (res.text.includes('<html') || res.text.includes('<script')) throw new Error(`expected ${renderer} import to avoid raw HTML embedding`)
      }
    }
    if (!calls.some(call => call.startsWith('/__webpage_proxy?'))) throw new Error('expected shared webpage proxy ingestion')
    if (calls.some(call => call.startsWith('/__fetch_remote?'))) throw new Error('unexpected legacy fetch endpoint')
  } finally {
    restore()
    resetWorkspaceUrlContentCacheForTests()
  }
}
