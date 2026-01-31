import fs from 'node:fs'
import path from 'node:path'
import { performYouTubeImport } from '@/features/toolbar/youtubeImportAction'
import { useGraphStore } from '@/hooks/useGraphStore'
import { determineLayoutPositions } from '@/components/GraphCanvas/layout/positioning'
import { normalizeEdgesForSim } from '@/components/GraphCanvas/utils'

type FetchResponseStub = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

function buildForbiddenYoutubeUrl(): string {
  const codes = [
    104, 116, 116, 112, 115, 58, 47, 47, 121, 111,
    117, 116, 117, 46, 98, 101, 47, 112, 69, 102,
    114, 100, 65, 116, 65, 109, 113, 107, 63, 115,
    105, 61, 100, 70, 117, 71, 55, 114, 69, 117,
    122, 97, 117, 97, 107, 116, 66, 114,
  ]
  return String.fromCharCode(...codes)
}

function collectTextFiles(rootDir: string): string[] {
  const out: string[] = []
  const stack: string[] = [rootDir]
  const ignoredDirnames = new Set([
    '.git',
    'node_modules',
    'dist',
    'build',
    '.next',
    '.turbo',
    '.cache',
    '.venv',
    'venv',
    '__pycache__',
  ])
  const allowedExt = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.py', '.md', '.yaml', '.yml'])

  while (stack.length > 0) {
    const dir = stack.pop()
    if (!dir) continue
    let entries: fs.Dirent[] = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (ignoredDirnames.has(entry.name)) continue
        stack.push(full)
        continue
      }
      if (!entry.isFile()) continue
      const ext = path.extname(entry.name).toLowerCase()
      if (!allowedExt.has(ext)) continue
      out.push(full)
    }
  }

  return out
}

export async function testForbidHardcodedYouTubeUrlLiteral() {
  const forbidden = buildForbiddenYoutubeUrl()
  const repoRoot = path.resolve(process.cwd(), '..')
  const files = collectTextFiles(repoRoot)
  const matches: string[] = []

  for (const filePath of files) {
    let text = ''
    try {
      const stat = fs.statSync(filePath)
      if (stat.size > 2_000_000) continue
      text = fs.readFileSync(filePath, { encoding: 'utf8' })
    } catch {
      continue
    }
    if (text.includes(forbidden)) {
      matches.push(path.relative(repoRoot, filePath))
      if (matches.length >= 20) break
    }
  }

  if (matches.length > 0) {
    throw new Error(`Forbidden YouTube URL literal found in: ${matches.join(', ')}`)
  }
}

export async function testYouTubeImportPopulatesMarkdownAndJsonEditors() {
  const g = globalThis as unknown as { fetch?: unknown }
  const prevFetch = g.fetch

  const fakeId = 'a1b2c3d4e5F'
  const watchUrl = `https://www.youtube.com/watch?v=${fakeId}&si=abc123&t=146`
  const wrappedInput = `\`(${watchUrl}).\``
  const sourceUrl = `https://youtu.be/${fakeId}?t=146`
  const transcript = {
    ok: true,
    type: 'rag:YouTubeTranscript',
    title: 'Example Title',
    video_id: fakeId,
    source_url: sourceUrl,
    requested_language_code: 'en',
    requested_language: 'en',
    requested_languages: ['en'],
    requested_start_s: 146,
    selected_language_code: 'en',
    selected_language: 'en',
    is_generated: true,
    is_translatable: false,
    translation_languages: [],
    oembed: { title: 'Example Title', provider_name: 'YouTube' },
    start_s: 0.0,
    end_s: 2.3,
    duration_s: 2.3,
    segment_count: 2,
    generated_at_ms: 123,
    segments: [
      { text: 'Hello there.', start: 0.0, duration: 1.0 },
      { text: 'General Kenobi.', start: 1.1, duration: 1.2 },
    ],
  }

  const markdown = `# ${transcript.title}\n\nVideo ID: ${fakeId}\nSource: [${transcript.source_url}](${transcript.source_url})\n\nHello there.\n\nGeneral Kenobi.\n`

  g.fetch = (async (input: unknown) => {
    const url = typeof input === 'string' ? input : ''
    if (url.includes(`/__youtube_transcript?url=${encodeURIComponent(watchUrl)}`)) {
      const response: FetchResponseStub = {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, markdown, name: `youtube-${fakeId}.md`, transcript }),
      }
      return response as unknown as Response
    }
    if (url.startsWith('http://localhost:1234/v1/chat/completions')) {
      const response: FetchResponseStub = {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Hello there.\n\nGeneral Kenobi.',
              },
            },
          ],
        }),
      }
      return response as unknown as Response
    }
    throw new Error(`Unexpected fetch url: ${url}`)
  }) as unknown as typeof fetch

  const state = useGraphStore.getState()
  state.setMarkdownDocument(null, null)
  state.setJsonSourceDocument(null, null)
  state.setMarkdownDocumentSourceUrl(null)
  state.setBottomPanelCurationView('grid')

  try {
    await performYouTubeImport('url', wrappedInput)
  } finally {
    g.fetch = prevFetch
  }

  const next = useGraphStore.getState()
  if (next.bottomPanelCurationView !== 'markdown') {
    throw new Error(`Expected bottomPanelCurationView=markdown, got ${String(next.bottomPanelCurationView)}`)
  }
  if (!next.markdownDocumentText || !next.markdownDocumentText.includes(fakeId)) {
    throw new Error('Expected markdownDocumentText to be populated with transcript markdown')
  }
  if (next.markdownDocumentSourceUrl !== sourceUrl) {
    throw new Error(
      `Expected markdownDocumentSourceUrl to be ${sourceUrl}, got ${String(next.markdownDocumentSourceUrl)}`,
    )
  }
  if (!next.jsonSourceDocumentText) {
    throw new Error('Expected jsonSourceDocumentText to be populated with transcript JSON')
  }
  try {
    const parsed = JSON.parse(next.jsonSourceDocumentText) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Transcript JSON did not parse to an object')
    }
    const obj = parsed as Record<string, unknown>
    if (obj.video_id !== fakeId) throw new Error('Transcript JSON missing video_id')
    if (typeof obj.title !== 'string' || !(obj.title as string).trim()) throw new Error('Transcript JSON missing title')
    if (!Array.isArray(obj.segments) || obj.segments.length !== 2) throw new Error('Transcript JSON missing segments')
    const requiredKeys = [
      'title',
      'video_id',
      'source_url',
      'requested_language_code',
      'requested_language',
      'selected_language_code',
      'selected_language',
      'is_generated',
      'is_translatable',
      'translation_languages',
      'oembed',
      'start_s',
      'end_s',
      'duration_s',
      'segment_count',
      'generated_at_ms',
      'segments',
    ]
    for (const key of requiredKeys) {
      if (!(key in obj)) throw new Error(`Transcript JSON missing key: ${key}`)
    }
    const segments = obj.segments as unknown
    if (!Array.isArray(segments)) throw new Error('Transcript JSON segments is not an array')
    for (const s of segments) {
      if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error('Transcript JSON segment is not an object')
      const seg = s as Record<string, unknown>
      if (typeof seg.text !== 'string' || !seg.text.trim()) throw new Error('Transcript JSON segment missing text')
      if (typeof seg.start !== 'number' || !Number.isFinite(seg.start)) throw new Error('Transcript JSON segment missing start')
      if (typeof seg.duration !== 'number' || !Number.isFinite(seg.duration)) throw new Error('Transcript JSON segment missing duration')
    }
  } catch (e) {
    throw new Error(`Transcript JSON invalid: ${String(e)}`)
  }

  const graphData = next.graphData
  if (!graphData) {
    throw new Error('Expected graphData to be set after YouTube import')
  }
  if (!Array.isArray(graphData.nodes) || graphData.nodes.length === 0) {
    throw new Error('Expected graphData.nodes to be populated after YouTube import')
  }
  if (!Array.isArray(graphData.edges)) {
    throw new Error('Expected graphData.edges to be an array after YouTube import')
  }

  const edgesForSim = normalizeEdgesForSim(graphData.nodes, graphData.edges)
  if (!Array.isArray(edgesForSim)) {
    throw new Error('Expected normalizeEdgesForSim to return an array')
  }

  const layoutMode = next.schema?.layout?.mode === 'radial' ? 'radial' : 'force'
  const renderMode = next.canvasRenderMode === '3d' ? '3d' : '2d'
  const layout = determineLayoutPositions({
    mode: layoutMode,
    frontmatterMode: !!next.frontmatterModeEnabled,
    semanticMode: String(next.documentSemanticMode || 'document'),
    renderMode,
    renderVariant: renderMode === '2d' ? String(next.canvas2dRenderer || 'd3') : '',
    prevMode: null,
    prevFrontmatterMode: null,
    prevSemanticMode: null,
    prevRenderMode: null,
    nodes: graphData.nodes,
    layoutPositionCacheByMode: next.layoutPositionCacheByMode || null,
  })
  if (!layout || typeof layout.cacheKey !== 'string' || !layout.cacheKey.trim()) {
    throw new Error('Expected determineLayoutPositions to return a non-empty cacheKey')
  }
}
