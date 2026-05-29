import path from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'

import { importWorkspaceUrl } from '@/features/markdown-workspace/workspaceImport'
import { resetWorkspaceUrlContentCacheForTests } from '@/features/markdown-workspace/workspaceImport/urlContentCache'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import {
  readWorkspaceImportShareExportRootPathSetting,
  writeWorkspaceImportShareExportRootPathSetting,
} from '@/lib/workspace/workspaceStoreSyncSettings'

type GlobalWithFetch = typeof globalThis & { fetch?: typeof fetch }

export async function testWorkspaceImportUrlApiNativeSessionTitleDrivesShareExportPath(): Promise<void> {
  resetWorkspaceUrlContentCacheForTests()
  const shareUrl = 'https://example.test/chat/shared-analysis-123'
  const exportToken = 'Research-global-oil-price-trajectory-simulation-20260407'
  const previousShareRoot = readWorkspaceImportShareExportRootPathSetting()
  const previousChatLogAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT
  const previousDocsAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'workspace-import-api-native-share-title-'))
  const fetchCalls: string[] = []
  const g = globalThis as GlobalWithFetch
  const previousFetch = g.fetch
  g.fetch = (async (input: unknown, init?: RequestInit) => {
    const requestUrl = input instanceof URL ? input.toString() : String(input || '')
    fetchCalls.push(requestUrl)
    if (requestUrl === 'http://localhost:6969/v1/sessions') return new Response(JSON.stringify({ sessions: [{ id: 'share-session-1', url: shareUrl, domain: 'example.test', title: 'Research global oil price trajectory simulation 20260407 - Example' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (requestUrl === 'http://localhost:6969/v1/browser/markdown') {
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>
      if (body.session_id !== 'share-session-1' || body.url !== shareUrl) throw new Error(`expected matching browser-session markdown request, got ${JSON.stringify(body)}`)
      return new Response(JSON.stringify({
        markdown: ['# Research output', '', 'Browser-authenticated share markdown preserves the visible report body instead of a logged-out application shell.', '', 'The oil-price trajectory analysis remains substantive enough for the shared import fidelity gate.'].join('\n'),
        thinkingMarkdown: ['- Browser-authenticated reasoning trace', '- Shared-session thinking is captured from the rendered browser source.'].join('\n'),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response('not found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  }) as unknown as typeof fetch
  try {
    process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = `${tempRoot}/docs`
    process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT = `${tempRoot}/chat-log`
    writeWorkspaceImportShareExportRootPathSetting('/docs_')
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()
    const result = await importWorkspaceUrl({ fs, urlRaw: shareUrl, parentPath: '/' })
    const expectedPath = `/docs_/${exportToken}/${exportToken}.md`
    const expectedThinkingPath = `/docs_/${exportToken}/${exportToken}-thinking.md`
    if (result.createdPaths[0] !== expectedPath) throw new Error(`expected API-native session title to drive share export path, got ${JSON.stringify(result.createdPaths)}`)
    if (!result.sources.some(item => item.path === expectedThinkingPath && item.source.kind === 'url')) throw new Error(`expected API-native share import to register title-derived thinking sidecar source, got ${JSON.stringify(result.sources)}`)
    const exported = await fs.readFileText(expectedPath)
    if (!exported?.includes('Browser-authenticated share markdown')) throw new Error(`expected API-native browser-session body to be persisted, got:\n${String(exported || '')}`)
    const thinkingExported = await fs.readFileText(expectedThinkingPath)
    if (!thinkingExported?.includes('Browser-authenticated reasoning trace')) throw new Error(`expected API-native share import to persist rendered thinking sidecar at ${expectedThinkingPath}, got:\n${String(thinkingExported || '')}`)
    if (await fs.readFileText('/docs_/shared-analysis-123/shared-analysis-123.md') !== null) throw new Error('expected URL-token share artifact path to stay unused when session title is available')
    if (!fetchCalls.includes('http://localhost:6969/v1/browser/markdown')) throw new Error(`expected import to request API-native browser-session markdown, got ${JSON.stringify(fetchCalls)}`)
  } finally {
    g.fetch = previousFetch
    writeWorkspaceImportShareExportRootPathSetting(previousShareRoot)
    if (typeof previousDocsAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = previousDocsAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    if (typeof previousChatLogAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT = previousChatLogAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT
    await rm(tempRoot, { recursive: true, force: true })
    resetWorkspaceUrlContentCacheForTests()
  }
}

export async function testWorkspaceImportUrlShareExportAvoidsDifferentSourceTitleCollision(): Promise<void> {
  resetWorkspaceUrlContentCacheForTests()
  const shareUrl = 'https://example.test/chat/new-share-456'
  const previousShareRoot = readWorkspaceImportShareExportRootPathSetting()
  const previousChatLogAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT
  const previousDocsAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'workspace-import-share-title-collision-'))
  try {
    process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = `${tempRoot}/docs`
    process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT = `${tempRoot}/chat-log`
    writeWorkspaceImportShareExportRootPathSetting('/docs_')
    const fs = createMemoryWorkspaceFs({
      initialEntries: [
        {
          path: '/docs_/Repeated-title/Repeated-title.md',
          parentPath: '/docs_/Repeated-title',
          kind: 'file',
          name: 'Repeated-title.md',
          text: [
            '---',
            'kgWebpageUrl: "https://example.test/chat/old-share-123"',
            'kgWebpageView: "markdown"',
            '---',
            '',
            '# Old share',
            '',
          ].join('\n'),
          updatedAtMs: 1,
        },
      ],
    })
    await fs.ensureSeed()
    const result = await importWorkspaceUrl({
      fs,
      urlRaw: shareUrl,
      parentPath: '/',
      fetchUrlContent: async url => ({
        normalizedUrl: url,
        name: 'new-share-456.md',
        title: 'Repeated title',
        text: [
          '---',
          `kgWebpageUrl: "${url}"`,
          'kgWebpageView: "markdown"',
          '---',
          '',
          '# New share',
          '',
        ].join('\n'),
      }),
    })
    const expectedPath = '/docs_/Repeated-title-new-share-456/Repeated-title-new-share-456.md'
    if (result.createdPaths[0] !== expectedPath) {
      throw new Error(`expected different-source title collision to append the URL token, got ${JSON.stringify(result.createdPaths)}`)
    }
    const oldText = await fs.readFileText('/docs_/Repeated-title/Repeated-title.md')
    if (!oldText?.includes('old-share-123') || oldText.includes('# New share')) {
      throw new Error(`expected existing different-source share artifact to remain untouched, got:\n${String(oldText || '')}`)
    }
    const newText = await fs.readFileText(expectedPath)
    if (!newText?.includes('# New share')) throw new Error(`expected new share artifact at collision-safe path, got:\n${String(newText || '')}`)
  } finally {
    writeWorkspaceImportShareExportRootPathSetting(previousShareRoot)
    if (typeof previousDocsAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = previousDocsAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    if (typeof previousChatLogAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT = previousChatLogAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT
    await rm(tempRoot, { recursive: true, force: true })
    resetWorkspaceUrlContentCacheForTests()
  }
}
