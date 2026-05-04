import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { importWorkspaceUrl } from '@/features/markdown-workspace/workspaceImport'

type MockRoute = { test: (url: string) => boolean; handler: (url: string, init?: RequestInit) => Response | Promise<Response> }

const jsonResponse = (obj: unknown, status: number = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

const textResponse = (text: string, status: number = 200) =>
  new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': String(text.length) } })

const decodeProxyUrl = (url: string): string => {
  if (!url.startsWith('/__fetch_remote')) return url
  const q = url.split('?')[1] || ''
  const pairs = q.split('&').map(p => p.split('='))
  const urlParam = pairs.find(([k]) => k === 'url')?.[1] || ''
  return decodeURIComponent(urlParam)
}

export async function testWorkspaceImportGitHubRepoImportsFiles() {
  const { restore } = initJsdomHarness()
  const g = globalThis as typeof globalThis & { fetch?: typeof fetch }
  const originalFetch = g.fetch

  try {
    const routes: MockRoute[] = [
      {
        test: u => u === 'https://api.github.com/repos/Comfy-Org/ComfyUI',
        handler: () => jsonResponse({ default_branch: 'master' }),
      },
      {
        test: u => u === 'https://api.github.com/repos/Comfy-Org/ComfyUI/git/refs/heads/master',
        handler: () => jsonResponse({ object: { sha: 'commit-sha-1' } }),
      },
      {
        test: u => u === 'https://api.github.com/repos/Comfy-Org/ComfyUI/git/commits/commit-sha-1',
        handler: () => jsonResponse({ tree: { sha: 'tree-sha-1' } }),
      },
      {
        test: u => u === 'https://api.github.com/repos/Comfy-Org/ComfyUI/git/trees/tree-sha-1?recursive=1',
        handler: () =>
          jsonResponse({
            truncated: false,
            tree: [
              { path: 'README.md', type: 'blob' },
              { path: 'web/README.md', type: 'blob' },
              { path: 'assets/logo.png', type: 'blob' },
              { path: 'web', type: 'tree' },
            ],
          }),
      },
      {
        test: u => u === 'https://raw.githubusercontent.com/Comfy-Org/ComfyUI/master/README.md',
        handler: (_u, init) => (String(init?.method || 'GET').toUpperCase() === 'HEAD' ? textResponse('', 200) : textResponse('# Root Readme\n')),
      },
      {
        test: u => u === 'https://raw.githubusercontent.com/Comfy-Org/ComfyUI/master/web/README.md',
        handler: (_u, init) => (String(init?.method || 'GET').toUpperCase() === 'HEAD' ? textResponse('', 200) : textResponse('# Web Readme\n')),
      },
    ]

    g.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const url = decodeProxyUrl(raw)
      const route = routes.find(r => r.test(url))
      if (route) return route.handler(url, init)
      return new Response('not found', { status: 404 })
    }) as typeof fetch

    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const res = await importWorkspaceUrl({
      fs,
      urlRaw: 'https://github.com/Comfy-Org/ComfyUI',
      parentPath: '/',
    })

    if (res.createdPaths.length < 2) throw new Error(`expected at least 2 imported files, got ${res.createdPaths.length}`)

    const entries = await fs.listEntries()
    const sitemap = entries.find(e => e.kind === 'file' && e.name === 'repo.sitemap.md')
    const journey = entries.find(e => e.kind === 'file' && e.name === 'repo.user-journey.md')
    const readme = entries.find(e => e.kind === 'file' && e.name === 'README.md')
    const webReadme = entries.find(e => e.kind === 'file' && e.name === 'README.md' && String(e.path || '').includes('/web/'))
    if (!sitemap) throw new Error('expected repo.sitemap.md to be generated')
    if (!journey) throw new Error('expected repo.user-journey.md to be generated')
    if (!readme || !webReadme) throw new Error('expected README.md and web/README.md to be imported')
  } finally {
    if (originalFetch) g.fetch = originalFetch
    restore()
  }
}

export async function testWorkspaceImportGitHubRepoSitemapHasTemplatesAndStats() {
  const { restore } = initJsdomHarness()
  const g = globalThis as typeof globalThis & { fetch?: typeof fetch }
  const originalFetch = g.fetch

  const readme = [
    '# ComfyUI',
    '',
    'Nodes/graph/flowchart interface to experiment and create complex workflows.',
    '',
    '## Image Models',
    '- SD1.x',
    '- SD2.x',
    '- SDXL',
    '- SDXL Turbo',
    '- Stable Cascade',
    '- SD3',
    '',
    '## Video Models',
    '- Stable Video Diffusion',
    '- Mochi',
    '- LTX-Video',
    '- Hunyuan Video',
    '- Wan 2.2',
    '- Hunyuan Video 1.5',
    '',
    '## Shortcuts',
    '- Ctrl + Enter',
    '- Ctrl + Shift + Enter',
    '- Ctrl + S',
    '- Ctrl + O',
    '- Space',
    '- R',
    '',
  ].join('\n')

  try {
    const routes: MockRoute[] = [
      {
        test: u => u === 'https://api.github.com/repos/Comfy-Org/ComfyUI',
        handler: () => jsonResponse({ default_branch: 'master', full_name: 'Comfy-Org/ComfyUI', description: 'Graph-based diffusion UI.' }),
      },
      {
        test: u => u === 'https://api.github.com/repos/Comfy-Org/ComfyUI/git/refs/heads/master',
        handler: () => jsonResponse({ object: { sha: 'commit-sha-1' } }),
      },
      {
        test: u => u === 'https://api.github.com/repos/Comfy-Org/ComfyUI/git/commits/commit-sha-1',
        handler: () => jsonResponse({ tree: { sha: 'tree-sha-1' } }),
      },
      {
        test: u => u === 'https://api.github.com/repos/Comfy-Org/ComfyUI/git/trees/tree-sha-1?recursive=1',
        handler: () =>
          jsonResponse({
            truncated: false,
            tree: [
              { path: 'README.md', type: 'blob' },
              { path: 'web/README.md', type: 'blob' },
              { path: 'web', type: 'tree' },
              { path: 'main.py', type: 'blob' },
            ],
          }),
      },
      {
        test: u => u === 'https://raw.githubusercontent.com/Comfy-Org/ComfyUI/master/README.md',
        handler: (_u, init) => (String(init?.method || 'GET').toUpperCase() === 'HEAD' ? textResponse('', 200) : textResponse(readme)),
      },
      {
        test: u => u === 'https://raw.githubusercontent.com/Comfy-Org/ComfyUI/master/web/README.md',
        handler: (_u, init) => (String(init?.method || 'GET').toUpperCase() === 'HEAD' ? textResponse('', 200) : textResponse('# Web Readme\n')),
      },
      {
        test: u => u === 'https://raw.githubusercontent.com/Comfy-Org/ComfyUI/master/main.py',
        handler: (_u, init) =>
          String(init?.method || 'GET').toUpperCase() === 'HEAD'
            ? textResponse('', 200)
            : textResponse('import server\n\n\ndef main():\n  pass\n'),
      },
    ]

    g.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const url = decodeProxyUrl(raw)
      const route = routes.find(r => r.test(url))
      if (route) return route.handler(url, init)
      return new Response('not found', { status: 404 })
    }) as typeof fetch

    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()
    await importWorkspaceUrl({ fs, urlRaw: 'https://github.com/Comfy-Org/ComfyUI', parentPath: '/' })
    const entries = await fs.listEntries()
    const sitemapPath = entries.find(e => e.kind === 'file' && e.name === 'repo.sitemap.md')?.path || ''
    if (!sitemapPath) throw new Error('expected repo.sitemap.md path')
    const text = await fs.readFileText(sitemapPath)
    if (!text.includes('## 🔝 Header Navigation')) throw new Error('missing header nav section')
    if (!text.includes('## 🎯 Hero Section')) throw new Error('missing hero section')
    if (!text.includes('## 📑 Template Showcase')) throw new Error('missing template showcase')
    if (!text.includes('QUICK START TEMPLATES')) throw new Error('missing template ascii grid')
    if (!text.includes('SDXL')) throw new Error('missing extracted template name')
    if (!text.includes('## ⚡ Feature Sections (Extracted)')) throw new Error('missing feature sections summary')
    if (!text.includes('Section Statistics: Image Models')) throw new Error('missing per-section statistics')

    const journeyPath = entries.find(e => e.kind === 'file' && e.name === 'repo.user-journey.md')?.path || ''
    if (!journeyPath) throw new Error('expected repo.user-journey.md path')
    const journeyText = await fs.readFileText(journeyPath)
    if (!journeyText.includes('## 👥 User Personas')) throw new Error('missing personas section')
    if (!journeyText.includes('## 🗺️ Master User Journey Overview')) throw new Error('missing master journey section')
    if (!journeyText.includes('## 📱 UI Layout & Interaction Map')) throw new Error('missing ui layout section')
    if (!journeyText.includes('## 🎯 Journey 1: First-Time User')) throw new Error('missing journey 1 section')
  } finally {
    if (originalFetch) g.fetch = originalFetch
    restore()
  }
}
