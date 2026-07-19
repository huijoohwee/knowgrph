import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import {
  readWorkspaceImportDefaultSourceUrlSetting,
  writeWorkspaceImportDefaultSourceUrlSetting,
} from '@/lib/workspace/workspaceStoreSyncSettings'
import {
  readWorkspaceInitializationDocsMirrorEntries,
} from '@/features/workspace-fs/workspaceSeedProvider'
import { resetCanonicalAgenticDocsMirrorCacheForTests } from '@/features/workspace-fs/workspaceGithubDocsMirror'
import { readWorkspaceActiveDocumentResolvedText } from '@/features/source-files/sourceFilesRuntimeActive'
import { materializeActiveWorkspaceEntryIntoSourceFiles } from '@/features/source-files/sourceFilesRuntimeMaterialization'
import { mergeWorkspaceEntriesIntoSourceFiles } from '@/features/workspace-fs/syncToSourceFiles'
import {
  normalizeMarkdownWorkspaceDocsSourcePathFromCanonicalPath,
  readStorageCanonicalPathCandidatesForWorkspacePath,
} from '@/features/source-files/sourceFilesStoragePaths'
import type { WorkspaceFs } from '@/features/workspace-fs/types'

type MockRoute = { test: (url: string) => boolean; handler: (url: string, init?: RequestInit) => Response | Promise<Response> }

const KG_GITHUB_ROOT = '/workspace'
const KG_AGENTIC_CANVAS_OS_DOCS_ROOT = `${KG_GITHUB_ROOT}/agentic-canvas-os/docs`

const jsonResponse = (obj: unknown, status: number = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

const textResponse = (text: string, status: number = 200) =>
  new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': String(text.length) },
  })

const binaryResponse = (bytes: Uint8Array, status: number = 200) =>
  new Response(bytes, {
    status,
    headers: { 'Content-Type': 'model/gltf-binary', 'Content-Length': String(bytes.byteLength) },
  })

const decodeProxyUrl = (url: string): string => {
  if (!url.startsWith('/__fetch_remote')) return url
  const q = url.split('?')[1] || ''
  const pairs = q.split('&').map(p => p.split('='))
  const urlParam = pairs.find(([k]) => k === 'url')?.[1] || ''
  return decodeURIComponent(urlParam)
}

export async function testActiveWorkspaceMaterializationReplacesStaleTokenEconomicsSourceText() {
  const { restore } = initJsdomHarness()
  try {
    const targetPath = '/docs/knowgrph-token-economics-model-demo.md'
    const sourcePath = `workspace:${targetPath}`
    const staleText = '# stale token economics\n'
    const remoteText = '# remote token economics\n\nCurrent GitHub docs content wins.\n'

    useGraphStore.getState().resetAll()
    useGraphStore.getState().setSourceFiles([{
      id: 'ws:token-economics',
      name: 'knowgrph-token-economics-model-demo.md',
      text: staleText,
      enabled: true,
      status: 'idle',
      source: { kind: 'local', path: sourcePath },
    }])

    const workspaceEntries = [{
      path: targetPath,
      parentPath: '/docs',
      kind: 'file',
      name: 'knowgrph-token-economics-model-demo.md',
      text: remoteText,
      updatedAtMs: 123,
    }] as Awaited<ReturnType<WorkspaceFs['listEntries']>>

    const fs: WorkspaceFs = {
      ensureSeed: async () => false,
      listEntries: async () => workspaceEntries,
      readFileText: async path => (String(path || '').trim() === targetPath ? remoteText : null),
      writeFileText: async () => void 0,
      createFile: async () => '/docs/tmp.md',
      createFolder: async () => '/docs',
      deleteEntry: async () => void 0,
    }

    await materializeActiveWorkspaceEntryIntoSourceFiles({
      activePathOverride: targetPath,
      fs,
      activeWorkspaceEntriesSnapshot: workspaceEntries,
      applyToGraph: false,
    })

    const active = useGraphStore
      .getState()
      .sourceFiles
      .find(file => String(file.source?.path || '') === sourcePath) || null
    if (!active) throw new Error('expected token economics source file to stay materialized')
    if (active.text !== remoteText) {
      throw new Error(`expected refreshed workspace text to replace stale Source Files text, got ${JSON.stringify(active.text)}`)
    }
  } finally {
    restore()
  }
}

export function testSourceFilesMergeReplacesStaleTextAcrossDocsTree() {
  const workspaceEntries = [
    { path: '/docs/a.md', parentPath: '/docs', kind: 'file', name: 'a.md', text: '# A remote\n', updatedAtMs: 10 },
    { path: '/docs/b.json', parentPath: '/docs', kind: 'file', name: 'b.json', text: '{"remote":true}\n', updatedAtMs: 11 },
    { path: '/docs/empty.md', parentPath: '/docs', kind: 'file', name: 'empty.md', text: '', updatedAtMs: 12 },
    { path: '/docs/model.gltf', parentPath: '/docs', kind: 'file', name: 'model.gltf', text: '{"asset":{"version":"2.0"}}\n', updatedAtMs: 13 },
  ] as Awaited<ReturnType<WorkspaceFs['listEntries']>>
  const existing = workspaceEntries.map((entry, index) => ({
    id: `ws:stale:${index}`,
    name: entry.name,
    text: `stale ${entry.name}`,
    enabled: index === 0,
    status: 'idle' as const,
    source: { kind: 'local' as const, path: `workspace:${entry.path}` },
  }))

  const merged = mergeWorkspaceEntriesIntoSourceFiles({
    existing,
    workspaceEntries,
    sourcesByPath: {},
    preserveExistingWorkspaceEntries: true,
    workspaceDocsOnly: true,
    workspaceSourceRootPaths: ['/docs'],
  })
  const byPath = new Map(merged.map(file => [String(file.source?.path || ''), String(file.text ?? '')]))
  for (const entry of workspaceEntries) {
    const sourcePath = `workspace:${entry.path}`
    if (byPath.get(sourcePath) !== String(entry.text ?? '')) {
      throw new Error(`expected ${sourcePath} Source Files text to match current docs workspace entry`)
    }
  }
}

export async function testWorkspaceSeedProviderGitHubDocsMirrorDefaultSourceWinsOverStaleLocalProjection() {
  const { restore } = initJsdomHarness()
  const g = globalThis as typeof globalThis & { fetch?: typeof fetch }
  const originalFetch = g.fetch
  const previousDocsAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
  const previousDefaultSourceUrl = readWorkspaceImportDefaultSourceUrlSetting()
  let localMirrorReadCount = 0

  try {
    useGraphStore.getState().resetAll()
    resetCanonicalAgenticDocsMirrorCacheForTests()
    process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = KG_AGENTIC_CANVAS_OS_DOCS_ROOT
    writeWorkspaceImportDefaultSourceUrlSetting('')

    const routes: MockRoute[] = [
      {
        test: u => u === '/__kg_fs_list',
        handler: () => {
          localMirrorReadCount += 1
          return jsonResponse({
            ok: true,
            files: [{ relPath: 'alpha.md', text: '# stale local\n', updatedAtMs: 1 }],
          })
        },
      },
      {
        test: u => u === 'https://api.github.com/repos/huijoohwee/agentic-canvas-os/git/refs/heads/main',
        handler: () => jsonResponse({ object: { sha: 'commit-sha-docs' } }),
      },
      {
        test: u => u === 'https://api.github.com/repos/huijoohwee/agentic-canvas-os/git/commits/commit-sha-docs',
        handler: () => jsonResponse({ tree: { sha: 'tree-sha-docs' } }),
      },
      {
        test: u => u === 'https://api.github.com/repos/huijoohwee/agentic-canvas-os/git/trees/tree-sha-docs?recursive=1',
        handler: () =>
          jsonResponse({
            truncated: false,
            tree: [
              { path: 'docs/alpha.md', type: 'blob' },
              { path: 'docs/data.json', type: 'blob' },
              { path: 'docs/model.gltf', type: 'blob' },
              { path: 'docs/model.glb', type: 'blob' },
              { path: 'docs/image.png', type: 'blob' },
              { path: 'content/knowgrph/index.html', type: 'blob' },
            ],
          }),
      },
      {
        test: u => u === 'https://raw.githubusercontent.com/huijoohwee/agentic-canvas-os/main/docs/alpha.md',
        handler: () => textResponse('# remote alpha\n'),
      },
      {
        test: u => u === 'https://raw.githubusercontent.com/huijoohwee/agentic-canvas-os/main/docs/data.json',
        handler: () => textResponse('{"remote":true}\n'),
      },
      {
        test: u => u === 'https://raw.githubusercontent.com/huijoohwee/agentic-canvas-os/main/docs/model.gltf',
        handler: () => textResponse('{"asset":{"version":"2.0"}}\n'),
      },
      {
        test: u => u === 'https://raw.githubusercontent.com/huijoohwee/agentic-canvas-os/main/docs/model.glb',
        handler: () => binaryResponse(new Uint8Array([0, 1, 2, 3])),
      },
    ]

    g.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const url = decodeProxyUrl(raw)
      const route = routes.find(r => r.test(url))
      if (route) return route.handler(url, init)
      return new Response(`not found: ${url}`, { status: 404 })
    }) as typeof fetch

    const mirrored = await readWorkspaceInitializationDocsMirrorEntries({ preferCompleteDataset: true })
    const byPath = new Map(mirrored.map(entry => [entry.relPath, entry.text]))

    if (localMirrorReadCount !== 0) {
      throw new Error('expected canonical Agentic Canvas OS GitHub docs to win before reading a local docs projection')
    }
    if (byPath.get('alpha.md') !== '# remote alpha\n') {
      throw new Error(`expected alpha.md to come from GitHub, got ${String(byPath.get('alpha.md') || '')}`)
    }
    if (byPath.get('data.json') !== '{"remote":true}\n') {
      throw new Error('expected GitHub docs mirror to include supported JSON source files')
    }
    if (byPath.get('model.gltf') !== '{"asset":{"version":"2.0"}}\n') {
      throw new Error('expected GitHub docs mirror to include GLTF source files')
    }
    if (byPath.get('model.glb') !== 'AAECAw==') {
      throw new Error('expected GitHub docs mirror to base64-encode GLB source files')
    }
    if (byPath.has('image.png') || byPath.has('content/knowgrph/index.html')) {
      throw new Error('expected GitHub docs mirror to stay within the configured docs tree and Source Files mirror formats')
    }
    if (mirrored.some(entry => entry.authority !== 'agentic-canvas-os-github')) {
      throw new Error('expected every canonical GitHub entry to carry authoritative tree ownership for stale-file reconciliation')
    }
    if (
      normalizeMarkdownWorkspaceDocsSourcePathFromCanonicalPath('agentic-canvas-os/docs/alpha.md')
      !== 'workspace:/docs/alpha.md'
    ) {
      throw new Error('expected Agentic Canvas OS D1 paths to materialize into the canonical /docs workspace root')
    }
    const canonicalCandidates = readStorageCanonicalPathCandidatesForWorkspacePath('/docs/alpha.md')
    if (canonicalCandidates[0] !== 'agentic-canvas-os/docs/alpha.md') {
      throw new Error(`expected canonical D1 writes to prefer Agentic Canvas OS docs, got ${JSON.stringify(canonicalCandidates)}`)
    }
  } finally {
    resetCanonicalAgenticDocsMirrorCacheForTests()
    writeWorkspaceImportDefaultSourceUrlSetting(previousDefaultSourceUrl)
    if (typeof previousDocsAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = previousDocsAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    if (originalFetch) g.fetch = originalFetch
    restore()
  }
}

export async function testWorkspaceActiveDocumentFallsBackToDocsMirrorWhenPersistedTextIsBlank() {
  const { restore } = initJsdomHarness()
  const g = globalThis as typeof globalThis & { fetch?: typeof fetch }
  const originalFetch = g.fetch
  const previousDocsAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
  const previousDefaultSourceUrl = readWorkspaceImportDefaultSourceUrlSetting()
  const previousStorageBaseUrl = process.env.VITE_KNOWGRPH_STORAGE_BASE_URL

  try {
    useGraphStore.getState().resetAll()
    process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = '/tmp/workspace/docs'
    process.env.VITE_KNOWGRPH_STORAGE_BASE_URL = 'https://storage.example.test'
    writeWorkspaceImportDefaultSourceUrlSetting('')

    const targetPath = '/docs/knowgrph-token-economics-model-demo.md'
    const remoteText = [
      '---',
      'title: "Knowgrph Token Economics Model Demo - Storyboard Widget Cost Driver Ports"',
      '---',
      '',
      '# Knowgrph Token Economics Model Demo',
      '',
      'Canonical docs mirror text must repair a blank persisted workspace row.',
      '',
    ].join('\n')
    let mirrorReadCount = 0
    const capturedUrls: string[] = []

    g.fetch = (async (input: RequestInfo | URL) => {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      capturedUrls.push(raw)
      if (raw.includes('/api/storage/export/')) {
        return jsonResponse({
          ok: true,
          apiVersion: '2026-05-04',
          workspaceId: 'kgws:test',
          exportedAtMs: 1710000005000,
          documents: [],
          documentChunks: [],
          graphSnapshots: [],
        })
      }
      if (raw === '/__kg_fs_list') {
        mirrorReadCount += 1
        return jsonResponse({
          ok: true,
          files: [
            {
              relPath: 'knowgrph-token-economics-model-demo.md',
              text: remoteText,
              updatedAtMs: 123,
            },
          ],
        })
      }
      if (raw === `/@fs/tmp/workspace/docs/${encodeURIComponent('knowgrph-token-economics-model-demo.md')}`) {
        mirrorReadCount += 1
        return textResponse(remoteText)
      }
      return new Response(`not found: ${raw}`, { status: 404 })
    }) as typeof fetch

    const blankPersistedFs: WorkspaceFs = {
      ensureSeed: async () => false,
      listEntries: async () => [{
        path: targetPath,
        parentPath: '/docs',
        kind: 'file',
        name: 'knowgrph-token-economics-model-demo.md',
        text: '',
        updatedAtMs: 1,
      }],
      readFileText: async path => (String(path || '').trim() === targetPath ? '' : null),
      writeFileText: async () => void 0,
      createFile: async () => '/docs/tmp.md',
      createFolder: async () => '/docs',
      deleteEntry: async () => void 0,
    }

    const resolved = await readWorkspaceActiveDocumentResolvedText({
      activePath: targetPath,
      currentText: '',
      fs: blankPersistedFs,
    })

    if (resolved !== remoteText) {
      throw new Error(`expected docs mirror text to repair blank persisted workspace text, got ${JSON.stringify(resolved.slice(0, 120))}; urls=${JSON.stringify(capturedUrls)}`)
    }
    if (mirrorReadCount !== 1) {
      throw new Error(`expected one docs mirror read, got ${mirrorReadCount}`)
    }
  } finally {
    writeWorkspaceImportDefaultSourceUrlSetting(previousDefaultSourceUrl)
    if (typeof previousDocsAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = previousDocsAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    if (typeof previousStorageBaseUrl === 'string') process.env.VITE_KNOWGRPH_STORAGE_BASE_URL = previousStorageBaseUrl
    else delete process.env.VITE_KNOWGRPH_STORAGE_BASE_URL
    if (originalFetch) g.fetch = originalFetch
    restore()
  }
}
