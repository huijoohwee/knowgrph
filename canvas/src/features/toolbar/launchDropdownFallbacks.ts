import type { UiToastInput } from '@/hooks/store/types'
import type { WorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import type { WorkspaceFs } from '@/features/workspace-fs/types'
import { UI_TOAST_TTL_MS } from '@/lib/ui/toastTiming'
type PushUiToast = (toast: UiToastInput) => void

async function focusFirstImportedWorkspaceFile(args: {
  fs: WorkspaceFs
  createdPaths: string[]
}): Promise<void> {
  try {
    const { activateFirstImportedWorkspaceFile } = (await import(
      '@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions/importActions'
    )) as typeof import('@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions/importActions')
    await activateFirstImportedWorkspaceFile(args)
  } catch {
    void 0
  }
}

export async function importLocalFilesFallback(args: {
  files: FileList | ReadonlyArray<File> | null
  pushUiToast: PushUiToast
}): Promise<void> {
  const snapshot = args.files ? Array.from(args.files as ArrayLike<File>) : []
  if (snapshot.length === 0) return
  args.pushUiToast({
    id: 'launch:import:localFiles',
    kind: 'neutral',
    message: `Importing ${snapshot.length} file(s)…`,
    ttlMs: null,
    dismissible: false,
  })
  try {
    const [
      { getWorkspaceFs },
      { WORKSPACE_ROOT_PATH },
      { runWorkspaceFsChangedBatch },
      { bulkSetWorkspaceEntrySources },
      { importWorkspaceLocalFiles },
      { applyWorkspaceImportToCanvasBestEffort, normalizeWorkspaceImportResult },
    ] =
      await Promise.all([
        import('@/features/workspace-fs/workspaceFs') as Promise<typeof import('@/features/workspace-fs/workspaceFs')>,
        import('@/features/workspace-fs/path') as Promise<typeof import('@/features/workspace-fs/path')>,
        import('@/features/workspace-fs/workspaceFsEvents') as Promise<typeof import('@/features/workspace-fs/workspaceFsEvents')>,
        import('@/features/workspace-fs/sourceIndex') as Promise<typeof import('@/features/workspace-fs/sourceIndex')>,
        import('@/components/BottomPanel/markdownWorkspace/workspaceImport') as Promise<
          typeof import('@/components/BottomPanel/markdownWorkspace/workspaceImport')
        >,
        import('@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions/importActions') as Promise<
          typeof import('@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions/importActions')
        >,
      ])
    const fs = await getWorkspaceFs()
    await fs.ensureSeed()
    const res = normalizeWorkspaceImportResult(await runWorkspaceFsChangedBatch(() =>
      importWorkspaceLocalFiles({
        fs,
        files: snapshot,
        parentPath: WORKSPACE_ROOT_PATH,
      }),
    ))
    bulkSetWorkspaceEntrySources(res.sources as Array<{ path: string; source: WorkspaceEntrySource }>)
    await applyWorkspaceImportToCanvasBestEffort({ fs, createdPaths: res.createdPaths })
    await focusFirstImportedWorkspaceFile({ fs, createdPaths: res.createdPaths })
    args.pushUiToast({
      id: 'launch:import:localFiles',
      kind: 'success',
      message: `Imported ${res.createdPaths.length} file(s)`,
      ttlMs: UI_TOAST_TTL_MS.actionFeedback,
      dismissible: false,
    })
  } catch (e) {
    args.pushUiToast({
      id: 'launch:import:localFiles',
      kind: 'error',
      message: `Import failed: ${String((e as { message?: unknown })?.message ?? e)}`,
      ttlMs: UI_TOAST_TTL_MS.warningExtended,
      dismissible: true,
    })
  }
}

export async function importLocalFolderFallback(args: {
  files: FileList | ReadonlyArray<File> | null
  pushUiToast: PushUiToast
}): Promise<void> {
  const snapshot = args.files ? Array.from(args.files as ArrayLike<File>) : []
  if (snapshot.length === 0) return
  args.pushUiToast({ id: 'launch:import:folder', kind: 'neutral', message: 'Importing folder…', ttlMs: null, dismissible: false })
  try {
    const [
      { getWorkspaceFs },
      { runWorkspaceFsChangedBatch },
      { bulkSetWorkspaceEntrySources },
      { importWorkspaceLocalFolder },
      { applyWorkspaceImportToCanvasBestEffort, normalizeWorkspaceImportResult },
    ] =
      await Promise.all([
        import('@/features/workspace-fs/workspaceFs') as Promise<typeof import('@/features/workspace-fs/workspaceFs')>,
        import('@/features/workspace-fs/workspaceFsEvents') as Promise<typeof import('@/features/workspace-fs/workspaceFsEvents')>,
        import('@/features/workspace-fs/sourceIndex') as Promise<typeof import('@/features/workspace-fs/sourceIndex')>,
        import('@/components/BottomPanel/markdownWorkspace/workspaceImport') as Promise<
          typeof import('@/components/BottomPanel/markdownWorkspace/workspaceImport')
        >,
        import('@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions/importActions') as Promise<
          typeof import('@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions/importActions')
        >,
      ])
    const fs = await getWorkspaceFs()
    await fs.ensureSeed()
    const res = normalizeWorkspaceImportResult(await runWorkspaceFsChangedBatch(() => importWorkspaceLocalFolder({ fs, files: snapshot })))
    bulkSetWorkspaceEntrySources(res.sources as Array<{ path: string; source: WorkspaceEntrySource }>)
    await applyWorkspaceImportToCanvasBestEffort({ fs, createdPaths: res.createdPaths })
    await focusFirstImportedWorkspaceFile({ fs, createdPaths: res.createdPaths })
    args.pushUiToast({
      id: 'launch:import:folder',
      kind: 'success',
      message: `Imported ${res.createdPaths.length} file(s)`,
      ttlMs: UI_TOAST_TTL_MS.actionFeedback,
      dismissible: false,
    })
  } catch (e) {
    args.pushUiToast({
      id: 'launch:import:folder',
      kind: 'error',
      message: `Import failed: ${String((e as { message?: unknown })?.message ?? e)}`,
      ttlMs: UI_TOAST_TTL_MS.warningExtended,
      dismissible: true,
    })
  }
}

export async function importUrlFallback(args: {
  urlRaw: string
  pushUiToast: PushUiToast
}): Promise<void> {
  const url = String(args.urlRaw || '').trim()
  if (!url) return
  const toastId = 'launch:import:url'
  args.pushUiToast({ id: toastId, kind: 'neutral', message: 'Importing URL…', ttlMs: null, dismissible: false })
  try {
    const [
      { getWorkspaceFs },
      { WORKSPACE_ROOT_PATH },
      { runWorkspaceFsChangedBatch },
      { bulkSetWorkspaceEntrySources },
      { importWorkspaceUrl },
      { applyWorkspaceImportToCanvasBestEffort, normalizeWorkspaceImportResult },
    ] =
      await Promise.all([
        import('@/features/workspace-fs/workspaceFs') as Promise<typeof import('@/features/workspace-fs/workspaceFs')>,
        import('@/features/workspace-fs/path') as Promise<typeof import('@/features/workspace-fs/path')>,
        import('@/features/workspace-fs/workspaceFsEvents') as Promise<typeof import('@/features/workspace-fs/workspaceFsEvents')>,
        import('@/features/workspace-fs/sourceIndex') as Promise<typeof import('@/features/workspace-fs/sourceIndex')>,
        import('@/components/BottomPanel/markdownWorkspace/workspaceImport') as Promise<
          typeof import('@/components/BottomPanel/markdownWorkspace/workspaceImport')
        >,
        import('@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions/importActions') as Promise<
          typeof import('@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions/importActions')
        >,
      ])
    const fs = await getWorkspaceFs()
    await fs.ensureSeed()
    const res = normalizeWorkspaceImportResult(await runWorkspaceFsChangedBatch(() =>
      importWorkspaceUrl({
        fs,
        urlRaw: url,
        parentPath: WORKSPACE_ROOT_PATH,
        onProgress: p => {
          const label = String((p as { label?: unknown }).label || '').trim() || 'Importing URL…'
          args.pushUiToast({ id: toastId, kind: 'neutral', message: label, ttlMs: null, dismissible: false })
        },
      }),
    ))
    bulkSetWorkspaceEntrySources(res.sources as Array<{ path: string; source: WorkspaceEntrySource }>)
    await applyWorkspaceImportToCanvasBestEffort({ fs, createdPaths: res.createdPaths })
    await focusFirstImportedWorkspaceFile({ fs, createdPaths: res.createdPaths })
    args.pushUiToast({
      id: toastId,
      kind: 'success',
      message: `Imported ${res.createdPaths.length} file(s)`,
      ttlMs: UI_TOAST_TTL_MS.actionFeedback,
      dismissible: false,
    })
  } catch (e) {
    args.pushUiToast({
      id: toastId,
      kind: 'error',
      message: `Import failed: ${String((e as { message?: unknown })?.message ?? e)}`,
      ttlMs: UI_TOAST_TTL_MS.warningExtended,
      dismissible: true,
    })
  }
}

export async function createNewFolderFallback(args: {
  pushUiToast: PushUiToast
}): Promise<void> {
  const toastId = 'launch:workspace:newFolder'
  args.pushUiToast({ id: toastId, kind: 'neutral', message: 'Creating folder…', ttlMs: null, dismissible: false })
  try {
    const [{ getWorkspaceFs }, { WORKSPACE_ROOT_PATH }] = await Promise.all([
      import('@/features/workspace-fs/workspaceFs') as Promise<typeof import('@/features/workspace-fs/workspaceFs')>,
      import('@/features/workspace-fs/path') as Promise<typeof import('@/features/workspace-fs/path')>,
    ])
    const fs = await getWorkspaceFs()
    await fs.ensureSeed()
    await fs.createFolder({ parentPath: WORKSPACE_ROOT_PATH, name: 'folder' })
    args.pushUiToast({ id: toastId, kind: 'success', message: 'Created folder', ttlMs: UI_TOAST_TTL_MS.statusAutoCloseSlow, dismissible: false })
  } catch (e) {
    args.pushUiToast({
      id: toastId,
      kind: 'error',
      message: `Failed: ${String((e as { message?: unknown })?.message ?? e)}`,
      ttlMs: UI_TOAST_TTL_MS.warningExtended,
      dismissible: true,
    })
  }
}

export async function exportHtmlViewerFallbackAction(args: {
  pushUiToast: PushUiToast
}): Promise<void> {
  const { exportHtmlViewerFallback } = (await import('@/features/toolbar/exportHtmlFallback')) as typeof import(
    '@/features/toolbar/exportHtmlFallback'
  )
  await exportHtmlViewerFallback({ pushUiToast: args.pushUiToast })
}

export async function exportHtmlCanvasFallbackAction(args: {
  pushUiToast: PushUiToast
}): Promise<void> {
  const { exportHtmlCanvasFallback } = (await import('@/features/toolbar/exportHtmlFallback')) as typeof import(
    '@/features/toolbar/exportHtmlFallback'
  )
  await exportHtmlCanvasFallback({ pushUiToast: args.pushUiToast })
}
