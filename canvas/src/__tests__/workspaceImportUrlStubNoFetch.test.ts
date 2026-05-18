import path from 'node:path'

import { fetchWorkspaceUrlContent } from '@/features/markdown-workspace/workspaceImport'
import { chooseWebpageMarkdownByContentCoverage } from '@/features/markdown-workspace/workspaceImport/webpageMarkdownFidelity'
import { resetWorkspaceUrlContentCacheForTests } from '@/features/markdown-workspace/workspaceImport/urlContentCache'

type GlobalWithFetch = typeof globalThis & { fetch?: typeof fetch }

const webpageHtml = (title: string, extraHead = '') => [
  '<!doctype html>',
  '<html>',
  '<head>',
  `<title>${title}</title>`,
  extraHead,
  '</head>',
  '<body>',
  `<main><h1>${title}</h1><p>Imported URL parsing renders body content through the shared webpage pipeline.</p></main>`,
  '</body>',
  '</html>',
].join('')

function createMinimalGlbBytes(): Uint8Array {
  const json = JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
  })
  const jsonRaw = new TextEncoder().encode(json)
  const jsonLength = Math.ceil(jsonRaw.byteLength / 4) * 4
  const totalLength = 12 + 8 + jsonLength
  const bytes = new Uint8Array(totalLength)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, totalLength, true)
  view.setUint32(12, jsonLength, true)
  view.setUint32(16, 0x4e4f534a, true)
  bytes.set(jsonRaw, 20)
  bytes.fill(0x20, 20 + jsonRaw.byteLength, 20 + jsonLength)
  return bytes
}

function installWebpageProxyFetch(htmlByUrl: Map<string, string>, calls: string[]) {
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
    const first = htmlByUrl.values().next()
    const html = htmlByUrl.get(sourceUrl) || (first.done ? '' : first.value) || ''
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }) as unknown as typeof fetch
  return () => {
    g.fetch = prev
  }
}

async function assertFetchedImportFor(url: string) {
  resetWorkspaceUrlContentCacheForTests()
  const calls: string[] = []
  const restore = installWebpageProxyFetch(new Map([[url, webpageHtml('Import URL Fixture')]]), calls)
  try {
    const res = await fetchWorkspaceUrlContent(url, { mode: 'import' })
    if (!res || typeof res.text !== 'string') throw new Error('Expected result text')
    if (!res.text.includes('kgWebpageUrl:')) throw new Error('Expected webpage frontmatter')
    if (!res.text.includes(url)) throw new Error('Expected URL in stub')
    if (!res.text.includes('kgWebpageView:')) throw new Error('Expected view in stub')
    if (res.text.includes('Fetching content in background')) throw new Error('Import must not leave a background hydration placeholder')
    if (res.text.includes('kgWebpageHydrate')) throw new Error('Import must not create self-hydrating webpage stubs')
    if (!res.text.includes('Imported URL parsing renders body content')) throw new Error('Expected parsed webpage body content')
    if (res.text.includes('<html') || res.text.includes('<script')) throw new Error('Import must not embed raw HTML')
    if (!calls.some(call => call.startsWith('/__webpage_proxy?'))) throw new Error('Expected shared webpage proxy ingestion')
  } finally {
    restore()
    resetWorkspaceUrlContentCacheForTests()
  }
}

export async function testWorkspaceImportUrlImportFetchesAndParsesWebpage(): Promise<void> {
  await assertFetchedImportFor('https://example.com/')
  await assertFetchedImportFor('https://vercel.com/')
}

export async function testWorkspaceImportUrlViewHintsUseSingleIngestionPass(): Promise<void> {
  resetWorkspaceUrlContentCacheForTests()
  const jsonUrl = 'https://example.com/json'
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'JSON Import Fixture',
    url: jsonUrl,
  })
  const urls = {
    json: jsonUrl,
    markdown: 'https://example.com/markdown',
    html: 'https://example.com/html',
  } as const
  const calls: string[] = []
  const restore = installWebpageProxyFetch(
    new Map([
      [urls.json, webpageHtml('JSON Import Fixture', `<script type="application/ld+json">${jsonLd}</script>`)],
      [urls.markdown, webpageHtml('Markdown Import Fixture')],
      [urls.html, webpageHtml('HTML Import Fixture')],
    ]),
    calls,
  )
  try {
    const views = ['json', 'markdown', 'html'] as const
    for (const view of views) {
      const res = await fetchWorkspaceUrlContent(urls[view], { mode: 'import', viewHint: view })
      if (!res || typeof res.text !== 'string') throw new Error(`expected ${view} import result`)
      if (!res.text.includes(`kgWebpageView: "${view}"`)) {
        throw new Error(`expected ${view} import to preserve view frontmatter`)
      }
      if (res.text.includes('Fetching content in background')) {
        throw new Error(`expected ${view} import to avoid background hydration placeholder`)
      }
      if (res.text.includes('kgWebpageHydrate')) {
        throw new Error(`expected ${view} import to avoid hydrate frontmatter`)
      }
      if (res.text.includes('<html') || res.text.includes('<script')) {
        throw new Error(`expected ${view} import to avoid embedding fetched HTML`)
      }
    }
    if (!calls.some(call => call.startsWith('/__webpage_proxy?'))) throw new Error('expected webpage proxy import fetches')
  } finally {
    restore()
    resetWorkspaceUrlContentCacheForTests()
  }
}

export async function testWorkspaceImportUrlPrefersHigherCoverageMarkdownFallback(): Promise<void> {
  const converted = [
    '# Session 32',
    '',
    'A later section survived conversion, but the opening agenda and most transcripts are missing.',
  ].join('\n')
  const fallback = [
    '# Conference Day',
    '',
    'Opening agenda, venue notes, and source overview.',
    '',
    ...Array.from({ length: 180 }, (_, index) => [
      `## Session ${index + 1}`,
      '',
      `Transcript paragraph ${index + 1} preserves source-visible content across the whole page.`,
    ].join('\n')),
  ].join('\n\n')

  const selected = chooseWebpageMarkdownByContentCoverage({
    mode: 'import',
    convertedMarkdown: converted,
    fallbackMarkdown: fallback,
  })
  if (selected.source !== 'fallback') {
    throw new Error(`expected high-coverage fallback selection, got ${selected.source}`)
  }
  if (!selected.markdown.includes('Opening agenda')) {
    throw new Error('expected first source section to be preserved by fallback selection')
  }
  if (!selected.markdown.includes('Session 180')) {
    throw new Error('expected late source section to be preserved by fallback selection')
  }
}

export async function testWorkspaceImportUrlImportPreservesFullTextFallbackBody(): Promise<void> {
  resetWorkspaceUrlContentCacheForTests()
  const url = 'https://example.com/conference'
  const first = 'Opening agenda source-visible content'
  const last = 'Closing transcript source-visible content'
  const manyScripts = Array.from({ length: 25 }, () => '<script>var shell=1;</script>').join('')
  const paragraphs = [
    `<p>${first}</p>`,
    ...Array.from({ length: 160 }, (_, index) => `<p>Transcript segment ${index + 1} remains part of the imported source text.</p>`),
    `<p>${last}</p>`,
  ].join('')
  const calls: string[] = []
  const restore = installWebpageProxyFetch(
    new Map([[url, `<!doctype html><html><head><title>Conference</title>${manyScripts}</head><body><main><h1>Conference</h1>${paragraphs}</main></body></html>`]]),
    calls,
  )
  try {
    const res = await fetchWorkspaceUrlContent(url, { mode: 'import', viewHint: 'markdown' })
    if (!res || typeof res.text !== 'string') throw new Error('expected import result')
    if (!res.text.includes(first)) throw new Error('expected first source-visible paragraph')
    if (!res.text.includes(last)) throw new Error('expected last source-visible paragraph')
    if (res.text.includes('…(clipped')) throw new Error('expected import fallback body to avoid refresh clipping')
    if (!calls.some(call => call.startsWith('/__webpage_proxy?'))) throw new Error('expected shared webpage proxy ingestion')
    if (calls.some(call => call.startsWith('/__fetch_remote?'))) throw new Error('unexpected legacy fetch endpoint')
  } finally {
    restore()
    resetWorkspaceUrlContentCacheForTests()
  }
}

export async function testWorkspaceImportUrlAcceptsAbsoluteFsPathViaViteFsFetch(): Promise<void> {
  const g = globalThis as GlobalWithFetch
  const prev = g.fetch
  let calledUrl = ''
  g.fetch = (async (input: unknown) => {
    calledUrl = input instanceof URL ? input.toString() : String(input || '')
    return {
      ok: true,
      status: 200,
      text: async () => '# Local Demo\n',
    } as Response
  }) as unknown as typeof fetch
  try {
    const inputPath = path.resolve(process.cwd(), 'src', '__tests__', 'fixtures', 'synthetic-local-import.md')
    const normalizedFsPath = inputPath.replace(/\\/g, '/')
    const res = await fetchWorkspaceUrlContent(inputPath, { mode: 'import' })
    if (calledUrl !== `/@fs${normalizedFsPath}`) {
      throw new Error(`expected absolute filesystem import to fetch through Vite /@fs, got ${String(calledUrl)}`)
    }
    if (res.normalizedUrl !== inputPath) {
      throw new Error(`expected absolute filesystem import to preserve the original source path, got ${String(res.normalizedUrl)}`)
    }
    if (res.name !== 'synthetic-local-import.md') {
      throw new Error(`expected absolute filesystem import to derive the source basename, got ${String(res.name)}`)
    }
    if (res.text !== '# Local Demo\n') {
      throw new Error('expected absolute filesystem import to return fetched markdown text verbatim')
    }
  } finally {
    g.fetch = prev
  }
}

export async function testWorkspaceImportUrlGlbFetchesBinaryManifest(): Promise<void> {
  resetWorkspaceUrlContentCacheForTests()
  const g = globalThis as GlobalWithFetch
  const prev = g.fetch
  let calledUrl = ''
  g.fetch = (async (input: unknown) => {
    calledUrl = input instanceof URL ? input.toString() : String(input || '')
    return new Response(createMinimalGlbBytes(), {
      status: 200,
      headers: { 'Content-Type': 'model/gltf-binary' },
    })
  }) as unknown as typeof fetch
  try {
    const sourceUrl = 'https://assets.example/models/scene.glb'
    const res = await fetchWorkspaceUrlContent(sourceUrl, { mode: 'import' })
    if (!calledUrl.startsWith('/__chat_asset_proxy?url=')) {
      throw new Error(`expected remote GLB URL import to fetch through binary proxy, got ${calledUrl}`)
    }
    if (res.name !== 'scene.glb') {
      throw new Error(`expected GLB URL import to preserve scene.glb, got ${res.name}`)
    }
    if (res.normalizedUrl !== sourceUrl) {
      throw new Error(`expected GLB URL import to preserve source URL, got ${res.normalizedUrl}`)
    }
    if (!res.text.includes('kgAssetFormat: "glb"')) throw new Error('expected GLB asset format frontmatter')
    if (!res.text.includes('kgAssetSource: "url"')) throw new Error('expected GLB URL source marker')
    if (!res.text.includes('kgAssetValidGlbMagic: true')) throw new Error('expected GLB magic validation flag')
    if (!res.text.includes('kgAssetValidGlbContainer: true')) throw new Error('expected GLB container validation flag')
    if (!res.text.includes('kgAssetValidGltfAsset: true')) throw new Error('expected GLB JSON chunk to validate as a glTF asset')
    if (!res.text.includes('kgAssetEncoding: "base64-body"')) {
      throw new Error('expected GLB URL manifest to keep encoded model data outside frontmatter')
    }
    if (!res.text.includes('```kg-glb-base64')) {
      throw new Error('expected GLB URL manifest to embed chunked model data in a fenced payload')
    }
  } finally {
    g.fetch = prev
    resetWorkspaceUrlContentCacheForTests()
  }
}

export async function testWorkspaceImportUrlGltfFetchesJsonManifest(): Promise<void> {
  resetWorkspaceUrlContentCacheForTests()
  const g = globalThis as GlobalWithFetch
  const prev = g.fetch
  let calledUrl = ''
  g.fetch = (async (input: unknown) => {
    calledUrl = input instanceof URL ? input.toString() : String(input || '')
    const gltf = JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }], nodes: [] })
    return new Response(gltf, {
      status: 200,
      headers: { 'Content-Type': 'model/gltf+json' },
    })
  }) as unknown as typeof fetch
  try {
    const sourceUrl = 'https://assets.example/models/scene.gltf'
    const res = await fetchWorkspaceUrlContent(sourceUrl, { mode: 'import' })
    if (!calledUrl.startsWith('/__chat_asset_proxy?url=')) {
      throw new Error(`expected remote GLTF URL import to fetch through model proxy, got ${calledUrl}`)
    }
    if (res.name !== 'scene.gltf') {
      throw new Error(`expected GLTF URL import to preserve scene.gltf, got ${res.name}`)
    }
    if (res.normalizedUrl !== sourceUrl) {
      throw new Error(`expected GLTF URL import to preserve source URL, got ${res.normalizedUrl}`)
    }
    if (!res.text.includes('kgAssetFormat: "gltf"')) throw new Error('expected GLTF asset format frontmatter')
    if (!res.text.includes('kgAssetSource: "url"')) throw new Error('expected GLTF URL source marker')
    if (!res.text.includes('kgAssetValidGltfJson: true')) throw new Error('expected GLTF JSON validation flag')
    if (!res.text.includes('kgAssetValidGltfAsset: true')) throw new Error('expected GLTF asset version validation flag')
    if (!res.text.includes('kgAssetGltfVersion: "2.0"')) throw new Error('expected GLTF version metadata')
    if (!res.text.includes('kgAssetEncoding: "json-body"')) {
      throw new Error('expected GLTF URL manifest to keep model JSON outside frontmatter')
    }
    if (!res.text.includes('```kg-gltf-base64')) {
      throw new Error('expected GLTF URL manifest to embed chunked model JSON in a fenced payload')
    }
  } finally {
    g.fetch = prev
    resetWorkspaceUrlContentCacheForTests()
  }
}
