import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { KNOWGRPH_STORAGE_ROUTE_PATHS } from '@/lib/storage/knowgrphStorageSyncContract'

const DEEP_LINK_PREFIX = '/doc/'
const DEEP_LINK_PARAM = 'kgPath'

function parseDocDeepLink(search: string): { workspaceId: string; canonicalPath: string } | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const rawPath = String(params.get(DEEP_LINK_PARAM) || '').trim()
  if (!rawPath.startsWith(DEEP_LINK_PREFIX)) return null
  const suffix = rawPath.slice(DEEP_LINK_PREFIX.length)
  const firstSlash = suffix.indexOf('/')
  if (firstSlash < 1) return null
  const workspaceId = decodeURIComponent(suffix.slice(0, firstSlash)).trim()
  const canonicalPath = decodeURIComponent(suffix.slice(firstSlash + 1)).trim()
  if (!workspaceId || !canonicalPath) return null
  return { workspaceId, canonicalPath }
}

function buildDocViewUrl(workspaceId: string, canonicalPath: string): string {
  const base = KNOWGRPH_STORAGE_ROUTE_PATHS.docPrefix
  return `${base}${encodeURIComponent(workspaceId)}/${encodeURIComponent(canonicalPath)}`
}

function consumeDeepLinkParam(search: string): void {
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    if (!params.has(DEEP_LINK_PARAM)) return
    params.delete(DEEP_LINK_PARAM)
    const next = params.toString()
    const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`
    window.history.replaceState(null, '', nextUrl)
  } catch {
    void 0
  }
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
    consumeDeepLinkParam(search)

    const docUrl = buildDocViewUrl(link.workspaceId, link.canonicalPath)
    const toastId = 'deep-link:doc-import'

    pushUiToast({ id: toastId, kind: 'neutral', message: 'Loading shared document…', ttlMs: null, dismissible: false })

    void (async () => {
      try {
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
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load shared document'
        pushUiToast({ id: toastId, kind: 'error', message, ttlMs: 5000, dismissible: true })
      }
    })()
  }, [search, pushUiToast])

  return null
}
