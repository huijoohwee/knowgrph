import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { UiToastInput } from '@/hooks/store/store-types/core'
import { buildDefaultDocViewUrl, buildDocViewUrl, consumeDeepLinkParams, parseDocDeepLink } from './canvasDocDeepLink'
import type { DefaultRemoteDocDeepLink } from './canvasDocDeepLink'
import type { RemoteDocDeepLink } from './canvasDocDeepLink'
import {
  consumeWebsiteCrawlMarkdownDeepLinkRequest,
  openWebsiteCrawlMarkdownArtifactInExplorer,
  readWebsiteCrawlMarkdownDeepLinkRequest,
} from '@/lib/websites/openWebsiteCrawlMarkdownArtifactInExplorer'

function openCrawlMarkdownRequest(
  crawlRequest: NonNullable<ReturnType<typeof readWebsiteCrawlMarkdownDeepLinkRequest>>,
  pushUiToast: (t: UiToastInput) => void,
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
  pushUiToast: (t: UiToastInput) => void,
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
    const message = err instanceof Error ? err.message : 'Failed to open document'
    pushUiToast({ id: toastId, kind: 'error', message, ttlMs: 5000, dismissible: true })
  }
}

async function handleRemoteDeepLink(
  link: RemoteDocDeepLink | DefaultRemoteDocDeepLink,
  pushUiToast: (t: UiToastInput) => void,
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

export function CanvasDocDeepLinkRuntime(props: { search: string }) {
  const { search } = props
  const pushUiToast = useGraphStore(s => s.pushUiToast)

  React.useEffect(() => {
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
    consumeDeepLinkParams(currentSearch)

    if (link.kind === 'local') {
      void handleLocalDeepLink(link.relativePath, pushUiToast, {
        applyToGraph: previewRequested,
      })
    } else {
      void handleRemoteDeepLink(link, pushUiToast).catch(err => {
        const message = err instanceof Error ? err.message : 'Failed to load shared document'
        pushUiToast({ id: 'deep-link:doc-import', kind: 'error', message, ttlMs: 5000, dismissible: true })
      })
    }
  }, [search, pushUiToast])

  return null
}
