import path from 'node:path'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'

import { fetchWorkspaceUrlContent, importWorkspaceUrl } from '@/features/markdown-workspace/workspaceImport'
import { isFrontmatterOnlyDoc } from '@/lib/markdown/frontmatter'
import { setWorkspaceWebpageDomExportForTests } from '@/features/markdown-workspace/workspaceImport/urlContent'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { applyWorkspaceImportToCanvas } from '@/features/workspace-fs/applyWorkspaceImportToCanvas'
import { shouldApplyImportedCanvasDocumentToGraph } from '@/features/markdown-workspace/workspaceImport/applyPolicy'
import { resolveImportedCanvasDocumentApplyToGraph } from '@/features/markdown-workspace/useWorkspaceFileActions/importRuntimeActions'
import { chooseWebpageMarkdownByContentCoverage } from '@/features/markdown-workspace/workspaceImport/webpageMarkdownFidelity'
import { resetWorkspaceUrlContentCacheForTests } from '@/features/markdown-workspace/workspaceImport/urlContentCache'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import {
  readWorkspaceImportShareExportRootPathSetting,
  writeWorkspaceImportShareExportRootPathSetting,
} from '@/lib/workspace/workspaceStoreSyncSettings'

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

function installYouTubeTranscriptFetch(calls: string[]) {
  const g = globalThis as GlobalWithFetch
  const prev = g.fetch
  g.fetch = (async (input: unknown) => {
    const url = input instanceof URL ? input.toString() : String(input || '')
    calls.push(url)
    if (!url.startsWith('/__youtube_transcript?')) {
      return new Response('not found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
    }
    const qs = new URLSearchParams(url.slice(url.indexOf('?') + 1))
    const sourceUrl = qs.get('url') || ''
    const parsed = new URL(sourceUrl)
    const videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean)[0] || ''
    const title = `Transcript ${videoId}`
    return new Response(JSON.stringify({
      ok: true,
      name: `youtube-${videoId}.md`,
      markdown: `# ${title}\n\n${sourceUrl};\n\nTranscript body.\n`,
      transcript: {
        ok: true,
        title,
        video_id: videoId,
        source_url: sourceUrl,
        segment_count: 1,
        segments: [{ text: 'Transcript body.', start: 0, duration: 1 }],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
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

export async function testWorkspaceImportUrlYouTubePreservesPaneContentFormats(): Promise<void> {
  resetWorkspaceUrlContentCacheForTests()
  const calls: string[] = []
  const restore = installYouTubeTranscriptFetch(calls)
  try {
    const fakeId = 'AbC_DeF1234'
    const watchUrl = `https://www.youtube.com/watch?v=${fakeId}&t=42`
    const markdownRes = await fetchWorkspaceUrlContent(watchUrl, { mode: 'import', viewHint: 'markdown' })
    if (!markdownRes.text.includes(`kgYoutubeVideoId: "${fakeId}"`)) {
      throw new Error('expected YouTube workspace import to preserve the case-sensitive video id in frontmatter')
    }
    if (!markdownRes.text.includes('kgYoutubeFormat: "markdown"')) {
      throw new Error('expected markdown import to preserve markdown format frontmatter')
    }
    if (!markdownRes.text.includes(`[![Transcript ${fakeId}](https://i.ytimg.com/vi/${fakeId}/hqdefault.jpg)](${watchUrl})`)) {
      throw new Error('expected markdown import to render the source URL as a linked thumbnail image')
    }

    const jsonUrl = `https://www.youtube.com/watch?v=${fakeId}&t=42&pane=json`
    const jsonRes = await fetchWorkspaceUrlContent(jsonUrl, { mode: 'import', viewHint: 'json' })
    if (!jsonRes.text.includes(`kgYoutubeVideoId: "${fakeId}"`)) {
      throw new Error('expected JSON import to preserve the case-sensitive video id in frontmatter')
    }
    if (!jsonRes.text.includes('kgYoutubeFormat: "json"')) {
      throw new Error('expected JSON import to preserve json format frontmatter')
    }
    if (!jsonRes.text.includes('```json') || !jsonRes.text.includes(`"video_id": "${fakeId}"`)) {
      throw new Error('expected JSON import to keep transcript JSON visible in the workspace file')
    }

    const rendererRes = await fetchWorkspaceUrlContent(watchUrl, {
      mode: 'import',
      viewHint: 'html',
      canvas2dRenderer: 'd3',
      documentSemanticMode: 'keyword',
    })
    if (shouldApplyImportedCanvasDocumentToGraph({ path: '/youtube-transcript.md', text: rendererRes.text })) {
      throw new Error('expected renderer-selected YouTube imports to avoid graph parsing without canvas frontmatter')
    }
    const fs = createMemoryWorkspaceFs({
      initialEntries: [
        { path: '/', parentPath: null, kind: 'folder', name: '', updatedAtMs: 1 },
        {
          path: '/youtube-transcript.md',
          parentPath: '/',
          kind: 'file',
          name: 'youtube-transcript.md',
          text: rendererRes.text,
          updatedAtMs: 2,
        },
      ],
    })
    const applyToGraph = await resolveImportedCanvasDocumentApplyToGraph({
      fs,
      createdPaths: ['/youtube-transcript.md'],
    })
    if (applyToGraph) throw new Error('expected imported YouTube transcript content to remain a workspace document')
    if (calls.length !== 2) throw new Error(`expected renderer-selected import to reuse the cached YouTube conversion, got ${calls.length} requests`)
  } finally {
    restore()
    resetWorkspaceUrlContentCacheForTests()
  }
}

export async function testWorkspaceImportUrlCarriesApplyPolicyFromIngestion(): Promise<void> {
  resetWorkspaceUrlContentCacheForTests()
  const calls: string[] = []
  const restore = installYouTubeTranscriptFetch(calls)
  try {
    const fakeId = 'PolicyId1234'
    const watchUrl = `https://www.youtube.com/watch?v=${fakeId}`
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()
    const result = await importWorkspaceUrl({ fs, urlRaw: watchUrl, parentPath: '/' })
    if (result.applyToGraph !== false) {
      throw new Error(`expected YouTube URL import to carry passive apply policy, got ${String(result.applyToGraph)}`)
    }
    const transcriptCalls = calls.filter(call => call.startsWith('/__youtube_transcript?'))
    if (transcriptCalls.length !== 1) throw new Error(`expected one YouTube ingestion request, got ${transcriptCalls.length}`)
  } finally {
    restore()
    resetWorkspaceUrlContentCacheForTests()
  }
}

export async function testWorkspaceImportUrlExportsEligibleShareArtifactsIntoDocsRoot(): Promise<void> {
  const shareUrl = 'https://dr.miromind.ai/share/c753877f-7480-4e76-bf75-89fe18358943'
  const exportToken = 'c753877f-7480-4e76-bf75-89fe18358943'
  const previousChatLogAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT
  const previousDocsAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'workspace-import-share-'))
  try {
    process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = `${tempRoot}/docs`
    process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT = `${tempRoot}/chat-log`
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()
    const result = await importWorkspaceUrl({
      fs,
      urlRaw: shareUrl,
      parentPath: '/',
      fetchUrlContent: async url => ({
        normalizedUrl: url,
        name: `${exportToken}.md`,
        text: [
          '---',
          `kgWebpageUrl: "${url}"`,
          'kgWebpageView: "markdown"',
          '---',
          '',
          '# MiroMind Share',
          '',
          'Analyze recent oil market reports from major institutions like Goldman Sachs and UBS. Identify a shared logical blind spot. Based on this flaw, re-simulate the global oil price trajectory for the next six months. Show thinking trajectory Summary',
          '',
          '## Shared logical blind spot',
          '',
          'Goldman Sachs and UBS stay visible in the imported report body.',
          '',
          '[1] Goldman Sachs raises 2026 Brent average price forecast by $8 to $85 a barrel. https://www.reuters.com/business/energy/goldman-sachs-raises-2026-brent-crude-average-price-forecast/',
          '',
        ].join('\n'),
      }),
    })
    if (result.createdPaths.length !== 1 || result.createdPaths[0] !== `/docs_/${exportToken}/${exportToken}.md`) {
      throw new Error(`expected primary import path only, got ${JSON.stringify(result.createdPaths)}`)
    }
    const exported = await fs.readFileText(`/docs_/${exportToken}/${exportToken}.md`)
    const thinking = await fs.readFileText(`/docs_/${exportToken}/${exportToken}-thinking.md`)
    const duplicateRootMarkdown = await fs.readFileText(`/${exportToken}.md`)
    const duplicateRootThinking = await fs.readFileText(`/${exportToken}-thinking.md`)
    if (!exported?.includes(`kgWebpageUrl: "${shareUrl}"`)) {
      throw new Error('expected share markdown export to preserve the imported share URL')
    }
    if (
      !thinking?.includes('## Prompt')
      || !thinking?.includes('## Query Relevance')
      || !thinking?.includes('## Thinking Trajectory')
      || !thinking?.includes('## Thinking Process')
      || !thinking?.includes('## Searching For')
      || !thinking?.includes('## Run Code')
      || !thinking?.includes('## Workspace Output Snapshot')
      || !thinking?.includes('## Stream-Aligned Output')
      || !thinking?.includes('Execution trace summary derived from the imported share prompt, recovered report content, and canonical Import URL artifact export.')
      || !thinking?.includes('Analyze recent oil market reports from major institutions like Goldman Sachs and UBS.')
      || !thinking?.includes('fetch_url:')
      || !thinking?.includes('search: Analyze recent oil market reports')
      || !thinking?.includes('tool_call: writeWorkspaceFileTextEnsuringFile')
      || !thinking?.includes('Heading: Shared logical blind spot')
      || !thinking?.includes('Now I can write the final answer.')
      || thinking.includes('Goldman Sachs, UBS, and six-month oil price trajectory')
    ) {
      throw new Error('expected import-side share thinking export to match the high-fidelity shared thinking document structure')
    }
    if (duplicateRootMarkdown !== null || duplicateRootThinking !== null) {
      throw new Error('expected share import to avoid duplicate root-level markdown or thinking artifacts')
    }
    const hostMarkdown = await readFile(path.join(tempRoot, 'docs_', exportToken, `${exportToken}.md`), 'utf8')
    const hostThinking = await readFile(path.join(tempRoot, 'docs_', exportToken, `${exportToken}-thinking.md`), 'utf8')
    if (!hostMarkdown.includes(`kgWebpageUrl: "${shareUrl}"`)) {
      throw new Error('expected host docs_ markdown mirror for imported share URLs')
    }
    if (!hostThinking.includes('## Run Code')) {
      throw new Error('expected host docs_ thinking mirror for imported share URLs')
    }
  } finally {
    if (typeof previousDocsAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = previousDocsAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    if (typeof previousChatLogAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT = previousChatLogAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT
    await rm(tempRoot, { recursive: true, force: true })
  }
}

export function testWorkspaceImportShareExportRootSettingNormalizesSiblingAbsolutePath(): void {
  const { restore } = initJsdomHarness()
  const previousDocsAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
  const previousValue = readWorkspaceImportShareExportRootPathSetting()
  try {
    process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = '/Users/huijoohwee/Documents/GitHub/huijoohwee/docs'
    writeWorkspaceImportShareExportRootPathSetting('/Users/huijoohwee/Documents/GitHub/huijoohwee/docs_')
    const normalized = readWorkspaceImportShareExportRootPathSetting()
    if (normalized !== '/docs_') {
      throw new Error(`expected sibling absolute docs_ path to normalize to workspace root /docs_, got ${normalized}`)
    }
  } finally {
    writeWorkspaceImportShareExportRootPathSetting(previousValue)
    if (typeof previousDocsAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = previousDocsAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    restore()
  }
}

export async function testWorkspaceImportUrlUsesConfiguredShareExportRootSetting(): Promise<void> {
  const { restore } = initJsdomHarness()
  const shareUrl = 'https://dr.miromind.ai/share/c753877f-7480-4e76-bf75-89fe18358943'
  const exportToken = 'c753877f-7480-4e76-bf75-89fe18358943'
  const previousChatLogAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT
  const previousDocsAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
  const previousValue = readWorkspaceImportShareExportRootPathSetting()
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'workspace-import-share-custom-root-'))
  try {
    process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = `${tempRoot}/docs`
    process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT = `${tempRoot}/chat-log`
    writeWorkspaceImportShareExportRootPathSetting('/import-share-artifacts')
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()
    await importWorkspaceUrl({
      fs,
      urlRaw: shareUrl,
      parentPath: '/',
      fetchUrlContent: async url => ({
        normalizedUrl: url,
        name: 'miromind-share.md',
        text: [
          '---',
          `kgWebpageUrl: "${url}"`,
          'kgWebpageView: "markdown"',
          '---',
          '',
          '# MiroMind Share',
          '',
          'Configured export root should win.',
          '',
        ].join('\n'),
      }),
    })
    const exported = await fs.readFileText(`/import-share-artifacts/${exportToken}/${exportToken}.md`)
    if (!exported?.includes('Configured export root should win.')) {
      throw new Error('expected import share artifacts to honor the configured export root setting')
    }
  } finally {
    writeWorkspaceImportShareExportRootPathSetting(previousValue)
    if (typeof previousDocsAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = previousDocsAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    if (typeof previousChatLogAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT = previousChatLogAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT
    await rm(tempRoot, { recursive: true, force: true })
    restore()
  }
}

export async function testWorkspaceImportApplyPolicyIgnoresBodyOnlyCanvasWords(): Promise<void> {
  const transcriptText = [
    '---',
    'kgYoutubeVideoId: "neutralVideoId"',
    'kgYoutubeFormat: "markdown"',
    '---',
    '',
    '# Transcript',
    '',
    'The spoken transcript can contain YAML-looking words.',
    'flow:',
    'widget_bundle:',
    '$schema: "kgc-pipeline/v1"',
    '',
  ].join('\n')
  if (shouldApplyImportedCanvasDocumentToGraph({ path: '/youtube-transcript.md', text: transcriptText })) {
    throw new Error('expected import graph-apply policy to inspect only the frontmatter header')
  }

  const canvasText = [
    '---',
    'flow:',
    '  nodes: []',
    '---',
    '',
    '# Canvas document',
    '',
  ].join('\n')
  if (!shouldApplyImportedCanvasDocumentToGraph({ path: '/canvas.md', text: canvasText })) {
    throw new Error('expected frontmatter flow documents to apply to graph')
  }
}

export async function testWorkspaceImportToCanvasRespectsApplyToGraphFalseForTranscripts(): Promise<void> {
  const prevSourceFiles = useGraphStore.getState().sourceFiles
  try {
    useGraphStore.getState().setSourceFiles([])
    const fs = createMemoryWorkspaceFs({
      initialEntries: [
        { path: '/', parentPath: null, kind: 'folder', name: '', updatedAtMs: 1 },
        {
          path: '/youtube-transcript.md',
          parentPath: '/',
          kind: 'file',
          name: 'youtube-transcript.md',
          text: '# Transcript\n\nTranscript body.',
          updatedAtMs: 2,
        },
      ],
    })
    const result = await applyWorkspaceImportToCanvas({
      fs,
      createdPaths: ['/youtube-transcript.md' as never],
      opts: { applyToGraph: false },
    })
    if (result.parsedCount !== 0) throw new Error(`expected no parser work when applyToGraph=false, got ${result.parsedCount}`)
    const file = useGraphStore.getState().sourceFiles.find(item => item.name === 'youtube-transcript.md')
    if (!file) throw new Error('expected imported transcript to stay visible in Source Files')
    if (file.status === 'parsed' || file.status === 'error') {
      throw new Error(`expected transcript Source File to avoid auto-parse status churn, got ${String(file.status)}`)
    }
  } finally {
    useGraphStore.getState().setSourceFiles(prevSourceFiles)
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

export async function testWorkspaceImportUrlImportRecoversJsRenderedContentViaDomExportFallback(): Promise<void> {
  resetWorkspaceUrlContentCacheForTests()
  const url = 'https://example.com/shared-report'
  const shellHtml = [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<title>Shared Report</title>',
    ...Array.from({ length: 24 }, (_, index) => `<script>window.__shell_${index}=true;</script>`),
    '</head>',
    '<body>',
    '<div class="banner">Get App</div>',
    '<div id="__next">Loading shared report...</div>',
    '</body>',
    '</html>',
  ].join('')
  const recoveredTitle = 'Shared Oil Report'
  const recoveredParagraphs = Array.from({ length: 8 }, (_, index) =>
    `Supporting section ${index + 1} expands the report with source-visible details about price floors, shipping risk, inventory lag, and transition feedback loops.`,
  )
  const recoveredText = [
    recoveredTitle,
    '',
    'Analyze recent oil market reports from major institutions like Goldman Sachs and UBS.',
    '',
    'Identify a shared logical blind spot and re-simulate the next six-month trajectory.',
    '',
    ...recoveredParagraphs,
  ].join('\n')
  const recoveredHtml = [
    '<!doctype html>',
    '<html>',
    '<head>',
    `<title>${recoveredTitle}</title>`,
    '</head>',
    '<body>',
    `<main><h1>${recoveredTitle}</h1><p>Analyze recent oil market reports from major institutions like Goldman Sachs and UBS.</p><p>Identify a shared logical blind spot and re-simulate the next six-month trajectory.</p>${recoveredParagraphs.map(paragraph => `<p>${paragraph}</p>`).join('')}</main>`,
    '</body>',
    '</html>',
  ].join('')
  const proxyCalls: string[] = []
  const domModes: string[] = []
  const restore = installWebpageProxyFetch(new Map([[url, shellHtml]]), proxyCalls)
  setWorkspaceWebpageDomExportForTests(async args => {
    domModes.push(String(args.mode || ''))
    if (args.mode === 'html') {
      return { text: recoveredHtml, title: recoveredTitle, clipped: false }
    }
    return { text: recoveredText, title: recoveredTitle, clipped: false }
  })
  try {
    const res = await fetchWorkspaceUrlContent(url, { mode: 'import' })
    if (isFrontmatterOnlyDoc(res.text)) {
      throw new Error('expected import fallback to recover non-empty DOM-rendered content')
    }
    if (!res.text.includes('Goldman Sachs and UBS')) {
      throw new Error('expected import fallback to preserve the DOM-rendered report body')
    }
    if (!res.text.includes('logical blind spot')) {
      throw new Error('expected import fallback to preserve later DOM-rendered report sections')
    }
    if (res.text.includes('Loading shared report')) {
      throw new Error('expected DOM export fallback to replace raw app-shell placeholder text')
    }
    if (!proxyCalls.some(call => call.startsWith('/__webpage_proxy?'))) {
      throw new Error('expected shared webpage proxy fetch before DOM export fallback')
    }
    if (!domModes.includes('html')) {
      throw new Error(`expected DOM export fallback to probe the hydrated html mode, got ${JSON.stringify(domModes)}`)
    }
  } finally {
    setWorkspaceWebpageDomExportForTests(null)
    restore()
    resetWorkspaceUrlContentCacheForTests()
  }
}

export async function testWorkspaceImportUrlImportRecoversLongLoadingShellViaDomExportFallback(): Promise<void> {
  resetWorkspaceUrlContentCacheForTests()
  const url = 'https://example.com/shared-conversation'
  const shellLinks = Array.from(
    { length: 60 },
    (_, index) => `<a href="/shortcut-${index + 1}">Open App Shortcut ${index + 1}</a>`,
  ).join('')
  const shellHtml = [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<title>Shared Conversation</title>',
    '</head>',
    '<body>',
    '<header><a href="/app">Get App</a><a href="/sign-in">Sign in</a><a href="/install">Install App</a></header>',
    '<main>',
    '<h1>Shared Conversation</h1>',
    '<p>Loading shared chat...</p>',
    `<nav>${shellLinks}</nav>`,
    '</main>',
    '</body>',
    '</html>',
  ].join('')
  const recoveredText = [
    'Shared Conversation Analysis',
    '',
    'This imported body preserves the substantive discussion after the live share finishes hydrating.',
    '',
    'It includes the longer paragraphs that should replace the loading shell and shortcut chrome.',
    '',
    ...Array.from({ length: 6 }, (_, index) => `Detailed section ${index + 1} captures the underlying report body with concrete evidence and reasoning.`),
  ].join('\n')
  const recoveredHtml = [
    '<!doctype html>',
    '<html>',
    '<head><title>Shared Conversation Analysis</title></head>',
    '<body>',
    '<main>',
    '<h1>Shared Conversation Analysis</h1>',
    '<p>This imported body preserves the substantive discussion after the live share finishes hydrating.</p>',
    '<p>It includes the longer paragraphs that should replace the loading shell and shortcut chrome.</p>',
    ...Array.from({ length: 6 }, (_, index) => `<p>Detailed section ${index + 1} captures the underlying report body with concrete evidence and reasoning.</p>`),
    '</main>',
    '</body>',
    '</html>',
  ].join('')
  const proxyCalls: string[] = []
  const domModes: string[] = []
  const restore = installWebpageProxyFetch(new Map([[url, shellHtml]]), proxyCalls)
  setWorkspaceWebpageDomExportForTests(async args => {
    domModes.push(String(args.mode || ''))
    if (args.mode === 'html') return { text: recoveredHtml, title: 'Shared Conversation Analysis', clipped: false }
    return { text: recoveredText, title: 'Shared Conversation Analysis', clipped: false }
  })
  try {
    const res = await fetchWorkspaceUrlContent(url, { mode: 'import' })
    if (!res.text.includes('substantive discussion after the live share finishes hydrating')) {
      throw new Error('expected long loading-shell imports to recover the hydrated report body')
    }
    if (res.text.includes('Loading shared chat')) {
      throw new Error('expected long loading-shell imports to replace the loading placeholder text')
    }
    if (!proxyCalls.some(call => call.startsWith('/__webpage_proxy?'))) {
      throw new Error('expected long loading-shell import to probe the shared webpage proxy first')
    }
    if (!domModes.includes('html')) {
      throw new Error(`expected long loading-shell fallback to probe the hydrated html mode, got ${JSON.stringify(domModes)}`)
    }
  } finally {
    setWorkspaceWebpageDomExportForTests(null)
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
