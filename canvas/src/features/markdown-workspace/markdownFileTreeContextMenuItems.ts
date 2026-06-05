import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { isInitializationWorkspacePath } from '@/features/workspace-fs/workspaceFs'
import { WORKSPACE_ROOT_PATH } from '@/features/workspace-fs/path'

export type MarkdownFileTreeContextMenuItem = {
  key: 'shareUrl' | 'reveal' | 'copyPath' | 'copyRelativePath' | 'newFile' | 'clear' | 'rename' | 'delete'
  label: string
  tone?: 'default' | 'danger'
  onSelect: () => void | Promise<void>
}

type BuildMarkdownFileTreeContextMenuItemsArgs = {
  entry: WorkspaceEntry
  copyToClipboard: (text: string) => Promise<boolean>
  buildShareUrl?: (entry: WorkspaceEntry) => string | null | Promise<string | null>
  promptShareUrl?: (url: string) => void
  onShareUrlError?: (message: string) => void
  onCreateNewFile?: (parentPath: WorkspacePath) => void
  onRevealInFinder?: (path: WorkspacePath) => void
  onClearFile?: (path: WorkspacePath) => void
  onRenameEntry?: (path: WorkspacePath, nextName: string) => void
  onDeleteEntry?: (path: WorkspacePath) => void
  closeContextMenu: () => void
  promptRename?: (currentName: string) => string | null
  confirmDelete?: (entryPath: string) => boolean
}

export function buildMarkdownFileTreeContextMenuItems(
  args: BuildMarkdownFileTreeContextMenuItemsArgs,
): MarkdownFileTreeContextMenuItem[] {
  const promptRename = args.promptRename || (currentName => window.prompt('Rename', currentName))
  const confirmDelete = args.confirmDelete || (entryPath => window.confirm(`Delete ${entryPath}?`))
  const entryPath = args.entry.path
  const isInitializationEntry = isInitializationWorkspacePath(entryPath)

  const items: MarkdownFileTreeContextMenuItem[] = [
    {
      key: 'shareUrl',
      label: 'Share URL',
      onSelect: () => {
        void Promise.resolve(args.buildShareUrl?.(args.entry) || null)
          .then(url => {
            if (!url) {
              notifyShareUrlError(args.onShareUrlError, 'Share URL is unavailable because the file could not be published.')
              return
            }
            return shareOrCopyUrl(url, args.copyToClipboard, args.promptShareUrl)
          })
          .catch(error => {
            notifyShareUrlError(args.onShareUrlError, 'Share URL is unavailable because the file could not be published.', error)
          })
        args.closeContextMenu()
      },
    },
    {
      key: 'reveal',
      label: 'Reveal in Finder',
      onSelect: () => {
        args.onRevealInFinder?.(entryPath)
        args.closeContextMenu()
      },
    },
    {
      key: 'copyPath',
      label: 'Copy Path',
      onSelect: () => {
        void args.copyToClipboard(entryPath)
        args.closeContextMenu()
      },
    },
    {
      key: 'copyRelativePath',
      label: 'Copy Relative Path',
      onSelect: () => {
        const relative = String(entryPath || '').replace(/^\/+/, '')
        void args.copyToClipboard(relative)
        args.closeContextMenu()
      },
    },
  ]

  if (args.onCreateNewFile) {
    items.push({
      key: 'newFile',
      label: 'New file',
      onSelect: () => {
        const parentPath = args.entry.kind === 'folder'
          ? args.entry.path
          : args.entry.parentPath || WORKSPACE_ROOT_PATH
        args.onCreateNewFile?.(parentPath)
        args.closeContextMenu()
      },
    })
  }

  if (args.entry.kind === 'file' && args.onClearFile) {
    items.push({
      key: 'clear',
      label: 'Clear',
      onSelect: () => {
        args.onClearFile?.(entryPath)
        args.closeContextMenu()
      },
    })
  }

  if (!isInitializationEntry) {
    items.push({
      key: 'rename',
      label: 'Rename',
      onSelect: () => {
        const current = String(args.entry.name || '').trim()
        const next = promptRename(current)
        if (!next || String(next).trim() === current) {
          args.closeContextMenu()
          return
        }
        args.onRenameEntry?.(entryPath, String(next).trim())
        args.closeContextMenu()
      },
    })
    items.push({
      key: 'delete',
      label: 'Delete',
      tone: 'danger',
      onSelect: () => {
        if (!confirmDelete(entryPath)) {
          args.closeContextMenu()
          return
        }
        args.onDeleteEntry?.(entryPath)
        args.closeContextMenu()
      },
    })
  }

  return items
}

function notifyShareUrlError(
  onShareUrlError: ((message: string) => void) | undefined,
  fallbackMessage: string,
  error?: unknown,
): void {
  const errorMessage = error instanceof Error ? String(error.message || '').trim() : ''
  const message = errorMessage || fallbackMessage
  if (typeof onShareUrlError === 'function') {
    onShareUrlError(message)
    return
  }
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(message)
  }
}

async function shareOrCopyUrl(
  url: string,
  copyToClipboard: (text: string) => Promise<boolean>,
  promptShareUrl?: (url: string) => void,
): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: 'Knowgrph Document', url })
      return
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
    }
  }
  const copied = await copyToClipboard(url)
  if (copied) return
  if (typeof promptShareUrl === 'function') {
    promptShareUrl(url)
    return
  }
  if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
    window.prompt('Share URL', url)
  }
}
