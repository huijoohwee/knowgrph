import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { ensureWorkspaceFolderTreeIfMissing } from '@/features/workspace-fs/ensureFolderTreeIfMissing'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { setWorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import { ensureWorkspaceDocsMirrorFolder, upsertWorkspaceDocsMirrorText } from '@/features/workspace-fs/workspaceSeedProvider'
import { WORKSPACE_DOCS_SOURCE_ROOT_PATH } from '@/features/workspace-fs/workspaceSourceRoots'
import { formatWorkspaceUtcSessionTimestamp } from '@/features/workspace-fs/workspaceTimestamp'
import type { WorkspacePath } from '@/features/workspace-fs/types'
import { openMarkdownWorkspaceEditorPane } from '@/features/workspace-table/workspaceTableSsot'

export type CreateNewMarkdownSourceFileArgs = {
  parentPath?: string | null
  timestampMs?: number
  text?: string
}

const NEW_MARKDOWN_SOURCE_FILE_PREFIX = 'note'

export function buildNewMarkdownSourceFileName(timestampMs: number): string {
  return `${NEW_MARKDOWN_SOURCE_FILE_PREFIX}_${formatWorkspaceUtcSessionTimestamp(timestampMs)}.md`
}

async function createTimestampedMarkdownSourceFile(args: {
  parentPath: WorkspacePath
  timestampMs: number
  text: string
}): Promise<WorkspacePath> {
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  await ensureWorkspaceFolderTreeIfMissing({ fs, folderPath: args.parentPath })
  for (let i = 0; i < 5; i += 1) {
    const timestampMs = args.timestampMs + i * 1000
    const name = buildNewMarkdownSourceFileName(timestampMs)
    const existingPath = normalizeWorkspacePath(`${args.parentPath === '/' ? '' : args.parentPath}/${name}`)
    const existing = await fs.readFileText(existingPath)
    if (existing !== null) continue
    const createdPath = await fs.createFile({ parentPath: args.parentPath, name, text: args.text })
    return normalizeWorkspacePath(createdPath)
  }
  const createdPath = await fs.createFile({
    parentPath: args.parentPath,
    name: buildNewMarkdownSourceFileName(Date.now()),
    text: args.text,
  })
  return normalizeWorkspacePath(createdPath)
}

async function persistNewMarkdownSourceFileToDocsMirror(args: {
  path: WorkspacePath
  parentPath: WorkspacePath
  text: string
}): Promise<void> {
  await ensureWorkspaceDocsMirrorFolder({ workspacePath: args.parentPath })
  await upsertWorkspaceDocsMirrorText({
    workspacePath: args.path,
    text: args.text,
    allowBlankText: true,
  })
}

export async function createNewMarkdownSourceFile(args?: CreateNewMarkdownSourceFileArgs): Promise<WorkspacePath> {
  const parentPath = normalizeWorkspacePath(args?.parentPath || WORKSPACE_DOCS_SOURCE_ROOT_PATH)
  const text = String(args?.text ?? '')
  const createdPath = await createTimestampedMarkdownSourceFile({
    parentPath,
    timestampMs: Number.isFinite(args?.timestampMs) ? Number(args?.timestampMs) : Date.now(),
    text,
  })
  await persistNewMarkdownSourceFileToDocsMirror({ path: createdPath, parentPath, text })
  openMarkdownWorkspaceEditorPane(useGraphStore.getState())
  useMarkdownExplorerStore.getState().setActivePath(createdPath)
  setWorkspaceEntrySource(createdPath, { kind: 'local', originalName: null }, { persist: 'sync' })
  return createdPath
}

export function createNewMarkdownSourceFileAndOpenViewer(args?: CreateNewMarkdownSourceFileArgs): { id: string; name: string } | null {
  const parentPath = normalizeWorkspacePath(args?.parentPath || WORKSPACE_DOCS_SOURCE_ROOT_PATH)
  void createNewMarkdownSourceFile({ ...args, parentPath }).catch(e => {
    try {
      useGraphStore.getState().pushUiToast({
        id: 'source-files:new-markdown-file',
        kind: 'error',
        message: `New .md failed: ${String((e as { message?: unknown })?.message ?? e)}`,
        dismissible: true,
      })
    } catch {
      void 0
    }
  })
  return { id: 'workspace', name: parentPath }
}
