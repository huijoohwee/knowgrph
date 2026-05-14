import type { UiToastInput } from '@/hooks/store/types'
import type { WorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import { UI_TOAST_TTL_MS } from '@/lib/ui/toastTiming'
import { CHAT_DEERFLOW_ENDPOINT_URL, CHAT_PROVIDER_DEERFLOW, normalizeChatProviderId } from '@/lib/chatEndpoint'
import { useGraphStore } from '@/hooks/useGraphStore'

type PushUiToast = (toast: UiToastInput) => void

function isDeerFlowChatEndpoint(value: unknown): boolean {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return false
  return /\/api\/llm\/chat\/completions\/?(\?|$)/i.test(raw) || /\/__chat_proxy\/api\/llm\/chat\/completions\/?(\?|$)/i.test(raw)
}

export async function importUrlViaDeerFlowAndApply(args: {
  urlRaw: string
  canvas2dRenderer?: 'design' | null
  pushUiToast?: PushUiToast
}): Promise<{ createdPaths: string[] } | null> {
  const url = String(args.urlRaw || '').trim()
  if (!url) return null

  const store = useGraphStore.getState()
  const hasDeerflowProvider = normalizeChatProviderId(store.chatProvider) === CHAT_PROVIDER_DEERFLOW
  const deerflowEndpointUrl = hasDeerflowProvider && isDeerFlowChatEndpoint(store.chatEndpointUrl)
    ? store.chatEndpointUrl
    : CHAT_DEERFLOW_ENDPOINT_URL
  const deerflowApiKey = hasDeerflowProvider && store.chatAuthMode === 'byok' ? store.chatApiKey : ''
  const deerflowModel = hasDeerflowProvider ? store.chatModel : null
  const pushUiToast = typeof args.pushUiToast === 'function' ? args.pushUiToast : null
  const toastId = 'launch:import:url:deerflow'
  pushUiToast?.({
    id: toastId,
    kind: 'neutral',
    message: 'Importing URL (DeerFlow)…',
    ttlMs: null,
    dismissible: false,
  })
  try {
    const [
      { getWorkspaceFs },
      { WORKSPACE_ROOT_PATH },
      { runWorkspaceFsChangedBatch },
      { bulkSetWorkspaceEntrySources },
      { importWorkspaceUrlViaDeerFlow },
      { applyWorkspaceImportToCanvasBestEffort, normalizeWorkspaceImportResult, resolveImportedCanvasDocumentApplyToGraph, activateFirstImportedWorkspaceFile },
    ] =
      await Promise.all([
        import('@/features/workspace-fs/workspaceFs') as Promise<typeof import('@/features/workspace-fs/workspaceFs')>,
        import('@/features/workspace-fs/path') as Promise<typeof import('@/features/workspace-fs/path')>,
        import('@/features/workspace-fs/workspaceFsEvents') as Promise<typeof import('@/features/workspace-fs/workspaceFsEvents')>,
        import('@/features/workspace-fs/sourceIndex') as Promise<typeof import('@/features/workspace-fs/sourceIndex')>,
        import('@/features/markdown-workspace/workspaceImport') as Promise<typeof import('@/features/markdown-workspace/workspaceImport')>,
        import('@/features/markdown-workspace/useWorkspaceFileActions/importActions') as Promise<
          typeof import('@/features/markdown-workspace/useWorkspaceFileActions/importActions')
        >,
      ])

    const fs = await getWorkspaceFs()
    await fs.ensureSeed()
    const res = normalizeWorkspaceImportResult(await runWorkspaceFsChangedBatch(() =>
      importWorkspaceUrlViaDeerFlow({
        fs,
        urlRaw: url,
        parentPath: WORKSPACE_ROOT_PATH,
        deerflow: {
          endpointUrl: deerflowEndpointUrl,
          apiKey: deerflowApiKey,
          model: deerflowModel,
        },
        onProgress: p => {
          const label = String((p as { label?: unknown }).label || '').trim()
          if (label) pushUiToast?.({ id: toastId, kind: 'neutral', message: label, ttlMs: null, dismissible: false })
        },
      }),
    ))

    bulkSetWorkspaceEntrySources(res.sources as Array<{ path: string; source: WorkspaceEntrySource }>)
    const applyToGraph = await resolveImportedCanvasDocumentApplyToGraph({ fs, createdPaths: res.createdPaths })
    await applyWorkspaceImportToCanvasBestEffort({
      fs,
      createdPaths: res.createdPaths,
      opts: applyToGraph ? { applyToGraph: true } : undefined,
    })
    await activateFirstImportedWorkspaceFile({ fs, createdPaths: res.createdPaths, applyToGraph })
    pushUiToast?.({
      id: toastId,
      kind: 'success',
      message: `Imported ${res.createdPaths.length} file(s)`,
      ttlMs: UI_TOAST_TTL_MS.actionFeedback,
      dismissible: false,
    })
    return { createdPaths: res.createdPaths }
  } catch (e) {
    pushUiToast?.({
      id: toastId,
      kind: 'error',
      message: `Import failed: ${String((e as { message?: unknown })?.message ?? e)}`,
      ttlMs: UI_TOAST_TTL_MS.warningExtended,
      dismissible: true,
    })
    return null
  }
}

