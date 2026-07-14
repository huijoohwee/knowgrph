import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import {
  buildNewMarkdownSourceFileName,
  createNewMarkdownSourceFile,
} from '@/features/source-files/createNewMarkdownSourceFile'
import { getWorkspaceFs, resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import { loadWorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import {
  shouldPreserveWorkspaceDocsMirrorSyncEntry,
} from '@/features/workspace-fs/workspaceDocsMirrorSourceOwnership'
import { LS_KEYS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'

const KG_HUIJOOHWEE_DOCS_ROOT = '/workspace/huijoohwee/docs'

export async function testCreateNewMarkdownSourceFileDefaultsToDocsRoot() {
  resetWorkspaceFsForTests()
  useGraphStore.getState().resetAll()
  useMarkdownExplorerStore.getState().setActivePath(null)
  try {
    const timestampMs = Date.UTC(2026, 6, 9, 0, 1, 2)
    const firstName = buildNewMarkdownSourceFileName(timestampMs)
    const secondName = buildNewMarkdownSourceFileName(timestampMs + 1000)

    const firstPath = await createNewMarkdownSourceFile({ timestampMs })
    const secondPath = await createNewMarkdownSourceFile({ timestampMs })

    if (firstPath !== `/docs/${firstName}`) {
      throw new Error(`expected first Launch markdown file in /docs, got ${JSON.stringify(firstPath)}`)
    }
    if (secondPath !== `/docs/${secondName}`) {
      throw new Error(`expected same-second Launch markdown collision to allocate a fresh timestamp, got ${JSON.stringify(secondPath)}`)
    }

    const fs = await getWorkspaceFs()
    const firstText = await fs.readFileText(firstPath)
    const secondText = await fs.readFileText(secondPath)
    if (firstText !== '' || secondText !== '') {
      throw new Error(`expected new markdown files to start empty, got ${JSON.stringify({ firstText, secondText })}`)
    }

    const state = useGraphStore.getState()
    if (state.workspaceViewMode !== 'editor' || state.editorWorkspacePane !== 'markdown' || !state.workspaceCanvasPaneOpen) {
      throw new Error(`expected new markdown creation to open the Markdown editor, got ${JSON.stringify({
        workspaceViewMode: state.workspaceViewMode,
        editorWorkspacePane: state.editorWorkspacePane,
        workspaceCanvasPaneOpen: state.workspaceCanvasPaneOpen,
      })}`)
    }
    if (useMarkdownExplorerStore.getState().activePath !== secondPath) {
      throw new Error('expected latest new markdown file to be selected in Source Files')
    }
  } finally {
    useMarkdownExplorerStore.getState().setActivePath(null)
    useGraphStore.getState().resetAll()
    resetWorkspaceFsForTests()
  }
}

export async function testCreateNewMarkdownSourceFilePersistsBlankFileToDocsMirror() {
  resetWorkspaceFsForTests()
  useGraphStore.getState().resetAll()
  useMarkdownExplorerStore.getState().setActivePath(null)
  const previousAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
  const previousFetch = globalThis.fetch
  const calls: Array<{ url: string; body: string; method: string }> = []
  process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = KG_HUIJOOHWEE_DOCS_ROOT
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = String(init?.method || 'GET')
    const url = String(typeof input === 'string' ? input : (input as URL).toString())
    calls.push({ url, body: String(init?.body || ''), method })
    if (method === 'POST') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response('', { status: 404 })
  }) as typeof fetch
  try {
    const timestampMs = Date.UTC(2026, 6, 9, 0, 3, 4)
    const fileName = buildNewMarkdownSourceFileName(timestampMs)
    const createdPath = await createNewMarkdownSourceFile({ timestampMs })
    if (createdPath !== `/docs/${fileName}`) {
      throw new Error(`expected Launch-created markdown path in /docs, got ${JSON.stringify(createdPath)}`)
    }

    const folderCall = calls.find(call => call.url === '/__kg_fs_write' && call.body.includes('"mkdirOnly":true'))
    if (!folderCall || !folderCall.body.includes(KG_HUIJOOHWEE_DOCS_ROOT)) {
      throw new Error('expected New .md to synchronously ensure the sibling docs mirror folder')
    }
    const fileCall = calls.find(call => call.url === '/__kg_fs_write' && call.body.includes(`${KG_HUIJOOHWEE_DOCS_ROOT}/${fileName}`))
    if (!fileCall || !fileCall.body.includes('"text":""')) {
      throw new Error('expected New .md to synchronously persist a blank markdown file in the sibling docs mirror')
    }
  } finally {
    if (typeof previousAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = previousAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    if (previousFetch) {
      ;(globalThis as unknown as { fetch: typeof fetch }).fetch = previousFetch
    } else {
      delete (globalThis as unknown as { fetch?: typeof fetch }).fetch
    }
    useMarkdownExplorerStore.getState().setActivePath(null)
    useGraphStore.getState().resetAll()
    resetWorkspaceFsForTests()
  }
}

export async function testCreateNewMarkdownSourceFileSurvivesDocsMirrorRefreshSync() {
  resetWorkspaceFsForTests()
  useGraphStore.getState().resetAll()
  useMarkdownExplorerStore.getState().setActivePath(null)
  try {
    const timestampMs = Date.UTC(2026, 6, 9, 0, 2, 3)
    const createdPath = await createNewMarkdownSourceFile({ timestampMs })
    const sourceIndex = loadWorkspaceSourceIndex()
    const source = sourceIndex[createdPath]
    if (!source || source.kind !== 'local') {
      throw new Error(`expected Launch-created markdown path to be source-indexed as local, got ${JSON.stringify(source)}`)
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(String(LS_KEYS.markdownWorkspaceSourcesByPath))
      const persisted = raw ? JSON.parse(raw) as Record<string, { kind?: unknown }> : {}
      const persistedSource = persisted[createdPath]
      if (!persistedSource || persistedSource.kind !== 'local') {
        throw new Error(`expected Launch-created markdown source mark to be persisted before refresh, got ${String(raw || '')}`)
      }
    }

    if (!shouldPreserveWorkspaceDocsMirrorSyncEntry({ path: createdPath, sourceIndex })) {
      throw new Error('expected docs mirror refresh sync to preserve Launch-created local markdown file')
    }

    if (shouldPreserveWorkspaceDocsMirrorSyncEntry({
      path: '/docs/__tests__/mirror-owned.md',
      sourceIndex,
    })) {
      throw new Error('expected unindexed docs mirror markdown file to remain eligible for stale mirror cleanup')
    }

    const nestedSourceIndex = {
      '/docs/__tests__/new-md-refresh/nested.md': { kind: 'local', originalName: null },
    } as const
    if (!shouldPreserveWorkspaceDocsMirrorSyncEntry({
      path: '/docs/__tests__/new-md-refresh',
      sourceIndex: nestedSourceIndex,
    })) {
      throw new Error('expected docs mirror refresh sync to preserve ancestor folders for source-indexed local files')
    }
  } finally {
    useMarkdownExplorerStore.getState().setActivePath(null)
    useGraphStore.getState().resetAll()
    resetWorkspaceFsForTests()
  }
}
