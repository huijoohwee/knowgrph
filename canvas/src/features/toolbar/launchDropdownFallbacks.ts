import type { UiToastInput } from '@/hooks/store/types'
import type { WorkspaceImportResult } from '@/components/BottomPanel/markdownWorkspace/workspaceImport/types'
import type { WorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import type { WorkspaceFs } from '@/features/workspace-fs/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { ensureEditorCanvasLandingForDuration } from '@/lib/toolbar/workspaceLandingGuard'

type PushUiToast = (toast: UiToastInput) => void

async function applyWorkspaceImportToCanvasIfAvailable(args: {
  fs: WorkspaceFs
  createdPaths: string[]
}): Promise<void> {
  try {
    const { applyWorkspaceImportToCanvas } = (await import(
      '@/features/workspace-fs/applyWorkspaceImportToCanvas'
    )) as typeof import('@/features/workspace-fs/applyWorkspaceImportToCanvas')
    await applyWorkspaceImportToCanvas(args)
  } catch {
    void 0
  }
}

async function focusFirstImportedWorkspaceFile(args: {
  fs: WorkspaceFs
  createdPaths: string[]
}): Promise<void> {
  const createdPaths = Array.isArray(args.createdPaths) ? args.createdPaths.map(p => String(p || '').trim()).filter(Boolean) : []
  if (createdPaths.length === 0) return
  try {
    const [{ workspaceBasename, workspaceDocumentKey }, { normalizeMermaidMmdToMarkdown }, { pickFirstCreatedFilePathForImportFocus }] = await Promise.all([
      import('@/features/workspace-fs/path') as Promise<typeof import('@/features/workspace-fs/path')>,
      import('grph-shared/markdown/mermaidInput') as Promise<typeof import('grph-shared/markdown/mermaidInput')>,
      import('@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions/importActions') as Promise<
        typeof import('@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions/importActions')
      >,
    ])

    const firstPath = (await pickFirstCreatedFilePathForImportFocus(args.fs as unknown as any, createdPaths)) || ''
    if (!firstPath) return

    const text = String((await args.fs.readFileText(firstPath).catch(() => '')) || '')
    const docKey = workspaceDocumentKey(firstPath)
    const name = docKey || workspaceBasename(firstPath) || firstPath
    const state = useGraphStore.getState()

    await state.setActiveMarkdownDocument({
      name,
      text: normalizeMermaidMmdToMarkdown(name, text),
      normalizeMermaidMmd: false,
      sourceUrl: null,
      jsonSourceText: null,
      applyToGraph: true,
      forceApplyToGraph: true,
    })

    try {
      ensureEditorCanvasLandingForDuration(2000)
    } catch {
      void 0
    }
  } catch {
    void 0
  }
}

export async function importLocalFilesFallback(args: {
  files: FileList | null
  pushUiToast: PushUiToast
}): Promise<void> {
  const snapshot = args.files ? Array.from(args.files) : []
  if (snapshot.length === 0) return
  args.pushUiToast({
    id: 'launch:import:localFiles',
    kind: 'neutral',
    message: `Importing ${snapshot.length} file(s)…`,
    ttlMs: null,
    dismissible: false,
  })
  try {
    const [{ getWorkspaceFs }, { WORKSPACE_ROOT_PATH }, { runWorkspaceFsChangedBatch }, { bulkSetWorkspaceEntrySources }, { importWorkspaceLocalFiles }] =
      await Promise.all([
        import('@/features/workspace-fs/workspaceFs') as Promise<typeof import('@/features/workspace-fs/workspaceFs')>,
        import('@/features/workspace-fs/path') as Promise<typeof import('@/features/workspace-fs/path')>,
        import('@/features/workspace-fs/workspaceFsEvents') as Promise<typeof import('@/features/workspace-fs/workspaceFsEvents')>,
        import('@/features/workspace-fs/sourceIndex') as Promise<typeof import('@/features/workspace-fs/sourceIndex')>,
        import('@/components/BottomPanel/markdownWorkspace/workspaceImport') as Promise<
          typeof import('@/components/BottomPanel/markdownWorkspace/workspaceImport')
        >,
      ])
    const fs = await getWorkspaceFs()
    await fs.ensureSeed()
    const res = (await runWorkspaceFsChangedBatch(() =>
      importWorkspaceLocalFiles({
        fs,
        files: snapshot,
        parentPath: WORKSPACE_ROOT_PATH,
      }),
    )) as WorkspaceImportResult
    bulkSetWorkspaceEntrySources(res.sources as Array<{ path: string; source: WorkspaceEntrySource }>)
    await applyWorkspaceImportToCanvasIfAvailable({ fs, createdPaths: res.createdPaths })
    await focusFirstImportedWorkspaceFile({ fs, createdPaths: res.createdPaths })
    args.pushUiToast({
      id: 'launch:import:localFiles',
      kind: 'success',
      message: `Imported ${res.createdPaths.length} file(s)`,
      ttlMs: 2200,
      dismissible: false,
    })
  } catch (e) {
    args.pushUiToast({
      id: 'launch:import:localFiles',
      kind: 'error',
      message: `Import failed: ${String((e as { message?: unknown })?.message ?? e)}`,
      ttlMs: 6000,
      dismissible: true,
    })
  }
}

export async function importLocalFolderFallback(args: {
  files: FileList | null
  pushUiToast: PushUiToast
}): Promise<void> {
  const snapshot = args.files ? Array.from(args.files) : []
  if (snapshot.length === 0) return
  args.pushUiToast({ id: 'launch:import:folder', kind: 'neutral', message: 'Importing folder…', ttlMs: null, dismissible: false })
  try {
    const [{ getWorkspaceFs }, { runWorkspaceFsChangedBatch }, { bulkSetWorkspaceEntrySources }, { importWorkspaceLocalFolder }] =
      await Promise.all([
        import('@/features/workspace-fs/workspaceFs') as Promise<typeof import('@/features/workspace-fs/workspaceFs')>,
        import('@/features/workspace-fs/workspaceFsEvents') as Promise<typeof import('@/features/workspace-fs/workspaceFsEvents')>,
        import('@/features/workspace-fs/sourceIndex') as Promise<typeof import('@/features/workspace-fs/sourceIndex')>,
        import('@/components/BottomPanel/markdownWorkspace/workspaceImport') as Promise<
          typeof import('@/components/BottomPanel/markdownWorkspace/workspaceImport')
        >,
      ])
    const fs = await getWorkspaceFs()
    await fs.ensureSeed()
    const res = (await runWorkspaceFsChangedBatch(() => importWorkspaceLocalFolder({ fs, files: snapshot }))) as WorkspaceImportResult
    bulkSetWorkspaceEntrySources(res.sources as Array<{ path: string; source: WorkspaceEntrySource }>)
    await applyWorkspaceImportToCanvasIfAvailable({ fs, createdPaths: res.createdPaths })
    await focusFirstImportedWorkspaceFile({ fs, createdPaths: res.createdPaths })
    args.pushUiToast({
      id: 'launch:import:folder',
      kind: 'success',
      message: `Imported ${res.createdPaths.length} file(s)`,
      ttlMs: 2200,
      dismissible: false,
    })
  } catch (e) {
    args.pushUiToast({
      id: 'launch:import:folder',
      kind: 'error',
      message: `Import failed: ${String((e as { message?: unknown })?.message ?? e)}`,
      ttlMs: 6000,
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
    const [{ getWorkspaceFs }, { WORKSPACE_ROOT_PATH }, { runWorkspaceFsChangedBatch }, { bulkSetWorkspaceEntrySources }, { importWorkspaceUrl }] =
      await Promise.all([
        import('@/features/workspace-fs/workspaceFs') as Promise<typeof import('@/features/workspace-fs/workspaceFs')>,
        import('@/features/workspace-fs/path') as Promise<typeof import('@/features/workspace-fs/path')>,
        import('@/features/workspace-fs/workspaceFsEvents') as Promise<typeof import('@/features/workspace-fs/workspaceFsEvents')>,
        import('@/features/workspace-fs/sourceIndex') as Promise<typeof import('@/features/workspace-fs/sourceIndex')>,
        import('@/components/BottomPanel/markdownWorkspace/workspaceImport') as Promise<
          typeof import('@/components/BottomPanel/markdownWorkspace/workspaceImport')
        >,
      ])
    const fs = await getWorkspaceFs()
    await fs.ensureSeed()
    const res = (await runWorkspaceFsChangedBatch(() =>
      importWorkspaceUrl({
        fs,
        urlRaw: url,
        parentPath: WORKSPACE_ROOT_PATH,
        onProgress: p => {
          const label = String((p as { label?: unknown }).label || '').trim() || 'Importing URL…'
          args.pushUiToast({ id: toastId, kind: 'neutral', message: label, ttlMs: null, dismissible: false })
        },
      }),
    )) as WorkspaceImportResult
    bulkSetWorkspaceEntrySources(res.sources as Array<{ path: string; source: WorkspaceEntrySource }>)
    await applyWorkspaceImportToCanvasIfAvailable({ fs, createdPaths: res.createdPaths })
    await focusFirstImportedWorkspaceFile({ fs, createdPaths: res.createdPaths })
    args.pushUiToast({
      id: toastId,
      kind: 'success',
      message: `Imported ${res.createdPaths.length} file(s)`,
      ttlMs: 2200,
      dismissible: false,
    })
  } catch (e) {
    args.pushUiToast({
      id: toastId,
      kind: 'error',
      message: `Import failed: ${String((e as { message?: unknown })?.message ?? e)}`,
      ttlMs: 6000,
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
    args.pushUiToast({ id: toastId, kind: 'success', message: 'Created folder', ttlMs: 1800, dismissible: false })
  } catch (e) {
    args.pushUiToast({
      id: toastId,
      kind: 'error',
      message: `Failed: ${String((e as { message?: unknown })?.message ?? e)}`,
      ttlMs: 6000,
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
