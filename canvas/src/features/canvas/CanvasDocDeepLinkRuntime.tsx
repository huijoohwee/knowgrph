import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { UiToastInput } from '@/hooks/store/store-types/core'
import { useSourceFilesBootstrapReady } from '@/features/source-files/sourceFilesBootstrapReadiness'
import {
  buildDefaultDocViewUrl,
  buildDocViewUrl,
  clearRetainedLocalDocDeepLinkPath,
  consumeDeepLinkParams,
  parseDocDeepLink,
} from './canvasDocDeepLink'
import type { DefaultRemoteDocDeepLink } from './canvasDocDeepLink'
import type { RemoteDocDeepLink } from './canvasDocDeepLink'
import {
  consumeWebsiteCrawlMarkdownDeepLinkRequest,
  openWebsiteCrawlMarkdownArtifactInExplorer,
  readWebsiteCrawlMarkdownDeepLinkRequest,
} from '@/lib/websites/openWebsiteCrawlMarkdownArtifactInExplorer'

type PushUiToast = (toast: UiToastInput) => void

const remoteDeepLinkImports = new Map<string, Promise<void>>()

type RemoteDeepLinkImportLifecycle = {
  importDocument: () => Promise<void>
  readLiveSearch: () => string
  consumeSearch: (search: string) => void
  reportError: (error: unknown) => void
}

export function runRemoteDeepLinkImportLifecycle(
  inFlightImports: Map<string, Promise<void>>,
  currentSearch: string,
  lifecycle: RemoteDeepLinkImportLifecycle,
): Promise<void> {
  const activeImport = inFlightImports.get(currentSearch)
  if (activeImport) return activeImport

  const pendingImport = Promise.resolve()
    .then(lifecycle.importDocument)
    .then(() => {
      const liveSearch = lifecycle.readLiveSearch()
      if (liveSearch !== currentSearch) return
      lifecycle.consumeSearch(liveSearch)
    })
    .catch(lifecycle.reportError)
    .finally(() => {
      if (inFlightImports.get(currentSearch) === pendingImport) {
        inFlightImports.delete(currentSearch)
      }
    })
  inFlightImports.set(currentSearch, pendingImport)
  return pendingImport
}

function openCrawlMarkdownRequest(
  crawlRequest: NonNullable<ReturnType<typeof readWebsiteCrawlMarkdownDeepLinkRequest>>,
  pushUiToast: PushUiToast,
): void {
  const toastId = 'deep-link:crawl-artifact'
  pushUiToast({ id: toastId, kind: 'neutral', message: 'Opening crawl artifact…', ttlMs: null, dismissible: false })
  void openWebsiteCrawlMarkdownArtifactInExplorer(crawlRequest)
    .then(result => {
      if (!result) throw new Error('Crawl artifact is unavailable')
      pushUiToast({ id: toastId, kind: 'success', message: 'Opened crawl Markdown in Source Files', ttlMs: 3000, dismissible: false })
    })
    .catch(error => {
      pushUiToast({ id: toastId, kind: 'error', message: error instanceof Error ? error.message : 'Failed to open crawl artifact', ttlMs: 5000, dismissible: true })
    })
}

async function handleLocalDeepLink(
  relativePath: string,
  pushUiToast: PushUiToast,
  options: { applyToGraph: boolean },
): Promise<void> {
  const toastId = 'deep-link:doc-local'
  pushUiToast({ id: toastId, kind: 'neutral', message: 'Opening document…', ttlMs: null, dismissible: false })

  try {
    const [
      { getWorkspaceFs },
      { normalizeWorkspacePath, workspaceBasename, workspaceDocumentKey },
      { applyActiveMarkdownDocumentPayload },
    ] = await Promise.all([
      import('@/features/workspace-fs/workspaceFs') as Promise<typeof import('@/features/workspace-fs/workspaceFs')>,
      import('@/features/workspace-fs/path') as Promise<typeof import('@/features/workspace-fs/path')>,
      import('@/features/markdown/activeMarkdownDocument') as Promise<typeof import('@/features/markdown/activeMarkdownDocument')>,
    ])

    const fs = await getWorkspaceFs()
    await fs.ensureSeed()
    const targetPath = normalizeWorkspacePath(relativePath)
    const entries = await fs.listEntries()
    const entry = entries.find(e => e.path === targetPath)

    if (!entry || entry.kind !== 'file') {
      clearRetainedLocalDocDeepLinkPath()
      pushUiToast({ id: toastId, kind: 'error', message: `File not found: ${workspaceBasename(targetPath) || relativePath}`, ttlMs: 5000, dismissible: true })
      return
    }

    const markdownExplorer = await import('@/features/markdown-explorer/store')
    const graphStore = useGraphStore.getState()
    graphStore.setWorkspaceViewState({ mode: 'editor', paneOpen: true })
    graphStore.setSelectionSource('editor')
    graphStore.selectNode(null)
    graphStore.selectEdge(null)
    markdownExplorer.useMarkdownExplorerStore.getState().setActivePath(targetPath)

    const entryText = typeof entry.text === 'string' ? entry.text : ''
    if (entryText) {
      await applyActiveMarkdownDocumentPayload({
        setActiveMarkdownDocument: graphStore.setActiveMarkdownDocument,
        name: workspaceDocumentKey(targetPath),
        text: entryText,
        sourceUrl: null,
        autoEnableFrontmatter: false,
        applyViewPreset: options.applyToGraph,
        applyToGraph: options.applyToGraph,
        forceApplyToGraph: options.applyToGraph,
        normalizeWebpageFrontmatterToMarkdown: false,
      })
    }

    pushUiToast({
      id: toastId,
      kind: 'success',
      message: `Opened ${workspaceBasename(targetPath) || 'document'}`,
      ttlMs: 3000,
      dismissible: false,
    })
  } catch (err) {
    clearRetainedLocalDocDeepLinkPath()
    const message = err instanceof Error ? err.message : 'Failed to open document'
    pushUiToast({ id: toastId, kind: 'error', message, ttlMs: 5000, dismissible: true })
  }
}

async function handleRemoteDeepLink(
  link: RemoteDocDeepLink | DefaultRemoteDocDeepLink,
  pushUiToast: PushUiToast,
): Promise<void> {
  const docUrl = link.kind === 'default-remote'
    ? buildDefaultDocViewUrl(link.canonicalPath)
    : buildDocViewUrl(link.workspaceId, link.canonicalPath)
  const toastId = 'deep-link:doc-import'

  pushUiToast({ id: toastId, kind: 'neutral', message: 'Loading shared document…', ttlMs: null, dismissible: false })

  const [
    { getWorkspaceFs },
    { WORKSPACE_ROOT_PATH },
    { runWorkspaceFsChangedBatch },
    { bulkSetWorkspaceEntrySources },
    { importWorkspaceUrl },
    { applyWorkspaceImportToCanvasBestEffort, normalizeWorkspaceImportResult, activateFirstImportedWorkspaceFile },
  ] = await Promise.all([
    import('@/features/workspace-fs/workspaceFs') as Promise<typeof import('@/features/workspace-fs/workspaceFs')>,
    import('@/features/workspace-fs/path') as Promise<typeof import('@/features/workspace-fs/path')>,
    import('@/features/workspace-fs/workspaceFsEvents') as Promise<typeof import('@/features/workspace-fs/workspaceFsEvents')>,
    import('@/features/workspace-fs/sourceIndex') as Promise<typeof import('@/features/workspace-fs/sourceIndex')>,
    import('@/features/markdown-workspace/workspaceImport') as Promise<typeof import('@/features/markdown-workspace/workspaceImport')>,
    import('@/features/markdown-workspace/useWorkspaceFileActions/importRuntimeActions') as Promise<typeof import('@/features/markdown-workspace/useWorkspaceFileActions/importRuntimeActions')>,
  ])

  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  const res = normalizeWorkspaceImportResult(await runWorkspaceFsChangedBatch(() =>
    importWorkspaceUrl({
      fs,
      urlRaw: docUrl,
      parentPath: WORKSPACE_ROOT_PATH,
      preferDirectFetch: true,
    }),
  ))
  bulkSetWorkspaceEntrySources(res.sources)
  await applyWorkspaceImportToCanvasBestEffort({
    fs,
    createdPaths: res.createdPaths,
    opts: { applyToGraph: true },
  })
  await activateFirstImportedWorkspaceFile({ fs, createdPaths: res.createdPaths, applyToGraph: true })
  pushUiToast({
    id: toastId,
    kind: 'success',
    message: `Loaded ${link.canonicalPath.split('/').pop() || 'document'}`,
    ttlMs: 3000,
    dismissible: false,
  })
}

function importRemoteDeepLinkOnce(
  currentSearch: string,
  link: RemoteDocDeepLink | DefaultRemoteDocDeepLink,
  pushUiToast: PushUiToast,
): Promise<void> {
  return runRemoteDeepLinkImportLifecycle(remoteDeepLinkImports, currentSearch, {
    importDocument: () => handleRemoteDeepLink(link, pushUiToast),
    readLiveSearch: () => typeof window !== 'undefined'
      ? String(window.location.search || '')
      : currentSearch,
    consumeSearch: consumeDeepLinkParams,
    reportError: err => {
      const message = err instanceof Error ? err.message : 'Failed to load shared document'
      pushUiToast({ id: 'deep-link:doc-import', kind: 'error', message, ttlMs: 5000, dismissible: true })
    },
  })
}

export function CanvasDocDeepLinkRuntime(props: { search: string }) {
  const { search } = props
  const pushUiToast = useGraphStore(s => s.pushUiToast)
  const sourceFilesBootstrapReady = useSourceFilesBootstrapReady()

  React.useEffect(() => {
    if (!sourceFilesBootstrapReady) return
    const currentSearch = typeof window !== 'undefined' ? String(window.location.search || '') : String(search || '')
    const link = parseDocDeepLink(currentSearch)
    if (!link) return
    const crawlRequest = readWebsiteCrawlMarkdownDeepLinkRequest()
    if (link.kind === 'local' && crawlRequest) {
      consumeWebsiteCrawlMarkdownDeepLinkRequest()
      openCrawlMarkdownRequest(crawlRequest, pushUiToast)
      return
    }
    const previewRequested = new URLSearchParams(currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch).get('kgPreview') === '1'

    if (link.kind === 'local') {
      consumeDeepLinkParams(currentSearch)
      void handleLocalDeepLink(link.relativePath, pushUiToast, {
        applyToGraph: previewRequested,
      })
    } else {
      void importRemoteDeepLinkOnce(currentSearch, link, pushUiToast)
    }
  }, [search, pushUiToast, sourceFilesBootstrapReady])

  return null
}
