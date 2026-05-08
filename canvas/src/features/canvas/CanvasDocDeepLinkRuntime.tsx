import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { UiToastInput } from '@/hooks/store/store-types/core'
import { KNOWGRPH_STORAGE_ROUTE_PATHS } from '@/lib/storage/knowgrphStorageSyncContract'

const DEEP_LINK_PREFIX = '/doc/'
const DEEP_LINK_PARAM = 'kgPath'
const LOCAL_DOC_PARAM = 'kgDoc'

type RemoteDocDeepLink = { kind: 'remote'; workspaceId: string; canonicalPath: string }
type LocalDocDeepLink = { kind: 'local'; relativePath: string }
type DocDeepLink = RemoteDocDeepLink | LocalDocDeepLink

function parseDocDeepLink(search: string): DocDeepLink | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  const localRaw = String(params.get(LOCAL_DOC_PARAM) || '').trim()
  if (localRaw) {
    return { kind: 'local', relativePath: localRaw }
  }

  const rawPath = String(params.get(DEEP_LINK_PARAM) || '').trim()
  if (!rawPath.startsWith(DEEP_LINK_PREFIX)) return null
  const suffix = rawPath.slice(DEEP_LINK_PREFIX.length)
  if (!suffix) return null
  const firstSlash = suffix.indexOf('/')
  if (firstSlash < 1) return null
  const workspaceId = decodeURIComponent(suffix.slice(0, firstSlash)).trim()
  const canonicalPath = decodeURIComponent(suffix.slice(firstSlash + 1)).trim()
  if (!workspaceId || !canonicalPath) return null
  return { kind: 'remote', workspaceId, canonicalPath }
}

function buildDocViewUrl(workspaceId: string, canonicalPath: string): string {
  const base = KNOWGRPH_STORAGE_ROUTE_PATHS.docPrefix
  return `${base}${encodeURIComponent(workspaceId)}/${encodeURIComponent(canonicalPath)}`
}

function consumeDeepLinkParams(search: string): void {
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    let changed = false
    if (params.has(LOCAL_DOC_PARAM)) { params.delete(LOCAL_DOC_PARAM); changed = true }
    if (params.has(DEEP_LINK_PARAM)) { params.delete(DEEP_LINK_PARAM); changed = true }
    if (!changed) return
    const next = params.toString()
    const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`
    window.history.replaceState(null, '', nextUrl)
  } catch {
    void 0
  }
}

async function handleLocalDeepLink(
  relativePath: string,
  pushUiToast: (t: UiToastInput) => void,
): Promise<void> {
  const toastId = 'deep-link:doc-local'
  pushUiToast({ id: toastId, kind: 'neutral', message: 'Opening document…', ttlMs: null, dismissible: false })

  try {
    const [
      { getWorkspaceFs },
      { normalizeWorkspacePath, workspaceBasename },
    ] = await Promise.all([
      import('@/features/workspace-fs/workspaceFs') as Promise<typeof import('@/features/workspace-fs/workspaceFs')>,
      import('@/features/workspace-fs/path') as Promise<typeof import('@/features/workspace-fs/path')>,
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
    const { setWorkspaceViewState } = useGraphStore.getState()
    setWorkspaceViewState({ mode: 'editor', paneOpen: true })
    markdownExplorer.useMarkdownExplorerStore.getState().setActivePath(targetPath)

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
  link: RemoteDocDeepLink,
  pushUiToast: (t: UiToastInput) => void,
): Promise<void> {
  const docUrl = buildDocViewUrl(link.workspaceId, link.canonicalPath)
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
    import('@/features/markdown-workspace/useWorkspaceFileActions/importActions') as Promise<typeof import('@/features/markdown-workspace/useWorkspaceFileActions/importActions')>,
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
  const consumedRef = React.useRef(false)
  const pushUiToast = useGraphStore(s => s.pushUiToast)

  React.useEffect(() => {
    if (consumedRef.current) return
    const link = parseDocDeepLink(search)
    if (!link) return
    consumedRef.current = true
    consumeDeepLinkParams(search)

    if (link.kind === 'local') {
      void handleLocalDeepLink(link.relativePath, pushUiToast)
    } else {
      void handleRemoteDeepLink(link, pushUiToast).catch(err => {
        const message = err instanceof Error ? err.message : 'Failed to load shared document'
        pushUiToast({ id: 'deep-link:doc-import', kind: 'error', message, ttlMs: 5000, dismissible: true })
      })
    }
  }, [search, pushUiToast])

  return null
}
