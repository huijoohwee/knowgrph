import { fetchWorkspaceUrlContent } from '@/features/markdown-workspace/workspaceImport'
import { isFrontmatterOnlyDoc } from '@/lib/markdown/frontmatter'
import { buildWebpageWorkspaceEntryTextFromUpstreamMarkdown } from '@/features/markdown-workspace/workspaceImport'
import { resetWorkspaceUrlContentCacheForTests } from '@/features/markdown-workspace/workspaceImport/urlContentCache'

export const testImportUrlWebpageCreatesHtmlFrontmatterStub = async () => {
  resetWorkspaceUrlContentCacheForTests()
  const res = await fetchWorkspaceUrlContent('https://grapesjs.com/pricing')
  if (!res || typeof res.text !== 'string') throw new Error('missing content')
  const text = res.text
  if (!text.includes('kgWebpageUrl:')) throw new Error('missing kgWebpageUrl')
  if (!text.includes('kgWebpageView:')) throw new Error('missing kgWebpageView')
  if (!/kgWebpageView:\s*"html"/i.test(text) && !/kgWebpageView:\s*html/i.test(text)) {
    throw new Error('expected kgWebpageView to be html')
  }
  const body = text.replace(/^---[\s\S]*?\n---\n?/m, '')
  if (!body.includes('https://grapesjs.com/pricing')) throw new Error('expected stub body to include the webpage URL')
}

export const testImportUrlWebpageRefreshUsesSourceFaithfulForMultipleUrls = async () => {
  resetWorkspaceUrlContentCacheForTests()
  const urls = [
    'https://grapesjs.com/pricing',
    'https://example.com/',
    'https://api.byteplus.com/api-sdk/view?serviceCode=ecs&version=2020-04-01&language=Python',
  ]

  const htmlBody =
    '<!doctype html><html><head><title>Test Page</title></head><body><h1>Source Faithful Heading</h1><p>First section</p><p>Second section</p></body></html>'

  const g = globalThis as unknown as { fetch?: unknown }
  const prevFetch = g.fetch
  try {
    g.fetch = (async (input: unknown, init?: unknown) => {
      const initObj = init && typeof init === 'object' ? (init as { method?: unknown }) : null
      const methodRaw = initObj?.method
      const method = (typeof methodRaw === 'string' ? methodRaw : 'GET').toUpperCase()
      const res = {
        ok: true,
        status: 200,
        headers: {
          get: () => null,
        },
        text: async () => (method === 'HEAD' ? '' : htmlBody),
      }
      return res as unknown as Response
    }) as unknown

    for (const url of urls) {
      const refreshed = await fetchWorkspaceUrlContent(url, { mode: 'refresh' })
      if (!refreshed || typeof refreshed.text !== 'string') throw new Error('missing refresh content')
      if (refreshed.normalizedUrl !== url) {
        throw new Error(`expected normalizedUrl to equal input URL for refresh: ${url}`)
      }
      if (!refreshed.name || !refreshed.name.endsWith('.md')) {
        throw new Error(`expected refresh mode to derive a .md file name for URL: ${url}`)
      }
      const text = refreshed.text
      if (isFrontmatterOnlyDoc(text)) {
        throw new Error(`expected non-empty body for URL: ${url}`)
      }
      const body = text.replace(/^---[\s\S]*?\n---\n?/m, '')
      if (!body.includes('Source Faithful Heading')) {
        throw new Error(`expected HTML-derived heading in body for URL: ${url}`)
      }
    }
  } finally {
    g.fetch = prevFetch
  }
}

export async function testImportUrlWebpagePostprocessCoalescesNavAndAvoidsSyntheticArtifacts() {
  resetWorkspaceUrlContentCacheForTests()
  const upstream = [
    '# Canvas Studio',
    '',
    '<section style="display:grid;grid-template-columns:repeat(6, minmax(0, 1fr));gap:8px">',
    '<a href="/">Studio Home</a>',
    '<a href="/downloads">Downloads</a>',
    '<a href="/pricing">Pricing</a>',
    '<a href="/gallery">Prompt Gallery</a>',
    '<a href="/docs">Docs</a>',
    '<a href="/download">Download Studio</a>',
    '</section>',
    '',
    'Backed by',
    '',
    'Dream on canvas.',
    'Land in code.',
    '',
    'This is the real magic. You can plug in the whole world of MCPs, bring in data from other sources like databases, APIs, chart data, Playwright/Puppeteer, or plug in other agents easily. You’re in charge!',
    '',
  ].join('\n')

  const doc = buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
    upstreamMarkdown: upstream,
    url: 'https://canvas.example/',
    view: 'markdown',
    scriptPolicy: 'allow',
    fidelityLevel: 4,
    includeImages: false,
  })

  if (!doc.includes('| [Studio Home](/) | [Downloads](/downloads) | [Pricing](/pricing) |')) {
    throw new Error('expected nav links to be coalesced into a markdown table')
  }
  if (doc.includes('\n### Icons\n') || doc.includes('\n### Icons\r\n')) {
    throw new Error('expected no synthetic Icons section')
  }
  if (!doc.includes('Backed by')) throw new Error('expected body copy preserved')
  if (!doc.includes('Dream on canvas.')) throw new Error('expected tagline preserved')
  if (!doc.includes('Land in code.')) throw new Error('expected tagline preserved')
  if (!doc.includes('This is the real magic.')) throw new Error('expected long paragraph preserved')
  if (isFrontmatterOnlyDoc(doc)) throw new Error('expected non-empty markdown body')
}

export const testImportUrlSubstackDefaultsToMarkdownViewAndHasBody = async () => {
  resetWorkspaceUrlContentCacheForTests()
  const url = 'https://www.citriniresearch.com/p/2028gic'
  const htmlBody = [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<title>THE 2028 GLOBAL INTELLIGENCE CRISIS</title>',
    '<script src="https://substackcdn.com/bundle.js"></script>',
    '</head>',
    '<body>',
    '<h1>THE 2028 GLOBAL INTELLIGENCE CRISIS</h1>',
    '<p>Intro paragraph</p>',
    '</body>',
    '</html>',
  ].join('')

  const g = globalThis as unknown as { fetch?: unknown }
  const prevFetch = g.fetch
  try {
    g.fetch = (async (_input: unknown, init?: unknown) => {
      const initObj = init && typeof init === 'object' ? (init as { method?: unknown }) : null
      const methodRaw = initObj?.method
      const method = (typeof methodRaw === 'string' ? methodRaw : 'GET').toUpperCase()
      const res = {
        ok: true,
        status: 200,
        headers: {
          get: () => null,
        },
        text: async () => (method === 'HEAD' ? '' : htmlBody),
      }
      return res as unknown as Response
    }) as unknown

    const imported = await fetchWorkspaceUrlContent(url, { mode: 'import' })
    if (!imported || typeof imported.text !== 'string') throw new Error('missing import content')
    if (!imported.text.includes(`kgWebpageUrl: "${url}"`)) throw new Error('expected kgWebpageUrl to be present')
    if (!imported.text.includes('kgWebpageView: "markdown"')) {
      throw new Error('expected Substack import to default to markdown view')
    }
    if (isFrontmatterOnlyDoc(imported.text)) throw new Error('expected Substack import to include markdown body')
    if (!imported.text.includes('THE 2028 GLOBAL INTELLIGENCE CRISIS')) {
      throw new Error('expected converted markdown to include the article title')
    }
  } finally {
    g.fetch = prevFetch
  }
}
